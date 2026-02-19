import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { sql, eq, desc, like } from "drizzle-orm";
import { stringSimilarity } from "string-similarity-js";

export const dynamic = "force-dynamic";

type Intent = "person_lookup" | "company_search" | "topic_search" | "stats" | "recent_meetings" | "unknown";

function detectIntent(q: string): { intent: Intent; params: Record<string, string> } {
  const lower = q.toLowerCase().trim();

  // Stats queries
  if (/how many (people|contacts|persons)/.test(lower) || /total (people|contacts)/.test(lower)) {
    return { intent: "stats", params: { type: "people_count" } };
  }
  if (/how many meetings/.test(lower) || /total meetings/.test(lower)) {
    return { intent: "stats", params: { type: "meeting_count" } };
  }
  if (/stats|overview|summary of (my |the )?crm/.test(lower)) {
    return { intent: "stats", params: { type: "overview" } };
  }

  // Company search
  const companyMatch = lower.match(/(?:who works at|people at|contacts at|from) (.+?)(?:\?|$)/);
  if (companyMatch) {
    return { intent: "company_search", params: { company: companyMatch[1].trim() } };
  }

  // Topic search
  const topicMatch = lower.match(/meetings? (?:about|on|regarding) (.+?)(?:\?|$| this | last )/);
  if (topicMatch) {
    const dateFilter = /this month/.test(lower) ? "this_month" :
                       /last month/.test(lower) ? "last_month" :
                       /this week/.test(lower) ? "this_week" :
                       /today/.test(lower) ? "today" : "all";
    return { intent: "topic_search", params: { topic: topicMatch[1].trim(), dateFilter } };
  }

  // Recent meetings
  if (/recent meetings|latest meetings|last meetings/.test(lower)) {
    return { intent: "recent_meetings", params: {} };
  }

  // Person lookup - "when did I last talk to X", "tell me about X", "what do I know about X"
  const personMatch = lower.match(
    /(?:when did i (?:last )?(?:talk|speak|meet|chat) (?:to|with)|(?:tell me |what do i know )?about|find|look ?up|who is) (.+?)(?:\?|$)/
  );
  if (personMatch) {
    return { intent: "person_lookup", params: { name: personMatch[1].trim() } };
  }

  // Fallback: treat as person lookup if it's just a name-like string (1-3 words, no question words)
  if (/^[a-z\s]{2,40}$/.test(lower) && lower.split(/\s+/).length <= 3 && !/^(when|what|how|who|where|why|which|do|is|are|the)/.test(lower)) {
    return { intent: "person_lookup", params: { name: lower } };
  }

  return { intent: "unknown", params: { raw: q } };
}

