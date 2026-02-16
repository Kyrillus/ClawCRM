import { sqliteTable, text, integer, real, blob } from "drizzle-orm/sqlite-core";

export const people = sqliteTable("people", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  phone: text("phone"),
  email: text("email"),
  whatsappId: text("whatsapp_id"),
  socials: text("socials", { mode: "json" }).$type<Record<string, string>>(),
  tags: text("tags", { mode: "json" }).$type<string[]>().default([]),
  context: text("context"),
  embedding: blob("embedding", { mode: "buffer" }),
  personMd: text("person_md"),
  avatarUrl: text("avatar_url"),
  company: text("company"),
  role: text("role"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const meetings = sqliteTable("meetings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  personId: integer("person_id").references(() => people.id, { onDelete: "cascade" }),
  date: text("date").notNull().$defaultFn(() => new Date().toISOString()),
  rawInput: text("raw_input").notNull(),
  summary: text("summary"),
  source: text("source").default("manual"),
  topics: text("topics", { mode: "json" }).$type<string[]>().default([]),
  embedding: blob("embedding", { mode: "buffer" }),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const relationships = sqliteTable("relationships", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  personAId: integer("person_a_id").notNull().references(() => people.id, { onDelete: "cascade" }),
  personBId: integer("person_b_id").notNull().references(() => people.id, { onDelete: "cascade" }),
  context: text("context"),
  strength: real("strength").default(1),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const settings = sqliteTable("settings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  key: text("key").notNull().unique(),
  value: text("value"),
});

export type Person = typeof people.$inferSelect;
export type NewPerson = typeof people.$inferInsert;
export type Meeting = typeof meetings.$inferSelect;
export type NewMeeting = typeof meetings.$inferInsert;
export type Relationship = typeof relationships.$inferSelect;
export type NewRelationship = typeof relationships.$inferInsert;
export const meetingPeople = sqliteTable("meeting_people", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  meetingId: integer("meeting_id").notNull().references(() => meetings.id, { onDelete: "cascade" }),
  personId: integer("person_id").notNull().references(() => people.id, { onDelete: "cascade" }),
});

export const syncLog = sqliteTable("sync_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  timestamp: text("timestamp").notNull().$defaultFn(() => new Date().toISOString()),
  type: text("type").notNull(), // "contacts" | "messages" | "import"
  contactsSynced: integer("contacts_synced").default(0),
  messagesSynced: integer("messages_synced").default(0),
  errors: text("errors"),
  status: text("status").notNull().default("running"), // "running" | "completed" | "error"
  details: text("details"),
});

export type SyncLog = typeof syncLog.$inferSelect;
export type NewSyncLog = typeof syncLog.$inferInsert;
export type Setting = typeof settings.$inferSelect;
export type MeetingPerson = typeof meetingPeople.$inferSelect;
export type NewMeetingPerson = typeof meetingPeople.$inferInsert;
