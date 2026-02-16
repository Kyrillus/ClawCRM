import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { getLLM, getEmbedder } from "@/lib/llm/provider";
import { embeddingToBuffer } from "@/lib/llm/embeddings";
import { stringSimilarity } from "string-similarity-js";

export const dynamic = "force-dynamic";

interface MultiMeetingExtraction {
  names: string[];
  summary: string;
  topics: string[];
}

interface PersonMatch {
  extractedName: string;
  bestMatch: {
    id: number;
    name: string;
    company: string | null;
    role: string | null;
  } | null;
  candidates: {
    id: number;
    name: string;
    company: string | null;
    role: string | null;
    score: number;
  }[];
  confidence: number;
  isNew: boolean;
}

// POST /api/meetings/process
// Mode 1 (preview): { text } -> returns extraction + matches for review
// Mode 2 (confirm): { confirm: true, text, summary, topics, assignments: [...] } -> saves meeting
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text, confirm } = body;

    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "Text is required" }, { status: 400 });
    }

    if (confirm) {
      return handleConfirm(body);
    }

    return handlePreview(text);
  } catch (error) {
    console.error("Error processing meeting:", error);
    return NextResponse.json(
      { error: "Failed to process meeting" },
      { status: 500 }
    );
  }
}

async function handlePreview(text: string) {
  const llm = getLLM();

  // Extract multiple names, summary, and topics
  let extraction: MultiMeetingExtraction;
  try {
    extraction = await llm.extractJSON<MultiMeetingExtraction>(
      `Analyze this meeting note and extract the following information.

Meeting note:
${text}

Return a JSON object with:
- "names": an array of ALL person names mentioned (not "I" or "me", just other people). Include every distinct person.
- "summary": a brief 1-2 sentence summary of the meeting
- "topics": an array of 3-8 topic keywords/phrases discussed`,
      "You are a meeting note analyzer. Extract structured data from meeting notes. Return valid JSON only."
    );
  } catch {
    const raw = await llm.chat(
      `Extract from this meeting note: all person names mentioned (as array), a brief summary, and topic keywords. Meeting note: ${text}`,
      "Extract meeting info. Return JSON: {names[], summary, topics[]}"
    );
    try {
      extraction = JSON.parse(raw);
    } catch {
      extraction = {
        names: ["Unknown Person"],
        summary: text.slice(0, 200),
        topics: [],
      };
    }
  }

  // Ensure names is always an array
  if (!Array.isArray(extraction.names)) {
    // Handle legacy single-name format
    const legacyName = (extraction as unknown as { name?: string }).name;
    extraction.names = legacyName ? [legacyName] : ["Unknown Person"];
  }

  // Fuzzy match each name against existing people
  const allPeople = db.select().from(schema.people).all();
  const matches: PersonMatch[] = extraction.names.map((extractedName) => {
    const scored = allPeople
      .map((person) => ({
        id: person.id,
        name: person.name,
        company: person.company,
        role: person.role,
        score: stringSimilarity(
          extractedName.toLowerCase(),
          person.name.toLowerCase()
        ),
      }))
      .filter((p) => p.score > 0.2)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    const bestMatch = scored.length > 0 && scored[0].score >= 0.4 ? scored[0] : null;

    return {
      extractedName,
      bestMatch: bestMatch
        ? { id: bestMatch.id, name: bestMatch.name, company: bestMatch.company, role: bestMatch.role }
        : null,
      candidates: scored,
      confidence: bestMatch?.score ?? 0,
      isNew: !bestMatch,
    };
  });

  return NextResponse.json({
    extraction: {
      names: extraction.names,
      summary: extraction.summary,
      topics: extraction.topics,
    },
    matches,
  });
}

interface Assignment {
  extractedName: string;
  personId?: number;
  createNew?: boolean;
  newName?: string;
}

async function handleConfirm(body: {
  text: string;
  summary: string;
  topics: string[];
  assignments: Assignment[];
}) {
  const { text, summary, topics, assignments } = body;
  const embedder = getEmbedder();

  // Generate embedding for the meeting
  let embeddingBuf: Buffer | null = null;
  try {
    const embedding = await embedder.embed(text);
    embeddingBuf = embeddingToBuffer(embedding);
  } catch (e) {
    console.warn("Embedding generation failed:", e);
  }

  // Create the meeting record (personId kept as first person for backwards compat)
  const firstPersonId = assignments.length > 0 && assignments[0].personId
    ? assignments[0].personId
    : null;

  const meeting = db
    .insert(schema.meetings)
    .values({
      personId: firstPersonId,
      rawInput: text,
      summary,
      topics,
      embedding: embeddingBuf,
      date: new Date().toISOString(),
    })
    .returning()
    .get();

  // Process each assignment
  const linkedPeople: { id: number; name: string; isNew: boolean }[] = [];

  for (const assignment of assignments) {
    let personId = assignment.personId;

    // Create new person if requested
    if (assignment.createNew || !personId) {
      const newPerson = db
        .insert(schema.people)
        .values({
          name: assignment.newName || assignment.extractedName,
          context: summary,
          tags: topics.slice(0, 5),
        })
        .returning()
        .get();
      personId = newPerson.id;
      linkedPeople.push({ id: newPerson.id, name: newPerson.name, isNew: true });
    } else {
      const existing = db
        .select()
        .from(schema.people)
        .where(eq(schema.people.id, personId))
        .get();
      if (existing) {
        linkedPeople.push({ id: existing.id, name: existing.name, isNew: false });
      }
    }

    // Create junction record
    if (personId) {
      db.insert(schema.meetingPeople)
        .values({ meetingId: meeting.id, personId })
        .run();

      // Update person context + embedding
      const person = db
        .select()
        .from(schema.people)
        .where(eq(schema.people.id, personId))
        .get();

      if (person) {
        const updatedContext = person.context
          ? `${person.context}\n\n${summary}`
          : summary;

        try {
          const personEmbedding = await embedder.embed(updatedContext);
          db.update(schema.people)
            .set({
              context: updatedContext,
              embedding: embeddingToBuffer(personEmbedding),
              updatedAt: new Date().toISOString(),
            })
            .where(eq(schema.people.id, personId))
            .run();
        } catch {
          db.update(schema.people)
            .set({
              context: updatedContext,
              updatedAt: new Date().toISOString(),
            })
            .where(eq(schema.people.id, personId))
            .run();
        }
      }
    }
  }

  // Auto-create relationships between co-mentioned people
  if (linkedPeople.length > 1) {
    for (let i = 0; i < linkedPeople.length; i++) {
      for (let j = i + 1; j < linkedPeople.length; j++) {
        const a = linkedPeople[i].id;
        const b = linkedPeople[j].id;

        // Check if relationship exists
        const existing = db.select().from(schema.relationships).all()
          .find((r) =>
            (r.personAId === a && r.personBId === b) ||
            (r.personAId === b && r.personBId === a)
          );

        if (existing) {
          db.update(schema.relationships)
            .set({
              strength: (existing.strength || 1) + 1,
              updatedAt: new Date().toISOString(),
            })
            .where(eq(schema.relationships.id, existing.id))
            .run();
        } else {
          db.insert(schema.relationships)
            .values({
              personAId: a,
              personBId: b,
              context: `Co-mentioned in meeting: ${summary?.slice(0, 100)}`,
              strength: 1,
            })
            .run();
        }
      }
    }
  }

  return NextResponse.json({
    meeting,
    linkedPeople,
  });
}
