import os
from dotenv import load_dotenv
from typing import Optional, Literal, List, Dict, Any
from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import httpx

load_dotenv()

YC_FOLDER_ID = os.getenv("YANDEX_CLOUD_FOLDER")
YC_API_KEY = os.getenv("YANDEX_CLOUD_API_KEY")
YC_MODEL_URI = os.getenv("YC_AGENT_ID")
TEMPERATURE = float(os.getenv("TEMPERATURE"))
MAX_TOKENS = int(os.getenv("MAX_TOKENS"))

YANDEX_URL = "https://llm.api.cloud.yandex.net/foundationModels/v1/completion"

# создаем экземпляр фастапи приложения
app = FastAPI(title="AI-Triage MVP (FastAPI + YandexGPT)")

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex="http://localhost:5173",
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

# описываем модели
class Vitals(BaseModel):
    bp: Optional[str] = Field(None, description="АД, например '180/110'")
    hr: Optional[str] = Field(None, description="ЧСС")
    spo2: Optional[str] = Field(None, description="SpO2 в процентах")
    temp: Optional[str] = Field(None, description="Температура, °C")
    rr: Optional[str] = Field(None, description="ЧДД")
    gcs: Optional[str] = Field(None, description="Шкала комы Глазго")

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
    profile: Optional[str] = "therapy"
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
        - При ответе всегда опирайся на предоставленный контекст из врачебных протоколов (если есть).
        - Не ставь диагнозов и не используй предположительные диагнозы.
        - Ответ должен быть СТРОГО валидным JSON в соответствии со схемой.
        - Никакого текста вне JSON.
        - Используй данные из контекста, чтобы заполнить "sources" и "hint_for_doctor".

        Выводи JSON следующего формата:
        {
        "priority": "критично срочно | срочно | планово",
        "reason": "2–3 предложения, почему выбран именно этот приоритет (логика, ключевые факторы, отклонения витальных показателей)",
        "hint_for_doctor": "Краткие первые шаги, которые врач должен выполнить (например: снять ЭКГ, кислород, анализы и т.п.)",
        "profile": "therapy | pediatrics | trauma | ... (основной профиль пациента, если известен)",
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

    user_msg = (
        "INPUT:\n"
        f"complaint: {payload.complaint}\n"
        f"history: {payload.history}\n"
        f"vitals: {payload.vitals.model_dump() if payload.vitals else None}\n\n"
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