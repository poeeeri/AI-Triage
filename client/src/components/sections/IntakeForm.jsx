import React, { useState } from 'react';
import { SectionCard } from '../common/SectionCard.jsx';
import { inferProfile } from '../../utils/medicalUtils.js';
import { triageEngine } from '../../utils/triageEngine.js';
import { nowISO, PRIORITY, defaultHint } from '../../utils/constants.js';

const safeDefaultHint = (pkey) =>
  (typeof defaultHint === 'function' ? defaultHint(pkey) : 'Рекомендации будут уточнены при осмотре.');

const API_BASE = (import.meta && import.meta.env && import.meta.env.VITE_API_BASE)
  ? import.meta.env.VITE_API_BASE
  : "https://bba9fmdqtv4tneakojp3.containers.yandexcloud.net";

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
  const [isSending, setIsSending] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (isSending) return;
    setIsSending(true);

    const strNum = (v) => {
      if (v === null || v === undefined) return undefined;
      const s = String(v).trim().replace(",", ".");
      if (s === "") return undefined;
      const n = Number(s);
      return Number.isFinite(n) ? String(n) : undefined;
    };
    const cleanBp = (() => {
      const s = String(bp || "").trim();
      return /^(\d{2,3})\s*([\/\-])\s*(\d{2,3})$/.test(s) ? s : undefined;
    })();

    const vitals = {
      bp: cleanBp,
      hr: strNum(hr),
      spo2: strNum(spo2),
      temp: strNum(temp),
      rr: strNum(rr),
      gcs: strNum(gcs),
    };
    const hasVitals = Object.values(vitals).some((v) => v !== undefined && v !== null);

    const base = {
      id: (globalThis.crypto && crypto.randomUUID)
        ? crypto.randomUUID()
        : `ID-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
      createdAt: nowISO(),
      complaint: complaint.trim(),
      history: history.trim(),
      vitals,
    };

    try {
      const payload = hasVitals
        ? { complaint: base.complaint, history: base.history, vitals }
        : { complaint: base.complaint, history: base.history };
      const serverOut = await postTriage(payload);

      const triage = adaptServerTriageToUI(serverOut);
      const profile = (serverOut.profile || "therapy").toLowerCase();

      onAddPatient({ ...base, triage, profile });
    } catch (err) {
      console.warn("Бэк недоступен, используем локальный триаж:", err);
      const profileGuess = inferProfile({ complaint: base.complaint });
      const local = triageEngine(base);
      const triage = {
        ...local,
        hint_for_doctor: local.hint_for_doctor || "",
      };
      onAddPatient({ ...base, triage, profile: profileGuess });
    } finally {
      setIsSending(false);
      setComplaint("");
      setHistory("");
      setBp(""); setHr(""); setSpo2(""); setTemp(""); setRr(""); setGcs("");
    }
  }

  return (
    <div className="lg:col-span-1 sticky top-20 self-start">
      <SectionCard>
        <div className="mb-2">
          <h2 className="text-lg font-semibold text-slate-800">Новый пациент (ввод данных)</h2>
        </div>
        <form onSubmit={handleSubmit} className="space-y-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-1">Жалобы</h3>
            <textarea
              value={complaint}
              onChange={(e) => setComplaint(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows="2"
              required
            />
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-1">Анамнез</h3>
            <textarea
              value={history}
              onChange={(e) => setHistory(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows="1"
            />
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-1">Показатели</h3>
            <div className="grid grid-cols-2 gap-2">
              <input className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="АД (напр. 120/80)" value={bp} onChange={(e)=>setBp(e.target.value)} />
              <input className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="ЧСС" type="number" value={hr} onChange={(e)=>setHr(e.target.value)} />
              <input className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="SpO₂ %" type="number" value={spo2} onChange={(e)=>setSpo2(e.target.value)} />
              <input className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="Темп. °C" type="number" step="0.1" value={temp} onChange={(e)=>setTemp(e.target.value)} />
              <input className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="ЧДД" type="number" value={rr} onChange={(e)=>setRr(e.target.value)} />
              <input className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="GCS" type="number" value={gcs} onChange={(e)=>setGcs(e.target.value)} />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={isSending}
              className="w-full px-4 py-3 rounded-lg bg-slate-900 text-white font-medium hover:bg-slate-800 active:scale-[.99] disabled:opacity-60 transition-all duration-200"
            >
              {isSending ? "Добавляем..." : "Добавить в очередь"}
            </button>
            <div className="mt-1 text-center">
              <span className="text-xs text-slate-500">AI-оценка приоритета выполняется автоматически</span>
            </div>
          </div>
        </form>
      </SectionCard>
    </div>
  );
}
