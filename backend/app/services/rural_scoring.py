from typing import Dict, Any, List
from app.schemas import RiskResult, RuralPriority


class RuralScoringService:
    def calculate(self, patient: Dict[str, Any], risk: RiskResult) -> RuralPriority:
        score = 0
        factors: List[str] = []
        distance = float(patient.get("distance_to_health_center_km", 0))
        if distance >= 15:
            score += 30; factors.append(f"Long distance to health center: {distance} km")
        elif distance >= 8:
            score += 15; factors.append(f"Moderate distance to health center: {distance} km")
        if patient.get("transport_available") is False:
            score += 25; factors.append("No confirmed transport")
        if str(patient.get("road_condition", "")).lower() in ["bad", "difficult", "unpaved"]:
            score += 15; factors.append(f"Road condition: {patient.get('road_condition')}")
        if str(patient.get("internet_access", "")).lower() in ["none", "weak", "no"]:
            score += 10; factors.append(f"Weak or no connectivity: {patient.get('internet_access')}")
        if str(patient.get("literacy_level", "")).lower() in ["low", "illiterate", "none"]:
            score += 5; factors.append("Low literacy context")
        if risk.risk_level == "red_critical": score += 40
        elif risk.risk_level == "red": score += 30
        elif risk.risk_level == "orange": score += 15

        if score >= 80:
            priority, next_action = "critical", "Activate family alert, health worker review, and transport preparation."
        elif score >= 55:
            priority, next_action = "urgent", "Alert trusted person and assigned health worker."
        elif score >= 30:
            priority, next_action = "elevated", "Schedule follow-up and confirm key symptoms."
        else:
            priority, next_action = "normal", "Routine monitoring."

        return RuralPriority(
            mobility_priority=priority,
            score=score,
            factors=factors,
            reason=" / ".join(factors) if factors else "No major rural access barrier detected.",
            next_action=next_action
        )
