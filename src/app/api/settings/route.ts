import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

// GET /api/settings - Get all settings as key-value object
export async function GET() {
  try {
    const rows = db.select().from(schema.settings).all();
    const result: Record<string, string> = {};
    for (const row of rows) {
      result[row.key] = row.value || "";
    }
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching settings:", error);
    return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 });
  }
}

// PUT /api/settings - Update settings (body: { key: value, ... })
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();

    for (const [key, value] of Object.entries(body)) {
      const existing = db
        .select()
        .from(schema.settings)
        .where(eq(schema.settings.key, key))
        .get();

      if (existing) {
        db.update(schema.settings)
          .set({ value: String(value) })
          .where(eq(schema.settings.key, key))
          .run();
      } else {
        db.insert(schema.settings)
          .values({ key, value: String(value) })
          .run();
      }
    }

    // Return updated settings
    const rows = db.select().from(schema.settings).all();
    const result: Record<string, string> = {};
    for (const row of rows) {
      result[row.key] = row.value || "";
    }
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error updating settings:", error);
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
}
