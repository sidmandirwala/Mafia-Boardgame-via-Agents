import { useState } from "react";
import type { Personality, TraitKey } from "@/data/personalities";
import { TRAIT_LABELS } from "@/data/personalities";

type Props = {
  onCreate: (p: Personality) => void;
};

const DEFAULT_TRAITS: Record<TraitKey, number> = {
  truthfulness: 3,
  aggressiveness: 3,
  suspicion: 3,
  persuasiveness: 3,
  loyalty: 3,
};

export function PersonalityForge({ onCreate }: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [alias, setAlias] = useState("");
  const [bio, setBio] = useState("");
  const [traits, setTraits] = useState(DEFAULT_TRAITS);

  const submit = () => {
    if (!name.trim()) return;
    onCreate({
      id: name.trim(), // backend uses this as the personality name
      name: name.trim(),
      alias: alias.trim() || "Unknown",
      bio: bio.trim() || "No record on file.",
      portrait: "/static/personalities/default.jpg",
      traits,
    });
    setName("");
    setAlias("");
    setBio("");
    setTraits(DEFAULT_TRAITS);
  };

  return (
    <section className="border border-border bg-secondary/60 backdrop-blur-sm">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-6 py-4 font-display text-sm tracking-[0.3em] uppercase text-paper hover:bg-secondary"
      >
        <span className="flex items-center gap-3">
          <span className="text-crimson">✚</span> Build a Suspect from Scratch
        </span>
        <span className="text-brass">{open ? "—" : "+"}</span>
      </button>

      {open && (
        <div className="grid md:grid-cols-2 gap-8 p-6 border-t border-border">
          {/* Left: identity */}
          <div className="space-y-4">
            <Field label="Full Name" value={name} onChange={setName} placeholder="e.g. Frank Carbone" />
            <Field label="Alias" value={alias} onChange={setAlias} placeholder="e.g. The Whisper" />
            <div>
              <label className="font-mono text-[10px] uppercase tracking-[0.3em] text-paper/60">
                Known History
              </label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={3}
                placeholder="What's on their record?"
                className="mt-2 w-full bg-ink/60 border border-border px-3 py-2 font-mono text-sm text-paper placeholder:text-paper/30 focus:outline-none focus:border-crimson"
              />
            </div>
          </div>

          {/* Right: traits */}
          <div className="space-y-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-paper/60">
              Psychological Profile
            </p>
            {(Object.keys(traits) as TraitKey[]).map((k) => (
              <div key={k}>
                <div className="flex justify-between items-center font-mono text-xs text-paper/80">
                  <span>{TRAIT_LABELS[k]}</span>
                  <span className="text-crimson">{traits[k]}/5</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={5}
                  value={traits[k]}
                  onChange={(e) =>
                    setTraits({ ...traits, [k]: Number(e.target.value) })
                  }
                  className="w-full accent-crimson"
                />
              </div>
            ))}

            <button
              onClick={submit}
              disabled={!name.trim()}
              className="w-full bg-brass text-ink font-display tracking-[0.3em] uppercase text-xs py-3 hover:bg-brass/80 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ▸ File this Suspect
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="font-mono text-[10px] uppercase tracking-[0.3em] text-paper/60">
        {label}
      </label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-2 w-full bg-ink/60 border border-border px-3 py-2 font-mono text-sm text-paper placeholder:text-paper/30 focus:outline-none focus:border-crimson"
      />
    </div>
  );
}