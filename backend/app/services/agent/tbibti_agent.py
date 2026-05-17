import os, json
from datetime import datetime, timezone
from groq import Groq
from app.data_loader import find_by_id, append_record
from app.services.agent.agent_tools import TOOLS, execute_tool

SYSTEM_PROMPT = """Tu es Sawtha, un agent IA de santé maternelle rurale au Maroc.
Tu analyses les messages en Darija marocaine (ou arabe/français) des femmes enceintes.

Ton workflow OBLIGATOIRE:
1. get_patient_profile → profil + plan de soins
2. search_medical_knowledge → guidelines pour les symptômes
3. classify_risk → classifie le risque (green/orange/red/red_critical)
4. calculate_rural_score → priorité rurale
5. generate_report → rapport médecin + message famille Darija
6. send_alert → alerte si risque >= orange

=== EXTRACTION DES SYMPTÔMES (CRITIQUE) ===
Avant d'appeler classify_risk, analyse le message et mappe chaque symptôme:

fetal_movement:
- "absent"  → "ma 7ssitch b bébé", "bébé ma kayt7rekch", "ما حسيتش ببيبي", "ولد ما تحركش"
- "reduced" → "bébé kayt7rek chwiya", "chwiya 7araka", "بيبي كيتحرك شوية"
- "normal"  → "bébé kayt7rek bhal l3ada", "normal", "بيبي كيتحرك"
- "unknown" → si non mentionné

bleeding:
- "true"  → "kayn dem", "3ndi dem", "كاين دم", "saignement"
- "false" → "ma kaynch dem", "aucun saignement"
- "unknown" → si non mentionné

abdominal_pain:
- "severe" → "wje3 qwi f kerchi", "wje3 chdiid", "ألم شديد", "très mal au ventre"
- "mild"   → "chwiya wje3 f kerchi", "douleur légère"
- "none"   → "ma kaynch wje3"
- "unknown" → si non mentionné

fever:
- "high" → "skhana bzaf", "7arara 3alia", "forte fièvre"
- "mild" → "chwiya skhana", "7arara", "fièvre"
- "none" → "ma kaynch skhana"

dizziness:
- "true"  → "dawakh", "duwakh", "دوخة", "vertiges", "tournée de tête"
- "false" → "ma kaynch dawakh"

headache:
- "severe" → "wje3 qwi f rass", "ألم شديد الرأس"
- "mild"   → "chwiya wje3 f rass", "mal de tête"
- "none"   → "ma kaynch wje3 f rass"

blurred_vision:
- "true"  → "ma chafch mzyan", "3yandat n7al", "رؤية ضبابية", "vision trouble"
- "false" → "chaf mzyan"

breathing_difficulty:
- "true"  → "ma nefssatch", "ضيق التنفس", "du mal à respirer"

convulsions:
- "true"  → "tshennj", "تشنج", "convulsions", "seizure"

RÈGLE CRITIQUE: Ne met PAS "unknown" si le patient mentionne clairement un symptôme.
Si le message dit "ma 7ssitch b bébé" → fetal_movement DOIT être "absent", pas "unknown".
Si le message dit "wje3 qwi" → abdominal_pain DOIT être "severe", pas "unknown".

Règles de risque:
- Tu ne diagnostiques JAMAIS, tu priorises et alertes
- distance > 15km OU pas de transport → aggrave le risque rural"""


