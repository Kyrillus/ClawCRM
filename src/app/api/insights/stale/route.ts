import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

interface StaleContact {
  id: number;
  name: string;
  company: string | null;
  role: string | null;
  tags: string[];
  lastMeetingDate: string;
  daysSinceContact: number;
  meetingCount: number;
  decayLevel: "warning" | "fading" | "lost";
}

// GET /api/insights/stale?days=30&limit=20
export async function GET(req: NextRequest) {
  try {
    const daysParam = req.nextUrl.searchParams.get("days");
    const limitParam = req.nextUrl.searchParams.get("limit");
    const thresholdDays = daysParam ? parseInt(daysParam) : 30;
    const limit = limitParam ? parseInt(limitParam) : 20;

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - thresholdDays);
    const cutoffISO = cutoff.toISOString();

    // Query via both meetings.personId and meetingPeople junction
    const rows = db.all<{
      id: number;
      name: string;
      company: string | null;
      role: string | null;
      tags: string | null;
      lastMeetingDate: string;
      meetingCount: number;
    }>(sql`
      SELECT p.id, p.name, p.company, p.role, p.tags,
             MAX(m.date) as lastMeetingDate,
             COUNT(DISTINCT m.id) as meetingCount
      FROM people p
      INNER JOIN (
        SELECT person_id as pid, meeting_id as mid FROM meeting_people
        UNION
        SELECT person_id as pid, id as mid FROM meetings WHERE person_id IS NOT NULL
      ) pm ON pm.pid = p.id
      INNER JOIN meetings m ON m.id = pm.mid
      GROUP BY p.id
      HAVING lastMeetingDate < ${cutoffISO}
      ORDER BY lastMeetingDate ASC
      LIMIT ${limit}
    `);

    const now = Date.now();
    const stale: StaleContact[] = rows.map((r) => {
      const daysSince = Math.floor((now - new Date(r.lastMeetingDate).getTime()) / (1000 * 60 * 60 * 24));
      let tags: string[] = [];
      try {
        tags = r.tags ? JSON.parse(r.tags) : [];
      } catch { /* ignore */ }

      return {
        id: r.id,
        name: r.name,
        company: r.company,
        role: r.role,
        tags,
        lastMeetingDate: r.lastMeetingDate,
        daysSinceContact: daysSince,
        meetingCount: r.meetingCount,
        decayLevel: daysSince > 90 ? "lost" : daysSince > 60 ? "fading" : "warning",
      };
    });

    // Summary stats
    const summary = {
      total: stale.length,
      warning: stale.filter((s) => s.decayLevel === "warning").length,
      fading: stale.filter((s) => s.decayLevel === "fading").length,
      lost: stale.filter((s) => s.decayLevel === "lost").length,
    };

    return NextResponse.json({ contacts: stale, summary });
  } catch (error) {
    console.error("Stale contacts error:", error);
    return NextResponse.json({ error: "Failed to fetch stale contacts" }, { status: 500 });
  }
}
