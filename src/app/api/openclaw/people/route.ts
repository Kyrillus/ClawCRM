import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { sql, eq, desc } from "drizzle-orm";
import { stringSimilarity } from "string-similarity-js";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const q = req.nextUrl.searchParams.get("q") || "";
    const limit = Math.min(parseInt(req.nextUrl.searchParams.get("limit") || "10"), 50);

    const allPeople = db.select({
      id: schema.people.id,
      name: schema.people.name,
      email: schema.people.email,
      phone: schema.people.phone,
      company: schema.people.company,
      role: schema.people.role,
      tags: schema.people.tags,
      context: schema.people.context,
      avatarUrl: schema.people.avatarUrl,
      createdAt: schema.people.createdAt,
      updatedAt: schema.people.updatedAt,
    }).from(schema.people).all();

    // Filter by query if provided
    let filtered = allPeople;
    if (q) {
      filtered = allPeople
        .map((p) => {
          const nameScore = stringSimilarity(q.toLowerCase(), p.name.toLowerCase());
          const companyScore = p.company ? stringSimilarity(q.toLowerCase(), p.company.toLowerCase()) * 0.8 : 0;
          const tagScore = (p.tags as string[] || []).some((t) => t.toLowerCase().includes(q.toLowerCase())) ? 0.6 : 0;
          return { ...p, score: Math.max(nameScore, companyScore, tagScore) };
        })
        .filter((p) => p.score > 0.2)
        .sort((a, b) => b.score - a.score);
    }

    // Enrich with meeting stats
    const results = filtered.slice(0, limit).map((person) => {
      // Count meetings (both junction and legacy)
      const junctionCount = db.select({ count: sql<number>`count(*)` })
        .from(schema.meetingPeople)
        .where(eq(schema.meetingPeople.personId, person.id))
        .get()!.count;

      const legacyCount = db.select({ count: sql<number>`count(*)` })
        .from(schema.meetings)
        .where(eq(schema.meetings.personId, person.id))
        .get()!.count;

      const meetingCount = Math.max(junctionCount, legacyCount);

      // Last meeting date
      const lastJunction = db.select({ date: schema.meetings.date })
        .from(schema.meetings)
        .innerJoin(schema.meetingPeople, eq(schema.meetings.id, schema.meetingPeople.meetingId))
        .where(eq(schema.meetingPeople.personId, person.id))
        .orderBy(desc(schema.meetings.date))
        .limit(1).get();

      const lastLegacy = db.select({ date: schema.meetings.date })
        .from(schema.meetings)
        .where(eq(schema.meetings.personId, person.id))
        .orderBy(desc(schema.meetings.date))
        .limit(1).get();

      const lastMeetingDate = [lastJunction?.date, lastLegacy?.date]
        .filter(Boolean)
        .sort()
        .reverse()[0] || null;

      // Relationship strength (sum of all relationship strengths)
      const relStrength = db.select({ total: sql<number>`coalesce(sum(strength), 0)` })
        .from(schema.relationships)
        .where(sql`person_a_id = ${person.id} OR person_b_id = ${person.id}`)
        .get()!.total;

      return {
        ...person,
        meetingCount,
        lastMeetingDate,
        relationshipStrength: relStrength,
      };
    });

    return NextResponse.json({ results, total: filtered.length });
  } catch (error) {
    console.error("OpenClaw people error:", error);
    return NextResponse.json({ error: "People search failed" }, { status: 500 });
  }
}
