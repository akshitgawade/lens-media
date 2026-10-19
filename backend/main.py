from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Any

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from supabase import create_client, Client

from nlp_pipeline import (
    analyze_source_attribution,
    analyze_text_with_llm,
    detect_agency_framing,
    extract_entities,
    score_language_intensity,
    extract_stakeholders_with_llm,
    analyze_outlet_batch,
)
from models import EventBundleOut, EventOut, OutletOut, ArticleOut, HeadlineSnapshotOut, StakeholderOut, SignalsBundleOut, SourceAttributionOut, AgencyFramingOut, LanguageIntensityOut, CoverageMatrixOut, PhraseOut

class AnalyzeRequest(BaseModel):
    article_id: str
    text: str
    outlet_id: str
    is_headline: bool = False


class AnalyzeResponse(BaseModel):
    success: bool
    article_id: str
    signals: dict[str, Any]


SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")

app = FastAPI(title="Narrative Lens Backend", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=600,
)

_supabase_client: Client | None = None


def get_supabase_client() -> Client:
    global _supabase_client
    if _supabase_client is None:
        if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
            raise RuntimeError(
                "SUPABASE_URL and SUPABASE_SERVICE_KEY must be set before using the backend.",
            )
        _supabase_client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    return _supabase_client


def _extraction_quality(text: str, headline: str = "") -> str:
    body_length = len((text or "").strip())
    headline_length = len((headline or "").strip())
    if body_length == 0:
        return "failed"
    if headline_length and body_length <= headline_length + 40:
        return "headline_only"
    if body_length < 500:
        return "partial"
    return "full"


def _source_attribution_from_entities(text: str) -> dict[str, Any]:
    """Compatibility wrapper for callers that used the old entity counter."""
    return analyze_source_attribution(text)


def _optional_score(value: Any) -> float | None:
    try:
        if value is None or isinstance(value, bool):
            return None
        number = float(value)
        if number != number:
            return None
        return max(0.0, min(1.0, number))
    except (TypeError, ValueError):
        return None


def _valid_llm_phrase(phrase: Any, source_text: str) -> dict[str, str] | None:
    if not isinstance(phrase, dict):
        return None
    phrase_text = str(phrase.get("text", "")).strip()
    phrase_type = phrase.get("type")
    if not phrase_text or phrase_type not in {"active", "passive", "agentless"}:
        return None
    if phrase_text.casefold() not in source_text.casefold():
        return None
    return {"text": phrase_text, "type": phrase_type}


def _normalise_llm_signals(raw: Any, source_text: str) -> dict[str, Any] | None:
    if not isinstance(raw, dict):
        return None
    source = raw.get("source_attribution")
    agency = raw.get("agency_framing")
    intensity = raw.get("language_intensity")
    if not isinstance(source, dict) or not isinstance(agency, dict) or not isinstance(intensity, dict):
        return None

    official = _optional_score(source.get("official_ratio"))
    independent = _optional_score(source.get("independent_ratio"))
    source_evidence = source.get("evidence_count")
    try:
        source_evidence = max(0, int(source_evidence))
    except (TypeError, ValueError):
        source_evidence = 0
    if official is not None and independent is not None and official + independent > 0:
        total = official + independent
        source_result: dict[str, Any] = {
            "official_ratio": round(official / total, 4),
            "independent_ratio": round(independent / total, 4),
            "evidence_count": source_evidence,
            "analysis_status": "analyzed" if source_evidence > 0 else "no_evidence",
        }
    else:
        source_result = {"official_ratio": None, "independent_ratio": None, "evidence_count": 0, "analysis_status": "no_evidence"}

    agency_score = _optional_score(agency.get("agency_score"))
    raw_phrases = agency.get("example_phrases")
    phrases = []
    if isinstance(raw_phrases, list):
        for phrase in raw_phrases:
            valid = _valid_llm_phrase(phrase, source_text)
            if valid and valid not in phrases:
                phrases.append(valid)
    agency_result = {
        "agency_score": agency_score,
        "example_phrases": phrases[:3],
        "evidence_count": len(phrases),
        "analysis_status": "analyzed" if agency_score is not None else "no_evidence",
    }

    intensity_result: dict[str, Any] = {}
    for key in ("emotional_score", "certainty_score", "urgency_score"):
        intensity_result[key] = _optional_score(intensity.get(key))
    intensity_result["evidence_count"] = sum(value is not None for value in intensity_result.values())
    intensity_result["analysis_status"] = "analyzed" if intensity_result["evidence_count"] else "no_evidence"
    return {
        "source_attribution": source_result,
        "agency_framing": agency_result,
        "language_intensity": intensity_result,
    }


