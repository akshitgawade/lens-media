from __future__ import annotations

import re
import hashlib
from html import unescape
from urllib.request import Request, urlopen
from datetime import datetime, timedelta, timezone
from typing import Literal

import feedparser
import trafilatura

# ── Outlet RSS Registry ──────────────────────────────────────────────────────
# Each entry: (name, rss_url, authority_tier, editorial_stance)
# Only outlets with verified working RSS feeds.

OUTLETS: list[dict[str, str]] = [
    {
        "name": "NDTV",
        "rss_url": "https://feeds.feedburner.com/ndtvnews-top-stories",
        "authority_tier": "broadcast",
        "editorial_stance": "Centrist, data-driven",
    },
    {
        "name": "India Today",
        "rss_url": "https://www.indiatoday.in/rss/home",
        "authority_tier": "broadcast",
        "editorial_stance": "Mainstream, visual-first",
    },
    {
        "name": "Hindustan Times",
        "rss_url": "https://www.hindustantimes.com/feeds/rss/india-news/rssfeed.xml",
        "authority_tier": "legacy",
        "editorial_stance": "Moderate, establishment",
    },
    {
        "name": "Times of India",
        "rss_url": "https://timesofindia.indiatimes.com/rssfeedstopstories.cms",
        "authority_tier": "mass_market",
        "editorial_stance": "Commercial, broad appeal",
    },
    {
        "name": "Indian Express",
        "rss_url": "https://indianexpress.com/feed/",
        "authority_tier": "independent",
        "editorial_stance": "Balanced, investigative",
    },
    {
        "name": "The Hindu",
        "rss_url": "https://www.thehindu.com/feeder/default.rss",
        "authority_tier": "legacy",
        "editorial_stance": "Conservative, institutional",
    },
]

# Outlet domains for Google News RSS dorking
OUTLET_DOMAINS: dict[str, str] = {
    "NDTV": "ndtv.com",
    "India Today": "indiatoday.in",
    "Hindustan Times": "hindustantimes.com",
    "Times of India": "timesofindia.indiatimes.com",
    "Indian Express": "indianexpress.com",
    "The Hindu": "thehindu.com",
}


# ── Config ───────────────────────────────────────────────────────────────────
MAX_ARTICLE_AGE_DAYS = 7  # only articles from last week
SEARCH_DAYS = 2  # 48-hour window for dorking + recent RSS


# ── RSS Parsing ──────────────────────────────────────────────────────────────

def _parse_rss_date(entry: feedparser.FeedParserDict) -> str | None:
    """Extract published_at as ISO string from an RSS entry."""
    raw = entry.get("published_parsed") or entry.get("updated_parsed")
    if raw:
        try:
            dt = datetime(*raw[:6], tzinfo=timezone.utc)
            return dt.isoformat()
        except Exception:
            pass
    # Fallback: try to parse the string
    for field in ("published", "updated"):
        val = entry.get(field, "")
        if val:
            try:
                from email.utils import parsedate_to_datetime
                return parsedate_to_datetime(val).isoformat()
            except Exception:
                pass
    return None


def fetch_rss_articles(outlet: dict[str, str], max_articles: int = 20) -> list[dict]:
    """Fetch articles from an outlet's RSS feed.
    
    Returns list of dicts with keys:
        url, headline, description, published_at, outlet_name
    Full text is NOT fetched here — call extract_full_text() separately.
    The description field is captured from RSS as fallback text for when
    trafilatura fails (e.g., NDTV anti-bot pages).
    """
    try:
        feed = feedparser.parse(outlet["rss_url"])
        articles = []
        seen_urls: set[str] = set()
        cutoff = datetime.now(timezone.utc) - timedelta(days=MAX_ARTICLE_AGE_DAYS)

        # Log feed status
        feed_status = feed.get("status", "none")
        feed_bozo = feed.get("bozo", False)
        if feed_bozo:
            print(f"  RSS [{outlet['name']}]: bozo=True, status={feed_status}, "
                  f"exception={feed.get('bozo_exception', 'unknown')}")
        elif not feed.entries and isinstance(feed_status, int) and feed_status >= 400:
            print(f"  RSS [{outlet['name']}]: HTTP {feed_status} — feed may be blocked")
        else:
            print(f"  RSS [{outlet['name']}]: status={feed_status}, entries={len(feed.entries)}")

        for entry in feed.entries[:max_articles]:
            url = entry.get("link", "")
            if not url or url in seen_urls:
                continue
            seen_urls.add(url)

            headline = entry.get("title", "").strip()
            if not headline:
                continue

            published_at = _parse_rss_date(entry)

            # Capture RSS description/summary as fallback text
            description = ""
            for desc_field in ("summary", "description"):
                raw_desc = entry.get(desc_field, "")
                if raw_desc:
                    # Strip HTML tags from description
                    description = unescape(re.sub(r"<[^>]+>", "", raw_desc)).strip()
                    if description:
                        break

            # Skip articles older than MAX_ARTICLE_AGE_DAYS
            if published_at:
                try:
                    pub_dt = datetime.fromisoformat(published_at.replace("Z", "+00:00"))
                    if pub_dt.tzinfo is None:
                        pub_dt = pub_dt.replace(tzinfo=timezone.utc)
                    if pub_dt < cutoff:
                        continue
                except Exception:
                    pass  # keep article if we can't parse date

            articles.append({
                "url": url,
                "headline": headline,
                "description": description,
                "published_at": published_at or datetime.now(timezone.utc).isoformat(),
                "outlet_name": outlet["name"],
                "outlet_id": "",  # filled by caller after DB lookup
            })

        return articles
    except Exception as e:
        print(f"RSS fetch failed for {outlet['name']}: {e}")
        return []


