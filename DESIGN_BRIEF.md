# 🎨 Redesign Brief — Make AI Mafia *feel like a game*

**Paste this whole file as your first message to Claude Code, then say: "Redesign the
frontend per DESIGN_BRIEF.md."**

You are redesigning the **frontend** of an AI Mafia (social-deduction) game. The game logic,
backend, and the AI/voice features all work — **do not change game rules or the API contract.**
Your job is purely the **visual design, layout, animation, and game-feel** of the React UI.

---

## What this app is

Six AI agents (and optionally a human) play Mafia. Phases cycle:
**Setup → Night → Dawn → Discussion (2 rounds) → Voting → (repeat) → Game Over.**
Each AI agent has a personality, speaks aloud (text-to-speech), and its line shows up in a
"Town Discussion" feed with the text revealed in sync with the voice. The human can record
their mic or type on their turn.

Current UI = a plain Create React App with three cards (Players / Game Events / Voting) and a
discussion feed below. It works but looks like a dashboard, **not a game**. Make it
atmospheric and fun.

## Tech constraints (keep these)
- **Stack:** Create React App (React 18). Single main file: `mafia-game-frontend/src/App.js`
  + `src/App.css`. You may split into components/CSS modules, add libraries (framer-motion,
  tailwind, etc.), and restructure freely — but it must still `npm start` and build.
- **Backend stays as-is:** Flask API on `http://localhost:5001` (run `python app.py`). The
  frontend talks to it via `API_URL` in `App.js`. **Don't change endpoints, payloads, or the
  polling model.** (Start the backend to test against real data.)
- Keep all existing functionality: personality selection, "Play Yourself" human mode, mic
  recording (`HumanDiscussionInput`), per-line audio playback + speech-synced text reveal,
  the 🔊/🔇 mute toggle, voting screen, game-over screen.

## API contract (read-only reference — don't change)
Base: `http://localhost:5001/api`
- `GET /personalities` → 10 personalities `{name: {description, attributes{truthfulness,
  aggressiveness, suspicion, persuasiveness, loyalty}, prompt_style}}`.
  Personalities: Conspirator, Diplomat, Empath, Innocent, Jester, Manipulator, Mastermind,
  Sheriff, Veteran, Wildcard.
- `POST /create_game` `{personalities:[...], isHumanPlayer:bool}` → `{game_id}`
- `POST /start_game/<id>` → assigns hidden roles
- `POST /process_night/<id>` , `POST /resolve_night/<id>` → night actions + dawn results
- `POST /start_discussion/<id>` , `POST /simulate_discussion/<id>` (runs in background)
- `GET /discussion_status/<id>` → `{discussion:[lines], meta:[{speaker,emotion,audio_url}|null],
  in_progress, progress, current_round, waiting_for_human, next_speaker}`  ← poll this
- `POST /process_voting/<id>` → `{results:{votes:{voter:target}, tally, exiled, game_over, winner}}`
- `GET /game_state/<id>` → `{phase, round, players:[{name, personality, role, alive}], game_over, winner}`
- Human turns: `POST /human_night_action/<id>`, `/human_discussion/<id>` `{message}`,
  `/human_discussion_audio/<id>` (multipart `audio`), `/human_vote/<id>` `{target}`
- Audio files are served from the backend at `/static/audio/...` (prefix with the backend origin).

Roles: **Detective, Doctor, Citizen** (Town/good), **Mafia, Bad Guy** (evil). Hide other
players' roles from the human unless they're the human's evil partner (logic already exists in
`PlayerRow` via `shouldShowRole`).

---

## Design direction — make it a game

**Mood:** a tense medieval/noir village at night. Think candlelight, fog, a full moon, long
shadows. The whole UI should *shift atmosphere with the phase*:
- **Night** → dark, blue/indigo, moonlit, hushed. Sleeping village.
- **Dawn/Day** → warm light breaks; reveal who died.
- **Discussion** → the town square; the current speaker is spotlighted.
- **Voting** → tense, red accents, a ballot/verdict feel.
- **Game Over** → dramatic win screen for the victorious team.

**Concrete ideas (pick the strong ones, you have creative latitude):**
- A **phase banner / transition** animation between Night→Dawn→Discussion→Voting (fade,
  vignette, sun/moon swap). Sell the day/night cycle.
- **Players as character cards** around a table, not a list. Show avatar, name, alive/dead
  (tombstone/desaturate on death), and a "speaking now" glow/pulse when it's their turn
  (`next_speaker`). Animate eliminations.
- **Role reveal** moments: a flip-card animation when the human learns their role, and a
  dramatic reveal of an exiled/killed player's role.
- **Discussion feed** as in-character speech bubbles with the avatar, the speaker highlighted
  while their audio plays (text already reveals in sync — keep that; make it feel like they're
  *talking*, e.g. a subtle typing/waveform indicator).
- **Voting** as a visible tally building up (bars/portraits filling), then a verdict slam.
- **Setup** screen that feels like assembling your cast — personality cards with their trait
  stats shown as little meters, hover/flavor, a clear "Play Yourself" option.
- Sound/UI polish: button hovers, soft ambient cues (optional), a day counter, subtle particle
  fog. Tasteful motion (framer-motion is great); don't overdo it to the point of distraction.
- **Responsive** and readable; keep contrast high enough to read the discussion.

**Keep usability:** it should still be obvious whose turn it is, what phase we're in, what the
human needs to do (record/type/vote), and the discussion must stay readable. Game-feel should
enhance clarity, not bury it.

## How to work
1. Run backend: `python app.py` (needs a `.env` with at least a K2 key — voice is optional).
   Voice/emotion is a bonus; the UI must look great even with voice off.
2. Run frontend: `cd mafia-game-frontend && npm install && npm start`.
3. Redesign `App.js` / `App.css` (refactor into components as you like). Verify it builds and a
   full game (AI-only and human mode) plays through end-to-end with the new design.

Deliverable: a polished, game-like frontend that plays the exact same game.
