import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Baby,
  Bell,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  HeartPulse,
  Home,
  Info,
  LockKeyhole,
  LogOut,
  Mic,
  Phone,
  ShieldCheck,
  Signal,
  Sparkles,
  UserRound,
  WifiOff,
} from "lucide-react";
import { apiGet, apiPost } from "./api";

const RISK_STYLES = {
  green: "bg-emerald-100 text-emerald-800 border-emerald-200",
  orange: "bg-orange-100 text-orange-800 border-orange-200",
  red: "bg-red-100 text-red-800 border-red-200",
  red_critical: "bg-red-200 text-red-950 border-red-300",
};

const PRIORITY_STYLES = {
  normal: "bg-emerald-100 text-emerald-800 border-emerald-200",
  elevated: "bg-orange-100 text-orange-800 border-orange-200",
  urgent: "bg-red-100 text-red-800 border-red-200",
  critical: "bg-red-200 text-red-950 border-red-300",
};

const DEFAULT_PATIENT_MESSAGE =
  "La, mn sbah ma 7ssitch b bébé w 3ndi wje3 qwi f kerchi.";

const DEMO_ACCOUNTS = [
  {
    id: "aicha",
    patientId: "P001",
    name: "Lalla Aicha Benali",
    role: "Pregnant woman",
    profile: "Voice-first rural profile",
    defaultMode: "call",
    description:
      "No internet, basic phone, illiterate profile. Sawtha reaches her through Darija AI calls.",
  },
  {
    id: "fatima",
    patientId: "P002",
    name: "Fatima Zahra El Amrani",
    role: "Pregnant woman",
    profile: "Dashboard + fallback call",
    defaultMode: "dashboard",
    description:
      "Can use the dashboard when connected, but receives AI calls when the connection is weak or the check is missed.",
  },
];

const DEMO_MEDICAL_STAFF = {
  MS001: {
    id: "MS001",
    full_name: "Sage-femme Nadia",
    role: "Assigned midwife",
    health_center: "Centre de Santé Tnine Chtouka",
    phone: "+212 600 000 101",
    availability: "Mon - Fri · 09:00 - 16:00",
    specialization: "Maternal follow-up and rural pregnancy monitoring",
    language: "Darija / Arabic / French",
  },
  MS002: {
    id: "MS002",
    full_name: "Dr. Amal R.",
    role: "Associated doctor",
    health_center: "Centre de Santé Oulad Mbarek",
    phone: "+212 600 000 202",
    availability: "Mon - Sat · 10:00 - 15:00",
    specialization: "General medicine and antenatal care",
    language: "Darija / Arabic / French",
  },
};