def _blend(a: float | None, b: float | None, b_weight: float = 0.35) -> float | None:
    if a is None:
        return b
    if b is None:
        return a
    return round((a * (1.0 - b_weight)) + (b * b_weight), 4)


def _build_signal_data(text: str, headline: str = "", llm_signals: Any = None, is_headline: bool = False) -> dict[str, Any]:
    """Compute deterministic evidence first, then cautiously blend LLM nuance."""
    deterministic = {
        "source_attribution": analyze_source_attribution(text),
        "agency_framing": detect_agency_framing(text, is_headline=is_headline),
        "language_intensity": score_language_intensity("" if is_headline else text, headline=headline or (text if is_headline else "")),
    }
    llm = _normalise_llm_signals(llm_signals, text) if llm_signals else None
    if not llm:
        for signal in deterministic.values():
            signal["analysis_method"] = "deterministic"
        return deterministic

    source_det = deterministic["source_attribution"]
    source_llm = llm["source_attribution"]
    # LLM source ratios are only eligible when it explicitly found evidence;
    # this prevents a confident-looking guess from filling an empty graph.
    if source_llm.get("evidence_count", 0) > 0:
        if source_det.get("evidence_count", 0) > 0:
            total_official = _blend(source_det.get("official_ratio"), source_llm.get("official_ratio"))
            total_independent = _blend(source_det.get("independent_ratio"), source_llm.get("independent_ratio"))
            total = (total_official or 0) + (total_independent or 0)
            if total > 0:
                source_det["official_ratio"] = round((total_official or 0) / total, 4)
                source_det["independent_ratio"] = round((total_independent or 0) / total, 4)
                source_det["analysis_method"] = "hybrid"
        else:
            deterministic["source_attribution"] = {**source_llm, "analysis_method": "llm"}

    agency_det = deterministic["agency_framing"]
    agency_llm = llm["agency_framing"]
    agency_det["agency_score"] = _blend(agency_det.get("agency_score"), agency_llm.get("agency_score"))
    combined_phrases = list(agency_det.get("example_phrases", []))
    for phrase in agency_llm.get("example_phrases", []):
        if phrase not in combined_phrases:
            combined_phrases.append(phrase)
    agency_det["example_phrases"] = combined_phrases[:3]
    agency_det["evidence_count"] = max(agency_det.get("evidence_count", 0), agency_llm.get("evidence_count", 0))
    agency_det["analysis_status"] = "analyzed" if agency_det.get("agency_score") is not None else "no_evidence"
    agency_det["analysis_method"] = "hybrid" if agency_llm.get("agency_score") is not None else "deterministic"

    intensity_det = deterministic["language_intensity"]
    intensity_llm = llm["language_intensity"]
    for key in ("emotional_score", "certainty_score", "urgency_score"):
        intensity_det[key] = _blend(intensity_det.get(key), intensity_llm.get(key))
    intensity_det["evidence_count"] = sum(value is not None for key, value in intensity_det.items() if key.endswith("_score"))
    intensity_det["analysis_status"] = "analyzed" if intensity_det["evidence_count"] else "no_evidence"
    intensity_det["analysis_method"] = "hybrid"
    return deterministic


