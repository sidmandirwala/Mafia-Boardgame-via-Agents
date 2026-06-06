import type { Personality } from "@/data/personalities";
import { MAX_SELECTED } from "@/data/personalities";
import { SuspectCard } from "./SuspectCard";

type Props = {
  suspects: Personality[];
  selected: Set<string>;
  onToggle: (id: string) => void;
};

const TILTS = [-2.5, 1.5, -1, 2, -2, 1, -1.5, 2.5, -1];

export function SuspectGrid({ suspects, selected, onToggle }: Props) {
  const reachedMax = selected.size >= MAX_SELECTED;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 md:gap-10">
      {suspects.map((s, i) => (
        <SuspectCard
          key={s.id}
          suspect={s}
          selected={selected.has(s.id)}
          disabled={reachedMax}
          onToggle={() => onToggle(s.id)}
          tilt={TILTS[i % TILTS.length]}
        />
      ))}
    </div>
  );
}