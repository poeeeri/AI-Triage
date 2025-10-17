import os, re
from dotenv import load_dotenv
from typing import Optional, Literal, List, Dict, Any
from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import httpx
from typing import Optional, Literal, List, Dict, Any, Union
from pydantic import BaseModel, Field, ValidationError
from fastapi import Request
from fastapi.responses import Response as FastAPIResponse

load_dotenv()

YC_FOLDER_ID = os.getenv("YANDEX_CLOUD_FOLDER")
YC_API_KEY = os.getenv("YANDEX_CLOUD_API_KEY")
YC_MODEL_URI = os.getenv("YC_AGENT_ID")
TEMPERATURE = float(os.getenv("TEMPERATURE", "0.2"))
MAX_TOKENS = int(os.getenv("MAX_TOKENS", "800"))
YANDEX_URL = "https://llm.api.cloud.yandex.net/foundationModels/v1/completion"

# создаем экземпляр фастапи приложения
app = FastAPI(title="AI-Triage MVP (FastAPI + YandexGPT)")

AllowedProfile = Literal[
    "therapy", "cardio", "pulmonology", "neurology", "obstetric", "pediatry"
]



def _parse_bp(bp: Optional[str]) -> tuple[Optional[int], Optional[int]]:
    if not bp:
        return None, None
    import re
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
    """Красиво отдаём витальные в текст (модель всегда видит одинаковый формат)."""
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

# ALLOWED_ORIGINS = [
#     "https://poeeeri.github.io",
#     "https://poeeeri.github.io/AI-Triage",
#     "http://localhost:5173",
# ]

# app.add_middleware(
#     CORSMiddleware,
#     allow_origins=ALLOWED_ORIGINS,
#     allow_methods=["GET","POST","OPTIONS"],
#     allow_headers=["Content-Type","Authorization"]
# )

+app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=False,
    max_age=600,
)

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
    priority: Literal["критично срочно","срочно","планово"]
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

# тело запроса к апи
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
    """Возвращает унифицированный словарь для промпта и логики."""
    if not v:
        return {
            "bp_syst": None, "bp_diast": None,
            "hr": None, "spo2": None, "temp": None, "rr": None, "gcs": None
        }
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

@app.get("/health")
def health():
    return {"status": "ok", "modelUri": YC_MODEL_URI}


@app.post("/triage", response_model=TriageOutput)
async def triage(payload: TriageInput):
    system_msg = (
        """
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
            Отсутствие данных — это не красный флаг. В этом случае понижай "confidence" и
            добавляй в "hint_for_doctor" просьбу дозаснять соответствующие показатели.
        - Не ставь диагнозов и не используй предположительные диагнозы.
        - Ответ должен быть СТРОГО валидным JSON в соответствии со схемой.

        Выводи JSON следующего формата:
        {
        "priority": "критично срочно | срочно | планово",
        "reason": "2–3 предложения, почему выбран именно этот приоритет (логика, ключевые факторы, отклонения витальных показателей)",
        "hint_for_doctor": "Краткие первые шаги, которые врач должен выполнить (например: снять ЭКГ, кислород, анализы и т.п.)",
        "profile": "therapy | cardio | pulmonology | neurology | obstetric | pediatry",
        "red_flags": ["краткие пункты ключевых 'красных флагов'"],
        "sources": [
            {"id": "doc_cardio_01", "section": "1", "version_date": "2025-05-12"}
        ],
        "confidence": 0.0–1.0
        }

        Пример 1 (критично срочно):
        ВХОД:
        боль за грудиной 20 мин, пот; анамнез ИБС; ЧСС 110, АД 180/110, SpO2 92%.
        ВЫХОД:
        {
        "priority": "критично срочно",
        "reason": "Остро начавшаяся боль за грудиной у пациента с ИБС и снижением SpO₂ до 92% указывает на риск острого коронарного синдрома. Высокое давление и тахикардия усиливают угрозу осложнений.",
        "hint_for_doctor": "Снять ЭКГ в первые 10 мин, обеспечить кислород при SpO₂ <94%, назначить ASA и нитраты по протоколу, взять тропонин, вызвать кардиолога.",
        "profile": "therapy",
        "red_flags": ["боль за грудиной >10 мин", "SpO₂ <94%", "АД ≥180/110"],
        "sources": [
            {"id": "doc_cardio_01", "section": "1", "version_date": "2025-05-12"}
        ],
        "confidence": 0.9
        }

        Пример 2 (срочно):
        ВХОД:
        лихорадка 38.8, кашель 3 дня; анамнез ХОБЛ; ЧСС 96, АД 130/80, SpO2 95%.
        ВЫХОД:
        {
        "priority": "срочно",
        "reason": "Повышенная температура и кашель у пациента с ХОБЛ повышают риск дыхательной декомпенсации, хотя SpO₂ пока стабильна. Осмотр необходим в ближайшее время.",
        "hint_for_doctor": "Оценить дыхание, сатурацию, провести аускультацию, рассмотреть антибиотики при подозрении на обострение ХОБЛ.",
        "profile": "therapy",
        "red_flags": ["t° >38.5", "анамнез ХОБЛ"],
        "sources": [
            {"id": "doc_resp_02", "section": "2", "version_date": "2024-11-01"}
        ],
        "confidence": 0.78
        }

        Пример 3 (планово):
        ВХОД:
        тупая боль в пояснице 2 недели без иррадиации; травм не было; витальные в норме.
        ВЫХОД:
        {
        "priority": "планово",
        "reason": "Нет признаков неотложности: длительная стабильная боль без неврологических симптомов и с нормальными витальными параметрами.",
        "hint_for_doctor": "Рекомендовать плановый приём, анализ мочи, при необходимости направление на МРТ или физиотерапию.",
        "profile": "therapy",
        "red_flags": [],
        "sources": [
            {"id": "doc_backpain_03", "section": "1", "version_date": "2025-02-10"}
        ],
        "confidence": 0.72
        }

        ПОЛЬЗОВАТЕЛЬ:
        ВХОД:
        {
        "complaint": "Сильная давящая боль за грудиной 20 минут, холодный пот.",
        "history": "Мужчина 58 лет, гипертония, курение 30 лет.",
        "vitals": { "hr": 104, "bp_syst": 170, "bp_diast": 100, "spo2": 93, "temp": 36.7 }
        }
"""
    )

    norm_v = normalize_vitals(payload.vitals)

    user_msg = (
        "INPUT:\n"
        f"complaint: {payload.complaint}\n"
        f"history: {payload.history}\n"
        f"vitals: {vitals_to_text(norm_v)}\n"
        "\n"
        "ОТВЕТИ В JSON (без лишнего текста), пример структуры:\n"
        "{\n"
        '  "priority": "критично срочно",\n'
        '  "reason": "…",\n'
        '  "hint_for_doctor": "…",\n'
        '  "profile": "therapy",\n'
        '  "confidence": 0.85,\n'
        '  "red_flags": ["…","…"],\n'
        '  "sources": [ { "id": "doc_cardio_01", "section": "1", "version_date": "2025-05-12" } ]\n'
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

        import json
        try:
            parsed = json.loads(text)
        except json.JSONDecodeError:
            import re
            m = re.search(r"\{.*\}", text, flags=re.S)
            if not m:
                raise HTTPException(status_code=500, detail={"parse_error": text})
            parsed = json.loads(m.group(0))

        return TriageOutput(**parsed)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/yandex/prompt")
async def yandex_prompt(p: PromptProxy):
    if p.messages:
        messages = p.messages
    else:
        messages = []
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
    