from typing import Dict, Any
from app.data_loader import list_records


class CarePlanService:
    def get_plan_for_patient(self, patient_id: str) -> Dict[str, Any]:
        for plan in list_records("care_plans.json"):
            if plan.get("patient_id") == patient_id:
                return plan
        return {
            "patient_id": patient_id,
            "checkin_frequency": "weekly",
            "questions": [
                {"id": "q1", "text_darija": "Wach bébé kayt7rek bhal l3ada?", "expected_signal": "fetal_movement"},
                {"id": "q2", "text_darija": "Wach kayn chi dem?", "expected_signal": "bleeding"},
                {"id": "q3", "text_darija": "Wach kayn wje3 qwi f kerch?", "expected_signal": "abdominal_pain"},
                {"id": "q4", "text_darija": "Wach 3andk skhana?", "expected_signal": "fever"},
                {"id": "q5", "text_darija": "Wach 3andk chi wa7ed yqder ydik l centre ila khass?", "expected_signal": "transport"}
            ],
            "red_flags": ["no_fetal_movement", "bleeding", "severe_abdominal_pain", "breathing_difficulty"],
            "orange_flags": ["fever", "dizziness", "missed_checkup", "frequent_vomiting"],
            "escalation_threshold": "red"
        }
