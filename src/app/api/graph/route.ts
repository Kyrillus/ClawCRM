import { NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

// GET /api/graph - Return nodes + edges for the relationship graph
export async function GET() {
  try {
    const people = db.select().from(schema.people).all();
    const relationships = db.select().from(schema.relationships).all();
    const meetings = db.select().from(schema.meetings).all();
    const meetingPeopleRows = db.select().from(schema.meetingPeople).all();

    // Count meetings per person (junction table + legacy personId)
    const meetingCounts: Record<number, number> = {};
    // From junction table
    for (const mp of meetingPeopleRows) {
      meetingCounts[mp.personId] = (meetingCounts[mp.personId] || 0) + 1;
    }
    // From legacy personId (avoid double-counting)
    for (const m of meetings) {
      if (m.personId) {
        const alreadyCounted = meetingPeopleRows.some(
          (mp) => mp.meetingId === m.id && mp.personId === m.personId
        );
        if (!alreadyCounted) {
          meetingCounts[m.personId] = (meetingCounts[m.personId] || 0) + 1;
        }
      }
    }

    // Build co-meeting links from the junction table
    // Group people by meeting
    const meetingToPeople: Record<number, number[]> = {};
    for (const mp of meetingPeopleRows) {
      if (!meetingToPeople[mp.meetingId]) meetingToPeople[mp.meetingId] = [];
      meetingToPeople[mp.meetingId].push(mp.personId);
    }

    // Build edges: combine explicit relationships + co-meeting implicit links
    const edgeMap = new Map<string, { source: number; target: number; context: string; strength: number }>();

    // Explicit relationships
    for (const r of relationships) {
      const key = `${Math.min(r.personAId, r.personBId)}-${Math.max(r.personAId, r.personBId)}`;
      edgeMap.set(key, {
        source: r.personAId,
        target: r.personBId,
        context: r.context || "",
        strength: r.strength || 1,
      });
    }

    // Co-meeting links (add strength if already exists)
    for (const peopleIds of Object.values(meetingToPeople)) {
      if (peopleIds.length < 2) continue;
      for (let i = 0; i < peopleIds.length; i++) {
        for (let j = i + 1; j < peopleIds.length; j++) {
          const a = Math.min(peopleIds[i], peopleIds[j]);
          const b = Math.max(peopleIds[i], peopleIds[j]);
          const key = `${a}-${b}`;
          const existing = edgeMap.get(key);
          if (existing) {
            existing.strength += 0.5;
          } else {
            edgeMap.set(key, {
              source: a,
              target: b,
              context: "Co-mentioned in meetings",
              strength: 1,
            });
          }
        }
      }
    }

    // Build nodes
    const nodes = people.map((p) => ({
      id: p.id,
      name: p.name,
      company: p.company || "",
      role: p.role || "",
      val: (meetingCounts[p.id] || 0) + 1,
      color: getColorForPerson(p.id),
      meetingCount: meetingCounts[p.id] || 0,
    }));

    const links = Array.from(edgeMap.values());

    return NextResponse.json({ nodes, links });
  } catch (error) {
    console.error("Graph error:", error);
    return NextResponse.json({ error: "Failed to build graph" }, { status: 500 });
  }
}

function getColorForPerson(id: number): string {
  const colors = [
    "#6366f1", "#8b5cf6", "#ec4899", "#f43f5e", "#f97316",
    "#eab308", "#22c55e", "#14b8a6", "#06b6d4", "#3b82f6",
  ];
  return colors[id % colors.length];
}
