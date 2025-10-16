import React from 'react';
import { SectionCard } from '../common/SectionCard.jsx';
import { PriorityBadge } from '../common/PriorityBadge.jsx';
import { PROFILE } from '../../utils/constants.js';

export function PatientQueue({ patients, profileFilter, onPatientSelect }) {
  return (
    <SectionCard title="Очередь пациентов" className="lg:col-span-2">
      <div className="overflow-auto rounded-xl border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-slate-600">
            <tr>
              <th className="text-left px-3 py-2">Приоритет</th>
              <th className="text-left px-3 py-2">Пациент (ID)</th>
              <th className="text-left px-3 py-2">Жалобы</th>
              <th className="text-left px-3 py-2">Показатели</th>
              <th className="text-left px-3 py-2">Профиль</th>
              <th className="text-left px-3 py-2">Поступил</th>
            </tr>
          </thead>
          <tbody>
            {patients.map((p) => (
              <tr 
                key={p.id} 
                className="border-t border-slate-200 hover:bg-slate-50 cursor-pointer" 
                onClick={() => onPatientSelect(p)}
              >
                <td className="px-3 py-2"><PriorityBadge item={p.triage} /></td>
                <td className="px-3 py-2 font-medium text-slate-700">{p.id}</td>
                <td className="px-3 py-2 text-slate-700 truncate max-w-[22ch]" title={p.complaint}>
                  {p.complaint}
                </td>
                <td className="px-3 py-2 text-slate-600">
                  {p.vitals?.bp && <span className="mr-2">АД {p.vitals.bp}</span>}
                  {p.vitals?.spo2 != null && <span className="mr-2">SpO₂ {p.vitals.spo2}%</span>}
                  {p.vitals?.hr != null && <span className="mr-2">ЧСС {p.vitals.hr}</span>}
                  {p.vitals?.temp != null && <span>t° {p.vitals.temp}</span>}
                </td>
                <td className="px-3 py-2 text-slate-600">
                  {PROFILE.find(x => x.id === p.profile)?.label || "—"}
                </td>
                <td className="px-3 py-2 text-slate-500">
                  {new Date(p.createdAt).toLocaleTimeString()}
                </td>
              </tr>
            ))}
            {patients.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-10 text-center text-slate-400">
                  Нет записей для выбранного профиля
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="mt-3 text-xs text-slate-500">
        Подсказка: клик по строке — подробности и ретриаж.
      </div>
    </SectionCard>
  );
}