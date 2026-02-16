import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq, desc } from "drizzle-orm";
import { getLLM } from "@/lib/llm/provider";

export const dynamic = "force-dynamic";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const personId = parseInt(id);
    if (isNaN(personId)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const person = db
      .select()
      .from(schema.people)
      .where(eq(schema.people.id, personId))
      .get();

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
      .map((m) => `- [${m.date}] ${m.summary || m.rawInput}`)
      .join("\n");

    const llm = getLLM();

    const prompt = `Generate a comprehensive markdown profile for this person based on the following information:

Name: ${person.name}
Company: ${person.company || "Unknown"}
Role: ${person.role || "Unknown"}
Email: ${person.email || "N/A"}
Phone: ${person.phone || "N/A"}
Tags: ${(person.tags as string[] || []).join(", ")}
Context: ${person.context || "None"}

Meeting History:
${meetingContext || "No meetings recorded yet."}

Generate a markdown document with:
1. A header with their name
2. Their role and company
3. Background section
4. Key interests/topics section based on meeting notes
5. Notes section with important things to remember

Keep it concise but informative. Use markdown formatting.`;

    const personMd = await llm.chat(prompt, "You are a helpful assistant that generates clean, well-structured markdown profiles for contacts in a personal CRM.");

    db.update(schema.people)
      .set({ personMd, updatedAt: new Date().toISOString() })
      .where(eq(schema.people.id, personId))
      .run();

    return NextResponse.json({ personMd });
  } catch (error) {
    console.error("Error regenerating markdown:", error);
    return NextResponse.json({ error: "Failed to regenerate profile" }, { status: 500 });
  }
}
