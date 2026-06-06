import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { FilmGrain } from "@/components/mafia/FilmGrain";
import { RedString } from "@/components/mafia/RedString";
import { PERSONALITIES, type Personality } from "@/data/personalities";
import { api, loadGameId, type VotingResult } from "@/lib/api";

export const Route = createFileRoute("/vote")({
  head: () => ({
    meta: [
      { title: "The Verdict — The Mafia Dossier" },
      { name: "description", content: "Ballots are cast. Somebody walks out of town." },
    ],
  }),
  component: VotePage,
});

type Ballot = { voter: string; voterName: string; target: string; targetName: string };

const winnerLabel = (w: string | null) =>
  w === "Good" ? "Town" : w === "Evil" ? "Mafia" : w;

function VotePage() {
  const navigate = useNavigate();
  const [result, setResult] = useState<VotingResult | null>(null);
  const [ballots, setBallots] = useState<Ballot[]>([]);
  const [exiledName, setExiledName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [voteStep, setVoteStep] = useState(0);
  const [showExile, setShowExile] = useState(false);
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
        const gs = await api.gameState(id);
        const nameOf = (player: string) => {
          const pl = gs.players.find((p) => p.name === player);
          const persona: Personality | undefined = pl
            ? PERSONALITIES.find((x) => x.id === pl.personality)
            : undefined;
          return persona?.name ?? player;
        };

        const vr = await api.processVoting(id);
        const r = vr.results;
        setResult(r);
        setExiledName(r.exiled ? nameOf(r.exiled) : null);
        setBallots(
          Object.entries(r.votes || {}).map(([voter, target]) => ({
            voter,
            voterName: nameOf(voter),
            target,
            targetName: nameOf(target as string),
          })),
        );
      } catch (e: any) {
        setError(e?.message || "The vote was thrown out (backend error).");
      }
    })();
  }, []);

  // Stamp ballots one by one, then reveal the exile.
  useEffect(() => {
    if (!result) return;
    const total = ballots.length;
    const timers: number[] = [];
    for (let i = 1; i <= total; i++) timers.push(window.setTimeout(() => setVoteStep(i), i * 600));
    timers.push(window.setTimeout(() => setShowExile(true), total * 600 + 700));
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [result, ballots.length]);

  const proceed = () => {
    if (!result) return;
    navigate({ to: result.game_over ? "/game-over" : "/night" });
  };

  const tallyText = result
    ? Object.entries(result.tally)
        .map(([t, c]) => {
          const pl = ballots.find((b) => b.target === t);
          return `${pl?.targetName ?? t} ${c}`;
        })
        .join(" · ")
    : "";

  return (
    <div className="min-h-screen bg-ink text-paper relative overflow-hidden">
      <FilmGrain />

      <header className="relative mx-auto max-w-6xl px-6 pt-10 pb-2">
        <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.3em] text-paper/50">
          <Link to="/discussion" className="hover:text-crimson">← back to the table</Link>
          <span>Day · 11:47 AM</span>
        </div>
        <h1 className="mt-10 font-display text-5xl md:text-7xl leading-[1.05]">
          The <span className="text-crimson">Verdict</span>
        </h1>
        <p className="font-serif italic text-paper/70 mt-3 max-w-2xl">
          Folded paper. A pencil's scratch. One name at a time — somebody isn't sleeping in this town tonight.
        </p>
      </header>

      <RedString label="Ballots" />

      <main className="relative mx-auto max-w-4xl px-6 pb-32">
        {error && (
          <div className="mt-12 border border-crimson/60 bg-crimson/10 p-5 font-mono text-xs">
            <p className="uppercase tracking-[0.3em] text-crimson mb-2">Mistrial</p>
            <p className="text-paper/80">{error}</p>
          </div>
        )}

        {!result && !error && (
          <div className="mt-12 flex items-center gap-4 font-mono text-xs uppercase tracking-[0.3em] text-paper/60">
            <span className="inline-block h-3 w-3 rounded-full bg-crimson animate-ping" />
            <span>The suspects are weighing the evidence…</span>
          </div>
        )}

        {result && (
          <>
            <ul className="mt-10 grid gap-3">
              {ballots.map((v, i) => {
                const stamped = i < voteStep;
                return (
                  <li
                    key={i}
                    className={`paper-tex border border-paper/20 bg-[oklch(0.16_0.02_60)] p-4 flex items-center gap-4 transition-all duration-500 ${
                      stamped ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
                    }`}
                  >
                    <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-paper/40 w-6">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="font-display text-sm tracking-[0.2em] text-paper">
                      {v.voterName.toUpperCase()}
                    </span>
                    <span className="font-mono text-[10px] text-paper/40">votes</span>
                    <span className="font-display text-sm tracking-[0.2em] text-crimson">
                      {v.targetName.toUpperCase()}
                    </span>
                  </li>
                );
              })}
            </ul>

            {showExile && (
              <section className="mt-10 border-2 border-crimson bg-[oklch(0.16_0.02_60)] p-8 animate-[fadeIn_0.6s_ease] relative overflow-hidden">
                <div
                  aria-hidden
                  className="absolute -right-8 top-4 rotate-12 border-4 border-crimson/80 text-crimson font-display text-2xl tracking-[0.3em] px-4 py-1 select-none"
                >
                  CLASSIFIED
                </div>

                <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-crimson">Exile Order</p>
                {result.exiled ? (
                  <>
                    <h2 className="font-display text-4xl md:text-5xl mt-2">
                      {exiledName} <span className="text-paper/40">is</span> <span className="text-crimson">out</span>.
                    </h2>
                    <p className="font-serif italic text-paper/80 mt-3">
                      The town has spoken. Tally: {tallyText}.
                    </p>
                    <p className="mt-4 font-mono text-sm">
                      <span className="text-paper/50">True role: </span>
                      <span className={result.exiled_role === "Mafia" || result.exiled_role === "Bad Guy" ? "text-crimson" : "text-brass"}>
                        {result.exiled_role?.toUpperCase()}
                      </span>
                    </p>
                  </>
                ) : (
                  <>
                    <h2 className="font-display text-4xl md:text-5xl mt-2">A Tie.</h2>
                    <p className="font-serif italic text-paper/80 mt-3">
                      Nobody walks out of town tonight. The killer breathes easy.
                    </p>
                  </>
                )}

                {result.winner && (
                  <p className="mt-6 font-display text-lg tracking-[0.3em] text-brass">
                    ▸ The {winnerLabel(result.winner)} {result.winner === "Evil" ? "have" : "has"} won.
                  </p>
                )}

                <div className="mt-8">
                  <button
                    onClick={proceed}
                    className="font-display text-xs tracking-[0.3em] uppercase px-5 py-3 bg-crimson text-paper hover:bg-crimson-deep animate-pulse"
                  >
                    {result.game_over ? "▸ Close the Case" : "▸ The Night Returns"}
                  </button>
                </div>
              </section>
            )}
          </>
        )}

        <style>{`@keyframes fadeIn { from { opacity:0; transform: translateY(8px) } to { opacity:1; transform: none } }`}</style>
      </main>
    </div>
  );
}
