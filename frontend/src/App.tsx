import { useEffect, useRef, useState } from "react";
import { ChatWindow, type ChatMessage } from "./components/ChatWindow";
import { Composer } from "./components/Composer";
import { ModeToggle } from "./components/ModeToggle";
import { QuickActions } from "./components/QuickActions";
import "./app.css";

type OutputMode = "audio" | "text";

type AssistantApiResponse = {
  input_text: string;
  reply_text: string;
  output_mode: OutputMode;
  model_used: string;
  audio_base64?: string | null;
  audio_mime_type?: string | null;
};

type ErrorDetail = {
  message?: string;
  input_text?: string;
};

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

function makeMessage(role: ChatMessage["role"], content: string, meta?: string): ChatMessage {
  return {
    id: `${role}-${crypto.randomUUID()}`,
    role,
    content,
    meta,
  };
}

export default function App() {
  const [outputMode, setOutputMode] = useState<OutputMode>("audio");
  const [inputValue, setInputValue] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    makeMessage(
      "assistant",
      "Hi. I can answer in text, or speak back when audio mode is on.",
      "ElevenLabs handles speech in and out, and OpenRouter writes the reply.",
    ),
  ]);
  const [status, setStatus] = useState("Ready");
  const [loading, setLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [audioSrc, setAudioSrc] = useState("");

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!audioSrc || !audioRef.current) {
      return;
    }

    void audioRef.current.play().catch(() => {
      setStatus("Audio is ready. Press play if your browser blocks autoplay.");
    });
  }, [audioSrc]);

  function updateMessage(messageId: string, content: string, meta?: string) {
    setMessages((current) =>
      current.map((message) => (message.id === messageId ? { ...message, content, meta } : message)),
    );
  }

  function applyAssistantResponse(data: AssistantApiResponse) {
    const meta = data.output_mode === "audio" ? `Model: ${data.model_used} | Audio reply attached.` : `Model: ${data.model_used}`;
    setMessages((current) => [...current, makeMessage("assistant", data.reply_text, meta)]);

    if (data.audio_base64 && data.audio_mime_type) {
      setAudioSrc(`data:${data.audio_mime_type};base64,${data.audio_base64}`);
    } else {
      setAudioSrc("");
    }
  }

  async function parseError(response: Response): Promise<{ message: string; inputText?: string }> {
    const payload = (await response.json().catch(() => null)) as { detail?: string | ErrorDetail } | null;
    const detail = payload?.detail;

    if (typeof detail === "string") {
      return { message: detail };
    }

    if (detail && typeof detail === "object") {
      return {
        message: detail.message ?? "Request failed.",
        inputText: detail.input_text,
      };
    }

    return { message: "Request failed." };
  }

  async function sendTextPrompt(prompt: string) {
    const message = prompt.trim();
    if (!message) {
      return;
    }

    setLoading(true);
    setStatus("Sending text prompt...");
    setMessages((current) => [...current, makeMessage("user", message)]);

    try {
      const response = await fetch(`${API_BASE_URL}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message,
          output_mode: outputMode,
        }),
      });

      if (!response.ok) {
        const error = await parseError(response);
        throw new Error(error.message);
      }

      const data = (await response.json()) as AssistantApiResponse;
      applyAssistantResponse(data);
      setInputValue("");
      setStatus(outputMode === "audio" ? "Reply received and audio playback started." : "Reply received.");
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unknown error.";
      setMessages((current) => [
        ...current,
        makeMessage("assistant", "I hit a backend error while processing that request.", detail),
      ]);
      setStatus("Request failed.");
    } finally {
      setLoading(false);
    }
  }

  async function sendVoicePrompt(blob: Blob) {
    const pendingVoiceMessage: ChatMessage = {
      id: `voice-${crypto.randomUUID()}`,
      role: "user",
      content: "Transcribing your recording...",
      meta: "AssemblyAI will convert speech to text before the assistant replies.",
    };

    setLoading(true);
    setStatus("Uploading voice note...");
    setMessages((current) => [...current, pendingVoiceMessage]);

    try {
      const formData = new FormData();
      formData.append("file", blob, "recording.webm");
      formData.append("output_mode", outputMode);

      const response = await fetch(`${API_BASE_URL}/api/voice`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await parseError(response);
        if (error.inputText) {
          updateMessage(pendingVoiceMessage.id, error.inputText, "Transcribed from your voice recording.");
        }
        throw new Error(error.message);
      }

      const data = (await response.json()) as AssistantApiResponse;
      updateMessage(pendingVoiceMessage.id, data.input_text, "Transcribed from your voice recording.");
      applyAssistantResponse(data);
      setStatus(outputMode === "audio" ? "Voice request answered with audio." : "Voice request answered.");
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unknown error.";
      setMessages((current) => [
        ...current,
        makeMessage("assistant", "I could not process that recording.", detail),
      ]);
      setStatus("Voice request failed.");
    } finally {
      setLoading(false);
    }
  }

  async function toggleRecording() {
    if (isRecording) {
      recorderRef.current?.stop();
      setIsRecording(false);
      setStatus("Recording stopped. Uploading...");
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setStatus("This browser does not support voice recording.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunksRef.current = [];

      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        stream.getTracks().forEach((track) => track.stop());
        chunksRef.current = [];
        await sendVoicePrompt(blob);
      };

      recorder.start();
      setIsRecording(true);
      setStatus("Recording... tap Stop when you are done.");
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Microphone permission failed.";
      setStatus(detail);
      setIsRecording(false);
    }
  }

  return (
    <main className="app-shell">
      <section className="assistant-card">
        <header className="assistant-card__header">
          <div>
            <p className="assistant-card__eyebrow">Personal Voice Assistant</p>
            <h1>Talk, type, and get a quick reply back.</h1>
            <p className="assistant-card__lede">
              ElevenLabs handles transcription and speech, and OpenRouter handles text generation on the backend.
            </p>
          </div>
          <ModeToggle outputMode={outputMode} onToggle={setOutputMode} />
        </header>

        <QuickActions disabled={loading || isRecording} onSelect={sendTextPrompt} />

        <ChatWindow messages={messages} loading={loading} />

        <footer className="assistant-card__footer">
          <Composer
            disabled={loading}
            inputValue={inputValue}
            isRecording={isRecording}
            onInputChange={setInputValue}
            onSend={() => void sendTextPrompt(inputValue)}
            onRecordToggle={() => void toggleRecording()}
          />

          <div className="assistant-card__status-row">
            <span className="assistant-card__status">{status}</span>
            {audioSrc ? <audio ref={audioRef} className="assistant-card__audio" controls src={audioSrc} /> : null}
          </div>
        </footer>
      </section>
    </main>
  );
}