class TibtiAgent:
    def run(self, patient_id: str, message: str) -> dict:
        patient = find_by_id("patients.json", patient_id)
        if not patient:
            raise ValueError(f"Patient not found: {patient_id}")

        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {
                "role": "user",
                "content": f"Analyse ce message de la patiente {patient_id} ({patient.get('full_name')}):\n\"{message}\"\n\nSuis ton workflow complet avec tous les tools."
            },
        ]

        tool_results = {}
        classify_risk_args = {}
        max_iterations = 10

        client = Groq(api_key=os.environ.get("GROQ_API_KEY"))
        model = os.environ.get("GROQ_LLM_MODEL", "llama-3.3-70b-versatile")

        for _ in range(max_iterations):
            response = client.chat.completions.create(
                model=model,
                messages=messages,
                tools=TOOLS,
                tool_choice="auto",
                temperature=0.1,
                max_tokens=2000,
            )

            msg = response.choices[0].message
            finish_reason = response.choices[0].finish_reason

            if finish_reason == "stop" or not msg.tool_calls:
                break

            messages.append({"role": "assistant", "content": msg.content or "", "tool_calls": [
                {"id": tc.id, "type": "function", "function": {"name": tc.function.name, "arguments": tc.function.arguments}}
                for tc in msg.tool_calls
            ]})

            for tool_call in msg.tool_calls:
                tool_name = tool_call.function.name
                tool_args = json.loads(tool_call.function.arguments)
                if tool_name == "classify_risk":
                    classify_risk_args = tool_args
                result = execute_tool(tool_name, tool_args)
                try:
                    tool_results[tool_name] = json.loads(result)
                except Exception:
                    tool_results[tool_name] = {"raw": result}
                messages.append({
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "content": result,
                })

        return self._build_response(patient_id, message, tool_results, classify_risk_args)

    def _build_response(self, patient_id: str, message: str, results: dict, classify_args: dict = None) -> dict:
        patient = find_by_id("patients.json", patient_id)
        profile_data = results.get("get_patient_profile", {})
        care_plan = profile_data.get("care_plan", {})
        risk_data = results.get("classify_risk", {})
        rural_data = results.get("calculate_rural_score", {})
        report_data = results.get("generate_report", {})
        alert_data = results.get("send_alert", {})

        stamp = datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')
        append_record("checkins_history.json", {
            "id": f"AGENT-CHECKIN-{stamp}",
            "patient_id": patient_id,
            "source": "agent",
            "message": message,
            "risk": risk_data,
            "rural_priority": rural_data,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        if report_data:
            append_record("generated_reports.json", {
                "id": f"AGENT-REPORT-{stamp}",
                "patient_id": patient_id,
                "doctor_report": report_data.get("doctor_report", ""),
                "family_message_darija": report_data.get("family_message_darija", ""),
                "status": "pending_human_review",
                "created_at": datetime.now(timezone.utc).isoformat(),
            })

        from app.schemas import ExtractedSymptoms, RiskResult, RuralPriority
        args = classify_args or {}
        extraction = ExtractedSymptoms(
            normalized_summary=args.get("normalized_summary") or risk_data.get("risk_reason") or message,
            fetal_movement=args.get("fetal_movement", "unknown"),
            bleeding=args.get("bleeding", "unknown"),
            abdominal_pain=args.get("abdominal_pain", "unknown"),
            fever=args.get("fever", "unknown"),
            dizziness=args.get("dizziness", "unknown"),
            headache=args.get("headache", "unknown"),
            blurred_vision=args.get("blurred_vision", "unknown"),
            breathing_difficulty=args.get("breathing_difficulty", "unknown"),
            convulsions=args.get("convulsions", "unknown"),
            red_flags=risk_data.get("triggered_rules", []),
        )
        risk = RiskResult(
            risk_level=risk_data.get("risk_level", "green"),
            triggered_rules=risk_data.get("triggered_rules", []),
            risk_reason=risk_data.get("risk_reason", ""),
            recommended_action=risk_data.get("recommended_action", ""),
        )
        rural = RuralPriority(
            mobility_priority=rural_data.get("mobility_priority", "normal"),
            score=rural_data.get("score", 0),
            factors=rural_data.get("factors", []),
            reason=rural_data.get("reason", ""),
            next_action=rural_data.get("next_action", ""),
        )

        from app.schemas import AnalyzeResponse
        return AnalyzeResponse(
            patient=patient,
            care_plan=care_plan,
            extracted_symptoms=extraction,
            risk=risk,
            rural_priority=rural,
            doctor_report=report_data.get("doctor_report", ""),
            family_message_darija=report_data.get("family_message_darija", ""),
            alert=alert_data.get("alert"),
            review_task={
                "status": "pending_human_review",
                "source": "tbibti_agent",
                "actions": ["validate_report", "override_risk", "request_new_call"],
                "message": "Agent-generated report requires doctor validation.",
            },
        )
