import { PRIORITY } from './constants.js';
import { parseBP } from './medicalUtils.js';

export function triageEngine({ complaint = "", history = "", vitals = {} }) {
  const redFlags = [];
  const c = (complaint || "").toLowerCase();
  const h = (history || "").toLowerCase();
  const { sys, dia } = parseBP(vitals.bp);
  const spo2 = vitals.spo2 != null ? Number(vitals.spo2) : undefined;
  const hr = vitals.hr != null ? Number(vitals.hr) : undefined;
  const temp = vitals.temp != null ? Number(vitals.temp) : undefined;
  const rr = vitals.rr != null ? Number(vitals.rr) : undefined;
  const gcs = vitals.gcs != null ? Number(vitals.gcs) : undefined;

  // Text red-flags
  if (/кровотеч|обильн/i.test(c)) redFlags.push("массивное кровотечение");
  if (/судорог|потеря созн/i.test(c)) redFlags.push("судороги/потеря сознания");
  if (/боль.*грудин|боль в груди|давящая боль/i.test(c)) redFlags.push("боль за грудиной");
  if (/одышк|задых|тяжело дышать/i.test(c)) redFlags.push("одышка");
  if (/онемени|асимметри|речь наруш/i.test(c)) redFlags.push("неврологический дефицит");

  // Numeric red-flags
  if (sys && (sys >= 220 || (dia && dia >= 120))) redFlags.push("АД ≥ 220/120");
  if (spo2 !== undefined && spo2 < 92) redFlags.push("SpO₂ < 92% ");
  if (rr && rr > 30) redFlags.push("ЧДД > 30");
  if (gcs && gcs < 13) redFlags.push("GCS < 13");

  // Urgent signals
  const urgentSignals = [];
  if (spo2 !== undefined && spo2 >= 92 && spo2 < 94) urgentSignals.push("SpO₂ 92–94% ");
  if (temp && temp >= 38.5) urgentSignals.push("t° ≥ 38.5");
  if (hr && hr >= 110) urgentSignals.push("ЧСС ≥ 110");
  if (/хобл|диабет|иммуносуп/i.test(h) && temp && temp >= 38.0) urgentSignals.push("коморбидность + лихорадка");
  // Decide priority
  let priority = PRIORITY.PLAN;
  let conf = 0.72;

  const hasChestPain = /боль.*грудин|боль в груди|давящая боль/i.test(c);
  if (
    redFlags.includes("массивное кровотечение") ||
    redFlags.includes("судороги/потеря сознания") ||
    redFlags.includes("неврологический дефицит") ||
    redFlags.includes("SpO₂ < 92% ") ||
    redFlags.includes("АД ≥ 220/120") ||
    (hasChestPain && (spo2 !== undefined && spo2 < 94))
  ) {
    priority = PRIORITY.CRIT; conf = 0.93;
  } else if (urgentSignals.length > 0 || redFlags.includes("одышка")) {
    priority = PRIORITY.URG; conf = 0.82;
  }

  // Build reason
  const reasonParts = [];
  if (priority === PRIORITY.CRIT) reasonParts.push("Обнаружены критические признаки риска осложнений.");
  else if (priority === PRIORITY.URG) reasonParts.push("Есть признаки потенциальной угрозы — требуется осмотр в ближайшее время.");
  else reasonParts.push("Острых признаков нет — состояние стабильное.");
  if (redFlags.length) reasonParts.push(`Красные флаги: ${redFlags.join(", ")}.`);
  if (urgentSignals.length) reasonParts.push(`Факторы срочности: ${urgentSignals.join(", ")}.`);

  return {
    priorityKey: priority.key,
    priorityColor: priority.color,
    priorityDot: priority.dot,
    redFlags,
    urgentSignals,
    confidence: conf,
    reason: reasonParts.join(" "),
  };
}