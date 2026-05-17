import os
from groq import Groq


class WhisperService:
    def transcribe(self, audio_bytes: bytes, filename: str = "audio.webm") -> str:
        client = Groq(api_key=os.environ.get("GROQ_API_KEY"))
        model = os.environ.get("GROQ_WHISPER_MODEL", "whisper-large-v3")
        transcription = client.audio.transcriptions.create(
            file=(filename, audio_bytes),
            model=model,
            language="ar",
            response_format="text",
        )
        return transcription if isinstance(transcription, str) else transcription.text
