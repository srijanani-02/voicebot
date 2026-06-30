import base64
import os
from typing import Any

import requests
from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

load_dotenv()

ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY")
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")

ELEVENLABS_STT_MODEL = "scribe_v2"
ELEVENLABS_TTS_VOICE_ID = "JBFqnCBsd6RMkjVDRZzb"
ELEVENLABS_TTS_MODEL = "eleven_multilingual_v2"
ELEVENLABS_OUTPUT_FORMAT = "mp3_44100_128"
OPENROUTER_CHAT_MODEL = "openai/gpt-oss-20b:free"
REQUEST_TIMEOUT = 90

SYSTEM_PROMPT = (
    "You are a friendly personal voice assistant. "
    "Reply naturally, clearly, and briefly. "
    "For poems, rhymes, jokes, and songs, keep the output short and polished. "
    "Do not add extra filler after the main answer."
)

ELEVENLABS_STT_URL = "https://api.elevenlabs.io/v1/speech-to-text"
ELEVENLABS_TTS_URL = f"https://api.elevenlabs.io/v1/text-to-speech/{ELEVENLABS_TTS_VOICE_ID}"
OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions"

app = FastAPI(title="Personal Voice Assistant API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=4_000)
    output_mode: str = Field(default="text")


class AssistantResponse(BaseModel):
    input_text: str
    reply_text: str
    output_mode: str
    model_used: str
    audio_base64: str | None = None
    audio_mime_type: str | None = None


def require_env(value: str | None, name: str) -> str:
    if not value:
        raise HTTPException(status_code=500, detail=f"{name} is missing in backend/.env.")
    return value


def normalize_output_mode(value: str | None) -> str:
    return "audio" if (value or "").strip().lower() == "audio" else "text"


def parse_error_detail(response: requests.Response) -> str:
    try:
        payload = response.json()
    except ValueError:
        return response.text

    if isinstance(payload, dict):
        return (
            payload.get("detail")
            or payload.get("error", {}).get("message")
            or payload.get("message")
            or str(payload)
        )

    return str(payload)


def ensure_ok(response: requests.Response, context: str) -> None:
    if response.ok:
        return
    detail = parse_error_detail(response)
    raise HTTPException(status_code=502, detail=f"{context} failed with status {response.status_code}: {detail}")


def transcribe_audio(audio_bytes: bytes, filename: str | None, content_type: str | None) -> str:
    elevenlabs_key = require_env(ELEVENLABS_API_KEY, "ELEVENLABS_API_KEY")
    files = {
        "file": (
            filename or "recording.webm",
            audio_bytes,
            content_type or "audio/webm",
        )
    }
    data = {
        "model_id": ELEVENLABS_STT_MODEL,
        "diarize": "false",
        "tag_audio_events": "false",
    }

    response = requests.post(
        ELEVENLABS_STT_URL,
        headers={"xi-api-key": elevenlabs_key},
        files=files,
        data=data,
        timeout=REQUEST_TIMEOUT,
    )
    ensure_ok(response, "Speech recognition")

    transcript = response.json()
    text = (transcript.get("text") or "").strip()
    if not text:
        raise HTTPException(status_code=502, detail="Speech recognition returned empty text.")
    return text


def extract_openrouter_text(response_json: dict[str, Any]) -> str:
    choices = response_json.get("choices") or []
    if not choices:
        raise HTTPException(status_code=502, detail="OpenRouter returned no choices.")

    message = choices[0].get("message", {})
    content = message.get("content", "")

    if isinstance(content, str):
        return content.strip()

    if isinstance(content, list):
        parts: list[str] = []
        for item in content:
            if isinstance(item, dict) and item.get("type") == "text":
                parts.append(str(item.get("text", "")).strip())
        return " ".join(part for part in parts if part)

    return ""


def generate_reply(user_text: str) -> tuple[str, str]:
    openrouter_key = require_env(OPENROUTER_API_KEY, "OPENROUTER_API_KEY")
    response = requests.post(
        OPENROUTER_CHAT_URL,
        headers={
            "Authorization": f"Bearer {openrouter_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        json={
            "model": OPENROUTER_CHAT_MODEL,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_text},
            ],
            "max_tokens": 180,
            "temperature": 0.55,
        },
        timeout=REQUEST_TIMEOUT,
    )
    ensure_ok(response, "Chat completion")

    reply_text = extract_openrouter_text(response.json())
    if not reply_text:
        raise HTTPException(status_code=502, detail="OpenRouter returned an empty reply.")
    return reply_text, OPENROUTER_CHAT_MODEL


def synthesize_speech(text: str) -> tuple[str, str]:
    elevenlabs_key = require_env(ELEVENLABS_API_KEY, "ELEVENLABS_API_KEY")
    response = requests.post(
        f"{ELEVENLABS_TTS_URL}?output_format={ELEVENLABS_OUTPUT_FORMAT}",
        headers={
            "xi-api-key": elevenlabs_key,
            "Content-Type": "application/json",
            "Accept": "audio/mpeg",
        },
        json={
            "text": text,
            "model_id": ELEVENLABS_TTS_MODEL,
        },
        timeout=REQUEST_TIMEOUT,
    )
    ensure_ok(response, "Text-to-speech")

    audio_bytes = response.content
    if not audio_bytes:
        raise HTTPException(status_code=502, detail="Text-to-speech returned empty audio.")

    mime_type = response.headers.get("content-type", "audio/mpeg").split(";")[0]
    return base64.b64encode(audio_bytes).decode("utf-8"), mime_type


def build_response(input_text: str, output_mode: str) -> AssistantResponse:
    reply_text, model_used = generate_reply(input_text)
    audio_base64 = None
    audio_mime_type = None

    if output_mode == "audio":
        audio_base64, audio_mime_type = synthesize_speech(reply_text)

    return AssistantResponse(
        input_text=input_text,
        reply_text=reply_text,
        output_mode=output_mode,
        model_used=model_used,
        audio_base64=audio_base64,
        audio_mime_type=audio_mime_type,
    )


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/chat", response_model=AssistantResponse)
def chat(request: ChatRequest) -> AssistantResponse:
    message = request.message.strip()
    if not message:
        raise HTTPException(status_code=400, detail="Message cannot be empty.")
    return build_response(message, normalize_output_mode(request.output_mode))


@app.post("/api/voice", response_model=AssistantResponse)
async def voice(file: UploadFile = File(...), output_mode: str = Form(default="text")) -> AssistantResponse:
    audio_bytes = await file.read()
    if not audio_bytes:
        raise HTTPException(status_code=400, detail="Uploaded audio file is empty.")

    transcript = transcribe_audio(audio_bytes, file.filename, file.content_type)
    try:
        return build_response(transcript, normalize_output_mode(output_mode))
    except HTTPException as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail={
                "message": str(exc.detail),
                "input_text": transcript,
            },
        ) from exc
