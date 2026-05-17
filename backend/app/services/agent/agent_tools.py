import json
from app.data_loader import find_by_id, append_record
from app.services.risk_engine import RiskEngine
from app.services.rural_scoring import RuralScoringService
from app.services.report_generator import ReportGenerator
from app.services.alert_service import AlertService
from app.services.care_plan_service import CarePlanService
from app.schemas import ExtractedSymptoms, RiskResult, RuralPriority

risk_engine = RiskEngine()
rural_scoring = RuralScoringService()
report_generator = ReportGenerator()
alert_service = AlertService()
care_plan_service = CarePlanService()

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "get_patient_profile",
            "description": "Get the full patient profile and care plan by patient_id",
            "parameters": {
                "type": "object",
                "properties": {
                    "patient_id": {"type": "string", "description": "Patient ID e.g. P001"}
                },
                "required": ["patient_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "search_medical_knowledge",
            "description": "Search maternal health medical knowledge base for guidelines about symptoms",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Symptoms or medical question to search"}
                },
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "classify_risk",
            "description": "Classify the risk level (green/orange/red/red_critical) based on extracted symptoms and patient profile",
            "parameters": {
                "type": "object",
                "properties": {
                    "patient_id": {"type": "string"},
                    "fetal_movement": {"type": "string", "enum": ["absent", "reduced", "normal", "unknown"]},
                    "bleeding": {"type": "string", "enum": ["true", "false", "unknown"]},
                    "abdominal_pain": {"type": "string", "enum": ["severe", "mild", "none", "unknown"]},
                    "fever": {"type": "string", "enum": ["high", "mild", "none", "unknown"]},
                    "dizziness": {"type": "string", "enum": ["true", "false", "unknown"]},
                    "headache": {"type": "string", "enum": ["severe", "mild", "none", "unknown"]},
                    "blurred_vision": {"type": "string", "enum": ["true", "false", "unknown"]},
                    "breathing_difficulty": {"type": "string", "enum": ["true", "false", "unknown"]},
                    "convulsions": {"type": "string", "enum": ["true", "false", "unknown"]},
                    "red_flags": {"type": "array", "items": {"type": "string"}},
                    "orange_flags": {"type": "array", "items": {"type": "string"}},
                    "normalized_summary": {"type": "string"},
                },
                "required": ["patient_id", "normalized_summary"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "calculate_rural_score",
            "description": "Calculate rural priority score based on patient location, transport, and risk level",
            "parameters": {
                "type": "object",
                "properties": {
                    "patient_id": {"type": "string"},
                    "risk_level": {"type": "string", "enum": ["green", "orange", "red", "red_critical"]},
                    "risk_reason": {"type": "string"},
                    "triggered_rules": {"type": "array", "items": {"type": "string"}},
                    "recommended_action": {"type": "string"},
                },
                "required": ["patient_id", "risk_level", "risk_reason", "triggered_rules", "recommended_action"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "generate_report",
            "description": "Generate the doctor report and family alert message in Darija",
            "parameters": {
                "type": "object",
                "properties": {
                    "patient_id": {"type": "string"},
                    "risk_level": {"type": "string"},
                    "rural_priority": {"type": "string"},
                    "rural_score": {"type": "integer"},
                    "normalized_summary": {"type": "string"},
                    "red_flags": {"type": "array", "items": {"type": "string"}},
                    "medical_context": {"type": "string", "description": "RAG context from medical knowledge base"},
                },
                "required": ["patient_id", "risk_level", "normalized_summary"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "send_alert",
            "description": "Send an alert if risk is orange, red or red_critical",
            "parameters": {
                "type": "object",
                "properties": {
                    "patient_id": {"type": "string"},
                    "risk_level": {"type": "string"},
                    "family_message": {"type": "string"},
                    "rural_priority": {"type": "string"},
                    "rural_score": {"type": "integer"},
                },
                "required": ["patient_id", "risk_level", "family_message"],
            },
        },
    },
]


def execute_tool(name: str, args: dict) -> str:
    if name == "get_patient_profile":
        patient = find_by_id("patients.json", args["patient_id"])
        care_plan = care_plan_service.get_plan_for_patient(args["patient_id"])
        return json.dumps({"patient": patient, "care_plan": care_plan}, ensure_ascii=False)

    if name == "search_medical_knowledge":
        return _rag_search(args["query"])

    if name == "classify_risk":
        patient = find_by_id("patients.json", args["patient_id"])
        extraction = ExtractedSymptoms(
            normalized_summary=args.get("normalized_summary", ""),
            fetal_movement=args.get("fetal_movement", "unknown"),
            bleeding=args.get("bleeding", "unknown"),
            abdominal_pain=args.get("abdominal_pain", "unknown"),
            fever=args.get("fever", "unknown"),
            dizziness=args.get("dizziness", "unknown"),
            headache=args.get("headache", "unknown"),
            blurred_vision=args.get("blurred_vision", "unknown"),
            breathing_difficulty=args.get("breathing_difficulty", "unknown"),
            convulsions=args.get("convulsions", "unknown"),
            red_flags=args.get("red_flags", []),
            orange_flags=args.get("orange_flags", []),
        )
        care_plan = care_plan_service.get_plan_for_patient(args["patient_id"])
        risk = risk_engine.classify(extraction=extraction, patient=patient, care_plan=care_plan)
        return json.dumps(risk.model_dump(), ensure_ascii=False)

    if name == "calculate_rural_score":
        patient = find_by_id("patients.json", args["patient_id"])
        risk = RiskResult(
            risk_level=args["risk_level"],
            risk_reason=args["risk_reason"],
            triggered_rules=args["triggered_rules"],
            recommended_action=args["recommended_action"],
        )
        priority = rural_scoring.calculate(patient=patient, risk=risk)
        return json.dumps(priority.model_dump(), ensure_ascii=False)

    if name == "generate_report":
        patient = find_by_id("patients.json", args["patient_id"])
        care_plan = care_plan_service.get_plan_for_patient(args["patient_id"])
        extraction = ExtractedSymptoms(
            normalized_summary=args.get("normalized_summary", ""),
            red_flags=args.get("red_flags", []),
        )
        risk = RiskResult(
            risk_level=args.get("risk_level", "green"),
            risk_reason="",
            triggered_rules=[],
            recommended_action="",
        )
        rural = RuralPriority(
            mobility_priority=args.get("rural_priority", "normal"),
            score=args.get("rural_score", 0),
            factors=[],
            reason=args.get("medical_context", ""),
            next_action="",
        )
        doctor_report = report_generator.generate_doctor_report(patient, extraction, risk, rural, care_plan)
        family_message = report_generator.generate_family_message_darija(patient, extraction, risk, rural)
        return json.dumps({"doctor_report": doctor_report, "family_message_darija": family_message}, ensure_ascii=False)

    if name == "send_alert":
        patient = find_by_id("patients.json", args["patient_id"])
        risk = RiskResult(
            risk_level=args["risk_level"],
            risk_reason="",
            triggered_rules=[],
            recommended_action="",
        )
        rural = RuralPriority(
            mobility_priority=args.get("rural_priority", "normal"),
            score=args.get("rural_score", 0),
            factors=[],
            reason="",
            next_action="",
        )
        alert = alert_service.create_alert_if_needed(patient, risk, rural, args["family_message"])
        return json.dumps({"alert_created": alert is not None, "alert": alert}, ensure_ascii=False)

    return json.dumps({"error": f"Unknown tool: {name}"})


MEDICAL_KB = {
    "fetal_movement": "WHO guideline: Absence of fetal movement after 28 weeks is an emergency. Patient must reach hospital within 2 hours. Kick count < 10 in 2 hours = danger sign.",
    "bleeding": "Any vaginal bleeding during pregnancy is a red flag. Placenta previa or abruption possible. Immediate obstetric care required.",
    "severe_headache_vision": "Severe headache with blurred vision = pre-eclampsia warning. Check blood pressure. Risk of eclampsia (seizures). Emergency transfer required.",
    "abdominal_pain": "Severe abdominal pain in third trimester: rule out placental abruption, preterm labor. Mild pain: monitor, hydrate, rest.",
    "fever": "Fever > 38°C during pregnancy: risk of chorioamnionitis or urinary infection. Requires antibiotic evaluation.",
    "convulsions": "Convulsions during pregnancy = eclampsia. Life-threatening emergency. Immediate IV magnesium sulfate and hospital transfer.",
    "breathing": "Breathing difficulty in pregnancy: rule out pulmonary embolism, cardiac issue. Emergency evaluation needed.",
    "rural_transport": "Rural context: when transport is unavailable and risk is red, activate community health worker and trusted person network immediately.",
}

def _rag_search(query: str) -> str:
    query_lower = query.lower()
    results = []
    if any(w in query_lower for w in ["fetal", "movement", "bébé", "bebe", "7araka"]):
        results.append(MEDICAL_KB["fetal_movement"])
    if any(w in query_lower for w in ["bleeding", "blood", "dem", "saignement"]):
        results.append(MEDICAL_KB["bleeding"])
    if any(w in query_lower for w in ["headache", "vision", "rass", "blurred"]):
        results.append(MEDICAL_KB["severe_headache_vision"])
    if any(w in query_lower for w in ["abdominal", "pain", "kerchi", "wje3"]):
        results.append(MEDICAL_KB["abdominal_pain"])
    if any(w in query_lower for w in ["fever", "skhana", "fièvre", "temperature"]):
        results.append(MEDICAL_KB["fever"])
    if any(w in query_lower for w in ["convuls", "seizure", "tchennouj"]):
        results.append(MEDICAL_KB["convulsions"])
    if any(w in query_lower for w in ["breath", "neffes", "respir"]):
        results.append(MEDICAL_KB["breathing"])
    if any(w in query_lower for w in ["rural", "transport", "distance"]):
        results.append(MEDICAL_KB["rural_transport"])
    return "\n\n".join(results) if results else "No specific guideline found. Apply standard maternal care protocol."
