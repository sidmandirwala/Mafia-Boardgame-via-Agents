import { MAX_SELECTED } from "@/data/personalities";

export function SelectionBar({ count, onDeal }: { count: number; onDeal: () => void }) {
  const ready = count === MAX_SELECTED;
  const remaining = MAX_SELECTED - count;
  return (
    <div className="sticky bottom-0 z-40 border-t-2 border-crimson/60 bg-ink/95 backdrop-blur shadow-[0_-12px_30px_-10px_oklch(0_0_0/0.8)]">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-3 sm:py-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="flex gap-1">
            {Array.from({ length: MAX_SELECTED }).map((_, i) => (
              <span
                key={i}
                className={`h-2 w-5 sm:w-8 transition ${
                  i < count ? "bg-crimson" : "bg-paper/15 border border-paper/20"
                }`}
              />
            ))}
          </div>
          <p className="font-mono text-[10px] sm:text-xs uppercase tracking-[0.2em] sm:tracking-[0.3em] text-paper/60">
            <span className="text-paper text-base font-display">{count}</span>
            <span className="text-paper/40"> / {MAX_SELECTED}</span>
            <span className="hidden sm:inline"> in custody</span>
          </p>
        </div>

        <button
          onClick={onDeal}
          disabled={!ready}
          className={`group relative font-display text-xs sm:text-sm tracking-[0.2em] sm:tracking-[0.3em] uppercase px-4 sm:px-6 py-3 transition ${
            ready
              ? "bg-crimson text-paper hover:bg-crimson-deep animate-pulse"
              : "bg-secondary text-paper/40 cursor-not-allowed"
          }`}
        >
          {ready
            ? "▸ Deal the Cards"
            : count === 0
              ? "Pick 6 suspects"
              : `${remaining} more to go`}
        </button>
      </div>
    </div>
  );
}