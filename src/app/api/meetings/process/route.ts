import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { getLLM, getEmbedder } from "@/lib/llm/provider";
import { embeddingToBuffer } from "@/lib/llm/embeddings";
import { stringSimilarity } from "string-similarity-js";

export const dynamic = "force-dynamic";

interface MeetingExtraction {
  name: string;
  summary: string;
  topics: string[];
}

// POST /api/meetings/process - Process raw meeting text
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text, personId: explicitPersonId } = body;

    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "Text is required" }, { status: 400 });
    }

    const llm = getLLM();
    const embedder = getEmbedder();

    // Step 1: Extract person name, summary, and topics from the text
    let extraction: MeetingExtraction;
    try {
      extraction = await llm.extractJSON<MeetingExtraction>(
        `Analyze this meeting note and extract the following information.

Meeting note:
${text}

Return a JSON object with:
- "name": the name of the person mentioned (the main person this meeting is about, not "I" or "me")
- "summary": a brief 1-2 sentence summary of the meeting
- "topics": an array of 3-8 topic keywords/phrases discussed`,
        "You are a meeting note analyzer. Extract structured data from meeting notes. Return valid JSON only."
      );
    } catch {
      // If JSON extraction fails, try chat and parse
      const raw = await llm.chat(
        `Extract from this meeting note: the person's name, a brief summary, and topic keywords. Meeting note: ${text}`,
        "Extract meeting info. Return JSON: {name, summary, topics[]}"
      );
      try {
        extraction = JSON.parse(raw);
      } catch {
        extraction = {
          name: "Unknown Person",
          summary: text.slice(0, 200),
          topics: [],
        };
      }
    }

    // Step 2: Match person - either explicit ID or fuzzy match by name
    let matchedPerson = null;
    let isNewPerson = false;

    if (explicitPersonId) {
      matchedPerson = db
        .select()
        .from(schema.people)
        .where(eq(schema.people.id, explicitPersonId))
        .get();
    }

    if (!matchedPerson && extraction.name && extraction.name !== "Unknown Person") {
      // Try to fuzzy-match against existing people
      const allPeople = db.select().from(schema.people).all();

      let bestMatch = null;
      let bestScore = 0;

      for (const person of allPeople) {
        const score = stringSimilarity(
          extraction.name.toLowerCase(),
          person.name.toLowerCase()
        );
        if (score > bestScore) {
          bestScore = score;
          bestMatch = person;
        }
      }

      if (bestMatch && bestScore >= 0.4) {
        matchedPerson = bestMatch;
      }
    }

    // Step 3: Create person if not found
    if (!matchedPerson) {
      isNewPerson = true;
      matchedPerson = db
        .insert(schema.people)
        .values({
          name: extraction.name || "Unknown Person",
          context: extraction.summary,
          tags: extraction.topics.slice(0, 5),
        })
        .returning()
        .get();
    }

    // Step 4: Generate embedding for the meeting
    let embeddingBuf: Buffer | null = null;
    try {
      const embedding = await embedder.embed(text);
      embeddingBuf = embeddingToBuffer(embedding);
    } catch (e) {
      console.warn("Embedding generation failed:", e);
    }

    // Step 5: Create the meeting record
    const meeting = db
      .insert(schema.meetings)
      .values({
        personId: matchedPerson.id,
        rawInput: text,
        summary: extraction.summary,
        topics: extraction.topics,
        embedding: embeddingBuf,
        date: new Date().toISOString(),
      })
      .returning()
      .get();

    // Step 6: Update person's context and embedding
    const existingContext = matchedPerson.context || "";
    const updatedContext = existingContext
      ? `${existingContext}\n\n${extraction.summary}`
      : extraction.summary;

    try {
      const personEmbedding = await embedder.embed(updatedContext);
      db.update(schema.people)
        .set({
          context: updatedContext,
          embedding: embeddingToBuffer(personEmbedding),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(schema.people.id, matchedPerson.id))
        .run();
    } catch {
      db.update(schema.people)
        .set({
          context: updatedContext,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(schema.people.id, matchedPerson.id))
        .run();
    }

    return NextResponse.json({
      meeting,
      person: matchedPerson,
      extraction,
      isNewPerson,
    });
  } catch (error) {
    console.error("Error processing meeting:", error);
    return NextResponse.json(
      { error: "Failed to process meeting" },
      { status: 500 }
    );
  }
}
