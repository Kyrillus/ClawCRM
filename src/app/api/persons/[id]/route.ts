import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const personId = parseInt(id);
    if (isNaN(personId)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const person = db
      .select()
      .from(schema.people)
      .where(eq(schema.people.id, personId))
      .get();

    if (!person) {
      return NextResponse.json({ error: "Person not found" }, { status: 404 });
    }

    const meetings = db
      .select()
      .from(schema.meetings)
      .where(eq(schema.meetings.personId, personId))
      .orderBy(desc(schema.meetings.date))
      .all();

    const relsA = db
      .select()
      .from(schema.relationships)
      .where(eq(schema.relationships.personAId, personId))
      .all();
    const relsB = db
      .select()
      .from(schema.relationships)
      .where(eq(schema.relationships.personBId, personId))
      .all();

    const relatedIds = new Set<number>();
    const relMap: Array<{ personId: number; context: string | null; strength: number | null }> = [];

    for (const r of relsA) {
      relatedIds.add(r.personBId);
      relMap.push({ personId: r.personBId, context: r.context, strength: r.strength });
    }
    for (const r of relsB) {
      relatedIds.add(r.personAId);
      relMap.push({ personId: r.personAId, context: r.context, strength: r.strength });
    }

    const relatedPeople = [];
    for (const rid of relatedIds) {
      const rp = db.select().from(schema.people).where(eq(schema.people.id, rid)).get();
      if (rp) {
        const rel = relMap.find((rm) => rm.personId === rid);
        relatedPeople.push({
          id: rp.id,
          name: rp.name,
          company: rp.company,
          role: rp.role,
          avatarUrl: rp.avatarUrl,
          context: rel?.context,
          strength: rel?.strength,
        });
      }
    }

    return NextResponse.json({
      ...person,
      tags: person.tags || [],
      socials: person.socials || {},
      meetings,
      relatedPeople,
    });
  } catch (error) {
    console.error("Error fetching person:", error);
    return NextResponse.json({ error: "Failed to fetch person" }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const personId = parseInt(id);
    if (isNaN(personId)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const body = await req.json();
    const { name, email, phone, company, role, tags, socials, context, personMd } = body;

    const result = db
      .update(schema.people)
      .set({
        ...(name !== undefined && { name }),
        ...(email !== undefined && { email }),
        ...(phone !== undefined && { phone }),
        ...(company !== undefined && { company }),
        ...(role !== undefined && { role }),
        ...(tags !== undefined && { tags }),
        ...(socials !== undefined && { socials }),
        ...(context !== undefined && { context }),
        ...(personMd !== undefined && { personMd }),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(schema.people.id, personId))
      .returning()
      .get();

    if (!result) {
      return NextResponse.json({ error: "Person not found" }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error updating person:", error);
    return NextResponse.json({ error: "Failed to update person" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const personId = parseInt(id);
    if (isNaN(personId)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const person = db
      .select()
      .from(schema.people)
      .where(eq(schema.people.id, personId))
      .get();

    if (!person) {
      return NextResponse.json({ error: "Person not found" }, { status: 404 });
    }

    db.delete(schema.people).where(eq(schema.people.id, personId)).run();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting person:", error);
    return NextResponse.json({ error: "Failed to delete person" }, { status: 500 });
  }
}
