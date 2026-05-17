from datetime import datetime, timezone
from typing import Any, Dict, Optional
from app.data_loader import append_record
from app.schemas import RiskResult, RuralPriority


class AlertService:
    def create_alert_if_needed(self, patient: Dict[str, Any], risk: RiskResult, rural_priority: RuralPriority, family_message_darija: str) -> Optional[Dict[str, Any]]:
        if risk.risk_level not in ["orange", "red", "red_critical"]:
            return None
        alert = {
            "id": f"ALERT-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}",
            "patient_id": patient.get("id") or patient.get("patient_id"),
            "patient_name": patient.get("full_name"),
            "risk_level": risk.risk_level,
            "mobility_priority": rural_priority.mobility_priority,
            "message_darija": family_message_darija,
            "status": "pending_doctor_review",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        append_record("alerts.json", alert)
        return alert
