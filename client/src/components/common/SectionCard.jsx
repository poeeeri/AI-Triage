import React from 'react';
import { cls } from '../../utils/constants.js';

export function SectionCard({ title, children, className }) {
  return (
    <div className={cls("bg-white/70 backdrop-blur border border-slate-200 rounded-2xl p-4 shadow-sm", className)}>
      <div className="text-slate-700 font-semibold mb-2">{title}</div>
      {children}
    </div>
  );
}