import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { FilmGrain } from "@/components/mafia/FilmGrain";
import { RedString } from "@/components/mafia/RedString";
import { PERSONALITIES, type Personality } from "@/data/personalities";
import { api, loadGameId, type GameStateResp } from "@/lib/api";

export const Route = createFileRoute("/game-over")({
  head: () => ({
    meta: [
      { title: "Case Closed — The Mafia Dossier" },
      { name: "description", content: "The case is closed. The dossier is sealed." },
    ],
  }),
  component: GameOverPage,
});

const winnerLabel = (w: string | null) =>
  w === "Good" ? "Town" : w === "Evil" ? "Mafia" : (w ?? "");

function personaFor(name: string): Personality | null {
  return PERSONALITIES.find((x) => x.id === name) ?? null;
}

function GameOverPage() {
  const navigate = useNavigate();
  const [gs, setGs] = useState<GameStateResp | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const id = loadGameId();
    if (!id) {
      navigate({ to: "/" });
      return;
    }
    api.gameState(id).then(setGs).catch((e) => setError(e?.message || "No case loaded."));
  }, []);

  const newCase = () => {
    try {
      sessionStorage.removeItem("mafia:gameId");
    } catch { /* ignore */ }
    navigate({ to: "/" });
  };

  const winner = winnerLabel(gs?.winner ?? null);

  return (
    <div className="min-h-screen bg-ink text-paper relative overflow-hidden">
      <FilmGrain />

      <header className="relative mx-auto max-w-6xl px-6 pt-10 pb-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-paper/50">
          Case File · Sealed · Stamped
        </p>
        <h1 className="mt-8 font-display text-6xl md:text-8xl leading-[1.0]">
          {winner === "Mafia" ? (
            <>The <span className="text-crimson">Mafia</span> Wins.</>
          ) : (
            <>The <span className="text-brass">Town</span> Holds.</>
          )}
        </h1>
        <p className="font-serif italic text-paper/70 mt-4 max-w-2xl">
          {winner === "Mafia"
            ? "The shadows swallowed this town whole. The wrong names ended up on the wall."
            : "Every last killer is in the ground. The lamps will burn a little longer tonight."}
        </p>
      </header>

      <RedString label="Final Dossier" />

      <main className="relative mx-auto max-w-5xl px-6 pb-32">
        {error ? (
          <p className="font-mono text-xs text-crimson mt-10">{error}</p>
        ) : !gs ? (
          <p className="font-mono text-xs text-paper/50 mt-10">Sealing the file…</p>
        ) : (
          <ul className="grid grid-cols-2 md:grid-cols-3 gap-6 mt-10">
            {gs.players.map((p) => {
              const persona = personaFor(p.personality);
              const role = p.role || "Citizen";
              const tone =
                role === "Mafia" || role === "Bad Guy"
                  ? "border-crimson text-crimson"
                  : role === "Detective"
                    ? "border-brass text-brass"
                    : role === "Doctor"
                      ? "border-paper text-paper"
                      : "border-paper/40 text-paper/60";
              return (
                <li
                  key={p.name}
                  className={`paper-tex border ${tone} bg-[oklch(0.16_0.02_60)] p-4 ${p.alive ? "" : "opacity-60"}`}
                >
                  <div className="flex items-start gap-3">
                    <img
                      src={persona?.portrait ?? "/static/personalities/default.jpg"}
                      alt=""
                      className={`h-16 w-16 object-cover border border-paper/20 ${p.alive ? "" : "grayscale"}`}
                      onError={(e) => { (e.currentTarget as HTMLImageElement).src = "/static/personalities/default.jpg"; }}
                    />
                    <div className="text-paper min-w-0">
                      <p className="font-display text-sm leading-tight">{(persona?.name ?? p.personality).toUpperCase()}</p>
                      <p className="font-serif italic text-[11px] text-paper/70 truncate">{p.name}</p>
                    </div>
                  </div>
                  <div className="mt-4">
                    <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-paper/40">True Role</p>
                    <p className={`font-display text-xl mt-1 ${tone.split(" ")[1]}`}>{role.toUpperCase()}</p>
                    <p className="font-mono text-[10px] mt-2 text-paper/60">
                      {p.alive ? "✓ Survived" : "✕ Did not make it"}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <div className="mt-12 flex justify-center">
          <button
            onClick={newCase}
            className="font-display text-sm tracking-[0.3em] uppercase px-6 py-3 bg-crimson text-paper hover:bg-crimson-deep"
          >
            ▸ Open a New Case
          </button>
        </div>
      </main>
    </div>
  );
}
