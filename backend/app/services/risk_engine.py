from typing import Any, Dict, List
from app.schemas import ExtractedSymptoms, RiskResult


class RiskEngine:
    def classify(self, extraction: ExtractedSymptoms, patient: Dict[str, Any], care_plan: Dict[str, Any]) -> RiskResult:
        triggered: List[str] = []
        risk = "green"
        pregnancy_week = int(patient.get("pregnancy_week", 0))
        missed_checkups = int(patient.get("missed_checkups", 0))

        if extraction.fetal_movement == "absent" and pregnancy_week >= 28:
            risk = "red"; triggered.append("No fetal movement after 28 weeks → red flag")
        if extraction.bleeding == "true":
            risk = "red"; triggered.append("Bleeding during pregnancy → red flag")
        if extraction.abdominal_pain == "severe":
            risk = "red"; triggered.append("Severe abdominal pain → red flag")
        if extraction.breathing_difficulty == "true":
            risk = "red"; triggered.append("Breathing difficulty → red flag")
        if extraction.convulsions == "true":
            risk = "red"; triggered.append("Convulsions → red flag")
        if extraction.headache == "severe" and extraction.blurred_vision == "true":
            risk = "red"; triggered.append("Severe headache with blurred vision → red flag")

        if risk == "green":
            if extraction.fever in ["mild", "high"]:
                risk = "orange"; triggered.append("Fever requires follow-up")
            if extraction.dizziness == "true":
                risk = "orange"; triggered.append("Dizziness requires follow-up")
            if extraction.fetal_movement == "reduced":
                risk = "orange"; triggered.append("Reduced fetal movement requires confirmation")
            if extraction.abdominal_pain == "mild":
                risk = "orange"; triggered.append("Abdominal pain requires follow-up")
            if missed_checkups >= 2:
                risk = "orange"; triggered.append("Two or more missed check-ups")

        distance = float(patient.get("distance_to_health_center_km", 0))
        transport_available = patient.get("transport_available", True)
        if risk == "red" and (distance >= 15 or transport_available is False):
            risk = "red_critical"
            triggered.append("Rural constraint upgrade: long distance or no confirmed transport")

        if not triggered:
            triggered.append("No danger sign detected from the current check-in")

        action = {
            "green": "Continue routine follow-up and keep the next scheduled check.",
            "orange": "Create a follow-up task for the midwife and confirm symptoms.",
            "red": "Notify assigned health worker and trusted family member immediately.",
            "red_critical": "Escalate immediately: notify trusted family member, assigned health worker, and prepare transport."
        }[risk]

        return RiskResult(
            risk_level=risk,
            triggered_rules=triggered,
            risk_reason=self._reason(risk, extraction, patient),
            recommended_action=action
        )

    def _reason(self, risk: str, extraction: ExtractedSymptoms, patient: Dict[str, Any]) -> str:
        if risk == "red_critical":
            return f"Critical signal detected and rural barriers increase urgency: {patient.get('distance_to_health_center_km')} km, transport={patient.get('transport_available')}."
        if risk == "red": return "At least one pregnancy danger sign was detected."
        if risk == "orange": return "Symptoms require follow-up or confirmation."
        return "No danger sign was detected in the current response."
