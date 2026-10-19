from __future__ import annotations

import re
from collections import defaultdict
from functools import lru_cache
from typing import Any, Literal

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
    "ministry",
    "ministerial",
    "municipal",
    "mayor",
    "council",
    "prosecutor",
    "prosecution",
    "military",
    "army",
    "firefighter",
    "firefighters",
    "regulator",
    "regulatory",
    "inspector",
    "investigator",
    "security",
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
    "tenant",
    "resident",
    "parent",
    "student",
    "worker",
    "union",
    "lawyer",
    "researcher",
    "professor",
    "doctor",
    "doctor",
    "civil society",
    "human rights",
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
    "slammed",
    "blasted",
    "lashes",
    "fury",
    "anger",
    "outraged",
    "condemned",
    "furious",
    "scathing",
    "vitriolic",
    "fire",
    "war",
    "battle",
    "clash",
    "storm",
    "panic",
    "chaos",
    "devastation",
    "suffering",
    "grief",
    "fear",
    "cruel",
    "brutal",
    "brutality",
    "horrifying",
    "disaster",
    "disastrous",
    "crisis-hit",
    "death",
    "deaths",
    "killed",
    "injured",
    "deadly",
    "violence",
    "violent",
    "attack",
    "attacked",
    "threat",
    "threatening",
    "fear",
    "fears",
    "panic",
    "rage",
    "grief",
    "mourning",
    "sorrow",
    "hardship",
    "hunger",
    "abuse",
    "abused",
    "trauma",
    "traumatic",
    "controversy",
    "controversial",
    "dispute",
    "turmoil",
    "unrest",
    "cruelty",
    "brutal",
    "grave",
    "severe",
    "stark",
    "worry",
    "concern",
    "concerns",
    "accused",
    "denounced",
    "criticised",
    "criticized",
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
    "asserted",
    "insisted",
    "declared",
    "maintained",
    "emphasized",
    "stressed",
    "reiterated",
    "affirmed",
    "confirmed",
    "vowed",
    "pledged",
    "definitive",
    "definite",
    "conclusive",
    "conclusively",
    "undeniable",
    "irrefutable",
    "unambiguous",
    "verified",
    "authentic",
    "established",
    "evidence",
    "fact",
    "facts",
    "certainly",
    "firmly",
    "categorically",
    "unquestionably",
    "undisputed",
    "inevitable",
    "guaranteed",
    "guarantee",
    "insisted",
    "asserted",
    "affirmed",
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
    "amid",
    "escalating",
    "soaring",
    "surging",
    "plummeting",
    "slammed",
    "crackdown",
    "alerts",
    "warned",
    "warning",
    "immediately",
    "overnight",
    "escalation",
    "escalated",
    "surge",
    "surged",
    "rushed",
    "rush",
    "escalate",
    "escalated",
    "escalating",
    "alert",
    "alerts",
    "warning",
    "warnings",
    "deadline",
    "deadlines",
    "immediately",
    "sudden",
    "suddenly",
    "ongoing",
    "intensify",
    "intensified",
    "volatile",
    "critical",
    "dire",
    "rapid",
    "rushed",
    "rescue",
    "evacuate",
    "evacuation",
    "relief",
    "response",
]

# Multi-word cues carry a small bonus because they express a framing move
# more reliably than isolated words. They are deliberately kept separate from
# the single-word lexicons so phrase matches cannot be lost to stemming.
EMOTIONAL_PHRASES = [
    "death toll",
    "loss of life",
    "loss of lives",
    "fears are growing",
    "growing fears",
    "growing anger",
    "public outrage",
    "widespread outrage",
    "deep concern",
    "grave concern",
    "deeply troubling",
    "deeply disturbing",
    "under fire",
    "in a state of panic",
    "a wave of violence",
    "violent clashes",
    "brutal attack",
    "human suffering",
    "families in grief",
    "left devastated",
    "shocking incident",
    "tragic incident",
    "heartbreaking scenes",
    "a shocking turn",
    "bitter dispute",
    "fierce criticism",
    "strongly criticised",
    "strongly criticized",
    "facing criticism",
    "sparked anger",
    "sparked outrage",
    "sparked protests",
    "amid protests",
    "amid unrest",
]

CERTAINTY_PHRASES = [
    "it is clear",
    "it is obvious",
    "there is no doubt",
    "beyond any doubt",
    "beyond reasonable doubt",
    "without a doubt",
    "as a matter of fact",
    "officially confirmed",
    "has been confirmed",
    "was confirmed",
    "has been verified",
    "was verified",
    "conclusive evidence",
    "clear evidence",
    "strong evidence",
    "firmly believes",
    "categorically denied",
    "categorically rejected",
    "ruled out",
    "ruled that",
    "made it clear",
    "left no doubt",
    "certain to",
    "bound to",
    "will definitely",
    "must be",
    "must not",
    "will have to",
]

URGENCY_PHRASES = [
    "breaking news",
    "at the earliest",
    "as soon as possible",
    "with immediate effect",
    "with immediate action",
    "right now",
    "at this moment",
    "in the coming hours",
    "in the wake of",
    "amid growing",
    "under pressure",
    "on high alert",
    "emergency situation",
    "urgent action",
    "urgent measures",
    "rescue operations",
    "relief operations",
    "death toll rises",
    "death toll climbs",
    "situation is worsening",
    "situation worsens",
    "time is running out",
    "act immediately",
    "respond immediately",
    "rapid response",
    "swift action",
    "swift response",
    "crisis unfolds",
    "crisis deepens",
]

