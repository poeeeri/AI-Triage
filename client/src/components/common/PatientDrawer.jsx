import React, { useState } from 'react';
import { SectionCard } from './SectionCard.jsx';
import { PriorityBadge } from './PriorityBadge.jsx';
import { PatientEditForm } from './PatientEditForm.jsx';
import { ProfileSelectModal } from './ProfileSelectModal.jsx';
import { PROFILE } from '../../utils/constants.js';

export function PatientDrawer({ selected, onClose, onRetriage, onMarkAsSeen, onChangeProfile }) {
  const [isEditing, setIsEditing] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);

  if (!selected) return null;

  const handleRetriageWithEdit = () => {
    setIsEditing(true);
  };

  const handleSaveAndRetriage = (updatedPatient) => {
    setIsEditing(false);
    onRetriage(updatedPatient);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
  };

  const handleMarkAsSeenClick = () => {
    setShowConfirm(true);
  };

  const handleConfirmMarkAsSeen = () => {
    onMarkAsSeen(selected.id);
    setShowConfirm(false);
    onClose();
  };

  const handleCancelMarkAsSeen = () => {
    setShowConfirm(false);
  };

  const handleChangeProfileClick = () => {
    setShowProfileModal(true);
  };

  const handleSaveProfile = (newProfile) => {
    onChangeProfile(selected.id, newProfile);
    setShowProfileModal(false);
  };

  const handleCancelProfile = () => {
    setShowProfileModal(false);
  };

  return (
    <>
      <div className="fixed inset-0 z-40">
        <div className="absolute inset-0 bg-black/30" onClick={onClose} />
        <div className="absolute right-0 top-0 h-full w-full sm:w-[520px] bg-white shadow-2xl p-5 overflow-y-auto">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <PriorityBadge item={selected.triage} />
              <div className="font-semibold">Карточка пациента — {selected.id}</div>
            </div>
            <button onClick={onClose} className="text-slate-500 hover:text-slate-800">✕</button>
          </div>

          <div className="mt-4 grid gap-3">
            <SectionCard title="Профиль">
              <div className="flex items-center justify-between">
                <div className="text-sm">
                  <span className="px-2 py-1 rounded-lg bg-blue-100 text-blue-800">
                    {PROFILE.find(x => x.id === selected.profile)?.label || "Терапия"}
                  </span>
                </div>
                <button
                  onClick={handleChangeProfileClick}
                  className="text-xs text-blue-600 hover:text-blue-800 underline"
                >
                  Сменить профиль
                </button>
              </div>
            </SectionCard>

            <SectionCard title="Жалобы">
              <div className="text-sm whitespace-pre-wrap">{selected.complaint}</div>
            </SectionCard>
            
            <SectionCard title="Анамнез">
              <div className="text-sm whitespace-pre-wrap">{selected.history || "—"}</div>
            </SectionCard>
            
            <SectionCard title="Показатели">
              <div className="text-sm flex flex-wrap gap-3">
                {selected.vitals?.bp && <span className="px-2 py-1 rounded-lg bg-slate-100">АД {selected.vitals.bp}</span>}
                {selected.vitals?.hr != null && <span className="px-2 py-1 rounded-lg bg-slate-100">ЧСС {selected.vitals.hr}</span>}
                {selected.vitals?.spo2 != null && <span className="px-2 py-1 rounded-lg bg-slate-100">SpO₂ {selected.vitals.spo2}%</span>}
                {selected.vitals?.temp != null && <span className="px-2 py-1 rounded-lg bg-slate-100">t° {selected.vitals.temp}</span>}
                {selected.vitals?.rr != null && <span className="px-2 py-1 rounded-lg bg-slate-100">ЧДД {selected.vitals.rr}</span>}
                {selected.vitals?.gcs != null && <span className="px-2 py-1 rounded-lg bg-slate-100">GCS {selected.vitals.gcs}</span>}
              </div>
            </SectionCard>

            <SectionCard title="Решение AI">
              <div className="text-sm text-slate-700">{selected.triage.reason}</div>
              <div className="mt-2 text-xs text-slate-500">Уверенность: {(selected.triage.confidence * 100).toFixed(0)}%</div>
              {selected.triage.redFlags?.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {selected.triage.redFlags.map((rf, i) => (
                    <span key={i} className="text-xs px-2 py-1 rounded-full bg-red-50 text-red-700 border border-red-200">{rf}</span>
                  ))}
                </div>
              )}
            </SectionCard>

            <SectionCard title="Подсказка для врача">
              <div className="text-sm text-emerald-700 whitespace-pre-wrap leading-relaxed">
                {selected.triage?.hint_for_doctor
                  || (selected.triage?.priorityKey?.includes("критично") && "Немедленный осмотр. Снять ЭКГ, обеспечить SpO₂ ≥94%, ASA/нитраты, тропонины, вызвать профильного специалиста.")
                  || (selected.triage?.priorityKey?.includes("срочно") && "Осмотр в ближайшее время. Повторная оценка витальных, базовая диагностика, эскалация при ухудшении.")
                  || "Плановый осмотр. Контроль витальных и базовые обследования по показаниям."}
              </div>
            </SectionCard>

            <div className="flex items-center gap-2">
              <button
                onClick={handleRetriageWithEdit}
                className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm hover:bg-blue-700 transition-colors"
              >
                Провести ретриаж
              </button>
              <button
                onClick={handleMarkAsSeenClick}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-sm hover:bg-slate-50 transition-colors"
              >
                Отметить как осмотрен
              </button>
            </div>

            <div className="text-xs text-slate-500">
              💡 <strong>Ретриаж</strong> позволяет обновить данные пациента и переоценить приоритет на основе новой информации.
            </div>
          </div>
        </div>
      </div>

      {isEditing && (
        <PatientEditForm
          patient={selected}
          onSave={handleSaveAndRetriage}
          onCancel={handleCancelEdit}
        />
      )}

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={handleCancelMarkAsSeen} />
          <div className="relative bg-white rounded-xl shadow-lg p-6 max-w-sm mx-4">
            <h3 className="text-lg font-semibold text-slate-800 mb-2">
              Подтверждение
            </h3>
            <p className="text-slate-600 mb-4">
              Вы уверены, что хотите отметить пациента <strong>{selected.id}</strong> как осмотренного?
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={handleCancelMarkAsSeen}
                className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={handleConfirmMarkAsSeen}
                className="px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors"
              >
                Да, осмотрен
              </button>
            </div>
          </div>
        </div>
      )}

      {showProfileModal && (
        <ProfileSelectModal
          patient={selected}
          onSave={handleSaveProfile}
          onCancel={handleCancelProfile}
        />
      )}
    </>
  );
}
