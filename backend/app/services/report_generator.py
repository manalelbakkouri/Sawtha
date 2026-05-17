from typing import Any, Dict
from app.schemas import ExtractedSymptoms, RiskResult, RuralPriority


class ReportGenerator:
    def generate_doctor_report(self, patient: Dict[str, Any], extraction: ExtractedSymptoms, risk: RiskResult, rural_priority: RuralPriority, care_plan: Dict[str, Any]) -> str:
        rules = "\n- ".join(risk.triggered_rules)
        return f'''Rapport Tbibti — Revue médecin / sage-femme

Patiente: {patient.get("full_name")}
Âge: {patient.get("age")} ans
Grossesse: semaine {patient.get("pregnancy_week")} / mois {patient.get("pregnancy_month")}
Douar: {patient.get("douar")}, {patient.get("commune")}, {patient.get("province")}
Centre de santé: {patient.get("assigned_health_center")}
Distance: {patient.get("distance_to_health_center_km")} km
Transport disponible: {patient.get("transport_available")}
Connexion: {patient.get("internet_access")}
Niveau d'alphabétisation: {patient.get("literacy_level")}

Résumé IA: {extraction.normalized_summary}
Signaux rouges: {", ".join(extraction.red_flags) if extraction.red_flags else "Aucun"}
Signaux orange: {", ".join(extraction.orange_flags) if extraction.orange_flags else "Aucun"}
Confiance extraction: {round(extraction.confidence * 100)}%

Niveau de risque: {risk.risk_level.upper()}
Règles déclenchées:
- {rules}

Priorité rurale: {rural_priority.mobility_priority.upper()} ({rural_priority.score}/100)
Facteurs ruraux: {rural_priority.reason}

Action recommandée:
{risk.recommended_action}
{rural_priority.next_action}

Statut: En attente de validation humaine.
Note de sécurité: Tbibti ne diagnostique pas et ne prescrit pas. Ce rapport aide à prioriser et doit être revu par un professionnel de santé.
'''

    def generate_family_message_darija(self, patient: Dict[str, Any], extraction: ExtractedSymptoms, risk: RiskResult, rural_priority: RuralPriority) -> str:
        name = patient.get("full_name", "la patiente")
        if risk.risk_level in ["red", "red_critical"]:
            return f"تنبيه مهم: {name} صرّحات بأعراض خاصها تتشاف بسرعة. {extraction.normalized_summary} هي بعيدة على المركز الصحي بـ {patient.get('distance_to_health_center_km')} km. عافاك عيط ليها دابا، وجد النقل إلا أمكن، وتاصل بالقابلة أو المركز الصحي."
        if risk.risk_level == "orange":
            return f"تنبيه متابعة: {name} صرّحات ببعض الأعراض اللي خاصها متابعة. عافاك عيط ليها وتأكد واش الحالة تحسّنات، وخبر القابلة إلا بقات الأعراض."
        return f"Check normal: {name} ما بان حتى مؤشر خطير فهاد المتابعة. خليو المتابعة مستمرة فالموعد الجاي."
