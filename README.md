# Narrative Lens

> **See how coverage differs, measurably.**  
> Narrative Lens compares how different news outlets report on the same event by analyzing measurable linguistic, structural, and sourcing signals — providing empirical clarity without editorial verdicts.

---

## Overview

Traditional media analysis often reduces complex coverage to binary bias ratings. Narrative Lens takes a computational linguistics approach: breaking down news coverage into empirical signals across outlets, tracking headline revisions over time, and mapping stakeholder representation.

### Core Signals Measured

1. **Source Attribution**: Institutional vs. independent voices quoted (government and corporate spokespeople vs. affected citizens and grassroots advocates).
2. **Agency Framing**: Active vs. passive or agentless grammatical constructions, revealing who is framed as an active subject vs. an obscured actor.
3. **Language Intensity**: Objective scoring of emotional valence, certainty markers, and urgency cues across reporting.
4. **Perspective Coverage**: A cross-outlet matrix tracking which stakeholder groups are amplified, marginalized, or omitted.
5. **Headline Diff**: Fine-grained snapshot diffing to track live editorial revisions, framing shifts, and stealth edits.
6. **Narrative Timeline**: Chronological emergence of narrative angles and stakeholders across publications.

---

## Architecture & Tech Stack

```
narrative-lens/
├── src/                      # TanStack Start (SSR) frontend application
│   ├── routes/               # File-based routing (Landing, Auth, Analyze, Dashboard)
│   ├── components/           # UI components (shadcn/ui, Three.js scenes, GSAP animations)
│   ├── integrations/         # Supabase client (client & server middleware)
│   └── lib/                  # Core narrative data models & data fetching
├── backend/                  # FastAPI & NLP extraction engine
│   ├── main.py               # API endpoints (analysis pipeline, event bundles)
│   ├── nlp_pipeline.py       # spaCy NER, syntactic parsing & scoring heuristics
│   ├── scraper.py            # Article content extraction & normalization
│   └── models.py             # Pydantic schemas
└── supabase/                 # Supabase configuration, migrations & edge functions
```

- **Frontend**: [TanStack Start](https://tanstack.com/start) (Nitro SSR), [TanStack Router](https://tanstack.com/router), [React 19](https://react.dev), TypeScript, [Tailwind CSS v4](https://tailwindcss.com), [shadcn/ui](https://ui.shadcn.com), [Recharts](https://recharts.org), Three.js / React Three Fiber, GSAP.
- **Backend**: Python 3.11, [FastAPI](https://fastapi.tiangolo.com/), [spaCy](https://spacy.io/) (`en_core_web_sm`), Groq LLM integration.
- **Data & Auth**: [Supabase](https://supabase.com/) (PostgreSQL with Row Level Security), Supabase Auth, Edge Functions.

---

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) (recommended) or Node.js 20+
- Python 3.11+ (for the analysis backend)
- Supabase account & project

### 1. Environment Configuration

#### Root (`.env`):
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_key
```

#### Backend (`backend/.env`):
```env
PORT=8000
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your_supabase_service_role_key
GROQ_API_KEY=your_groq_api_key
```

### 2. Run the Backend

```bash
cd backend
python -m venv venv

# Windows
venv\Scripts\activate
# macOS/Linux
source venv/bin/activate

pip install -r requirements.txt
python -m spacy download en_core_web_sm
python main.py
```
Backend API will be running at `http://localhost:8000`.

### 3. Run the Frontend

In the project root:

```bash
# Install dependencies
bun install

# Start development server
bun run dev
```
Frontend will be available at `http://localhost:8080` (or `http://localhost:5173`).

---

## Key Routes & Demo

- `/` — Interactive landing page with 3D canvas and signal breakdown.
- `/dashboard/ca9c6cc1-c954-48cd-9739-1630a4b5eb32` — Verified demo event comparing multi-outlet coverage.
- `/analyze` — Article submission and live NLP signal extraction.
- `/methodology` — Technical documentation detailing mathematical and linguistic formulas.
- `/auth` — Supabase authentication (sign in / sign up).

---

## Development Scripts

| Command | Description |
|---|---|
| `bun run dev` | Start the local Vite development server |
| `bun run build` | Build production SSR and client bundles |
| `bun run lint` | Run ESLint across TypeScript and React code |
| `bun run format` | Format codebase using Prettier |
| `python test_smoke.py` | Run backend health and smoke tests (in `backend/`) |

---

## Development Guidelines

- **Lovable Sync**: This repository is connected to Lovable. Never force-push, rebase, or amend commits that have already been pushed to maintain clean sync history.
- **Demo Stability**: The live demo dashboard (`dashboard.$eventId.tsx`) relies on `fetchEventBundle()` from `src/lib/narrative-data.ts`. Backend additions should use separate endpoints to protect demo availability.
