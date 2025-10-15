export function inferProfile({ complaint = "", age }) {
  const c = (complaint || "").toLowerCase();
  if (age !== undefined && age < 18) return "peds";
  if (/травм|перелом|рана|ушиб|кровотеч/i.test(c)) return "trauma";
  if (/онемени|асимметри|речь|судорог|инсульт/i.test(c)) return "neuro";
  if (/одышк|дыхани|грудин|сердц|боль в груди/i.test(c)) return "therapy";
  return "therapy";
}

export function parseBP(bpText) {
  if (!bpText) return { sys: undefined, dia: undefined };
  const m = String(bpText).match(/(\d{2,3})\s*\/?\s*(\d{2,3})?/);
  return { sys: m ? Number(m[1]) : undefined, dia: m && m[2] ? Number(m[2]) : undefined };
}