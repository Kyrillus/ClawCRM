import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const people = db
      .select()
      .from(schema.people)
      .orderBy(desc(schema.people.updatedAt))
      .all();

    const meetings = db.select().from(schema.meetings).all();
    const meetingCounts: Record<number, number> = {};
    for (const m of meetings) {
      if (m.personId) {
        meetingCounts[m.personId] = (meetingCounts[m.personId] || 0) + 1;
      }
    }

    const result = people.map((p) => ({
      ...p,
      meetingCount: meetingCounts[p.id] || 0,
      tags: p.tags || [],
      socials: p.socials || {},
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching persons:", error);
    return NextResponse.json({ error: "Failed to fetch persons" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, phone, company, role, tags, socials, context } = body;

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const result = db
      .insert(schema.people)
      .values({
        name,
        email: email || null,
        phone: phone || null,
        company: company || null,
        role: role || null,
        tags: tags || [],
        socials: socials || {},
        context: context || null,
      })
      .returning()
      .get();

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("Error creating person:", error);
    return NextResponse.json({ error: "Failed to create person" }, { status: 500 });
  }
}
