import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { desc, sql } from "drizzle-orm";

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
    // Query via both legacy personId and junction table
    const lastMeeting = db.get<{ date: string }>(sql`
      SELECT MAX(m.date) as date FROM meetings m
      WHERE m.id IN (
        SELECT mid FROM (
          SELECT meeting_id as mid FROM meeting_people WHERE person_id = ${person.id}
          UNION
          SELECT id as mid FROM meetings WHERE person_id = ${person.id}
        )
      )
    `);

    const meetingCount = db.get<{ count: number }>(sql`
      SELECT COUNT(DISTINCT m.id) as count FROM meetings m
      WHERE m.id IN (
        SELECT mid FROM (
          SELECT meeting_id as mid FROM meeting_people WHERE person_id = ${person.id}
          UNION
          SELECT id as mid FROM meetings WHERE person_id = ${person.id}
        )
      )
    `);

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
