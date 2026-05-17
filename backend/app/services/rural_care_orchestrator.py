from datetime import datetime, timezone
from app.data_loader import find_by_id, append_record
from app.services.care_plan_service import CarePlanService
from app.services.ai_extraction_service import AIExtractionService
from app.services.risk_engine import RiskEngine
from app.services.rural_scoring import RuralScoringService
from app.services.report_generator import ReportGenerator
from app.services.alert_service import AlertService
from app.schemas import AnalyzeResponse


class RuralCareOrchestrator:
    """Lightweight MVP workflow brain, not a separate microservice for tonight."""

    def __init__(self):
        self.care_plan_service = CarePlanService()
        self.ai_extraction = AIExtractionService()
        self.risk_engine = RiskEngine()
        self.rural_scoring = RuralScoringService()
        self.report_generator = ReportGenerator()
        self.alert_service = AlertService()

    def run_checkin(self, patient_id: str, message: str, source: str = "simulated_call") -> AnalyzeResponse:
        patient = find_by_id("patients.json", patient_id)
        if not patient:
            raise ValueError(f"Patient not found: {patient_id}")
        care_plan = self.care_plan_service.get_plan_for_patient(patient_id)
        extraction = self.ai_extraction.extract_symptoms(message=message, patient=patient, care_plan=care_plan)
        risk = self.risk_engine.classify(extraction=extraction, patient=patient, care_plan=care_plan)
        rural_priority = self.rural_scoring.calculate(patient=patient, risk=risk)
        doctor_report = self.report_generator.generate_doctor_report(patient, extraction, risk, rural_priority, care_plan)
        family_message = self.report_generator.generate_family_message_darija(patient, extraction, risk, rural_priority)
        alert = self.alert_service.create_alert_if_needed(patient, risk, rural_priority, family_message)

        stamp = datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')
        append_record("checkins_history.json", {
            "id": f"CHECKIN-{stamp}", "patient_id": patient_id, "source": source, "message": message,
            "extracted_symptoms": extraction.model_dump(), "risk": risk.model_dump(),
            "rural_priority": rural_priority.model_dump(), "created_at": datetime.now(timezone.utc).isoformat()
        })
        append_record("generated_reports.json", {
            "id": f"REPORT-{stamp}", "patient_id": patient_id, "doctor_report": doctor_report,
            "family_message_darija": family_message, "status": "pending_human_review",
            "created_at": datetime.now(timezone.utc).isoformat()
        })

        return AnalyzeResponse(
            patient=patient,
            care_plan=care_plan,
            extracted_symptoms=extraction,
            risk=risk,
            rural_priority=rural_priority,
            doctor_report=doctor_report,
            family_message_darija=family_message,
            alert=alert,
            review_task={
                "status": "pending_human_review",
                "actions": ["validate_report", "edit_report", "override_risk", "request_new_call"],
                "message": "AI-generated report requires doctor or midwife validation."
            }
        )
