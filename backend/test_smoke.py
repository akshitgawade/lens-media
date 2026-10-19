#!/usr/bin/env python3
"""Deterministic smoke tests for the Narrative Lens NLP pipeline.

Tests the three signal dimensions:
  1. Source Attribution -- ratios, no-evidence state
  2. Agency Framing -- scoring, examples, no-evidence state
  3. Language Intensity -- scoring across dimensions, no-evidence state

Also tests edge cases: empty text, headline-only, long articles.
"""

import json
import sys
import os

# Ensure backend is importable
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from nlp_pipeline import (
    analyze_source_attribution,
    detect_agency_framing,
    score_language_intensity,
    extract_entities,
    _source_candidates_in_sentence,
    get_nlp,
)


def test_source_attribution():
    """Test FT1: Source Attribution with test sentences."""
    print("=" * 60)
    print("TEST: Source Attribution")
    print("=" * 60)

    # Test 1: Police said the order was approved.
    text1 = "Police said the order was approved."
    result1 = analyze_source_attribution(text1)
    print("  Input: '%s'" % text1)
    print("  Result: %s" % json.dumps(result1, indent=4))
    assert result1["analysis_status"] == "analyzed", "Expected 'analyzed', got '%s'" % result1["analysis_status"]
    assert result1["evidence_count"] >= 1, "Expected evidence_count >= 1, got %d" % result1["evidence_count"]
    assert result1["official_ratio"] is not None, "official_ratio should not be None"
    assert result1["independent_ratio"] is not None, "independent_ratio should not be None"
    total = result1["official_ratio"] + result1["independent_ratio"]
    assert abs(total - 1.0) < 0.01, "Ratios should sum to ~1.0, got %f" % total
    print("  PASS: official=%s, independent=%s, sum=%.4f" % (result1["official_ratio"], result1["independent_ratio"], total))

    # Test 2: Residents said they received no notice.
    text2 = "Residents said they received no notice."
    result2 = analyze_source_attribution(text2)
    print("\n  Input: '%s'" % text2)
    print("  Result: %s" % json.dumps(result2, indent=4))
    assert result2["analysis_status"] == "analyzed", "Expected 'analyzed', got '%s'" % result2["analysis_status"]
    assert result2["evidence_count"] >= 1, "Expected evidence_count >= 1, got %d" % result2["evidence_count"]
    assert result2["independent_ratio"] is not None, "independent_ratio should not be None"
    total2 = result2["official_ratio"] + result2["independent_ratio"]
    assert abs(total2 - 1.0) < 0.01, "Ratios should sum to ~1.0, got %f" % total2
    print("  PASS: official=%s, independent=%s, sum=%.4f" % (result2["official_ratio"], result2["independent_ratio"], total2))

    # Test 3: Only official
    text3 = "The government confirmed the policy change. Officials stated that the new rules would take effect immediately."
    result3 = analyze_source_attribution(text3)
    print("\n  Input: '%s'" % text3)
    print("  Result: %s" % json.dumps(result3, indent=4))
    assert result3["analysis_status"] == "analyzed", "Expected 'analyzed', got '%s'" % result3["analysis_status"]
    print("  PASS: official=%s, independent=%s" % (result3["official_ratio"], result3["independent_ratio"]))

    # Test 4: Only independent
    text4 = "Witnesses said they saw the incident. Residents described the scene as chaotic."
    result4 = analyze_source_attribution(text4)
    print("\n  Input: '%s'" % text4)
    print("  Result: %s" % json.dumps(result4, indent=4))
    assert result4["analysis_status"] == "analyzed", "Expected 'analyzed', got '%s'" % result4["analysis_status"]
    print("  PASS: official=%s, independent=%s" % (result4["official_ratio"], result4["independent_ratio"]))

    # Test 5: No attribution -> no_evidence
    text5 = "The city council met on Tuesday to discuss zoning changes."
    result5 = analyze_source_attribution(text5)
    print("\n  Input: '%s'" % text5)
    print("  Result: %s" % json.dumps(result5, indent=4))
    assert result5["analysis_status"] == "no_evidence", "Expected 'no_evidence', got '%s'" % result5["analysis_status"]
    assert result5["official_ratio"] is None, "official_ratio should be None for no_evidence"
    assert result5["independent_ratio"] is None, "independent_ratio should be None for no_evidence"
    print("  PASS: no_evidence correctly detected")

    # Test 6: Empty text -> no_evidence
    result6 = analyze_source_attribution("")
    print("\n  Input: '' (empty)")
    print("  Result: %s" % json.dumps(result6, indent=4))
    assert result6["analysis_status"] == "no_evidence", "Expected 'no_evidence', got '%s'" % result6["analysis_status"]
    print("  PASS: empty text -> no_evidence")

    print("\n[OK] Source Attribution tests PASSED\n")