HEDGE_PHRASES = [
    "it is alleged",
    "it was alleged",
    "could possibly",
    "may have",
    "might have",
    "appears to be",
    "is believed to",
    "is thought to",
    "according to reports",
    "reportedly said",
]

_HEDGING = {
    "reportedly", "allegedly", "allege", "alleged", "believed", "suspected",
    "claimed", "claims", "may", "might", "could", "possibly", "perhaps",
    "apparently", "seemingly", "presumably", "unconfirmed", "anonymous",
    "likely", "unlikely", "appears", "appeared", "suggests", "suggested",
}

_SPEECH_VERBS = {
    "say", "said", "state", "stated", "mention", "mentioned", "note", "noted",
    "remark", "remarked", "tell", "told", "explain", "explained", "add", "added",
    "observe", "observed", "argue", "argued", "announce", "announced", "warn",
    "warned", "confirm", "confirmed", "deny", "denied", "insist", "insisted",
}

_ATTRIBUTION_VERBS = _SPEECH_VERBS | {
    "report", "reported", "describe", "described", "recall", "recalled",
    "according", "testify", "testified", "write", "wrote", "declare", "declared",
}

_PASSIVE_AUXILIARIES = {
    "am", "is", "are", "was", "were", "be", "been", "being", "get", "gets",
    "got", "getting",
}

_ROLE_TERMS: dict[str, tuple[str, ...]] = {
    "official": tuple(OFFICIAL_KEYWORDS),
    "independent": tuple(INDEPENDENT_KEYWORDS),
}

_WORD_RE = re.compile(r"\b[\w]+(?:['’:-][\w]+)*\b", re.UNICODE)
_ATTRIBUTION_RE = re.compile(
    r"\b(?:said|says|stated|states|told|reported|reports|confirmed|warned|"
    r"argued|claimed|announced|described|explained|testified|declared|"
    r"insisted|denied|called|calls|urged|urges|asked|asks|added|adds|"
    r"wrote|writes|tweeted|posted|revealed|disclosed|according)\b",
    re.IGNORECASE,
)

_ACCORDING_TO_RE = re.compile(r"\baccording\s+to\b", re.IGNORECASE)

# Combined role terms for role-phrase detection near attribution verbs.
_ROLE_TERMS_LIST: list[str] = list(OFFICIAL_KEYWORDS) + list(INDEPENDENT_KEYWORDS)
# Remove duplicates while preserving order.
_ROLE_TERMS_LIST = list(dict.fromkeys(_ROLE_TERMS_LIST))
# Allow common inflections (plurals, verb forms) for role keywords.
def _role_term_pattern(term: str) -> str:
    base = re.escape(term)
    # Single-word terms: allow optional s/es/ed/ing suffixes.
    if " " not in term:
        return base + r"(?:s|es|ed|ing)?"
    # Multi-word terms: allow suffix on the last word.
    parts = term.rsplit(" ", 1)
    return re.escape(parts[0]) + r"\s+" + re.escape(parts[1]) + r"(?:s|es|ed|ing)?"

_ROLE_PHRASE_RE = re.compile(
    r"\b(?:" + "|".join(_role_term_pattern(t) for t in _ROLE_TERMS_LIST) + r")\b",
    re.IGNORECASE,
)



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


def _strip_suffix(word: str) -> str:
    """Strip common English suffixes for stem-based keyword matching."""
    for suffix in ("ization", "ation", "ition", "ing", "ied", "ies", "ous",
                   "ive", "ful", "less", "able", "ible", "ly", "ed",
                   "er", "est", "es", "s"):
        if word.endswith(suffix) and len(word) - len(suffix) >= 3:
            return word[: -len(suffix)]
    return word


def _has_keyword(text: str, keywords: list[str] | tuple[str, ...]) -> bool:
    """Check if any keyword appears in the text, handling common inflections.

    Uses stem matching: strips suffixes from both keyword and text words
    so that "resident" matches "residents", "activist" matches
    "activists", etc.
    """
    lowered = text.lower()
    # Fast exact match first (avoids stemming overhead).
    for keyword in keywords:
        if re.search(rf"\b{re.escape(keyword.lower())}\b", lowered):
            return True
    # Stem-based fallback for inflected forms.
    kw_stems = {_strip_suffix(k.lower()) for k in keywords}
    for word in _WORD_RE.findall(lowered):
        if _strip_suffix(word) in kw_stems:
            return True
    return False


def _tier_for_entity(name: str, context: str) -> Literal["official", "independent"]:
    haystack = f"{name} {context}".lower()
    if _has_keyword(haystack, OFFICIAL_KEYWORDS):
        return "official"
    if _has_keyword(haystack, INDEPENDENT_KEYWORDS):
        return "independent"
    # Organization names that carry an institutional suffix are a safer
    # official fallback than treating every unknown entity as a source.
    if re.search(r"\b(?:police|court|agency|department|office|ministry|council)\b", name.lower()):
        return "official"
    # The public entity API requires a binary tier. Attribution scoring below
    # never uses this fallback unless the entity is actually attributed.
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


