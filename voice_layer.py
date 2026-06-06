"""
Additive emotional voice layer for the AI Mafia game.

Pipeline per spoken turn:
  K2 reply (with [v3 tags]) --> ElevenLabs v3 TTS --> audio --> Valence --> emotion label

Hard rules:
  * The raw TAGGED string is used ONLY by speak_as() / ElevenLabs. Everything that goes
    to the screen, a log, or the transcript must pass through strip_tags() first.
  * The whole layer is OPTIONAL and DEFENSIVE: if VOICE_ENABLED is off or any external
    call fails, it degrades silently to text-only and the core game keeps working.

All three external calls are backend-only; keys never reach the client.
"""
import os
import re
import io
import logging

import requests
from dotenv import load_dotenv

# Ensure .env is loaded before reading config — this module may be imported before
# app.py calls load_dotenv().
load_dotenv()

logger = logging.getLogger(__name__)

VOICE_ENABLED = os.getenv("VOICE_ENABLED", "false").lower() == "true"
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY", "")
VALENCE_API_KEY = os.getenv("VALENCE_API_KEY", "")
# Valence "discrete" audio emotion endpoint (the real path used by the valenceai
# SDK — the public docs incorrectly list /emotionprediction). Needs a `model`
# param ("7emotions" or "4emotions") and a minimum clip length of ~4.5s.
VALENCE_URL = os.getenv("VALENCE_URL", "https://api.getvalenceai.com/v1/discrete/emotion")
VALENCE_MODEL = os.getenv("VALENCE_MODEL", "7emotions")

# ---------------------------------------------------------------------------
# Tag helpers (delivery instructions for TTS only — never shown on screen)
# ---------------------------------------------------------------------------
TAG_RE = re.compile(r"\[[^\]]+\]")


def ensure_tags(reply, default="[neutral]"):
    """Guarantee at least one v3 audio tag so TTS always receives some emotion."""
    reply = (reply or "").strip()
    return reply if TAG_RE.search(reply) else f"{default} {reply}".strip()


def strip_tags(text):
    """Remove ALL [tags] -> clean text for on-screen display AND the transcript."""
    return TAG_RE.sub("", text or "").strip()


# ---------------------------------------------------------------------------
# Character voice casting (ElevenLabs default-library voices, v3-compatible)
# ---------------------------------------------------------------------------
CHARACTER_VOICES = {
    "Conspirator": {"voice_id": "h6u4tPKmcPlxUdZOaVpH", "name": "Conspirator", "stability": 0.25},
    "Diplomat":    {"voice_id": "zIxDnGtj6IzAkP4KJ2Oo", "name": "Diplomat",    "stability": 0.45},
    "Empath":      {"voice_id": "DU2z7JKzyitx4FdXpJBR", "name": "Empath",      "stability": 0.40},
    "Innocent":    {"voice_id": "kAXSxs17BYwCxcleeuLV", "name": "Innocent",    "stability": 0.40},
    "Jester":      {"voice_id": "9yzdeviXkFddZ4Oz8Mok", "name": "Jester",      "stability": 0.25},
    "Manipulator": {"voice_id": "fgDJOgmENIR82PueQrVs", "name": "Manipulator", "stability": 0.35},
    "Mastermind":  {"voice_id": "dG7SBJDxDoZkQUrwvqrD", "name": "Mastermind",  "stability": 0.45},
    "Sheriff":     {"voice_id": "V6zMK42bu1TVQBA7MwcF", "name": "Sheriff",     "stability": 0.45},
    "Veteran":     {"voice_id": "Q4oILuo4P8VeXtE6FMLI", "name": "Veteran",     "stability": 0.40},
    "Wildcard":    {"voice_id": "sssn4wp3AspuK2kvy3Ym", "name": "Wildcard",    "stability": 0.20},
}
# No generic fallback: each voice belongs to exactly one character. An unknown
# personality is simply not voiced rather than borrowing another character's voice.

# Lazily-constructed ElevenLabs client (only when the layer is actually used).
_el_client = None
# Circuit breaker: if Valence's (unconfirmed) endpoint keeps failing, stop calling it
# so it never stalls the turn-based loop.
_valence_failures = 0
_VALENCE_MAX_FAILURES = 2


def _client():
    global _el_client
    if _el_client is None:
        from elevenlabs.client import ElevenLabs
        _el_client = ElevenLabs(api_key=ELEVENLABS_API_KEY)
    return _el_client


