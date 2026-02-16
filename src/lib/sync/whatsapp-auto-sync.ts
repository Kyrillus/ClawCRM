/**
 * WhatsApp Auto-Sync: real-time message → CRM sync
 * Each day's conversation with a person becomes one meeting entry.
 */

import { db, schema } from "@/lib/db";
import { eq, sql, and } from "drizzle-orm";
import { waClient } from "./whatsapp-client";
import type { Message } from "whatsapp-web.js";

// Debounce: batch rapid messages per chat
const pendingMessages = new Map<string, { messages: Message[]; timer: ReturnType<typeof setTimeout> }>();
const DEBOUNCE_MS = 5000;

/**
 * Find or create a person by name and/or phone (reuses logic pattern from whatsapp-sync.ts)
 */
async function findOrCreatePersonLive(
  name: string,
  phone: string | null,
  whatsappId: string
): Promise<number> {
  // Try whatsappId match first
  const byWaId = await db
    .select()
    .from(schema.people)
    .where(eq(schema.people.whatsappId, whatsappId))
    .limit(1);
  if (byWaId.length > 0) return byWaId[0].id;

  // Try exact name match
  const allPeople = await db.select().from(schema.people);
  const exact = allPeople.find((p) => p.name.toLowerCase() === name.toLowerCase());
  if (exact) {
    // Update whatsappId
    if (!exact.whatsappId) {
      await db
        .update(schema.people)
        .set({ whatsappId, updatedAt: new Date().toISOString() })
        .where(eq(schema.people.id, exact.id));
    }
    return exact.id;
  }

  // Try phone match
  if (phone) {
    const normalizedPhone = phone.replace(/\D/g, "");
    const byPhone = allPeople.find((p) => p.phone && p.phone.replace(/\D/g, "") === normalizedPhone);
    if (byPhone) {
      if (!byPhone.whatsappId) {
        await db
          .update(schema.people)
          .set({ whatsappId, updatedAt: new Date().toISOString() })
          .where(eq(schema.people.id, byPhone.id));
      }
      return byPhone.id;
    }
  }

  // Create new
  const now = new Date().toISOString();
  const [person] = await db.insert(schema.people).values({
    name,
    phone,
    whatsappId,
    tags: ["whatsapp"],
    context: "Auto-synced from WhatsApp live",
    createdAt: now,
    updatedAt: now,
  }).returning();

  return person.id;
}

/**
 * Get or create today's meeting for a person
 */
async function getOrCreateTodayMeeting(personId: number): Promise<number> {
  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

  // Check existing meeting for today
  const existing = await db
    .select({ id: schema.meetings.id })
    .from(schema.meetings)
    .innerJoin(schema.meetingPeople, eq(schema.meetings.id, schema.meetingPeople.meetingId))
    .where(
      sql`${schema.meetings.source} = 'whatsapp-live' AND ${schema.meetingPeople.personId} = ${personId} AND date(${schema.meetings.date}) = ${today}`
    )
    .limit(1);

  if (existing.length > 0) return existing[0].id;

  // Create new meeting
  const [meeting] = await db.insert(schema.meetings).values({
    personId,
    date: new Date().toISOString(),
    rawInput: "",
    summary: null,
    source: "whatsapp-live",
    topics: [],
    createdAt: new Date().toISOString(),
  }).returning();

  // Link in junction table
  await db.insert(schema.meetingPeople).values({
    meetingId: meeting.id,
    personId,
  });

  return meeting.id;
}

/**
 * Append messages to a meeting's rawInput
 */
async function appendToMeeting(meetingId: number, formattedMessages: string) {
  const [meeting] = await db
    .select({ rawInput: schema.meetings.rawInput })
    .from(schema.meetings)
    .where(eq(schema.meetings.id, meetingId))
    .limit(1);

  const existing = meeting?.rawInput || "";
  const separator = existing ? "\n" : "";
  const newRaw = existing + separator + formattedMessages;

  await db
    .update(schema.meetings)
    .set({ rawInput: newRaw })
    .where(eq(schema.meetings.id, meetingId));
}

/**
 * Process a batch of messages for a single chat
 */