def _write_signals(article_id: str, signals: dict[str, Any]) -> None:
    client = get_supabase_client()
    source_payload = {
        "article_id": article_id,
        "official_ratio": signals["source_attribution"]["official_ratio"],
        "independent_ratio": signals["source_attribution"]["independent_ratio"],
        "evidence_count": signals["source_attribution"].get("evidence_count", 0),
        "analysis_status": signals["source_attribution"].get("analysis_status", "analyzed"),
        "analysis_method": signals["source_attribution"].get("analysis_method", "deterministic"),
    }
    agency_payload = {
        "article_id": article_id,
        "agency_score": signals["agency_framing"]["agency_score"],
        "example_phrases": signals["agency_framing"]["example_phrases"],
        "evidence_count": signals["agency_framing"].get("evidence_count", 0),
        "analysis_status": signals["agency_framing"].get("analysis_status", "analyzed"),
        "analysis_method": signals["agency_framing"].get("analysis_method", "deterministic"),
    }
    intensity_payload = {
        "article_id": article_id,
        "emotional_score": signals["language_intensity"]["emotional_score"],
        "certainty_score": signals["language_intensity"]["certainty_score"],
        "urgency_score": signals["language_intensity"]["urgency_score"],
        "evidence_count": signals["language_intensity"].get("evidence_count", 0),
        "analysis_status": signals["language_intensity"].get("analysis_status", "analyzed"),
        "analysis_method": signals["language_intensity"].get("analysis_method", "deterministic"),
    }

    for table_name, payload in [
        ("signals_source_attribution", source_payload),
        ("signals_agency_framing", agency_payload),
        ("signals_language_intensity", intensity_payload),
    ]:
        response = client.table(table_name).upsert(payload, on_conflict="article_id").execute()
        if getattr(response, "error", None):
            raise RuntimeError(f"Failed to write {table_name}: {response.error}")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/events/{event_id}/bundle", response_model=EventBundleOut)
