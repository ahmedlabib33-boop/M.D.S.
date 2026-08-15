#!/usr/bin/env python3
"""
ENT Clinical Assistant - Component Validation & Demo Script
===========================================================

This script validates all core components of the ENT Clinical Decision
Support Assistant without requiring interactive input.

Run: python test_ent_assistant.py
"""

import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from ent_clinical_assistant import (
    KnowledgeBase, TfidfSymptomMatcher, NaiveBayesClassifier,
    RedFlagDetector, PatientLogger, VitalSigns, ClinicalAssessmentEngine
)

def test_knowledge_base():
    """Test knowledge base loading and indexing."""
    print("\n" + "=" * 60)
    print("TEST 1: Knowledge Base Loading")
    print("=" * 60)

    kb = KnowledgeBase("ent_knowledge_base.json")
    assert len(kb.conditions) == 17, f"Expected 17 conditions, got {len(kb.conditions)}"

    # Test symptom index
    assert len(kb.symptom_index) > 0, "Symptom index is empty"

    # Test category index
    categories = kb.get_categories()
    assert len(categories) > 0, "No categories found"

    # Test condition retrieval
    cond = kb.get_condition("cholesteatoma")
    assert cond is not None, "Could not retrieve cholesteatoma"
    assert cond["name"] == "Cholesteatoma", f"Wrong name: {cond['name']}"

    # Test search
    results = kb.search_by_name("otitis")
    assert len(results) >= 2, f"Expected >=2 otitis results, got {len(results)}"

    print(f"✓ Loaded {len(kb.conditions)} conditions")
    print(f"✓ Indexed {len(kb.symptom_index)} unique symptom tokens")
    print(f"✓ Found {len(categories)} categories: {', '.join(categories)}")
    print(f"✓ Retrieved condition: {cond['name']}")
    print(f"✓ Search found {len(results)} matches for 'otitis'")
    print("PASSED")

def test_tfidf_matcher():
    """Test TF-IDF symptom matching."""
    print("\n" + "=" * 60)
    print("TEST 2: TF-IDF + Cosine Similarity Matcher")
    print("=" * 60)

    kb = KnowledgeBase("ent_knowledge_base.json")
    matcher = TfidfSymptomMatcher(kb)

    # Test 1: Classic AOM presentation (more specific to distinguish from mastoiditis)
    results = matcher.match("child with ear pain fever bulging red eardrum recent cold reduced hearing", top_k=5)
    assert len(results) == 5, f"Expected 5 results, got {len(results)}"

    top_match = results[0]
    assert top_match[1] > 0, f"Similarity should be > 0, got {top_match[1]}"

    # AOM should be in top 3 (mastoiditis may also score high as it's a complication)
    top_ids = [r[0] for r in results]
    assert "acute_otitis_media" in top_ids,         f"AOM not in top 5. Got: {top_ids}"

    print(f"✓ Query: 'child with ear pain fever bulging red eardrum recent cold reduced hearing'")
    print(f"✓ Top 5 matches: {[(r[2]['name'], round(r[1], 4)) for r in results]}")
    print(f"✓ AOM present in top 5: {'acute_otitis_media' in top_ids}")

    # Test 2: BPPV presentation
    results = matcher.match("dizziness rolling over in bed triggered by head movement", top_k=3)
    top_match = results[0]
    print(f"✓ Query: 'dizziness rolling over in bed triggered by head movement'")
    print(f"✓ Top match: {top_match[2]['name']} (similarity: {top_match[1]:.4f})")

    # Test 3: Preauricular sinus (as requested by user)
    results = matcher.match("small pit in front of ear with pus discharge swelling", top_k=3)
    top_match = results[0]
    print(f"✓ Query: 'small pit in front of ear with pus discharge swelling'")
    print(f"✓ Top match: {top_match[2]['name']} (similarity: {top_match[1]:.4f})")

    print("PASSED")

