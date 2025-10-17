import React, { useMemo, useState } from 'react';
import { Header } from './components/layout/Header.jsx';
import { Footer } from './components/layout/Footer.jsx';
import { IntakeForm } from './components/sections/IntakeForm.jsx';
import { PatientQueue } from './components/sections/PatientQueue.jsx';
import { PatientDrawer } from './components/common/PatientDrawer.jsx';
import { seedPatients } from './data/seedData.js';
import { triageEngine } from './utils/triageEngine.js';
import { nowISO, PRIORITY, defaultHint } from './utils/constants.js';

export default function App() {
    const API = (import.meta && import.meta.env && import.meta.env.VITE_API_BASE)
      ? import.meta.env.VITE_API_BASE
      : "https://bba9fmdqtv4tneakojp3.containers.yandexcloud.net";

  
    function adaptServerTriageToUI(server) {
      const PRIORITY_MAP = {
        "критично срочно": "CRIT",
        "срочно": "URG",
        "планово": "PLAN",
      };
      const code = PRIORITY_MAP[server.priority] || "PLAN";
      const p = PRIORITY[code];
      const hint = (server.hint_for_doctor || "").trim() || defaultHint(p.key);

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

    const [profileFilter, setProfileFilter] = useState("all");
    const [patients, setPatients] = useState(seedPatients);
    const [selectedPatient, setSelectedPatient] = useState(null);

    const filteredPatients = useMemo(() => {
      const enriched = patients.map((p) => ({
        ...p,
        triage: p.triage || triageEngine(p),
    }));

    const withSortKey = enriched.map((p) => ({
      ...p,
      sortKey: p.triage.priorityKey === PRIORITY.CRIT.key ? 0 : 
              p.triage.priorityKey === PRIORITY.URG.key ? 1 : 2,
    }));

    const prof = profileFilter;
    const candidate = prof === "all" ? withSortKey : withSortKey.filter((p) => p.profile === prof);

      return candidate.sort((a, b) => a.sortKey - b.sortKey || new Date(a.createdAt) - new Date(b.createdAt));
    }, [patients, profileFilter]);

    function handleAddPatient(newPatient) {
      setPatients((prev) => [newPatient, ...prev]);
    }

    async function handleRetriage() {
    if (!selectedPatient) return;

    // const payload = {
    //   complaint: selectedPatient.complaint,
    //   history: selectedPatient.history,
    //   vitals: selectedPatient.vitals,
    // };
    const v = selectedPatient.vitals || {};
    const hasVitals = v && Object.values(v).some(x => x !== undefined && x !== null && x !== "");
    const payload = hasVitals
    ? { complaint: selectedPatient.complaint, history: selectedPatient.history, vitals: selectedPatient.vitals }
    : { complaint: selectedPatient.complaint, history: selectedPatient.history };

    try {
      const res = await fetch(`${API}/triage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
      const serverOut = await res.json();
      const newTriage = adaptServerTriageToUI(serverOut);
      const newProfile = (serverOut.profile || "therapy").toLowerCase();

      setPatients(prev =>
        prev.map(x =>
          x.id === selectedPatient.id
            ? { ...x, triage: newTriage, profile: newProfile }
            : x
        )
      );
      setSelectedPatient(s => s && { ...s, triage: newTriage, profile: newProfile });
    } catch (err) {
      console.warn("Retriage server failed, fallback to local:", err);
      const local = triageEngine(selectedPatient);
      const withHint = {
        ...local,
        hint_for_doctor: local.hint_for_doctor || defaultHint(local.priorityKey),
      };
      setPatients(prev =>
        prev.map(x =>
          x.id === selectedPatient.id
            ? { ...x, triage: withHint }
            : x
        )
      );
      setSelectedPatient(s => s && { ...s, triage: withHint });
    }
  }

  function handleMarkAsSeen() {
    if (!selectedPatient) return;
    
    setPatients((prev) => 
      prev.map((x) => 
        x.id === selectedPatient.id 
          ? { 
              ...x, 
              triage: { 
                ...x.triage, 
                priorityKey: PRIORITY.PLAN.key, 
                priorityColor: PRIORITY.PLAN.color, 
                priorityDot: PRIORITY.PLAN.dot, 
                reason: x.triage.reason + " (помечен как осмотрен)" 
              } 
            } 
          : x
      )
    );
    setSelectedPatient(null);
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <Header 
        profileFilter={profileFilter} 
        onProfileFilterChange={setProfileFilter} 
      />

      <main className="max-w-6xl mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <IntakeForm onAddPatient={handleAddPatient} />
        <PatientQueue 
          patients={filteredPatients} 
          profileFilter={profileFilter}
          onPatientSelect={setSelectedPatient} 
        />
      </main>

      <PatientDrawer 
        selected={selectedPatient}
        onClose={() => setSelectedPatient(null)}
        onRetriage={handleRetriage}
        onMarkAsSeen={handleMarkAsSeen}
      />

      <Footer />
    </div>
  );
}
