# 🕵️ AI Mafia — Agents that Talk, Scheme, and *Speak*

A browser game of **Mafia / Werewolf** played by LLM agents with distinct personalities —
now with a full **emotional voice layer**: every agent speaks aloud in its own voice, and
every spoken line (human or AI) is analysed for vocal emotion that feeds back into the game.

> Built for the **Rebuild Hackathon, 2026.**

You watch (or join) six AI players accuse, defend, bluff, and vote each other out. A Detective
investigates, a Doctor protects, the Mafia and a Bad Guy try to survive — and the agents
*read the room*: each line is tagged with the speaker's detected vocal emotion so the others
can tell a nervous bluff from honest conviction.

---

## ✨ Features

- **LLM agents** (K2-Think) with 10 personality archetypes — each lies, deduces, and persuades in character.
- **Emotional voices** — per-character [ElevenLabs v3](https://elevenlabs.io) text-to-speech with inline
  emotion tags (`[nervous]`, `[angry]`, …). Tags drive the delivery and are never shown on screen.
- **Vocal-emotion sensing** — every utterance is run through [Valence](https://getvalenceai.com); the detected
  emotion becomes context the other agents read.
- **Play as a human** — join the table, **speak into your mic** (transcribed by ElevenLabs Scribe) or type,
  and take night actions / votes yourself.
- **Speech-synced captions** — each line's text reveals exactly as that character starts speaking.
- **Real game engine** — randomized hidden roles, night actions (Mafia kill / Detective investigate /
  Doctor save), 2-round discussions, voting, and win detection — all parallelized where possible.

## 🧠 Roles

| Team | Roles |
|------|-------|
| **Town (good)** | Detective (learns if a target is Mafia), Doctor (saves one player each night), Citizens |
| **Evil** | Mafia (kills at night), Bad Guy (extra evil; must also be voted out) |

The game ends when **all evil are eliminated** (Town wins) or **evil reach parity** with the Town (Evil wins).

---

## 🏗️ Architecture

```
React UI (mafia-game-frontend, :3000)
        │  REST / polling
        ▼
Flask API + game engine (app.py, :5001)
        │
        ├── K2-Think  ── agent dialogue (with [emotion] tags)
        ├── ElevenLabs v3 ── per-character TTS  +  Scribe (human mic → text)
        └── Valence   ── audio → vocal emotion label
```

**The closed emotional loop:** an AI agent's reply → spoken by ElevenLabs → that audio is sent to
Valence → the detected emotion is attached to the transcript the *next* agent reads. Human turns do
the same: your mic audio is transcribed *and* emotion-analysed.

Key files:

| File | What it is |
|------|------------|
| `app.py` | Flask backend + the entire game engine (roles, night/day cycle, voting, REST API) |
| `voice_layer.py` | Additive voice/emotion module — TTS, STT, Valence, tag helpers (fully optional) |
| `mafia-game-frontend/` | React (Create React App) UI |
| `.env.example` | All configuration / API keys (copy to `.env`) |

---

## 🚀 Running locally

### Prerequisites
- **Python 3.9** (recommended — the pinned `langchain` stack won't build on 3.13+)
- **Node.js 16+**
- A **K2-Think** API key (agent dialogue). Voice is optional; for it you'll also want
  **ElevenLabs** and **Valence** keys.

### 1. Backend

```bash
python3.9 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

cp .env.example .env       # then fill in your keys
python app.py              # serves the API on http://localhost:5001
```

> **Note on ports:** the backend runs on **5001**, not 5000 — macOS AirPlay Receiver occupies 5000.

### 2. Frontend

```bash
cd mafia-game-frontend
npm install
npm start                  # opens http://localhost:3000
```

Open **http://localhost:3000** and start a game.

---

## ⚙️ Configuration (`.env`)

| Variable | Purpose |
|----------|---------|
| `LLM_PROVIDER` | `k2` (default) or `azure` |
| `K2_API_KEY` / `K2_API_KEYS` | K2-Think key, or a comma-separated pool (round-robined across players) |
| `K2_BASE_URL`, `K2_MODEL` | K2 endpoint / model (defaults provided) |
| `VOICE_ENABLED` | `true` to enable the voice/emotion layer |
| `ELEVENLABS_API_KEY` | ElevenLabs (TTS + Scribe STT) |
| `VALENCE_API_KEY` | Valence (vocal-emotion detection) |

All API calls are **backend-only** — keys never reach the browser. The whole voice layer is
defensive: if `VOICE_ENABLED=false` or any service fails, the game falls back to text and keeps working.

### Notes & gotchas
- **K2-Think** is a reasoning model (~25–40s per turn). Discussions are turn-based, so this is by design;
  night actions and voting run in parallel to stay snappy.
- **Valence** needs clips **≥ ~4.5 s**; shorter lines simply get no emotion label. It reads human
  voices well but tends to label synthetic TTS as "happy".
- **ElevenLabs v3** (`eleven_v3`) is required for the emotion tags to affect delivery.

---

Built for the **Rebuild Hackathon, 2026.**