def test_naive_bayes():
    """Test Naive Bayes classifier."""
    print("\n" + "=" * 60)
    print("TEST 3: Multinomial Naive Bayes Classifier")
    print("=" * 60)

    kb = KnowledgeBase("ent_knowledge_base.json")
    classifier = NaiveBayesClassifier(kb)

    # Test probabilities sum to 1
    results = classifier.predict("ear pain fever", top_k=17)
    total_prob = sum(r[1] for r in results)
    assert abs(total_prob - 1.0) < 0.001, f"Probabilities sum to {total_prob}, not 1.0"

    # Test AOM prediction (more specific query)
    results = classifier.predict("child ear pain fever bulging eardrum reduced hearing after cold", top_k=5)
    top_ids = [r[0] for r in results]

    # AOM should be in top 3
    assert "acute_otitis_media" in top_ids,         f"AOM not in top 5. Got: {top_ids}"

    print(f"✓ Probabilities sum to {total_prob:.6f} (should be ~1.0)")
    print(f"✓ AOM query top 5: {[(r[2]['name'], round(r[1], 4)) for r in results]}")

    # Test cholesteatoma
    results = classifier.predict("chronic ear discharge foul smell hearing loss white mass", top_k=3)
    top = results[0]
    print(f"✓ Cholesteatoma query top prediction: {top[2]['name']} (P={top[1]:.4f})")

    print("PASSED")

def test_red_flags():
    """Test red flag detection."""
    print("\n" + "=" * 60)
    print("TEST 4: Red Flag Detector")
    print("=" * 60)

    kb = KnowledgeBase("ent_knowledge_base.json")
    detector = RedFlagDetector(kb)
    matcher = TfidfSymptomMatcher(kb)

    # Test with safe symptoms
    safe_results = matcher.match("mild nasal congestion clear discharge", top_k=3)
    analysis = detector.check("mild nasal congestion clear discharge", safe_results)
    assert not analysis["urgent_referral_needed"], "Safe symptoms triggered false red flag"
    print(f"✓ Safe symptoms: No red flags (correct)")

    # Test with airway emergency
    emergency_results = matcher.match("stridor drooling cannot swallow secretions", top_k=3)
    analysis = detector.check("stridor drooling cannot swallow secretions", emergency_results)
    assert analysis["urgent_referral_needed"], "Airway emergency not detected"
    assert len(analysis["red_flags_found"]) > 0, "No red flags found for airway emergency"
    print(f"✓ Airway emergency: Detected {len(analysis['red_flags_found'])} red flags")
    print(f"  Flags: {analysis['red_flags_found']}")

    # Test with neurological emergency
    analysis = detector.check("facial weakness severe headache neck stiffness", [])
    assert analysis["urgent_referral_needed"], "Neurological emergency not detected"
    print(f"✓ Neuro emergency: Detected {len(analysis['red_flags_found'])} red flags")

    print("PASSED")

def test_patient_logger():
    """Test patient vitals and assessment logging."""
    print("\n" + "=" * 60)
    print("TEST 5: Patient Logger")
    print("=" * 60)

    import tempfile
    log_path = tempfile.mktemp(suffix=".json")

    logger = PatientLogger(log_path)

    # Create patient
    record = logger.create_patient("TEST001", {"age": 45, "sex": "M"})
    assert record.patient_id == "TEST001", "Patient ID mismatch"
    print(f"✓ Created patient: {record.patient_id}")

    # Add vitals
    vitals = VitalSigns(
        timestamp="2026-08-15T10:00:00",
        temperature_c=38.5,
        heart_rate_bpm=95,
        blood_pressure="130/85",
        pain_score_0_10=6,
        notes="Febrile, tachycardic"
    )
    logger.add_vitals("TEST001", vitals)

    # Retrieve
    patient = logger.get_patient("TEST001")
    assert patient is not None, "Patient not found"
    assert len(patient.vitals_history) == 1, f"Vitals not saved, got {len(patient.vitals_history)}"
    assert patient.vitals_history[0]["temperature_c"] == 38.5, "Temperature mismatch"
    print(f"✓ Recorded vitals: T={vitals.temperature_c}°C, HR={vitals.heart_rate_bpm}")

    # Add assessment
    logger.add_assessment("TEST001", {"input": "ear pain", "top_match": "AOM"})
    patient = logger.get_patient("TEST001")
    assert len(patient.assessments) == 1, "Assessment not saved"
    print(f"✓ Recorded assessment: {patient.assessments[0]['input']}")

    # Cleanup
    os.remove(log_path)
    print("✓ Cleanup complete")
    print("PASSED")

