import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq, desc, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const search = searchParams.get("search");
  const tag = searchParams.get("tag");

  let allPeople = db.select().from(schema.people).orderBy(desc(schema.people.updatedAt)).all();

  if (search) {
    const searchLower = search.toLowerCase();
    allPeople = allPeople.filter(
      (p) =>
        p.name.toLowerCase().includes(searchLower) ||
        (p.company || "").toLowerCase().includes(searchLower) ||
        (p.role || "").toLowerCase().includes(searchLower) ||
        (p.email || "").toLowerCase().includes(searchLower)
    );
  }

  if (tag) {
    allPeople = allPeople.filter((p) => {
      const tags = (p.tags as string[]) || [];
      return tags.includes(tag);
    });
  }

  const result = allPeople.map((person) => {
    const lastMeeting = db
      .select({ date: schema.meetings.date })
      .from(schema.meetings)
      .where(eq(schema.meetings.personId, person.id))
      .orderBy(desc(schema.meetings.date))
      .limit(1)
      .get();

    const meetingCount = db
      .select({ count: sql<number>`count(*)` })
      .from(schema.meetings)
      .where(eq(schema.meetings.personId, person.id))
      .get();

    return {
      ...person,
      embedding: undefined,
      lastMeetingDate: lastMeeting?.date || null,
      meetingCount: meetingCount?.count || 0,
    };
  });

  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  const body = await request.json();

  const result = db
    .insert(schema.people)
    .values({
      name: body.name,
      email: body.email,
      phone: body.phone,
      company: body.company,
      role: body.role,
      tags: body.tags || [],
      socials: body.socials || {},
      avatarUrl: body.avatarUrl,
    })
    .returning()
    .all();

  return NextResponse.json(result[0], { status: 201 });
}
