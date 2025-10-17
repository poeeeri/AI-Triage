import React, { useState } from 'react';
import { SectionCard } from '../common/SectionCard.jsx';
import { inferProfile } from '../../utils/medicalUtils.js';
import { triageEngine } from '../../utils/triageEngine.js';
import { nowISO, PRIORITY } from '../../utils/constants.js';

const API_BASE = "https://bba9fmdqtv4tneakojp3.containers.yandexcloud.net";

function adaptServerTriageToUI(server) {
  const map = {
    "критично срочно": PRIORITY.CRIT,
    "срочно": PRIORITY.URG,
    "планово": PRIORITY.PLAN,
  };
  const p = map[server.priority] || PRIORITY.PLAN;

  const hint = (server.hint_for_doctor || "").trim();

  return {
    priorityKey: p.key,
    priorityColor: p.color,
    priorityDot: p.dot,
    reason: server.reason || "",
    redFlags: server.red_flags || [],
    confidence: typeof server.confidence === "number" ? server.confidence : 0.7,
    hint_for_doctor: hint,
    sources: server.sources || [],
  };
}

async function postTriage(payload) {
  const res = await fetch(`${API_BASE}/triage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Server ${res.status}: ${text}`);
  }
  return res.json();
}

export function IntakeForm({ onAddPatient }) {
  const [complaint, setComplaint] = useState("");
  const [history, setHistory] = useState("");
  const [bp, setBp] = useState("");
  const [hr, setHr] = useState("");
  const [spo2, setSpo2] = useState("");
  const [temp, setTemp] = useState("");
  const [rr, setRr] = useState("");
  const [gcs, setGcs] = useState("");
  const [age, setAge] = useState("");
  const [pregnancy, setPregnancy] = useState(false);
  const [isSending, setIsSending] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (isSending) return;
    setIsSending(true);

    const vitals = {
      bp: bp || undefined,
      hr: hr ? Number(hr) : undefined,
      spo2: spo2 ? Number(spo2) : undefined,
      temp: temp ? Number(temp) : undefined,
      rr: rr ? Number(rr) : undefined,
      gcs: gcs ? Number(gcs) : undefined,
    };
    const ageNum = age ? Number(age) : undefined;

    const base = {
      id: `ID-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      createdAt: nowISO(),
      complaint: complaint.trim(),
      history: history.trim(),
      vitals,
      age: ageNum,
      pregnancy,
    };

    try {
      const serverOut = await postTriage({
        complaint: base.complaint,
        history: base.history,
        vitals: base.vitals,
      });

      const triage = adaptServerTriageToUI(serverOut);
      const profile = (serverOut.profile || "therapy").toLowerCase();

      onAddPatient({ ...base, triage, profile });
    } catch (err) {
      console.warn("Бэк недоступен, используем локальный триаж:", err);

      const profileGuess = inferProfile({ complaint: base.complaint, age: ageNum });
      const local = triageEngine(base);
      const triage = {
        ...local,
        hint_for_doctor: local.hint_for_doctor || defaultHint(local.priorityKey),
      };
      onAddPatient({ ...base, triage, profile: profileGuess });
    } finally {
      setIsSending(false);
      setComplaint("");
      setHistory("");
      setBp(""); setHr(""); setSpo2(""); setTemp(""); setRr(""); setGcs("");
      setAge("");
      setPregnancy(false);
    }
  }

  return (
    <SectionCard title="Новый пациент (ввод данных)" className="lg:col-span-1">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="text-xs text-slate-500">Жалобы</label>
          <textarea
            value={complaint}
            onChange={(e) => setComplaint(e.target.value)}
            className="w-full border rounded-lg px-2 py-1.5"
            required
          />
        </div>

        <div>
          <label className="text-xs text-slate-500">Анамнез</label>
          <textarea
            value={history}
            onChange={(e) => setHistory(e.target.value)}
            className="w-full border rounded-lg px-2 py-1.5"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <input className="border rounded-lg px-2 py-1.5" placeholder="АД (напр. 120/80)" value={bp} onChange={(e)=>setBp(e.target.value)} />
          <input className="border rounded-lg px-2 py-1.5" placeholder="ЧСС" type="number" value={hr} onChange={(e)=>setHr(e.target.value)} />
          <input className="border rounded-lg px-2 py-1.5" placeholder="SpO₂ %" type="number" value={spo2} onChange={(e)=>setSpo2(e.target.value)} />
          <input className="border rounded-lg px-2 py-1.5" placeholder="Темп. °C" type="number" step="0.1" value={temp} onChange={(e)=>setTemp(e.target.value)} />
          <input className="border rounded-lg px-2 py-1.5" placeholder="ЧДД" type="number" value={rr} onChange={(e)=>setRr(e.target.value)} />
          <input className="border rounded-lg px-2 py-1.5" placeholder="GCS" type="number" value={gcs} onChange={(e)=>setGcs(e.target.value)} />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <input className="border rounded-lg px-2 py-1.5" placeholder="Возраст" type="number" value={age} onChange={(e)=>setAge(e.target.value)} />
          <label className="flex items-center gap-2 text-xs text-slate-600">
            <input type="checkbox" checked={pregnancy} onChange={(e)=>setPregnancy(e.target.checked)} />
            Беременность
          </label>
        </div>

        <div className="pt-1 flex items-center gap-2">
          <button
            type="submit"
            disabled={isSending}
            className="px-4 py-2 rounded-xl bg-slate-900 text-white text-sm hover:bg-slate-800 active:scale-[.99] disabled:opacity-60"
          >
            {isSending ? "Добавляем..." : "Добавить в очередь"}
          </button>
          <span className="text-xs text-slate-500">AI-оценка приоритета выполняется автоматически</span>
        </div>
      </form>
    </SectionCard>
  );
}
