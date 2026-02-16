/**
 * WhatsApp Sync Engine
 * Takes parsed WhatsApp data and syncs it into the CRM database.
 */

import { db, schema } from "@/lib/db";
import { eq, like, sql } from "drizzle-orm";
import type { ParsedChat, ConversationSegment } from "./whatsapp-parser";
import { groupByDay } from "./whatsapp-parser";

interface SyncResult {
  contactsSynced: number;
  messagesSynced: number;
  errors: string[];
  newPeople: string[];
  matchedPeople: string[];
  meetingsCreated: number;
}

/**
 * Fuzzy name matching score (0-1)
 */
function nameMatchScore(a: string, b: string): number {
  const la = a.toLowerCase().trim();
  const lb = b.toLowerCase().trim();
  if (la === lb) return 1;
  if (la.includes(lb) || lb.includes(la)) return 0.8;

  // Token overlap
  const tokensA = la.split(/\s+/);
  const tokensB = lb.split(/\s+/);
  const overlap = tokensA.filter((t) => tokensB.includes(t)).length;
  const maxLen = Math.max(tokensA.length, tokensB.length);
  return overlap / maxLen;
}

/**
 * Find or create a person by name, with optional whatsappId
 */
async function findOrCreatePerson(
  name: string,
  whatsappId?: string
): Promise<{ id: number; isNew: boolean; matchedName: string }> {
  // Skip "You" / "Du" (the user themselves)
  const selfNames = ["you", "du", "ich"];
  if (selfNames.includes(name.toLowerCase())) {
    throw new Error("SELF");
  }

  // 1. Try exact whatsappId match
  if (whatsappId) {
    const byWaId = await db
      .select()
      .from(schema.people)
      .where(eq(schema.people.whatsappId, whatsappId))
      .limit(1);
    if (byWaId.length > 0) {
      return { id: byWaId[0].id, isNew: false, matchedName: byWaId[0].name };
    }
  }

  // 2. Try name match (exact then fuzzy)
  const allPeople = await db.select().from(schema.people);

  // Exact match
  const exact = allPeople.find(
    (p) => p.name.toLowerCase() === name.toLowerCase()
  );
  if (exact) {
    // Update whatsappId if we have it and they don't
    if (whatsappId && !exact.whatsappId) {
      await db
        .update(schema.people)
        .set({ whatsappId, updatedAt: new Date().toISOString() })
        .where(eq(schema.people.id, exact.id));
    }
    return { id: exact.id, isNew: false, matchedName: exact.name };
  }

  // Fuzzy match (threshold 0.7)
  let bestMatch: (typeof allPeople)[0] | null = null;
  let bestScore = 0;
  for (const p of allPeople) {
    const score = nameMatchScore(name, p.name);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = p;
    }
  }

  if (bestMatch && bestScore >= 0.7) {
    if (whatsappId && !bestMatch.whatsappId) {
      await db
        .update(schema.people)
        .set({ whatsappId, updatedAt: new Date().toISOString() })
        .where(eq(schema.people.id, bestMatch.id));
    }
    return { id: bestMatch.id, isNew: false, matchedName: bestMatch.name };
  }

  // 3. Create new person
  const now = new Date().toISOString();
  const result = await db.insert(schema.people).values({
    name,
    whatsappId: whatsappId || null,
    tags: ["whatsapp"],
    context: `Imported from WhatsApp`,
    createdAt: now,
    updatedAt: now,
  }).returning();

  return { id: result[0].id, isNew: true, matchedName: name };
}

/**
 * Check if a meeting already exists for this conversation segment
 * (dedup by date + person + source)
 */
async function meetingExists(
  personId: number,
  date: string,
  source: string
): Promise<boolean> {
  const existing = await db
    .select()
    .from(schema.meetings)
    .innerJoin(
      schema.meetingPeople,
      eq(schema.meetings.id, schema.meetingPeople.meetingId)
    )
    .where(
      sql`${schema.meetings.source} = ${source} AND ${schema.meetingPeople.personId} = ${personId} AND date(${schema.meetings.date}) = ${date}`
    )
    .limit(1);

  return existing.length > 0;
}

