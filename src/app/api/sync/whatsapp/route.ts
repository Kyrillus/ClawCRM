import { NextRequest, NextResponse } from "next/server";
import { parseWhatsAppExport, groupByDay } from "@/lib/sync/whatsapp-parser";
import { syncWhatsAppChat, logSync, getSyncHistory } from "@/lib/sync/whatsapp-sync";

/**
 * GET /api/sync/whatsapp — Get sync history
 */
export async function GET() {
  try {
    const history = await getSyncHistory();
    return NextResponse.json({ history });
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to get sync history: ${err}` },
      { status: 500 }
    );
  }
}

/**
 * POST /api/sync/whatsapp — Import WhatsApp chat export or trigger browser scrape
 *
 * Body options:
 * 1. { mode: "import", content: string, filename?: string } — Parse & import a .txt export
 * 2. { mode: "preview", content: string, filename?: string } — Preview without saving
 * 3. { mode: "scrape", action: "contacts" | "chat", chatName?: string } — Browser scrape (CDP)
 */
export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "";

    // Handle multipart file upload
    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      const mode = (formData.get("mode") as string) || "preview";

      if (!file) {
        return NextResponse.json({ error: "No file provided" }, { status: 400 });
      }

      const content = await file.text();
      const filename = file.name;
      const parsed = parseWhatsAppExport(content, filename);
      const segments = groupByDay(parsed);

      if (mode === "preview") {
        return NextResponse.json({
          chatName: parsed.chatName,
          participants: parsed.participants,
          totalMessages: parsed.messages.length,
          days: segments.length,
          dateRange: segments.length > 0
            ? { from: segments[0].date, to: segments[segments.length - 1].date }
            : null,
          segments: segments.map((s) => ({
            date: s.date,
            messageCount: s.messages.length,
            participants: s.participants,
            preview: s.rawText.slice(0, 200),
          })),
        });
      }

      // Import mode
      await logSync("import", "running");
      const result = await syncWhatsAppChat(parsed, {
        syncContacts: true,
        syncMessages: true,
      });
      await logSync("import", "completed", result, `Imported ${filename}`);

      return NextResponse.json({
        success: true,
        ...result,
      });
    }

    // Handle JSON body
    const body = await req.json();
    const { mode, content, filename } = body;

    if (mode === "scrape") {
      // Dynamic import to avoid loading playwright on non-scrape requests
      try {
        const { scrapeContacts, scrapeChat } = await import(
          "@/lib/sync/whatsapp-scraper"
        );

        if (body.action === "contacts") {
          const contacts = await scrapeContacts(body.maxContacts || 100);
          return NextResponse.json({ contacts });
        }

        if (body.action === "chat" && body.chatName) {
          const conversation = await scrapeChat(
            body.chatName,
            body.maxMessages || 50
          );
          return NextResponse.json({ conversation });
        }

        return NextResponse.json(
          { error: "Invalid scrape action" },
          { status: 400 }
        );
      } catch (err) {
        return NextResponse.json(
          {
            error: `Browser scraping failed: ${err instanceof Error ? err.message : err}. Try using file import instead.`,
          },
          { status: 500 }
        );
      }
    }

    if (!content) {
      return NextResponse.json(
        { error: "No content provided" },
        { status: 400 }
      );
    }

    const parsed = parseWhatsAppExport(content, filename);
    const segments = groupByDay(parsed);

    if (mode === "preview") {
      return NextResponse.json({
        chatName: parsed.chatName,
        participants: parsed.participants,
        totalMessages: parsed.messages.length,
        days: segments.length,
        dateRange: segments.length > 0
          ? { from: segments[0].date, to: segments[segments.length - 1].date }
          : null,
        segments: segments.map((s) => ({
          date: s.date,
          messageCount: s.messages.length,
          participants: s.participants,
          preview: s.rawText.slice(0, 200),
        })),
      });
    }

    // Import
    await logSync("import", "running");
    const result = await syncWhatsAppChat(parsed, {
      syncContacts: true,
      syncMessages: true,
    });
    await logSync("import", "completed", result, `Imported ${filename || "paste"}`);

    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    await logSync("import", "error", { errors: [String(err)] });
    return NextResponse.json(
      { error: `Sync failed: ${err}` },
      { status: 500 }
    );
  }
}
