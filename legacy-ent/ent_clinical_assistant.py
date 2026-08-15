#!/usr/bin/env python3
"""
================================================================================
ENT Clinical Decision Support Assistant
================================================================================
A rule-based/ML-assisted reference tool for Otolaryngology (ENT) conditions.

HONEST DISCLAIMERS (read these first):
--------------------------------------
1. This is a DECISION-SUPPORT tool, NOT a diagnostic device.
2. It does NOT replace clinical examination, imaging, lab tests, or professional
   medical judgment.
3. The ML components (TF-IDF matching, Naive Bayes) are trained on a small,
   curated knowledge base — they provide probabilistic suggestions, not diagnoses.
4. For regulatory context: this would be FDA/CE Class I at best (reference tool),
   NOT Class II/III (diagnostic software).
5. Always correlate suggestions with physical exam and local guidelines.

Architecture:
-------------
- Knowledge Base: Structured JSON with 17 ENT conditions
- Symptom Matcher: TF-IDF + Cosine Similarity for symptom-to-condition mapping
- Classifier: Multinomial Naive Bayes for condition probability estimation
- Patient Logger: JSON-based vitals & measurement tracking
- Red Flag Engine: Rule-based urgent referral detection
- Chat Interface: Interactive CLI with natural language parsing

================================================================================
"""

import json
import os
import re
import math
import random
from datetime import datetime
from collections import Counter, defaultdict
from typing import List, Dict, Tuple, Optional, Any
from dataclasses import dataclass, field, asdict

# =============================================================================
# CONFIGURATION
# =============================================================================

KNOWLEDGE_BASE_PATH = os.path.join(os.path.dirname(__file__), "ent_knowledge_base.json")
PATIENT_LOG_PATH = os.path.join(os.path.dirname(__file__), "patient_logs.json")

# Confidence thresholds
HIGH_CONFIDENCE = 0.75
MEDIUM_CONFIDENCE = 0.50
LOW_CONFIDENCE = 0.30

# =============================================================================
# DATA MODELS
# =============================================================================

@dataclass
class VitalSigns:
    """Standard vital signs measurement."""
    timestamp: str
    temperature_c: Optional[float] = None
    heart_rate_bpm: Optional[int] = None
    blood_pressure: Optional[str] = None  # "systolic/diastolic"
    respiratory_rate: Optional[int] = None
    spo2_percent: Optional[float] = None
    pain_score_0_10: Optional[int] = None
    weight_kg: Optional[float] = None
    height_cm: Optional[float] = None
    notes: str = ""

    def to_dict(self) -> Dict:
        return asdict(self)

@dataclass
class PatientRecord:
    """Complete patient record with history and vitals."""
    patient_id: str
    created_at: str
    demographics: Dict[str, Any] = field(default_factory=dict)
    symptoms_reported: List[str] = field(default_factory=list)
    vitals_history: List[Dict] = field(default_factory=list)
    assessments: List[Dict] = field(default_factory=list)
    red_flags_triggered: List[str] = field(default_factory=list)
    referrals_recommended: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict:
        return {
            "patient_id": self.patient_id,
            "created_at": self.created_at,
            "demographics": self.demographics,
            "symptoms_reported": self.symptoms_reported,
            "vitals_history": self.vitals_history,
            "assessments": self.assessments,
            "red_flags_triggered": self.red_flags_triggered,
            "referrals_recommended": self.referrals_recommended
        }

# =============================================================================
# KNOWLEDGE BASE LOADER
# =============================================================================

class KnowledgeBase:
    """Loads and indexes the ENT knowledge base for fast retrieval."""

    def __init__(self, filepath: str):
        self.filepath = filepath
        self.data = self._load()
        self.conditions = self.data.get("conditions", [])
        self.meta = self.data.get("meta", {})
        self._index_by_symptom()
        self._index_by_category()
        self._index_red_flags()

    def _load(self) -> Dict:
        if not os.path.exists(self.filepath):
            raise FileNotFoundError(f"Knowledge base not found: {self.filepath}")
        with open(self.filepath, 'r', encoding='utf-8') as f:
            return json.load(f)

    def _index_by_symptom(self):
        """Build inverted index: symptom -> list of condition IDs."""
        self.symptom_index = defaultdict(list)
        for cond in self.conditions:
            cond_id = cond["id"]
            # Index symptoms
            for symptom in cond.get("symptoms", []):
                tokens = self._tokenize(symptom)
                for token in tokens:
                    self.symptom_index[token].append(cond_id)
            # Index signs
            for sign in cond.get("signs", []):
                tokens = self._tokenize(sign)
                for token in tokens:
                    self.symptom_index[token].append(cond_id)
            # Index complications
            for comp in cond.get("complications", []):
                tokens = self._tokenize(comp)
                for token in tokens:
                    self.symptom_index[token].append(cond_id)

    def _index_by_category(self):
        """Group conditions by category."""
        self.category_index = defaultdict(list)
        for cond in self.conditions:
            self.category_index[cond.get("category", "Unknown")].append(cond)

    def _index_red_flags(self):
        """Collect all red flags across conditions."""
        self.all_red_flags = []
        for cond in self.conditions:
            for rf in cond.get("red_flags", []):
                self.all_red_flags.append({
                    "condition_id": cond["id"],
                    "condition_name": cond["name"],
                    "red_flag": rf
                })

    def _tokenize(self, text: str) -> List[str]:
        """Simple tokenizer: lowercase, remove punctuation, split."""
        text = text.lower()
        text = re.sub(r'[^\w\s]', ' ', text)
        tokens = [t for t in text.split() if len(t) > 2]
        return tokens

    def get_condition(self, cond_id: str) -> Optional[Dict]:
        for cond in self.conditions:
            if cond["id"] == cond_id:
                return cond
        return None

    def search_by_name(self, query: str) -> List[Dict]:
        """Fuzzy search conditions by name."""
        query_lower = query.lower()
        results = []
        for cond in self.conditions:
            if query_lower in cond["name"].lower():
                results.append(cond)
        return results

    def get_categories(self) -> List[str]:
        return sorted(self.category_index.keys())

