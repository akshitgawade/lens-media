from __future__ import annotations

import re
from functools import lru_cache
from typing import Literal

import spacy
from spacy.language import Language

OFFICIAL_KEYWORDS = [
    "police",
    "officer",
    "government",
    "official",
    "minister",
    "authority",
    "court",
    "judge",
    "spokesperson",
    "department",
    "administration",
    "bureau",
    "agency",
    "commission",
]

INDEPENDENT_KEYWORDS = [
    "victim",
    "witness",
    "resident",
    "neighbor",
    "activist",
    "advocate",
    "expert",
    "ngo",
    "eyewitness",
    "survivor",
    "family",
    "community",
    "protester",
    "demonstrator",
]

EMOTIONAL = [
    "shocking",
    "tragic",
    "devastating",
    "outrage",
    "horrific",
    "alarming",
    "urgent",
    "critical",
    "heartbreaking",
    "terrifying",
    "appalling",
    "disturbing",
    "traumatic",
    "painful",
    "sad",
]

CERTAINTY = [
    "confirmed",
    "definitely",
    "proven",
    "certain",
    "always",
    "never",
    "must",
    "will",
    "certainly",
    "absolutely",
    "undoubtedly",
    "clearly",
    "obviously",
]

URGENCY = [
    "breaking",
    "urgent",
    "immediate",
    "now",
    "asap",
    "crisis",
    "emergency",
    "deadline",
    "rapidly",
    "swiftly",
    "quickly",
    "hurry",
]


@lru_cache(maxsize=1)
def get_nlp() -> Language:
    try:
        return spacy.load("en_core_web_sm")
    except OSError:
        nlp = spacy.blank("en")
        if "sentencizer" not in nlp.pipe_names:
            nlp.add_pipe("sentencizer")
        return nlp


def _normalize(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def _tier_for_entity(name: str, context: str) -> Literal["official", "independent"]:
    haystack = f"{name} {context}".lower()
    if any(keyword in haystack for keyword in OFFICIAL_KEYWORDS):
        return "official"
    if any(keyword in haystack for keyword in INDEPENDENT_KEYWORDS):
        return "independent"
    # Fallbacks keep the MVP useful when the keyword lists do not match.
    if any(token in name.lower() for token in ["police", "court", "agency", "department", "office"]):
        return "official"
    return "independent"


def extract_entities(text: str) -> list[dict]:
    doc = get_nlp()(text or "")
    results: list[dict] = []
    seen: set[tuple[str, str]] = set()

    for ent in doc.ents:
        if ent.label_ not in {"PERSON", "ORG", "GPE"}:
            continue
        name = _normalize(ent.text)
        if not name:
            continue
        sent_text = _normalize(ent.sent.text if ent.sent is not None else text)
        tier = _tier_for_entity(name, sent_text)
        key = (name.lower(), tier)
        if key in seen:
            continue
        seen.add(key)
        results.append({"name": name, "tier": tier})

    return results


def _classify_agency_phrase(text: str, nlp: Language, is_headline: bool) -> str:
    lowered = text.lower()
    if is_headline:
        passive_by = bool(re.search(r"\b\w+(?:ed|en|wn|rt|pt)\b.*\bby\b", lowered))
        if passive_by:
            return "passive"
        if re.search(r"^[^,;:]+?\b\w+(?:ed|en|wn|rt|pt)\b(?:\s|$)", lowered) and " by " not in lowered:
            return "agentless"
        return "active"

    sentence_doc = nlp(text)
    has_passive = any(tok.dep_ in {"nsubjpass", "auxpass"} for tok in sentence_doc)
    has_subject = any(tok.dep_ in {"nsubj", "nsubjpass"} for tok in sentence_doc)
    if has_passive:
        return "passive"
    if not has_subject and any(tok.pos_ in {"VERB", "AUX"} and tok.tag_ == "VBN" for tok in sentence_doc):
        return "agentless"
    return "active"


def detect_agency_framing(text: str, is_headline: bool = False) -> dict:
    nlp = get_nlp()
    doc = nlp(text or "")
    phrases: list[dict] = []
    scores = {"active": 1.0, "passive": 0.0, "agentless": 0.25}
    score_total = 0.0
    score_count = 0

    if is_headline:
        phrase_type = _classify_agency_phrase(text or "", nlp, True)
        phrases.append({"text": _normalize(text or ""), "type": phrase_type})
        score_total += scores[phrase_type]
        score_count += 1
    else:
        sentences = list(doc.sents) if doc.has_annotation("SENT_START") else [doc]
        for sent in sentences:
            phrase_text = _normalize(sent.text)
            if not phrase_text:
                continue
            phrase_type = _classify_agency_phrase(phrase_text, nlp, False)
            phrases.append({"text": phrase_text, "type": phrase_type})
            score_total += scores[phrase_type]
            score_count += 1
            if len(phrases) >= 3:
                break

    if score_count == 0:
        agency_score = 0.5
    else:
        agency_score = max(0.0, min(1.0, score_total / score_count))

    return {"agency_score": agency_score, "example_phrases": phrases[:3]}


def _score_lexicon(text: str, lexicon: list[str]) -> float:
    tokens = re.findall(r"\b\w+\b", text.lower())
    total_words = len(tokens)
    if total_words == 0:
        return 0.0
    matches = sum(1 for token in tokens if token in lexicon)
    return min(1.0, matches / total_words)


def score_language_intensity(text: str) -> dict:
    body = text or ""
    return {
        "emotional_score": _score_lexicon(body, EMOTIONAL),
        "certainty_score": _score_lexicon(body, CERTAINTY),
        "urgency_score": _score_lexicon(body, URGENCY),
    }
