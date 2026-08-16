# Narrative Lens — Architecture Map

## Stack

| Layer | Tech |
|-------|------|
| Frontend | React 19, TypeScript, TanStack Start (SSR/Nitro), TanStack Router (file-based), TanStack React Query, Tailwind CSS 4, shadcn/ui (new-york), Recharts, Vite 8 |
| Backend | Python 3.11, FastAPI, spaCy (`en_core_web_sm`), Supabase Python client |
| Database | Supabase (PostgreSQL), 9 tables, RLS enabled, public SELECT policies |
| Auth | Supabase Auth (email/password), JWT Bearer tokens, server-side middleware validation |
| Edge Functions | Supabase Edge Functions (Deno) — proxies POST /analyze to FastAPI backend |
| Deployment | Lovable platform (frontend), Cloudflare (wrangler config), separate FastAPI host |

## Directory Layout

```
src/
  routes/             # TanStack file-based routing
    __root.tsx        # App shell, QueryClient, nav, error boundaries
    index.tsx         # Landing page (/)
    auth.tsx          # Sign in / sign up (/auth)
    analyze.tsx       # Submit analysis (/analyze)
    methodology.tsx   # Methodology explainer (/methodology)
    _authenticated/   # Auth-gated layout route
      route.tsx       # beforeLoad auth check → redirect to /auth
      account.tsx     # Account page (/account)
      dashboard.$eventId.tsx  # Main dashboard — 765 lines
  lib/
    narrative-data.ts # Core types + fetchEventBundle() + analyzeArticle()
    utils.ts          # cn() helper
  integrations/supabase/
    client.ts         # Client-side Supabase (anon key, lazy proxy)
    client.server.ts  # Server-side Supabase (service role, bypasses RLS)
    auth-middleware.ts # Server middleware: validates JWT, creates user-scoped client
    types.ts          # Generated Database type
  components/ui/      # 50+ shadcn/ui components (few actually used)
backend/
  main.py             # FastAPI app: POST /analyze, GET /health
  nlp_pipeline.py     # spaCy NER, agency framing, language intensity scoring
supabase/
  migrations/         # Single migration: schema + seed data
  functions/analyze-article/index.ts  # Edge Function proxy to FastAPI
```

## Database Schema (9 tables)

```
outlets (id, name, url, authority_tier)
events (id, title, summary, first_reported_at)
articles (id, event_id→events, outlet_id→outlets, url, headline, published_at, full_text)
headline_snapshots (id, article_id→articles, headline_text, captured_at, source: wayback|live)
stakeholders (id, event_id→events, name, role, first_appeared_at)
signals_source_attribution (article_id PK→articles, official_ratio, independent_ratio)
signals_agency_framing (article_id PK→articles, agency_score, example_phrases: jsonb)
signals_language_intensity (article_id PK→articles, emotional_score, certainty_score, urgency_score)
coverage_matrix (article_id+stakeholder_id composite PK, present: bool)
```

All FKs are `ON DELETE CASCADE`. RLS enabled on all tables with public SELECT policies. Service role has ALL grants.

## Frontend → Backend Data Flow

### Current (working demo)
```
dashboard.$eventId.tsx
  → fetchEventBundle(eventId)        [src/lib/narrative-data.ts:81]
    → supabase.from("events")        [direct Supabase client, anon key]
    → supabase.from("articles")
    → supabase.from("stakeholders")
    → supabase.from("outlets")
    → supabase.from("headline_snapshots")
    → supabase.from("signals_*")     [4 tables]
    → supabase.from("coverage_matrix")
  → Returns EventBundle type
```

### Analyze flow (partially wired)
```
dashboard.$eventId.tsx "Re-analyze" button
  → analyzeArticle(articleId, text, outletId)
    → POST Supabase Edge Function /functions/v1/analyze-article
      → Edge Function proxies to BACKEND_URL/analyze (BACKEND_URL not set)
        → FastAPI POST /analyze
          → nlp_pipeline.py (spaCy)
          → writes to signals_* tables via Supabase service role
```