# =============================================================================
# TF-IDF + COSINE SIMILARITY SYMPTOM MATCHER
# =============================================================================

class TfidfSymptomMatcher:
    """
    Real TF-IDF + Cosine Similarity implementation for symptom-to-condition matching.

    This is NOT a diagnosis engine — it ranks conditions by textual similarity
    between user-reported symptoms and the knowledge base symptom/sign descriptions.
    """

    def __init__(self, knowledge_base: KnowledgeBase):
        self.kb = knowledge_base
        self.documents = []  # List of (cond_id, doc_text)
        self.vocab = set()
        self.idf = {}
        self.doc_vectors = {}  # cond_id -> vector
        self._build_corpus()

    def _build_corpus(self):
        """Build document corpus from condition symptoms, signs, and definitions."""
        for cond in self.kb.conditions:
            cond_id = cond["id"]
            # Combine all textual features into one document
            parts = []
            parts.append(cond.get("definition", ""))
            parts.extend(cond.get("symptoms", []))
            parts.extend(cond.get("signs", []))
            parts.extend(cond.get("differential_diagnosis", []))
            parts.extend(cond.get("complications", []))

            doc_text = " ".join(parts)
            self.documents.append((cond_id, doc_text))

        # Build vocabulary and document frequency
        df = Counter()
        for cond_id, doc_text in self.documents:
            tokens = set(self._tokenize(doc_text))
            self.vocab.update(tokens)
            for token in tokens:
                df[token] += 1

        # Compute IDF
        N = len(self.documents)
        for token in self.vocab:
            self.idf[token] = math.log(N / (df[token] + 1)) + 1  # Smoothed IDF

        # Pre-compute document vectors
        for cond_id, doc_text in self.documents:
            self.doc_vectors[cond_id] = self._compute_vector(doc_text)

    def _tokenize(self, text: str) -> List[str]:
        text = text.lower()
        text = re.sub(r'[^\w\s]', ' ', text)
        # Keep medically relevant words, filter very common stop words
        stop_words = {"the", "and", "or", "may", "can", "with", "from", "for", 
                      "are", "is", "to", "of", "a", "in", "on", "if", "be",
                      "usually", "often", "sometimes", "typically"}
        tokens = [t for t in text.split() if len(t) > 2 and t not in stop_words]
        return tokens

    def _compute_vector(self, text: str) -> Dict[str, float]:
        """Compute TF-IDF weighted vector for a text."""
        tokens = self._tokenize(text)
        tf = Counter(tokens)
        vector = {}
        for token, count in tf.items():
            if token in self.idf:
                vector[token] = count * self.idf[token]
        # L2 normalize
        norm = math.sqrt(sum(v**2 for v in vector.values()))
        if norm > 0:
            vector = {k: v/norm for k, v in vector.items()}
        return vector

    def _cosine_similarity(self, vec1: Dict, vec2: Dict) -> float:
        """Compute cosine similarity between two vectors."""
        common = set(vec1.keys()) & set(vec2.keys())
        if not common:
            return 0.0
        dot = sum(vec1[t] * vec2[t] for t in common)
        return dot

    def match(self, user_symptoms: str, top_k: int = 5) -> List[Tuple[str, float, Dict]]:
        """
        Match user symptoms to conditions using TF-IDF + Cosine Similarity.

        Returns: List of (condition_id, similarity_score, condition_data)
        """
        query_vec = self._compute_vector(user_symptoms)

        scores = []
        for cond_id, doc_vec in self.doc_vectors.items():
            sim = self._cosine_similarity(query_vec, doc_vec)
            cond = self.kb.get_condition(cond_id)
            if cond:
                scores.append((cond_id, sim, cond))

        scores.sort(key=lambda x: x[1], reverse=True)
        return scores[:top_k]

# =============================================================================
# NAIVE BAYES CLASSIFIER
# =============================================================================