def _sentences(text: str, nlp: Language) -> list[Any]:
    doc = nlp(text or "")
    if doc.has_annotation("SENT_START"):
        return list(doc.sents)
    return [doc]


def _past_participle(text: str) -> bool:
    return bool(re.search(r"\b(?:[a-z]+(?:ed|en|wn|n)|done|made|known|sent|left|held|built|taken)\b", text.lower()))


# Common irregular past participles that the suffix regex misses.
_IRREGULAR_PAST_PARTICIPLES = (
    "removed", "displaced", "escorted", "evicted", "relocated",
    "arrested", "detained", "charged", "fined", "seized",
    "confiscated", "demolished", "demolished", "cleared",
    "taken", "given", "shown", "built", "sent", "held",
    "left", "found", "kept", "made", "set", "put", "cut",
    "hit", "run", "read", "led", "fed", "met", "won",
    "paid", "laid", "drawn", "driven", "chosen", "broken",
    "worn", "forgotten", "gotten", "written", "spoken",
    "drunk", "shrunk", "sworn", "torn", "born", "bound",
    "thrown", "blown", "grown", "known", "shown", "sown",
    "bought", "brought", "caught", "taught", "sought",
    "thought", "fought", "wrought", "sold", "told",
    "lost", "shot", "hit", "shut", "split", "spun",
    "stung", "struck", "stung", "swung", "wound",
    "struck", "stricken", "smitten", "bitten",
)


def _passive_markers(text: str, nlp: Language) -> tuple[bool, bool]:
    """Detect passive voice and explicit by-agent in a sentence."""
    doc = nlp(text)
    parsed_passive = any(token.dep_ in {"nsubjpass", "auxpass"} for token in doc)
    # Auxiliary + past participle: "were removed", "was displaced", "is taken"
    aux_participle = bool(re.search(
        r"\b(?:am|is|are|was|were|be|been|being|get|got|gets|getting)\b\s+"
        r"(?:not\s+)?(?:" + "|".join(re.escape(w) for w in _IRREGULAR_PAST_PARTICIPLES) +
        r"|[a-z]+(?:ed|en|wn|n))\b",
        text.lower(),
    ))
    has_by_agent = bool(re.search(r"\bby\s+(?:the\s+)?[a-z][a-z '-]{1,60}", text.lower()))
    return parsed_passive or aux_participle, has_by_agent


def _classify_agency_phrase(text: str, nlp: Language, is_headline: bool) -> str:
    """Classify a phrase using parser evidence with a regex fallback.

    Speech verbs with a clear subject must not reduce agency.  When the
    sentence starts with a subject performing a speech act (e.g., "Police
    said..."), it is classified as active even if an embedded passive clause
    exists (e.g., "the order was approved").
    """
    clean = _normalize(text)
    if not clean:
        return "agentless"

    doc = nlp(clean)
    has_subject = any(token.dep_ in {"nsubj", "nsubjpass", "expl"} for token in doc)

    # Check for speech verbs with subjects BEFORE passive detection.
    # A sentence like "Police said the order was approved" is active at the
       # sentence level even though the embedded clause uses passive voice.
    _speech_verb_re = re.compile(
        r"\b(?:said|says|stated|states|told|reported|reports|confirmed|warned|"
        r"argued|claimed|announced|described|explained|testified|declared|"
        r"insisted|denied|according to)\b",
        re.IGNORECASE,
    )
    _surface_actor = re.compile(
        r"^(?:the\s+)?(?:police|officers?|officials?|authorities|government|"
        r"minister|court|department|agency|city|residents?|witnesses?|"
        r"activists?|experts?|famil(?:y|ies)|[A-Z][\w'-]*(?:\s+[A-Z][\w'-]*){0,2})\b",
    )
    has_speech_verb = bool(_speech_verb_re.search(clean))
    has_surface_actor = bool(_surface_actor.match(clean))
    if has_speech_verb and (has_surface_actor or has_subject):
        return "active"

    has_passive, has_by_agent = _passive_markers(clean, nlp)
    if has_passive:
        return "passive"

    # The blank spaCy fallback has no dependency parser. Recover the common
    # subject-verb shape from the surface text so "Police removed families"
    # remains active even without the model package.
    surface_actor = r"(?:police|officers?|officials?|authorities|government|minister|court|department|agency|city|residents?|witnesses?|activists?|experts?|famil(?:y|ies)|[A-Z][\w'-]*(?:\s+[A-Z][\w'-]*){0,2})"
    has_surface_subject = bool(re.match(
        rf"^(?:the\s+)?{surface_actor}\s+[a-z][\w'-]*(?:s|ed|ing|en|wn)?\b",
        clean,
    ))
    if has_surface_subject:
        return "active"

    # Headlines frequently omit auxiliaries: "40 homes demolished".
    if is_headline and _past_participle(clean):
        first_clause = re.split(r"[,;:]", clean, maxsplit=1)[0]
        if re.match(r"^(?:\d+|dozens?|scores?|many|several|more than|homes?|families?|residents?)\b", first_clause.lower()):
            return "agentless"

    if not has_subject and not re.search(r"\b(?:who|which|that)\b", clean.lower()):
        if _past_participle(clean) or not re.search(r"\b(?:said|says|stated|reports?)\b", clean.lower()):
            return "agentless"
    return "active"


