#!/usr/bin/env python3
"""
================================================================================
ENT iOS LiDAR Measurement Importer
================================================================================

Integrates iPhone 15 Pro Max (and other LiDAR-equipped iPhones) body
measurements into the ENT Clinical Assistant patient logger.

HOW IT WORKS:
-------------
1. iOS app (ios_lidar_measurement.swift) captures measurements using:
   - LiDAR depth sensor (scene reconstruction + person segmentation)
   - TrueDepth camera (structured light for facial detail)
   - ARKit plane detection (for height/reference)

2. iOS app exports JSON via AirDrop / Share Sheet / iCloud

3. This module imports the JSON and converts measurements into VitalSigns
   entries in the patient logger.

HONEST ACCURACY SPECIFICATIONS:
--------------------------------
Measurement              | Accuracy        | Method               | Clinical Use
-------------------------|-----------------|----------------------|------------------
Neck circumference       | ±0.5–1.0 cm     | LiDAR depth + seg    | OSA screening trend
Facial width             | ±1–2 mm         | TrueDepth / LiDAR    | Reconstructive planning
Facial asymmetry         | ±1–2 mm         | TrueDepth / LiDAR    | Post-surgical follow-up
Pinna (ear) dimensions   | ±1–2 mm         | LiDAR close-range    | Reconstructive planning
Head circumference       | ±0.5–1.0 cm     | LiDAR point cloud    | Pediatric screening
Height                   | ±1–2 cm         | ARKit plane + seg    | BMI calculation
Body part distances*     | ±1–2 mm         | LiDAR depth          | Surgical planning
3D mesh scan             | ±1% scale       | LiDAR reconstruction | Visualization only

* e.g., interpupillary distance, tragus-to-nasion, ear position

NOT MEASURABLE with iPhone 15 Pro Max:
- Internal body temperature (no thermal sensor)
- Blood pressure (no validated clinical PPG)
- SpO2 (no clinical pulse oximeter)
- Weight (no load cells)
- Heart sounds (microphone not stethoscope-grade)
- Audiometry / hearing thresholds

================================================================================
"""

import json
import os
from datetime import datetime
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass

# Import from main module
from ent_clinical_assistant import PatientLogger, VitalSigns, ClinicalAssessmentEngine


@dataclass
class iOSMeasurementEntry:
    """Parsed iOS measurement entry."""
    name: str
    value: float
    unit: str
    method: str
    confidence: str
    raw_value: Optional[float]
    capture_distance_m: Optional[float]
    number_of_frames: Optional[int]