# ── Full-Text Extraction ─────────────────────────────────────────────────────


def extract_full_text(url: str) -> str | None:
    """Extract article body text from a URL using trafilatura.
    
    Returns cleaned text or None if extraction fails.
    trafilatura handles: boilerplate removal, paywall snippets (partial),
    encoding issues, and most Indian news site layouts.
    """
    try:
        downloaded = trafilatura.fetch_url(url)
        if not downloaded:
            # Some outlets reject trafilatura's default user agent. Keep this
            # fallback bounded so a slow or oversized page cannot stall a job.
            request = Request(
                url,
                headers={
                    "User-Agent": "Mozilla/5.0 (compatible; NarrativeLens/1.0; +https://narrative-lens.app)",
                    "Accept": "text/html,application/xhtml+xml",
                },
            )
            with urlopen(request, timeout=15) as response:
                downloaded = response.read(4_000_000).decode("utf-8", errors="ignore")
        if not downloaded:
            print(f"    trafilatura fetch returned None for {url[:80]}")
            return None
        text = trafilatura.extract(
            downloaded,
            include_comments=False,
            include_tables=False,
            no_fallback=False,
            favor_recall=True,
        )
        if text and len(text) > 80:
            return text.strip()
        print(f"    trafilatura extracted only {len(text or '')} chars from {url[:80]}")
        return None
    except Exception as e:
        print(f"Text extraction failed for {url}: {e}")
        return None


# ── Relevance Matching ───────────────────────────────────────────────────────

# Common words that shouldn't drive relevance alone
# NOTE: "india", "indian", "delhi" are NOT here — they're meaningful for Indian news queries
STOP_WORDS = {
    "the", "and", "for", "are", "but", "not", "you", "all", "can", "had",
    "her", "was", "one", "our", "out", "has", "his", "how", "its", "may",
    "new", "now", "old", "see", "way", "who", "why", "did", "get", "let",
    "say", "she", "too", "use", "says", "report", "news", "today", "year",
    "years", "also", "been", "from", "with", "that", "this", "will", "more",
    "than", "some", "like", "just", "over", "such", "after", "first", "last",
}


def _simple_stem(word: str) -> str:
    """Strip common English suffixes for rough matching."""
    for suffix in ("tion", "sion", "ment", "ness", "ing", "ied", "ies", "ous", "ive", "ful", "less", "able", "ible", "ly", "ed", "er", "est", "es", "s"):
        if word.endswith(suffix) and len(word) - len(suffix) >= 3:
            return word[: -len(suffix)]
    return word


def keyword_relevance(query: str, headline: str, body: str | None) -> float:
    """Keyword overlap score between query and article.

    Returns 0.0-1.0. Headline matches count 2x to prioritize headline relevance.
    Uses simple stem matching so "floods" matches "flood", "killed" matches "kill".
    """
    raw_query_words = set(re.findall(r"\b\w{3,}\b", query.lower())) - STOP_WORDS
    if not raw_query_words:
        return 0.0

    # Build stem map: stem -> original query word
    query_stems = {_simple_stem(w): w for w in raw_query_words}

    headline_lower = headline.lower()
    headline_words = set(re.findall(r"\b\w{3,}\b", headline_lower))

    # Headline match: stem-based overlap
    headline_stems_hit = set()
    for hw in headline_words:
        hw_stem = _simple_stem(hw)
        for qs, orig in query_stems.items():
            if hw_stem == qs or hw_stem.startswith(qs) or qs.startswith(hw_stem):
                headline_stems_hit.add(orig)
                break

    if not headline_stems_hit:
        return 0.0  # reject articles where headline has zero meaningful query words

    body_lower = (body or "").lower()
    body_words = set(re.findall(r"\b\w{3,}\b", body_lower))
    body_stems_hit = set()
    for bw in body_words:
        bw_stem = _simple_stem(bw)
        for qs, orig in query_stems.items():
            if bw_stem == qs or bw_stem.startswith(qs) or qs.startswith(bw_stem):
                body_stems_hit.add(orig)
                break

    # Score: headline matches weighted 2x
    total = len(headline_stems_hit) * 2 + len(body_stems_hit)
    max_score = len(query_stems) * 3
    return min(1.0, total / max_score)


