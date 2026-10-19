# Narrative Lens — Codebase Handoff Document
## For: musespark 1.2 (Frontend Overhaul)
## Generated: 2026-08-29

---

## 1. PROJECT OVERVIEW

**Narrative Lens** is a media-literacy tool that compares how different news outlets cover the same story. Users type a topic, the system scrapes real articles from 6 Indian news outlets via RSS, runs NLP analysis (spaCy + Groq LLM), and displays an interactive dashboard with 7 signal panels.

**Live demo event ID**: `ca9c6cc1-c954-48cd-9739-1630a4b5eb32`

---

## 2. TECH STACK

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, TanStack Start (file-based routing), Tailwind CSS 4 |
| UI Library | shadcn/ui (new-york style, 46 components in `src/components/ui/`) |
| Charts | Recharts 2.15 (BarChart, RadarChart, ResponsiveContainer) |
| State | TanStack React Query 5 (server state), React useState/useMemo (local) |
| Backend | FastAPI (Python 3.11), Uvicorn |
| NLP | spaCy 3.7 (`en_core_web_sm`), Groq SDK (models: `openai/gpt-oss-120b`, `openai/gpt-oss-20b`) |
| RSS | feedparser 6, trafilatura 1.6 |
| Database | Supabase (PostgreSQL), 9 tables |
| Auth | Supabase Auth (email/password) |
| Build | Vite 8, Bun package manager |
| Deploy | Lovable platform (two-way git sync) |

---

## 3. CRITICAL RULES (NEVER VIOLATE)

1. **Dashboard MUST use `fetchEventBundle()`** from `src/lib/narrative-data.ts` (direct Supabase call). Never wire to backend API automatically.
2. **Never force-push, rebase, or amend** already-pushed commits (Lovable two-way sync).
3. **Never create new files under `src/routes/`** — file-based routing means stray files cause route collisions. Only edit existing route files.
4. **Only run one `bun run dev` at a time.**
5. **`bun run lint` is unusable** (6900+ CRLF errors). Use `bun run build` (EXIT 0) as verification.
6. **Header logo/title in `__root.tsx` is FINAL** — do not touch.
7. **Vite proxy does NOT work** (Lovable preset overrides config). Frontend calls backend directly at `http://127.0.0.1:8000`.
8. **Read `docs/ARCHITECTURE.md` and `docs/BACKEND_PLAN.md` before any backend work.**

---

## 4. DIRECTORY STRUCTURE

```
lens-media/
├── backend/
│   ├── main.py              # FastAPI app (582 lines) — all endpoints
│   ├── nlp_pipeline.py      # NLP: agency framing, language intensity, stakeholder extraction (544 lines)
│   ├── scraper.py           # RSS: 6 outlets, keyword filtering, text extraction (367 lines)
│   ├── models.py            # Pydantic models mirroring frontend types (77 lines)
│   ├── requirements.txt     # Python deps
│   ├── .env                 # PORT, SUPABASE_URL, SUPABASE_SERVICE_KEY, GROQ_API_KEY
│   └── venv/                # Python virtual environment
├── src/
│   ├── routes/
│   │   ├── __root.tsx              # App shell: splash animation, header, footer, auth listener
│   │   ├── index.tsx               # Landing page
│   │   ├── auth.tsx                # Sign in / create account
│   │   ├── analyze.tsx             # Topic search + outlet selector → calls POST /events/search
│   │   ├── methodology.tsx         # Methodology explainer
│   │   └── _authenticated/
│   │       ├── route.tsx           # Auth guard (beforeLoad)
│   │       ├── account.tsx         # Account page
│   │       └── dashboard.$eventId.tsx  # MAIN DASHBOARD (1210 lines, 7 signal panels)
│   ├── lib/
│   │   ├── narrative-data.ts       # Types + fetchEventBundle() + analyzeArticle()
│   │   └── utils.ts                # cn() helper
│   ├── integrations/supabase/      # Client/server Supabase clients, auth middleware, types
│   ├── components/ui/              # 46 shadcn/ui components
│   └── styles.css                  # Tailwind + editorial theme (paper/ink palette)
├── docs/
│   ├── ARCHITECTURE.md
│   ├── BACKEND_PLAN.md
│   ├── ALGORITHMS.txt
│   └── CONTINUATION.md
├── AGENTS.md                       # Project rules
├── package.json
├── vite.config.ts
├── tsconfig.json
└── components.json                 # shadcn/ui config
```