def _agency_score_sentence(sent_text: str, nlp: Language, is_headline: bool = False) -> tuple[float, str]:
    """Return an agency score and compatible phrase label for one sentence."""
    clean = _normalize(sent_text)
    doc = nlp(clean)
    phrase_type = _classify_agency_phrase(clean, nlp, is_headline)
    has_named_subject = any(
        token.dep_ in {"nsubj", "nsubjpass"} and token.ent_type_
        for token in doc
    )
    has_role_subject = bool(re.search(
        r"\b(?:the\s+)?(?:police|officers?|officials?|government|minister|court|"
        r"department|agency|residents?|witnesses?|activists?|experts?|famil(?:y|ies))\b",
        clean.lower(),
    ))
    has_speech_verb = any(
        (token.lemma_ or token.text).lower() in _ATTRIBUTION_VERBS
        for token in doc
    ) or bool(_ATTRIBUTION_RE.search(clean))
    hedge_count = sum(1 for token in _WORD_RE.findall(clean.lower()) if token in _HEDGING)
    has_passive, has_by_agent = _passive_markers(clean, nlp)

    if phrase_type == "passive":
        score = 0.34 if has_by_agent else 0.16
    elif phrase_type == "agentless":
        score = 0.12
    else:
        score = 0.92 if has_speech_verb else 0.86
        if has_named_subject or has_role_subject:
            score += 0.08

    if has_passive and has_by_agent:
        score = max(score, 0.34)
    score -= min(0.18, hedge_count * 0.06)
    return round(max(0.0, min(1.0, score)), 3), phrase_type


def detect_agency_framing(text: str, is_headline: bool = False) -> dict:
    body = _normalize(text or "")
    nlp = get_nlp()
    candidates: list[tuple[str, float, str, int]] = []

    if body:
        source_sentences = [body] if is_headline else [
            _normalize(sent.text) for sent in _sentences(body, nlp)
        ]
        for index, phrase_text in enumerate(source_sentences):
            if len(_WORD_RE.findall(phrase_text)) < 3:
                continue
            score, phrase_type = _agency_score_sentence(phrase_text, nlp, is_headline=is_headline)
            candidates.append((phrase_text, score, phrase_type, index))

    if not candidates:
        return {
            "agency_score": None,
            "example_phrases": [],
            "evidence_count": 0,
            "analysis_status": "no_evidence",
        }

    # Weight substantive sentences more than tiny fragments, but cap a long
    # paragraph so one unusually long sentence cannot dominate the signal.
    weighted_total = 0.0
    weight_total = 0.0
    for phrase_text, score, _, _ in candidates:
        weight = min(30, max(4, len(_WORD_RE.findall(phrase_text))))
        weighted_total += score * weight
        weight_total += weight

    # Select one example of each observed framing type, then fill remaining
    # slots with the most informative sentences while retaining source order.
    selected: list[tuple[str, float, str, int]] = []
    for phrase_type in ("passive", "agentless", "active"):
        matching = [candidate for candidate in candidates if candidate[2] == phrase_type]
        if matching:
            selected.append(max(matching, key=lambda candidate: len(_WORD_RE.findall(candidate[0]))))
    for candidate in sorted(candidates, key=lambda item: len(_WORD_RE.findall(item[0])), reverse=True):
        if candidate not in selected:
            selected.append(candidate)
        if len(selected) >= 3:
            break
    selected.sort(key=lambda item: item[3])

    return {
        "agency_score": round(weighted_total / weight_total, 3) if weight_total else None,
        "example_phrases": [
            {"text": phrase_text, "type": phrase_type}
            for phrase_text, _, phrase_type, _ in selected[:3]
        ],
        "evidence_count": len(candidates),
        "analysis_status": "analyzed",
    }


def _classify_source_phrase(phrase: str) -> str | None:
    lowered = phrase.lower()
    official = _has_keyword(lowered, _ROLE_TERMS["official"])
    independent = _has_keyword(lowered, _ROLE_TERMS["independent"])
    if official and not independent:
        return "official"
    if independent and not official:
        return "independent"
    return None