def llm_relevance(query: str, headline: str, outlet_name: str) -> float:
    """Use Groq to score how relevant an article is to the query.
    
    Returns 0.0-1.0. More accurate than keyword matching but slower.
    Used as a second pass after keyword pre-filtering.
    """
    import os
    import json

    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        return 0.5  # assume relevant if no LLM available

    try:
        from groq import Groq
        client = Groq(api_key=api_key)

        response = client.chat.completions.create(
            model="openai/gpt-oss-20b",
            messages=[
                {"role": "system", "content": "Respond with JSON only: {\"score\": <float 0.0-1.0>}"},
                {"role": "user", "content": f"Query: {query}\nHeadline: {headline}\nOutlet: {outlet_name}\nHow relevant is this article to the query? Score 0-1."},
            ],
            response_format={"type": "json_object"},
            temperature=0.1,
        )
        result = json.loads(response.choices[0].message.content)
        return max(0.0, min(1.0, float(result.get("score", 0.5))))
    except Exception as e:
        print(f"    LLM relevance failed for '{headline[:50]}': {e}")
        return 0.5


# ── Google News RSS Dorking ──────────────────────────────────────────

def _headline_key(headline: str) -> str:
    words = [w.lower() for w in re.findall(r"\b\w{4,}\b", headline)]
    return " ".join(words[:4])


def search_google_news_rss(
    query: str,
    outlet_name: str,
    outlet_domain: str,
    days: int = 2,
    max_results: int = 10,
) -> list[dict]:
    from urllib.parse import quote
    articles = []
    seen_headlines: set[str] = set()
    encoded_query = quote(f"site:{outlet_domain} {query}")
    rss_url = f"https://news.google.com/rss/search?q={encoded_query}&hl=en-IN&gl=IN&ceid=IN%3Aen"
    try:
        feed = feedparser.parse(rss_url)
        if not feed.entries:
            print(f"  [GNEWS] {outlet_name}: 0 entries")
            return []
        cutoff = datetime.now(timezone.utc) - timedelta(days=days)
        for entry in feed.entries[:max_results * 5]:
            title = entry.get("title", "").strip()
            if not title: continue
            clean_title = re.sub(r"\s*[-–—]\s*" + re.escape(outlet_name) + r"\s*$", "", title, flags=re.IGNORECASE).strip()
            if not clean_title: clean_title = title
            hkey = _headline_key(clean_title)
            if hkey in seen_headlines: continue
            seen_headlines.add(hkey)
            published_at = None
            published_str = entry.get("published", "")
            if published_str:
                try:
                    from email.utils import parsedate_to_datetime
                    pub_dt = parsedate_to_datetime(published_str)
                    if pub_dt.tzinfo is None: pub_dt = pub_dt.replace(tzinfo=timezone.utc)
                    published_at = pub_dt.isoformat()
                    if pub_dt < cutoff: continue
                except: pass
            description = ""
            for desc_field in ("summary", "description"):
                raw_desc = entry.get(desc_field, "")
                if raw_desc:
                    description = unescape(re.sub(r"<[^>]+>", "", raw_desc)).strip()
                    description = re.sub(r"\s+" + re.escape(outlet_name) + r"\s*$", "", description, flags=re.IGNORECASE).strip()
                    if description: break
            articles.append({
                "url": "",
                "headline": clean_title,
                "description": description,
                "published_at": published_at or datetime.now(timezone.utc).isoformat(),
                "outlet_name": outlet_name,
                "outlet_id": "",
                "source": "gnews",
                "gnews_url": entry.get("link", ""),
                "_hkey": hkey,
            })
            if len(articles) >= max_results: break
        print(f"  [GNEWS] {outlet_name}: {len(articles)} articles")
        return articles
    except Exception as e:
        print(f"  [GNEWS] {outlet_name} failed: {e}")
        return []


def _merge_rss_and_gnews(
    rss_articles: list[dict],
    gnews_articles: list[dict],
) -> list[dict]:
    merged: list[dict] = list(rss_articles)
    rss_hkeys: set[str] = set()
    for art in rss_articles:
        rss_hkeys.add(_headline_key(art.get("headline", "")))
    gnews_added = 0
    for art in gnews_articles:
        hkey = art.get("_hkey", _headline_key(art.get("headline", "")))
        if hkey not in rss_hkeys:
            art.pop("_hkey", None)
            merged.append(art)
            gnews_added += 1
    if gnews_added:
        print(f"  [MERGE] Added {gnews_added} Google News-only articles")
    return merged