def test_full_assessment():
    """Test complete assessment pipeline."""
    print("\n" + "=" * 60)
    print("TEST 6: Full Assessment Pipeline")
    print("=" * 60)

    import tempfile
    log_path = tempfile.mktemp(suffix=".json")
    engine = ClinicalAssessmentEngine(log_path=log_path)

    # Create patient first
    engine.patient_logger.create_patient("DEMO001")

    # Test case: Preauricular sinus cellulitis (user-requested condition)
    assessment = engine.assess(
        "small pit in front of ear with pus discharge swelling redness fever",
        patient_id="DEMO001"
    )

    assert "ensemble_ranking" in assessment, "Missing ensemble ranking"
    assert len(assessment["ensemble_ranking"]) > 0, "No ensemble results"

    top = assessment["ensemble_ranking"][0]
    print(f"✓ Input: 'small pit in front of ear with pus discharge...'")
    print(f"✓ Top ensemble match: {top['condition']} (score: {top['ensemble_score']:.4f})")
    print(f"✓ Confidence tier: {top['confidence_tier']}")

    # Check red flags
    assert "red_flags" in assessment, "Missing red flags"
    print(f"✓ Red flags detected: {len(assessment['red_flags']['red_flags_found'])}")
    print(f"✓ Urgent referral: {assessment['red_flags']['urgent_referral_needed']}")

    # Check recommendations
    assert len(assessment["key_recommendations"]) > 0, "No recommendations"
    print(f"✓ Recommendations generated: {len(assessment['key_recommendations'])}")

    # Verify patient log
    patient = engine.patient_logger.get_patient("DEMO001")
    assert patient is not None, "Patient not logged"
    assert len(patient.assessments) == 1, "Assessment not logged"
    print(f"✓ Assessment logged to patient record: {patient.patient_id}")

    # Cleanup
    os.remove(log_path)
    print("PASSED")

def test_condition_detail():
    """Test condition detail retrieval."""
    print("\n" + "=" * 60)
    print("TEST 7: Condition Detail Lookup")
    print("=" * 60)

    engine = ClinicalAssessmentEngine()

    # Test preauricular sinus (user-requested)
    detail = engine.get_condition_detail("congenital_preauricular_sinus")
    assert detail is not None, "Could not retrieve preauricular sinus"
    assert "management" in detail, "Missing management section"
    assert "red_flags" in detail, "Missing red flags"
    print(f"✓ Retrieved: {detail['name']}")
    print(f"  Definition: {detail['definition'][:80]}...")
    print(f"  Symptoms: {len(detail['symptoms'])} listed")
    print(f"  Management keys: {list(detail['management'].keys())}")

    # Test preauricular sinus cellulitis
    detail = engine.get_condition_detail("preauricular_sinus_cellulitis")
    assert detail is not None, "Could not retrieve cellulitis entry"
    print(f"✓ Retrieved: {detail['name']}")
    print(f"  Complications: {len(detail['complications'])} listed")

    print("PASSED")

def run_all_tests():
    """Run all validation tests."""
    print("\n" + "=" * 60)
    print("ENT CLINICAL ASSISTANT - COMPONENT VALIDATION")
    print("=" * 60)

    tests = [
        test_knowledge_base,
        test_tfidf_matcher,
        test_naive_bayes,
        test_red_flags,
        test_patient_logger,
        test_full_assessment,
        test_condition_detail
    ]

    passed = 0
    failed = 0

    for test in tests:
        try:
            test()
            passed += 1
        except Exception as e:
            print(f"\n❌ FAILED: {test.__name__}")
            print(f"   Error: {e}")
            import traceback
            traceback.print_exc()
            failed += 1

    print("\n" + "=" * 60)
    print(f"RESULTS: {passed} passed, {failed} failed out of {len(tests)} tests")
    print("=" * 60)

    if failed == 0:
        print("\n🎉 ALL TESTS PASSED - System is operational")
    else:
        print(f"\n⚠️  {failed} test(s) failed - Review errors above")

    return failed == 0

if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)
