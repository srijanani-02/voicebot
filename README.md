# Personal Voice Assistant

## Live Demo: https://voicebot-beta-two.vercel.app/

A decoupled web app with:

- `frontend/`: React + Vite + TypeScript UI
- `backend/`: FastAPI API that owns all external API calls and secrets

## Security

The frontend never stores API keys. Set only the ElevenLabs and OpenRouter keys in `backend/.env`.

## Backend setup

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
uvicorn main:app --reload
```

## Frontend setup

```bash
cd frontend
copy .env.example .env
npm install
npm run dev
```

By default the frontend calls `http://localhost:8000`.

## Provider setup

This version uses:

- `ElevenLabs` for speech-to-text
- `OpenRouter` for chat
- `ElevenLabs` for text-to-speech

Backend environment variables:

- `ELEVENLABS_API_KEY`
- `OPENROUTER_API_KEY`

Official references:

- OpenRouter free models: https://openrouter.ai/openrouter/free
- OpenRouter authentication: https://openrouter.ai/docs/api/reference/authentication
- ElevenLabs free plan: https://elevenlabs.io/ai-voice-generator
- ElevenLabs TTS quickstart: https://elevenlabs.io/docs/eleven-api/quickstart
- ElevenLabs speech-to-text: https://elevenlabs.io/docs/api-reference/speech-to-text/convert
