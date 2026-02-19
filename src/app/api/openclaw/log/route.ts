import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// POST /api/openclaw/log
// Quick meeting logging - auto-confirms by calling the process pipeline twice (preview then confirm)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text, date } = body;

    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "Missing 'text' field" }, { status: 400 });
    }

    const baseUrl = req.nextUrl.origin;

    // Step 1: Preview - extract names, summary, topics
    const previewRes = await fetch(`${baseUrl}/api/meetings/process`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });

    if (!previewRes.ok) {
      const err = await previewRes.text();
      return NextResponse.json({ error: "Processing failed", details: err }, { status: 500 });
    }

    const preview = await previewRes.json();

    // Step 2: Auto-confirm with best matches
    const assignments = (preview.matches || []).map((m: { extractedName: string; bestMatch: { id: number } | null }) => ({
      extractedName: m.extractedName,
      personId: m.bestMatch?.id ?? undefined,
      createNew: !m.bestMatch,
    }));

    const confirmRes = await fetch(`${baseUrl}/api/meetings/process`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        confirm: true,
        summary: preview.extraction.summary,
        topics: preview.extraction.topics,
        assignments,
      }),
    });

    if (!confirmRes.ok) {
      const err = await confirmRes.text();
      return NextResponse.json({ error: "Confirm failed", details: err }, { status: 500 });
    }

    const result = await confirmRes.json();

    // If a custom date was provided, update the meeting date
    if (date && result.meeting?.id) {
      const { db, schema } = await import("@/lib/db");
      const { eq } = await import("drizzle-orm");
      const parsedDate = new Date(date).toISOString();
      db.update(schema.meetings)
        .set({ date: parsedDate })
        .where(eq(schema.meetings.id, result.meeting.id))
        .run();
      result.meeting.date = parsedDate;
    }

    return NextResponse.json({
      success: true,
      meeting: result.meeting ? { ...result.meeting, embedding: undefined } : null,
      people: result.linkedPeople || [],
      extraction: preview.extraction,
    });
  } catch (error) {
    console.error("OpenClaw log error:", error);
    return NextResponse.json({ error: "Failed to log meeting" }, { status: 500 });
  }
}
