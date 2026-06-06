import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { FilmGrain } from "@/components/mafia/FilmGrain";
import { RedString } from "@/components/mafia/RedString";
import { PERSONALITIES } from "@/data/personalities";
import { api, loadGameId, type GameStateResp } from "@/lib/api";

export const Route = createFileRoute("/night")({
  head: () => ({
    meta: [
      { title: "Night Falls — The Mafia Dossier" },
      { name: "description", content: "The Mafia, Detective, and Doctor make their secret moves." },
    ],
  }),
  component: NightPage,
});

type Dawn = {
  killed_player: string | null;
  doctor_success: boolean;
  detective_success: boolean;
};

function personaFor(name: string | null, gs: GameStateResp | null) {
  if (!name || !gs) return null;
  const pl = gs.players.find((p) => p.name === name);
  if (!pl) return null;
  return PERSONALITIES.find((x) => x.id === pl.personality) ?? null;
}

function NightPage() {
  const navigate = useNavigate();
  const [gs, setGs] = useState<GameStateResp | null>(null);
  const [dawn, setDawn] = useState<Dawn | null>(null);
  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    const id = loadGameId();
    if (!id) {
      navigate({ to: "/" });
      return;
    }
    if (startedRef.current) return;
    startedRef.current = true;
    (async () => {
      try {
        await api.processNight(id);            // mafia/detective/doctor decide (K2)
        const r = await api.resolveNight(id);  // dawn outcome
        const state = await api.gameState(id);
        setGs(state);
        if (state.game_over) {
          navigate({ to: "/game-over" });
          return;
        }
        setDawn(r.results as Dawn);
      } catch (e: any) {
        setError(e?.message || "The night went wrong.");
      }
    })();
  }, []);

  const killedPersona = personaFor(dawn?.killed_player ?? null, gs);
  const round = gs?.round ?? 1;

  return (
    <div className="min-h-screen bg-[oklch(0.10_0.01_60)] text-paper relative overflow-hidden">
      <FilmGrain />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 right-[-10%] w-[420px] h-[420px] rounded-full bg-[radial-gradient(circle_at_30%_30%,oklch(0.95_0.04_75)_0%,oklch(0.78_0.05_75)_45%,transparent_70%)] opacity-50 blur-[2px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.06] mix-blend-screen"
        style={{ backgroundImage: "repeating-linear-gradient(115deg, transparent 0 6px, oklch(0.92 0.03 75) 6px 7px)" }}
      />

      <header className="relative mx-auto max-w-6xl px-6 pt-10 pb-2">
        <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.3em] text-paper/50">
          <Link to="/case" className="hover:text-crimson">← back to envelopes</Link>
          <span>Night · {round} · 02:47 AM</span>
        </div>
        <h1 className="mt-10 font-display text-5xl md:text-7xl leading-[1.05]">
          The City <span className="text-crimson">Sleeps</span>
        </h1>
        <p className="font-serif italic text-paper/70 mt-3 max-w-2xl">
          Three doors open in the dark. Three hands make their move. By morning, somebody won't be there.
        </p>
      </header>

      <RedString label="Night Actions" />

      <main className="relative mx-auto max-w-6xl px-6 pb-32">
        {error && (
          <div className="mt-12 border border-crimson/60 bg-crimson/10 p-5 font-mono text-xs text-paper">
            <p className="uppercase tracking-[0.3em] text-crimson mb-2">Case file corrupted</p>
            <p className="text-paper/80">{error}</p>
          </div>
        )}

        {!dawn && !error && (
          <div className="mt-12 flex items-center gap-4 font-mono text-xs uppercase tracking-[0.3em] text-paper/60">
            <span className="inline-block h-3 w-3 rounded-full bg-crimson animate-ping" />
            <span>Listening at the keyhole… the agents are deciding. (this takes a moment)</span>
          </div>
        )}

        {dawn && (
          <section className="mt-10 border border-brass/40 bg-[oklch(0.16_0.02_60)] p-6 animate-[fadeIn_0.6s_ease]">
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-brass">◷ 06:14 AM · Dawn Report</p>
            <h2 className="font-display text-3xl md:text-4xl mt-2">
              {dawn.killed_player ? (
                <>A Body in the <span className="text-crimson">Street</span></>
              ) : (
                <>The City <span className="text-brass">Holds</span></>
              )}
            </h2>

            {dawn.killed_player ? (
              <div className="mt-5 flex items-center gap-4">
                <img
                  src={killedPersona?.portrait ?? "/static/personalities/default.jpg"}
                  alt=""
                  className="h-20 w-20 object-cover grayscale border border-crimson/40"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).src = "/static/personalities/default.jpg"; }}
                />
                <p className="font-serif italic text-lg text-paper/85">
                  <span className="text-paper">{killedPersona?.name ?? dawn.killed_player}</span>{" "}
                  was found dead in the alley behind Marino's.
                </p>
              </div>
            ) : (
              <p className="mt-4 font-serif italic text-lg text-paper/80">
                {dawn.doctor_success
                  ? "The Doctor's hand stayed the blade. No one died tonight."
                  : "Quiet streets. No body this morning."}
              </p>
            )}

            <p className="mt-4 font-mono text-sm text-paper/70 border-l-2 border-brass/60 pl-3">
              {dawn.detective_success
                ? "Word is the Detective's trail led straight to the family."
                : "The Detective worked the night — the trail ran cold."}
            </p>

            <div className="mt-6">
              <button
                onClick={() => navigate({ to: "/discussion" })}
                className="font-display text-xs tracking-[0.3em] uppercase px-4 py-3 bg-crimson text-paper hover:bg-crimson-deep animate-pulse"
              >
                ▸ Take it to the Streets
              </button>
            </div>
          </section>
        )}
      </main>

      <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: none } }`}</style>
    </div>
  );
}