---

## 5. ENVIRONMENT VARIABLES

### Frontend (root `.env`)
```
SUPABASE_PROJECT_ID=lnycmvscjimmdritmoul
SUPABASE_PUBLISHABLE_KEY=eyJhbGci...  (anon key)
SUPABASE_URL=https://lnycmvscjimmdritmoul.supabase.co
VITE_SUPABASE_PROJECT_ID=lnycmvscjimmdritmoul
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGci...  (same anon key)
VITE_SUPABASE_URL=https://lnycmvscjimmdritmoul.supabase.co
```

### Backend (`backend/.env`)
```
PORT=8000
SUPABASE_URL=https://lnycmvscjimmdritmoul.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGci...  (service role key — bypasses RLS)
GROQ_API_KEY=your_groq_api_key_here
```

---

## 6. DATABASE SCHEMA (9 tables)

| Table | Key columns |
|-------|------------|
| `events` | id (uuid PK), title, summary, first_reported_at |
| `outlets` | id (uuid PK), name, url, authority_tier |
| `articles` | id (uuid PK), event_id (FK), outlet_id (FK), url, headline, published_at, full_text |
| `stakeholders` | id (uuid PK), event_id (FK), name, role, first_appeared_at |
| `headline_snapshots` | id (uuid PK), article_id (FK), headline_text, captured_at, source (enum: "wayback"\|"live") |
| `signals_source_attribution` | id, article_id (FK), official_ratio, independent_ratio |
| `signals_agency_framing` | id, article_id (FK), agency_score, example_phrases (jsonb) |
| `signals_language_intensity` | id, article_id (FK), emotional_score, certainty_score, urgency_score |
| `coverage_matrix` | id, article_id (FK), stakeholder_id (FK), present (boolean) |

---

## 7. SUPABASE CONFIG

- **URL**: `https://lnycmvscjimmdritmoul.supabase.co`
- **Anon key**: in root `.env` as `VITE_SUPABASE_PUBLISHABLE_KEY`
- **Service key**: in `backend/.env` as `SUPABASE_SERVICE_KEY`
- **Project ID**: `lnycmvscjimmdritmoul`

---

## 8. BACKEND API ENDPOINTS

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | Returns `{"status": "ok"}` |
| GET | `/events/{event_id}/bundle` | Returns complete EventBundle (mirrors frontend type) |
| POST | `/analyze` | Runs NLP on a single article (LLM + spaCy fallback), writes to Supabase |
| POST | `/events/search` | RSS pipeline: scrapes articles, extracts text, runs NLP, stores in Supabase, returns event_id |
| POST | `/events/generate` | (Old) LLM-generated fake coverage — deprecated, kept for now |

**The frontend calls the backend directly at `http://127.0.0.1:8000`** (not via proxy).

---

## 9. EVENTBUNDLE TYPE (the core data contract)

```typescript
type EventBundle = {
  event: { id: string; title: string; summary: string; first_reported_at: string };
  outlets: { id: string; name: string; url: string; authority_tier: string }[];
  articles: { id: string; event_id: string; outlet_id: string; url: string; headline: string; published_at: string; full_text: string }[];
  snapshots: { id: string; article_id: string; headline_text: string; captured_at: string; source: "wayback" | "live" }[];
  stakeholders: { id: string; event_id: string; name: string; role: string; first_appeared_at: string | null }[];
  signals: {
    source_attribution: { article_id: string; official_ratio: number; independent_ratio: number }[];
    agency_framing: { article_id: string; agency_score: number; example_phrases: { text: string; type: "active" | "passive" | "agentless" }[] }[];
    language_intensity: { article_id: string; emotional_score: number; certainty_score: number; urgency_score: number }[];
    coverage_matrix: { article_id: string; stakeholder_id: string; present: boolean }[];
  };
};
```