async function processBatch(chatId: string, messages: Message[]) {
  try {
    const msg = messages[0];
    const contact = await msg.getContact();
    const name = contact.pushname || contact.name || contact.number;
    const phone = contact.number ? `+${contact.number}` : null;

    const personId = await findOrCreatePersonLive(name, phone, chatId);
    const meetingId = await getOrCreateTodayMeeting(personId);

    // Format messages
    const formatted = messages
      .map((m) => {
        const time = new Date(m.timestamp * 1000).toLocaleTimeString("de-AT", {
          hour: "2-digit",
          minute: "2-digit",
        });
        const sender = m.fromMe ? "You" : name;
        return `[${time}] ${sender}: ${m.body}`;
      })
      .join("\n");

    await appendToMeeting(meetingId, formatted);
    waClient.incrementMessageCount();

    // Update meeting summary
    const msgCount = messages.length;
    const today = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" });
    await db
      .update(schema.meetings)
      .set({ summary: `WhatsApp conversation with ${name} on ${today} (live sync)` })
      .where(eq(schema.meetings.id, meetingId));
  } catch (err) {
    console.error("[WA Auto-Sync] Error processing batch:", err);
  }
}

/**
 * Handle an incoming message (called by whatsapp-client)
 */
async function handleMessage(msg: Message) {
  // Skip non-text, status, and group messages
  if (!msg.body) return;
  if (msg.isStatus) return;

  const chat = await msg.getChat();
  if (chat.isGroup) return;

  // Determine the "other person" chat ID
  const chatId = chat.id._serialized;

  // Debounce: batch messages per chat
  const pending = pendingMessages.get(chatId);
  if (pending) {
    clearTimeout(pending.timer);
    pending.messages.push(msg);
    pending.timer = setTimeout(() => {
      const batch = pendingMessages.get(chatId);
      if (batch) {
        pendingMessages.delete(chatId);
        processBatch(chatId, batch.messages);
      }
    }, DEBOUNCE_MS);
  } else {
    pendingMessages.set(chatId, {
      messages: [msg],
      timer: setTimeout(() => {
        const batch = pendingMessages.get(chatId);
        if (batch) {
          pendingMessages.delete(chatId);
          processBatch(chatId, batch.messages);
        }
      }, DEBOUNCE_MS),
    });
  }
}

/**
 * Register the auto-sync handler on the client
 */
let registered = false;
export function registerAutoSync() {
  if (registered) return;
  waClient.onMessage(handleMessage);
  registered = true;
  console.log("[WA Auto-Sync] Registered message handler");
}

/**
 * Sync all contacts from WhatsApp to CRM
 */
export async function syncAllContacts(): Promise<{ synced: number; created: number; errors: string[] }> {
  const contacts = await waClient.getContacts();
  let synced = 0;
  let created = 0;
  const errors: string[] = [];

  for (const contact of contacts) {
    if (!contact.isMyContact) continue;
    if (!contact.name && !contact.pushname) continue;

    const name = contact.name || contact.pushname || contact.number;
    const phone = contact.number ? `+${contact.number}` : null;
    const waId = contact.id._serialized;

    try {
      // Check if exists
      const existing = await db
        .select()
        .from(schema.people)
        .where(eq(schema.people.whatsappId, waId))
        .limit(1);

      if (existing.length > 0) {
        // Update phone if missing
        if (phone && !existing[0].phone) {
          await db
            .update(schema.people)
            .set({ phone, updatedAt: new Date().toISOString() })
            .where(eq(schema.people.id, existing[0].id));
        }
        synced++;
      } else {
        await findOrCreatePersonLive(name, phone, waId);
        created++;
        synced++;
      }
    } catch (err) {
      errors.push(`${name}: ${err}`);
    }
  }

  // Log to syncLog
  await db.insert(schema.syncLog).values({
    type: "contacts-live",
    status: "completed",
    contactsSynced: synced,
    messagesSynced: 0,
    details: `Synced ${synced} contacts (${created} new)`,
    timestamp: new Date().toISOString(),
  });

  return { synced, created, errors };
}
