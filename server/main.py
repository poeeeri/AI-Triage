import os
import re
import json
from dotenv import load_dotenv
from typing import Optional, Literal, List, Dict, Any, Union
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import httpx

load_dotenv()

YC_FOLDER_ID = os.getenv("YANDEX_CLOUD_FOLDER")
YC_API_KEY = os.getenv("YANDEX_CLOUD_API_KEY")
YC_MODEL_URI = os.getenv("YC_AGENT_ID")
TEMPERATURE = float(os.getenv("TEMPERATURE", "0.2"))
MAX_TOKENS = int(os.getenv("MAX_TOKENS", "800"))
YANDEX_URL = "https://llm.api.cloud.yandex.net/foundationModels/v1/completion"

app = FastAPI(title="AI-Triage MVP (FastAPI + YandexGPT)")

# CORS: максимально широкий, чтобы префлайты не падали на ингресте/прокси
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],     # публичный API без куки — ок
    allow_methods=["*"],     # GET/POST/OPTIONS и т.д.
    allow_headers=["*"],     # content-type и любые другие
    allow_credentials=False, # с "*" креды всё равно нельзя
    max_age=600,
)

from fastapi.responses import PlainTextResponse

@app.options("/{path:path}")
async def any_options(path: str, request: Request):
    origin   = request.headers.get("Origin", "*")
    req_hdrs = request.headers.get("Access-Control-Request-Headers", "content-type")
    resp = PlainTextResponse("", status_code=204)
    # CORS
    resp.headers["Access-Control-Allow-Origin"]  = origin
    resp.headers["Access-Control-Allow-Methods"] = "GET,POST,OPTIONS"
    resp.headers["Access-Control-Allow-Headers"] = req_hdrs
    resp.headers["Access-Control-Max-Age"]       = "600"
    # 🔒 security/заголовки для валидного префлайта
    resp.headers["X-Content-Type-Options"] = "nosniff"
    resp.headers["Cache-Control"]          = "no-store"
    resp.headers["Server"]                 = "fastapi"
    return resp


@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    resp = await call_next(request)
    # CORS (на случай если ингрест срежет стандартные)
    resp.headers.setdefault("Access-Control-Allow-Origin", request.headers.get("Origin", "*"))
    # 🔒 security
    resp.headers.setdefault("X-Content-Type-Options", "nosniff")
    resp.headers.setdefault("Cache-Control", "no-store")
    resp.headers["Server"] = "fastapi"  # минимальное имя без версии и uvicorn
    return resp

AllowedProfile = Literal["therapy", "cardio", "pulmonology", "neurology", "obstetric", "pediatry"]

def _parse_bp(bp: Optional[str]) -> tuple[Optional[int], Optional[int]]:
    if not bp:
        return None, None
    m = re.search(r"(\d{2,3})\s*[/\\-]\s*(\d{2,3})", str(bp))
    if not m:
        return None, None
    try:
        return int(m.group(1)), int(m.group(2))
    except Exception:
        return None, None

def _to_int(x) -> Optional[int]:
    if x is None or x == "":
        return None
    try:
        return int(float(str(x).replace(",", ".")))
    except Exception:
        return None

def _to_float(x) -> Optional[float]:
    if x is None or x == "":
        return None
    try:
        return float(str(x).replace(",", "."))
    except Exception:
        return None

def vitals_to_text(n: dict) -> str:
    parts = []
    if n.get("bp_syst") and n.get("bp_diast"):
        parts.append(f"АД: {n['bp_syst']}/{n['bp_diast']}")
    if n.get("hr") is not None:
        parts.append(f"ЧСС: {n['hr']}")
    if n.get("spo2") is not None:
        parts.append(f"SpO₂: {n['spo2']}%")
    if n.get("temp") is not None:
        parts.append(f"t°: {n['temp']}")
    if n.get("rr") is not None:
        parts.append(f"ЧДД: {n['rr']}")
    if n.get("gcs") is not None:
        parts.append(f"GCS: {n['gcs']}")
    return "; ".join(parts) if parts else "не указаны"

class Vitals(BaseModel):
    bp: Optional[str] = Field(None, description="АД, например '180/110' или '120/80'")
    hr: Optional[Union[int, float, str]] = None
    spo2: Optional[Union[int, float, str]] = None
    temp: Optional[Union[int, float, str]] = None
    rr: Optional[Union[int, float, str]] = None
    gcs: Optional[Union[int, float, str]] = None

class TriageInput(BaseModel):
    complaint: str
    history: Optional[str] = ""
    vitals: Optional[Vitals] = None

class SourceRef(BaseModel):
    id: str
    section: Optional[str] = None
    version_date: Optional[str] = None