---

## 10. FRONTEND DATA FLOW

```
analyze.tsx
  → POST http://127.0.0.1:8000/events/search { query, outlets[] }
  → returns { event_id }
  → navigates to /dashboard/{event_id}

dashboard.$eventId.tsx
  → calls fetchEventBundle(eventId)  [direct Supabase, NOT backend]
  → returns EventBundle
  → DashboardBody renders 7 SectionCards
```

**fetchEventBundle()** (`src/lib/narrative-data.ts:81-153`):
1. Parallel fetch: events, articles, stakeholders (from Supabase)
2. Parallel fetch: outlets, snapshots, all 4 signal tables (filtered by article IDs)
3. Assembles and returns EventBundle

---

## 11. DASHBOARD — 7 SIGNAL PANELS (Feature Map)

### Layout
- **Masthead**: centered title, summary, outlet buttons (scroll-to-highlight), range pills
- **Re-run analysis**: outlet buttons that re-analyze via POST /analyze
- **Two-column grid** (lg:grid-cols-12):
  - Left (col-span-7): Features 01, 03, 04, 07
  - Right (col-span-5): Features 02, 05, 06

### Feature 01: Source Attribution Ratio
- **Component**: `SourceAttributionChart`
- **Type**: Horizontal stacked bar chart (official vs independent voices)
- **X-axis**: 0-100 with labels at 0,20,40,60,80,100
- **Data**: `sourceByOutlet` — averages `official_ratio` and `independent_ratio` per outlet
- **Note**: Shows "No independent voices" message when all independent = 0

### Feature 02: Agency Framing
- **Component**: `AgencyFraming`
- **Type**: Sorted list with score bars + example phrases
- **Score**: 15-100 (scaled from raw 0-1 via `15 + (avg * 85)`)
- **Sort**: Toggle button "Agency ↓/↑" for ascending/descending
- **Phrases**: Colored by type (active=underline, passive=accent bg, agentless=line-through)
- **Layout**: Sort button is compact (`mb-1 py-0 px-1.5 text-[9px]`), list uses `space-y-4`

### Feature 03: Language Intensity
- **Component**: `LanguageIntensityChart`
- **Type**: Bar chart OR radar chart (toggle)
- **Toggle**: Two rounded pill buttons (active: `bg-accent text-white`, inactive: `border border-rule bg-card`)
- **Score scaling**: 0-100 raw → 10-90 display via `10 + (raw * 0.8)`
- **Bar chart**: Y-axis domain [0, 100], bars have `radius={[3,3,0,0]}`
- **Radar chart**:
  - `ResponsiveContainer key={view}` — forces remount on view toggle (fixes invisible radar)
  - Wrapped in `relative` div with `containerRef` for mouse tracking
  - `outerRadius="68%"`
  - `PolarAngleAxis` with custom tick: pushes labels outward 22px from vertices, bold on hover
  - `PolarRadiusAxis`: hidden (`tick={false} axisLine={false}`)
  - Legend: 3 colored boxes below chart; on hover, score appears ABOVE the box in bold
  - Hover detection: computed from mouse angle relative to chart center (no Recharts events)
  - Radar strokes: `strokeWidth={2}`, fills: emotional=0.35, certainty=0.25, urgency=0.3 opacity

