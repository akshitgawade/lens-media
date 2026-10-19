# CONTINUATION FILE — Next Session Start Here

## What Was Built (this session)
- `backend/scraper.py` — RSS feed parser + full-text extraction + relevance matching
- `POST /events/search` endpoint in `main.py` — searches real outlets via RSS, extracts text, analyzes, stores in Supabase
- Frontend `analyze.tsx` updated to call `/events/search` instead of `/events/generate`
- Installed `feedparser` + `trafilatura` in venv

## Immediate Next Steps

### 1. Test the RSS pipeline
```bash
cd backend
.\venv\Scripts\activate
python -c "from scraper import search_all_outlets; results = search_all_outlets('Supreme Court electoral rolls', use_llm=False); print(len(results), 'articles found'); [print(f'  {a[\"outlet_name\"]}: {a[\"headline\"][:60]}') for a in results]"
```
If this works, you have real articles. If not, debug the RSS feeds.

### 2. Test the full endpoint
```bash
curl -X POST http://127.0.0.1:8000/events/search -H "Content-Type: application/json" -d '{"query": "Digital privacy laws in India"}'
```
Returns `{"event_id": "..."}` if articles found.

### 3. Update the Supabase schema
The outlets table needs an `rss_url` column. Run in Supabase SQL editor:
```sql
ALTER TABLE public.outlets ADD COLUMN IF NOT EXISTS rss_url text;
```

### 4. Add outlet selector UI to analyze.tsx
The analyze page needs a multi-select for 7 outlets. Import `OUTLETS` from `scraper.py` via a new `/outlets` GET endpoint, or hardcode in the frontend for now.

### 5. Seed the outlets table
Insert the 7 reliable outlets:
```sql
INSERT INTO public.outlets (name, url, authority_tier, rss_url) VALUES
  ('The Wire', 'https://thewire.in', 'digital', 'https://thewire.in/feed'),
  ('Scroll.in', 'https://scroll.in', 'digital', 'https://scroll.in/rss/all'),
  ('The Print', 'https://theprint.in', 'digital', 'https://theprint.in/feed/'),
  ('Firstpost', 'https://firstpost.com', 'digital', 'https://www.firstpost.com/feed/'),
  ('Outlook', 'https://outlookindia.com', 'magazine', 'https://www.outlookindia.com/rss.xml'),
  ('Frontline', 'https://frontline.thehindu.com', 'magazine', 'https://frontline.thehindu.com/section/frontend/feed'),
  ('The Tribune', 'https://tribuneindia.com', 'regional', 'https://www.tribuneindia.com/feeds')
ON CONFLICT DO NOTHING;
```

## Remaining Work (estimated 4-6 hours)
1. Outlet selector UI on analyze page (2-3 hours React)
2. Handle cases where <4 articles found (show partial results)
3. Remove `/events/generate` endpoint (old LLM fabrication)
4. Remove `generate_event_coverage()` from nlp_pipeline.py
5. Test RSS feeds are actually accessible from this network
6. Build coverage matrix from real entity mentions (already in /events/search)
7. Verify headline snapshots work with real data

## Key Files
- `backend/scraper.py` — RSS + extraction (just created)
- `backend/main.py` — now has both `/events/generate` (old) and `/events/search` (new)
- `backend/nlp_pipeline.py` — still has `generate_event_coverage()` (remove later)
- `src/routes/analyze.tsx` — now calls `/events/search`
- `docs/ALGORITHMS.txt` — all algorithms documented
- `docs/CONTINUATION.md` — this file

## Architecture After This Change
```
User query
    ↓
POST /events/search
    ↓
scraper.py: RSS feeds → keyword match → trafilatura extract → Groq relevance
    ↓
main.py: Store in Supabase (events, articles, stakeholders, coverage_matrix)
    ↓
nlp_pipeline.py: Analyze real text (Groq or spaCy fallback)
    ↓
Dashboard: fetchEventBundle() reads from Supabase (unchanged)
```