def get_event_bundle(event_id: str) -> EventBundleOut:
    client = get_supabase_client()
    
    # 1. Fetch event
    event = client.table("events").select("*").eq("id", event_id).maybe_single().execute()
    if not event or not event.data:
        raise HTTPException(404, "Event not found")
    
    # 2. Fetch articles (sorted by published_at)
    articles = client.table("articles").select("*").eq("event_id", event_id).order("published_at").execute()
    article_ids = [a["id"] for a in (articles.data or [])]
    
    # 3. Handle empty articles
    if not article_ids:
        stakeholders = client.table("stakeholders").select("*").eq("event_id", event_id).order("first_appeared_at").execute()
        return EventBundleOut(
            event=event.data,
            outlets=[],
            articles=[],
            snapshots=[],
            stakeholders=stakeholders.data or [],
            signals=SignalsBundleOut(
                source_attribution=[],
                agency_framing=[],
                language_intensity=[],
                coverage_matrix=[]
            )
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
        normalized = []
        for p in phrases:
            if isinstance(p, str):
                normalized.append({"text": p, "type": "active"})
            elif isinstance(p, dict):
                normalized.append({"text": p.get("text", ""), "type": p.get("type", "active")})
        agency_rows.append({
            "article_id": row["article_id"],
            "agency_score": float(row["agency_score"]) if row.get("agency_score") is not None else None,
            "example_phrases": normalized,
            "evidence_count": row.get("evidence_count", 0),
            "analysis_status": row.get("analysis_status", "unknown"),
            "analysis_method": row.get("analysis_method", "unknown"),
        })
    
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


class GenerateEventRequest(BaseModel):
    query: str


@app.post("/analyze", response_model=AnalyzeResponse)
def analyze(payload: AnalyzeRequest) -> AnalyzeResponse:
    llm_signals = analyze_text_with_llm(payload.text, is_headline=payload.is_headline)
    signals = _build_signal_data(
        payload.text,
        headline=payload.text if payload.is_headline else "",
        llm_signals=llm_signals,
        is_headline=payload.is_headline,
    )
    _write_signals(payload.article_id, signals)
    client = get_supabase_client()
    client.table("articles").update({"extraction_quality": _extraction_quality(payload.text)}).eq("id", payload.article_id).execute()
    return AnalyzeResponse(success=True, article_id=payload.article_id, signals=signals)


@app.post("/events/generate")
def generate_event(payload: GenerateEventRequest) -> dict[str, str]:
    from nlp_pipeline import generate_event_coverage
    
    # 1. Generate core coverage structure via Gemini
    gen_data = generate_event_coverage(payload.query)
    if not gen_data:
        raise HTTPException(
            status_code=503,
            detail="LLM API quota exhausted or unavailable. Free tier allows ~14,400 requests/day. "
                   "Check your Groq API key or wait for quota to reset."
        )
        
    client = get_supabase_client()
    
    # 2. Map existing outlets (or insert them if missing)
    outlets_data = client.table("outlets").select("id,name").execute().data or []
    outlet_name_to_id = {o["name"]: o["id"] for o in outlets_data}
    
    # 3. Create Event
    event_payload = {
        "title": gen_data["event"]["title"],
        "summary": gen_data["event"]["summary"],
        "first_reported_at": gen_data["event"]["first_reported_at"]
    }
    event_res = client.table("events").insert(event_payload).execute()
    if not event_res.data:
        raise HTTPException(500, "Failed to create event in Supabase")
    event_id = event_res.data[0]["id"]
    
    # 4. Create Articles
    articles_payload = []
    for art in gen_data["articles"]:
        o_name = art["outlet_name"]
        o_id = outlet_name_to_id.get(o_name)
        if not o_id:
            # Fallback: create outlet
            o_res = client.table("outlets").insert({
                "name": o_name,
                "url": f"https://www.{o_name.lower().replace(' ', '').replace('.', '')}.com",
                "authority_tier": "tier_2"
            }).execute()
            o_id = o_res.data[0]["id"]
            outlet_name_to_id[o_name] = o_id
            
        articles_payload.append({
            "event_id": event_id,
            "outlet_id": o_id,
            "url": art["url"],
            "headline": art["headline"],
            "published_at": art["published_at"],
            "full_text": art["full_text"],
            "extraction_quality": _extraction_quality(art["full_text"], art["headline"]),
        })
    articles_res = client.table("articles").insert(articles_payload).execute()
    if not articles_res.data:
        raise HTTPException(500, "Failed to create articles in Supabase")
        
    outlet_id_to_article_id = {a["outlet_id"]: a["id"] for a in articles_res.data}
    
    # 5. Create Headline Snapshots
    snapshots_payload = []
    for snap in gen_data.get("snapshots", []):
        o_id = outlet_name_to_id.get(snap["outlet_name"])
        art_id = outlet_id_to_article_id.get(o_id)
        if art_id:
            snapshots_payload.append({
                "article_id": art_id,
                "headline_text": snap["headline_text"],
                "captured_at": snap["captured_at"],
                "source": snap["source"]
            })
    if snapshots_payload:
        client.table("headline_snapshots").insert(snapshots_payload).execute()
        
    # 6. Create Stakeholders
    stakeholders_payload = []
    for s in gen_data.get("stakeholders", []):
        stakeholders_payload.append({
            "event_id": event_id,
            "name": s["name"],
            "role": s["role"],
            "first_appeared_at": s.get("first_appeared_at")
        })
    stakeholders_res = client.table("stakeholders").insert(stakeholders_payload).execute()
    if not stakeholders_res.data:
         raise HTTPException(500, "Failed to create stakeholders in Supabase")
         
    stakeholder_name_to_id = {st["name"]: st["id"] for st in stakeholders_res.data}
    
    # 7. Create Coverage Matrix
    coverage_payload = []
    for cov in gen_data.get("coverage_matrix", []):
        o_id = outlet_name_to_id.get(cov["outlet_name"])
        art_id = outlet_id_to_article_id.get(o_id)
        st_id = stakeholder_name_to_id.get(cov["stakeholder_name"])
        if art_id and st_id:
            coverage_payload.append({
                "article_id": art_id,
                "stakeholder_id": st_id,
                "present": cov["present"]
            })
    if coverage_payload:
        client.table("coverage_matrix").insert(coverage_payload).execute()
        
    # 8. Analyze each article's text to generate NLP signals
    for art in articles_res.data:
        signals_data = _build_signal_data(
            art["full_text"],
            headline=art.get("headline", ""),
            llm_signals=analyze_text_with_llm(art["full_text"], is_headline=False),
        )
        _write_signals(art["id"], signals_data)
        client.table("articles").update({"extraction_quality": _extraction_quality(art.get("full_text", ""), art.get("headline", ""))}).eq("id", art["id"]).execute()
        
    return {"event_id": event_id}


# ── Real Article Search (RSS-based) ──────────────────────────────────────────

class SearchRequest(BaseModel):
    query: str
    outlets: list[str] | None = None  # None = all outlets


@app.post("/events/search")
def search_real_articles(payload: SearchRequest) -> dict[str, str]:
    """Search real news outlets via RSS, extract text, analyze, store in DB.
    
    Optimized pipeline:
    1. RSS feeds fetched for each outlet (keyword filter only, no LLM)
    2. Full text extracted via trafilatura
    3. Articles batched by outlet → 1 LLM call per outlet for relevance + signals + stakeholders
    4. Event + articles + signals inserted into Supabase
    5. Returns event_id for dashboard
    
    LLM calls: ~6 (one per outlet) instead of ~25 (per-article relevance + analysis + stakeholder)
    """
    from scraper import search_all_outlets, OUTLETS
    from nlp_pipeline import extract_entities, detect_agency_framing, score_language_intensity, analyze_outlet_batch

    client = get_supabase_client()

    # 1. Search real outlets (keyword filter + text extraction, no per-article LLM)
    articles = search_all_outlets(
        query=payload.query,
        selected_outlets=payload.outlets,
        max_per_outlet=2,
    )

    if not articles:
        raise HTTPException(
            status_code=404,
            detail=f"No articles found for '{payload.query}'. Try different outlets or a broader query."
        )

    print(f"[SEARCH] {len(articles)} articles from {len({a['outlet_name'] for a in articles})} outlets")

    # 2. Create event
    event_payload = {
        "title": payload.query.title(),
        "summary": f"Coverage analysis of: {payload.query}",
        "first_reported_at": articles[0].get("published_at", datetime.now(timezone.utc).isoformat()),
    }
    event_res = client.table("events").insert(event_payload).execute()
    if not event_res.data:
        raise HTTPException(500, "Failed to create event in Supabase")
    event_id = event_res.data[0]["id"]

    # 3. Map outlets (create if missing)
    outlets_data = client.table("outlets").select("id,name").execute().data or []
    outlet_name_to_id = {o["name"]: o["id"] for o in outlets_data}

    # 4. Insert articles
    articles_payload = []
    for art in articles:
        o_name = art["outlet_name"]
        o_id = outlet_name_to_id.get(o_name)
        if not o_id:
            outlet_meta = next((o for o in OUTLETS if o["name"] == o_name), None)
            o_res = client.table("outlets").insert({
                "name": o_name,
                "url": art.get("url", ""),
                "authority_tier": outlet_meta["authority_tier"] if outlet_meta else "digital",
            }).execute()
            o_id = o_res.data[0]["id"]
            outlet_name_to_id[o_name] = o_id

        articles_payload.append({
            "event_id": event_id,
            "outlet_id": o_id,
            "url": art.get("url", ""),
            "headline": art.get("headline", ""),
            "published_at": art.get("published_at", datetime.now(timezone.utc).isoformat()),
            "full_text": art.get("full_text", ""),
            "extraction_quality": art.get("extraction_quality", _extraction_quality(art.get("full_text", ""), art.get("headline", ""))),
        })

    articles_res = client.table("articles").insert(articles_payload).execute()
    if not articles_res.data:
        raise HTTPException(500, "Failed to insert articles into Supabase")

    # 5. Batch analysis: group articles by outlet, 1 LLM call per outlet
    outlet_name_inv = {v: k for k, v in outlet_name_to_id.items()}
    articles_by_outlet: dict[str, list[dict]] = {}
    for art in articles_res.data:
        o_name = outlet_name_inv.get(art.get("outlet_id", ""), "Unknown")
        articles_by_outlet.setdefault(o_name, []).append(art)

    # Merge stakeholders from all batch results
    all_batch_stakeholders: list[dict] = []
    articles_to_keep: set[str] = set()  # article IDs that pass relevance threshold

    for o_name, outlet_arts in articles_by_outlet.items():
        # Build batch input
        batch_input = []
        for a in outlet_arts:
            batch_input.append({
                "article_id": a.get("id", ""),
                "headline": a.get("headline", ""),
                "full_text": a.get("full_text", ""),
                "outlet_name": o_name,
            })

        # One LLM call for this outlet
        batch_result = analyze_outlet_batch(
            query=payload.query,
            outlet_name=o_name,
            articles=batch_input,
        )

        if batch_result and "articles" in batch_result:
            batch_arts = batch_result["articles"]
            result_by_id = {
                item.get("article_id"): item
                for item in batch_arts
                if isinstance(item, dict) and item.get("article_id")
            }
            # The keyword pre-filter has already selected these articles. Keep
            # them all so a noisy LLM relevance score cannot erase valid
            # coverage or leave the dashboard with missing signal rows.
            for i, article in enumerate(outlet_arts):
                art_id = article["id"]
                art_res = result_by_id.get(art_id)
                signals_data = _build_signal_data(
                    article.get("full_text", ""),
                    headline=article.get("headline", ""),
                    llm_signals=art_res,
                )
                _write_signals(art_id, signals_data)
                articles_to_keep.add(art_id)
                # Log whether LLM analysis was available for this article.
                has_llm = art_res is not None
                print(f"  [{o_name}] Article {i+1}: {'LLM + deterministic' if has_llm else 'deterministic only'} ✓")

            # Collect stakeholders from batch
            batch_stakeholders = batch_result.get("stakeholders", [])
            for s in batch_stakeholders:
                if isinstance(s, dict) and s.get("name"):
                    all_batch_stakeholders.append(s)
        else:
            # LLM failed — fall back to deterministic analysis for this outlet.
            # Keep all articles that passed the keyword filter even when the
            # LLM is unavailable, so the dashboard always has signal rows.
            print(f"  [{o_name}] LLM batch failed, falling back to deterministic analysis")
            for art in outlet_arts:
                signals_data = _build_signal_data(
                    art.get("full_text", ""),
                    headline=art.get("headline", ""),
                )
                _write_signals(art["id"], signals_data)
                articles_to_keep.add(art["id"])

    # 6. Signal rows were written for every retained article above.
    # No articles are deleted here — the keyword pre-filter already
    # selected relevant coverage, and a missing LLM response is not
    # grounds for removing an article from the dashboard.
    print(f"  Kept {len(articles_to_keep)} articles (all keyword-filtered articles retained)")

    # 7. Merge and deduplicate stakeholders
    client.table("stakeholders").delete().eq("event_id", event_id).execute()

    stakeholders_payload = []
    seen_names: set[str] = set()

    # Deduplicate by name (case-insensitive)
    for s in all_batch_stakeholders:
        name = s.get("name", "").strip()
        if not name:
            continue
        key = name.lower()
        if key not in seen_names:
            seen_names.add(key)
            stakeholders_payload.append({
                "event_id": event_id,
                "name": name,
                "role": s.get("role", "stakeholder"),
                "first_appeared_at": articles_res.data[0].get("published_at") if articles_res.data else None,
            })

    # If batch stakeholders are empty, fall back to spaCy
    if not stakeholders_payload:
        entity_counts: dict[str, int] = {}
        entity_meta: dict[str, dict] = {}
        for art in articles_res.data:
            text = art.get("full_text", "")
            if not text:
                continue
            entities = extract_entities(text)
            seen_in_article: set[str] = set()
            for ent in entities:
                key = ent["name"].lower()
                if key not in seen_in_article:
                    entity_counts[key] = entity_counts.get(key, 0) + 1
                    seen_in_article.add(key)
                if key not in entity_meta:
                    entity_meta[key] = {
                        "name": ent["name"],
                        "role": ent["tier"],
                        "first_appeared_at": art.get("published_at"),
                    }
        for key, count in entity_counts.items():
            if count >= 1 and key in entity_meta:
                stakeholders_payload.append({
                    "event_id": event_id,
                    "name": entity_meta[key]["name"],
                    "role": entity_meta[key]["role"],
                    "first_appeared_at": entity_meta[key]["first_appeared_at"],
                })
        stakeholders_payload = stakeholders_payload[:10]
        print(f"  spaCy fallback extracted {len(stakeholders_payload)} stakeholders")
    else:
        print(f"  Batch stakeholders: {len(stakeholders_payload)} (deduplicated)")

    if stakeholders_payload:
        stakeholders_res = client.table("stakeholders").insert(stakeholders_payload).execute()
        if stakeholders_res.data:
            stakeholder_name_to_id = {s["name"].lower(): s["id"] for s in stakeholders_res.data}

            # Build coverage per article. The database contract is
            # article_id + stakeholder_id, so do not collapse an outlet's
            # articles into one representative row.
            existing_art_ids = [a["id"] for a in articles_res.data if a["id"] in articles_to_keep]
            client.table("coverage_matrix").delete().in_("article_id", existing_art_ids).execute()

            def _stakeholder_mentioned(stakeholder_name: str, text: str) -> bool:
                """Check if a stakeholder is mentioned in text using multiple strategies."""
                import re as re_mod
                low = stakeholder_name.lower()
                text_lower = text.lower()

                if low in text_lower:
                    return True

                abbrevs = re_mod.findall(r"\(([A-Z]{2,})\)", stakeholder_name)
                for abbr in abbrevs:
                    if abbr.lower() in text_lower:
                        return True

                words = [w for w in re_mod.split(r"\W+", low) if len(w) >= 3]
                if len(words) >= 2:
                    matches = sum(1 for w in words if w in text_lower)
                    if matches >= max(2, len(words) // 2):
                        return True

                if words and words[0] in text_lower:
                    return True

                return False

            coverage_payload = []
            seen_pairs: set[tuple[str, str]] = set()
            for article in articles_res.data:
                if article["id"] not in articles_to_keep:
                    continue
                article_text = article.get("full_text", "")
                if not article_text.strip():
                    continue
                for st_name, st_id in stakeholder_name_to_id.items():
                    present = _stakeholder_mentioned(st_name, article_text)
                    pair = (article["id"], st_id)
                    if pair not in seen_pairs:
                        seen_pairs.add(pair)
                        coverage_payload.append({
                            "article_id": article["id"],
                            "stakeholder_id": st_id,
                            "present": present,
                        })
            if coverage_payload:
                client.table("coverage_matrix").insert(coverage_payload).execute()

    # 8. Create headline snapshots for FrameShift Replay
    kept_arts = [a for a in articles_res.data if a["id"] in articles_to_keep]
    existing_art_ids_final = [a["id"] for a in kept_arts]
    client.table("headline_snapshots").delete().in_("article_id", existing_art_ids_final).execute()

    snapshot_payload = []
    for art in kept_arts:
        headline = art.get("headline", "").strip()
        if headline:
            snapshot_payload.append({
                "article_id": art["id"],
                "headline_text": headline,
                "captured_at": art.get("published_at", datetime.now(timezone.utc).isoformat()),
                "source": "live",
            })
    if snapshot_payload:
        client.table("headline_snapshots").insert(snapshot_payload).execute()

    print(f"[SEARCH DONE] {len(articles_to_keep)} articles, {len(stakeholders_payload)} stakeholders")
    return {"event_id": event_id}


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", "8000"))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)