def speak_as(character, text_with_tags):
    """TAGGED text -> speech bytes using the character's voice. The ONLY consumer of
    the raw tagged string. Returns b'' on any failure (caller degrades to text-only)."""
    if not (VOICE_ENABLED and ELEVENLABS_API_KEY and text_with_tags):
        return b""
    from elevenlabs import VoiceSettings
    cfg = CHARACTER_VOICES.get(character)
    if not cfg:
        # Each voice is exclusive to its character; don't substitute another's.
        logger.warning(f"No assigned voice for character '{character}'; skipping TTS.")
        return b""
    try:
        audio = _client().text_to_speech.convert(
            voice_id=cfg["voice_id"],
            text=text_with_tags,          # e.g. "[nervous] I... I'm innocent!"
            model_id="eleven_v3",         # required for audio tags
            voice_settings=VoiceSettings(stability=cfg["stability"]),
        )
        return b"".join(audio)
    except Exception as e:
        logger.error(f"ElevenLabs TTS failed for {character}: {repr(e)[:200]}")
        return b""


def valence_emotion(audio_bytes):
    """Audio bytes -> vocal emotion label (e.g. 'frustrated'), or None on failure.
    Fast-fails and trips a circuit breaker so an unconfirmed endpoint can't stall play."""
    global _valence_failures
    if not (VOICE_ENABLED and VALENCE_API_KEY and audio_bytes):
        return None
    if _valence_failures >= _VALENCE_MAX_FAILURES:
        return None  # circuit open — endpoint repeatedly unreachable this session
    try:
        r = requests.post(
            VALENCE_URL,
            headers={"x-api-key": VALENCE_API_KEY},
            files={"file": ("clip.mp3", audio_bytes, "audio/mpeg")},
            params={"model": VALENCE_MODEL},
            timeout=12,
        )
    except Exception as e:
        # Network/timeout — endpoint may be down; count toward the circuit breaker.
        _valence_failures += 1
        if _valence_failures == 1:
            logger.warning(f"Valence unreachable ({repr(e)[:140]}); emotion will default.")
        return None

    if r.status_code == 200:
        _valence_failures = 0
        try:
            data = r.json()
        except Exception:
            return None
        emotion = data.get("main_emotion") or data.get("emotion") or data.get("prediction")
        if isinstance(emotion, dict):
            emotion = emotion.get("label") or emotion.get("emotion")
        return emotion

    # 4xx (e.g. AUDIO_TOO_SHORT for clips < ~4.5s) is per-clip, not an outage —
    # don't trip the breaker; just skip emotion for this line.
    if 400 <= r.status_code < 500:
        _valence_failures = 0
        logger.info(f"Valence {r.status_code} (skipping emotion): {r.text[:140]}")
        return None

    # 5xx — server error; count toward the breaker.
    _valence_failures += 1
    return None


def transcribe(audio_bytes):
    """Human mic audio -> words via ElevenLabs Scribe. Best-effort ('' on failure).
    tag_audio_events=False so non-speech noise isn't transcribed as '(background
    noise)' etc.; any leftover (event) annotations are stripped."""
    if not (VOICE_ENABLED and ELEVENLABS_API_KEY and audio_bytes):
        return ""
    try:
        text = _client().speech_to_text.convert(
            file=io.BytesIO(audio_bytes),
            model_id="scribe_v1",
            tag_audio_events=False,   # transcribe spoken words only, not noise events
        ).text or ""
    except Exception as e:
        logger.warning(f"Scribe unavailable: {repr(e)[:140]}")
        return ""
    # Strip any residual non-speech annotations like "(background noise)", "[laughs]".
    text = re.sub(r"[\(\[][^\)\]]*[\)\]]", "", text)
    return text.strip()


def voice_emotion_turn(speaker, audio_or_text, character=None, is_ai=True):
    """One call the game loop makes at every speak event.

    AI turn  : audio_or_text is the TAGGED reply -> synth voice -> detect emotion.
    Human turn: audio_or_text is mic audio bytes -> (words via Scribe) + emotion.

    Returns {"audio": bytes, "emotion": str|None, "words": str|None}. Never raises.
    """
    result = {"audio": b"", "emotion": None, "words": None}
    if not VOICE_ENABLED:
        return result
    try:
        if is_ai:
            audio = speak_as(character, audio_or_text)
            result["audio"] = audio
            result["emotion"] = valence_emotion(audio)
        else:
            audio = audio_or_text if isinstance(audio_or_text, (bytes, bytearray)) else b""
            result["words"] = transcribe(audio)
            result["emotion"] = valence_emotion(audio)
    except Exception as e:
        logger.error(f"voice_emotion_turn failed for {speaker}: {repr(e)[:200]}")
    return result
