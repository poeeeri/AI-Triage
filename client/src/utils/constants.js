export const PRIORITY = {
  CRIT: { key: "критично срочно", color: "bg-red-100 text-red-700 border-red-200", dot: "bg-red-500" },
  URG: { key: "срочно", color: "bg-orange-100 text-orange-700 border-orange-200", dot: "bg-orange-500" },
  PLAN: { key: "планово", color: "bg-emerald-100 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
};

export const PROFILE = [
  { id: "all", label: "Все" },
  { id: "therapy", label: "Терапия" },
  { id: "trauma", label: "Травма/Хирургия" },
  { id: "neuro", label: "Неврология" },
  { id: "peds", label: "Педиатрия" },
];

export const cls = (...a) => a.filter(Boolean).join(" ");
export const nowISO = () => new Date().toISOString();

export const defaultHint = (priorityText) => {
  const p = String(priorityText || "").toLowerCase();
  if (p.includes("критично")) return "Немедленный осмотр, вызов профильного специалиста.";
  if (p.includes("срочно"))   return "Осмотр в ближайшее время.";
  return "Плановый осмотр. Контроль витальных и базовые обследования по показаниям.";
};
