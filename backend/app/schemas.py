from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class CheckinAnalyzeRequest(BaseModel):
    patient_id: str = Field(..., examples=["P001"])
    message: str = Field(..., examples=["La, mn sbah ma 7ssitch b bébé w 3ndi wje3 qwi f kerchi."])
    source: str = Field(default="simulated_call", examples=["dashboard", "simulated_call"])
    answered_question_id: Optional[str] = None


class ExtractedSymptoms(BaseModel):
    language: str = "darija"
    normalized_summary: str
    fetal_movement: str = "unknown"
    bleeding: str = "unknown"
    abdominal_pain: str = "unknown"
    fever: str = "unknown"
    dizziness: str = "unknown"
    headache: str = "unknown"
    blurred_vision: str = "unknown"
    breathing_difficulty: str = "unknown"
    convulsions: str = "unknown"
    emotional_state: str = "unknown"
    transport_available: str = "unknown"
    has_someone_nearby: str = "unknown"
    red_flags: List[str] = []
    orange_flags: List[str] = []
    confidence: float = 0.75
    needs_confirmation: bool = False
    confirmation_questions_darija: List[str] = []


class RiskResult(BaseModel):
    risk_level: str
    triggered_rules: List[str]
    risk_reason: str
    recommended_action: str


class RuralPriority(BaseModel):
    mobility_priority: str
    score: int
    factors: List[str]
    reason: str
    next_action: str


class AnalyzeResponse(BaseModel):
    patient: Dict[str, Any]
    care_plan: Dict[str, Any]
    extracted_symptoms: ExtractedSymptoms
    risk: RiskResult
    rural_priority: RuralPriority
    doctor_report: str
    family_message_darija: str
    alert: Optional[Dict[str, Any]]
    review_task: Dict[str, Any]
