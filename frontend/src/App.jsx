import React, { useEffect, useState } from "react";
import { AlertTriangle, Bell, CalendarDays, CheckCircle2, HeartPulse, LayoutDashboard, LockKeyhole, LogOut, MapPin, Mic, Stethoscope, UserRound, Users } from "lucide-react";
import { apiGet, apiPost } from "./api";
import VoiceRecorder from "./components/VoiceRecorder";
import sawthaLogo from "./assets/sawtha-logo.png";
import doctorAvatar from "./assets/doctor-avatar.jpg";

function SawthaLogo({ size = 40 }) {
  return <img src={sawthaLogo} alt="Sawtha" style={{ height: size, width: "auto" }} />;
}

const RISK_CONFIG = {
  green:        { label: "Vert — Aucun signe de danger",   badge: "bg-olive text-white",       card: "bg-olive-light border-olive/30 text-olive-dark" },
  orange:       { label: "Orange — Suivi recommandé",      badge: "bg-orange-500 text-white",   card: "bg-orange-50 border-orange-200 text-orange-900" },
  red:          { label: "Rouge — Signe de danger",        badge: "bg-sawtha text-white",       card: "bg-sawtha-light border-sawtha/30 text-sawtha-dark" },
  red_critical: { label: "🚨 ROUGE CRITIQUE — URGENCE",    badge: "bg-sawtha-dark text-white",  card: "bg-red-50 border-red-300 text-red-950" },
};

const DEMO_ACCOUNTS = [
  { id: "aicha",  patientId: "P001", name: "Lalla Aicha Benali",       tag: "Voice-first · Sans internet" },
  { id: "fatima", patientId: "P002", name: "Fatima Zahra El Amrani",   tag: "Dashboard + appel de secours" },
];

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [session, setSession] = useState(() => { try { return JSON.parse(localStorage.getItem("sawtha_session")); } catch { return null; } });
  const [mode, setMode]       = useState("dashboard");
  const [patient, setPatient] = useState(null);
  const [carePlan, setCarePlan] = useState(null);
  const [staff, setStaff]     = useState(null);
  const [metrics, setMetrics] = useState(null);

  function login(account) {
    localStorage.setItem("sawtha_session", JSON.stringify(account));
    setSession(account);
  }
  function logout() {
    localStorage.removeItem("sawtha_session");
    setSession(null); setPatient(null); setCarePlan(null); setStaff(null); setMetrics(null);
  }

  useEffect(() => {
    if (!session?.patientId) return;
    Promise.all([
      apiGet(`/patients/${session.patientId}`),
      apiGet(`/patients/${session.patientId}/care-plan`),
    ]).then(([p, c]) => {
      setPatient(p); setCarePlan(c);
      if (p?.assigned_staff_id) apiGet(`/medical-staff/${p.assigned_staff_id}`).then(setStaff).catch(() => {});
    }).catch(() => {});
    apiGet("/dashboard/metrics").then(setMetrics).catch(() => {});
  }, [session?.patientId]);

  if (!session) return <LoginScreen onLogin={login} />;

  return (
    <div className="min-h-screen bg-cream">
      {/* Header */}
      <header className="bg-white border-b border-cream-dark sticky top-0 z-10 shadow-sm">
        <div className="max-w-6xl mx-auto px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <SawthaLogo size={36} />
            <div className="flex bg-cream rounded-xl p-1 gap-1">
              <button
                onClick={() => setMode("dashboard")}
                className={`flex items-center gap-1.5 text-sm font-bold px-4 py-2 rounded-lg transition ${mode === "dashboard" ? "bg-olive-dark text-white shadow-sm" : "text-stone-500 hover:text-olive"}`}
              >
                <LayoutDashboard size={14} /> Dashboard
              </button>
              <button
                onClick={() => setMode("femme")}
                className={`flex items-center gap-1.5 text-sm font-bold px-4 py-2 rounded-lg transition ${mode === "femme" ? "bg-sawtha text-white shadow-sm" : "text-stone-500 hover:text-sawtha"}`}
              >
                <Mic size={14} /> Espace Personnel
              </button>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-stone-600 hidden sm:block">{session.name}</span>
            <button onClick={logout} className="flex items-center gap-1.5 text-sm font-semibold text-stone-400 hover:text-sawtha px-3 py-2 rounded-xl bg-cream transition">
              <LogOut size={14} /> Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-5 py-6">
        {mode === "dashboard" && <DashboardPage metrics={metrics} patient={patient} staff={staff} />}
        {mode === "femme"     && <FemmePage session={session} patient={patient} staff={staff} carePlan={carePlan} />}
      </main>

      <footer className="text-center py-6 text-xs text-stone-400 border-t border-cream-dark mt-4">
        <SawthaLogo size={24} />
        <p className="mt-1">"From her voice to help, before it's too late."</p>
      </footer>
    </div>
  );
}

