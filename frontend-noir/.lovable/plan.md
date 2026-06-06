## Goal

Match the original repo's workflow exactly. UI stays noir/detective as built. No flow changes — just port the Flask game loop to Lovable Cloud + Lovable AI.

## Original flow (from `app.py`)

```text
setup (pick personalities, assign roles internally)
  → create_game        POST /api/create_game
  → start_game         POST /api/start_game/:id          → phase=night
night
  → process_night      POST /api/process_night/:id        (mafia/detective/doctor decide)
  → resolve_night      POST /api/resolve_night/:id        → phase=dawn  (announce death/save)
discussion
  → start_discussion   POST /api/start_discussion/:id     → phase=discussion
  → simulate_discussion POST /api/simulate_discussion/:id (each surviving suspect speaks in turn)
voting
  → process_voting     POST /api/process_voting/:id       → phase=voting → exile → game_over OR phase=night (next day)
loop until mafia eliminated OR mafia ≥ town
game_over screen with winner
```

Skip for this pass: human-player branch, voice (ElevenLabs), `continue_discussion` mid-thread interjections. The original supports an all-AI mode — that's what we ship first.

## What's in place

- Landing + suspect picker (`/`)
- Case-reveal screen with role flips (`/case`)
- Night phase with AI-driven mafia/detective/doctor decisions and dawn report (`/night`)
- `processNight` server function calling Lovable AI Gateway

The night page currently dead-ends at "Close the File". That's the gap.

## What to build

### 1. Single source of truth for game state

New `src/lib/game.ts`:
- `GameState` type: `{ id, phase, day, suspects[], roles{}, alive{}, history[], lastNight{}, winner? }`
- `loadGame()` / `saveGame()` against `sessionStorage("mafia:game")`
- `assignRoles()` (already exists in `case.tsx` — move here)

### 2. Server functions (one per phase, mirrors Flask endpoints)

New files under `src/lib/`:
- `night.functions.ts` — already exists, keep `processNight`. Add `resolveNight` that just stamps the dawn outcome onto state (the current night route does this inline; move it server-side so the flow matches).
- `discussion.functions.ts` — `simulateDiscussion(state)` → returns ordered array of `{ speaker, text, emotion }` for every surviving suspect, generated via Lovable AI with each agent's personality + knowledge of the dawn report and prior discussion.
- `voting.functions.ts` — `processVoting(state)` → each surviving suspect votes for who to exile (AI call), tally, exile the top vote-getter, return `{ votes, exiled, exiledRole, nextPhase, winner? }`. Determines win condition:
  - Town wins if all mafia exiled
  - Mafia wins if mafia count ≥ town count
  - Otherwise → next night, day+1

All use `createServerFn` + zod validation. AI calls share one helper `callAgent(personality, systemPrompt, userPrompt)` in `src/lib/agent.ts`.

### 3. Routes mirroring the phases

- `/night`  (exists) — after dawn report, button now navigates to `/discussion`.
- `/discussion` (new) — typewriter chat log; each suspect's portrait + line appears in turn. "Call the Vote" button → `/vote`.
- `/vote` (new) — animated tally (ballots stamping in), exile reveal with red CLASSIFIED stamp showing exiled role. Button → `/night` (next day) or `/game-over`.
- `/game-over` (new) — winner announcement, case-closed dossier listing every suspect's true role and fate. "New Case" → `/`.

Each route loads state from `sessionStorage`, calls its server function, saves updated state, animates the result. Same noir styling primitives (`FilmGrain`, `RedString`, typewriter, dossier cards) reused.

### 4. Wiring

- `case.tsx` already writes initial state. Confirm it includes `day: 1`, `alive` map, empty `history`.
- `night.tsx` "Close the File" → `navigate({ to: "/discussion" })`.
- Update `src/routeTree.gen.ts` is auto — just add route files.

## Technical notes

- All AI calls go through Lovable AI Gateway (Gemini), same pattern as existing `processNight`.
- State lives in `sessionStorage` only — no DB needed for this scope. Server functions are stateless: client sends current state, server returns the next state slice.
- Keep the existing noir CSS tokens, fonts, rain/grain effects on every new route.
- No human-player input, no voice, no mid-discussion interjection. Pure AI loop, exactly like the original's default mode.

## Out of scope (call out for later)

- Human player as one of the suspects
- ElevenLabs voice narration
- Persistent multi-session game history
- Mid-discussion "interject" button
