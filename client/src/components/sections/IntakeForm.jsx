import React, { useState } from 'react';
import { SectionCard } from '../common/SectionCard.jsx';
import { inferProfile } from '../../utils/medicalUtils.js';
import { triageEngine } from '../../utils/triageEngine.js';
import { nowISO } from '../../utils/constants.js';

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

  function handleSubmit(e) {
    e.preventDefault();
    const vitals = {
      bp: bp || undefined,
      hr: hr ? Number(hr) : undefined,
      spo2: spo2 ? Number(spo2) : undefined,
      temp: temp ? Number(temp) : undefined,
      rr: rr ? Number(rr) : undefined,
      gcs: gcs ? Number(gcs) : undefined,
    };
    const ageNum = age ? Number(age) : undefined;
    const profile = inferProfile({ complaint, age: ageNum });
    const base = {
      id: `ID-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      createdAt: nowISO(),
      profile,
      complaint: complaint.trim(),
      history: history.trim(),
      vitals,
      age: ageNum,
      pregnancy,
    };
    const triage = triageEngine(base);
    
    onAddPatient({ ...base, triage });
    
    // Reset form
    setComplaint(""); 
    setHistory(""); 
    setBp(""); 
    setHr(""); 
    setSpo2(""); 
    setTemp(""); 
    setRr(""); 
    setGcs(""); 
    setAge(""); 
    setPregnancy(false);
  }

  return (
    <SectionCard title="Новый пациент (ввод данных)" className="lg:col-span-1">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="text-xs text-slate-500">Жалобы</label>
          <textarea 
            value={complaint} 
            onChange={(e) => setComplaint(e.target.value)} 
            required 
            rows={3}
            placeholder="Напр.: боль за грудиной 20 мин, холодный пот"
            className="mt-1 w-full rounded-xl border-slate-300 focus:ring-0 focus:outline-none focus:border-slate-500 text-sm p-3" 
          />
        </div>
        
        <div>
          <label className="text-xs text-slate-500">Анамнез (ключевое)</label>
          <textarea 
            value={history} 
            onChange={(e) => setHistory(e.target.value)} 
            rows={2}
            placeholder="Напр.: мужчина 58 лет, гипертония, курение 30 лет"
            className="mt-1 w-full rounded-xl border-slate-300 focus:border-slate-500 text-sm p-3" 
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-slate-500">АД (сист/диаст)</label>
            <input 
              value={bp} 
              onChange={(e) => setBp(e.target.value)} 
              placeholder="120/80" 
              className="mt-1 w-full rounded-xl border-slate-300 focus:border-slate-500 text-sm p-2.5" 
            />
          </div>
          <div>
            <label className="text-xs text-slate-500">ЧСС</label>
            <input 
              value={hr} 
              onChange={(e) => setHr(e.target.value)} 
              placeholder="75" 
              className="mt-1 w-full rounded-xl border-slate-300 focus:border-slate-500 text-sm p-2.5" 
            />
          </div>
          <div>
            <label className="text-xs text-slate-500">SpO₂ (%)</label>
            <input 
              value={spo2} 
              onChange={(e) => setSpo2(e.target.value)} 
              placeholder="98" 
              className="mt-1 w-full rounded-xl border-slate-300 focus:border-slate-500 text-sm p-2.5" 
            />
          </div>
          <div>
            <label className="text-xs text-slate-500">Температура (°C)</label>
            <input 
              value={temp} 
              onChange={(e) => setTemp(e.target.value)} 
              placeholder="36.6" 
              className="mt-1 w-full rounded-xl border-slate-300 focus:border-slate-500 text-sm p-2.5" 
            />
          </div>
          <div>
            <label className="text-xs text-slate-500">ЧДД</label>
            <input 
              value={rr} 
              onChange={(e) => setRr(e.target.value)} 
              placeholder="16" 
              className="mt-1 w-full rounded-xl border-slate-300 focus:border-slate-500 text-sm p-2.5" 
            />
          </div>
          <div>
            <label className="text-xs text-slate-500">GCS</label>
            <input 
              value={gcs} 
              onChange={(e) => setGcs(e.target.value)} 
              placeholder="15" 
              className="mt-1 w-full rounded-xl border-slate-300 focus:border-slate-500 text-sm p-2.5" 
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-slate-500">Возраст</label>
            <input 
              value={age} 
              onChange={(e) => setAge(e.target.value)} 
              placeholder="58" 
              className="mt-1 w-full rounded-xl border-slate-300 focus:border-slate-500 text-sm p-2.5" 
            />
          </div>
          <div className="flex items-end gap-2">
            <input 
              id="preg" 
              type="checkbox" 
              checked={pregnancy} 
              onChange={(e) => setPregnancy(e.target.checked)} 
            />
            <label htmlFor="preg" className="text-sm text-slate-700">Беременность</label>
          </div>
        </div>

        <div className="pt-1 flex items-center gap-2">
          <button 
            type="submit" 
            className="px-4 py-2 rounded-xl bg-slate-900 text-white text-sm hover:bg-slate-800 active:scale-[.99]"
          >
            Добавить в очередь
          </button>
          <span className="text-xs text-slate-500">AI-оценка приоритета выполняется автоматически</span>
        </div>
      </form>
    </SectionCard>
  );
}