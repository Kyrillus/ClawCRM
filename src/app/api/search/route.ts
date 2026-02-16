import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { getEmbedder } from "@/lib/llm/provider";
import { bufferToEmbedding, cosineSimilarity } from "@/lib/llm/embeddings";

export const dynamic = "force-dynamic";

interface SearchResult {
  type: "person" | "meeting";
  id: number;
  title: string;
  subtitle: string;
  score: number;
  personId?: number;
}

// GET /api/search?q=query
export async function GET(req: NextRequest) {
  try {
    const q = req.nextUrl.searchParams.get("q");
    if (!q || q.trim().length === 0) {
      return NextResponse.json([]);
    }

    const query = q.trim().toLowerCase();
    const embedder = getEmbedder();
    const results: SearchResult[] = [];

    // Generate query embedding
    let queryEmbedding: number[] | null = null;
    try {
      queryEmbedding = await embedder.embed(query);
    } catch (e) {
      console.warn("Query embedding failed:", e);
    }

    // Search persons
    const people = db.select().from(schema.people).all();
    for (const person of people) {
      let score = 0;

      // Text-based matching
      const searchText = [
        person.name,
        person.company,
        person.role,
        person.email,
        person.context,
        ...(person.tags as string[] || []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      // Simple keyword matching
      const queryWords = query.split(/\s+/);
      const matchedWords = queryWords.filter((w) => searchText.includes(w));
      score = matchedWords.length / queryWords.length;

      // Boost exact name matches
      if (person.name.toLowerCase().includes(query)) {
        score += 0.5;
      }

      // Semantic similarity if embeddings available
      if (queryEmbedding && person.embedding) {
        try {
          const personEmb = bufferToEmbedding(person.embedding as Buffer);
          const similarity = cosineSimilarity(queryEmbedding, personEmb);
          score = Math.max(score, similarity);
        } catch {
          // ignore embedding errors
        }
      }

      if (score > 0.1) {
        results.push({
          type: "person",
          id: person.id,
          title: person.name,
          subtitle: [person.role, person.company].filter(Boolean).join(" at ") || "Contact",
          score,
        });
      }
    }

    // Search meetings
    const meetings = db.select().from(schema.meetings).all();
    for (const meeting of meetings) {
      let score = 0;

      const searchText = [
        meeting.rawInput,
        meeting.summary,
        ...(meeting.topics as string[] || []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const queryWords = query.split(/\s+/);
      const matchedWords = queryWords.filter((w) => searchText.includes(w));
      score = matchedWords.length / queryWords.length;

      // Semantic similarity
      if (queryEmbedding && meeting.embedding) {
        try {
          const meetingEmb = bufferToEmbedding(meeting.embedding as Buffer);
          const similarity = cosineSimilarity(queryEmbedding, meetingEmb);
          score = Math.max(score, similarity);
        } catch {
          // ignore embedding errors
        }
      }

      if (score > 0.1) {
        // Get person name for subtitle
        const person = meeting.personId
          ? people.find((p) => p.id === meeting.personId)
          : null;

        results.push({
          type: "meeting",
          id: meeting.id,
          title: meeting.summary || meeting.rawInput.slice(0, 100),
          subtitle: person ? `Meeting with ${person.name}` : `Meeting on ${meeting.date}`,
          score,
          personId: meeting.personId || undefined,
        });
      }
    }

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);

    return NextResponse.json(results.slice(0, 20));
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
