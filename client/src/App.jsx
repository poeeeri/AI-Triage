import React, { useMemo, useState } from 'react';
import { Header } from './components/layout/Header.jsx';
import { Footer } from './components/layout/Footer.jsx';
import { IntakeForm } from './components/sections/IntakeForm.jsx';
import { PatientQueue } from './components/sections/PatientQueue.jsx';
import { PatientDrawer } from './components/common/PatientDrawer.jsx';
import { seedPatients } from './data/seedData.js';
import { triageEngine } from './utils/triageEngine.js';
import { PRIORITY } from './utils/constants.js';

export default function App() {
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

  function handleRetriage() {
    if (!selectedPatient) return;
    
    setPatients((prev) => 
      prev.map((x) => 
        x.id === selectedPatient.id 
          ? { ...x, triage: triageEngine(x) } 
          : x
      )
    );
    setSelectedPatient((s) => s && { ...s, triage: triageEngine(s) });
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