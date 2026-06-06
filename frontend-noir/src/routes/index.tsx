import { createFileRoute } from "@tanstack/react-router";
import { useNavigate } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { FilmGrain } from "@/components/mafia/FilmGrain";
import { HeroCase } from "@/components/mafia/HeroCase";
import { RedString } from "@/components/mafia/RedString";
import { SuspectGrid } from "@/components/mafia/SuspectGrid";
import { PersonalityForge } from "@/components/mafia/PersonalityForge";
import { SelectionBar } from "@/components/mafia/SelectionBar";
import { PERSONALITIES, MAX_SELECTED, type Personality } from "@/data/personalities";
import { api, saveGameId } from "@/lib/api";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "The Mafia Dossier — AI Agents Play Mafia" },
      {
        name: "description",
        content:
          "A noir social-deduction sandbox. Pick six AI suspects with distinct personalities and watch them lie, deduce, and vote each other out.",
      },
      { property: "og:title", content: "The Mafia Dossier — AI Agents Play Mafia" },
      {
        property: "og:description",
        content: "Six suspects. One city. One of them is lying. Stack the deck and press play.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const navigate = useNavigate();
  const [roster, setRoster] = useState<Personality[]>(PERSONALITIES);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dealing, setDealing] = useState(false);
  const [dealError, setDealError] = useState<string | null>(null);
  const rosterRef = useRef<HTMLDivElement>(null);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < MAX_SELECTED) {
        next.add(id);
      }
      return next;
    });
  };

  const scrollToRoster = () => {
    rosterRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleDeal = async () => {
    if (dealing) return;
    const ids = roster.filter((r) => selected.has(r.id)).map((r) => r.id);
    if (ids.length !== MAX_SELECTED) {
      setDealError(`Pick exactly ${MAX_SELECTED} suspects.`);
      return;
    }
    setDealing(true);
    setDealError(null);
    try {
      // Create the game on our backend with the chosen personalities, then assign roles.
      const { game_id } = await api.createGame(ids, false);
      saveGameId(game_id);
      await api.startGame(game_id);
      navigate({ to: "/case" });
    } catch (e: any) {
      setDealError(e?.message || "Couldn't reach the precinct (backend). Is it running on :5001?");
      setDealing(false);
    }
  };

  const count = selected.size;

  const sortedRoster = useMemo(() => roster, [roster]);

  return (
    <div className="min-h-screen bg-ink text-paper relative">
      <FilmGrain />

      <HeroCase onOpen={scrollToRoster} />

      <main className="relative mx-auto max-w-6xl px-6 py-16">
        <div ref={rosterRef} className="scroll-mt-6">
          <RedString label="The Lineup" />

          <div className="flex flex-wrap items-end justify-between gap-4 mt-2 mb-10">
            <div>
              <h2 className="font-display text-3xl md:text-4xl text-paper">
                Select Your Suspects
              </h2>
              <p className="font-serif italic text-paper/60 mt-1">
                Round up six. Make sure at least one of them has something to hide.
              </p>
            </div>
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-brass">
              [ {count}/{MAX_SELECTED} in custody ]
            </p>
          </div>

          <SuspectGrid
            suspects={sortedRoster}
            selected={selected}
            onToggle={toggle}
          />
        </div>

        <div className="mt-20">
          <RedString label="Forge a Suspect" />
          <PersonalityForge
            onCreate={(p) => setRoster((r) => [...r, p])}
          />
        </div>

        <section id="how-to-play" className="mt-20">
          <RedString label="How the Case Unfolds" />
          <ol className="grid md:grid-cols-3 gap-6 mt-6">
            {[
              { n: "01", t: "Night Falls", d: "Mafia, Detective, and Doctor make their secret moves under cover of dark." },
              { n: "02", t: "Dawn Breaks", d: "A body is found — or isn't. The town gathers to accuse, defend, and deduce." },
              { n: "03", t: "The Vote", d: "Six AIs reason out loud and exile a suspect. Repeat until truth or treachery wins." },
            ].map((s) => (
              <li key={s.n} className="border border-border p-6 bg-secondary/40">
                <p className="font-display text-crimson text-2xl">{s.n}</p>
                <p className="font-display text-lg mt-2">{s.t}</p>
                <p className="font-mono text-xs text-paper/60 mt-3 leading-relaxed">{s.d}</p>
              </li>
            ))}
          </ol>
        </section>

        <footer className="mt-20 pb-10 text-center font-mono text-[10px] uppercase tracking-[0.3em] text-paper/40">
          — End of File — Property of Precinct 7 —
        </footer>
      </main>

      {(dealError || dealing) && (
        <div className="fixed bottom-24 inset-x-0 z-50 flex justify-center px-6">
          <p className="font-mono text-xs px-4 py-2 border border-crimson/50 bg-ink/90 text-paper">
            {dealing ? "Opening the case file…" : dealError}
          </p>
        </div>
      )}

      <SelectionBar count={count} onDeal={handleDeal} />
    </div>
  );
}