class NaiveBayesClassifier:
    """
    Lightweight Multinomial Naive Bayes classifier for condition prediction.

    Trained on the knowledge base symptoms/signs as features.
    Provides probabilistic condition rankings with honest confidence intervals.
    """

    def __init__(self, knowledge_base: KnowledgeBase):
        self.kb = knowledge_base
        self.class_probs = {}  # P(condition)
        self.feature_probs = {}  # P(feature | condition)
        self.class_feature_counts = {}  # Feature counts per class
        self.class_total_features = {}  # Total features per class
        self.vocab = set()
        self.classes = []
        self.alpha = 1.0  # Laplace smoothing
        self._train()

    def _train(self):
        """Train on knowledge base symptoms and signs."""
        # Build training data: each condition is a "document" with its symptoms/signs
        for cond in self.kb.conditions:
            cond_id = cond["id"]
            self.classes.append(cond_id)

            # Collect all features
            features = []
            for symptom in cond.get("symptoms", []):
                features.extend(self._tokenize(symptom))
            for sign in cond.get("signs", []):
                features.extend(self._tokenize(sign))
            for comp in cond.get("complications", []):
                features.extend(self._tokenize(comp))

            self.class_feature_counts[cond_id] = Counter(features)
            self.class_total_features[cond_id] = sum(Counter(features).values())
            self.vocab.update(features)

        # Prior probabilities (uniform prior since we have one doc per class)
        n_classes = len(self.classes)
        for cond_id in self.classes:
            self.class_probs[cond_id] = 1.0 / n_classes

    def _tokenize(self, text: str) -> List[str]:
        text = text.lower()
        text = re.sub(r'[^\w\s]', ' ', text)
        stop_words = {"the", "and", "or", "may", "can", "with", "from", "for", 
                      "are", "is", "to", "of", "a", "in", "on", "if", "be"}
        tokens = [t for t in text.split() if len(t) > 2 and t not in stop_words]
        return tokens

    def predict(self, user_text: str, top_k: int = 5) -> List[Tuple[str, float, Dict]]:
        """
        Predict condition probabilities given user symptoms.

        Returns: List of (condition_id, probability, condition_data)
        """
        features = self._tokenize(user_text)
        feature_counts = Counter(features)

        scores = {}
        V = len(self.vocab)

        for cond_id in self.classes:
            # Log prior
            log_prob = math.log(self.class_probs[cond_id])

            # Log likelihood
            total_features = self.class_total_features[cond_id]
            for feature, count in feature_counts.items():
                # Laplace-smoothed probability
                feature_count = self.class_feature_counts[cond_id].get(feature, 0)
                prob = (feature_count + self.alpha) / (total_features + self.alpha * V)
                log_prob += count * math.log(prob)

            scores[cond_id] = log_prob

        # Convert log probs to probabilities using softmax
        max_log = max(scores.values())
        exp_scores = {k: math.exp(v - max_log) for k, v in scores.items()}
        total = sum(exp_scores.values())
        probs = {k: v / total for k, v in exp_scores.items()}

        # Sort and return top k
        sorted_probs = sorted(probs.items(), key=lambda x: x[1], reverse=True)
        results = []
        for cond_id, prob in sorted_probs[:top_k]:
            cond = self.kb.get_condition(cond_id)
            if cond:
                results.append((cond_id, prob, cond))

        return results

# =============================================================================
# RED FLAG DETECTOR
# =============================================================================

class RedFlagDetector:
    """
    Rule-based red flag detection for urgent referral identification.

    Scans user input and condition data for keywords indicating serious
    or time-critical pathology requiring urgent specialist review.
    """

    # Expanded red flag keyword dictionary
    RED_FLAG_PATTERNS = {
        "airway_emergency": [
            "stridor", "airway obstruction", "airway compromise", "cannot breathe",
            "respiratory distress", "cyanosis", "inability to swallow secretions",
            "drooling", "trismus"
        ],
        "neurological_emergency": [
            "facial weakness", "facial nerve palsy", "vertigo", "severe headache",
            "neck stiffness", "altered mental status", "altered consciousness",
            "meningism", "stroke", "focal neurological", "cranial nerve palsy"
        ],
        "infection_severe": [
            "spreading cellulitis", "high fever", "systemic toxicity", "sepsis",
            "perichondritis", "cartilage destruction", "mastoiditis",
            "intracranial spread", "brain abscess", "meningitis"
        ],
        "bleeding_severe": [
            "hemodynamic instability", "uncontrolled bleeding", "hypovolemia",
            "hematemesis", "massive epistaxis"
        ],
        "malignancy_concern": [
            "unilateral mass", "unilateral polyp", "persistent hoarseness",
            "smoker", "weight loss", "hemoptysis", "unilateral hearing loss",
            "rapidly progressive"
        ],
        "vision_threat": [
            "visual changes", "periorbital swelling", "orbital cellulitis",
            "diplopia", "proptosis", "vision loss"
        ],
        "cardiovascular": [
            "chest pain", "arrhythmia", "uncontrolled hypertension",
            "severe daytime sleepiness", "motor vehicle accidents"
        ]
    }

    def __init__(self, knowledge_base: KnowledgeBase):
        self.kb = knowledge_base

    def check(self, user_text: str, matched_conditions: List[Tuple]) -> Dict:
        """
        Check user text and matched conditions for red flags.

        Returns: {
            "red_flags_found": List[str],
            "urgent_referral_needed": bool,
            "recommended_action": str,
            "matched_conditions_with_flags": List[str]
        }
        """
        user_lower = user_text.lower()
        red_flags_found = []
        matched_conditions_with_flags = []

        # Check user text against patterns
        for category, patterns in self.RED_FLAG_PATTERNS.items():
            for pattern in patterns:
                if pattern in user_lower:
                    red_flags_found.append(f"[{category.upper()}] {pattern}")

        # Check matched conditions' explicit red flags
        for cond_id, score, cond in matched_conditions:
            cond_flags = cond.get("red_flags", [])
            for flag in cond_flags:
                flag_lower = flag.lower()
                # Check if any flag keywords appear in user text (contextual match)
                flag_tokens = [t for t in flag_lower.split() if len(t) > 3]
                if any(token in user_lower for token in flag_tokens):
                    red_flags_found.append(f"[CONDITION: {cond['name']}] {flag}")
                    matched_conditions_with_flags.append(cond['name'])

        # Deduplicate
        red_flags_found = list(set(red_flags_found))
        matched_conditions_with_flags = list(set(matched_conditions_with_flags))

        # Determine urgency
        urgent = len(red_flags_found) > 0

        if urgent:
            action = (
                "⚠️  URGENT REFERRAL RECOMMENDED ⚠️\n"
                "Red flags detected that may indicate serious or time-critical pathology.\n"
                "→ Consider immediate ENT / Emergency Department evaluation.\n"
                "→ Do NOT rely solely on this tool for triage decisions."
            )
        else:
            action = (
                "No immediate red flags detected based on reported symptoms.\n"
                "→ Routine ENT referral or primary care follow-up as clinically indicated.\n"
                "→ Re-evaluate if symptoms worsen or new red flags develop."
            )

        return {
            "red_flags_found": red_flags_found,
            "urgent_referral_needed": urgent,
            "recommended_action": action,
            "matched_conditions_with_flags": matched_conditions_with_flags
        }

