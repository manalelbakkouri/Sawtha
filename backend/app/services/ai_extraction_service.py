from typing import Any, Dict, List
from app.schemas import ExtractedSymptoms


def contains_any(text: str, patterns: List[str]) -> bool:
    t = text.lower()
    return any(p.lower() in t for p in patterns)


class AIExtractionService:
    """Stable MVP Darija extraction. Later, replace internals with an LLM while keeping this JSON contract."""

    def extract_symptoms(self, message: str, patient: Dict[str, Any], care_plan: Dict[str, Any]) -> ExtractedSymptoms:
        text = message.lower()
        red_flags, orange_flags, questions = [], [], []

        fetal_movement = "unknown"
        if contains_any(text, ["ma 7ssitch", "ma hssitch", "ma kan7essch", "ma kansh3rch", "bébé ma kayt7rekch", "bebe ma kaythrkch", "no fetal movement", "ne bouge pas", "ma t7rekch", "ma kayt7rekch"]):
            fetal_movement = "absent"; red_flags.append("no_fetal_movement")
        elif contains_any(text, ["kayt7rek chwiya", "movement reduced", "qal l7araka", "moins de mouvement"]):
            fetal_movement = "reduced"; orange_flags.append("reduced_fetal_movement")
        elif contains_any(text, ["kayt7rek", "normal", "bhal l3ada"]):
            fetal_movement = "normal"

        bleeding = "unknown"
        if contains_any(text, ["dem", "saignement", "blood", "bleeding", "nzel dem"]):
            bleeding = "true"; red_flags.append("bleeding")
        elif contains_any(text, ["ma kaynch dem", "no bleeding", "bla dem"]):
            bleeding = "false"

        abdominal_pain = "unknown"
        if contains_any(text, ["wje3 qwi", "douleur forte", "severe pain", "wje3 bzaf", "kerchi kaywje3ni bzaf"]):
            abdominal_pain = "severe"; red_flags.append("severe_abdominal_pain")
        elif contains_any(text, ["wje3", "kerchi", "douleur", "pain"]):
            abdominal_pain = "mild"; orange_flags.append("abdominal_pain")

        fever = "unknown"
        if contains_any(text, ["skhana qwiya", "7rara bzaf", "fièvre forte", "high fever"]):
            fever = "high"; red_flags.append("high_fever")
        elif contains_any(text, ["skhana", "7rara", "fièvre", "fever"]):
            fever = "mild"; orange_flags.append("fever")

        dizziness = "true" if contains_any(text, ["dawakh", "vertige", "dizzy", "dizziness"]) else "unknown"
        if dizziness == "true": orange_flags.append("dizziness")

        headache = "unknown"
        if contains_any(text, ["wje3 qwi f rass", "severe headache", "maux de tête sévères"]):
            headache = "severe"; red_flags.append("severe_headache")
        elif contains_any(text, ["wje3 f rass", "headache", "صداع"]):
            headache = "mild"; orange_flags.append("headache")

        blurred_vision = "true" if contains_any(text, ["ma kanchofch mzyan", "vision trouble", "blurred vision", "chouf mghawesh"]) else "unknown"
        if blurred_vision == "true": red_flags.append("blurred_vision")

        breathing_difficulty = "true" if contains_any(text, ["ma kan9drch ntneffes", "neffess s3ib", "breathing difficulty", "difficulté à respirer"]) else "unknown"
        if breathing_difficulty == "true": red_flags.append("breathing_difficulty")

        convulsions = "true" if contains_any(text, ["convulsion", "tchennouj", "تشنج"]) else "unknown"
        if convulsions == "true": red_flags.append("convulsions")

        emotional_state = "worried" if contains_any(text, ["khayfa", "panic", "mkhlo3a", "قلقانة"]) else "unknown"
        if emotional_state == "worried": orange_flags.append("emotional_distress")

        transport_available = "unknown"
        if contains_any(text, ["ma 3andich transport", "ma kaynch transport", "no transport", "transport ma kaynch"]): transport_available = "false"
        if contains_any(text, ["3andi transport", "kayn transport", "voiture kayna"]): transport_available = "true"

        has_someone_nearby = "unknown"
        if contains_any(text, ["bo7di", "wahdi", "alone", "ma 3andi 7ta wa7ed"]): has_someone_nearby = "false"; orange_flags.append("alone")
        if contains_any(text, ["m3aya", "3andi khti", "3andi rajli", "3andi mama"]): has_someone_nearby = "true"

        red_flags = list(dict.fromkeys(red_flags))
        orange_flags = [x for x in dict.fromkeys(orange_flags) if x not in red_flags]

        if bleeding == "unknown": questions.append("Wach kayn chi dem?")
        if fetal_movement == "unknown" and int(patient.get("pregnancy_week", 0)) >= 28: questions.append("Wach bébé kayt7rek bhal l3ada?")
        if transport_available == "unknown": questions.append("Wach 3andk transport wla chi wa7ed yqder ydik l centre?")

        normalized = self._summary(fetal_movement, bleeding, abdominal_pain, fever, dizziness, message)
        confidence = 0.90 if red_flags else 0.82 if orange_flags else 0.72
        return ExtractedSymptoms(
            normalized_summary=normalized, fetal_movement=fetal_movement, bleeding=bleeding,
            abdominal_pain=abdominal_pain, fever=fever, dizziness=dizziness, headache=headache,
            blurred_vision=blurred_vision, breathing_difficulty=breathing_difficulty,
            convulsions=convulsions, emotional_state=emotional_state,
            transport_available=transport_available, has_someone_nearby=has_someone_nearby,
            red_flags=red_flags, orange_flags=orange_flags, confidence=confidence,
            needs_confirmation=len(questions) > 0 and not red_flags,
            confirmation_questions_darija=questions[:3]
        )

    def _summary(self, fetal_movement, bleeding, abdominal_pain, fever, dizziness, message):
        parts = []
        if fetal_movement == "absent": parts.append("absence de mouvement fœtal déclarée")
        elif fetal_movement == "reduced": parts.append("mouvement fœtal réduit déclaré")
        if bleeding == "true": parts.append("saignement déclaré")
        if abdominal_pain == "severe": parts.append("douleur abdominale sévère")
        elif abdominal_pain == "mild": parts.append("douleur abdominale")
        if fever in ["mild", "high"]: parts.append("fièvre")
        if dizziness == "true": parts.append("vertiges")
        return "La patiente déclare: " + ", ".join(parts) + "." if parts else f"Aucun signal critique clairement détecté: {message}"
