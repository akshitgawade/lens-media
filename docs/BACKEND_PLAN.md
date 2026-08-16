# Backend Implementation Plan

## Goal

Build a FastAPI read-only endpoint that serves `EventBundle` JSON matching the
shape the frontend already consumes from `fetchEventBundle()` in
`src/lib/narrative-data.ts`. The dashboard must NOT be rewired automatically —
a new `fetchEventBundleFromApi()` function is added in parallel, and wiring is
a manual human step.

## Prerequisite: Seed Data Fix

Before anything, verify the SIR event exists in Supabase. If only "Riverside
Housing Block Evictions" exists:

```sql
DELETE FROM public.events WHERE title = 'Riverside Housing Block Evictions';
```

Then apply `seed_sir_event.sql` (if available) or insert the SIR event manually.

---

## Step 1: Add Pydantic models to backend

**File:** `backend/models.py` (new)

Create Pydantic models matching the frontend `EventBundle` types exactly:

- `OutletOut` — id, name, url, authority_tier
- `EventOut` — id, title, summary, first_reported_at
- `ArticleOut` — id, event_id, outlet_id, url, headline, published_at, full_text
- `HeadlineSnapshotOut` — id, article_id, headline_text, captured_at, source
- `StakeholderOut` — id, event_id, name, role, first_appeared_at
- `SourceAttributionOut` — article_id, official_ratio, independent_ratio
- `AgencyFramingOut` — article_id, agency_score, example_phrases (list of dict)
- `LanguageIntensityOut` — article_id, emotional_score, certainty_score, urgency_score
- `CoverageMatrixOut` — article_id, stakeholder_id, present
- `SignalsBundleOut` — source_attribution, agency_framing, language_intensity, coverage_matrix
- `EventBundleOut` — event, outlets, articles, snapshots, stakeholders, signals

**Verify:** Import models in `main.py`, run `python -c "from models import EventBundleOut"`.

## Step 2: Add GET /events/{event_id}/bundle endpoint

**File:** `backend/main.py`

Implement the endpoint:
1. Query `events` table by id → 404 if not found
2. Query `articles` WHERE event_id → empty list if none
3. Extract outlet_ids from articles, query `outlets` WHERE id IN (outlet_ids)
4. Query `headline_snapshots` WHERE article_id IN (article_ids)
5. Query `stakeholders` WHERE event_id = event_id
6. Query all 4 signal tables WHERE article_id IN (article_ids)
7. Assemble into `EventBundleOut` shape

Use the existing `get_supabase_client()` helper. All queries use `.select("*")`.
Sort articles by `published_at`, snapshots by `captured_at`, stakeholders by
`first_appeared_at` (matching frontend).

**Verify:** `uvicorn main:app --reload` then `curl localhost:8000/events/{id}/bundle`
— JSON shape must match `EventBundle` type field-for-field. Check that
`agency_score` is numeric (not string), `example_phrases` is a list of objects
with `text` and `type` keys.

## Step 3: Add fetchEventBundleFromApi() to frontend

**File:** `src/lib/narrative-data.ts`

Add a new exported function:

```typescript
export async function fetchEventBundleFromApi(eventId: string): Promise<EventBundle> {
  const response = await fetch(`/api/events/${eventId}/bundle`);
  if (!response.ok) throw new Error(`API error: ${response.status}`);
  return response.json();
}
```

(Exact URL depends on how the backend is proxied — could be Vite proxy config
or direct URL.)

**Do NOT** change `fetchEventBundle()` or any call sites. This function exists
for manual testing only.

**Verify:** Temporarily call `fetchEventBundleFromApi` in a test component or
the dashboard, compare output to `fetchEventBundle()` for the same event ID.

## Step 4: Add Vite proxy config (dev only)

**File:** `vite.config.ts`

Add a dev server proxy so `/api/*` routes to `http://localhost:8000`:

```typescript
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:8000',
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/api/, ''),
    },
  },
},
```

**Verify:** With both `bun run dev` and `uvicorn` running, `fetch('/api/events/{id}/bundle')` from browser DevTools returns the bundle.

## Step 5: Wire Edge Function (optional, for production)

**File:** `supabase/functions/analyze-article/index.ts`

Update to also proxy to the FastAPI backend for analyze requests. Already partially done — just needs `BACKEND_URL` env var set in Supabase dashboard.

**Verify:** Trigger re-analyze from dashboard, confirm signals update in Supabase.

## Step 6: Wire dashboard (manual, human-approved only)

Only after Steps 1-5 are verified:

**File:** `src/routes/_authenticated/dashboard.$eventId.tsx`

Replace `fetchEventBundle(eventId)` call with `fetchEventBundleFromApi(eventId)`.
Add a fallback: if API fails, fall back to direct Supabase.

**This step requires explicit human approval per AGENTS.md.**

---

## What NOT to Do

- Do NOT remove `fetchEventBundle()` — it's the safety net
- Do NOT auto-wire the dashboard in any automated step
- Do NOT add auth to the FastAPI backend yet (hackathon scope — public data)
- Do NOT implement real RSS ingestion in `/analyze` (out of scope)
- Do NOT touch `narrative-data.ts` hardcoded credentials in this plan (separate fix)

## Verification Checklist

- [ ] `GET /events/{id}/bundle` returns correct JSON shape
- [ ] `agency_score` is numeric (not string)
- [ ] `example_phrases` is `[{ text, type }]` not a raw JSON string
- [ ] Empty event (no articles) returns empty arrays for all nested fields
- [ ] 404 for nonexistent event_id
- [ ] `fetchEventBundleFromApi()` returns identical data to `fetchEventBundle()`
- [ ] Vite proxy works in dev
- [ ] `bun run build` passes
- [ ] `bun run lint` passes
