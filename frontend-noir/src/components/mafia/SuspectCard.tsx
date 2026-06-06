import type { Personality } from "@/data/personalities";
import { TRAIT_LABELS } from "@/data/personalities";

type Props = {
  suspect: Personality;
  selected: boolean;
  disabled: boolean;
  onToggle: () => void;
  tilt: number;
};

export function SuspectCard({ suspect, selected, disabled, onToggle, tilt }: Props) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled && !selected}
      style={{ transform: `rotate(${tilt}deg)` }}
      className={`group relative block text-left transition-all duration-300 will-change-transform hover:!rotate-0 hover:-translate-y-2 disabled:opacity-40 disabled:cursor-not-allowed ${
        selected ? "!rotate-0 -translate-y-1" : ""
      }`}
      aria-pressed={selected}
    >
      <div
        className={`paper-tex relative w-full p-3 pb-4 shadow-[0_18px_40px_-10px_oklch(0_0_0/0.7)] border ${
          selected ? "border-crimson" : "border-paper/20"
        }`}
      >
        {/* Tape */}
        <span
          aria-hidden
          className="absolute -top-3 left-1/2 -translate-x-1/2 h-5 w-16 bg-brass/40 rotate-1 shadow-sm"
        />

        {/* Mugshot */}
        <div className="relative aspect-[4/5] overflow-hidden bg-ink">
          <img
            src={suspect.portrait}
            alt={`Mugshot of ${suspect.name}`}
            loading="lazy"
            width={512}
            height={640}
            className="h-full w-full object-cover grayscale-[0.3] contrast-[1.05]"
          />
          {/* corner crops */}
          <span className="absolute top-1 left-1 h-3 w-3 border-l-2 border-t-2 border-ink/60" />
          <span className="absolute top-1 right-1 h-3 w-3 border-r-2 border-t-2 border-ink/60" />
          <span className="absolute bottom-1 left-1 h-3 w-3 border-l-2 border-b-2 border-ink/60" />
          <span className="absolute bottom-1 right-1 h-3 w-3 border-r-2 border-b-2 border-ink/60" />

          {/* Case # */}
          <span className="absolute bottom-2 left-2 font-mono text-[10px] tracking-widest text-paper bg-ink/70 px-1.5 py-0.5">
            #{suspect.id.toUpperCase()}-47
          </span>

          {/* SELECTED stamp */}
          {selected && (
            <span className="stamp-in absolute top-4 right-2 border-[3px] border-crimson text-crimson font-display text-xl tracking-[0.2em] px-2 py-1 bg-paper/10">
              SELECTED
            </span>
          )}
        </div>

        {/* Dossier text */}
        <div className="mt-3 text-ink">
          <p className="font-display text-base leading-tight">{suspect.name.toUpperCase()}</p>
          <p className="font-serif italic text-xs text-ink/70 mt-0.5">
            a.k.a. "{suspect.alias}"
          </p>
          <p className="font-mono text-[10px] mt-2 text-ink/70 leading-snug line-clamp-2">
            {suspect.bio}
          </p>

          {/* Trait bars */}
          <ul className="mt-3 space-y-1">
            {(Object.keys(suspect.traits) as Array<keyof typeof suspect.traits>).map((k) => (
              <li key={k} className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-widest text-ink/70">
                <span className="w-16">{TRAIT_LABELS[k]}</span>
                <span className="flex gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <span
                      key={i}
                      className={`h-1.5 w-3 ${
                        i < suspect.traits[k] ? "bg-ink" : "bg-ink/15"
                      }`}
                    />
                  ))}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </button>
  );
}