import { NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Find people whose most recent meeting is >30 days ago
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const cutoff = thirtyDaysAgo.toISOString();

    // Query via both meetings.personId and meetingPeople junction
    const rows = db.all<{
      id: number;
      name: string;
      company: string | null;
      lastMeetingDate: string;
    }>(sql`
      SELECT p.id, p.name, p.company, MAX(m.date) as lastMeetingDate
      FROM people p
      INNER JOIN (
        SELECT person_id as pid, meeting_id as mid FROM meeting_people
        UNION
        SELECT person_id as pid, id as mid FROM meetings WHERE person_id IS NOT NULL
      ) pm ON pm.pid = p.id
      INNER JOIN meetings m ON m.id = pm.mid
      GROUP BY p.id
      HAVING lastMeetingDate < ${cutoff}
      ORDER BY lastMeetingDate ASC
    `);

    const now = Date.now();
    const stale = rows.map((r) => ({
      id: r.id,
      name: r.name,
      company: r.company,
      lastMeetingDate: r.lastMeetingDate,
      daysSinceContact: Math.floor((now - new Date(r.lastMeetingDate).getTime()) / (1000 * 60 * 60 * 24)),
    }));

    return NextResponse.json(stale);
  } catch (error) {
    console.error("Stale contacts error:", error);
    return NextResponse.json({ error: "Failed to fetch stale contacts" }, { status: 500 });
  }
}
