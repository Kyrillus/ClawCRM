import { NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { sql, gte } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  const totalContacts = db
    .select({ count: sql<number>`count(*)` })
    .from(schema.people)
    .get();

  const totalMeetings = db
    .select({ count: sql<number>`count(*)` })
    .from(schema.meetings)
    .get();

  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const meetingsThisWeek = db
    .select({ count: sql<number>`count(*)` })
    .from(schema.meetings)
    .where(gte(schema.meetings.date, oneWeekAgo.toISOString()))
    .get();

  const totalRelationships = db
    .select({ count: sql<number>`count(*)` })
    .from(schema.relationships)
    .get();

  const allPeople = db.select({ tags: schema.people.tags }).from(schema.people).all();
  const allTags = new Set<string>();
  for (const person of allPeople) {
    const tags = (person.tags as string[]) || [];
    tags.forEach((t) => allTags.add(t));
  }

  return NextResponse.json({
    totalContacts: totalContacts?.count || 0,
    totalMeetings: totalMeetings?.count || 0,
    meetingsThisWeek: meetingsThisWeek?.count || 0,
    totalRelationships: totalRelationships?.count || 0,
    allTags: Array.from(allTags),
  });
}