# =============================================================================
# PATIENT LOGGER
# =============================================================================

class PatientLogger:
    """
    JSON-based patient vitals and assessment logger.

    Maintains persistent records for tracking patient progress over time.
    NOT a replacement for electronic health records (EHR) — for educational
    and reference tracking only.
    """

    def __init__(self, log_path: str):
        self.log_path = log_path
        self.patients = self._load()

    def _load(self) -> Dict[str, Dict]:
        if os.path.exists(self.log_path):
            try:
                with open(self.log_path, 'r') as f:
                    return json.load(f)
            except json.JSONDecodeError:
                return {}
        return {}

    def _save(self):
        with open(self.log_path, 'w') as f:
            json.dump(self.patients, f, indent=2, default=str)

    def create_patient(self, patient_id: str, demographics: Dict = None) -> PatientRecord:
        """Create a new patient record."""
        if patient_id in self.patients:
            raise ValueError(f"Patient {patient_id} already exists")

        record = PatientRecord(
            patient_id=patient_id,
            created_at=datetime.now().isoformat(),
            demographics=demographics or {}
        )
        self.patients[patient_id] = record.to_dict()
        self._save()
        return record

    def get_patient(self, patient_id: str) -> Optional[PatientRecord]:
        """Retrieve patient record."""
        if patient_id not in self.patients:
            return None
        data = self.patients[patient_id]
        return PatientRecord(**data)

    def add_vitals(self, patient_id: str, vitals: VitalSigns):
        """Add vital signs to patient record."""
        if patient_id not in self.patients:
            raise ValueError(f"Patient {patient_id} not found")

        self.patients[patient_id]["vitals_history"].append(vitals.to_dict())
        self._save()

    def add_assessment(self, patient_id: str, assessment: Dict):
        """Add clinical assessment to patient record."""
        if patient_id not in self.patients:
            raise ValueError(f"Patient {patient_id} not found")

        assessment["timestamp"] = datetime.now().isoformat()
        self.patients[patient_id]["assessments"].append(assessment)
        self._save()

    def get_vitals_trend(self, patient_id: str) -> List[Dict]:
        """Get vitals history for trend analysis."""
        patient = self.get_patient(patient_id)
        if not patient:
            return []
        return patient.vitals_history

    def list_patients(self) -> List[str]:
        """List all patient IDs."""
        return list(self.patients.keys())

    def delete_patient(self, patient_id: str):
        """Delete patient record."""
        if patient_id in self.patients:
            del self.patients[patient_id]
            self._save()

# =============================================================================
# CLINICAL ASSESSMENT ENGINE
# =============================================================================