class iOSMeasurementImporter:
    """
    Imports iPhone LiDAR/TrueDepth measurements into the patient logger.
    """

    # Mapping from iOS measurement names to patient logger vital sign fields
    MEASUREMENT_MAP = {
        "neck_circumference_cm": {
            "vital_field": None,  # Custom measurement, stored in notes
            "display_name": "Neck Circumference",
            "clinical_relevance": "OSA screening, trend tracking",
            "normal_range": "Male: 37-42cm, Female: 34-38cm (adults)"
        },
        "facial_width_cm": {
            "vital_field": None,
            "display_name": "Facial Width (Bizygomatic)",
            "clinical_relevance": "Reconstructive surgery baseline, asymmetry detection",
            "normal_range": "Adult male: 13.5-15.5cm, female: 12.5-14.5cm"
        },
        "facial_asymmetry_mm": {
            "vital_field": None,
            "display_name": "Facial Asymmetry",
            "clinical_relevance": "Post-trauma/surgical follow-up, congenital anomaly tracking",
            "normal_range": "<3mm considered normal"
        },
        "height_cm": {
            "vital_field": "height_cm",
            "display_name": "Height",
            "clinical_relevance": "BMI calculation, growth tracking",
            "normal_range": "Age and sex dependent"
        },
        "head_circumference_cm": {
            "vital_field": None,
            "display_name": "Head Circumference",
            "clinical_relevance": "Pediatric growth, craniofacial anomaly assessment",
            "normal_range": "Adult male: 55-58cm, female: 53-56cm"
        },
        "pinna_height_mm": {
            "vital_field": None,
            "display_name": "Pinna (Ear) Height",
            "clinical_relevance": "Reconstructive surgery planning, microtia assessment",
            "normal_range": "Adult: 55-65mm"
        },
        "pinna_width_mm": {
            "vital_field": None,
            "display_name": "Pinna (Ear) Width",
            "clinical_relevance": "Reconstructive surgery planning",
            "normal_range": "Adult: 30-35mm"
        },
        "interpupillary_distance_mm": {
            "vital_field": None,
            "display_name": "Interpupillary Distance",
            "clinical_relevance": "Orbital surgery planning, hypertelorism assessment",
            "normal_range": "Adult: 58-64mm"
        }
    }

    def __init__(self, patient_logger: PatientLogger):
        self.logger = patient_logger

    def import_from_file(self, filepath: str, patient_id: str) -> Dict:
        """
        Import iOS measurement JSON file into patient record.

        Args:
            filepath: Path to exported JSON file from iOS app
            patient_id: Patient ID in the logger

        Returns:
            Import report with parsed measurements and actions taken
        """
        if not os.path.exists(filepath):
            raise FileNotFoundError(f"iOS measurement file not found: {filepath}")

        with open(filepath, 'r') as f:
            data = json.load(f)

        return self.import_from_dict(data, patient_id)

    def import_from_dict(self, data: Dict, patient_id: str) -> Dict:
        """
        Import iOS measurement from parsed JSON dict.
        """
        # Validate structure
        if "measurements" not in data:
            raise ValueError("Invalid iOS export: missing 'measurements' array")

        # Parse entries
        parsed_entries = []
        for entry in data.get("measurements", []):
            parsed = iOSMeasurementEntry(
                name=entry.get("name", "unknown"),
                value=entry.get("value", 0.0),
                unit=entry.get("unit", "unknown"),
                method=entry.get("method", "unknown"),
                confidence=entry.get("confidence", "unknown"),
                raw_value=entry.get("rawValue"),
                capture_distance_m=entry.get("captureDistanceM"),
                number_of_frames=entry.get("numberOfFrames")
            )
            parsed_entries.append(parsed)

        # Convert to vitals and notes
        vitals_notes = []
        height_cm = None
        weight_kg = None  # iPhone can't measure weight, but we might have it from other sources

        for entry in parsed_entries:
            mapped = self.MEASUREMENT_MAP.get(entry.name)

            if mapped:
                # Build note line
                note_line = (
                    f"{mapped['display_name']}: {entry.value} {entry.unit} "
                    f"[{entry.confidence} confidence, {entry.method}]"
                )
                vitals_notes.append(note_line)

                # Extract height if mapped
                if mapped["vital_field"] == "height_cm":
                    height_cm = entry.value
            else:
                # Unknown measurement, still log it
                vitals_notes.append(
                    f"{entry.name}: {entry.value} {entry.unit} "
                    f"[{entry.confidence} confidence]"
                )

        # Add device metadata to notes
        metadata = (
            f"iOS Device: {data.get('deviceModel', 'Unknown')} | "
            f"iOS {data.get('iosVersion', 'Unknown')} | "
            f"ARKit {data.get('arkitVersion', 'Unknown')} | "
            f"Captured: {data.get('timestamp', 'Unknown')}"
        )
        vitals_notes.append(metadata)

        # Add accuracy disclaimer
        disclaimer = data.get("accuracyDisclaimer", "")
        if disclaimer:
            vitals_notes.append(f"Accuracy disclaimer: {disclaimer}")

        # Create vitals entry
        vitals = VitalSigns(
            timestamp=data.get("timestamp", datetime.now().isoformat()),
            height_cm=height_cm,
            notes="\n".join(vitals_notes)
        )

        # Add to patient log
        self.logger.add_vitals(patient_id, vitals)

        # Generate report
        report = {
            "patient_id": patient_id,
            "import_timestamp": datetime.now().isoformat(),
            "ios_device": data.get("deviceModel", "Unknown"),
            "ios_version": data.get("iosVersion", "Unknown"),
            "measurements_imported": len(parsed_entries),
            "measurements": [
                {
                    "name": e.name,
                    "value": e.value,
                    "unit": e.unit,
                    "confidence": e.confidence,
                    "clinical_relevance": self.MEASUREMENT_MAP.get(e.name, {}).get("clinical_relevance", "General measurement"),
                    "normal_range": self.MEASUREMENT_MAP.get(e.name, {}).get("normal_range", "Not established")
                }
                for e in parsed_entries
            ],
            "height_extracted": height_cm,
            "notes_added": len(vitals_notes),
            "accuracy_disclaimer": disclaimer,
            "recommendations": self._generate_recommendations(parsed_entries)
        }

        return report

    def _generate_recommendations(self, entries: List[iOSMeasurementEntry]) -> List[str]:
        """Generate clinical recommendations based on measurements."""
        recs = []

        for entry in entries:
            if entry.name == "neck_circumference_cm":
                if entry.value > 43:  # cm, male threshold for OSA risk
                    recs.append(
                        f"🟡 Neck circumference {entry.value}cm exceeds OSA risk threshold (>43cm male, >38cm female). "
                        "Consider STOP-BANG screening and sleep study referral."
                    )
                else:
                    recs.append(
                        f"🟢 Neck circumference {entry.value}cm within typical range. "
                        "Continue monitoring if OSA symptoms present."
                    )

            elif entry.name == "facial_asymmetry_mm":
                if entry.value > 5:
                    recs.append(
                        f"🔴 Facial asymmetry {entry.value}mm exceeds 5mm threshold. "
                        "Consider ENT/maxillofacial evaluation for underlying pathology or surgical planning."
                    )
                elif entry.value > 3:
                    recs.append(
                        f"🟡 Facial asymmetry {entry.value}mm mild elevation. "
                        "Monitor trends; consider follow-up if progressive or symptomatic."
                    )

            elif entry.name == "height_cm":
                recs.append(
                    f"📏 Height recorded: {entry.value}cm. "
                    "Use with weight for BMI calculation if available."
                )

            elif "pinna" in entry.name:
                recs.append(
                    f"👂 Pinna measurement: {entry.value}{entry.unit}. "
                    "Useful for reconstructive baseline. Compare to contralateral side."
                )

        # General recommendation
        recs.append(
            "⚠️ All measurements are approximate (±1-2cm for LiDAR, ±0.5-1mm for TrueDepth). "
            "Correlate with clinical instruments for diagnostic decisions."
        )

        return recs

    def create_sample_ios_export(self, patient_id: str = "DEMO001") -> Dict:
        """
        Create a sample iOS export for testing/demo purposes.
        """
        return {
            "timestamp": datetime.now().isoformat(),
            "deviceModel": "iPhone15,3",  # iPhone 15 Pro Max
            "iosVersion": "17.5.1",
            "arkitVersion": "6.0",
            "measurements": [
                {
                    "name": "neck_circumference_cm",
                    "value": 44.2,
                    "unit": "cm",
                    "method": "lidar_depth_person_segmentation",
                    "confidence": "medium",
                    "rawValue": 44.23,
                    "captureDistanceM": 0.65,
                    "numberOfFrames": 30
                },
                {
                    "name": "facial_width_cm",
                    "value": 14.8,
                    "unit": "cm",
                    "method": "lidar_depth_edge_detection",
                    "confidence": "medium",
                    "rawValue": 14.78,
                    "captureDistanceM": 0.45,
                    "numberOfFrames": 15
                },
                {
                    "name": "facial_asymmetry_mm",
                    "value": 2.1,
                    "unit": "mm",
                    "method": "lidar_depth_edge_detection",
                    "confidence": "high",
                    "rawValue": 2.14,
                    "captureDistanceM": 0.45,
                    "numberOfFrames": 15
                },
                {
                    "name": "height_cm",
                    "value": 178.5,
                    "unit": "cm",
                    "method": "arkit_plane_person_segmentation",
                    "confidence": "medium",
                    "rawValue": 178.52,
                    "captureDistanceM": 2.1,
                    "numberOfFrames": 10
                },
                {
                    "name": "pinna_height_mm",
                    "value": 62.3,
                    "unit": "mm",
                    "method": "lidar_depth_close_range",
                    "confidence": "high",
                    "rawValue": 62.25,
                    "captureDistanceM": 0.12,
                    "numberOfFrames": 60
                }
            ],
            "scanMeshURL": None,
            "notes": "Patient seated for neck measurement, standing against wall for height, close-range for ear detail.",
            "accuracyDisclaimer": (
                "Measurements are approximate. LiDAR accuracy: ±1-2cm at 0.5-1.5m. "
                "TrueDepth: ±0.5-1mm at 25-50cm. Close-range LiDAR (ear): ±1-2mm at 10-15cm. "
                "Not for diagnostic-grade measurements. Correlation with clinical instruments required."
            )
        }


