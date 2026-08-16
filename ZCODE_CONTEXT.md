# Narrative Lens — Context for ZCode
# Verified against the actual repo on 2026-08-15. Supersedes any older
# handoff doc's claims about FrameShift diff status.

## CORRECTIONS to earlier status notes
- FrameShift Replay diff is ALREADY implemented correctly in
  `src/routes/_authenticated/dashboard.$eventId.tsx` (see `wordDiff()`,
  a word-level LCS diff with added/removed/reworded states, color-coded,
  with a legend). Do not rebuild this. Only touch it if there's a
  specific bug.
- `supabase/migrations/seed_sir_event.sql` already exists (added
  2026-08-15) with full SIR-event seed data matching the live schema:
  1 event, 5 outlets (Guardian has zero articles on purpose — exercises
  the empty-outlet state in the coverage matrix), 4 articles, 5
  stakeholders, 3 headline snapshots on The Wire article, and rows for
  all four signals tables. It uses `ON CONFLICT DO NOTHING` — safe to
  re-run.

## KNOWN GOTCHA — fix this first
`fetchSampleEventId()` in `src/lib/narrative-data.ts` picks the event
with the EARLIEST `first_reported_at`. There is an older seed migration
(`20260723...sql`) that seeds a placeholder "Riverside Housing Block
Evictions" event dated 2026-03-14, which sorts BEFORE the SIR event
(2026-05-27). If that old migration was ever applied to the live
Supabase project, the demo will open the wrong event.

Fix (pick one, don't need ZCode's agentic loop for this — it's one
Supabase SQL Editor query):
```sql
delete from public.events where title = 'Riverside Housing Block Evictions';
```
This cascades and removes its outlets/articles/signals too (all FKs are
`ON DELETE CASCADE`), except `outlets` — check if any Riverside outlets
are shared/reused before deleting those separately if needed.

## REMAINING WORK (priority order for tomorrow's deadline)

### 1. Verify seed data renders (no code change — just a check)
After running the DELETE above and applying `seed_sir_event.sql` via
the Supabase SQL Editor, load `/analyze` → "Open sample dashboard" and
confirm all five signal cards populate (no "No signals computed").

### 2. NICE TO HAVE — FastAPI backend (only if time remains)
PRD wants backend-first architecture: frontend should call FastAPI,
which reads from Supabase, rather than the frontend hitting Supabase
directly. This does not exist in the repo I inspected (no `backend/`
directory) — if it exists locally on your machine, tell ZCode to
inspect it before generating anything new.
- Read-only endpoints serving precomputed signals (mirror the shape of
  `EventBundle` in `src/lib/narrative-data.ts`)
- Pydantic models matching `supabase/migrations/*.sql` table defs
- CORS enabled for the Vite dev server origin
- Only touch `narrative-data.ts` to point at FastAPI AFTER the backend
  is confirmed working — don't break the direct-Supabase path until
  the replacement is verified, given the deadline.

### 3. NICE TO HAVE — real ingestion for /analyze
Currently `src/routes/analyze.tsx` routes every query to the sample
event via `fetchSampleEventId()`. Real RSS/API ingestion is out of
scope for tomorrow — skip unless everything else is done.

## RULES FOR ZCODE (same reasons as the earlier Aider issues)
- Break work into ONE small task per prompt. Don't ask for "the whole
  backend" in one shot.
- Run `bun run build` and `bun run lint` yourself between steps rather
  than trusting the tool's own auto-fix loop.
- Don't let it scrape arbitrary URLs or install browser automation
  (Playwright etc.) — wastes tokens, not needed for this project.
- This repo is public and non-sensitive (hackathon submission) — no
  special data-handling concerns for using a third-party model here.

## COPY-PASTE PROMPTS FOR ZCODE

**Step 1:**
```
Open src/lib/narrative-data.ts and read fetchSampleEventId(). Do not
change it. Just confirm which event it will return given the events
currently in the connected Supabase project (list them by title and
first_reported_at). Do not write any code yet.
```

**Step 2 (only if backend/ doesn't already exist locally):**
```
Create a new backend/ directory with a minimal FastAPI app (main.py)
that exposes GET /events/{event_id}/bundle returning JSON matching the
EventBundle type in src/lib/narrative-data.ts (event, outlets, articles,
snapshots, stakeholders, signals). Read from the same Supabase project
using the service role key from environment variables. Add CORS
middleware allowing http://localhost:5173. Do not touch any frontend
files in this step.
```

**Step 3 (after step 2 is verified working with `uvicorn main:app --reload`):**
```
In src/lib/narrative-data.ts, add a new function fetchEventBundleFromApi
that calls the FastAPI endpoint from step 2 instead of Supabase
directly, matching the existing EventBundle return type exactly. Do not
remove or modify fetchEventBundle — add this as a parallel function so
I can switch dashboard.$eventId.tsx over safely.
```