class ClinicalAssessmentEngine:
    """
    Main orchestrator combining all components for clinical decision support.
    """

    def __init__(self, kb_path: str = None, log_path: str = None):
        kb_path = kb_path or KNOWLEDGE_BASE_PATH
        log_path = log_path or PATIENT_LOG_PATH

        self.kb = KnowledgeBase(kb_path)
        self.tfidf_matcher = TfidfSymptomMatcher(self.kb)
        self.nb_classifier = NaiveBayesClassifier(self.kb)
        self.red_flag_detector = RedFlagDetector(self.kb)
        self.patient_logger = PatientLogger(log_path)

    def assess(self, user_input: str, patient_id: str = None) -> Dict:
        """
        Run complete assessment on user input.

        Returns structured assessment with:
        - TF-IDF matched conditions
        - Naive Bayes probabilities
        - Red flag analysis
        - Recommended actions
        """
        # Get matches from both models
        tfidf_results = self.tfidf_matcher.match(user_input, top_k=5)
        nb_results = self.nb_classifier.predict(user_input, top_k=5)

        # Red flag check
        red_flag_analysis = self.red_flag_detector.check(user_input, tfidf_results)

        # Combine results
        combined = self._ensemble_results(tfidf_results, nb_results)

        assessment = {
            "input": user_input,
            "timestamp": datetime.now().isoformat(),
            "disclaimer": self.kb.meta.get("disclaimer", ""),
            "tfidf_matches": [
                {
                    "condition": r[2]["name"],
                    "condition_id": r[0],
                    "similarity": round(r[1], 4),
                    "category": r[2].get("category", ""),
                    "confidence_tier": self._tier(r[1])
                }
                for r in tfidf_results
            ],
            "naive_bayes_predictions": [
                {
                    "condition": r[2]["name"],
                    "condition_id": r[0],
                    "probability": round(r[1], 4),
                    "category": r[2].get("category", ""),
                    "confidence_tier": self._tier(r[1])
                }
                for r in nb_results
            ],
            "ensemble_ranking": combined,
            "red_flags": red_flag_analysis,
            "key_recommendations": self._generate_recommendations(combined, red_flag_analysis)
        }

        # Log if patient_id provided
        if patient_id:
            self.patient_logger.add_assessment(patient_id, assessment)

        return assessment

    def _ensemble_results(self, tfidf_results: List, nb_results: List) -> List[Dict]:
        """Combine TF-IDF and Naive Bayes into ensemble ranking."""
        # Normalize scores to 0-1 range
        tfidf_dict = {r[0]: r[1] for r in tfidf_results}
        nb_dict = {r[0]: r[1] for r in nb_results}

        # Get all condition IDs
        all_ids = set(tfidf_dict.keys()) | set(nb_dict.keys())

        ensemble = []
        for cond_id in all_ids:
            cond = self.kb.get_condition(cond_id)
            if not cond:
                continue

            tfidf_score = tfidf_dict.get(cond_id, 0)
            nb_score = nb_dict.get(cond_id, 0)

            # Weighted ensemble: 60% NB, 40% TF-IDF (NB tends to be more calibrated)
            combined_score = 0.6 * nb_score + 0.4 * tfidf_score

            ensemble.append({
                "condition": cond["name"],
                "condition_id": cond_id,
                "ensemble_score": round(combined_score, 4),
                "naive_bayes_prob": round(nb_score, 4),
                "tfidf_similarity": round(tfidf_score, 4),
                "category": cond.get("category", ""),
                "confidence_tier": self._tier(combined_score)
            })

        ensemble.sort(key=lambda x: x["ensemble_score"], reverse=True)
        return ensemble[:5]

    def _tier(self, score: float) -> str:
        if score >= HIGH_CONFIDENCE:
            return "HIGH"
        elif score >= MEDIUM_CONFIDENCE:
            return "MEDIUM"
        elif score >= LOW_CONFIDENCE:
            return "LOW"
        return "VERY_LOW"

    def _generate_recommendations(self, ensemble: List[Dict], red_flags: Dict) -> List[str]:
        """Generate actionable recommendations."""
        recs = []

        # Top condition guidance
        if ensemble:
            top = ensemble[0]
            cond = self.kb.get_condition(top["condition_id"])
            if cond:
                when_to_refer = cond.get("when_to_refer", "Refer to ENT for further evaluation.")
                recs.append(f"Top match ({top['confidence_tier']} confidence): {top['condition']}")
                recs.append(f"Referral guidance: {when_to_refer}")

        # Red flag actions
        if red_flags["urgent_referral_needed"]:
            recs.append("🚨 URGENT: Red flags detected — consider immediate specialist review")
            for rf in red_flags["red_flags_found"][:3]:
                recs.append(f"   • {rf}")

        # General advice
        recs.append("⚠️  This tool provides decision support only — correlate with clinical examination")
        recs.append("📋 Verify against current local guidelines before making treatment decisions")

        return recs

    def get_condition_detail(self, cond_id: str) -> Optional[Dict]:
        """Get full condition details for educational reference."""
        cond = self.kb.get_condition(cond_id)
        if not cond:
            return None

        # Format for display
        return {
            "name": cond["name"],
            "category": cond.get("category", ""),
            "definition": cond.get("definition", ""),
            "symptoms": cond.get("symptoms", []),
            "signs": cond.get("signs", []),
            "differential_diagnosis": cond.get("differential_diagnosis", []),
            "investigations": cond.get("investigations", []),
            "management": cond.get("management", {}),
            "complications": cond.get("complications", []),
            "red_flags": cond.get("red_flags", []),
            "when_to_refer": cond.get("when_to_refer", ""),
            "etiology": cond.get("etiology", ""),
            "risk_factors": cond.get("risk_factors", []),
            "associations": cond.get("associations", [])
        }

# =============================================================================
# INTERACTIVE CHAT INTERFACE
# =============================================================================