# ── Main Search Pipeline ─────────────────────────────────────────────────────

def search_outlet(
    query: str,
    outlet: dict[str, str],
    max_results: int = 3,
    use_llm: bool = True,
) -> list[dict]:
    """Search a single outlet for articles matching the query.
    
    Pipeline:
    1. Fetch RSS feed (includes description fallback text)
    2. Google News RSS for additional coverage (48h window)
    3. Merge + deduplicate by URL
    4. Keyword pre-filter (score > 0.2)
    5. Extract full text via trafilatura, fallback to RSS/DDG description
    6. Return top N articles with text content
    
    LLM relevance scoring is now handled in the batch analysis step
    (nlp_pipeline.analyze_outlet_batch), not per-article here.
    
    Returns list of dicts matching the Article schema:
        url, headline, full_text, published_at, outlet_name, outlet_id
    """
    # 1. Fetch RSS
    rss_articles = fetch_rss_articles(outlet)
    print(f"  [{outlet['name']}] RSS entries: {len(rss_articles)}")

    # 2. Google News RSS for broader coverage (48h window)
    outlet_domain = OUTLET_DOMAINS.get(outlet["name"], "")
    gnews_articles = []
    if outlet_domain:
        gnews_articles = search_google_news_rss(
            query=query,
            outlet_name=outlet["name"],
            outlet_domain=outlet_domain,
            days=SEARCH_DAYS,
            max_results=10,
        )

    # 3. Merge + deduplicate
    articles = _merge_rss_and_gnews(rss_articles, gnews_articles)
    if not articles:
        print(f"  [{outlet['name']}] No articles returned")
        return []

    print(f"  [{outlet['name']}] After merge: {len(articles)} total ({len(rss_articles)} RSS + {len(gnews_articles)} gnews)")

    # 4. Keyword pre-filter
    scored = []
    for art in articles:
        score = keyword_relevance(query, art["headline"], art.get("description"))
        if score >= 0.2:
            scored.append((score, art))

    scored.sort(key=lambda x: x[0], reverse=True)
    candidates = [art for _, art in scored[:max_results * 2]]
    print(f"  [{outlet['name']}] After keyword filter: {len(candidates)} candidates")

    # 5. Extract full text with description fallback
    results = []
    for art in candidates:
        url = art.get("url", "")
        if not url:
            fallback_parts = [art.get("headline", "")]
            if art.get("description"):
                fallback_parts.append(art["description"])
            art["full_text"] = " ".join(filter(None, fallback_parts))
            art["extraction_quality"] = "partial" if art.get("description") else "headline_only"
            print(f"    [gnews] Using headline+description for: {art['headline'][:60]}")
        else:
            body = extract_full_text(url)
            if body:
                art["full_text"] = body
                art["extraction_quality"] = "full" if len(body) >= 500 else "partial"
            else:
                fallback_parts = [art.get("headline", "")]
                if art.get("description"):
                    fallback_parts.append(art["description"])
                art["full_text"] = " ".join(filter(None, fallback_parts))
                art["extraction_quality"] = "partial" if art.get("description") else "headline_only"
                if art["full_text"] != art.get("headline", ""):
                    print(f"    Using description fallback for: {art['headline'][:60]}")
                else:
                    print(f"    No text available (headline only): {art['headline'][:60]}")

        art["keyword_score"] = keyword_relevance(query, art["headline"], art.get("full_text"))
        results.append(art)
        if len(results) >= max_results:
            break

    print(f"  [{outlet['name']}] Results for batch analysis: {len(results)}")
    return results


def search_all_outlets(
    query: str,
    selected_outlets: list[str] | None = None,
    max_per_outlet: int = 2,
    use_llm: bool = True,
) -> list[dict]:
    """Search across all (or selected) outlets for articles matching query.
    
    Note: LLM relevance is now handled in batch analysis (main.py),
    not per-article in the scraper. use_llm param is kept for API
    compatibility but no longer triggers per-article LLM calls.
    
    Args:
        query: user's search topic
        selected_outlets: list of outlet names to search (None = all)
        max_per_outlet: max articles per outlet
        use_llm: no longer used for per-article relevance (kept for API compat)
    
    Returns: flat list of article dicts sorted by keyword relevance
    """
    outlets_to_search = OUTLETS
    if selected_outlets:
        outlets_to_search = [o for o in OUTLETS if o["name"] in selected_outlets]

    all_articles = []
    for outlet in outlets_to_search:
        results = search_outlet(query, outlet, max_per_outlet, use_llm=False)
        all_articles.extend(results)

    # Sort by keyword relevance
    all_articles.sort(
        key=lambda a: (a.get("keyword_score", 0), a.get("published_at", "")),
        reverse=True,
    )
    return all_articles
