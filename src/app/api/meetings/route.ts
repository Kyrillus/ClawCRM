import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const personId = searchParams.get("personId");
  const limit = parseInt(searchParams.get("limit") || "20");

  let meetingRows;

  if (personId) {
    // Get meetings for a specific person via junction table OR legacy personId
    const pid = parseInt(personId);
    const junctionMeetingIds = db
      .select({ meetingId: schema.meetingPeople.meetingId })
      .from(schema.meetingPeople)
      .where(eq(schema.meetingPeople.personId, pid))
      .all()
      .map((r) => r.meetingId);

    meetingRows = db
      .select()
      .from(schema.meetings)
      .orderBy(desc(schema.meetings.date))
      .all()
      .filter((m) => m.personId === pid || junctionMeetingIds.includes(m.id))
      .slice(0, limit);
  } else {
    meetingRows = db
      .select()
      .from(schema.meetings)
      .orderBy(desc(schema.meetings.date))
      .limit(limit)
      .all();
  }

  // For each meeting, get all linked people
  const results = meetingRows.map((meeting) => {
    // Get people from junction table
    const linkedPeople = db
      .select({
        personId: schema.meetingPeople.personId,
        personName: schema.people.name,
        personCompany: schema.people.company,
      })
      .from(schema.meetingPeople)
      .leftJoin(schema.people, eq(schema.meetingPeople.personId, schema.people.id))
      .where(eq(schema.meetingPeople.meetingId, meeting.id))
      .all();

    // Fallback to legacy personId if no junction records
    if (linkedPeople.length === 0 && meeting.personId) {
      const person = db
        .select()
        .from(schema.people)
        .where(eq(schema.people.id, meeting.personId))
        .get();
      if (person) {
        linkedPeople.push({
          personId: person.id,
          personName: person.name,
          personCompany: person.company,
        });
      }
    }

    return {
      meeting: { ...meeting, embedding: undefined },
      people: linkedPeople,
      // Legacy compat
      personName: linkedPeople[0]?.personName || null,
      personCompany: linkedPeople[0]?.personCompany || null,
    };
  });

  return NextResponse.json(results);
}