class TriageOutput(BaseModel):
    priority: Literal["критично срочно", "срочно", "планово"]
    reason: str
    hint_for_doctor: Optional[str] = None
    profile: AllowedProfile = "therapy"
    confidence: float = Field(..., ge=0, le=1)
    red_flags: List[str]
    sources: Optional[List[SourceRef]] = None

class PromptProxy(BaseModel):
    system: Optional[str] = None
    user: str
    temperature: Optional[float] = None
    max_tokens: Optional[int] = None
    model_uri: Optional[str] = None
    messages: Optional[List[Dict[str, str]]] = None

def _yc_headers() -> Dict[str, str]:
    if YC_API_KEY:
        return {
            "Authorization": f"Api-Key {YC_API_KEY}",
            "x-folder-id": YC_FOLDER_ID,
            "Content-Type": "application/json",
            "Accept": "application/json",
        }
    raise RuntimeError("нет апи ключа")

def _yc_payload(messages: List[Dict[str, str]],
                temperature: float = TEMPERATURE,
                max_tokens: int = MAX_TOKENS,
                model_uri: str = YC_MODEL_URI) -> Dict[str, Any]:
    return {
        "modelUri": model_uri,
        "completionOptions": {
            "stream": False,
            "temperature": temperature,
            "maxTokens": max_tokens,
            "reasoningOptions": {"mode": "DISABLED"},
        },
        "messages": messages,
    }

def normalize_vitals(v: Optional[Vitals]) -> dict:
    if not v:
        return {"bp_syst": None, "bp_diast": None, "hr": None, "spo2": None, "temp": None, "rr": None, "gcs": None}
    s, d = _parse_bp(v.bp)
    return {
        "bp_syst": s,
        "bp_diast": d,
        "hr": _to_int(v.hr),
        "spo2": _to_int(v.spo2),
        "temp": _to_float(v.temp),
        "rr": _to_int(v.rr),
        "gcs": _to_int(v.gcs),
    }

def _norm_strip_lower(x: Any) -> str:
    if x is None:
        return ""
    s = str(x).strip().lower()
    # частая путаница латиницы/кириллицы: 'o' vs 'о'
    s = s.replace("o", "о")  # латинская 'o' -> кириллическая
    return s

_ALLOWED_PRIOR = ("критично срочно", "срочно", "планово")

def normalize_priority(val: Any) -> str:
    s = _norm_strip_lower(val)
    if s in _ALLOWED_PRIOR:
        return s
    # синонимы/опечатки
    if s in {"критично", "немедленно", "экстренно", "неотложно", "critical", "stat", "emergent"}:
        return "критично срочно"
    if s in {"срочно", "urgent", "soon", "как можно скорее"}:
        return "срочно"
    if s in {"план", "плановый", "планово", "плановo", "plan", "planned", "non-urgent", "plano", "planov", "planovo"}:
        return "планово"
    # эвристика по первым буквам
    if s.startswith("крит"): return "критично срочно"
    if s.startswith("сроч"): return "срочно"
    if s.startswith("план"): return "планово"
    # безопасный дефолт — середина шкалы
    return "срочно"

_ALLOWED_PROFILES = {"therapy", "cardio", "pulmonology", "neurology", "obstetric", "pediatry"}

def normalize_profile(val: Any) -> str:
    s = _norm_strip_lower(val)
    # допускаем англ./рус. названия и опечатки
    aliases = {
        "терапия": "therapy", "therap": "therapy", "general": "therapy",
        "кардио": "cardio", "cardiology": "cardio",
        "пульмо": "pulmonology", "respiratory": "pulmonology", "pulmo": "pulmonology",
        "невро": "neurology", "neuro": "neurology",
        "акушерство": "obstetric", "obstetrics": "obstetric", "pregnancy": "obstetric",
        "педиатр": "pediatry", "pediatric": "pediatry", "pediatrics": "pediatry",
    }
    if s in _ALLOWED_PROFILES:
        return s
    if s in aliases:
        return aliases[s]
    # эвристики по префиксам
    for k, v in aliases.items():
        if s.startswith(k):
            return v
    return "therapy"

def coerce_model_output(obj: Dict[str, Any]) -> Dict[str, Any]:
    out = dict(obj or {})
    # priority
    out["priority"] = normalize_priority(out.get("priority"))
    # profile
    out["profile"] = normalize_profile(out.get("profile"))
    # confidence -> [0,1], дефолт пониженный при сомнениях
    try:
        c = float(out.get("confidence", 0.7))
    except Exception:
        c = 0.7
    out["confidence"] = max(0.0, min(1.0, c))
    # red_flags -> список строк
    rf = out.get("red_flags", [])
    if isinstance(rf, (str, int, float)):
        rf = [str(rf)]
    elif isinstance(rf, list):
        rf = [str(x) for x in rf]
    else:
        rf = []
    out["red_flags"] = rf
    # hint_for_doctor / reason — строки
    for k in ("hint_for_doctor", "reason"):
        v = out.get(k)
        out[k] = "" if v is None else str(v)
    # sources — список объектов (мягкая нормализация)
    src = out.get("sources")
    if src is None:
        out["sources"] = []
    elif isinstance(src, list):
        norm_src = []
        for s in src:
            try:
                s_id = str(s.get("id"))
                if not s_id:
                    continue
                norm_src.append({
                    "id": s_id,
                    "section": None if s.get("section") in (None, "") else str(s.get("section")),
                    "version_date": None if s.get("version_date") in (None, "") else str(s.get("version_date")),
                })
            except Exception:
                continue
        out["sources"] = norm_src
    else:
        out["sources"] = []
    return out


