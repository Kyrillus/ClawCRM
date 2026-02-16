import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import path from "path";
import fs from "fs";

const DB_PATH = path.join(process.cwd(), "data", "clawcrm.db");
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const sqlite = new Database(DB_PATH);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");
const db = drizzle(sqlite, { schema });

const seedPeople = [
  {
    name: "Sarah Chen",
    email: "sarah.chen@techcorp.io",
    phone: "+1-415-555-0101",
    company: "TechCorp",
    role: "VP of Engineering",
    tags: ["engineering", "leadership", "AI"],
    socials: { linkedin: "linkedin.com/in/sarahchen", twitter: "@sarahchen_eng" },
    context: "VP of Engineering at TechCorp, focused on AI infrastructure. Met at AI Summit 2024.",
    personMd: `# Sarah Chen\n\n**VP of Engineering** at TechCorp\n\n## Background\n- Leads a team of 50+ engineers building AI infrastructure\n- Previously at Google Brain for 5 years\n- PhD in Computer Science from Stanford\n\n## Key Interests\n- Large-scale ML systems\n- Team building and engineering culture\n- Open source contributions\n\n## Notes\n- Very interested in collaboration on open-source AI tooling\n- Prefers async communication\n- Coffee enthusiast`,
  },
  {
    name: "Marcus Rivera",
    email: "marcus@designstudio.co",
    phone: "+1-212-555-0202",
    company: "Design Studio Co",
    role: "Creative Director",
    tags: ["design", "creative", "startup"],
    socials: { linkedin: "linkedin.com/in/marcusrivera", dribbble: "dribbble.com/marcus" },
    context: "Creative Director at Design Studio Co, specializes in product design for AI-first products.",
    personMd: `# Marcus Rivera\n\n**Creative Director** at Design Studio Co\n\n## Background\n- 10+ years in product design\n- Founded Design Studio Co in 2020\n- Known for AI-first product design approach\n\n## Key Interests\n- AI/UX intersection\n- Design systems\n- Startup culture\n\n## Notes\n- Looking for technical co-founders for his new project\n- Runs a popular design newsletter`,
  },
  {
    name: "Aisha Patel",
    email: "aisha@quantumvc.com",
    phone: "+1-650-555-0303",
    company: "Quantum Ventures",
    role: "Partner",
    tags: ["investor", "VC", "AI"],
    socials: { linkedin: "linkedin.com/in/aishapatel", twitter: "@aisha_vc" },
    context: "Partner at Quantum Ventures, focuses on AI/ML investments. Previously founded two AI startups.",
    personMd: `# Aisha Patel\n\n**Partner** at Quantum Ventures\n\n## Background\n- Partner at Quantum Ventures ($500M fund)\n- Previously founded two AI startups (one acquired by Meta)\n- Active angel investor\n\n## Investment Focus\n- AI/ML infrastructure\n- Developer tools\n- Enterprise SaaS\n\n## Notes\n- Very well-connected in the AI ecosystem\n- Hosts monthly founder dinners\n- Interested in our project`,
  },
  {
    name: "James O'Brien",
    email: "james@cloudnative.dev",
    phone: "+44-20-7946-0401",
    company: "CloudNative",
    role: "CTO",
    tags: ["engineering", "cloud", "infrastructure"],
    socials: { linkedin: "linkedin.com/in/jamesobrien", github: "github.com/jamesobdev" },
    context: "CTO of CloudNative, building next-gen cloud infrastructure. Based in London.",
    personMd: `# James O'Brien\n\n**CTO** at CloudNative\n\n## Background\n- Based in London\n- Building next-gen cloud infrastructure platform\n- Previously at AWS for 8 years\n\n## Key Interests\n- Kubernetes and container orchestration\n- Edge computing\n- Infrastructure as code\n\n## Notes\n- Speaking at KubeCon next quarter\n- Interested in AI-powered infrastructure management\n- Great pub recommendations in London`,
  },
  {
    name: "Elena Kowalski",
    email: "elena@researchlab.ai",
    phone: "+1-617-555-0505",
    company: "AI Research Lab",
    role: "Lead Researcher",
    tags: ["research", "AI", "ML", "academia"],
    socials: { linkedin: "linkedin.com/in/elenakowalski", scholar: "scholar.google.com/elena" },
    context: "Lead ML researcher at AI Research Lab. Expert in transformer architectures and efficiency.",
    personMd: `# Elena Kowalski\n\n**Lead Researcher** at AI Research Lab\n\n## Background\n- PhD from MIT in Machine Learning\n- Published 30+ papers on transformer efficiency\n- Consulted for several major AI companies\n\n## Research Interests\n- Efficient transformer architectures\n- Model compression and distillation\n- Few-shot learning\n\n## Notes\n- Open to research collaborations\n- Organizing a workshop on efficient AI\n- Connected us with her colleague at DeepMind`,
  },
  {
    name: "David Kim",
    email: "david.kim@startupx.io",
    phone: "+1-310-555-0606",
    company: "StartupX",
    role: "CEO & Founder",
    tags: ["startup", "founder", "AI", "product"],
    socials: { linkedin: "linkedin.com/in/davidkim", twitter: "@davidkim_ceo" },
    context: "CEO and founder of StartupX, building an AI-powered productivity platform.",
    personMd: `# David Kim\n\n**CEO & Founder** at StartupX\n\n## Background\n- Serial entrepreneur (3rd startup)\n- YC W23 batch\n- Previously PM at Notion\n\n## What They're Building\n- AI-powered productivity platform\n- Raised $5M seed round\n- 10-person team in LA\n\n## Notes\n- Looking for AI infrastructure advice\n- Connected through Aisha Patel\n- Monthly coffee catch-ups`,
  },
];

