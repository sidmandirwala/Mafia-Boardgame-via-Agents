import heroBg from "@/assets/hero-noir.jpg";
import { useEffect, useState } from "react";

export function HeroCase({ onOpen }: { onOpen: () => void }) {
  // Render time client-side only to avoid SSR hydration mismatch across locales/timezones.
  const [time, setTime] = useState<string>("--:--");
  useEffect(() => {
    const tick = () =>
      setTime(
        new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      );
    tick();
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <section className="relative overflow-hidden border-b border-border">
      <img
        src={heroBg}
        alt=""
        className="absolute inset-0 h-full w-full object-cover opacity-50"
        width={1920}
        height={1080}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-ink/70 via-ink/60 to-ink" />

      <div className="relative mx-auto max-w-6xl px-6 py-20 md:py-28">
        {/* Chrome row */}
        <div className="flex flex-wrap items-center justify-between gap-4 font-mono text-[11px] uppercase tracking-[0.3em] text-paper/60">
          <span>Case File №&nbsp;1947 / B-13</span>
          <span className="flex items-center gap-4">
            <span>☎ Precinct 7</span>
            <span>◷ {time}</span>
            <span>☂ Rain · 47°F</span>
          </span>
        </div>

        <div className="mt-12 max-w-3xl">
          <p className="font-serif italic text-brass/80 text-sm md:text-base">
            — a dossier in six suspects —
          </p>
          <h1 className="mt-3 font-display text-5xl md:text-7xl lg:text-8xl leading-[0.95] text-paper">
            The{" "}
            <span className="flicker text-crimson" style={{ fontFamily: "var(--font-display)" }}>
              MAFIA
            </span>
            <br />
            Dossier
          </h1>
          <p className="mt-6 max-w-xl font-serif text-lg md:text-xl text-paper/80 italic">
            "Six suspects. One city. One of them is lying through their teeth.
            Watch the AI play it out — or stack the deck yourself."
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-4">
            <button
              onClick={onOpen}
              className="group relative inline-flex items-center gap-3 bg-crimson px-7 py-4 font-display text-sm tracking-[0.3em] uppercase text-paper transition hover:bg-crimson-deep"
            >
              <span className="absolute -inset-px border border-crimson/60 translate-x-1 translate-y-1 transition group-hover:translate-x-2 group-hover:translate-y-2" />
              <span className="relative">▸ Open the Case</span>
            </button>
            <a
              href="#how-to-play"
              className="font-mono text-xs uppercase tracking-[0.3em] text-paper/60 hover:text-brass border-b border-transparent hover:border-brass pb-1 transition"
            >
              How to play
            </a>
          </div>

          {/* Stamps */}
          <div className="mt-12 flex flex-wrap gap-4 text-[10px] font-display tracking-[0.3em] uppercase">
            <span className="border-2 border-crimson/70 text-crimson/80 px-3 py-1 -rotate-3">
              Classified
            </span>
            <span className="border-2 border-brass/60 text-brass/80 px-3 py-1 rotate-2">
              Confidential
            </span>
            <span className="border-2 border-paper/40 text-paper/60 px-3 py-1 -rotate-1">
              For Internal Use
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}