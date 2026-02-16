/**
 * WhatsApp Chat Export Parser
 * Parses .txt files exported from WhatsApp's "Export Chat" feature.
 * Supports both 12h and 24h formats, and various date separators.
 */

export interface WhatsAppMessage {
  timestamp: Date;
  sender: string;
  text: string;
}

export interface ParsedChat {
  chatName: string; // derived from filename or first contact
  messages: WhatsAppMessage[];
  participants: string[];
}

// Common WhatsApp export patterns:
// [1/18/26, 10:55:23 AM] Elias: hey
// 18.01.26, 10:55 - Elias: hey
// 1/18/2026, 10:55 AM - Elias: hey
// [2026-01-18, 10:55:23] Elias: hey

const LINE_PATTERNS = [
  // [MM/DD/YY, HH:MM:SS AM/PM] Sender: Message (iOS style)
  /^\[(\d{1,2}\/\d{1,2}\/\d{2,4}),\s+(\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM|am|pm)?)\]\s+([^:]+):\s+(.*)/,
  // MM/DD/YY, HH:MM - Sender: Message (Android style)  
  /^(\d{1,2}\/\d{1,2}\/\d{2,4}),\s+(\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM|am|pm)?)\s+-\s+([^:]+):\s+(.*)/,
  // DD.MM.YY, HH:MM - Sender: Message (European Android)
  /^(\d{1,2}\.\d{1,2}\.\d{2,4}),\s+(\d{1,2}:\d{2}(?::\d{2})?)\s+-\s+([^:]+):\s+(.*)/,
  // [YYYY-MM-DD, HH:MM:SS] Sender: Message
  /^\[(\d{4}-\d{2}-\d{2}),\s+(\d{1,2}:\d{2}(?::\d{2})?)\]\s+([^:]+):\s+(.*)/,
];

// System message patterns (not from a person)
const SYSTEM_PATTERNS = [
  /Messages and calls are end-to-end encrypted/i,
  /created group/i,
  /added you/i,
  /changed the subject/i,
  /changed this group/i,
  /left$/,
  /joined using/i,
  /removed$/,
  /changed the group description/i,
  /message was deleted/i,
  /\<Media omitted\>/i,
  /security code changed/i,
  /disappearing messages/i,
];

function parseDate(dateStr: string, timeStr: string): Date {
  let day: number, month: number, year: number;

  if (dateStr.includes("-")) {
    // YYYY-MM-DD
    const parts = dateStr.split("-").map(Number);
    [year, month, day] = parts;
  } else if (dateStr.includes(".")) {
    // DD.MM.YY or DD.MM.YYYY
    const parts = dateStr.split(".").map(Number);
    [day, month, year] = parts;
  } else {
    // MM/DD/YY or MM/DD/YYYY
    const parts = dateStr.split("/").map(Number);
    [month, day, year] = parts;
  }

  if (year < 100) year += 2000;

  // Parse time
  const isPM = /PM/i.test(timeStr);
  const isAM = /AM/i.test(timeStr);
  const timeParts = timeStr.replace(/\s*(AM|PM|am|pm)/, "").split(":").map(Number);
  let hours = timeParts[0];
  const minutes = timeParts[1];
  const seconds = timeParts[2] || 0;

  if (isPM && hours !== 12) hours += 12;
  if (isAM && hours === 12) hours = 0;

  return new Date(year, month - 1, day, hours, minutes, seconds);
}

function isSystemMessage(sender: string, text: string): boolean {
  return SYSTEM_PATTERNS.some((p) => p.test(text) || p.test(sender));
}

export function parseWhatsAppExport(content: string, filename?: string): ParsedChat {
  const lines = content.split("\n");
  const messages: WhatsAppMessage[] = [];
  const participantSet = new Set<string>();
  let currentMessage: WhatsAppMessage | null = null;

  for (const line of lines) {
    let matched = false;

    for (const pattern of LINE_PATTERNS) {
      const match = line.match(pattern);
      if (match) {
        // Save previous message
        if (currentMessage) {
          messages.push(currentMessage);
        }

        const [, dateStr, timeStr, sender, text] = match;
        const trimmedSender = sender.trim();

        if (!isSystemMessage(trimmedSender, text)) {
          participantSet.add(trimmedSender);
          currentMessage = {
            timestamp: parseDate(dateStr, timeStr),
            sender: trimmedSender,
            text: text.trim(),
          };
        } else {
          currentMessage = null;
        }

        matched = true;
        break;
      }
    }

    // Continuation line (multi-line message)
    if (!matched && currentMessage && line.trim()) {
      currentMessage.text += "\n" + line;
    }
  }

  // Push last message
  if (currentMessage) {
    messages.push(currentMessage);
  }

  // Derive chat name from filename
  let chatName = "Unknown Chat";
  if (filename) {
    // "WhatsApp Chat with John Doe.txt" or "WhatsApp Chat - John Doe.txt"
    const nameMatch = filename.match(/(?:with|[-–])\s+(.+?)\.txt$/i);
    if (nameMatch) {
      chatName = nameMatch[1].trim();
    } else {
      chatName = filename.replace(/\.txt$/i, "").trim();
    }
  } else if (participantSet.size > 0) {
    // Use the most frequent non-"You" sender
    const others = [...participantSet].filter(
      (p) => !["You", "you", "Du", "du"].includes(p)
    );
    chatName = others[0] || [...participantSet][0];
  }

  return {
    chatName,
    messages,
    participants: [...participantSet],
  };
}

/**
 * Group messages into conversation segments (by day) for creating meeting entries
 */
export interface ConversationSegment {
  date: string; // YYYY-MM-DD
  participants: string[];
  messages: WhatsAppMessage[];
  rawText: string;
}

export function groupByDay(parsed: ParsedChat): ConversationSegment[] {
  const dayMap = new Map<string, WhatsAppMessage[]>();

  for (const msg of parsed.messages) {
    const dayKey = msg.timestamp.toISOString().split("T")[0];
    if (!dayMap.has(dayKey)) {
      dayMap.set(dayKey, []);
    }
    dayMap.get(dayKey)!.push(msg);
  }

  const segments: ConversationSegment[] = [];
  for (const [date, msgs] of dayMap.entries()) {
    const participants = [...new Set(msgs.map((m) => m.sender))];
    const rawText = msgs
      .map((m) => `[${m.timestamp.toLocaleTimeString()}] ${m.sender}: ${m.text}`)
      .join("\n");

    segments.push({ date, participants, messages: msgs, rawText });
  }

  return segments.sort((a, b) => a.date.localeCompare(b.date));
}