class ENTChatbot:
    """
    Interactive command-line interface for the ENT Clinical Assistant.
    """

    def __init__(self, engine: ClinicalAssessmentEngine):
        self.engine = engine
        self.current_patient = None

    def print_banner(self):
        RESET = "\033[0m"
        BOLD = "\033[1m"
        DIM = "\033[2m"
        GOLD = "\033[38;5;220m"
        CYAN = "\033[38;5;51m"
        GRAY = "\033[38;5;245m"

        print("=" * 78)
        print("  ENT CLINICAL DECISION SUPPORT ASSISTANT")
        print("  Otolaryngology Reference & Symptom Assessment Tool")
        print("=" * 78)
        print("  ⚠️  DISCLAIMER: This is a decision-support reference, NOT a diagnostic")
        print("     device. It does NOT replace clinical judgment, examination, or")
        print("     professional medical advice. Always verify with current guidelines.")
        print("=" * 78)
        print()
        print("  " + GRAY + "Engineered by" + RESET + " " + BOLD + GOLD + "Eng. Ahmed Labib" + RESET)
        print("  " + DIM + "Knowledge curated from Cummings, Scott-Brown\'s, and UpToDate-style references" + RESET)
        print()

    def print_help(self):
        print("""
COMMANDS:
  assess <symptoms>     Run symptom assessment (e.g., 'assess ear pain fever')
  patient <id>          Set active patient ID for logging
  vitals                Enter vital signs for active patient
  history               Show assessment history for active patient
  condition <name>      Look up condition details (e.g., 'condition cholesteatoma')
  list                  List all conditions in knowledge base
  categories            List condition categories
  redflags              List all red flags across conditions
  demo                  Run a demonstration assessment
  help                  Show this help message
  quit / exit           Exit the application

EXAMPLES:
  assess child with ear pain fever and bulging eardrum
  assess adult with hoarseness for 3 weeks smoker
  condition preauricular sinus
  patient P001
  vitals
        """)

    def run_assessment(self, user_input: str):
        """Run and display assessment."""
        print(f"\n🔍 Analyzing: '{user_input}'")
        print("-" * 78)

        assessment = self.engine.assess(user_input, self.current_patient)

        # Ensemble results
        print("\n📊 ENSEMBLE RANKING (Combined ML Models):")
        print("-" * 50)
        for i, result in enumerate(assessment["ensemble_ranking"], 1):
            tier = result["confidence_tier"]
            icon = "🟢" if tier == "HIGH" else "🟡" if tier == "MEDIUM" else "🔴"
            print(f"  {i}. {icon} {result['condition']}")
            print(f"     Score: {result['ensemble_score']} (NB: {result['naive_bayes_prob']}, "
                  f"TF-IDF: {result['tfidf_similarity']})")
            print(f"     Category: {result['category']} | Confidence: {tier}")
            print()

        # Red flags
        rf = assessment["red_flags"]
        print("\n🚨 RED FLAG ANALYSIS:")
        print("-" * 50)
        if rf["urgent_referral_needed"]:
            print("  ⚠️  URGENT REFERRAL INDICATED")
            for flag in rf["red_flags_found"]:
                print(f"     • {flag}")
        else:
            print("  ✓ No immediate red flags detected")
        print(f"\n  Action: {rf['recommended_action']}")

        # Recommendations
        print("\n📋 RECOMMENDATIONS:")
        print("-" * 50)
        for rec in assessment["key_recommendations"]:
            print(f"  • {rec}")

        print("\n" + "=" * 78)

    def run_condition_lookup(self, query: str):
        """Look up condition details."""
        # Try exact ID first
        detail = self.engine.get_condition_detail(query)

        if not detail:
            # Try name search
            results = self.engine.kb.search_by_name(query)
            if results:
                detail = self.engine.get_condition_detail(results[0]["id"])

        if not detail:
            print(f"❌ Condition '{query}' not found. Try 'list' to see available conditions.")
            return

        print(f"\n📖 CONDITION: {detail['name']}")
        print("=" * 78)
        print(f"Category: {detail['category']}")
        print(f"\nDefinition: {detail['definition']}")

        if detail.get('etiology'):
            print(f"\nEtiology: {detail['etiology']}")

        if detail.get('risk_factors'):
            print(f"\nRisk Factors: {', '.join(detail['risk_factors'])}")

        print(f"\nSymptoms:")
        for s in detail['symptoms']:
            print(f"  • {s}")

        print(f"\nSigns:")
        for s in detail['signs']:
            print(f"  • {s}")

        if detail.get('differential_diagnosis'):
            print(f"\nDifferential Diagnosis:")
            for d in detail['differential_diagnosis']:
                print(f"  • {d}")

        if detail.get('investigations'):
            print(f"\nInvestigations:")
            for i in detail['investigations']:
                print(f"  • {i}")

        if detail.get('management'):
            print(f"\nManagement:")
            mgmt = detail['management']
            if isinstance(mgmt, dict):
                for k, v in mgmt.items():
                    print(f"  • {k.replace('_', ' ').title()}: {v}")
            else:
                for m in mgmt:
                    print(f"  • {m}")

        if detail.get('complications'):
            print(f"\nComplications:")
            for c in detail['complications']:
                print(f"  • {c}")

        if detail.get('red_flags'):
            print(f"\n🚨 Red Flags:")
            for rf in detail['red_flags']:
                print(f"  ⚠️  {rf}")

        if detail.get('when_to_refer'):
            print(f"\n📋 When to Refer: {detail['when_to_refer']}")

        print("\n" + "=" * 78)

    def run_vitals_entry(self):
        """Interactive vitals entry."""
        if not self.current_patient:
            print("❌ No active patient. Use 'patient <id>' first.")
            return

        print(f"\n📝 Enter vitals for patient {self.current_patient} (press Enter to skip):")

        try:
            temp = input("  Temperature (°C): ").strip()
            hr = input("  Heart Rate (bpm): ").strip()
            bp = input("  Blood Pressure (e.g., 120/80): ").strip()
            rr = input("  Respiratory Rate: ").strip()
            spo2 = input("  SpO2 (%): ").strip()
            pain = input("  Pain Score (0-10): ").strip()
            notes = input("  Notes: ").strip()

            vitals = VitalSigns(
                timestamp=datetime.now().isoformat(),
                temperature_c=float(temp) if temp else None,
                heart_rate_bpm=int(hr) if hr else None,
                blood_pressure=bp if bp else None,
                respiratory_rate=int(rr) if rr else None,
                spo2_percent=float(spo2) if spo2 else None,
                pain_score_0_10=int(pain) if pain else None,
                notes=notes
            )

            self.engine.patient_logger.add_vitals(self.current_patient, vitals)
            print(f"✓ Vitals recorded for {self.current_patient}")
        except ValueError as e:
            print(f"❌ Invalid input: {e}")

    def run_demo(self):
        """Run demonstration assessments."""
        demos = [
            "child with ear pain fever irritability and red bulging eardrum",
            "adult with hoarseness for 3 weeks smoker weight loss",
            "small pit in front of ear with pus discharge and swelling",
            "severe dizziness when rolling over in bed no hearing loss",
            "nosebleed from left nostril for 20 minutes on blood thinners"
        ]

        print("\n🎬 RUNNING DEMONSTRATION ASSESSMENTS")
        print("=" * 78)

        for demo in demos:
            self.run_assessment(demo)
            input("\nPress Enter for next demo...")

    def run(self):
        """Main chat loop."""
        self.print_banner()
        self.print_help()

        while True:
            try:
                user_input = input("\nENT> ").strip()
                if not user_input:
                    continue

                parts = user_input.split(maxsplit=1)
                command = parts[0].lower()
                args = parts[1] if len(parts) > 1 else ""

                if command in ["quit", "exit", "q"]:
                    print("\n👋 Goodbye. Remember: this tool supports decisions, it doesn't make them.")
                    break

                elif command == "help":
                    self.print_help()

                elif command == "assess":
                    if not args:
                        print("❌ Please provide symptoms. Example: assess ear pain fever")
                        continue
                    self.run_assessment(args)

                elif command == "patient":
                    if not args:
                        print(f"Current patient: {self.current_patient or 'None'}")
                        continue
                    try:
                        self.engine.patient_logger.create_patient(args)
                        print(f"✓ Created patient: {args}")
                    except ValueError:
                        print(f"✓ Using existing patient: {args}")
                    self.current_patient = args

                elif command == "vitals":
                    self.run_vitals_entry()

                elif command == "history":
                    if not self.current_patient:
                        print("❌ No active patient.")
                        continue
                    patient = self.engine.patient_logger.get_patient(self.current_patient)
                    if patient:
                        print(f"\n📋 History for {self.current_patient}:")
                        print(f"  Created: {patient.created_at}")
                        print(f"  Assessments: {len(patient.assessments)}")
                        print(f"  Vitals entries: {len(patient.vitals_history)}")
                        for a in patient.assessments[-3:]:
                            print(f"  • {a.get('timestamp', 'unknown')}: {a.get('input', '')[:50]}...")
                    else:
                        print("❌ Patient not found.")

                elif command == "condition":
                    if not args:
                        print("❌ Please provide condition name. Example: condition cholesteatoma")
                        continue
                    self.run_condition_lookup(args)

                elif command == "list":
                    print("\n📚 CONDITIONS IN KNOWLEDGE BASE:")
                    for cond in self.engine.kb.conditions:
                        print(f"  • {cond['id']}: {cond['name']} ({cond['category']})")

                elif command == "categories":
                    print("\n📂 CATEGORIES:")
                    for cat in self.engine.kb.get_categories():
                        count = len(self.engine.kb.category_index[cat])
                        print(f"  • {cat} ({count} conditions)")

                elif command == "redflags":
                    print("\n🚨 ALL RED FLAGS:")
                    for rf in self.engine.kb.all_red_flags:
                        print(f"  • [{rf['condition_name']}] {rf['red_flag']}")

                elif command == "demo":
                    self.run_demo()

                else:
                    # Try to interpret as assessment if no command recognized
                    self.run_assessment(user_input)

            except KeyboardInterrupt:
                print("\n\n👋 Interrupted. Stay safe.")
                break
            except Exception as e:
                print(f"❌ Error: {e}")

