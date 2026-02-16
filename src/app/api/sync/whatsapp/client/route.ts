import { NextRequest, NextResponse } from "next/server";
import { waClient } from "@/lib/sync/whatsapp-client";
import { registerAutoSync, syncAllContacts } from "@/lib/sync/whatsapp-auto-sync";

/**
 * GET /api/sync/whatsapp/client — Get client status
 */
export async function GET() {
  const status = waClient.getStatus();
  return NextResponse.json(status);
}

/**
 * POST /api/sync/whatsapp/client — Client actions
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { action } = body;

  switch (action) {
    case "start": {
      try {
        // Register auto-sync before initializing
        registerAutoSync();
        // Don't await — let it run in background, client will update status
        waClient.initialize().catch((err) => {
          console.error("[WA API] Initialize error:", err);
        });
        return NextResponse.json({ ok: true, message: "Initializing..." });
      } catch (err) {
        return NextResponse.json(
          { ok: false, error: String(err) },
          { status: 500 }
        );
      }
    }

    case "stop": {
      await waClient.stop();
      return NextResponse.json({ ok: true, message: "Disconnected" });
    }

    case "logout": {
      await waClient.logout();
      return NextResponse.json({ ok: true, message: "Logged out" });
    }

    case "sync-contacts": {
      try {
        const result = await syncAllContacts();
        return NextResponse.json({ ok: true, ...result });
      } catch (err) {
        return NextResponse.json(
          { ok: false, error: String(err) },
          { status: 500 }
        );
      }
    }

    default:
      return NextResponse.json(
        { error: `Unknown action: ${action}` },
        { status: 400 }
      );
  }
}