### Feature 04: Perspective Coverage Matrix
- **Component**: `CoverageMatrix`
- **Type**: Sortable table with SVG checkmark/X icons
- **Icons**: Dark green (`#166534`) for present, maroon (`#7f1d1d`) for absent, 24px circles
- **Sort**: By stakeholder name or by outlet coverage (click column headers)
- **Stakeholder names**: Title-cased via regex (skips ALL CAPS acronyms)

### Feature 05: Headline Diff · FrameShift Replay
- **Component**: `HeadlineDiff`
- **Type**: Two snapshot selectors + word-level diff
- **Diff algorithm**: LCS-based (`wordDiff` function at line 1013)
- **Diff parts**: added (green), removed (red+line-through), reworded (yellow, from/to)
- **Summary**: "N words added · N words removed · N phrases reworded" — shown INSIDE the diff box at bottom
- **Cross-article note**: Shown when comparing snapshots from different articles

### Feature 06: Narrative Evolution Timeline
- **Component**: `NarrativeTimeline`
- **Type**: Horizontal timeline rail + source table
- **Olympic clustering**: When stakeholders share timestamp, dots cluster at center with 2.8% spacing
- **Mixed timestamps**: Same-time groups cluster, different-time dots at actual positions
- **Position clamping**: Dots clamped to 3%-97% to stay inside the rail
- **Hover tooltip**: Shows above mouse (`top: hover.y - 60`), displays "All Stakeholders" when all same time, names on separate lines for groups, individual name+role for single
- **Dimming**: Non-hovered dots dim to 30% opacity
- **Date normalization**: Stakeholder names title-cased (skips ALL CAPS)
- **Source table**: Below timeline, shows each stakeholder with color dot, name, role, date

### Feature 07: Source Articles
- **Type**: Inline in SectionCard (not a separate component)
- **Layout**: Outlet name bold above, article headline as link below
- **Highlight**: On outlet button click, matching articles get `bg-accent/10` + shadow, others dim to `opacity-40`
- **Scroll**: Centers first matching article on screen via `scrollTo`
- **Auto-clear**: Highlight clears after 2 seconds

---

## 12. MASTHEAD STRUCTURE

```
┌─────────────────────────────────────┐
│           {event.title}             │  ← centered, headline class, 5xl/6xl
│     {event.summary}                 │  ← centered, max-w-3xl, serif
│  Outlets: [btn] [btn] [btn] ...     │  ← pill buttons, scroll-to-highlight
│  [Aug 15]  —  [Aug 20]             │  ← editorial dateline (serif date, mono time)
└─────────────────────────────────────┘
```

Range display is editorial dateline style:
- No "Range:" label — self-explanatory
- Date in serif font, time in mono below it
- Separated by em-dash in accent red
- Wrapped in `bg-secondary/50` bordered pills

No border below masthead (was removed).

---

## 13. CSS / THEME

**File**: `src/styles.css`

**Color palette** (editorial/newspaper):
- `--background` / `--paper`: warm off-white
- `--ink`: dark brown-black
- `--accent`: deep red (`oklch(0.52 0.14 25)`)
- `--rule`: light gray divider

**Fonts**:
- Headlines: `Fraunces` (serif)
- Body: `Inter` (sans)
- Mono: `JetBrains Mono`

**Custom utilities**:
- `.headline` — serif, bold, tight tracking
- `.eyebrow` — uppercase mono, small, letter-spaced
- `.paper-card` — card bg + rule border + radius
- `.rule-divider` — top border rule

**Key chart colors**:
- `INK = "oklch(0.19 0.015 60)"` — dark, used for bars/text
- `ACCENT = "oklch(0.52 0.14 25)"` — deep red
- `MUTED = "oklch(0.72 0.02 70)"` — gray
- `SERIES_COLORS`: array of 6 oklch colors for timeline dots
- `URGENCY = "oklch(0.62 0.11 150)"` — green

---

## 14. NLP PIPELINE (backend)

