import { nowISO } from '../utils/constants.js';
import { triageEngine } from '../utils/triageEngine.js';

export const seedPatients = [
  {
    id: "ID-4523",
    createdAt: nowISO(),
    profile: "therapy",
    complaint: "Сильная давящая боль за грудиной 20 минут, холодный пот",
    history: "Мужчина 58 лет, гипертония, курение 30 лет",
    vitals: { bp: "180/110", hr: 108, spo2: 92, temp: 36.7, rr: 20, gcs: 15 },
    age: 58,
    pregnancy: false,
  },
  {
    id: "ID-4528",
    createdAt: nowISO(),
    profile: "therapy",
    complaint: "Одышка, кашель, температура 38.6",
    history: "Женщина 42 года, ХОБЛ",
    vitals: { bp: "130/85", hr: 98, spo2: 94, temp: 38.6, rr: 22, gcs: 15 },
    age: 42,
    pregnancy: false,
  },
  {
    id: "ID-4535",
    createdAt: nowISO(),
    profile: "therapy",
    complaint: "Тупая боль в пояснице 2 недели",
    history: "Мужчина 35 лет, без травмы",
    vitals: { bp: "120/80", hr: 75, spo2: 98, temp: 36.6, rr: 16, gcs: 15 },
    age: 35,
    pregnancy: false,
  },
].map(p => ({ ...p, triage: triageEngine(p) }));