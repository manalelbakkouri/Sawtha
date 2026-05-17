import { useRef, useState } from "react";
import { Mic, Square, Loader, CheckCircle } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

const STEPS = [
  { key: "transcribing", label: "Whisper — converting voice to text..." },
  { key: "analyzing",    label: "Agent — analyzing symptoms (6 tools)..." },
  { key: "done",         label: "Done ✓" },
];

export default function VoiceRecorder({ patientId, onResult, onTranscript }) {
  const [state, setState] = useState("idle");
  const [error, setError] = useState(null);
  const mediaRef = useRef(null);
  const chunksRef = useRef([]);

  async function startRecording() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = getSupportedMime();
      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : {});
      chunksRef.current = [];
      // timeslice=250ms → يضمن ondataavailable يتسمى بانتظام
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => sendAudio(stream, recorder.mimeType);
      recorder.start(250);
      mediaRef.current = recorder;
      setState("recording");
    } catch (e) {
      setError(`Microphone error: ${e.message}`);
    }
  }

  function stopRecording() {
    mediaRef.current?.stop();
    setState("transcribing");
  }

  async function sendAudio(stream, mimeType) {
    stream.getTracks().forEach((t) => t.stop());

    const blob = new Blob(chunksRef.current, { type: mimeType });

    if (blob.size === 0) {
      setError("Audio fارغ — حاول تسجل ثانية");
      setState("idle");
      return;
    }

    const ext = mimeType?.includes("ogg") ? "ogg" : mimeType?.includes("mp4") ? "mp4" : "webm";
    const form = new FormData();
    form.append("patient_id", patientId);
    form.append("audio", blob, `recording.${ext}`);

    const switchTimer = setTimeout(() => setState("analyzing"), 4000);
    try {
      const res = await fetch(`${API_BASE}/agent/analyze-audio`, {
        method: "POST",
        body: form,
      });
      clearTimeout(switchTimer);
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Server error ${res.status}: ${text}`);
      }
      const data = await res.json();
      setState("done");
      onTranscript?.(data.transcript || "");
      onResult(data);
      setTimeout(() => setState("idle"), 1500);
    } catch (e) {
      clearTimeout(switchTimer);
      setError(e.message);
      setState("idle");
    }
  }

  const currentStep = STEPS.findIndex((s) => s.key === state);

  return (
    <div className="flex flex-col items-center gap-3 w-full">
      {state === "idle" && (
        <button
          onClick={startRecording}
          className="flex items-center gap-2 bg-sawtha hover:bg-sawtha-dark text-white font-bold px-5 py-3 rounded-2xl transition shadow-sm"
        >
          <Mic size={18} /> Record voice
        </button>
      )}

      {state === "recording" && (
        <button
          onClick={stopRecording}
          className="flex items-center gap-2 bg-olive-dark hover:bg-olive text-white font-bold px-5 py-3 rounded-2xl animate-pulse transition"
        >
          <Square size={18} /> Stop recording
        </button>
      )}

      {["transcribing", "analyzing", "done"].includes(state) && (
        <div className="w-full rounded-2xl border border-cream-dark bg-cream p-4 space-y-2">
          {STEPS.map((step, i) => {
            const active = step.key === state;
            const done = state === "done" || i < currentStep;
            return (
              <div key={step.key} className={`flex items-center gap-2 text-sm font-medium transition-all ${active ? "text-sawtha" : done ? "text-olive" : "text-stone-300"}`}>
                {done && !active ? <CheckCircle size={16} /> : active ? <Loader size={16} className="animate-spin" /> : <span className="w-4 h-4 rounded-full border border-current inline-block" />}
                {step.label}
              </div>
            );
          })}
        </div>
      )}

      {error && (
        <div className="w-full rounded-2xl bg-sawtha-light border border-sawtha/30 p-3">
          <p className="text-sawtha-dark text-sm font-medium">{error}</p>
        </div>
      )}
    </div>
  );
}

function getSupportedMime() {
  const types = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/ogg",
    "audio/mp4",
  ];
  return types.find((t) => MediaRecorder.isTypeSupported(t)) || "";
}