### Agency Framing (`nlp_pipeline.py:171-240`)
- `_agency_score_sentence()`: Scores 0-1 per sentence based on passive voice, named/generic subjects, speech verbs, hedging words
- `detect_agency_framing()`: Averages sentence scores across all sentences (no cap)
- Frontend scales: `15 + (raw_avg * 85)` → 15-100

### Language Intensity (`nlp_pipeline.py:243-260`)
- `_score_lexicon()`: Counts lexicon word density, scales via `ratio / 0.008`
- Lexicons: EMOTIONAL (30 words), CERTAINTY (24 words), URGENCY (22 words) — expanded with Indian English terms
- Frontend scales: `10 + (raw * 100 * 0.8)` → 10-90

### Batch Analysis (Optimization: 1 LLM call per outlet)
- `analyze_outlet_batch()`: Takes query + outlet name + articles list
- Returns per-article: relevance, source_attribution, agency_framing, language_intensity
- Also returns shared stakeholders for the outlet
- Uses gpt-oss-20b (structured JSON extraction doesn't need 120b)
- SHA256 cache: skips duplicate calls for same article batch
- LLM calls per search: ~6 (one per outlet) instead of ~25 (per-article)

### Stakeholder Extraction (now included in batch)
- Included in `analyze_outlet_batch()` response
- Fallback: spaCy NER (entities appearing in 2+ articles) if batch fails

### Coverage Matrix Matching (`main.py:500-527`)
- 4-strategy fuzzy matching:
  1. Exact substring
  2. Parenthetical abbreviation (e.g., "NDRRMA")
  3. Keyword overlap (≥2 key words)
  4. First-word match
- Guard: skips outlet if outlet_text is empty (with diagnostic logging)

### Keyword Relevance (`scraper.py:187-212`)
- Stem-based matching (strips suffixes: -s, -ed, -ing, etc.)
- Headline matches weighted 2x
- Rejects articles with zero headline word overlap

### DuckDuckGo Dorking (`scraper.py`)
- `search_google_dork()`: Uses `site:domain "query"` for 48h coverage window
- `OUTLET_DOMAINS` registry maps each outlet to its domain
- `_merge_and_dedup()`: RSS articles take priority, dorks fill gaps, dedup by URL
- RSS description fallback: when trafilatura fails, uses RSS `<description>` field

---

## 15. RSS OUTLETS + DUCKDUCKGO DORKING

### RSS Feeds (working, verified)

| Outlet | RSS URL | Notes |
|--------|---------|-------|
| NDTV | feeds.feedburner.com/ndtvnews-top-stories | |
| India Today | indiatoday.in/rss/home | bozo=True (encoding issue, works) |
| Hindustan Times | hindustantimes.com/feeds/rss/india-news/rssfeed.xml | |
| Times of India | timesofindia.indiatimes.com/rssfeedstopstories.cms | |
| Indian Express | indianexpress.com/feed/ | |
| The Hindu | thehindu.com/feeder/default.rss | |

### DuckDuckGo Dorking Domains

| Outlet | Domain |
|--------|--------|
| NDTV | ndtv.com |
| India Today | indiatoday.in |
| Hindustan Times | hindustantimes.com |
| Times of India | timesofindia.indiatimes.com |
| Indian Express | indianexpress.com |
| The Hindu | thehindu.com |

### Search Pipeline
1. RSS feed (last 7 days) + DuckDuckGo dork (48h window) → merge + dedup by URL
2. Keyword filter (score > 0.2)
3. trafilatura extraction → fallback to RSS/DDG description
4. Batch LLM analysis (1 call per outlet)
5. Store in Supabase

**RSS limitation**: Feeds only return recent headlines (last 7 days enforced). DuckDuckGo fills the 48h gap.

---

## 16. SPLASH ANIMATION

**File**: `src/routes/__root.tsx`

On initial page load:
1. Full-screen overlay (`bg-background`, `z-[9999]`)
2. Logo (200x200px) centered
3. Logo rotates 360° over 0.6s (`splashSpin` keyframe)
4. 0.5s pause after rotation
5. Both logo and overlay fade out over 0.4s (`splashLogoFade` + `splashFadeOut` keyframes)
6. After ~1.5s total, overlay removed from DOM

**Keyframes** in `src/styles.css`:
```css
@keyframes splashSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
@keyframes splashLogoFade { from { opacity: 1; } to { opacity: 0; } }
@keyframes splashFadeOut { from { opacity: 1; } to { opacity: 0; pointer-events: none; } }
```

---

## 17. BUILD & DEV COMMANDS

```bash
# Frontend
bun run dev          # Start Vite dev server (port 8080)
bun run build        # Production build (use for verification)
bun run preview      # Preview production build

# Backend
cd backend
venv/Scripts/python.exe main.py   # Start FastAPI (port 8000)

# Verification
bun run build        # MUST exit 0 — this is the only reliable check
# bun run lint is BROKEN (6900+ CRLF errors) — do not use
```

---

## 18. KNOWN ISSUES / TODO

1. **Vite proxy broken**: Lovable preset overrides config. Frontend hardcodes `http://127.0.0.1:8000`.
2. **`bun run lint` broken**: 6900+ CRLF line ending errors. Use `bun run build` instead.
3. **RSS text extraction**: trafilatura sometimes returns None for JS-heavy sites. Now has RSS description fallback.
4. **Single snapshot per article**: FrameShift Replay only works when multiple snapshots exist for the same article. Currently only 1 snapshot per article on search.
5. **`/events/generate` endpoint**: Old LLM fabrication path, still exists but unused. Can be deprecated.
6. **Outlet authority_tier**: DB values like `tier_1`, `mass_market` are mapped to readable labels in frontend via `tierLabel` lookup.
7. **DuckDuckGo date filtering**: DDG doesn't have native date filtering — articles are post-filtered by recency from snippet text.

---

## 19. KEY FILE LINE COUNTS

| File | Lines |
|------|-------|
| `dashboard.$eventId.tsx` | 1218 |
| `nlp_pipeline.py` | 650 |
| `main.py` | 637 |
| `scraper.py` | 470 |
| `narrative-data.ts` | 182 |
| `__root.tsx` | 193 |
| `styles.css` | 162 |
| `analyze.tsx` | ~200 |
| `index.tsx` | ~150 |
| `methodology.tsx` | ~150 |

---

## 20. SHADCN/UV COMPONENTS AVAILABLE

All in `src/components/ui/`:
accordion, alert-dialog, alert, aspect-ratio, avatar, badge, breadcrumb, button, calendar, card, carousel, chart, checkbox, collapsible, command, context-menu, dialog, drawer, dropdown-menu, form, hover-card, input-otp, input, label, menubar, navigation-menu, pagination, popover, progress, radio-group, resizable, scroll-area, select, separator, sheet, sidebar, skeleton, slider, sonner, switch, table, tabs, textarea, toggle-group, toggle, tooltip

**Config**: `components.json` — style: "new-york", icon library: "lucide", RSC: false

---

## 21. RECHARTS USAGE PATTERNS

```tsx
// Bar chart (Feature 01)
<BarChart data={rows} layout="vertical">
  <CartesianGrid horizontal={false} stroke="var(--color-rule)" strokeDasharray="3 3" />
  <XAxis type="number" domain={[0, 100]} ticks={[0,20,40,60,80,100]} />
  <YAxis dataKey="outlet" type="category" />
  <Bar dataKey="official" stackId="a" fill={INK} radius={[0,3,3,0]} barSize={20} />
  <Bar dataKey="independent" stackId="a" fill={ACCENT} radius={[0,3,3,0]} barSize={20} />
</BarChart>

// Radar chart (Feature 03) — key={view} forces remount on toggle
<ResponsiveContainer key={view}>
  <RadarChart data={radarData} outerRadius="68%">
    <PolarGrid stroke="var(--color-rule)" />
    <PolarAngleAxis dataKey="outlet" tick={customTick} />
    <PolarRadiusAxis domain={[0,100]} tick={false} axisLine={false} />
    <Radar name="Emotional" dataKey="Emotional" stroke={ACCENT} fill={ACCENT} fillOpacity={0.35} strokeWidth={2} />
  </RadarChart>
</ResponsiveContainer>
```

---

## 22. FRONTEND-BACKEND CONTRACT

**POST /events/search** request:
```json
{ "query": "string", "outlets": ["NDTV", "Hindustan Times", ...] }
```
Response: `{ "event_id": "uuid" }`

**POST /analyze** request:
```json
{ "article_id": "uuid", "text": "string", "outlet_id": "uuid", "is_headline": false }
```
Response: `{ "status": "ok" }`

**GET /events/{event_id}/bundle** response: Full EventBundle JSON (mirrors frontend type exactly)

---

## 23. PYTHON DEPENDENCIES

```
fastapi>=0.115,<1.0
uvicorn[standard]>=0.30,<1.0
supabase>=2.6,<3.0
spacy>=3.7,<3.8
pydantic>=2.8,<3.0
python-dotenv>=1.0,<2.0
python-multipart>=0.0.9,<1.0
groq>=0.13.0,<1.0
feedparser>=6.0,<7.0
trafilatura>=1.6,<2.0
duckduckgo-search>=7.0,<8.0
python-dateutil>=2.9,<3.0
```

spaCy model: `en_core_web_sm` (installed in venv)

---

## 24. TYPESCRIPT CONFIG

- Target: ES2022
- JSX: react-jsx
- Module: ESNext
- Strict mode: true
- Path alias: `@/*` → `./src/*`
- Module resolution: Bundler

---

## 25. AUTH FLOW

1. User signs in at `/auth` (email + password via Supabase Auth)
2. `_authenticated/route.tsx` `beforeLoad` checks `supabase.auth.getUser()`
3. If unauthenticated → redirect to `/auth`
4. Auth state listener in `__root.tsx` invalidates queries on SIGNED_IN/SIGNED_OUT/USER_UPDATED

---

## 26. DATA SCALING SUMMARY

| Signal | Raw range | Display range | Formula |
|--------|-----------|---------------|---------|
| Agency framing | 0.0 - 1.0 | 15 - 100 | `15 + (avg * 85)` |
| Language intensity | 0 - 100 | 10 - 90 | `10 + (raw * 0.8)` |
| Source attribution | 0 - 100 | 0 - 100 | No scaling |
| Coverage matrix | boolean | ✓ / ✗ | No scaling |

---

## 27. IMPORTANT COMPONENT PATTERNS

### SectionCard wrapper
```tsx
function SectionCard({ n, title, caption, tip, children }) {
  return (
    <section className="paper-card p-6">
      <div className="flex items-baseline justify-between gap-4 border-b border-rule pb-3">
        <div>
          <p className="font-mono text-[10px] text-ink-muted">{n}</p>
          <h2 className="headline mt-1 flex items-center gap-2 text-2xl">
            {title}
            {tip ? <UITooltip>...</UITooltip> : null}
          </h2>
        </div>
      </div>
      <p className="mt-3 text-sm text-ink-muted">{caption}</p>
      <div className="mt-6">{children}</div>
    </section>
  );
}
```

### Outlet tier label mapping
```tsx
const tierLabel: Record<string, string> = {
  tier_1: "legacy", tier_2: "established", tier_3: "digital",
  mass_market: "mass", business: "business", regional: "regional",
};
```

### Stakeholder name normalization
```tsx
// Title-case while preserving acronyms (ALL CAPS 2+ chars)
s.name.replace(/\b\w+/g, (w) => {
  if (w === w.toUpperCase() && w.length >= 2) return w;
  return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
})
```

---

END OF HANDOFF DOCUMENT
