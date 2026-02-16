import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const personId = searchParams.get("personId");
  const limit = parseInt(searchParams.get("limit") || "20");

  let results;

  if (personId) {
    results = db
      .select({
        meeting: schema.meetings,
        personName: schema.people.name,
        personCompany: schema.people.company,
      })
      .from(schema.meetings)
      .leftJoin(schema.people, eq(schema.meetings.personId, schema.people.id))
      .where(eq(schema.meetings.personId, parseInt(personId)))
      .orderBy(desc(schema.meetings.date))
      .limit(limit)
      .all();
  } else {
    results = db
      .select({
        meeting: schema.meetings,
        personName: schema.people.name,
        personCompany: schema.people.company,
      })
      .from(schema.meetings)
      .leftJoin(schema.people, eq(schema.meetings.personId, schema.people.id))
      .orderBy(desc(schema.meetings.date))
      .limit(limit)
      .all();
  }

  return NextResponse.json(results);
}
