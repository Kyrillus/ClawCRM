# 🐾 ClawCRM

**AI-Powered Personal People CRM**

ClawCRM is a self-hosted, AI-powered CRM for managing your personal and professional relationships. Log meetings with voice or text, and let AI extract contacts, generate profiles, build relationship graphs, and enable semantic search across your entire network.

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![SQLite](https://img.shields.io/badge/SQLite-Local-003B57?logo=sqlite)
![License](https://img.shields.io/badge/License-MIT-green)

## ✨ Features

### 📊 Dashboard
- Semantic search bar — find people by what you talked about
- Recent meetings feed with AI-generated summaries
- Quick stats: contacts, meetings, connections
- Quick-action buttons for logging meetings

### 👥 People Management
- Grid/list view with search and tag filters
- Contact cards with meeting count, last interaction
- Full CRUD: add, edit, delete contacts

### 📝 Person Profiles
- **Auto-generated markdown profiles** from meeting notes
- Editable fields: name, phone, email, company, role, tags, socials
- Meeting timeline per person
- Related people (from relationship graph)
- One-click profile regeneration with AI

### 🎤 Meeting Logger
- Free-form text input describing your meeting
- **Browser-native voice input** (Web Speech API)
- AI extracts: person names, topics, key facts, sentiment
- Fuzzy-matches people against existing contacts
- Auto-creates new contacts if not found
- Generates embeddings for semantic search

### 🔍 Semantic Search
- Natural language queries: "ML engineers", "people I discussed AI with"
- Cosine similarity against person & meeting embeddings
- Falls back to keyword matching when no API key is configured
- Results ranked by relevance with match scores

### 🕸️ Relationship Graph
- Interactive force-directed network visualization
- Nodes = people, edges = relationships from co-mentions
- Node size based on meeting count
- Color-coded by tags (engineering, AI, design, etc.)
- Click to navigate to person profile
- Fullscreen mode, zoom, pan, drag

### ⚙️ LLM Provider System
- **Pluggable AI providers**: Google Gemini, OpenAI, Anthropic, Ollama
- Default: Google Gemini (free tier available)
- API key management in settings UI
- Connection testing
- Fallback to local bag-of-words embeddings when no API key

### 🎨 UI/UX
- Modern, clean design with shadcn/ui components
- **Dark mode by default** with light mode toggle
- Responsive design (mobile + desktop)
- Command palette (**⌘K**) for quick navigation/search
- Mobile bottom navigation bar

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| UI | shadcn/ui + Tailwind CSS v4 |
| Database | SQLite via Drizzle ORM |
| AI | Google Gemini / OpenAI / Anthropic / Ollama |
| Embeddings | Provider API or local bag-of-words |
| Voice | Web Speech API (browser-native) |
| Graph | react-force-graph-2d |

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ (recommended: 20+)
- npm

### Installation

```bash
# Clone the repo
git clone https://github.com/Kyrillus/ClawCRM.git
cd ClawCRM

# Install dependencies
npm install

# Set up the database
npm run db:migrate
npm run db:seed  # Optional: adds demo data

# Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Environment Variables

Copy `.env.local.example` to `.env.local` and add your API key:

```bash
cp .env.local.example .env.local
```

```env
# Google Gemini (recommended - free tier available)
GOOGLE_API_KEY=your-key-here

# Or use OpenAI
OPENAI_API_KEY=sk-...

# Or Anthropic
ANTHROPIC_API_KEY=sk-ant-...
```

> **Note:** ClawCRM works without any API key! It uses local keyword-based matching and embeddings. Add an API key for AI-powered meeting processing, profile generation, and semantic search.

You can also configure the LLM provider through the **Settings** page in the app.

### Database Management

```bash
# Generate new migration after schema changes
npm run db:generate

# Run migrations
npm run db:migrate

# Push schema directly (development)
npm run db:push

# Seed with demo data
npm run db:seed

# Full setup (migrate + seed)
npm run db:setup
```

## 📁 Project Structure

```
ClawCRM/
├── data/                    # SQLite database (gitignored)
├── drizzle/                 # Database migrations
├── src/
│   ├── app/
│   │   ├── api/            # API routes
│   │   │   ├── graph/      # Relationship graph data
│   │   │   ├── meetings/   # Meeting CRUD & processing
│   │   │   ├── people/     # People CRUD
│   │   │   ├── search/     # Semantic search
│   │   │   ├── settings/   # LLM settings & test
│   │   │   └── stats/      # Dashboard statistics
│   │   ├── graph/          # Relationship graph page
│   │   ├── log/            # Meeting logger page
│   │   ├── people/         # People list & profile pages
│   │   ├── settings/       # Settings page
│   │   ├── layout.tsx      # Root layout
│   │   └── page.tsx        # Dashboard
│   ├── components/
│   │   ├── ui/             # shadcn/ui components
│   │   ├── command-menu.tsx # ⌘K command palette
│   │   ├── sidebar.tsx     # Navigation sidebar
│   │   └── theme-toggle.tsx # Dark/light mode toggle
│   └── lib/
│       ├── db/
│       │   ├── schema.ts   # Drizzle ORM schema
│       │   ├── index.ts    # Database connection
│       │   ├── migrate.ts  # Migration runner
│       │   └── seed.ts     # Seed data
│       └── llm/
│           ├── types.ts    # LLM/embedding interfaces
│           ├── provider.ts # Provider factory
│           ├── gemini.ts   # Google Gemini provider
│           ├── openai.ts   # OpenAI provider
│           ├── anthropic.ts # Anthropic provider
│           ├── fallback.ts # Local fallback provider
│           └── embeddings.ts # Embedding utilities
├── drizzle.config.ts       # Drizzle ORM config
└── package.json
```

## 🔒 Privacy & Self-Hosting

- **All data stays on your machine** — SQLite database stored locally
- **No telemetry** — no data sent anywhere except your configured LLM provider
- **Works offline** — local fallback for search and matching (no AI features)
- **Your API keys are stored locally** in the SQLite database

## 📝 Data Model

```
Person { id, name, phone, email, socials, tags[], context, embedding, person_md, avatar_url, company, role }
Meeting { id, person_id, date, raw_input, summary, topics[], embedding }
Relationship { id, person_a_id, person_b_id, context, strength }
Settings { id, key, value }
```

## 🤝 Contributing

Contributions welcome! Feel free to open issues or submit PRs.

## 📄 License

MIT License — do whatever you want with it.