async function seed() {
  console.log("🌱 Seeding database...");

  // Clean existing data using raw SQL to avoid Drizzle's delete-without-where restriction
  // Disable foreign keys temporarily to allow clean deletion
  sqlite.exec("PRAGMA foreign_keys = OFF");
  sqlite.exec("DELETE FROM settings");
  sqlite.exec("DELETE FROM meeting_people");
  sqlite.exec("DELETE FROM relationships");
  sqlite.exec("DELETE FROM meetings");
  sqlite.exec("DELETE FROM people");
  // Reset autoincrement counters
  sqlite.exec("DELETE FROM sqlite_sequence WHERE name IN ('people','meetings','relationships','settings','meeting_people')");
  sqlite.exec("PRAGMA foreign_keys = ON");
  console.log("🧹 Cleaned existing data");

  // Insert people and collect their IDs
  const personIds: number[] = [];
  for (const person of seedPeople) {
    const result = db.insert(schema.people).values({
      name: person.name,
      email: person.email,
      phone: person.phone,
      company: person.company,
      role: person.role,
      tags: person.tags,
      socials: person.socials as unknown as Record<string, string>,
      context: person.context,
      personMd: person.personMd,
    }).returning().get();
    personIds.push(result.id);
  }

  console.log(`✅ Inserted ${seedPeople.length} people (IDs: ${personIds.join(", ")})`);

  // Map: 0=Sarah, 1=Marcus, 2=Aisha, 3=James, 4=Elena, 5=David
  const [sarah, marcus, aisha, _james, elena, david] = personIds;

  // Insert meetings using actual IDs
  const seedMeetings = [
    {
      personId: sarah,
      date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      rawInput: "Had a great coffee chat with Sarah Chen. She told me about TechCorp's new AI infrastructure project. They're building custom ML pipelines and she's looking for open-source tools to integrate. She mentioned they might want to collaborate on our project.",
      summary: "Coffee chat about TechCorp's AI infrastructure plans and potential collaboration on open-source tooling.",
      topics: ["AI infrastructure", "open-source", "collaboration", "ML pipelines"],
    },
    {
      personId: aisha,
      date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      rawInput: "Zoom call with Aisha Patel from Quantum Ventures. She's interested in our project and wants to learn more. Discussed our technical approach to AI embeddings and how we handle semantic search. She introduced me to David Kim who might be a good design partner.",
      summary: "Investment discussion with Aisha from Quantum Ventures. She showed interest and connected us with David Kim at StartupX.",
      topics: ["investment", "semantic search", "AI embeddings", "introductions"],
    },
    {
      personId: david,
      date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      rawInput: "Met David Kim at a startup meetup. He's building an AI productivity tool and is looking for infrastructure advice. Aisha Patel introduced us. We talked about the challenges of building AI-native products and the importance of good embeddings for search.",
      summary: "Startup meetup intro with David Kim. Discussed AI product challenges and embedding strategies.",
      topics: ["AI products", "embeddings", "startup", "productivity"],
    },
    {
      personId: elena,
      date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      rawInput: "Research discussion with Elena Kowalski about efficient transformer architectures. She shared some pre-prints on model compression that could be useful for our embedding pipeline. She offered to connect us with her colleague at DeepMind.",
      summary: "Technical discussion about transformer efficiency and model compression for embeddings.",
      topics: ["transformers", "model compression", "embeddings", "research"],
    },
    {
      personId: marcus,
      date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      rawInput: "Design review with Marcus Rivera. He showed me mockups for an AI-first CRM interface. Really innovative approach to showing relationship graphs. He suggested using force-directed layouts for the network visualization.",
      summary: "Design review session focused on AI-first CRM UI and relationship graph visualization approaches.",
      topics: ["design", "UI/UX", "relationship graphs", "visualization"],
    },
  ];

  const meetingIds: number[] = [];
  for (const meeting of seedMeetings) {
    const result = db.insert(schema.meetings).values(meeting).returning().get();
    meetingIds.push(result.id);
  }

  console.log(`✅ Inserted ${seedMeetings.length} meetings`);

  // Insert meeting_people junction records
  // meeting 0 (Sarah) -> Sarah
  // meeting 1 (Aisha) -> Aisha, David (she introduced David)
  // meeting 2 (David) -> David, Aisha (Aisha introduced them)
  // meeting 3 (Elena) -> Elena
  // meeting 4 (Marcus) -> Marcus
  const meetingPeopleData = [
    { meetingId: meetingIds[0], personId: sarah },
    { meetingId: meetingIds[1], personId: aisha },
    { meetingId: meetingIds[1], personId: david },
    { meetingId: meetingIds[2], personId: david },
    { meetingId: meetingIds[2], personId: aisha },
    { meetingId: meetingIds[3], personId: elena },
    { meetingId: meetingIds[4], personId: marcus },
  ];
  for (const mp of meetingPeopleData) {
    db.insert(schema.meetingPeople).values(mp).run();
  }

  console.log(`✅ Inserted ${meetingPeopleData.length} meeting-people links`);

  // Insert relationships using actual IDs
  const seedRelationships = [
    { personAId: aisha, personBId: david, context: "Aisha introduced David Kim. Both in the AI startup ecosystem.", strength: 3 },
    { personAId: sarah, personBId: elena, context: "Both work on AI/ML infrastructure. Sarah referenced Elena's research.", strength: 2 },
    { personAId: sarah, personBId: _james, context: "Both in engineering leadership. Met at the same conference.", strength: 1 },
    { personAId: marcus, personBId: david, context: "Marcus is helping David with StartupX's product design.", strength: 2 },
  ];

  for (const rel of seedRelationships) {
    db.insert(schema.relationships).values(rel).run();
  }

  console.log(`✅ Inserted ${seedRelationships.length} relationships`);

  // Insert default settings
  const defaultSettings = [
    { key: "llm_provider", value: "fallback" },
    { key: "llm_model", value: "" },
    { key: "llm_api_key", value: "" },
    { key: "embedding_provider", value: "fallback" },
    { key: "theme", value: "dark" },
  ];

  for (const setting of defaultSettings) {
    db.insert(schema.settings).values(setting).run();
  }

  console.log(`✅ Inserted default settings`);
  console.log("🎉 Seeding complete!");
}

seed().catch(console.error).finally(() => sqlite.close());