# =============================================================================
# CLI INTEGRATION
# =============================================================================

def import_ios_measurements_command(engine: ClinicalAssessmentEngine, filepath: str, patient_id: str):
    """Command-line helper to import iOS measurements."""
    importer = iOSMeasurementImporter(engine.patient_logger)

    try:
        report = importer.import_from_file(filepath, patient_id)

        print("\n" + "=" * 60)
        print("📱 iOS LiDAR MEASUREMENT IMPORT")
        print("=" * 60)
        print(f"Patient: {report['patient_id']}")
        print(f"Device: {report['ios_device']} (iOS {report['ios_version']})")
        print(f"Measurements imported: {report['measurements_imported']}")
        print(f"Height extracted: {report['height_extracted']} cm")

        print("\n📏 MEASUREMENTS:")
        for m in report["measurements"]:
            print(f"  • {m['name']}: {m['value']} {m['unit']} ({m['confidence']})")
            print(f"    Relevance: {m['clinical_relevance']}")
            print(f"    Normal range: {m['normal_range']}")

        print("\n📋 RECOMMENDATIONS:")
        for rec in report["recommendations"]:
            print(f"  • {rec}")

        print("\n⚠️  DISCLAIMER:")
        print(f"  {report['accuracy_disclaimer']}")
        print("=" * 60)

        return report

    except Exception as e:
        print(f"❌ Import failed: {e}")
        raise


def demo_ios_import(engine: ClinicalAssessmentEngine, patient_id: str = "DEMO_IOS"):
    """Demo import with synthetic iOS data."""
    importer = iOSMeasurementImporter(engine.patient_logger)
    sample = importer.create_sample_ios_export(patient_id)

    # Save to temp file then import
    import tempfile
    with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
        json.dump(sample, f, indent=2)
        temp_path = f.name

    try:
        report = import_ios_measurements_command(engine, temp_path, patient_id)
        return report
    finally:
        os.remove(temp_path)


# =============================================================================
# MAIN
# =============================================================================

if __name__ == "__main__":
    print("iOS LiDAR Measurement Importer for ENT Clinical Assistant")
    print("=" * 60)
    print("\nTo use:")
    print("  from ios_measurement_importer import iOSMeasurementImporter")
    print("  importer = iOSMeasurementImporter(engine.patient_logger)")
    print("  report = importer.import_from_file('measurements.json', 'P001')")
    print("\nOr run demo:")
    print("  from ios_measurement_importer import demo_ios_import")
    print("  demo_ios_import(engine)")
