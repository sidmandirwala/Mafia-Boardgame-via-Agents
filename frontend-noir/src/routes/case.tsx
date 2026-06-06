import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { FilmGrain } from "@/components/mafia/FilmGrain";
import { RedString } from "@/components/mafia/RedString";
import { PERSONALITIES, type Personality } from "@/data/personalities";
import { api, loadGameId } from "@/lib/api";

export const Route = createFileRoute("/case")({
  head: () => ({
    meta: [
      { title: "Case Opened — The Mafia Dossier" },
      { name: "description", content: "Roles assigned. The night begins." },
    ],
  }),
  component: CasePage,
});

const ROLE_NOTES: Record<string, string> = {
  Mafia: "Strikes from the shadows. Eliminates one suspect each night.",
  "Bad Guy": "Allied with the Mafia. No night kill — but the town must vote them out too.",
  Detective: "Investigates one suspect each night. Knows truth from lie.",
  Doctor: "Saves one suspect each night. The only thing between life and the grave.",
  Citizen: "No power but the vote. Reason is the only weapon.",
};

// Dark, readable tones — the card front is light "paper", so light text vanished.
const ROLE_COLOR: Record<string, string> = {
  Mafia: "text-crimson border-crimson",
  "Bad Guy": "text-crimson border-crimson",
  Detective: "text-[#8a6d1b] border-[#8a6d1b]",
  Doctor: "text-[#1f6b3a] border-[#1f6b3a]",
  Citizen: "text-[#5a4632] border-[#5a4632]/60",
};

type Dealt = {
  player: string;          // Player_1 ...
  personalityName: string; // archetype
  persona: Personality | null;
  role: string;
  revealed: boolean;
};

function CasePage() {
  const navigate = useNavigate();
  const [dealt, setDealt] = useState<Dealt[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const id = loadGameId();
    if (!id) {
      navigate({ to: "/" });
      return;
    }
    // Roles were assigned server-side by start_game; read them from game_state.
    api
      .gameState(id)
      .then((gs) => {
        setDealt(
          gs.players.map((p) => ({
            player: p.name,
            personalityName: p.personality,
            persona: PERSONALITIES.find((x) => x.id === p.personality) ?? null,
            role: p.role || "Citizen",
            revealed: false,
          })),
        );
      })
      .catch((e) => setError(e?.message || "Couldn't load the case file."));
  }, []);

  const reveal = (idx: number) =>
    setDealt((prev) => (prev ? prev.map((d, i) => (i === idx ? { ...d, revealed: true } : d)) : prev));
  const revealAll = () =>
    setDealt((prev) => (prev ? prev.map((d) => ({ ...d, revealed: true })) : prev));
  const allRevealed = useMemo(() => (dealt ? dealt.every((d) => d.revealed) : false), [dealt]);

  const beginNight = () => navigate({ to: "/night" });

  return (
    <div className="min-h-screen bg-ink text-paper relative">
      <FilmGrain />

      <header className="relative mx-auto max-w-6xl px-6 pt-12 pb-4">
        <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.3em] text-paper/50">
          <Link to="/" className="hover:text-crimson">← back to dossier</Link>
          <span>Case File · Sealed Envelope</span>
        </div>

        <h1 className="mt-8 font-display text-4xl md:text-6xl leading-tight">
          The Cards <span className="text-crimson">Are Dealt</span>
        </h1>
        <p className="font-serif italic text-paper/70 mt-3 max-w-2xl">
          Each envelope holds a secret role, assigned in the back room. Tap to break the seal —
          in this town, the truth costs more than silence.
        </p>
      </header>

      <RedString label="Sealed Envelopes" />

      <main className="relative mx-auto max-w-6xl px-6 pb-32">
        {error ? (
          <p className="font-mono text-xs text-crimson mt-10">{error}</p>
        ) : !dealt ? (
          <p className="font-mono text-xs text-paper/50 mt-10">Shuffling the deck…</p>
        ) : (
          <ul className="grid grid-cols-2 md:grid-cols-3 gap-6 mt-8">
            {dealt.map((d, i) => (
              <li key={d.player}>
                <button
                  type="button"
                  onClick={() => reveal(i)}
                  className="group relative block w-full text-left perspective-[1200px]"
                  aria-pressed={d.revealed}
                >
                  <div
                    className={`relative aspect-[3/4] transition-transform duration-700 [transform-style:preserve-3d] ${
                      d.revealed ? "[transform:rotateY(180deg)]" : ""
                    }`}
                  >
                    {/* Back of envelope */}
                    <div className="absolute inset-0 [backface-visibility:hidden] border border-paper/20 bg-[oklch(0.18_0.02_60)] flex flex-col items-center justify-center p-4 shadow-[0_18px_40px_-10px_oklch(0_0_0/0.8)]">
                      <span className="font-display text-5xl text-crimson">M</span>
                      <span className="mt-3 font-mono text-[10px] uppercase tracking-[0.3em] text-paper/50 text-center">
                        Sealed
                      </span>
                      <span className="mt-1 font-serif italic text-xs text-paper/40">tap to break</span>
                      <span className="absolute inset-x-6 bottom-6 h-px bg-crimson/40" />
                    </div>

                    {/* Front: role reveal */}
                    <div
                      className={`absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)] paper-tex border p-4 flex flex-col ${
                        ROLE_COLOR[d.role] ?? ROLE_COLOR.Citizen
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <img
                          src={d.persona?.portrait ?? "/static/personalities/default.jpg"}
                          alt={d.personalityName}
                          className="h-16 w-16 object-cover grayscale-[0.4] border border-ink/30"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).src = "/static/personalities/default.jpg";
                          }}
                        />
                        <div className="text-ink">
                          <p className="font-display text-sm leading-tight">
                            {(d.persona?.name ?? d.personalityName).toUpperCase()}
                          </p>
                          <p className="font-serif italic text-[11px] text-ink/70">
                            {d.persona?.alias ? `"${d.persona.alias}"` : d.player}
                          </p>
                        </div>
                      </div>

                      <div className="mt-auto">
                        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-ink/60">
                          Assigned Role
                        </p>
                        <p className={`font-display text-2xl mt-1 ${(ROLE_COLOR[d.role] ?? ROLE_COLOR.Citizen).split(" ")[0]}`}>
                          {d.role.toUpperCase()}
                        </p>
                        <p className="font-mono text-[10px] mt-2 text-ink/70 leading-snug">
                          {ROLE_NOTES[d.role] ?? ""}
                        </p>
                      </div>
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-12 flex flex-wrap items-center justify-between gap-4">
          <button
            onClick={revealAll}
            className="font-display text-xs sm:text-sm tracking-[0.3em] uppercase px-5 py-3 border border-paper/30 text-paper hover:bg-paper/10"
          >
            ▸ Break All Seals
          </button>

          <div className="flex items-center gap-4">
            <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-paper/50 hidden sm:inline">
              {allRevealed ? "Night falls. The first move belongs to the Mafia." : "Some envelopes remain sealed."}
            </span>
            <button
              onClick={beginNight}
              disabled={!allRevealed}
              className={`font-display text-xs sm:text-sm tracking-[0.3em] uppercase px-5 py-3 transition ${
                allRevealed
                  ? "bg-crimson text-paper hover:bg-crimson-deep animate-pulse"
                  : "bg-secondary text-paper/40 cursor-not-allowed"
              }`}
            >
              ▸ Let Night Fall
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