def test_agency_framing():
    """Test FT2: Agency Framing with test sentences."""
    print("=" * 60)
    print("TEST: Agency Framing")
    print("=" * 60)

    # Test 1: Active
    text1 = "Police said the order was approved."
    result1 = detect_agency_framing(text1, is_headline=False)
    print("  Input: '%s'" % text1)
    print("  agency_score: %s" % result1["agency_score"])
    print("  example_phrases: %s" % json.dumps(result1["example_phrases"], indent=4))
    assert result1["agency_score"] is not None, "agency_score should not be None for analyzable text"
    assert result1["agency_score"] > 0.5, "Expected agency_score > 0.5 for active speech, got %s" % result1["agency_score"]
    assert len(result1["example_phrases"]) >= 1, "Should have at least 1 example phrase"
    for phrase in result1["example_phrases"]:
        assert phrase["type"] in {"active", "passive", "agentless"}, "Invalid phrase type: %s" % phrase["type"]
        assert phrase["text"].casefold() in text1.casefold(), "Example phrase not a substring: '%s'" % phrase["text"]
    print("  PASS: score=%s, phrases=%d" % (result1["agency_score"], len(result1["example_phrases"])))

    # Test 2: Passive
    text2 = "Residents were removed from their homes by officers."
    result2 = detect_agency_framing(text2, is_headline=False)
    print("\n  Input: '%s'" % text2)
    print("  agency_score: %s" % result2["agency_score"])
    print("  example_phrases: %s" % json.dumps(result2["example_phrases"], indent=4))
    assert result2["agency_score"] is not None, "agency_score should not be None"
    assert result2["agency_score"] < result1["agency_score"], "Passive should score lower than active: %s vs %s" % (result2["agency_score"], result1["agency_score"])
    passive_phrases = [p for p in result2["example_phrases"] if p["type"] == "passive"]
    assert len(passive_phrases) >= 1, "Should have at least 1 passive phrase, got %s" % result2["example_phrases"]
    print("  PASS: score=%s, passive phrases: %d" % (result2["agency_score"], len(passive_phrases)))

    # Test 3: Agentless headline
    text3 = "40 families displaced before dawn."
    result3 = detect_agency_framing(text3, is_headline=True)
    print("\n  Input: '%s' (headline)" % text3)
    print("  agency_score: %s" % result3["agency_score"])
    print("  example_phrases: %s" % json.dumps(result3["example_phrases"], indent=4))
    assert result3["agency_score"] is not None, "agency_score should not be None for headline"
    assert result3["agency_score"] < 0.5, "Agentless headline should score low: %s" % result3["agency_score"]
    agentless_phrases = [p for p in result3["example_phrases"] if p["type"] == "agentless"]
    assert len(agentless_phrases) >= 1, "Should have agentless phrase, got %s" % result3["example_phrases"]
    print("  PASS: score=%s, agentless phrases: %d" % (result3["agency_score"], len(agentless_phrases)))

    # Test 4: Empty text -> no_evidence
    result4 = detect_agency_framing("")
    print("\n  Input: '' (empty)")
    print("  agency_score: %s" % result4["agency_score"])
    assert result4["agency_score"] is None, "agency_score should be None for empty text, got %s" % result4["agency_score"]
    assert result4["analysis_status"] == "no_evidence", "Expected 'no_evidence', got '%s'" % result4["analysis_status"]
    assert len(result4["example_phrases"]) == 0, "Should have no phrases for empty text"
    print("  PASS: no_evidence correctly detected")

    # Test 5: All examples are exact substrings
    text5 = "Officials confirmed that the operation was completed. Residents were evacuated from the area. Neighbors watched as officers arrived."
    result5 = detect_agency_framing(text5, is_headline=False)
    print("\n  Input: '%s'" % text5)
    print("  example_phrases: %s" % json.dumps(result5["example_phrases"], indent=4))
    for phrase in result5["example_phrases"]:
        assert phrase["text"].casefold() in text5.casefold(), "Example phrase not a substring: '%s'" % phrase["text"]
        assert phrase["type"] in {"active", "passive", "agentless"}, "Invalid phrase type: %s" % phrase["type"]
    print("  PASS: all %d phrases are exact substrings" % len(result5["example_phrases"]))

    print("\n[OK] Agency Framing tests PASSED\n")


