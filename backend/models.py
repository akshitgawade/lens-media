from __future__ import annotations
from typing import Any, Optional, List
from pydantic import BaseModel

class OutletOut(BaseModel):
    id: str
    name: str
    url: str
    authority_tier: str

class EventOut(BaseModel):
    id: str
    title: str
    summary: str
    first_reported_at: str

class ArticleOut(BaseModel):
    id: str
    event_id: str
    outlet_id: str
    url: str
    headline: str
    published_at: str
    full_text: str
    extraction_quality: str = "unknown"

class HeadlineSnapshotOut(BaseModel):
    id: str
    article_id: str
    headline_text: str
    captured_at: str
    source: str

class StakeholderOut(BaseModel):
    id: str
    event_id: str
    name: str
    role: str
    first_appeared_at: Optional[str] = None

class PhraseOut(BaseModel):
    text: str
    type: str

class SourceAttributionOut(BaseModel):
    article_id: str
    official_ratio: Optional[float] = None
    independent_ratio: Optional[float] = None
    evidence_count: int = 0
    analysis_status: str = "unknown"
    analysis_method: str = "unknown"

class AgencyFramingOut(BaseModel):
    article_id: str
    agency_score: Optional[float] = None
    example_phrases: List[PhraseOut]
    evidence_count: int = 0
    analysis_status: str = "unknown"
    analysis_method: str = "unknown"

class LanguageIntensityOut(BaseModel):
    article_id: str
    emotional_score: Optional[float] = None
    certainty_score: Optional[float] = None
    urgency_score: Optional[float] = None
    evidence_count: int = 0
    analysis_status: str = "unknown"
    analysis_method: str = "unknown"

class CoverageMatrixOut(BaseModel):
    article_id: str
    stakeholder_id: str
    present: bool

class SignalsBundleOut(BaseModel):
    source_attribution: List[SourceAttributionOut]
    agency_framing: List[AgencyFramingOut]
    language_intensity: List[LanguageIntensityOut]
    coverage_matrix: List[CoverageMatrixOut]

class EventBundleOut(BaseModel):
    event: EventOut
    outlets: List[OutletOut]
    articles: List[ArticleOut]
    snapshots: List[HeadlineSnapshotOut]
    stakeholders: List[StakeholderOut]
    signals: SignalsBundleOut