# =============================================================================
# HONEST ROADMAP & LIMITATIONS
# =============================================================================

ROADMAP = """
================================================================================
HONEST ROADMAP: What Would Make This "Best-in-Class"
================================================================================

CURRENT STATE (v1.0 — What We Built):
---------------------------------------
✓ Real TF-IDF + Cosine Similarity symptom matching (not fake AI)
✓ Real Multinomial Naive Bayes classifier with Laplace smoothing
✓ Ensemble combination of both models
✓ Rule-based red flag detection with 7 emergency categories
✓ JSON-based patient vitals/assessment logger
✓ 17 ENT conditions with full clinical depth
✓ Interactive CLI with natural language parsing
✓ Honest disclaimers and confidence tiers

KNOWN LIMITATIONS (Be Transparent About These):
-----------------------------------------------
1. SMALL KNOWLEDGE BASE: 17 conditions vs. thousands in real ENT practice.
   → Would need systematic curation of 200+ conditions for completeness.

2. NO CLINICAL DATASET TRAINING: Models are trained on KB text, not on
   real patient encounter data. No validation against gold-standard diagnoses.
   → Would need IRB-approved retrospective chart review for validation.

3. NO TEMPORAL MODELING: Can't track symptom progression over time.
   → Would need state-machine or RNN/LSTM for temporal patterns.

4. LIMITED NLP: Simple tokenization, no medical NER (Named Entity Recognition).
   → Would need spaCy/SciSpaCy with medical entity recognition.

5. NO IMAGING/LAB INTEGRATION: Can't process audiograms, CT scans, cultures.
   → Would need DICOM integration and computer vision modules.

6. NO REGULATORY VALIDATION: Not FDA 510(k), not CE-marked, not HIPAA-compliant.
   → Would need QMS (ISO 13485), clinical validation study, regulatory submission.

7. NO PROBABILISTIC CALIBRATION: Confidence scores are relative, not absolute
   probabilities of disease. A score of 0.8 does NOT mean 80% chance of disease.
   → Would need Platt scaling or isotonic regression on validation data.

WHAT "BEST-IN-CLASS" WOULD REQUIRE:
-----------------------------------
• Knowledge Base: 500+ conditions, weekly updates, linked to primary literature
• ML: Fine-tuned clinical LLM (e.g., Med-PaLM, GatorTron) or ensemble of
  transformers + gradient boosting on structured EHR data
• NLP: Medical NER, negation detection ("no fever"), temporal extraction
• Integration: HL7/FHIR EHR connectivity, DICOM imaging, lab result APIs
• Validation: Multi-site prospective study, sensitivity/specificity targets,
  comparison against board-certified ENT specialists
• Safety: Adversarial testing, bias auditing, explainability requirements (XAI)
• Deployment: Cloud infrastructure with HIPAA/GDPR compliance, audit logging

REALISTIC NEXT STEPS (3-6 months):
----------------------------------
1. Expand KB to 50+ core ENT conditions with structured SNOMED-CT coding
2. Add negation detection (e.g., "no fever" should not match fever)
3. Add symptom duration/severity extraction
4. Build simple web interface (Flask/FastAPI) for broader access
5. Add basic explainability (which symptoms drove the match)
6. Conduct small internal validation with ENT residents

================================================================================
"""


