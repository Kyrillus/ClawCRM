import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { sql } from "drizzle-orm";
import { getEmbedder } from "@/lib/llm/provider";
import { bufferToEmbedding, cosineSimilarity } from "@/lib/llm/embeddings";
import { stringSimilarity } from "string-similarity-js";

export const dynamic = "force-dynamic";

interface SearchResult {
  type: "person" | "meeting";
  id: number;
  title: string;
  subtitle: string;
  score: number;
  personId?: number;
  tags?: string[];
  date?: string;
}

// GET /api/search?q=query&type=person|meeting&tag=tagname
export async function GET(req: NextRequest) {
  try {
    const q = req.nextUrl.searchParams.get("q");
    const typeFilter = req.nextUrl.searchParams.get("type"); // "person" | "meeting"
    const tagFilter = req.nextUrl.searchParams.get("tag");

    if (!q || q.trim().length === 0) {
      return NextResponse.json({ results: [], people: [], meetings: [] });
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

    const people = db.select().from(schema.people).all();

    // Search persons
    if (typeFilter !== "meeting") {
      for (const person of people) {
        let score = 0;
        const tags = (person.tags as string[]) || [];

        // Tag filter
        if (tagFilter && !tags.some((t) => t.toLowerCase() === tagFilter.toLowerCase())) {
          continue;
        }

        // Text-based matching
        const searchText = [
          person.name,
          person.company,
          person.role,
          person.email,
          person.context,
          ...tags,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        // Keyword matching
        const queryWords = query.split(/\s+/).filter((w) => w.length > 1);
        const matchedWords = queryWords.filter((w) => searchText.includes(w));
        score = queryWords.length > 0 ? matchedWords.length / queryWords.length : 0;

        // Exact name match boost
        const nameLower = person.name.toLowerCase();
        if (nameLower === query) {
          score += 1.0;
        } else if (nameLower.includes(query)) {
          score += 0.5;
        }

        // First name / last name matching
        const queryParts = query.split(/\s+/);
        const nameParts = nameLower.split(/\s+/);
        for (const qp of queryParts) {
          for (const np of nameParts) {
            const sim = stringSimilarity(qp, np);
            if (sim > 0.7) {
              score = Math.max(score, sim * 0.8);
            }
          }
        }

        // Fuzzy full name matching
        const nameSimilarity = stringSimilarity(query, nameLower);
        if (nameSimilarity > 0.3) {
          score = Math.max(score, nameSimilarity);
        }

        // Tag exact match boost
        if (tags.some((t) => t.toLowerCase() === query)) {
          score += 0.4;
        }

        // Company/role exact match boost
        if (person.company?.toLowerCase().includes(query)) {
          score += 0.3;
        }
        if (person.role?.toLowerCase().includes(query)) {
          score += 0.3;
        }

        // Semantic similarity
        if (queryEmbedding && person.embedding) {
          try {
            const personEmb = bufferToEmbedding(person.embedding as Buffer);
            const similarity = cosineSimilarity(queryEmbedding, personEmb);
            if (similarity > 0.3) {
              score = Math.max(score, similarity);
            }
          } catch {
            // ignore
          }
        }

        if (score > 0.1) {
          results.push({
            type: "person",
            id: person.id,
            title: person.name,
            subtitle: [person.role, person.company].filter(Boolean).join(" at ") || "Contact",
            score,
            tags,
          });
        }
      }
    }

    // Search meetings
    if (typeFilter !== "person") {
      const meetings = db.select().from(schema.meetings).all();

      // Build meeting-people lookup via junction table
      const meetingPeopleRows = db.all<{ meeting_id: number; person_id: number }>(
        sql`SELECT meeting_id, person_id FROM meeting_people`
      );
      const meetingPeopleMap = new Map<number, number[]>();
      for (const row of meetingPeopleRows) {
        const arr = meetingPeopleMap.get(row.meeting_id) || [];
        arr.push(row.person_id);
        meetingPeopleMap.set(row.meeting_id, arr);
      }

      for (const meeting of meetings) {
        let score = 0;
        const topics = (meeting.topics as string[]) || [];

        const searchText = [
          meeting.rawInput,
          meeting.summary,
          ...topics,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        const queryWords = query.split(/\s+/).filter((w) => w.length > 1);
        const matchedWords = queryWords.filter((w) => searchText.includes(w));
        score = queryWords.length > 0 ? matchedWords.length / queryWords.length : 0;

        // Topic exact match boost
        if (topics.some((t) => t.toLowerCase().includes(query))) {
          score += 0.3;
        }

        // Semantic similarity
        if (queryEmbedding && meeting.embedding) {
          try {
            const meetingEmb = bufferToEmbedding(meeting.embedding as Buffer);
            const similarity = cosineSimilarity(queryEmbedding, meetingEmb);
            if (similarity > 0.3) {
              score = Math.max(score, similarity);
            }
          } catch {
            // ignore
          }
        }

        if (score > 0.1) {
          // Get people names for this meeting (via junction table + legacy)
          const personIds = new Set<number>();
          if (meeting.personId) personIds.add(meeting.personId);
          for (const pid of meetingPeopleMap.get(meeting.id) || []) {
            personIds.add(pid);
          }

          const personNames = [...personIds]
            .map((pid) => people.find((p) => p.id === pid)?.name)
            .filter(Boolean);

          const subtitle = personNames.length > 0
            ? `Meeting with ${personNames.join(", ")}`
            : `Meeting on ${meeting.date?.split("T")[0] || "unknown date"}`;

          results.push({
            type: "meeting",
            id: meeting.id,
            title: meeting.summary || meeting.rawInput.slice(0, 100),
            subtitle,
            score,
            personId: meeting.personId || undefined,
            date: meeting.date,
          });
        }
      }
    }

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);

    const peopleResults = results
      .filter((r) => r.type === "person")
      .map((r) => {
        const person = people.find((p) => p.id === r.id);
        return {
          id: r.id,
          name: r.title,
          company: person?.company || "",
          role: person?.role || "",
          tags: r.tags || [],
          score: r.score,
          snippet: r.subtitle,
        };
      });

    const meetingResults = results.filter((r) => r.type === "meeting");

    return NextResponse.json({
      results: results.slice(0, 20),
      people: peopleResults.slice(0, 10),
      meetings: meetingResults.slice(0, 10),
    });
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
