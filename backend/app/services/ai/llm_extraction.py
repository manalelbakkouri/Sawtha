import os, json
from groq import Groq
from app.schemas import ExtractedSymptoms

SYSTEM_PROMPT = """Tu es un assistant médical spécialisé dans la santé maternelle rurale au Maroc.
Tu analyses des messages en Darija marocaine, français ou arabe de femmes enceintes.
Tu extrais les symptômes et retournes UNIQUEMENT un JSON valide, sans texte supplémentaire.

Champs à extraire:
- fetal_movement: "absent" | "reduced" | "normal" | "unknown"
- bleeding: "true" | "false" | "unknown"
- abdominal_pain: "severe" | "mild" | "none" | "unknown"
- fever: "high" | "mild" | "none" | "unknown"
- dizziness: "true" | "false" | "unknown"
- headache: "severe" | "mild" | "none" | "unknown"
- blurred_vision: "true" | "false" | "unknown"
- breathing_difficulty: "true" | "false" | "unknown"
- convulsions: "true" | "false" | "unknown"
- emotional_state: "worried" | "calm" | "unknown"
- transport_available: "true" | "false" | "unknown"
- has_someone_nearby: "true" | "false" | "unknown"
- normalized_summary: résumé en français en 1 phrase
- red_flags: liste des signaux critiques détectés
- orange_flags: liste des signaux de suivi
- confidence: score entre 0.0 et 1.0
- needs_confirmation: true | false
- confirmation_questions_darija: liste de questions de suivi en Darija si information manquante"""


class LLMExtractionService:
    def extract_symptoms(self, message: str, patient: dict, care_plan: dict) -> ExtractedSymptoms:
        pregnancy_week = patient.get("pregnancy_week", 0)
        user_prompt = f"""Message de la patiente: "{message}"
Semaine de grossesse: {pregnancy_week}
Extrait les symptômes et retourne uniquement le JSON."""

        try:
            client = Groq(api_key=os.environ.get("GROQ_API_KEY"))
            model = os.environ.get("GROQ_LLM_MODEL", "llama-3.3-70b-versatile")
            response = client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=0.1,
                max_tokens=800,
            )
            raw = response.choices[0].message.content.strip()
            if raw.startswith("```"):
                raw = raw.split("```")[1]
                if raw.startswith("json"):
                    raw = raw[4:]
            data = json.loads(raw.strip())
            return ExtractedSymptoms(**data)
        except Exception:
            from app.services.ai_extraction_service import AIExtractionService
            return AIExtractionService().extract_symptoms(message, patient, care_plan)