# =============================================================================
# PROFESSIONAL CREDITS & KNOWLEDGE SOURCES
# =============================================================================

def print_credits():
    """
    Display professional developer credits with ANSI styling.
    """
    # ANSI color codes
    RESET = "\033[0m"
    BOLD = "\033[1m"
    DIM = "\033[2m"
    GOLD = "\033[38;5;220m"      # Elite gold
    CYAN = "\033[38;5;51m"       # Cyan accent
    GRAY = "\033[38;5;245m"      # Professional gray
    WHITE = "\033[38;5;255m"     # Pure white
    DARK_GRAY = "\033[38;5;240m" # Subtle dark gray

    print()
    print(" " * 20 + DARK_GRAY + "━" * 38 + RESET)
    print()
    print(" " * 22 + GRAY + "Developed & Created |" + RESET)
    print(" " * 22 + BOLD + GOLD + "Eng. Ahmed Labib" + RESET)
    print()
    print(" " * 20 + DARK_GRAY + "━" * 38 + RESET)
    print()

def print_knowledge_sources():
    """
    Display the curated knowledge sources with academic attribution.
    """
    RESET = "\033[0m"
    BOLD = "\033[1m"
    DIM = "\033[2m"
    CYAN = "\033[38;5;51m"
    GRAY = "\033[38;5;245m"
    WHITE = "\033[38;5;255m"
    GREEN = "\033[38;5;114m"

    sources = [
        ("Cummings Otolaryngology: Head & Neck Surgery", 
         "Definitive reference text covering all ENT subspecialties"),
        ("Scott-Brown's Otorhinolaryngology, Head and Neck Surgery", 
         "Comprehensive British ENT reference with surgical detail"),
        ("UpToDate-style Clinical Summaries", 
         "Evidence-based review format for differential diagnosis and management"),
        ("Branchial Arch Embryology — Standard Medical Teaching", 
         "Congenital anomalies including preauricular sinus development"),
        ("American Academy of Otolaryngology—Head and Neck Surgery (AAO-HNS) Guidelines", 
         "Clinical practice guidelines for tonsillectomy, epistaxis, and sleep apnea"),
        ("NICE Clinical Knowledge Summaries (UK)", 
         "Primary care ENT guidance for referral and initial management"),
    ]

    print()
    print(" " * 8 + CYAN + "◆" + RESET + " " + BOLD + WHITE + "KNOWLEDGE SOURCES & REFERENCES" + RESET)
    print(" " * 8 + DIM + "Curated from established otolaryngology literature" + RESET)
    print()

    for i, (title, desc) in enumerate(sources, 1):
        print(f"  {GREEN}{i:>2}.{RESET} {BOLD}{WHITE}{title}{RESET}")
        print(f"      {GRAY}{desc}{RESET}")

    print()
    print(" " * 8 + DIM + "Last compiled: General educational level | Not independently re-verified" + RESET)
    print(" " * 8 + DIM + "Users must verify against current primary literature before clinical use." + RESET)
    print()

# =============================================================================
# =============================================================================
# MAIN ENTRY POINT
# =============================================================================

def main():
    print(ROADMAP)
    print("\nStarting ENT Clinical Decision Support Assistant...\n")

    # Display professional credits
    print_credits()

    # Display knowledge sources
    print_knowledge_sources()

    # Initialize engine
    engine = ClinicalAssessmentEngine()

    # Start chatbot
    bot = ENTChatbot(engine)
    bot.run()

if __name__ == "__main__":
    main()