@app.get("/health")
def health():
    return {"status": "ok", "modelUri": YC_MODEL_URI}

@app.post("/triage", response_model=TriageOutput)
async def triage(request: Request):
    try:
        try:
            js = await request.json()
        except Exception:
            raw = (await request.body()) or b"{}"
            js = json.loads(raw.decode("utf-8", "ignore") or "{}")
        payload = TriageInput(**js)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Bad payload: {e}")
    
    norm_v = normalize_vitals(payload.vitals)
    system_msg = """
СИСТЕМА:
Ты — медицинский ассистент по триажу в приёмном отделении. 
Твоя задача — по жалобам, анамнезу и витальным показателям классифицировать приоритет осмотра пациента.

Приоритеты:
- "критично срочно" — немедленный осмотр, угроза жизни;
- "срочно" — осмотр в ближайшее время, есть риски ухудшения;
- "планово" — может подождать, нет признаков неотложности.

Правила:
- Учитывай жалобы, анамнез, витальные показатели.
- Если какие-то витальные не указаны, НЕ повышай приоритет только из-за их отсутствия.
  Отсутствие данных — это не красный флаг. Понижай "confidence" и добавляй в "hint_for_doctor" просьбу дозаснять показатели.
- Не ставь диагнозов.
- Ответ только валидный JSON по схеме.
"""

    user_msg = (
        "INPUT:\n"
        f"complaint: {payload.complaint}\n"
        f"history: {payload.history}\n"
        f"vitals: {vitals_to_text(norm_v)}\n\n"
        "ОТВЕТИ В JSON (без лишнего текста), структура:\n"
        "{\n"
        '  "priority": "критично срочно|срочно|планово",\n'
        '  "reason": "…",\n'
        '  "hint_for_doctor": "…",\n'
        '  "profile": "therapy|cardio|pulmonology|neurology|obstetric|pediatry",\n'
        '  "confidence": 0.0,\n'
        '  "red_flags": ["…"],\n'
        '  "sources": [{"id":"doc_cardio_01","section":"1","version_date":"2025-05-12"}]\n'
        "}\n"
        "Если не уверена — понижай confidence, но JSON-схему не нарушай."
    )

    messages = [
        {"role": "system", "text": system_msg},
        {"role": "user", "text": user_msg},
    ]

    data = _yc_payload(messages)
    try:
        async with httpx.AsyncClient(timeout=60) as client:
            r = await client.post(YANDEX_URL, headers=_yc_headers(), json=data)
        if r.status_code != 200:
            raise HTTPException(status_code=502, detail={"yandex_error": r.text})
        res = r.json()
        text = res["result"]["alternatives"][0]["message"]["text"]

        try:
            parsed = json.loads(text)
        except json.JSONDecodeError:
            m = re.search(r"\{.*\}", text, flags=re.S)
            if not m:
                raise HTTPException(status_code=500, detail={"parse_error": text})
            parsed = json.loads(m.group(0))

        parsed = coerce_model_output(parsed)

        return TriageOutput(**parsed)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/yandex/prompt")
async def yandex_prompt(p: PromptProxy):
    messages = p.messages or []
    if not messages:
        if p.system:
            messages.append({"role": "system", "text": p.system})
        messages.append({"role": "user", "text": p.user})

    data = _yc_payload(
        messages=messages,
        temperature=p.temperature if p.temperature is not None else TEMPERATURE,
        max_tokens=p.max_tokens if p.max_tokens is not None else MAX_TOKENS,
        model_uri=p.model_uri if p.model_uri else YC_MODEL_URI,
    )

    try:
        async with httpx.AsyncClient(timeout=60) as client:
            r = await client.post(YANDEX_URL, headers=_yc_headers(), json=data)
        if r.status_code != 200:
            return {"status": "yandex_error", "http_status": r.status_code, "body": r.text}
        res = r.json()
        text = res["result"]["alternatives"][0]["message"]["text"]
        return {"text": text, "usage": res["result"].get("usage"), "modelVersion": res["result"].get("modelVersion")}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