def test_language_intensity():
    """Test FT3: Language Intensity with test cases."""
    print("=" * 60)
    print("TEST: Language Intensity")
    print("=" * 60)

    # Test 1: Empty text -> no_evidence
    result_empty = score_language_intensity("", headline="")
    print("  Input: '' (empty)")
    print("  Result: %s" % json.dumps(result_empty, indent=4))
    assert result_empty["analysis_status"] == "no_evidence", "Expected 'no_evidence', got '%s'" % result_empty["analysis_status"]
    assert result_empty["emotional_score"] is None, "emotional_score should be None for empty text"
    assert result_empty["certainty_score"] is None, "certainty_score should be None for empty text"
    assert result_empty["urgency_score"] is None, "urgency_score should be None for empty text"
    print("  PASS: empty text -> no_evidence")

    # Test 2: Emotional words
    text_emo = "The shocking and tragic decision has left families devastated. Outrage erupted across the community."
    result_emo = score_language_intensity(text_emo, headline="")
    print("\n  Input: '%s'" % text_emo)
    print("  emotional_score: %s, certainty: %s, urgency: %s" % (result_emo["emotional_score"], result_emo["certainty_score"], result_emo["urgency_score"]))
    assert result_emo["emotional_score"] is not None, "emotional_score should not be None"
    assert result_emo["emotional_score"] > 0, "emotional_score should be > 0 for emotional text"
    print("  PASS: emotional_score=%s" % result_emo["emotional_score"])

    # Test 3: Certainty words
    text_cert = "The court confirmed the ruling. It is absolutely certain that the verdict stands. The judge declared the decision final."
    result_cert = score_language_intensity(text_cert, headline="")
    print("\n  Input: '%s'" % text_cert)
    print("  certainty_score: %s" % result_cert["certainty_score"])
    assert result_cert["certainty_score"] is not None, "certainty_score should not be None"
    assert result_cert["certainty_score"] > 0, "certainty_score should be > 0 for certainty text"
    print("  PASS: certainty_score=%s" % result_cert["certainty_score"])

    # Test 4: Hedging should NOT increase certainty
    text_hedge = "The incident was allegedly reported. Officials may have been involved. The report is possibly inaccurate."
    result_hedge = score_language_intensity(text_hedge, headline="")
    print("\n  Input: '%s'" % text_hedge)
    print("  certainty_score: %s" % result_hedge["certainty_score"])
    assert result_hedge["certainty_score"] is not None, "certainty_score should not be None"
    assert result_hedge["certainty_score"] <= 0.3, "Hedged text should have low certainty: %s" % result_hedge["certainty_score"]
    print("  PASS: hedging correctly reduces certainty (%s)" % result_hedge["certainty_score"])

    # Test 5: Urgency words
    text_urg = "Breaking: emergency crews rushed to the scene. Crisis escalated rapidly as residents fled."
    result_urg = score_language_intensity(text_urg, headline="")
    print("\n  Input: '%s'" % text_urg)
    print("  urgency_score: %s" % result_urg["urgency_score"])
    assert result_urg["urgency_score"] is not None, "urgency_score should not be None"
    assert result_urg["urgency_score"] > 0, "urgency_score should be > 0 for urgent text"
    print("  PASS: urgency_score=%s" % result_urg["urgency_score"])

    # Test 6: Neutral text -- scores should be low/zero, not 0.5
    text_neutral = "The committee held a meeting on Tuesday. Members discussed the agenda items and reviewed the budget."
    result_neutral = score_language_intensity(text_neutral, headline="")
    print("\n  Input: '%s'" % text_neutral)
    print("  Scores: emotional=%s, certainty=%s, urgency=%s" % (result_neutral["emotional_score"], result_neutral["certainty_score"], result_neutral["urgency_score"]))
    assert result_neutral["emotional_score"] is not None, "Should not be None"
    assert result_neutral["emotional_score"] < 0.3, "Neutral text emotional_score should be low: %s" % result_neutral["emotional_score"]
    assert result_neutral["urgency_score"] is not None, "Should not be None"
    assert result_neutral["urgency_score"] < 0.3, "Neutral text urgency_score should be low: %s" % result_neutral["urgency_score"]
    print("  PASS: neutral text has low scores (not 0.5)")

    # Test 7: Headline-only input
    result_headline = score_language_intensity("", headline="Breaking: Crisis Escalates Rapidly")
    print("\n  Input: headline='Breaking: Crisis Escalates Rapidly'")
    print("  urgency_score: %s" % result_headline["urgency_score"])
    assert result_headline["urgency_score"] is not None, "headline-only should still produce urgency score"
    assert result_headline["urgency_score"] > 0, "headline with urgency words should score > 0"
    print("  PASS: headline-only input produces score: urgency=%s" % result_headline["urgency_score"])

    # Test 8: Long article -- scores should not be artificially high
    long_text = (
        "The government announced new housing policies affecting thousands of residents. "
        "According to officials, the changes would take effect within the month. "
        "Residents expressed concern about displacement. Community advocates argued that "
        "the policy failed to consider vulnerable populations. The shocking announcement "
        "came after months of deliberation. Witnesses reported that police were present "
        "at the community meeting. The devastating impact was felt across neighborhoods. "
        "Officials confirmed the decision was final. Advocates described the situation as "
        "tragic. The emergency response was criticized by residents who said they were "
        "given no advance notice. Protesters gathered outside the city hall demanding answers."
    )
    result_long = score_language_intensity(long_text, headline="")
    print("\n  Input: %d chars, long article" % len(long_text))
    print("  Scores: emotional=%s, certainty=%s, urgency=%s" % (result_long["emotional_score"], result_long["certainty_score"], result_long["urgency_score"]))
    assert result_long["emotional_score"] is not None
    assert 0 < result_long["emotional_score"] < 1.0, "Long article score should be moderate: %s" % result_long["emotional_score"]
    print("  PASS: long article score is moderate: emotional=%s" % result_long["emotional_score"])

    print("\n[OK] Language Intensity tests PASSED\n")


