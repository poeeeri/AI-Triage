import React, { useState, useEffect } from 'react';
import { SectionCard } from '../common/SectionCard.jsx';
import { PriorityBadge } from '../common/PriorityBadge.jsx';
import { PROFILE } from '../../utils/constants.js';
import { shouldHighlightCritical, shouldHighlightUrgent, getWaitingTime, getTimeToNextHighlight } from '../../utils/timeUtils.js';

export function PatientQueue({ patients, profileFilter, onPatientSelect }) {
  const [currentTime, setCurrentTime] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const nextHighlight = patients.reduce((minTime, patient) => {
      if (patient.triage.priorityKey === "планово") return minTime;
      
      const timeToHighlight = getTimeToNextHighlight(patient.createdAt, patient.triage.priorityKey);
      if (timeToHighlight !== null && timeToHighlight > 0) {
        return Math.min(minTime, timeToHighlight);
      }
      return minTime;
    }, Infinity);

    if (nextHighlight < Infinity && nextHighlight > 0) {
      const timeout = setTimeout(() => {
        setCurrentTime(Date.now());
      }, nextHighlight + 1000); 

      return () => clearTimeout(timeout);
    }
  }, [patients, currentTime]);

  return (
    <SectionCard title="Очередь пациентов" className="lg:col-span-2">
      <div className="overflow-auto rounded-xl border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-slate-600">
            <tr>
              <th className="text-left px-2 py-2 w-20">Приоритет</th>
              <th className="text-left px-2 py-2 w-24">ID</th>
              <th className="text-left px-2 py-2">Жалобы</th>
              <th className="text-left px-2 py-2 w-32">Показатели</th>
              <th className="text-left px-2 py-2 w-20">Профиль</th>
              <th className="text-left px-2 py-2 w-16">Время</th>
              <th className="text-left px-2 py-2 w-24">Ожидание</th>
            </tr>
          </thead>
          <tbody>
            {patients.map((p) => {
              const isCriticalLongWait = shouldHighlightCritical(p.createdAt, p.triage.priorityKey);
              const isUrgentLongWait = shouldHighlightUrgent(p.createdAt, p.triage.priorityKey);
              const waitingTime = getWaitingTime(p.createdAt);
              const showAlert = isCriticalLongWait || isUrgentLongWait;
              
              return (
                <tr 
                  key={p.id} 
                  className={`
                    border-t border-slate-200 hover:bg-slate-50 cursor-pointer transition-all duration-300
                    ${isCriticalLongWait ? 'border-l-4 border-l-red-500 bg-red-50 shadow-sm' : ''}
                    ${isUrgentLongWait ? 'border-l-4 border-l-orange-500 bg-orange-50 shadow-sm' : ''}
                  `} 
                  onClick={() => onPatientSelect(p)}
                >
                  <td className="px-2 py-2">
                    <div className="flex items-center gap-1">
                      <PriorityBadge item={p.triage} />
                    </div>
                  </td>
                  <td className="px-2 py-2 font-medium text-slate-700 text-xs">{p.id}</td>
                  <td className="px-2 py-2 text-slate-700 truncate max-w-[18ch]" title={p.complaint}>
                    {p.complaint}
                  </td>
                  <td className="px-2 py-2 text-slate-600 text-xs">
                    {p.vitals?.bp && <div className="truncate">АД {p.vitals.bp}</div>}
                    {p.vitals?.spo2 != null && <div>SpO₂ {p.vitals.spo2}%</div>}
                    {p.vitals?.hr != null && <div>ЧСС {p.vitals.hr}</div>}
                    {p.vitals?.temp != null && <div>t° {p.vitals.temp}</div>}
                  </td>
                  <td className="px-2 py-2 text-slate-600 text-xs">
                    {PROFILE.find(x => x.id === p.profile)?.label || "—"}
                  </td>
                  <td className="px-2 py-2 text-slate-500 text-xs">
                    {new Date(p.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  </td>
                  <td className="px-2 py-2">
                    <span className={`
                      text-xs font-medium whitespace-nowrap
                      ${showAlert ? 'text-red-600 font-bold' : 'text-slate-500'}
                    `}>
                      {waitingTime} мин
                    </span>
                  </td>
                </tr>
              );
            })}
            {patients.length === 0 && (
              <tr>
                <td colSpan={7} className="px-2 py-10 text-center text-slate-400">
                  Нет записей для выбранного профиля
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="mt-3 text-xs text-slate-500 flex flex-wrap items-center gap-4">
        <div>Подсказка: клик по строке — подробности и ретриаж.</div>
      </div>
    </SectionCard>
  );
}