def _source_candidates_in_sentence(sentence: str, nlp: Language) -> list[str]:
    """Find attributed source mentions, not arbitrary entities.

    Three strategies, applied per attribution cue in the sentence:
      1. Named entity near the cue (PERSON/ORG/GPE within 90 chars).
      2. Role-phrase (police said, residents claimed, according to officials).
      3. Tail attribution ("...", said the minister).
    """
    # Prefer "according to" as a separate cue (not in _ATTRIBUTION_RE).
    has_attribution = _ATTRIBUTION_RE.search(sentence) or _ACCORDING_TO_RE.search(sentence)
    if not has_attribution:
        return []

    doc = nlp(sentence)
    candidates: list[str] = []
    seen: set[str] = set()

    # Gather all attribution cues
    cues = list(_ATTRIBUTION_RE.finditer(sentence)) + list(_ACCORDING_TO_RE.finditer(sentence))
    cues.sort(key=lambda m: m.start())

    for cue in cues:
        window_start = max(0, cue.start() - 90)
        window_end = min(len(sentence), cue.end() + 90)
        window = sentence[window_start:window_end]

        # Strategy 1: named entity near the cue
        nearby_entities = [
            ent for ent in doc.ents
            if ent.label_ in {"PERSON", "ORG", "GPE"}
            and ent.start_char <= cue.end() + 90
            and ent.end_char >= max(0, cue.start() - 90)
        ]
        if nearby_entities:
            nearest = min(nearby_entities, key=lambda ent: abs(ent.start_char - cue.start()))
            context_start = max(0, nearest.start_char - 80)
            context_end = min(len(sentence), nearest.end_char + 80)
            candidate = f"{nearest.text} {sentence[context_start:context_end]}"
            if candidate not in seen:
                seen.add(candidate)
                candidates.append(candidate)
            continue

        # Strategy 2: role-phrase near the cue
        role_matches = _ROLE_PHRASE_RE.findall(window)
        for match in role_matches:
            # Extend context around the role match within the window.
            idx = window.lower().find(match.lower())
            if idx >= 0:
                ctx_start = max(0, idx - 40)
                ctx_end = min(len(window), idx + len(match) + 40)
                candidate = window[ctx_start:ctx_end].strip()
            else:
                candidate = match
            if candidate not in seen:
                seen.add(candidate)
                candidates.append(candidate)

    # Strategy 3: tail attribution — “...”, said the minister.
    if not candidates:
        quoted_tail = re.search(
            r"(?:said|stated|told|reported|explained|warned|claimed)\s+"
            r"(?:the\s+)?([A-Z][^,.;]{2,80})",
            sentence,
            flags=re.IGNORECASE,
        )
        if quoted_tail:
            candidate = quoted_tail.group(1).strip()
            if candidate not in seen:
                candidates.append(candidate)
    return candidates


def analyze_source_attribution(text: str) -> dict:
    """Count attributable voices while keeping arbitrary named entities out.

    Only candidates returned by ``_source_candidates_in_sentence`` are
    considered — every candidate has already been verified near an
    attribution verb, so no second attribution check is needed here.
    """
    body = _normalize(text or "")
    nlp = get_nlp()
    counts: defaultdict[str, int] = defaultdict(int)
    seen: set[tuple[int, str]] = set()
    for index, sentence in enumerate(_sentences(body, nlp) if body else []):
        sentence_text = _normalize(sentence.text)
        for candidate in _source_candidates_in_sentence(sentence_text, nlp):
            tier = _classify_source_phrase(candidate)
            if tier is None:
                # Role phrases always match one of our keyword lists.  A named
                # entity that does not match is not an attributed voice — skip.
                continue
            key = (index, f"{candidate.lower()}:{tier}")
            if key in seen:
                continue
            seen.add(key)
            counts[tier] += 1

    total = counts["official"] + counts["independent"]
    if total == 0:
        return {
            "official_ratio": None,
            "independent_ratio": None,
            "evidence_count": 0,
            "analysis_status": "no_evidence",
        }
    return {
        "official_ratio": round(counts["official"] / total, 4),
        "independent_ratio": round(counts["independent"] / total, 4),
        "evidence_count": total,
        "analysis_status": "analyzed",
    }


def _normalise_lexeme(word: str) -> str:
    word = word.lower().strip("-'’")
    aliases = {
        "outraged": "outrage",
        "devastated": "devastate",
        "devastating": "devastate",
        "terrifying": "terrify",
        "horrifying": "horrify",
        "heartbreaking": "heartbreak",
        "shocking": "shock",
        "alarming": "alarm",
        "disturbing": "disturb",
        "traumatic": "trauma",
        "criticised": "criticise",
        "criticized": "criticize",
        "condemned": "condemn",
        "denounced": "denounce",
        "confirmed": "confirm",
        "verified": "verify",
        "established": "establish",
        "guaranteed": "guarantee",
        "escalated": "escalate",
        "escalating": "escalate",
        "intensified": "intensify",
        "worsening": "worsen",
    }
    if word in aliases:
        return aliases[word]
    for suffix in ("ization", "ation", "ition", "ing", "edly", "edly", "ed", "ies", "es", "s"):
        if word.endswith(suffix) and len(word) - len(suffix) >= 4:
            return word[: -len(suffix)]
    return word


def _lexicon_forms(lexicon: list[str]) -> set[str]:
    return {_normalise_lexeme(term) for term in lexicon}


def _lexicon_hits(text: str, lexicon: list[str]) -> float:
    forms = _lexicon_forms(lexicon)
    hits = 0.0
    for word in _WORD_RE.findall(text.lower()):
        if _normalise_lexeme(word) in forms:
            hits += 1.0
    for phrase in lexicon:
        if " " not in phrase:
            continue
        hits += len(re.findall(rf"(?<!\w){re.escape(phrase.lower())}(?!\w)", text.lower()))
    return hits


def _phrase_hits(text: str, phrases: list[str] | tuple[str, ...]) -> float:
    lowered = text.lower()
    return sum(
        len(re.findall(rf"(?<!\w){re.escape(phrase.lower())}(?!\w)", lowered))
        for phrase in phrases
    )


