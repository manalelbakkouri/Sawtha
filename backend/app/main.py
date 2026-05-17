from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from app.data_loader import list_records, find_by_id
from app.schemas import CheckinAnalyzeRequest
from app.services.rural_care_orchestrator import RuralCareOrchestrator

app = FastAPI(title="Tbibti MVP API", description="Rural Maternal Care Coordination AI", version="0.1.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
orchestrator = RuralCareOrchestrator()

@app.get("/")
def root():
    return {"project": "Tbibti", "status": "running", "message": "Rural Maternal Care Coordination AI MVP"}

@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/patients")
def get_patients():
    return list_records("patients.json")

@app.get("/patients/{patient_id}")
def get_patient(patient_id: str):
    patient = find_by_id("patients.json", patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    return patient

@app.get("/patients/{patient_id}/care-plan")
def get_care_plan(patient_id: str):
    from app.services.care_plan_service import CarePlanService
    return CarePlanService().get_plan_for_patient(patient_id)

@app.post("/checkins/analyze")
def analyze_checkin(payload: CheckinAnalyzeRequest):
    try:
        return orchestrator.run_checkin(payload.patient_id, payload.message, payload.source)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))

@app.get("/checkins/{patient_id}")
def get_patient_checkins(patient_id: str):
    return [c for c in list_records("checkins_history.json") if c.get("patient_id") == patient_id]

@app.get("/alerts")
def get_alerts():
    return list_records("alerts.json")

@app.get("/reports")
def get_reports():
    return list_records("generated_reports.json")

@app.get("/dashboard/metrics")
def dashboard_metrics():
    patients, alerts, checkins = list_records("patients.json"), list_records("alerts.json"), list_records("checkins_history.json")
    return {
        "patients_count": len(patients),
        "alerts_count": len(alerts),
        "red_alerts_count": len([a for a in alerts if a.get("risk_level") in ["red", "red_critical"]]),
        "orange_alerts_count": len([a for a in alerts if a.get("risk_level") == "orange"]),
        "checkins_count": len(checkins),
        "pending_reviews": len([a for a in alerts if a.get("status") == "pending_doctor_review"])
    }