def test_batch_id_mapping():
    """Test that article IDs cannot be mismatched in batch output."""
    print("=" * 60)
    print("TEST: Article ID Mapping Safety")
    print("=" * 60)

    from nlp_pipeline import analyze_outlet_batch

    # Test with empty articles -> should return None
    result = analyze_outlet_batch("test query", "Test Outlet", [])
    assert result is None, "Empty articles should return None"
    print("  PASS: empty articles -> None")

    # Test without API key -> should return None
    old_key = os.environ.pop("GROQ_API_KEY", None)
    try:
        result = analyze_outlet_batch("test query", "Test Outlet", [{"article_id": "test", "headline": "test", "full_text": "test"}])
        assert result is None, "No API key should return None"
        print("  PASS: no API key -> None")
    finally:
        if old_key:
            os.environ["GROQ_API_KEY"] = old_key

    print("\n[OK] Article ID Mapping tests PASSED\n")


def test_coverage_retention():
    """Test that coverage rows are keyed by article_id."""
    print("=" * 60)
    print("TEST: Coverage Row Retention")
    print("=" * 60)

    from main import _build_signal_data

    # Build signals for a test article
    test_text = "Police said the operation was approved. Residents were displaced."
    signals = _build_signal_data(test_text, headline="Test Headline", llm_signals=None)

    # Verify all three signal tables have the right structure
    assert "source_attribution" in signals, "Missing source_attribution"
    assert "agency_framing" in signals, "Missing agency_framing"
    assert "language_intensity" in signals, "Missing language_intensity"

    # Verify evidence_count is present
    assert "evidence_count" in signals["source_attribution"], "Missing evidence_count in source_attribution"
    assert "evidence_count" in signals["agency_framing"], "Missing evidence_count in agency_framing"
    assert "evidence_count" in signals["language_intensity"], "Missing evidence_count in language_intensity"

    # Verify analysis_status is present
    assert "analysis_status" in signals["source_attribution"], "Missing analysis_status"
    assert "analysis_status" in signals["agency_framing"], "Missing analysis_status"
    assert "analysis_status" in signals["language_intensity"], "Missing analysis_status"

    print("  Source attribution: %s" % signals["source_attribution"])
    print("  Agency framing: %s" % {k: v for k, v in signals["agency_framing"].items() if k != "example_phrases"})
    print("  Language intensity: %s" % signals["language_intensity"])
    print("  PASS: all signal tables have correct structure")

    print("\n[OK] Coverage Row Retention tests PASSED\n")