### Target (backend-first, not yet implemented)
```
dashboard.$eventId.tsx
  → fetchEventBundleFromApi(eventId)  [NEW function, parallel to fetchEventBundle]
    → GET FastAPI /events/{eventId}/bundle
      → FastAPI reads from Supabase (service role)
      → Returns same EventBundle JSON shape
```

## EventBundle Type Contract

```typescript
type EventBundle = {
  event: EventRow;           // { id, title, summary, first_reported_at }
  outlets: Outlet[];         // { id, name, url, authority_tier }
  articles: Article[];       // { id, event_id, outlet_id, url, headline, published_at, full_text }
  snapshots: HeadlineSnapshot[];  // { id, article_id, headline_text, captured_at, source }
  stakeholders: Stakeholder[];    // { id, event_id, name, role, first_appeared_at }
  signals: SignalsBundle;
    // source_attribution: { article_id, official_ratio, independent_ratio }[]
    // agency_framing: { article_id, agency_score, example_phrases: Phrase[] }[]
    // language_intensity: { article_id, emotional_score, certainty_score, urgency_score }[]
    // coverage_matrix: { article_id, stakeholder_id, present }[]
}
```

Note: `agency_score` is cast through `Number()` on the frontend (line 146) because Supabase returns `numeric` as a string.

## Auth Flow

1. Client: `supabase.auth.signInWithPassword({ email, password })` → stores JWT in localStorage
2. Server route guard: `_authenticated/route.tsx` `beforeLoad` → `supabase.auth.getUser()` → redirect if invalid
3. Server middleware chain: `auth-middleware.ts` validates JWT via `supabase.auth.getClaims()`, creates user-scoped Supabase client
4. `__root.tsx` listens for `SIGNED_IN` / `SIGNED_OUT` / `USER_UPDATED` events → invalidates React Query cache

## Environment Variables

| Variable | Where | Purpose |
|----------|-------|---------|
| `SUPABASE_URL` | Server, Edge Functions, FastAPI | Supabase project URL |
| `SUPABASE_PUBLISHABLE_KEY` | Server | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | `client.server.ts` | Admin key (bypasses RLS) — NOT in .env |
| `VITE_SUPABASE_URL` | Client build | Same as SUPABASE_URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Client build | Same as SUPABASE_PUBLISHABLE_KEY |
| `BACKEND_URL` | Edge Function | FastAPI URL — NOT set |
| `SUPABASE_SERVICE_KEY` | FastAPI backend | Same as service role key — in backend/.env |

## Build / Dev Commands

```bash
bun run dev          # Vite dev server (port 5173)
bun run build        # Vite production build
bun run lint         # ESLint
bun run format       # Prettier
```

No test framework or test files exist.

## Critical Risks / Blockers

1. **No `docs/` directory existed** — ARCHITECTURE.md and BACKEND_PLAN.md referenced in AGENTS.md were missing. Now created.
2. **FastAPI backend exists but is disconnected** — has `/analyze` but no `/events/{id}/bundle`. Edge Function proxy has `BACKEND_URL` unset.
3. **Seed data mismatch** — `fetchSampleEventId()` looks for title "Supreme Court SIR Electoral Rolls Verdict" but the migration only seeds "Riverside Housing Block Evictions". ZCODE_CONTEXT.md mentions a `seed_sir_event.sql` that is NOT present in `supabase/migrations/`.
4. **Hardcoded Supabase credentials** in `narrative-data.ts:155-157` — `ANALYZE_SUPABASE_URL` and `ANALYZE_ANON_KEY` are committed to source. Should use env vars.
5. **No test infrastructure** — no test runner, no test files, no CI.
6. **Backend Python deps** may be stale — `nlp_pipeline.py` has a fallback for missing spaCy model but no install script beyond `requirements.txt`.
