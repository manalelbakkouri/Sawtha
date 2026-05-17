import os
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from app.data_loader import list_records, find_by_id
from app.schemas import CheckinAnalyzeRequest
from app.services.rural_care_orchestrator import RuralCareOrchestrator
from dotenv import load_dotenv
load_dotenv()

app = FastAPI(title="SAWTHA API", description="Rural Maternal Care Coordination AI", version="0.1.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
orchestrator = RuralCareOrchestrator()

@app.get("/")
def root():
    return {"project": "SAWTHA", "status": "running", "message": "Rural Maternal Care Coordination AI"}

@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/medical-staff/{staff_id}")
def get_staff(staff_id: str):
    staff = find_by_id("medical_staff.json", staff_id)
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")
    return staff

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

@app.post("/agent/analyze")
def agent_analyze(payload: CheckinAnalyzeRequest):
    from app.services.agent.tbibti_agent import TibtiAgent
    try:
        return TibtiAgent().run(payload.patient_id, payload.message)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@app.post("/agent/analyze-audio")
async def agent_analyze_audio(
    patient_id: str = Form(...),
    audio: UploadFile = File(...),
):
    from app.services.ai.whisper_service import WhisperService
    from app.services.agent.tbibti_agent import TibtiAgent
    audio_bytes = await audio.read()
    try:
        transcript = WhisperService().transcribe(audio_bytes, filename=audio.filename or "audio.webm")
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Transcription failed: {exc}")
    try:
        result = TibtiAgent().run(patient_id, transcript)
        data = result.model_dump()
        data["transcript"] = transcript
        return data
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@app.post("/checkins/analyze-audio")
async def analyze_audio(
    patient_id: str = Form(...),
    audio: UploadFile = File(...),
):
    from app.services.ai.whisper_service import WhisperService
    audio_bytes = await audio.read()
    try:
        transcript = WhisperService().transcribe(audio_bytes, filename=audio.filename or "audio.webm")
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Transcription failed: {exc}")
    try:
        return orchestrator.run_checkin(patient_id, transcript, source="voice_recording")
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


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