// ─── Dashboard Page ────────────────────────────────────────────────────────────
function DashboardPage({ metrics, patient, staff }) {
  const cards = [
    { label: "Femmes suivies",  value: metrics?.patients_count    ?? "—", sub: "+12% ce mois",               icon: <Users size={20} />,         color: "text-olive bg-olive-light" },
    { label: "Alertes rouges",  value: metrics?.red_alerts_count  ?? "—", sub: `${metrics?.orange_alerts_count ?? 0} alertes oranges`, icon: <AlertTriangle size={20} />, color: "text-sawtha bg-sawtha-light" },
    { label: "Checks réalisés", value: metrics?.checkins_count    ?? "—", sub: "+8% ce mois",                icon: <CheckCircle2 size={20} />,  color: "text-olive bg-olive-light" },
    { label: "En révision",     value: metrics?.pending_reviews   ?? "—", sub: "En attente médecin",         icon: <Bell size={20} />,          color: "text-orange-600 bg-orange-50" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-olive-dark">Mode Dashboard</h1>
        <p className="text-stone-400 text-sm">Vue d'ensemble des suivis et alertes</p>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="bg-white rounded-2xl border border-cream-dark p-5 shadow-sm">
            <div className={`h-10 w-10 rounded-xl flex items-center justify-center mb-3 ${c.color}`}>{c.icon}</div>
            <p className="text-3xl font-black text-stone-800">{c.value}</p>
            <p className="text-sm font-bold text-stone-600 mt-1">{c.label}</p>
            <p className="text-xs text-stone-400 mt-0.5">{c.sub}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid md:grid-cols-3 gap-4">
        <div className="md:col-span-2 bg-white rounded-2xl border border-cream-dark p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-black text-olive-dark">Vue des rapports</h2>
            <span className="text-xs text-stone-400 bg-cream px-3 py-1 rounded-full border border-cream-dark">30 derniers jours</span>
          </div>
          <FakeLineChart />
        </div>
        <div className="bg-white rounded-2xl border border-cream-dark p-5 shadow-sm">
          <h2 className="font-black text-olive-dark mb-4">Répartition des classifications</h2>
          <DonutChart
            segments={[
              { pct: 58, color: "#3A5A2A", label: "Vert (Bon)" },
              { pct: 30, color: "#f97316", label: "Orange (Modéré)" },
              { pct: 12, color: "#C8571B", label: "Rouge (Élevé)" },
            ]}
            total={metrics?.patients_count ?? 0}
          />
        </div>
      </div>

      {/* Active patient */}
      {patient && (
        <div className="bg-white rounded-2xl border border-cream-dark p-5 shadow-sm">
          <h2 className="font-black text-olive-dark mb-3">Patiente active</h2>
          <div className="flex flex-wrap items-center gap-3 p-3 bg-cream rounded-xl border border-cream-dark">
            <div className="h-10 w-10 rounded-xl bg-sawtha-light flex items-center justify-center shrink-0">
              <UserRound size={18} className="text-sawtha" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-black text-stone-800">{patient.full_name}</p>
              <p className="text-xs text-stone-400">
                {patient.douar}, {patient.province} · Semaine {patient.pregnancy_week} · {patient.distance_to_health_center_km} km
                {patient.missed_checkups > 0 && <span className="ml-2 text-sawtha font-bold">· {patient.missed_checkups} visite(s) manquée(s)</span>}
              </p>
            </div>
            {staff && (
              <div className="text-right shrink-0">
                <p className="text-xs font-black text-olive">{staff.full_name}</p>
                <p className="text-xs text-stone-400">{staff.health_center}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Fake Line Chart ──────────────────────────────────────────────────────────
function FakeLineChart() {
  const checks  = [20,25,22,30,28,35,32,40,38,42,39,45,43,50,48,52,49,55,53,58,56,60,57,62,60,65,63,68,65,70];
  const oranges = [5,8,6,10,9,12,11,15,13,16,14,18,16,20,18,22,20,24,22,26,24,28,26,30,28,30,28,32,30,32];
  const reds    = [2,3,2,4,3,5,4,6,5,7,6,8,7,9,8,10,9,11,10,12,11,12,11,13,12,14,13,15,14,15];
  const W = 500, H = 140, MAX = 80;

  function toPath(data) {
    return data.map((v, i) => `${i === 0 ? "M" : "L"} ${(i / (data.length - 1)) * W} ${H - (v / MAX) * H}`).join(" ");
  }

  const lines = [
    { data: checks,  color: "#3A5A2A", label: "Checks réalisés" },
    { data: oranges, color: "#f97316", label: "Alertes oranges" },
    { data: reds,    color: "#C8571B", label: "Alertes rouges" },
  ];

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 140 }}>
        {lines.map((l) => (
          <path key={l.label} d={toPath(l.data)} fill="none" stroke={l.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        ))}
      </svg>
      <div className="flex gap-4 mt-3 flex-wrap">
        {lines.map((l) => (
          <div key={l.label} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: l.color }} />
            <span className="text-xs text-stone-500">{l.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Donut Chart ───────────────────────────────────────────────────────────────
function DonutChart({ segments, total }) {
  const R = 52, CX = 64, CY = 64;
  const circ = 2 * Math.PI * R;
  let offset = 0;
  return (
    <div className="flex items-center gap-5">
      <svg viewBox="0 0 128 128" className="w-28 h-28 shrink-0">
        {segments.map((s) => {
          const dash = (s.pct / 100) * circ;
          const el = (
            <circle
              key={s.label}
              cx={CX} cy={CY} r={R}
              fill="none"
              stroke={s.color}
              strokeWidth="18"
              strokeDasharray={`${dash} ${circ}`}
              strokeDashoffset={-((offset / 100) * circ)}
              transform={`rotate(-90 ${CX} ${CY})`}
            />
          );
          offset += s.pct;
          return el;
        })}
        <text x={CX} y={CY - 5} textAnchor="middle" fontSize="14" fontWeight="bold" fill="#2D4520">{total}</text>
        <text x={CX} y={CY + 12} textAnchor="middle" fontSize="9" fill="#78716c">total</text>
      </svg>
      <div className="space-y-2.5">
        {segments.map((s) => (
          <div key={s.label} className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full shrink-0" style={{ background: s.color }} />
            <div>
              <p className="text-xs font-bold text-stone-700">{s.label}</p>
              <p className="text-xs text-stone-400">{s.pct}%</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Mode Femme Page ───────────────────────────────────────────────────────────
function FemmePage({ session, patient, staff, carePlan }) {
  const [transcript, setTranscript] = useState("");
  const [result, setResult]         = useState(null);
  const [loading, setLoading]       = useState(false);
  const [message, setMessage]       = useState("");

  async function analyze() {
    if (!message.trim()) return;
    setLoading(true); setResult(null);
    try {
      const data = await apiPost("/agent/analyze", { patient_id: session.patientId, message, source: "dashboard" });
      setResult(data);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-2xl font-black text-olive-dark">Espace Personnel</h1>
          <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-sawtha-light text-sawtha border border-sawtha/20">Votre espace personnel</span>
        </div>
        <p className="text-stone-400 text-sm">Parler en Darija, Sawtha vous comprend et vous accompagne</p>
      </div>

      {/* Doctor + appointment — first */}
      <div className="grid md:grid-cols-3 gap-4 items-start">
        <div className="md:col-span-2">
          <AssignedDoctorCard staff={staff} carePlan={carePlan} />
        </div>
        <AppointmentCard patient={patient} />
      </div>

      {/* Call + transcription + results */}
      <div className="grid md:grid-cols-3 gap-4 items-start">
        <CallPanel
          patientId={session.patientId}
          onResult={(data) => { setResult(data); setLoading(false); }}
          onTranscript={(t) => { setTranscript(t); }}
        />
        <TranscriptionPanel transcript={transcript} result={result} loading={loading} />
        <ResultsPanel result={result} />
      </div>
    </div>
  );
}

// ─── Call Panel ────────────────────────────────────────────────────────────────
function CallPanel({ patientId, onResult, onTranscript }) {
  return (
    <div className="bg-white rounded-2xl border border-cream-dark shadow-sm overflow-hidden">
      <div className="bg-olive-dark px-5 py-5 flex items-center gap-3">
        <div className="h-9 w-9 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
          <span className="text-lg">🎙️</span>
        </div>
        <div>
          <p className="font-black text-white text-base">Appel vocal en cours</p>
          <p className="text-olive-light/60 text-xs mt-0.5">Parlez librement en Darija</p>
        </div>
      </div>
      <div className="p-5">
        <VoiceRecorder
          patientId={patientId}
          onResult={onResult}
          onTranscript={onTranscript}
        />
      </div>
    </div>
  );
}

// ─── Transcription Panel ──────────────────────────────────────────────────────
const SYMPTOM_KEYS = [
  { key: "fetal_movement",       label: "Mouvements fœtaux absents", positive: (v) => v === "absent" || v === "reduced" },
  { key: "bleeding",             label: "Saignements",               positive: (v) => v === "true" },
  { key: "abdominal_pain",       label: "Douleurs abdominales",      positive: (v) => v === "severe" || v === "mild" },
  { key: "headache",             label: "Céphalées",                 positive: (v) => v === "severe" || v === "mild" },
  { key: "fever",                label: "Fièvre",                    positive: (v) => v === "high" || v === "mild" },
  { key: "dizziness",            label: "Vertiges",                  positive: (v) => v === "true" },
  { key: "blurred_vision",       label: "Vision trouble",            positive: (v) => v === "true" },
  { key: "breathing_difficulty", label: "Difficultés respiratoires", positive: (v) => v === "true" },
  { key: "convulsions",          label: "Convulsions",               positive: (v) => v === "true" },
];

function TranscriptionPanel({ transcript, result, loading }) {
  const symptoms = result?.extracted_symptoms;
  return (
    <div className="space-y-4">
      {/* Transcription */}
      <div className="bg-white rounded-2xl border border-cream-dark shadow-sm p-5">
        <div className="flex items-center gap-2 mb-3">
          <span className="h-2 w-2 rounded-full bg-sawtha" />
          <h2 className="font-black text-olive-dark">Transcription (Darija)</h2>
        </div>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-stone-400">
            <div className="h-3 w-3 rounded-full border-2 border-sawtha border-t-transparent animate-spin" />
            Analyse en cours...
          </div>
        ) : transcript ? (
          <p className="text-stone-700 leading-7 text-sm bg-cream rounded-xl p-3 border border-cream-dark" dir="rtl">{transcript}</p>
        ) : (
          <p className="text-stone-300 text-sm italic">La transcription apparaîtra ici...</p>
        )}
      </div>

      {/* Extraction médicale */}
      <div className="bg-white rounded-2xl border border-cream-dark shadow-sm p-5">
        <h2 className="font-black text-olive-dark mb-3">Extraction médicale</h2>
        {symptoms ? (
          <div className="space-y-0">
            {SYMPTOM_KEYS.map(({ key, label, positive }) => {
              const val = symptoms[key];
              if (val === undefined || val === null || val === "unknown") return null;
              const isPositive = positive(val);
              return (
                <div key={key} className="flex items-center justify-between py-2 border-b border-cream-dark last:border-0">
                  <span className="text-sm text-stone-600">{label}</span>
                  <span className={`text-xs font-black px-2.5 py-0.5 rounded-full ${isPositive ? "bg-sawtha-light text-sawtha" : "bg-cream text-stone-400 border border-cream-dark"}`}>
                    {isPositive ? "Oui" : "Non"}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-stone-300 text-sm italic">Les symptômes apparaîtront ici...</p>
        )}
        {symptoms?.normalized_summary && (
          <p className="text-xs text-stone-500 mt-3 pt-3 border-t border-cream-dark leading-5">{symptoms.normalized_summary}</p>
        )}
      </div>
    </div>
  );
}

// ─── Results Panel ─────────────────────────────────────────────────────────────
function ResultsPanel({ result }) {
  const risk = result?.risk;
  const cfg  = risk ? (RISK_CONFIG[risk.risk_level] || RISK_CONFIG.green) : null;

  return (
    <div className="space-y-4">
      {/* Symptoms summary */}
      {result?.extracted_symptoms?.normalized_summary && (
        <div className="bg-white rounded-2xl border border-cream-dark shadow-sm p-5">
          <h2 className="font-black text-olive-dark mb-3">Symptômes détectés</h2>
          <ul className="space-y-1.5">
            {SYMPTOM_KEYS.filter(({ key, positive }) => {
              const v = result.extracted_symptoms[key];
              return v && v !== "unknown" && positive(v);
            }).map(({ label }) => (
              <li key={label} className="flex items-center gap-2 text-sm text-stone-700">
                <span className="h-1.5 w-1.5 rounded-full bg-sawtha shrink-0" />{label}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Risk classification */}
      {risk && cfg ? (
        <div className={`rounded-2xl border p-5 ${cfg.card}`}>
          <div className="flex items-center gap-2 mb-3">
            <HeartPulse size={16} />
            <h2 className="font-black">Classification finale</h2>
          </div>
          <div className={`inline-block rounded-xl px-4 py-2 font-black text-base mb-3 ${cfg.badge}`}>
            {risk.risk_level.replace("_", " ").toUpperCase()}
          </div>
          <p className="text-sm leading-6 mb-3">{risk.risk_reason}</p>
          <div className={`rounded-xl p-3 border mt-1 ${
            risk.risk_level === "green"        ? "bg-olive-light border-olive/30" :
            risk.risk_level === "orange"       ? "bg-orange-50 border-orange-200" :
            risk.risk_level === "red"          ? "bg-sawtha-light border-sawtha/30" :
                                                 "bg-red-50 border-red-300"
          }`}>
            <p className={`text-xs font-bold mb-2 ${
              risk.risk_level === "green"  ? "text-olive" :
              risk.risk_level === "orange" ? "text-orange-700" :
                                             "text-sawtha-dark"
            }`}>Action recommandée</p>
            <p className="text-sm leading-7 text-right" dir="rtl">{risk.recommended_action}</p>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-cream-dark p-5 text-center">
          <HeartPulse size={24} className="text-stone-200 mx-auto mb-2" />
          <p className="text-stone-300 text-sm">Classification finale</p>
        </div>
      )}

      {/* Alert */}
      {result?.alert && (
        <div className="rounded-2xl bg-sawtha p-4 flex items-start gap-3">
          <AlertTriangle size={18} className="text-white shrink-0 mt-0.5" />
          <div>
            <p className="font-black text-white text-sm">Alerte envoyée</p>
            <p className="text-white/70 text-xs mt-0.5">{result.alert.status?.replace(/_/g, " ")}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Appointment Card ─────────────────────────────────────────────────────────
function AppointmentCard({ patient }) {
  if (!patient?.upcoming_appointment) return null;
  const date = new Date(patient.upcoming_appointment);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const days = Math.ceil((date - today) / 86400000);
  const badgeClass = days <= 0 ? "bg-sawtha text-white" : days <= 3 ? "bg-orange-500 text-white" : "bg-olive-light text-olive border border-olive/20";
  const badgeText  = days <= 0 ? "Aujourd'hui!" : `Dans ${days} jour${days > 1 ? "s" : ""}`;
  return (
    <div className="bg-white rounded-2xl border border-cream-dark shadow-sm p-5 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <CalendarDays size={16} className="text-olive" />
        <h2 className="font-black text-olive-dark">Prochain rendez-vous</h2>
      </div>
      <p className="text-xl font-black text-stone-800 capitalize">
        {date.toLocaleDateString("fr-MA", { weekday: "long", day: "numeric", month: "long" })}
      </p>
      {patient.assigned_health_center && (
        <p className="text-xs text-stone-400 flex items-center gap-1">
          <MapPin size={11} /> {patient.assigned_health_center}
        </p>
      )}
      <span className={`self-start text-xs font-black px-3 py-1.5 rounded-full ${badgeClass}`}>
        {badgeText}
      </span>
    </div>
  );
}

// ─── Assigned Doctor Card ─────────────────────────────────────────────────────
function AssignedDoctorCard({ staff, carePlan }) {
  if (!staff) return null;
  const roleLabel = staff.role === "midwife" ? "Doctor" : "Médecin";
  const roleIcon  = staff.role === "midwife" ? "👩‍⚕️" : "🩺";
  return (
    <div className="bg-white rounded-2xl border border-cream-dark shadow-sm p-5">
      <div className="flex items-center gap-2 mb-4">
        <Stethoscope size={16} className="text-olive" />
        <h2 className="font-black text-olive-dark">Médecin / Sage-femme assigné(e)</h2>
      </div>
      <div className="flex flex-wrap gap-4 items-start">
        {/* Identity */}
        <div className="flex items-center gap-3 flex-1 min-w-48">
          <img src={doctorAvatar} alt={staff.full_name} className="h-14 w-14 rounded-xl object-cover shrink-0 border border-cream-dark" />
          <div>
            <p className="font-black text-stone-800">{staff.full_name}</p>
            <p className="text-xs text-olive font-semibold">{roleLabel}</p>
            <p className="text-xs text-stone-400 flex items-center gap-1 mt-0.5">
              <MapPin size={10} /> {staff.health_center}
            </p>
          </div>
        </div>

        {/* Check-in */}
        {carePlan && (
          <div className="flex flex-col gap-1 border-l border-cream-dark pl-4">
            <p className="text-xs text-stone-400 font-bold uppercase tracking-wide">Fréquence de suivi</p>
            <p className="font-black text-olive capitalize">{carePlan.checkin_frequency}</p>
          </div>
        )}

      </div>
    </div>
  );
}

// ─── Login ────────────────────────────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [selected, setSelected] = useState(DEMO_ACCOUNTS[0].id);
  const account = DEMO_ACCOUNTS.find((a) => a.id === selected);
  return (
    <div className="min-h-screen bg-cream flex items-center justify-center px-5">
      <div className="max-w-4xl w-full grid md:grid-cols-2 gap-6">
        {/* Brand */}
        <div className="bg-white rounded-3xl border border-cream-dark p-8 flex flex-col gap-6 shadow-sm">
          <div className="flex flex-col gap-2">
            <SawthaLogo size={52} />
            <p className="text-sawtha text-sm font-semibold italic">"From her voice to help, before it's too late."</p>
          </div>
          <p className="text-stone-600 leading-7">
            Coordination des soins maternels ruraux par l'IA. Appels vocaux en Darija quand il n'y a pas d'internet. Aucune femme oubliée.
          </p>
          <div className="bg-olive-dark rounded-2xl p-5 text-white space-y-2">
            <p className="text-olive-light/70 text-xs font-bold uppercase tracking-wide mb-3">Comment ça marche</p>
            {[
              ["🎤", "La femme parle en Darija"],
              ["🤖", "L'agent analyse avec 6 outils"],
              ["⚠️", "Le risque est classifié automatiquement"],
              ["👨‍⚕️", "Le médecin reçoit un rapport immédiat"],
              ["👨‍👩‍👧", "La famille est alertée en Darija"],
            ].map(([icon, text]) => (
              <div key={text} className="flex items-center gap-3 text-sm">
                <span>{icon}</span><span className="text-olive-light/90">{text}</span>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {["Women-first", "Darija-first", "Rural-first", "AI-powered"].map((t) => (
              <span key={t} className="text-xs font-bold px-3 py-1 rounded-full bg-sawtha-light text-sawtha border border-sawtha/20">{t}</span>
            ))}
          </div>
        </div>

        {/* Login */}
        <div className="bg-white rounded-3xl border border-cream-dark p-8 flex flex-col gap-4 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-xl bg-cream flex items-center justify-center">
              <LockKeyhole size={18} className="text-olive" />
            </div>
            <h2 className="text-xl font-black text-olive-dark">Accès Démo</h2>
          </div>
          <p className="text-xs text-stone-400 -mt-2">Choisissez un profil patient pour tester la plateforme</p>
          {DEMO_ACCOUNTS.map((a) => (
            <button
              key={a.id}
              onClick={() => setSelected(a.id)}
              className={`text-left rounded-2xl border p-4 transition ${selected === a.id ? "border-sawtha/40 bg-sawtha-light" : "border-cream-dark hover:bg-cream"}`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-black text-stone-800">{a.name}</p>
                  <p className="text-xs text-sawtha font-semibold mt-0.5">{a.tag}</p>
                </div>
                {selected === a.id && <CheckCircle2 size={18} className="text-sawtha shrink-0" />}
              </div>
            </button>
          ))}
          <button
            onClick={() => onLogin(account)}
            className="mt-2 w-full bg-sawtha hover:bg-sawtha-dark text-white font-black py-4 rounded-2xl transition shadow-sm text-lg"
          >
            Accéder à Sawtha →
          </button>
        </div>
      </div>
    </div>
  );
}
