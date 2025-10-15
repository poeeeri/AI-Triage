import React from 'react';
import { PROFILE, cls } from '../../utils/constants.js';

export function Header({ profileFilter, onProfileFilterChange }) {
  return (
    <header className="sticky top-0 z-30 bg-white/80 backdrop-blur border-b border-slate-200">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-xl bg-slate-900 text-white grid place-items-center font-bold">AI</div>
          <div>
            <div className="text-sm uppercase tracking-widest text-slate-500">Triage Control</div>
            <div className="font-semibold leading-tight">Приёмный покой — Панель триажа (MVP)</div>
          </div>
        </div>
        <div className="hidden md:flex items-center gap-2 text-xs">
          {PROFILE.map((p) => (
            <button
              key={p.id}
              onClick={() => onProfileFilterChange(p.id)}
              className={cls(
                "px-3 py-1.5 rounded-full border transition",
                profileFilter === p.id
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white hover:bg-slate-100 border-slate-300"
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}