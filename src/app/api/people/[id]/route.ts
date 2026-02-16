import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq, desc, or } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const personId = parseInt(id);

  const person = db.select().from(schema.people).where(eq(schema.people.id, personId)).get();
  if (!person) {
    return NextResponse.json({ error: "Person not found" }, { status: 404 });
  }

  // Get meetings via junction table
  const junctionMeetingIds = db
    .select({ meetingId: schema.meetingPeople.meetingId })
    .from(schema.meetingPeople)
    .where(eq(schema.meetingPeople.personId, personId))
    .all()
    .map((r) => r.meetingId);

  // Also include legacy personId meetings
  const legacyMeetings = db
    .select()
    .from(schema.meetings)
    .where(eq(schema.meetings.personId, personId))
    .all();

  const junctionMeetings = junctionMeetingIds.length > 0
    ? db
        .select()
        .from(schema.meetings)
        .all()
        .filter((m) => junctionMeetingIds.includes(m.id))
    : [];

  // Merge and deduplicate
  const meetingMap = new Map<number, typeof schema.meetings.$inferSelect>();
  for (const m of [...legacyMeetings, ...junctionMeetings]) {
    meetingMap.set(m.id, m);
  }
  const personMeetings = Array.from(meetingMap.values()).sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const personRelationships = db
    .select()
    .from(schema.relationships)
    .where(
      or(
        eq(schema.relationships.personAId, personId),
        eq(schema.relationships.personBId, personId)
      )
    )
    .all();

  const relatedPeople = personRelationships.map((rel) => {
    const relatedId = rel.personAId === personId ? rel.personBId : rel.personAId;
    const relatedPerson = db.select().from(schema.people).where(eq(schema.people.id, relatedId)).get();
    return {
      ...rel,
      relatedPerson: relatedPerson
        ? { id: relatedPerson.id, name: relatedPerson.name, company: relatedPerson.company, role: relatedPerson.role }
        : null,
    };
  });

  return NextResponse.json({
    ...person,
    embedding: undefined,
    meetings: personMeetings.map((m) => ({ ...m, embedding: undefined })),
    relationships: relatedPeople,
  });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const personId = parseInt(id);
  const body = await request.json();

  const existing = db.select().from(schema.people).where(eq(schema.people.id, personId)).get();
  if (!existing) {
    return NextResponse.json({ error: "Person not found" }, { status: 404 });
  }

  db.update(schema.people)
    .set({
      name: body.name ?? existing.name,
      email: body.email ?? existing.email,
      phone: body.phone ?? existing.phone,
      company: body.company ?? existing.company,
      role: body.role ?? existing.role,
      tags: body.tags ?? existing.tags,
      socials: body.socials ?? existing.socials,
      avatarUrl: body.avatarUrl ?? existing.avatarUrl,
      personMd: body.personMd ?? existing.personMd,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(schema.people.id, personId))
    .run();

  const updated = db.select().from(schema.people).where(eq(schema.people.id, personId)).get();
  return NextResponse.json({ ...updated, embedding: undefined });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const personId = parseInt(id);
  db.delete(schema.people).where(eq(schema.people.id, personId)).run();
  return NextResponse.json({ success: true });
}
