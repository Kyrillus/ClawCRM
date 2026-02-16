import { NextResponse } from "next/server";
import { db, schema } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/graph - Return nodes + edges for the relationship graph
export async function GET() {
  try {
    const people = db.select().from(schema.people).all();
    const relationships = db.select().from(schema.relationships).all();
    const meetings = db.select().from(schema.meetings).all();

    // Count meetings per person
    const meetingCounts: Record<number, number> = {};
    for (const m of meetings) {
      if (m.personId) {
        meetingCounts[m.personId] = (meetingCounts[m.personId] || 0) + 1;
      }
    }

    // Build nodes - size based on meeting count
    const nodes = people.map((p) => ({
      id: p.id,
      name: p.name,
      company: p.company || "",
      role: p.role || "",
      val: (meetingCounts[p.id] || 0) + 1, // min val of 1
      color: getColorForPerson(p.id),
      meetingCount: meetingCounts[p.id] || 0,
    }));

    // Build edges from relationships
    const links = relationships.map((r) => ({
      source: r.personAId,
      target: r.personBId,
      context: r.context || "",
      strength: r.strength || 1,
    }));

    return NextResponse.json({ nodes, links });
  } catch (error) {
    console.error("Graph error:", error);
    return NextResponse.json({ error: "Failed to build graph" }, { status: 500 });
  }
}

function getColorForPerson(id: number): string {
  const colors = [
    "#6366f1", // indigo
    "#8b5cf6", // violet
    "#ec4899", // pink
    "#f43f5e", // rose
    "#f97316", // orange
    "#eab308", // yellow
    "#22c55e", // green
    "#14b8a6", // teal
    "#06b6d4", // cyan
    "#3b82f6", // blue
  ];
  return colors[id % colors.length];
}