def _score_intensity_dimension(
    body: str,
    headline: str,
    lexicon: list[str],
    phrases: list[str] | tuple[str, ...] = (),
    subtract_hedges: bool = False,
) -> float | None:
    """Score a single intensity dimension against a lexicon.

    Calibration targets (body text only):
      - 200-word text with 2 emotional words → ~0.25
      - 500-word text with 5 emotional words → ~0.31
      - 500-word text with 10 emotional words → ~0.51
      Headlines receive a modest boost (1.0×) so a strongly-worded
      headline moves the needle without dominating the signal.
    """
    body_words = len(_WORD_RE.findall(body))
    headline_words = len(_WORD_RE.findall(headline))
    total_words = body_words + headline_words
    if total_words == 0:
        return None

    body_hits = _lexicon_hits(body, lexicon)
    headline_hits = _lexicon_hits(headline, lexicon)
    body_phrase_hits = _phrase_hits(body, phrases)
    headline_phrase_hits = _phrase_hits(headline, phrases)
    # Phrase matches receive a modest bonus, while their constituent words
    # still count normally. This rewards meaningful constructions without
    # allowing a single phrase to dominate a long article.
    weighted_hits = (
        body_hits
        + (1.0 * headline_hits)
        + (1.5 * body_phrase_hits)
        + (1.5 * headline_phrase_hits)
    )
    if subtract_hedges:
        weighted_hits -= (
            _lexicon_hits(body, list(_HEDGING))
            + (1.0 * _lexicon_hits(headline, list(_HEDGING)))
            + (1.5 * _phrase_hits(body, HEDGE_PHRASES))
            + (1.5 * _phrase_hits(headline, HEDGE_PHRASES))
        )
    # Denominator uses body words only (headline length is minor) to avoid
    # penalising short articles too heavily while still scaling for longer ones.
    denominator = 1.0 + (0.03 * body_words)
    return round(max(0.0, min(1.0, weighted_hits / denominator)), 4)


def score_language_intensity(text: str, headline: str = "") -> dict:
    body = _normalize(text or "")
    head = _normalize(headline or "")
    dimensions = {
        "emotional_score": _score_intensity_dimension(body, head, EMOTIONAL, EMOTIONAL_PHRASES),
        "certainty_score": _score_intensity_dimension(body, head, CERTAINTY, CERTAINTY_PHRASES, subtract_hedges=True),
        "urgency_score": _score_intensity_dimension(body, head, URGENCY, URGENCY_PHRASES),
    }
    analyzed = any(value is not None for value in dimensions.values())
    return {
        **dimensions,
        "evidence_count": sum(
            int(
                _lexicon_hits(body, lexicon)
                + _lexicon_hits(head, lexicon)
                + _phrase_hits(body, phrases)
                + _phrase_hits(head, phrases)
                > 0
            )
            for lexicon, phrases in (
                (EMOTIONAL, EMOTIONAL_PHRASES),
                (CERTAINTY, CERTAINTY_PHRASES),
                (URGENCY, URGENCY_PHRASES),
            )
        ),
        "analysis_status": "analyzed" if analyzed else "no_evidence",
    }


def analyze_text_with_llm(text: str, is_headline: bool = False) -> dict | None:
    import os
    import json

    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        return None

    try:
        from groq import Groq

        client = Groq(api_key=api_key)

        system = (
            "You are a media-analysis engine. "
            "You MUST respond with valid JSON matching the requested schema. "
            "No markdown, no explanation, just JSON."
        )
        user = f"""Analyze the following news text and extract media analysis signals.
Context: It is a {"headline" if is_headline else "full article body"}.

Output JSON with this exact structure. Use null when the text contains no
evidence for a signal; never guess 0.5. Include evidence_count.
{{
  "source_attribution": {{
    "official_ratio": <float 0.0-1.0 or null>,
    "independent_ratio": <float 0.0-1.0 or null>,
    "evidence_count": <integer>
  }},
  "agency_framing": {{
    "agency_score": <float 0.0-1.0 or null>,
    "evidence_count": <integer>,
    "example_phrases": [
      {{"text": "exact quote", "type": "active|passive|agentless"}}
    ]
  }},
  "language_intensity": {{
    "emotional_score": <float 0.0-1.0 or null>,
    "certainty_score": <float 0.0-1.0 or null>,
    "urgency_score": <float 0.0-1.0 or null>,
    "evidence_count": <integer>
  }}
}}

Keep example_phrases to at most 3 items.

Text to analyze:
{truncate_for_llm(text, max_chars=3000)}"""

        response = client.chat.completions.create(
            model="openai/gpt-oss-120b",
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            response_format={"type": "json_object"},
            temperature=0.3,
        )

        return json.loads(response.choices[0].message.content)
    except Exception as e:
        print(f"Groq analysis failed, falling back to spaCy: {e}")
        return None