/**
 * Sync a parsed WhatsApp chat into the CRM
 */
export async function syncWhatsAppChat(
  parsed: ParsedChat,
  options: {
    syncContacts?: boolean;
    syncMessages?: boolean;
    selfName?: string; // The user's own name in WhatsApp (to exclude)
  } = {}
): Promise<SyncResult> {
  const { syncContacts = true, syncMessages = true, selfName } = options;
  const result: SyncResult = {
    contactsSynced: 0,
    messagesSynced: 0,
    errors: [],
    newPeople: [],
    matchedPeople: [],
    meetingsCreated: 0,
  };

  // Determine which names are "self" (the CRM owner)
  const selfNames = new Set(
    ["you", "du", "ich", selfName?.toLowerCase()].filter(Boolean)
  );

  // Map participant names to person IDs
  const personMap = new Map<string, number>();

  if (syncContacts) {
    for (const participant of parsed.participants) {
      if (selfNames.has(participant.toLowerCase())) continue;

      try {
        const person = await findOrCreatePerson(participant);
        personMap.set(participant, person.id);
        result.contactsSynced++;

        if (person.isNew) {
          result.newPeople.push(participant);
        } else {
          result.matchedPeople.push(`${participant} → ${person.matchedName}`);
        }
      } catch (err) {
        if (err instanceof Error && err.message === "SELF") continue;
        result.errors.push(`Failed to sync contact "${participant}": ${err}`);
      }
    }
  }

  if (syncMessages) {
    const segments = groupByDay(parsed);

    for (const segment of segments) {
      // Filter out self-only segments
      const otherParticipants = segment.participants.filter(
        (p) => !selfNames.has(p.toLowerCase())
      );
      if (otherParticipants.length === 0) continue;

      // Ensure all participants are in personMap
      for (const p of otherParticipants) {
        if (!personMap.has(p)) {
          try {
            const person = await findOrCreatePerson(p);
            personMap.set(p, person.id);
          } catch {
            continue;
          }
        }
      }

      const personIds = otherParticipants
        .map((p) => personMap.get(p))
        .filter(Boolean) as number[];

      if (personIds.length === 0) continue;

      // Check dedup (use first person as primary for dedup check)
      const alreadyExists = await meetingExists(
        personIds[0],
        segment.date,
        "whatsapp"
      );
      if (alreadyExists) continue;

      // Create meeting
      const msgCount = segment.messages.length;
      const summary = `WhatsApp conversation with ${otherParticipants.join(", ")} (${msgCount} messages)`;

      try {
        const [meeting] = await db
          .insert(schema.meetings)
          .values({
            personId: personIds[0], // Legacy field
            date: new Date(segment.date).toISOString(),
            rawInput: segment.rawText,
            summary,
            source: "whatsapp",
            topics: [],
            createdAt: new Date().toISOString(),
          })
          .returning();

        // Link all people via junction table
        for (const pid of personIds) {
          await db.insert(schema.meetingPeople).values({
            meetingId: meeting.id,
            personId: pid,
          });
        }

        result.meetingsCreated++;
        result.messagesSynced += msgCount;
      } catch (err) {
        result.errors.push(
          `Failed to create meeting for ${segment.date}: ${err}`
        );
      }
    }
  }

  return result;
}

/**
 * Log a sync operation
 */
export async function logSync(
  type: string,
  status: string,
  result?: Partial<SyncResult>,
  details?: string
) {
  await db.insert(schema.syncLog).values({
    type,
    status,
    contactsSynced: result?.contactsSynced ?? 0,
    messagesSynced: result?.messagesSynced ?? 0,
    errors: result?.errors?.length ? JSON.stringify(result.errors) : null,
    details: details || null,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Get sync history
 */
export async function getSyncHistory(limit = 20) {
  return db
    .select()
    .from(schema.syncLog)
    .orderBy(sql`${schema.syncLog.timestamp} DESC`)
    .limit(limit);
}
