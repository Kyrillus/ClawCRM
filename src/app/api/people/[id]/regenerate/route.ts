import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq, desc } from "drizzle-orm";
import { getLLM, getEmbedder } from "@/lib/llm/provider";
import { embeddingToBuffer } from "@/lib/llm/embeddings";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const personId = parseInt(id);

  try {
    const person = db.select().from(schema.people).where(eq(schema.people.id, personId)).get();
    if (!person) {
      return NextResponse.json({ error: "Person not found" }, { status: 404 });
    }

    const meetings = db
      .select()
      .from(schema.meetings)
      .where(eq(schema.meetings.personId, personId))
      .orderBy(desc(schema.meetings.date))
      .all();

    const meetingContext = meetings
      .map((m) => `- ${m.date}: ${m.summary || m.rawInput}`)
      .join("\n");

    const llm = getLLM();

    const prompt = `Generate a markdown profile for this contact:
Name: ${person.name}
Company: ${person.company || "Unknown"}
Role: ${person.role || "Unknown"}
Email: ${person.email || "Unknown"}
Tags: ${(person.tags as string[] || []).join(", ")}

Meeting history:
${meetingContext || "No meetings recorded yet."}

Generate a clean, structured markdown profile with sections for Background, Key Interests, and Notes. Be concise.`;

    const personMd = await llm.chat(prompt, "You are a CRM assistant. Return only markdown, no code blocks.");

    // Generate embedding
    const embedder = getEmbedder();
    const embeddingText = `${person.name} ${person.company || ""} ${person.role || ""} ${(person.tags as string[] || []).join(" ")} ${meetingContext}`;
    
    try {
      const embedding = await embedder.embed(embeddingText);
      db.update(schema.people)
        .set({
          personMd,
          embedding: embeddingToBuffer(embedding),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(schema.people.id, personId))
        .run();
    } catch {
      db.update(schema.people)
        .set({
          personMd,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(schema.people.id, personId))
        .run();
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Regenerate error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to regenerate" },
      { status: 500 }
    );
  }
}
