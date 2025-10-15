import os
from dotenv import load_dotenv
from typing import Optional, Literal, List, Dict, Any
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
import httpx

load_dotenv()

YC_FOLDER_ID = os.getenv("YANDEX_CLOUD_FOLDER")
YC_API_KEY = os.getenv("YANDEX_CLOUD_API_KEY")
YC_MODEL_URI = os.getenv("YC_AGENT_ID")
TEMPERATURE = float(os.getenv("TEMPERATURE"))
MAX_TOKENS = int(os.getenv("MAX_TOKENS"))

YANDEX_URL = "https://llm.api.cloud.yandex.net/foundationModels/v1/completion"

app = FastAPI(title="AI-Triage MVP (FastAPI + YandexGPT)")

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
    profile: Literal["therapy","surgery","pediatrics","trauma","other"] = "therapy"
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


@app.get("/health")
def health():
    return {"status": "ok", "modelUri": YC_MODEL_URI}


@app.post("/triage", response_model=TriageOutput)
async def triage(payload: TriageInput):
    system_msg = (
        "Ты — медицинский ассистент по ТРИАЖУ. "
        "На основе жалоб, анамнеза и виталий выдай СТРОГО валидный JSON "
        "с ключами: priority, reason, hint_for_doctor, profile, confidence, red_flags, sources. "
        "Только приоритет и причины, без диагнозов. "
        "Правила приоритета:\n"
        "- 'критично срочно': угроза жизни/тяжёлые red flags (нарушение дыхания, SpO2<94%, боль за грудиной >10 мин, неврол. дефицит, гипотензия <90, сознание <15, и т.д.).\n"
        "- 'срочно': потенциально опасно, но без немедленных red flags.\n"
        "- 'планово': стабильное состояние, без красных флагов.\n"
        "Поле 'profile' выбери из: therapy, surgery, pediatrics, trauma, other."
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