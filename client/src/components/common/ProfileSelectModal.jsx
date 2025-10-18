import React, { useState } from 'react';
import { PROFILE } from '../../utils/constants.js';

export function ProfileSelectModal({ patient, onSave, onCancel }) {
  const [selectedProfile, setSelectedProfile] = useState(patient.profile || "therapy");

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(selectedProfile);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} />
      <div className="relative bg-white rounded-xl shadow-lg p-6 max-w-md w-full mx-4">
        <h3 className="text-lg font-semibold text-slate-800 mb-2">
          Смена профиля врача
        </h3>
        <p className="text-slate-600 mb-4">
          Выберите профиль врача для пациента <strong>{patient.id}</strong>
        </p>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="text-sm font-medium text-slate-700 mb-2 block">
              Профиль врача
            </label>
            <select
              value={selectedProfile}
              onChange={(e) => setSelectedProfile(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {PROFILE.map((prof) => (
                <option key={prof.id} value={prof.id}>
                  {prof.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-end gap-3">
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
              Сменить профиль
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}