# Narrative Lens — Backend Creation Plan

## What This Document Is

A complete, actionable backend plan for Narrative Lens. It covers everything: what already exists, what's broken, what needs to be built, exactly what **you** (the user) need to do on your side, and a model recommendation for the AI-powered analysis pipeline.

---

## Current State: What Exists Today

### Frontend (Working ✅)
The React/TanStack Start frontend is fully functional. The dashboard at [`dashboard.$eventId.tsx`](file:///c:/Users/Nilima/Desktop/lens-media/src/routes/_authenticated/dashboard.$eventId.tsx) renders 6 signal panels from an `EventBundle` object. It calls [`fetchEventBundle()`](file:///c:/Users/Nilima/Desktop/lens-media/src/lib/narrative-data.ts#L81) which makes **direct Supabase client calls** (anon key, no backend).

### Database (Working ✅)
Supabase PostgreSQL with 9 tables, RLS enabled, public SELECT policies:

| Table | Purpose |
|-------|---------|
| `events` | News events (title, summary, first_reported_at) |
| `outlets` | Media outlets (name, url, authority_tier) |
| `articles` | One per outlet per event (headline, full_text, published_at) |
| `headline_snapshots` | Wayback/live headline captures over time |
| `stakeholders` | People/orgs involved in an event |
| `signals_source_attribution` | Official vs independent source ratios |
| `signals_agency_framing` | Agency score + example phrases (jsonb) |
| `signals_language_intensity` | Emotional, certainty, urgency scores |
| `coverage_matrix` | Which stakeholders appear in which articles |

### Backend Skeleton (Partially Built ⚠️)
A FastAPI app exists at [`backend/main.py`](file:///c:/Users/Nilima/Desktop/lens-media/backend/main.py) with:
- ✅ `POST /analyze` — accepts article text, runs NLP, writes signals to Supabase
- ✅ `GET /health` — health check
- ✅ [`nlp_pipeline.py`](file:///c:/Users/Nilima/Desktop/lens-media/backend/nlp_pipeline.py) — spaCy-based NER, agency framing, language intensity
- ✅ Dockerfile, requirements.txt
- ❌ **No `GET /events/{id}/bundle` endpoint** — the read path doesn't exist
- ❌ **No Pydantic models** matching the frontend's `EventBundle` type
- ❌ **`BACKEND_URL` not set** — the Edge Function proxy is dead
- ❌ **NLP is keyword-only** — no LLM intelligence, just word-list matching

### Edge Function (Dead ⚠️)
[`supabase/functions/analyze-article/index.ts`](file:///c:/Users/Nilima/Desktop/lens-media/supabase/functions/analyze-article/index.ts) — a Deno proxy that forwards `POST /analyze` to FastAPI. Currently broken because `BACKEND_URL` env var is not set in the Supabase dashboard.

### Hardcoded Credentials (Security Issue 🔴)
[`narrative-data.ts:155-157`](file:///c:/Users/Nilima/Desktop/lens-media/src/lib/narrative-data.ts#L155-L157) has the Supabase URL and anon key hardcoded for the `analyzeArticle()` function. Should use env vars.

---

## What Needs To Be Built

### Phase 1: Read API (GET /events/{id}/bundle)

> [!IMPORTANT]
> Per AGENTS.md safety rules, the dashboard must NEVER be auto-wired to the new backend. A new `fetchEventBundleFromApi()` function is added in parallel, and switching is a manual human step.

#### 1A. Create Pydantic Models

**New file: `backend/models.py`**

Create typed models that exactly match the frontend's `EventBundle` TypeScript types:

```python
class OutletOut(BaseModel):
    id: str
    name: str
    url: str
    authority_tier: str

class EventOut(BaseModel):
    id: str
    title: str
    summary: str
    first_reported_at: str  # ISO timestamp string

class ArticleOut(BaseModel):
    id: str
    event_id: str
    outlet_id: str
    url: str
    headline: str
    published_at: str
    full_text: str

class HeadlineSnapshotOut(BaseModel):
    id: str
    article_id: str
    headline_text: str
    captured_at: str
    source: str  # "wayback" | "live"

class StakeholderOut(BaseModel):
    id: str
    event_id: str
    name: str
    role: str
    first_appeared_at: str | None

class PhraseOut(BaseModel):
    text: str
    type: str  # "active" | "passive" | "agentless"

class SourceAttributionOut(BaseModel):
    article_id: str
    official_ratio: float
    independent_ratio: float

class AgencyFramingOut(BaseModel):
    article_id: str
    agency_score: float  # MUST be numeric, not string
    example_phrases: list[PhraseOut]

class LanguageIntensityOut(BaseModel):
    article_id: str
    emotional_score: float
    certainty_score: float
    urgency_score: float

class CoverageMatrixOut(BaseModel):
    article_id: str
    stakeholder_id: str
    present: bool

class SignalsBundleOut(BaseModel):
    source_attribution: list[SourceAttributionOut]
    agency_framing: list[AgencyFramingOut]
    language_intensity: list[LanguageIntensityOut]
    coverage_matrix: list[CoverageMatrixOut]

class EventBundleOut(BaseModel):
    event: EventOut
    outlets: list[OutletOut]
    articles: list[ArticleOut]
    snapshots: list[HeadlineSnapshotOut]
    stakeholders: list[StakeholderOut]
    signals: SignalsBundleOut
```

#### 1B. Add GET Endpoint to FastAPI

**Edit: `backend/main.py`**

```python
@app.get("/events/{event_id}/bundle", response_model=EventBundleOut)
def get_event_bundle(event_id: str):
    client = get_supabase_client()
    
    # 1. Fetch event
    event = client.table("events").select("*").eq("id", event_id).maybe_single().execute()
    if not event.data:
        raise HTTPException(404, "Event not found")
    
    # 2. Fetch articles (sorted by published_at)
    articles = client.table("articles").select("*").eq("event_id", event_id).order("published_at").execute()
    article_ids = [a["id"] for a in (articles.data or [])]
    
    # 3. Handle empty articles
    if not article_ids:
        return EventBundleOut(
            event=event.data, outlets=[], articles=[], snapshots=[],
            stakeholders=client.table("stakeholders").select("*").eq("event_id", event_id).execute().data or [],
            signals=SignalsBundleOut(source_attribution=[], agency_framing=[], language_intensity=[], coverage_matrix=[])
        )
    
    # 4. Fetch related data
    outlet_ids = list({a["outlet_id"] for a in articles.data})
    outlets = client.table("outlets").select("*").in_("id", outlet_ids).execute()
    snapshots = client.table("headline_snapshots").select("*").in_("article_id", article_ids).order("captured_at").execute()
    stakeholders = client.table("stakeholders").select("*").eq("event_id", event_id).order("first_appeared_at").execute()
    
    # 5. Fetch all 4 signal tables
    ssa = client.table("signals_source_attribution").select("*").in_("article_id", article_ids).execute()
    saf = client.table("signals_agency_framing").select("*").in_("article_id", article_ids).execute()
    sli = client.table("signals_language_intensity").select("*").in_("article_id", article_ids).execute()
    cov = client.table("coverage_matrix").select("*").in_("article_id", article_ids).execute()
    
    # 6. Normalize agency_framing example_phrases
    agency_rows = []
    for row in (saf.data or []):
        phrases = row.get("example_phrases", [])
        if isinstance(phrases, str):
            import json
            phrases = json.loads(phrases)
        normalized = [{"text": p, "type": "active"} if isinstance(p, str) else p for p in phrases]
        agency_rows.append({**row, "agency_score": float(row["agency_score"]), "example_phrases": normalized})
    
    return EventBundleOut(
        event=event.data,
        outlets=outlets.data or [],
        articles=articles.data or [],
        snapshots=snapshots.data or [],
        stakeholders=stakeholders.data or [],
        signals=SignalsBundleOut(
            source_attribution=ssa.data or [],
            agency_framing=agency_rows,
            language_intensity=sli.data or [],
            coverage_matrix=cov.data or [],
        ),
    )
```

#### 1C. Add Frontend Parallel Function

**Edit: `src/lib/narrative-data.ts`** — add but DO NOT wire:

```typescript
export async function fetchEventBundleFromApi(eventId: string): Promise<EventBundle> {
  const response = await fetch(`/api/events/${eventId}/bundle`);
  if (!response.ok) throw new Error(`API error: ${response.status}`);
  return response.json();
}
```

#### 1D. Add Vite Dev Proxy

**Edit: `vite.config.ts`** — proxy `/api/*` to FastAPI during development:

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

---

### Phase 2: AI-Powered Analysis (Replace spaCy with Gemini)

> [!TIP]
> **Recommended Model: Gemini 2.5 Flash** (`gemini-2.5-flash-preview-05-20`)
>
> Why Flash over Pro:
> - Each analysis call processes ~200-500 words of article text — not a complex reasoning task
> - You need speed (sub-2s per article) and low cost for batch analysis
> - Flash excels at structured output extraction, which is exactly what you need
> - At $0.15/1M input tokens, analyzing 100 articles costs ~$0.01
> - Supports JSON mode natively — perfect for returning typed signal objects

#### 2A. What the AI Should Do

Replace the keyword-matching in [`nlp_pipeline.py`](file:///c:/Users/Nilima/Desktop/lens-media/backend/nlp_pipeline.py) with Gemini calls that produce **the same output shape** but with real intelligence:

| Signal | Current (spaCy) | Target (Gemini) |
|--------|-----------------|-----------------|
| **Source Attribution** | Counts entities matching keyword lists ("police" → official) | Actually identifies quoted sources, classifies them by role |
| **Agency Framing** | Regex passive voice detection + POS tags | Understands semantic agency — who acts vs who is acted upon |
| **Language Intensity** | Counts emotional/certainty/urgency keywords | Contextual scoring — "confirmed dead" vs "confirmed safe" treated differently |
| **Coverage Matrix** | Not implemented in NLP pipeline | Given stakeholder list, determines which are actually discussed per article |

#### 2B. New NLP Pipeline Structure

**Replace: `backend/nlp_pipeline.py`** with a Gemini-backed version:

```python
from google import genai

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

ANALYSIS_PROMPT = """
Analyze this news article and return a JSON object with these exact fields:

1. source_attribution: { official_ratio: float 0-1, independent_ratio: float 0-1 }
   - "official" = government, courts, police, institutional spokespeople
   - "independent" = citizens, activists, NGOs, witnesses, experts not affiliated with power

2. agency_framing: { agency_score: int 0-100, example_phrases: [{ text: str, type: "active"|"passive"|"agentless" }] }
   - agency_score: 100 = all subjects act, 0 = all subjects are acted upon
   - Include up to 3 example phrases showing the framing pattern

3. language_intensity: { emotional_score: float 0-1, certainty_score: float 0-1, urgency_score: float 0-1 }
   - Score each dimension based on the language used, not the topic itself

Article text:
{text}
"""

async def analyze_with_gemini(text: str) -> dict:
    response = client.models.generate_content(
        model="gemini-2.5-flash-preview-05-20",
        contents=ANALYSIS_PROMPT.format(text=text),
        config=genai.types.GenerateContentConfig(
            response_mime_type="application/json",
        ),
    )
    return json.loads(response.text)
```

#### 2C. Coverage Matrix Generation

Add a second Gemini call for coverage matrix (needs stakeholder list as context):

```python
COVERAGE_PROMPT = """
Given these stakeholders: {stakeholders}

For each stakeholder, determine if they are meaningfully discussed, quoted, or 
referenced in this article. Return a JSON array:
[{ "stakeholder_name": str, "present": bool }]

Article text:
{text}
"""
```

---

### Phase 3: Edge Function + Production Wiring

#### 3A. Set BACKEND_URL in Supabase Dashboard

Go to **Supabase Dashboard → Edge Functions → analyze-article → Secrets** and set:
```
BACKEND_URL=https://your-fastapi-host.com
```

#### 3B. Fix Hardcoded Credentials

Replace the hardcoded URL/key in [`narrative-data.ts:155-157`](file:///c:/Users/Nilima/Desktop/lens-media/src/lib/narrative-data.ts#L155-L157) with environment variables:

```typescript
const ANALYZE_SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const ANALYZE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
```

---

## User-Side Requirements Checklist

> [!IMPORTANT]
> These are things **you** need to do — I cannot do them from here.

### Environment & API Keys

| # | Task | Where | Notes |
|---|------|-------|-------|
| 1 | **Get a Gemini API key** | [Google AI Studio](https://aistudio.google.com/apikey) | Free tier gives 15 RPM for Flash |
| 2 | **Get Supabase Service Role Key** | Supabase Dashboard → Settings → API → `service_role` key | ⚠️ Never expose client-side |
| 3 | **Create `backend/.env`** | Local file | See template below |
| 4 | **Set BACKEND_URL secret** | Supabase Dashboard → Edge Functions → Secrets | Only needed for production |

**`backend/.env` template:**
```env
PORT=8000
SUPABASE_URL=https://lnycmvscjimmdritmoul.supabase.co
SUPABASE_SERVICE_KEY=<your-service-role-key>
GEMINI_API_KEY=<your-gemini-api-key>
```

### Python Environment Setup

```bash
cd backend
python -m venv venv
venv\Scripts\activate          # Windows
pip install -r requirements.txt
pip install google-genai        # Add Gemini SDK
python -m spacy download en_core_web_sm  # Keep as fallback
```

### Deployment Decision

| Option | Pros | Cons |
|--------|------|------|
| **Railway** | $5/mo, one-click Docker deploy, free SSL | Cold starts on hobby |
| **Render** | Free tier available, Docker support | 50s cold starts on free |
| **Google Cloud Run** | Pay-per-request, auto-scales to zero | Needs `gcloud` CLI setup |
| **Self-host (VPS)** | Full control, always warm | You manage uptime |

> [!TIP]
> For a demo/hackathon: **Railway** is the fastest path. Push the `backend/` folder, set env vars, done.

### Manual Wiring Step (Phase 3 — Human Approval Required)

Once the backend is verified working:

1. In [`dashboard.$eventId.tsx`](file:///c:/Users/Nilima/Desktop/lens-media/src/routes/_authenticated/dashboard.$eventId.tsx#L52), change:
   ```typescript
   // FROM:
   queryFn: () => fetchEventBundle(eventId),
   // TO:
   queryFn: () => fetchEventBundleFromApi(eventId),
   ```
2. Test thoroughly, then commit.

---

## Verification Plan

### Automated (I will run these)
- `python -c "from models import EventBundleOut"` — models import cleanly
- `curl localhost:8000/health` — backend alive
- `curl localhost:8000/events/{id}/bundle` — returns correct JSON shape
- `bun run build` — frontend builds without errors
- Compare `fetchEventBundle()` vs `fetchEventBundleFromApi()` output for same event ID

### Manual (You verify)
- Dashboard renders identically with both data sources
- "Re-analyze" button triggers Gemini analysis and signals update in Supabase
- All 6 signal panels show correct data after re-analysis
- Login/auth still works
- No regressions on headline diff, coverage matrix, timeline

---

## Open Questions

> [!WARNING]
> These affect the implementation — please answer before I start coding.

1. **Where will you host the FastAPI backend?** (Railway / Render / Cloud Run / other?) — This determines how the Vite proxy and Edge Function are configured.

2. **Do you want Gemini analysis to run automatically when an article is added, or only when the user clicks "Re-analyze"?** Currently it's manual-only. Auto-analysis would need a database trigger or webhook.

3. **Do you want to keep spaCy as a fallback?** If Gemini is unavailable (rate limit, key issue), should the system fall back to keyword matching, or just error?

4. **Budget for Gemini API calls?** Flash is cheap ($0.15/1M input), but if you plan to analyze thousands of articles, we should add rate limiting and caching.

5. **Should the backend also handle article ingestion?** Right now articles are manually seeded via SQL. A future `POST /events` + `POST /articles` endpoint would let you add events through the UI. Want this in scope?
