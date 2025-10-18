import React, { useState } from 'react';
import { SectionCard } from './SectionCard.jsx';

export function PatientEditForm({ patient, onSave, onCancel }) {
  const [complaint, setComplaint] = useState(patient.complaint);
  const [history, setHistory] = useState(patient.history || "");
  const [bp, setBp] = useState(patient.vitals?.bp || "");
  const [hr, setHr] = useState(patient.vitals?.hr || "");
  const [spo2, setSpo2] = useState(patient.vitals?.spo2 || "");
  const [temp, setTemp] = useState(patient.vitals?.temp || "");
  const [rr, setRr] = useState(patient.vitals?.rr || "");
  const [gcs, setGcs] = useState(patient.vitals?.gcs || "");

  const handleSubmit = (e) => {
    e.preventDefault();
    
    const updatedPatient = {
      ...patient,
      complaint: complaint.trim(),
      history: history.trim(),
      vitals: {
        bp: bp || undefined,
        hr: hr ? Number(hr) : undefined,
        spo2: spo2 ? Number(spo2) : undefined,
        temp: temp ? Number(temp) : undefined,
        rr: rr ? Number(rr) : undefined,
        gcs: gcs ? Number(gcs) : undefined,
      }
    };

    onSave(updatedPatient);
  };

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} />
      <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-slate-800">Редактирование данных пациента</h2>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">Жалобы</label>
              <textarea
                value={complaint}
                onChange={(e) => setComplaint(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
                rows={3}
                placeholder="Опишите жалобы пациента..."
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">Анамнез</label>
              <textarea
                value={history}
                onChange={(e) => setHistory(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                rows={2}
                placeholder="Анамнез, сопутствующие заболевания..."
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">АД (сист/диаст)</label>
                <input
                  type="text"
                  value={bp}
                  onChange={(e) => setBp(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="120/80"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">ЧСС</label>
                <input
                  type="number"
                  value={hr}
                  onChange={(e) => setHr(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="75"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">SpO₂ (%)</label>
                <input
                  type="number"
                  value={spo2}
                  onChange={(e) => setSpo2(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="98"
                  min="0"
                  max="100"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">Температура (°C)</label>
                <input
                  type="number"
                  step="0.1"
                  value={temp}
                  onChange={(e) => setTemp(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="36.6"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">ЧДД</label>
                <input
                  type="number"
                  value={rr}
                  onChange={(e) => setRr(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="16"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">GCS</label>
                <input
                  type="number"
                  value={gcs}
                  onChange={(e) => setGcs(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="15"
                  min="3"
                  max="15"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Отмена
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
              >
                Сохранить и провести ретриаж
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}