export default function App() {
  const [session, setSession] = useState(() => {
    try {
      const savedSession = localStorage.getItem("sawtha_session");
      return savedSession ? JSON.parse(savedSession) : null;
    } catch {
      return null;
    }
  });

  const selectedPatientId = session?.patientId;

  const [patient, setPatient] = useState(null);
  const [carePlan, setCarePlan] = useState(null);

  const [activeMode, setActiveMode] = useState(
    session?.defaultMode || "dashboard"
  );
  const [message, setMessage] = useState(DEFAULT_PATIENT_MESSAGE);
  const [analysisResult, setAnalysisResult] = useState(null);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  function handleLogin(account) {
    const newSession = {
      userId: account.id,
      patientId: account.patientId,
      name: account.name,
      role: account.role,
      profile: account.profile,
      defaultMode: account.defaultMode,
    };

    localStorage.setItem("sawtha_session", JSON.stringify(newSession));
    setSession(newSession);
    setActiveMode(account.defaultMode);
    setMessage(DEFAULT_PATIENT_MESSAGE);
    setAnalysisResult(null);
    setErrorMessage("");
  }

  function handleLogout() {
    localStorage.removeItem("sawtha_session");
    setSession(null);
    setPatient(null);
    setCarePlan(null);
    setAnalysisResult(null);
    setMessage(DEFAULT_PATIENT_MESSAGE);
    setErrorMessage("");
  }

  async function loadPatientDetails(patientId) {
    if (!patientId) return;

    try {
      setErrorMessage("");

      const [patientData, carePlanData] = await Promise.all([
        apiGet(`/patients/${patientId}`),
        apiGet(`/patients/${patientId}/care-plan`),
      ]);

      setPatient(patientData);
      setCarePlan(carePlanData);
      setAnalysisResult(null);
    } catch (error) {
      setErrorMessage(
        "Could not load patient details or care plan. Make sure the backend is running on port 8000."
      );
    }
  }

  useEffect(() => {
    if (selectedPatientId) {
      loadPatientDetails(selectedPatientId);
    }
  }, [selectedPatientId]);

  async function runAnalysis(source) {
    if (!selectedPatientId) return;

    try {
      setIsLoading(true);
      setErrorMessage("");
      setAnalysisResult(null);

      const result = await apiPost("/checkins/analyze", {
        patient_id: selectedPatientId,
        message,
        source,
      });

      setAnalysisResult(result);
    } catch (error) {
      setErrorMessage("AI analysis failed. Please check backend logs.");
    } finally {
      setIsLoading(false);
    }
  }

  const currentQuestion = useMemo(() => {
    return carePlan?.questions?.[0]?.text_darija || "Wach nti bikhir lyoma?";
  }, [carePlan]);

  const profileType = useMemo(() => {
    if (!patient) return "Loading";

    const noInternet = ["none", "weak", "no"].includes(
      String(patient.internet_access).toLowerCase()
    );

    const lowLiteracy = ["illiterate", "low", "none"].includes(
      String(patient.literacy_level).toLowerCase()
    );

    if (noInternet || lowLiteracy || patient.phone_type === "basic_phone") {
      return "Voice-first rural profile";
    }

    return "Dashboard-ready profile";
  }, [patient]);

  const associatedStaff = useMemo(() => {
    if (!patient?.assigned_staff_id) return null;

    return (
      DEMO_MEDICAL_STAFF[patient.assigned_staff_id] || {
        id: patient.assigned_staff_id,
        full_name: "Assigned health worker",
        role: "Associated care provider",
        health_center: patient.assigned_health_center,
        phone: "Not available",
        availability: "Not available",
        specialization: "Pregnancy follow-up",
        language: "Darija / Arabic",
      }
    );
  }, [patient]);

  const surveyTemplate = useMemo(() => {
    if (!carePlan) return null;

    return {
      frequency: carePlan.checkin_frequency || "weekly",
      questions: carePlan.questions || [],
      redFlags: carePlan.red_flags || [],
      orangeFlags: carePlan.orange_flags || [],
      escalationThreshold: carePlan.escalation_threshold || "red",
    };
  }, [carePlan]);

  const dashboardKPIs = useMemo(() => {
    if (!patient) return [];

    const latestRisk = analysisResult?.risk?.risk_level || "not checked yet";
    const ruralPriority =
      analysisResult?.rural_priority?.mobility_priority || "not evaluated";

    return [
      {
        label: "Pregnancy progress",
        value: `Month ${patient.pregnancy_month}`,
        helper: `Week ${patient.pregnancy_week}`,
        icon: <Baby size={22} />,
      },
      {
        label: "Distance to care",
        value: `${patient.distance_to_health_center_km} km`,
        helper: patient.assigned_health_center,
        icon: <Home size={22} />,
      },
      {
        label: "Last risk status",
        value: normalizeLabel(latestRisk),
        helper: "Generated after each check",
        icon: <HeartPulse size={22} />,
      },
      {
        label: "Rural priority",
        value: normalizeLabel(ruralPriority),
        helper: "Distance + transport + connectivity",
        icon: <Signal size={22} />,
      },
    ];
  }, [patient, analysisResult]);

  const personalAdvices = useMemo(() => {
    if (!patient) return [];

    const advices = [];

    if (
      ["none", "weak", "no"].includes(
        String(patient.internet_access).toLowerCase()
      )
    ) {
      advices.push({
        title: "Weak connection detected",
        text: "Ila ma kantch connexion, Sawtha ghadi t3ayet lik f date dyal check bach suivi ma yt9ta3ch.",
      });
    }

    if (patient.transport_available === false) {
      advices.push({
        title: "Transport not confirmed",
        text: "Khlli chi wa7ed mn l3a2ila wajed y3awnek ila ban chi risk orange wla red.",
      });
    }

    if (Number(patient.distance_to_health_center_km) >= 15) {
      advices.push({
        title: "Far from health center",
        text: "Hit nti b3ida 3la centre de santé, ay signal khatir khaso ytsift bzerba l proche w sage-femme.",
      });
    }

    advices.push({
      title: "Routine check",
      text: "Jawbi 3la check dyalek f dashboard ila 3andk connexion, w ila ma 9drtich Sawtha kat3ayet lik.",
    });

    return advices;
  }, [patient]);

  if (!session) {
    return <AuthScreen onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <Header session={session} onLogout={handleLogout} />

      <main className="max-w-7xl mx-auto px-5 md:px-8 py-8 space-y-8">
        {errorMessage && (
          <div className="rounded-2xl bg-red-50 border border-red-100 text-red-800 p-4 flex gap-3">
            <AlertTriangle className="shrink-0" />
            <p>{errorMessage}</p>
          </div>
        )}

        <section className="grid lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 space-y-6">
            <PatientHero patient={patient} profileType={profileType} />

            <AccessModeTabs activeMode={activeMode} onChange={setActiveMode} />

            {activeMode === "dashboard" ? (
              <DashboardMode
                patient={patient}
                carePlan={carePlan}
                associatedStaff={associatedStaff}
                surveyTemplate={surveyTemplate}
                message={message}
                setMessage={setMessage}
                onAnalyze={() => runAnalysis("dashboard")}
                isLoading={isLoading}
                dashboardKPIs={dashboardKPIs}
                personalAdvices={personalAdvices}
                analysisResult={analysisResult}
              />
            ) : (
              <VoiceCallMode
                patient={patient}
                currentQuestion={currentQuestion}
                message={message}
                setMessage={setMessage}
                onAnalyze={() => runAnalysis("simulated_call")}
                isLoading={isLoading}
                analysisResult={analysisResult}
                associatedStaff={associatedStaff}
                surveyTemplate={surveyTemplate}
              />
            )}
          </div>

          <div className="lg:col-span-4 space-y-6">
            <SessionCard
              session={session}
              activeMode={activeMode}
              profileType={profileType}
            />

            <AssociatedCareCard
              patient={patient}
              carePlan={carePlan}
              associatedStaff={associatedStaff}
              surveyTemplate={surveyTemplate}
            />
          </div>
        </section>

        {analysisResult && (
          <section className="grid lg:grid-cols-2 gap-6">
            <WomanResultCard result={analysisResult} />
            <ExtractedInfoCard result={analysisResult} />
          </section>
        )}

        {analysisResult && (
          <section className="grid lg:grid-cols-2 gap-6">
            <FamilyAlertCard result={analysisResult} />
            <AISafetyTrace result={analysisResult} />
          </section>
        )}
      </main>
    </div>
  );
}