function getDateRange(filter: string): { start: string; end: string } | null {
  const now = new Date();
  if (filter === "today") {
    const d = now.toISOString().slice(0, 10);
    return { start: d, end: d + "T23:59:59" };
  }
  if (filter === "this_week") {
    const day = now.getDay();
    const start = new Date(now); start.setDate(now.getDate() - day);
    return { start: start.toISOString().slice(0, 10), end: now.toISOString() };
  }
  if (filter === "this_month") {
    return { start: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`, end: now.toISOString() };
  }
  if (filter === "last_month") {
    const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const em = new Date(now.getFullYear(), now.getMonth(), 0);
    return { start: lm.toISOString().slice(0, 10), end: em.toISOString().slice(0, 10) + "T23:59:59" };
  }
  return null;
}

function fuzzyFindPeople(name: string, allPeople: (typeof schema.people.$inferSelect)[]) {
  return allPeople
    .map((p) => ({ ...p, score: stringSimilarity(name.toLowerCase(), p.name.toLowerCase()) }))
    .filter((p) => p.score > 0.3)
    .sort((a, b) => b.score - a.score);
}

export async function GET(req: NextRequest) {
  try {
    const q = req.nextUrl.searchParams.get("q");
    if (!q) return NextResponse.json({ error: "Missing ?q= parameter" }, { status: 400 });

    const { intent, params } = detectIntent(q);

    if (intent === "stats") {
      const peopleCount = db.select({ count: sql<number>`count(*)` }).from(schema.people).get()!.count;
      const meetingCount = db.select({ count: sql<number>`count(*)` }).from(schema.meetings).get()!.count;

      if (params.type === "people_count") {
        return NextResponse.json({ intent, answer: `You have ${peopleCount} people in your CRM.`, data: { peopleCount } });
      }
      if (params.type === "meeting_count") {
        return NextResponse.json({ intent, answer: `You have ${meetingCount} meetings logged.`, data: { meetingCount } });
      }
      return NextResponse.json({
        intent, answer: `CRM Overview: ${peopleCount} people, ${meetingCount} meetings.`,
        data: { peopleCount, meetingCount },
      });
    }

    if (intent === "company_search") {
      const results = db.select().from(schema.people)
        .where(like(schema.people.company, `%${params.company}%`)).all();
      const answer = results.length === 0
        ? `No one found at "${params.company}".`
        : `${results.length} people at "${params.company}": ${results.map((p) => p.name).join(", ")}`;
      return NextResponse.json({ intent, answer, data: results.map(({ embedding, ...r }) => r) });
    }

    if (intent === "topic_search") {
      const range = getDateRange(params.dateFilter);
      let meetingsAll = db.select().from(schema.meetings).orderBy(desc(schema.meetings.date)).all();
      if (range) {
        meetingsAll = meetingsAll.filter((m) => m.date >= range.start && m.date <= range.end);
      }
      const topic = params.topic.toLowerCase();
      const matched = meetingsAll.filter((m) => {
        const topics = (m.topics as string[]) || [];
        const inTopics = topics.some((t) => t.toLowerCase().includes(topic));
        const inSummary = m.summary?.toLowerCase().includes(topic);
        const inRaw = m.rawInput.toLowerCase().includes(topic);
        return inTopics || inSummary || inRaw;
      });
      const answer = matched.length === 0
        ? `No meetings found about "${params.topic}".`
        : `Found ${matched.length} meeting(s) about "${params.topic}".`;
      return NextResponse.json({ intent, answer, data: matched.map(({ embedding, ...m }) => m) });
    }

    if (intent === "recent_meetings") {
      const recent = db.select().from(schema.meetings).orderBy(desc(schema.meetings.date)).limit(10).all();
      return NextResponse.json({
        intent, answer: `Last ${recent.length} meetings.`,
        data: recent.map(({ embedding, ...m }) => m),
      });
    }

    if (intent === "person_lookup") {
      const allPeople = db.select().from(schema.people).all();
      const matches = fuzzyFindPeople(params.name, allPeople);
      if (matches.length === 0) {
        return NextResponse.json({ intent, answer: `No one named "${params.name}" found.`, data: [] });
      }
      const person = matches[0];
      // Get last meeting
      const lastMeeting = db.select().from(schema.meetings)
        .innerJoin(schema.meetingPeople, eq(schema.meetings.id, schema.meetingPeople.meetingId))
        .where(eq(schema.meetingPeople.personId, person.id))
        .orderBy(desc(schema.meetings.date))
        .limit(1).get();

      // Also check legacy personId
      const legacyMeeting = db.select().from(schema.meetings)
        .where(eq(schema.meetings.personId, person.id))
        .orderBy(desc(schema.meetings.date))
        .limit(1).get();

      const best = [lastMeeting?.meetings, legacyMeeting]
        .filter(Boolean)
        .sort((a, b) => (b!.date > a!.date ? 1 : -1))[0];

      const { embedding, ...personData } = person;
      let answer: string;
      if (best) {
        answer = `Last interaction with ${person.name}: ${best.date.slice(0, 10)}. Summary: ${best.summary || best.rawInput.slice(0, 150)}`;
      } else {
        answer = `Found ${person.name}${person.company ? ` (${person.company})` : ""}, but no meetings logged.`;
      }
      return NextResponse.json({
        intent, answer,
        data: { person: personData, lastMeeting: best ? { ...best, embedding: undefined } : null },
      });
    }

    // Unknown intent - try fuzzy person search as fallback
    const allPeople = db.select().from(schema.people).all();
    const matches = fuzzyFindPeople(q, allPeople);
    if (matches.length > 0 && matches[0].score > 0.4) {
      const person = matches[0];
      const { embedding, ...personData } = person;
      return NextResponse.json({
        intent: "person_lookup", answer: `Found ${person.name}${person.company ? ` at ${person.company}` : ""}.`,
        data: { person: personData },
      });
    }

    return NextResponse.json({
      intent: "unknown",
      answer: `I couldn't understand the query: "${q}". Try asking about a person, company, topic, or stats.`,
      data: null,
    });
  } catch (error) {
    console.error("OpenClaw query error:", error);
    return NextResponse.json({ error: "Query failed" }, { status: 500 });
  }
}
