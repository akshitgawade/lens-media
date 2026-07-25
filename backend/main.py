from __future__ import annotations

import os
from typing import Any

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from supabase import create_client, Client

from nlp_pipeline import detect_agency_framing, extract_entities, score_language_intensity
# Add this after imports to catch version issues
try:
    from supabase import create_client
except ImportError:
    raise RuntimeError("Install supabase>=2.6: pip install supabase>=2.6")

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


def _source_attribution_from_entities(text: str) -> dict[str, float]:
    entities = extract_entities(text)
    if not entities:
        return {"official_ratio": 0.0, "independent_ratio": 0.0}

    official = sum(1 for entity in entities if entity["tier"] == "official")
    independent = sum(1 for entity in entities if entity["tier"] == "independent")
    total = official + independent
    if total == 0:
        return {"official_ratio": 0.0, "independent_ratio": 0.0}

    return {
        "official_ratio": official / total,
        "independent_ratio": independent / total,
    }


def _write_signals(article_id: str, signals: dict[str, Any]) -> None:
    client = get_supabase_client()
    source_payload = {
        "article_id": article_id,
        "official_ratio": signals["source_attribution"]["official_ratio"],
        "independent_ratio": signals["source_attribution"]["independent_ratio"],
    }
    agency_payload = {
        "article_id": article_id,
        "agency_score": signals["agency_framing"]["agency_score"],
        "example_phrases": signals["agency_framing"]["example_phrases"],
    }
    intensity_payload = {
        "article_id": article_id,
        "emotional_score": signals["language_intensity"]["emotional_score"],
        "certainty_score": signals["language_intensity"]["certainty_score"],
        "urgency_score": signals["language_intensity"]["urgency_score"],
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


@app.post("/analyze", response_model=AnalyzeResponse)
def analyze(payload: AnalyzeRequest) -> AnalyzeResponse:
    source_attribution = _source_attribution_from_entities(payload.text)
    agency_framing = detect_agency_framing(payload.text, is_headline=payload.is_headline)
    language_intensity = score_language_intensity(payload.text)

    signals = {
        "source_attribution": source_attribution,
        "agency_framing": agency_framing,
        "language_intensity": language_intensity,
    }

    _write_signals(payload.article_id, signals)

    return AnalyzeResponse(success=True, article_id=payload.article_id, signals=signals)


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", "8000"))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)