def generate_event_coverage(query: str) -> dict | None:
    import os
    import json

    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        return None

    try:
        from groq import Groq

        client = Groq(api_key=api_key)

        system = (
            "You are a simulator generating realistic news coverage scenarios "
            "for a media-literacy tool called Narrative Lens. "
            "You MUST respond with valid JSON matching the requested schema. "
            "No markdown, no explanation, just JSON."
        )
        user = f"""Based on the user's topic search query: "{query}", generate a complete set of news coverage data.

The scenario must include 4 specific outlets covering the event differently:
1. 'The Hindu' (Legacy, conservative/official stance)
2. 'Indian Express' (Independent, balanced investigation)
3. 'The Wire' (Alternative, highly independent, critical of authority)
4. 'Scroll.in' (Digital, focus on citizen/human rights perspective)

Output a single JSON object matching this exact structure:
{{
  "event": {{
    "title": "A short, formal title describing the event",
    "summary": "A 2-3 sentence summary of the core event",
    "first_reported_at": "ISO timestamp (e.g. 2026-05-27T08:48:37Z)"
  }},
  "articles": [
    {{
      "outlet_name": "The Hindu",
      "url": "http://example.com/...",
      "headline": "Headline showing this outlet's framing",
      "published_at": "ISO timestamp (slightly after first_reported_at)",
      "full_text": "A realistic 2-3 paragraph news article body text"
    }}
  ],
  "snapshots": [
    {{
      "outlet_name": "The Hindu",
      "headline_text": "Headline text",
      "captured_at": "ISO timestamp",
      "source": "wayback"
    }}
  ],
  "stakeholders": [
    {{
      "name": "Name of person, group, or organization",
      "role": "petitioner|official_body|affected_party|expert",
      "first_appeared_at": "ISO timestamp"
    }}
  ],
  "coverage_matrix": [
    {{
      "outlet_name": "The Hindu",
      "stakeholder_name": "exact name from stakeholders list above",
      "present": true
    }}
  ]
}}

Rules:
- Generate exactly 4 articles (one per outlet: The Hindu, Indian Express, The Wire, Scroll.in)
- Generate exactly 8 snapshots (two per outlet)
- Generate exactly 4 stakeholders
- Generate a full 16-row coverage matrix (each of 4 stakeholders × each of 4 outlets)
- Each article full_text must be 2-3 paragraphs, realistic, and reflect the outlet's editorial stance
- Snapshot timestamps must be between first_reported_at and published_at
- Stakeholder first_appeared_at must be between first_reported_at and 24 hours after"""

        response = client.chat.completions.create(
            model="openai/gpt-oss-120b",
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            response_format={"type": "json_object"},
            temperature=0.7,
        )

        return json.loads(response.choices[0].message.content)
    except Exception as e:
        print(f"Groq event generation failed: {e}")
        return None


def truncate_for_llm(text: str, max_chars: int = 3000) -> str:
    """Truncate text for LLM context, breaking at sentence boundary."""
    if len(text) <= max_chars:
        return text
    truncated = text[:max_chars]
    last_period = truncated.rfind(". ")
    if last_period > max_chars * 0.5:
        return truncated[: last_period + 1]
    return truncated


# ── LLM Cache ────────────────────────────────────────────────────────────────

_LLM_CACHE: dict[str, dict] = {}

def _cache_key(text: str) -> str:
    import hashlib
    return hashlib.sha256(text.encode("utf-8")).hexdigest()[:32]


# ── Batched Analysis (Optimization: 1 call per outlet) ──────────────────────

def analyze_outlet_batch(
    query: str,
    outlet_name: str,
    articles: list[dict],
) -> dict | None:
    """Analyze all articles from one outlet in a single LLM call.

    Returns:
        {
          "articles": [
            {
              "relevance": float,
              "source_attribution": {"official_ratio": float, "independent_ratio": float},
              "agency_framing": {"agency_score": float, "example_phrases": [...]},
              "language_intensity": {"emotional_score": float, "certainty_score": float, "urgency_score": float}
            }
          ],
          "stakeholders": [{"name": str, "role": str}]
        }
    Returns None on failure (caller falls back to spaCy).
    """
    import os
    import json

    api_key = os.getenv("GROQ_API_KEY")
    if not api_key or not articles:
        return None

    # Check cache for the whole batch
    batch_key = _cache_key(json.dumps({"q": query, "o": outlet_name, "a": [
        {"id": a.get("article_id", ""), "h": a.get("headline", ""), "t": (a.get("full_text") or "")[:2000]} for a in articles
    ]}))
    if batch_key in _LLM_CACHE:
        print(f"  [CACHE HIT] {outlet_name} batch")
        return _LLM_CACHE[batch_key]

    # Build article blocks
    article_blocks = []
    for i, art in enumerate(articles[:4], 1):
        body = truncate_for_llm(art.get("full_text") or "", max_chars=2000)
        article_blocks.append(
            f"ARTICLE {i} (article_id={art.get('article_id', '')}):\nHeadline: {art.get('headline', 'N/A')}\nText: {body}"
        )
    blocks_text = "\n\n".join(article_blocks)

    system = (
        "You are a media-analysis engine. "
        "You MUST respond with valid JSON matching the requested schema. "
        "No markdown, no explanation, just JSON."
    )
    user = f"""Analyze the following {len(articles[:4])} articles from {outlet_name} for the query: "{query}"

{blocks_text}

For EACH article provide the exact article_id shown above. Do not reorder or omit articles.
- relevance: How relevant is this to the query? (0.0-1.0)
- source_attribution: ratio of actually attributed official vs independent voices quoted. Use null ratios and evidence_count 0 when none are present.
- agency_framing: how directly the text assigns responsibility (agency_score 0.0-1.0 or null, up to 2 exact example phrases with type active/passive/agentless, and evidence_count)
- language_intensity: emotional load, certainty, urgency. Use null only when there are no words supporting a dimension, and include evidence_count.

Also identify 3-6 key stakeholders mentioned across all articles (people, orgs, groups central to the story).

Return ONLY this JSON:
{{
  "articles": [
    {{
      "article_id": "the exact input id",
      "relevance": 0.0-1.0,
      "source_attribution": {{"official_ratio": 0.0-1.0, "independent_ratio": 0.0-1.0, "evidence_count": 0}},
      "agency_framing": {{"agency_score": 0.0-1.0, "example_phrases": [{{"text": "exact phrase", "type": "active"}}], "evidence_count": 0}},
      "language_intensity": {{"emotional_score": 0.0-1.0, "certainty_score": 0.0-1.0, "urgency_score": 0.0-1.0, "evidence_count": 0}}
    }}
  ],
  "stakeholders": [{{"name": "...", "role": "..."}}]
}}"""

    for attempt in range(3):
        try:
            from groq import Groq
            client = Groq(api_key=api_key)

            response = client.chat.completions.create(
                model="openai/gpt-oss-20b",
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
                response_format={"type": "json_object"},
                temperature=0.2,
                max_tokens=3500,
            )
            raw = response.choices[0].message.content or ""
            cleaned = raw.strip()
            if cleaned.startswith("```"):
                cleaned = cleaned.split("\n", 1)[-1]
            if cleaned.endswith("```"):
                cleaned = cleaned.rsplit("```", 1)[0]
            cleaned = cleaned.strip()

            parsed = json.loads(cleaned)
            articles_result = parsed.get("articles", [])
            stakeholders_result = parsed.get("stakeholders", [])

            expected_ids = [str(article.get("article_id", "")) for article in articles[:4]]
            by_id = {
                str(item.get("article_id")): item
                for item in articles_result
                if isinstance(item, dict) and item.get("article_id")
            } if isinstance(articles_result, list) else {}
            if expected_ids and len(by_id) == len(expected_ids) and all(article_id in by_id for article_id in expected_ids):
                valid = True
                for art_r in by_id.values():
                    if "relevance" not in art_r:
                        valid = False
                        break
                    try:
                        art_r["relevance"] = max(0.0, min(1.0, float(art_r["relevance"])))
                    except (TypeError, ValueError):
                        valid = False
                        break
                    if not isinstance(art_r.get("source_attribution"), dict) or not isinstance(art_r.get("agency_framing"), dict) or not isinstance(art_r.get("language_intensity"), dict):
                        valid = False
                        break
                    if not isinstance(art_r["agency_framing"].get("example_phrases", []), list):
                        art_r["agency_framing"]["example_phrases"] = []
                if valid:
                    result = {
                        "articles": [by_id[article_id] for article_id in expected_ids],
                        "stakeholders": stakeholders_result if isinstance(stakeholders_result, list) else [],
                    }
                    _LLM_CACHE[batch_key] = result
                    print(f"  [LLM BATCH] {outlet_name}: {len(result['articles'])} articles, {len(result['stakeholders'])} stakeholders")
                    return result
        except Exception as e:
            print(f"  [LLM BATCH] {outlet_name} attempt {attempt+1} failed: {e}")
            continue

    return None