function AuthScreen({ onLogin }) {
  const [selectedAccountId, setSelectedAccountId] = useState(
    DEMO_ACCOUNTS[0].id
  );

  const selectedAccount = DEMO_ACCOUNTS.find(
    (account) => account.id === selectedAccountId
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-teal-50 flex items-center justify-center px-5 py-10">
      <div className="max-w-5xl w-full grid lg:grid-cols-2 gap-6 items-stretch">
        <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-8 flex flex-col justify-between">
          <div>
            <div className="h-16 w-16 rounded-3xl bg-rose-100 flex items-center justify-center mb-6">
              <Sparkles className="text-rose-700" size={34} />
            </div>

            <h1 className="text-4xl font-black tracking-tight">Sawtha</h1>

            <p className="text-slate-600 mt-4 text-lg leading-8">
              Sawtha is a rural-first AI companion for pregnant women.
              Dashboard when possible, Darija AI call when needed.
            </p>

            <div className="mt-6 rounded-3xl bg-slate-50 border border-slate-100 p-5">
              <p className="font-bold text-slate-900">Darija promise</p>
              <p className="text-slate-700 mt-2 leading-8">
                Ila 3andk connexion, diri check f dashboard. Ila ma kantch
                connexion, Sawtha kat3ayet lik b Darija bach suivi dyalek ma
                yt9ta3ch.
              </p>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap gap-2">
            <Badge customClass="bg-rose-100 text-rose-800 border-rose-200">
              Women-first
            </Badge>
            <Badge customClass="bg-teal-100 text-teal-800 border-teal-200">
              Darija-first
            </Badge>
            <Badge customClass="bg-slate-100 text-slate-700 border-slate-200">
              Rural-first
            </Badge>
          </div>
        </div>

        <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-12 w-12 rounded-3xl bg-slate-100 flex items-center justify-center">
              <LockKeyhole className="text-slate-700" />
            </div>
            <div>
              <h2 className="text-2xl font-black">Login</h2>
              <p className="text-slate-500">
                Choose a demo woman account for the MVP.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {DEMO_ACCOUNTS.map((account) => (
              <button
                key={account.id}
                onClick={() => setSelectedAccountId(account.id)}
                className={`w-full text-left rounded-3xl border p-5 transition ${
                  selectedAccountId === account.id
                    ? "border-rose-300 bg-rose-50"
                    : "border-slate-100 hover:bg-slate-50"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-black text-lg">{account.name}</h3>
                    <p className="text-sm text-slate-600 mt-1">
                      {account.profile}
                    </p>
                  </div>

                  {selectedAccountId === account.id && (
                    <CheckCircle2 className="text-rose-700 shrink-0" />
                  )}
                </div>

                <p className="text-sm text-slate-600 mt-3 leading-6">
                  {account.description}
                </p>
              </button>
            ))}
          </div>

          <button
            onClick={() => onLogin(selectedAccount)}
            className="mt-6 w-full rounded-2xl bg-rose-600 text-white px-5 py-4 font-black hover:bg-rose-700"
          >
            Login to Sawtha
          </button>

          <p className="text-xs text-slate-500 mt-4 text-center">
            MVP login is simulated in the frontend. Real authentication can be
            added later.
          </p>
        </div>
      </div>
    </div>
  );
}

function Header({ session, onLogout }) {
  return (
    <header className="bg-gradient-to-r from-rose-50 via-white to-teal-50 border-b border-slate-100">
      <div className="max-w-7xl mx-auto px-5 md:px-8 py-7 flex flex-col md:flex-row md:items-center md:justify-between gap-5">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-3xl bg-rose-100 flex items-center justify-center">
            <Sparkles className="text-rose-700" size={30} />
          </div>

          <div>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight">
              Sawtha
            </h1>
            <p className="text-slate-600 mt-1">
              AI companion for rural pregnant women.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="rounded-2xl bg-white border border-slate-100 px-4 py-3">
            <p className="text-xs text-slate-500">Logged in as</p>
            <p className="font-bold">{session?.name}</p>
          </div>

          <button
            onClick={onLogout}
            className="rounded-2xl bg-slate-950 text-white px-4 py-3 font-bold flex items-center gap-2 hover:bg-slate-800"
          >
            <LogOut size={18} />
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}

function PatientHero({ patient, profileType }) {
  if (!patient) {
    return (
      <Card>
        <p className="text-slate-500">Loading patient profile...</p>
      </Card>
    );
  }

  const hasConnectivityIssue = ["none", "weak", "no"].includes(
    String(patient.internet_access).toLowerCase()
  );

  return (
    <Card className="overflow-hidden relative">
      <div className="absolute top-0 right-0 h-32 w-32 bg-rose-50 rounded-bl-full" />

      <div className="relative flex flex-col md:flex-row md:items-start md:justify-between gap-5">
        <div>
          <p className="text-sm font-semibold text-rose-700 mb-1">
            Main user surface
          </p>
          <h2 className="text-2xl md:text-3xl font-black">
            {patient.full_name}
          </h2>
          <p className="text-slate-600 mt-2">
            {patient.douar}, {patient.commune}, {patient.province}
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <Badge customClass="bg-rose-100 text-rose-800 border-rose-200">
              {profileType}
            </Badge>

            {hasConnectivityIssue && (
              <Badge tone="orange">
                <WifiOff size={14} /> Weak/no connection
              </Badge>
            )}

            {!patient.transport_available && (
              <Badge tone="orange">Transport not confirmed</Badge>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 min-w-full md:min-w-[360px]">
          <MiniMetric label="Pregnancy" value={`Week ${patient.pregnancy_week}`} />
          <MiniMetric label="Month" value={patient.pregnancy_month} />
          <MiniMetric
            label="Health center"
            value={`${patient.distance_to_health_center_km} km`}
          />
          <MiniMetric label="Phone" value={formatText(patient.phone_type)} />
        </div>
      </div>

      <div className="relative mt-6 rounded-3xl bg-slate-50 border border-slate-100 p-4">
        <p className="font-semibold text-slate-800">Darija message</p>
        <p className="text-slate-600 mt-1 leading-7">
          Ila 3andk connexion, diri check f dashboard. Ila ma kantch connexion,
          Sawtha kat3ayet lik b Darija bach suivi dyalek ma yt9ta3ch.
        </p>
      </div>
    </Card>
  );
}

function AccessModeTabs({ activeMode, onChange }) {
  return (
    <div className="grid md:grid-cols-2 gap-4">
      <ModeButton
        active={activeMode === "dashboard"}
        onClick={() => onChange("dashboard")}
        icon={<ClipboardList className="text-teal-700" />}
        title="Mode Dashboard"
        subtitle="KPIs, reports, advices, and self-check when the woman can access the app."
        activeClass="border-teal-300 bg-teal-50"
      />

      <ModeButton
        active={activeMode === "call"}
        onClick={() => onChange("call")}
        icon={<Phone className="text-rose-700" />}
        title="Mode Appel Darija"
        subtitle="AI call for women with no connection, simple phone, low literacy, or missed check."
        activeClass="border-rose-300 bg-rose-50"
      />
    </div>
  );
}

function ModeButton({ active, onClick, icon, title, subtitle, activeClass }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-3xl border p-5 text-left transition bg-white ${
        active ? activeClass : "border-slate-100 hover:bg-slate-50"
      }`}
    >
      <div className="h-12 w-12 rounded-2xl bg-white border border-slate-100 flex items-center justify-center mb-4">
        {icon}
      </div>
      <h3 className="text-lg font-black">{title}</h3>
      <p className="text-sm text-slate-600 mt-2 leading-6">{subtitle}</p>
    </button>
  );
}

function DashboardMode({
  patient,
  carePlan,
  associatedStaff,
  surveyTemplate,
  message,
  setMessage,
  onAnalyze,
  isLoading,
  dashboardKPIs,
  personalAdvices,
  analysisResult,
}) {
  return (
    <div className="space-y-6">
      <Card>
        <div className="flex items-center gap-3 mb-5">
          <div className="h-12 w-12 rounded-3xl bg-teal-100 flex items-center justify-center">
            <ClipboardList className="text-teal-700" />
          </div>

          <div>
            <h2 className="text-xl font-black">My pregnancy dashboard</h2>
            <p className="text-slate-600 text-sm">
              Surface for the woman when she can access the platform.
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-4 gap-3">
          {dashboardKPIs.map((kpi) => (
            <KPICard key={kpi.label} {...kpi} />
          ))}
        </div>
      </Card>

      <div className="grid lg:grid-cols-2 gap-6">
        <SurveyTemplateCard
          associatedStaff={associatedStaff}
          surveyTemplate={surveyTemplate}
        />

        <Card>
          <div className="flex items-center gap-3 mb-4">
            <HeartPulse className="text-rose-700" />
            <h3 className="font-black text-lg">Self-check answer</h3>
          </div>

          <label className="block text-sm font-semibold mb-2">
            Jawbi b Darija
          </label>

          <textarea
            className="w-full min-h-36 rounded-2xl border border-slate-200 p-4 focus:outline-none focus:ring-2 focus:ring-teal-200"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
          />

          <div className="mt-4 flex gap-3 flex-wrap">
            <PrimaryButton onClick={onAnalyze} disabled={isLoading} color="teal">
              {isLoading ? "Analyzing..." : "Submit my check"}
            </PrimaryButton>

            <SecondaryButton
              onClick={() =>
                setMessage(
                  "Ana bikhir, bébé kayt7rek bhal l3ada w ma kaynch dem."
                )
              }
            >
              Green example
            </SecondaryButton>
          </div>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <AdviceCard advices={personalAdvices} />
        <ReportPreview result={analysisResult} patient={patient} />
      </div>
    </div>
  );
}

function VoiceCallMode({
  patient,
  currentQuestion,
  message,
  setMessage,
  onAnalyze,
  isLoading,
  analysisResult,
  associatedStaff,
  surveyTemplate,
}) {
  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <Card>
        <div className="flex items-center gap-3 mb-5">
          <div className="h-12 w-12 rounded-3xl bg-rose-100 flex items-center justify-center">
            <Phone className="text-rose-700" />
          </div>

          <div>
            <h2 className="text-xl font-black">AI Darija call</h2>
            <p className="text-slate-600 text-sm">
              For women who cannot use the dashboard at check time.
            </p>
          </div>
        </div>

        <div className="rounded-3xl bg-slate-950 text-white p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-slate-400">Sawtha agent</div>
            <div className="flex items-center gap-2 text-xs text-emerald-300">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              Simulated call
            </div>
          </div>

          <p className="text-lg leading-8">
            “Salam {patient?.full_name?.split(" ")[1] || "Lalla"}, lyoma 3andk
            check dyal grossesse. {currentQuestion}”
          </p>
        </div>

        <div className="mt-4 rounded-3xl bg-rose-50 border border-rose-100 p-4">
          <p className="font-bold text-rose-900">Doctor-defined call flow</p>
          <p className="text-slate-700 mt-1 leading-7">
            Had l'appel kaytbe3 survey template li 7ddato{" "}
            <b>{associatedStaff?.full_name || "sage-femme"}</b>. Sawtha ma
            katkhtarsh l questions b rassha.
          </p>
        </div>

        <div className="mt-4 rounded-3xl bg-slate-50 border border-slate-100 p-4">
          <p className="font-bold text-slate-900">Call survey summary</p>
          <div className="grid grid-cols-2 gap-2 mt-3">
            <MiniInfo label="Defined by" value={associatedStaff?.full_name} />
            <MiniInfo label="Frequency" value={surveyTemplate?.frequency} />
            <MiniInfo
              label="Questions"
              value={surveyTemplate?.questions?.length || 0}
            />
            <MiniInfo
              label="Escalation"
              value={normalizeLabel(surveyTemplate?.escalationThreshold)}
            />
          </div>
        </div>

        <label className="block text-sm font-semibold mt-5 mb-2">
          Transcript extracted from the call
        </label>

        <textarea
          className="w-full min-h-36 rounded-2xl border border-slate-200 p-4 focus:outline-none focus:ring-2 focus:ring-rose-200"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
        />

        <div className="mt-4 flex gap-3 flex-wrap">
          <PrimaryButton onClick={onAnalyze} disabled={isLoading} color="rose">
            {isLoading ? "Analyzing..." : "Analyze call"}
          </PrimaryButton>

          <SecondaryButton
            onClick={() => setMessage("3ndi dawakh w skhana mn lbare7.")}
          >
            Orange example
          </SecondaryButton>

          <SecondaryButton
            onClick={() =>
              setMessage(
                "La, mn sbah ma 7ssitch b bébé w 3ndi wje3 qwi f kerchi."
              )
            }
          >
            Red example
          </SecondaryButton>
        </div>
      </Card>

      <Card>
        <div className="flex items-center gap-3 mb-5">
          <Mic className="text-slate-700" />
          <h3 className="font-black text-lg">Extracted from the call</h3>
        </div>

        {!analysisResult ? (
          <div className="h-full min-h-80 rounded-3xl border border-dashed border-slate-200 flex flex-col gap-3 items-center justify-center text-center text-slate-500 p-8">
            <Mic size={40} />
            <p>
              Run the call analysis to show what Sawtha understood from the
              Darija response.
            </p>
          </div>
        ) : (
          <CallExtractionView result={analysisResult} />
        )}
      </Card>
    </div>
  );
}

function SurveyTemplateCard({ associatedStaff, surveyTemplate }) {
  return (
    <Card>
      <div className="flex items-center gap-3 mb-4">
        <CalendarDays className="text-teal-700" />
        <div>
          <h3 className="font-black text-lg">Personalized survey template</h3>
          <p className="text-sm text-slate-500">
            Defined by{" "}
            {associatedStaff?.full_name || "the associated health worker"}.
          </p>
        </div>
      </div>

      <div className="rounded-2xl bg-teal-50 border border-teal-100 p-4 mb-4">
        <p className="font-bold text-teal-900">Darija explanation</p>
        <p className="text-sm text-slate-700 leading-6 mt-1">
          Had l questions machi générées b tariqa 3شوائية. Homa template
          mخصص 3tah médecin / sage-femme 7sab الحالة dyal l mra.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-3 mb-4">
        <MiniInfo label="Check frequency" value={surveyTemplate?.frequency} />
        <MiniInfo
          label="Escalation threshold"
          value={normalizeLabel(surveyTemplate?.escalationThreshold)}
        />
        <MiniInfo
          label="Number of questions"
          value={surveyTemplate?.questions?.length || 0}
        />
        <MiniInfo
          label="Defined by"
          value={associatedStaff?.full_name || "-"}
        />
      </div>

      <div className="space-y-3">
        {surveyTemplate?.questions?.map((question) => (
          <div
            key={question.id}
            className="rounded-2xl bg-slate-50 border border-slate-100 p-4"
          >
            <div className="flex items-center justify-between gap-3 mb-1">
              <div className="text-xs text-slate-500">
                Question {question.id}
              </div>
              <span className="text-xs px-2 py-1 rounded-full bg-white border border-slate-100 text-slate-600">
                {normalizeLabel(question.expected_signal)}
              </span>
            </div>

            <div className="font-semibold leading-7">
              {question.text_darija}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 grid md:grid-cols-2 gap-3">
        <FlagBox
          title="Doctor red flags"
          flags={surveyTemplate?.redFlags || []}
          tone="red"
        />
        <FlagBox
          title="Doctor orange flags"
          flags={surveyTemplate?.orangeFlags || []}
          tone="orange"
        />
      </div>
    </Card>
  );
}

function WomanResultCard({ result }) {
  const risk = result.risk.risk_level;
  const priority = result.rural_priority.mobility_priority;

  return (
    <Card>
      <div className="flex items-center gap-3 mb-5">
        <div className="h-12 w-12 rounded-3xl bg-rose-100 flex items-center justify-center">
          <HeartPulse className="text-rose-700" />
        </div>

        <div>
          <h2 className="text-xl font-black">My check result</h2>
          <p className="text-slate-600 text-sm">
            Simple result shown to the woman.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-5">
        <Badge tone={risk}>{normalizeLabel(risk)}</Badge>
        <Badge customClass={PRIORITY_STYLES[priority] || PRIORITY_STYLES.normal}>
          Rural priority: {normalizeLabel(priority)}
        </Badge>
        <Badge customClass="bg-slate-100 text-slate-700 border-slate-200">
          Confidence: {Math.round(result.extracted_symptoms.confidence * 100)}%
        </Badge>
      </div>

      <div className="rounded-3xl bg-slate-50 border border-slate-100 p-5">
        <h3 className="font-black mb-2">Sawtha understood</h3>
        <p className="text-slate-700 leading-7">
          {result.extracted_symptoms.normalized_summary}
        </p>
      </div>

      <div className="rounded-3xl bg-rose-50 border border-rose-100 p-5 mt-4">
        <h3 className="font-black mb-2">What should happen now?</h3>
        <p className="text-slate-800 leading-7">
          {result.risk.recommended_action}
        </p>
        <p className="text-slate-700 leading-7 mt-2">
          {result.rural_priority.next_action}
        </p>
      </div>
    </Card>
  );
}

function ExtractedInfoCard({ result }) {
  const symptoms = result.extracted_symptoms;

  const rows = [
    ["Baby movement", symptoms.fetal_movement],
    ["Bleeding", symptoms.bleeding],
    ["Abdominal pain", symptoms.abdominal_pain],
    ["Fever", symptoms.fever],
    ["Dizziness", symptoms.dizziness],
    ["Transport", symptoms.transport_available],
  ];

  return (
    <Card>
      <div className="flex items-center gap-3 mb-5">
        <div className="h-12 w-12 rounded-3xl bg-teal-100 flex items-center justify-center">
          <Sparkles className="text-teal-700" />
        </div>

        <div>
          <h2 className="text-xl font-black">Information extracted by AI</h2>
          <p className="text-slate-600 text-sm">
            Darija understanding transformed into structured medical signals.
          </p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        {rows.map(([label, value]) => (
          <div
            key={label}
            className="rounded-2xl bg-slate-50 border border-slate-100 p-4"
          >
            <div className="text-xs text-slate-500">{label}</div>
            <div className="font-bold mt-1">{normalizeLabel(value)}</div>
          </div>
        ))}
      </div>

      <div className="mt-5 grid md:grid-cols-2 gap-3">
        <FlagBox title="Red flags" flags={symptoms.red_flags} tone="red" />
        <FlagBox
          title="Orange flags"
          flags={symptoms.orange_flags}
          tone="orange"
        />
      </div>
    </Card>
  );
}

function FamilyAlertCard({ result }) {
  if (!result.alert) {
    return (
      <Card>
        <div className="flex items-center gap-3 mb-4">
          <CheckCircle2 className="text-emerald-700" />
          <h2 className="text-xl font-black">No family alert needed</h2>
        </div>

        <p className="text-slate-600 leading-7">
          This check was stored. Routine monitoring can continue.
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex items-center gap-3 mb-5">
        <div className="h-12 w-12 rounded-3xl bg-amber-100 flex items-center justify-center">
          <Bell className="text-amber-700" />
        </div>

        <div>
          <h2 className="text-xl font-black">Family alert prepared</h2>
          <p className="text-slate-600 text-sm">
            Message generated in Darija for the trusted person.
          </p>
        </div>
      </div>

      <div className="rounded-3xl bg-amber-50 border border-amber-100 p-5 text-lg leading-8">
        {result.family_message_darija}
      </div>

      <p className="text-xs text-slate-500 mt-4">
        In production, this can be sent through SMS, WhatsApp, or a real call
        center.
      </p>
    </Card>
  );
}

function AISafetyTrace({ result }) {
  return (
    <Card>
      <div className="flex items-center gap-3 mb-5">
        <div className="h-12 w-12 rounded-3xl bg-slate-100 flex items-center justify-center">
          <ShieldCheck className="text-slate-700" />
        </div>

        <div>
          <h2 className="text-xl font-black">AI architecture trace</h2>
          <p className="text-slate-600 text-sm">
            Visible AI pipeline for the judges.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <TraceStep
          title="1. Doctor-defined survey"
          value="Sawtha executes the personalized survey defined by the associated doctor or midwife."
        />
        <TraceStep
          title="2. Darija understanding"
          value={result.extracted_symptoms.normalized_summary}
        />
        <TraceStep
          title="3. Danger signal extraction"
          value={
            [
              ...result.extracted_symptoms.red_flags,
              ...result.extracted_symptoms.orange_flags,
            ].join(", ") || "No danger sign detected."
          }
        />
        <TraceStep
          title="4. Medical safety rules"
          value={result.risk.triggered_rules.join(" / ")}
        />
        <TraceStep
          title="5. Rural context scoring"
          value={result.rural_priority.reason}
        />
        <TraceStep
          title="6. Human-in-the-loop"
          value="Orange/red reports are prepared for doctor or midwife review. Sawtha does not replace medical staff."
        />
      </div>
    </Card>
  );
}

function AssociatedCareCard({
  patient,
  carePlan,
  associatedStaff,
  surveyTemplate,
}) {
  return (
    <Card>
      <div className="flex items-center gap-3 mb-4">
        <div className="h-10 w-10 rounded-2xl bg-slate-100 flex items-center justify-center">
          <Info className="text-slate-700" />
        </div>

        <div>
          <h2 className="text-lg font-black">Associated care</h2>
          <p className="text-sm text-slate-500">
            Doctor/midwife connected to this woman.
          </p>
        </div>
      </div>

      <div className="rounded-3xl bg-slate-950 text-white p-5 mb-4">
        <p className="text-sm text-slate-400">Associated health worker</p>
        <h3 className="text-xl font-black mt-1">
          {associatedStaff?.full_name || "Not assigned"}
        </h3>
        <p className="text-slate-300 mt-1">{associatedStaff?.role || "-"}</p>
      </div>

      <div className="space-y-3">
        <MiniInfo
          label="Health center"
          value={associatedStaff?.health_center || patient?.assigned_health_center}
        />
        <MiniInfo
          label="Specialization"
          value={associatedStaff?.specialization}
        />
        <MiniInfo label="Phone" value={associatedStaff?.phone} />
        <MiniInfo label="Availability" value={associatedStaff?.availability} />
        <MiniInfo label="Languages" value={associatedStaff?.language} />
        <MiniInfo label="Next appointment" value={patient?.upcoming_appointment} />
      </div>

      <div className="mt-5 rounded-2xl bg-rose-50 border border-rose-100 p-4">
        <p className="font-bold text-rose-900">Survey template</p>
        <p className="text-sm text-slate-700 leading-6 mt-1">
          The check-up questions are predefined by the associated doctor or
          midwife, then Sawtha executes them through dashboard or Darija call.
        </p>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <MiniInfo label="Frequency" value={surveyTemplate?.frequency} />
          <MiniInfo
            label="Questions"
            value={surveyTemplate?.questions?.length || 0}
          />
        </div>
      </div>

      <div className="mt-5 rounded-2xl bg-slate-50 border border-slate-100 p-4">
        <p className="text-sm text-slate-600 leading-6">
          The doctor/midwife is not the main user surface in this MVP, but their
          role is essential: they define the survey, review critical reports,
          and validate medical decisions.
        </p>
      </div>
    </Card>
  );
}

function SessionCard({ session, activeMode, profileType }) {
  return (
    <Card>
      <div className="flex items-center gap-3 mb-4">
        <div className="h-11 w-11 rounded-2xl bg-rose-100 flex items-center justify-center">
          <UserRound className="text-rose-700" />
        </div>

        <div>
          <h2 className="text-lg font-black">My Sawtha space</h2>
          <p className="text-sm text-slate-500">Personalized woman surface.</p>
        </div>
      </div>

      <div className="space-y-3">
        <MiniInfo label="Logged woman" value={session?.name} />
        <MiniInfo label="Profile" value={profileType} />
        <MiniInfo
          label="Current mode"
          value={
            activeMode === "dashboard" ? "Dashboard mode" : "AI Darija call"
          }
        />
      </div>

      <div className="mt-4 rounded-2xl bg-rose-50 border border-rose-100 p-4">
        <p className="text-sm text-slate-700 leading-6">
          Had l’espace mخصص للمرأة الحامل. Sawtha katbqa m3aha b dashboard ila
          3andha connexion, w b appel Darija ila ma 9dratch tdakhol.
        </p>
      </div>
    </Card>
  );
}

function AdviceCard({ advices }) {
  return (
    <Card>
      <div className="flex items-center gap-3 mb-4">
        <Sparkles className="text-teal-700" />
        <h3 className="font-black text-lg">Personal advices</h3>
      </div>

      <div className="space-y-3">
        {advices.map((advice) => (
          <div
            key={advice.title}
            className="rounded-2xl bg-slate-50 border border-slate-100 p-4"
          >
            <div className="font-bold">{advice.title}</div>
            <p className="text-sm text-slate-600 leading-6 mt-1">
              {advice.text}
            </p>
          </div>
        ))}
      </div>
    </Card>
  );
}

function ReportPreview({ result, patient }) {
  return (
    <Card>
      <div className="flex items-center gap-3 mb-4">
        <ClipboardList className="text-rose-700" />
        <h3 className="font-black text-lg">My report</h3>
      </div>

      {!result ? (
        <div className="rounded-3xl border border-dashed border-slate-200 p-8 text-center text-slate-500">
          After a check, Sawtha prepares a simple report and a medical review
          summary.
        </div>
      ) : (
        <div className="space-y-3">
          <MiniInfo label="Patient" value={patient?.full_name} />
          <MiniInfo
            label="Risk level"
            value={normalizeLabel(result.risk.risk_level)}
          />
          <MiniInfo
            label="Rural priority"
            value={normalizeLabel(result.rural_priority.mobility_priority)}
          />
          <MiniInfo label="Status" value="Pending human review if needed" />

          <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4">
            <div className="text-xs text-slate-500 mb-1">Report summary</div>
            <p className="text-sm text-slate-700 leading-6">
              {result.extracted_symptoms.normalized_summary}
            </p>
          </div>
        </div>
      )}
    </Card>
  );
}

function CallExtractionView({ result }) {
  const symptoms = result.extracted_symptoms;

  return (
    <div className="space-y-4">
      <div className="rounded-3xl bg-slate-50 border border-slate-100 p-5">
        <h3 className="font-black mb-2">Transcript meaning</h3>
        <p className="text-slate-700 leading-7">{symptoms.normalized_summary}</p>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <MiniInfo
          label="Baby movement"
          value={normalizeLabel(symptoms.fetal_movement)}
        />
        <MiniInfo label="Bleeding" value={normalizeLabel(symptoms.bleeding)} />
        <MiniInfo label="Pain" value={normalizeLabel(symptoms.abdominal_pain)} />
        <MiniInfo label="Fever" value={normalizeLabel(symptoms.fever)} />
      </div>

      <div className="rounded-3xl bg-rose-50 border border-rose-100 p-5">
        <h3 className="font-black mb-2">Risk decision</h3>

        <div className="flex flex-wrap gap-2 mb-3">
          <Badge tone={result.risk.risk_level}>
            {normalizeLabel(result.risk.risk_level)}
          </Badge>
          <Badge
            customClass={PRIORITY_STYLES[result.rural_priority.mobility_priority]}
          >
            {normalizeLabel(result.rural_priority.mobility_priority)}
          </Badge>
        </div>

        <p className="text-slate-700 leading-7">{result.risk.risk_reason}</p>
      </div>
    </div>
  );
}

function KPICard({ label, value, helper, icon }) {
  return (
    <div className="rounded-3xl bg-slate-50 border border-slate-100 p-4">
      <div className="h-10 w-10 rounded-2xl bg-white border border-slate-100 flex items-center justify-center text-slate-700 mb-3">
        {icon}
      </div>
      <div className="text-xs text-slate-500">{label}</div>
      <div className="font-black text-lg mt-1">{value}</div>
      <div className="text-xs text-slate-500 mt-1 line-clamp-2">{helper}</div>
    </div>
  );
}

function MiniMetric({ label, value }) {
  return (
    <div className="rounded-2xl bg-slate-50 border border-slate-100 p-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="font-black mt-1">{value}</div>
    </div>
  );
}

function MiniInfo({ label, value }) {
  return (
    <div className="rounded-2xl bg-slate-50 border border-slate-100 p-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="font-semibold mt-1">{value || "-"}</div>
    </div>
  );
}

function FlagBox({ title, flags, tone }) {
  const className =
    tone === "red"
      ? "bg-red-50 border-red-100 text-red-900"
      : "bg-orange-50 border-orange-100 text-orange-900";

  return (
    <div className={`rounded-2xl border p-4 ${className}`}>
      <div className="font-bold">{title}</div>
      <p className="text-sm mt-2">
        {flags?.length ? flags.map(normalizeLabel).join(", ") : "None"}
      </p>
    </div>
  );
}

function TraceStep({ title, value }) {
  return (
    <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4">
      <div className="font-bold text-sm">{title}</div>
      <p className="text-sm text-slate-600 leading-6 mt-1">{value}</p>
    </div>
  );
}

function Badge({ children, tone, customClass }) {
  const className =
    customClass ||
    RISK_STYLES[tone] ||
    "bg-slate-100 text-slate-700 border-slate-200";

  return (
    <span
      className={`inline-flex items-center gap-1 px-3 py-1 rounded-full border text-xs font-bold ${className}`}
    >
      {children}
    </span>
  );
}

function Card({ children, className = "" }) {
  return (
    <div
      className={`bg-white rounded-3xl border border-slate-100 shadow-sm p-5 ${className}`}
    >
      {children}
    </div>
  );
}

function PrimaryButton({ children, onClick, disabled, color = "rose" }) {
  const className =
    color === "teal"
      ? "bg-teal-600 hover:bg-teal-700"
      : "bg-rose-600 hover:bg-rose-700";

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-2xl text-white px-5 py-3 font-bold disabled:opacity-60 ${className}`}
    >
      {children}
    </button>
  );
}

function SecondaryButton({ children, onClick }) {
  return (
    <button
      onClick={onClick}
      className="rounded-2xl bg-slate-100 text-slate-800 px-5 py-3 font-bold hover:bg-slate-200"
    >
      {children}
    </button>
  );
}

function normalizeLabel(value) {
  if (value === null || value === undefined || value === "") return "-";
  return String(value).replaceAll("_", " ");
}

function formatText(value) {
  return normalizeLabel(value);
}