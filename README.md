# 🦞 ClawCRM

**AI-powered personal CRM for managing relationships and meetings.**

ClawCRM helps you keep track of the people you meet, what you discussed, and how they're connected — all powered by AI that works even without API keys.

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![SQLite](https://img.shields.io/badge/SQLite-Local-blue?logo=sqlite)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)

## ✨ Features

- **📝 Meeting Logger** — Type or dictate meeting notes with Web Speech API voice input
- **🤖 AI Processing** — Automatically extracts person names, topics, and summaries from your notes
- **👥 Contact Management** — Rich profiles with auto-generated markdown summaries
- **🔍 Semantic Search** — Search across people and meetings with TF-IDF + embedding-based search
- **🕸️ Relationship Graph** — Interactive force-directed graph visualizing your network
- **⌨️ Command Palette** — Quick navigation with `⌘K`
- **🌙 Dark Mode** — Beautiful dark theme by default
- **🔒 Self-hosted** — All data stored locally in SQLite, nothing leaves your machine
- **🔄 Fallback LLM** — Works without any API keys using keyword extraction and TF-IDF

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ (or Bun)
- npm, yarn, or pnpm

### Installation

```bash
# Clone the repo
git clone https://github.com/Kyrillus/ClawCRM.git
cd ClawCRM

# Install dependencies
npm install

# Push database schema
npm run db:push

# Seed with sample data (optional)
npm run db:seed

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Environment Variables

No environment variables are required! ClawCRM works out of the box with the built-in fallback LLM.

Copy `.env.local.example` to `.env.local` if you want to pre-configure API keys:

```bash
cp .env.local.example .env.local
```

## 🧠 AI Providers

Configure your preferred AI provider in **Settings**:

| Provider | Chat | Embeddings | API Key Required |
|----------|------|------------|-----------------|
| **Fallback** (default) | Keyword extraction | TF-IDF vectors | ❌ No |
| OpenAI | GPT-4o / GPT-4o-mini | text-embedding-3-small | ✅ Yes |
| Anthropic | Claude Sonnet 4 / Haiku | — | ✅ Yes |
| Google Gemini | Gemini 2.0 Flash | text-embedding-004 | ✅ Yes |

The fallback provider works entirely offline using:
- Regex-based person name extraction
- TF-IDF keyword analysis for topic extraction
- Hash-based embedding vectors for semantic search

## 📁 Project Structure

```
src/
├── app/
│   ├── api/              # API routes
│   │   ├── graph/        # Relationship graph data
│   │   ├── meetings/     # Meeting processing
│   │   ├── persons/      # CRUD for contacts
│   │   ├── search/       # Semantic search
│   │   └── settings/     # App settings
│   ├── graph/            # Network visualization page
│   ├── log/              # Meeting logger page
│   ├── people/           # Contact list & profiles
│   ├── settings/         # AI provider config
│   └── page.tsx          # Dashboard
├── components/
│   ├── ui/               # shadcn/ui components
│   ├── command-menu.tsx   # ⌘K command palette
│   ├── meeting-card.tsx   # Meeting display card
│   ├── person-card.tsx    # Contact grid card
│   ├── search-bar.tsx     # Semantic search bar
│   ├── sidebar.tsx        # Navigation sidebar
│   └── theme-toggle.tsx   # Dark/light mode toggle
└── lib/
    ├── db/               # Database (Drizzle + SQLite)
    │   ├── schema.ts     # Database schema
    │   ├── seed.ts       # Sample data
    │   └── index.ts      # DB connection
    └── llm/              # AI layer
        ├── types.ts      # Provider interfaces
        ├── openai.ts     # OpenAI (fetch-based)
        ├── anthropic.ts  # Anthropic (fetch-based)
        ├── gemini.ts     # Google Gemini (fetch-based)
        ├── fallback.ts   # Offline keyword extraction
        ├── provider.ts   # Provider factory
        └── embeddings.ts # TF-IDF, cosine similarity
```

## 🛠️ Tech Stack

- **Framework:** Next.js 16 (App Router, Turbopack)
- **UI:** shadcn/ui + Tailwind CSS v4
- **Database:** SQLite via better-sqlite3 + Drizzle ORM
- **Graph:** react-force-graph-2d
- **AI:** Pure fetch-based providers (no SDK dependencies)
- **Voice:** Web Speech API

## 📜 Scripts

```bash
npm run dev        # Start dev server
npm run build      # Production build
npm run start      # Start production server
npm run db:push    # Push schema to database
npm run db:seed    # Seed with sample data
```

## 📄 License

MIT