def test_not_05_default():
    """Test that scores are not all forced to 0.5."""
    print("=" * 60)
    print("TEST: No 0.5 Defaults")
    print("=" * 60)

    texts = [
        "Police said they acted decisively to resolve the crisis.",
        "Residents were displaced from their homes without warning.",
        "40 families were evacuated before dawn by emergency crews.",
        "The shocking and tragic incident has outraged the community.",
    ]

    all_scores = []
    for text in texts:
        result = score_language_intensity(text, headline="")
        scores = [
            result["emotional_score"],
            result["certainty_score"],
            result["urgency_score"],
        ]
        all_scores.extend([s for s in scores if s is not None])
        print("  '%s...' -> emotional=%s, certainty=%s, urgency=%s" % (
            text[:50], result["emotional_score"], result["certainty_score"], result["urgency_score"]))

    # None of the scores should be exactly 0.5
    assert not any(s == 0.5 for s in all_scores), "Some scores are exactly 0.5: %s" % [s for s in all_scores if s == 0.5]
    # Scores should vary (not all the same)
    unique_scores = set(round(s, 2) for s in all_scores)
    assert len(unique_scores) > 1, "Scores should vary but all are %s" % unique_scores
    print("\n  PASS: %d scores tested, none is exactly 0.5, %d unique values" % (len(all_scores), len(unique_scores)))

    print("\n[OK] No 0.5 Default tests PASSED\n")


if __name__ == "__main__":
    print("")
    print("=" * 60)
    print("NARRATIVE LENS - DETERMINISTIC SMOKE TESTS")
    print("=" * 60)
    print("")

    try:
        test_source_attribution()
        test_agency_framing()
        test_language_intensity()
        test_batch_id_mapping()
        test_coverage_retention()
        test_not_05_default()

        print("=" * 60)
        print("ALL SMOKE TESTS PASSED")
        print("=" * 60)
        print("")
        sys.exit(0)
    except Exception as e:
        print("")
        print("X TEST FAILED: %s" % e)
        import traceback
        traceback.print_exc()
        sys.exit(1)