def extract_stakeholders_with_llm(articles: list[dict], query: str) -> list[dict] | None:
    """Use LLM to extract relevant stakeholders from articles.
    
    Returns list of dicts with keys: name, role, perspective.
    Returns None on failure (caller falls back to spaCy NER).
    """
    import os
    import json

    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        return None

    # Build context: headlines + first 500 chars of each article
    context_parts = []
    for art in articles[:8]:
        text = truncate_for_llm(art.get("full_text") or "", max_chars=500)
        context_parts.append(
            f"[{art.get('outlet_name', 'Unknown')}] {art.get('headline', '')}\n{text}"
        )
    context = "\n\n".join(context_parts)

    try:
        from groq import Groq

        client = Groq(api_key=api_key)

        system_msg = "You extract key stakeholders from news coverage. You MUST return valid JSON only. No markdown, no explanation, just the JSON object."

        user_msg = f"""Given this news coverage of "{query}", extract 4-8 key stakeholders.

These should be people, organizations, and groups who are CENTRAL to this story —
not every entity mentioned. Think: who is affected, who is responsible, who is
quoted, who is taking action.

For each stakeholder provide:
- name: specific name (e.g., "Nepal Ministry of Home Affairs", not just "government")
- role: their role in this story (e.g., "disaster response authority", "affected community")
- perspective: their likely editorial stance (e.g., "official narrative", "affected party")

Coverage context:
{context}

Return ONLY this JSON object with no other text:
{{"stakeholders": [{{"name": "...", "role": "...", "perspective": "..."}}]}}"""

        # Retry up to 2 times on parse failure
        for attempt in range(3):
            response = client.chat.completions.create(
                model="openai/gpt-oss-20b",
                messages=[
                    {"role": "system", "content": system_msg},
                    {"role": "user", "content": user_msg},
                ],
                temperature=0.1,
                max_tokens=1000,
            )
            raw = response.choices[0].message.content or ""
            # Strip markdown fences if present
            cleaned = raw.strip()
            if cleaned.startswith("```"):
                cleaned = cleaned.split("\n", 1)[-1]
            if cleaned.endswith("```"):
                cleaned = cleaned.rsplit("```", 1)[0]
            cleaned = cleaned.strip()

            try:
                parsed = json.loads(cleaned)
                stakeholders = parsed.get("stakeholders", [])
                if isinstance(stakeholders, list) and len(stakeholders) > 0:
                    return stakeholders
            except (json.JSONDecodeError, AttributeError):
                if attempt < 2:
                    continue  # retry
                return None

        print(f"LLM stakeholder extraction: all retries failed, raw response was unparseable")
        return None
    except Exception as e:
        print(f"LLM stakeholder extraction failed: {e}")
        return None
