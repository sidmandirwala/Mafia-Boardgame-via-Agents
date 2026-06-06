import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { FilmGrain } from "@/components/mafia/FilmGrain";
import { RedString } from "@/components/mafia/RedString";
import { PERSONALITIES, type Personality } from "@/data/personalities";
import { api, loadGameId, audioUrl } from "@/lib/api";

export const Route = createFileRoute("/discussion")({
  head: () => ({
    meta: [
      { title: "The Round Table — The Mafia Dossier" },
      { name: "description", content: "The suspects speak. Lies dressed as truth." },
    ],
  }),
  component: DiscussionPage,
});

type Line = {
  player: string;
  persona: Personality | null;
  text: string;
  round: number;
  audioUrl: string | null; // resolved full URL, or null
  hasMeta: boolean;        // backend voice step finished for this line
};

function DiscussionPage() {
  const navigate = useNavigate();
  const [lines, setLines] = useState<Line[]>([]);
  const [inProgress, setInProgress] = useState(true);
  const [round, setRound] = useState(1);
  const [error, setError] = useState<string | null>(null);
  // Indices whose audio has actually started playing -> their text may show.
  const [playedIdx, setPlayedIdx] = useState<Set<number>>(() => new Set());
  const [tick, setTick] = useState(0); // drives the reveal fallback timer

  const personaMap = useRef<Record<string, Personality | null>>({});
  const startedRef = useRef(false);
  const pollRef = useRef<number | null>(null);
  const firstSeen = useRef<Record<number, number>>({});

  // Sequential audio; reveal a line's text on the audio's `playing` event.
  const audioQueue = useRef<{ url: string; idx: number }[]>([]);
  const enqueued = useRef<Set<string>>(new Set());
  const playingRef = useRef(false);
  const audioEl = useRef<HTMLAudioElement | null>(null);

  const reveal = (idx: number) =>
    setPlayedIdx((prev) => { const s = new Set(prev); s.add(idx); return s; });

  const playNext = () => {
    if (playingRef.current) return;
    const item = audioQueue.current.shift();
    if (!item) return;
    playingRef.current = true;
    const el = audioEl.current || (audioEl.current = new Audio());
    el.src = item.url;
    el.onplaying = () => reveal(item.idx);                 // text appears WITH the voice
    el.onended = el.onerror = () => { playingRef.current = false; playNext(); };
    const p = el.play();
    if (p && p.catch) p.catch(() => { reveal(item.idx); playingRef.current = false; playNext(); });
  };
  const enqueueAudio = (url: string | null, idx: number) => {
    if (!url || enqueued.current.has(url)) return;
    enqueued.current.add(url);
    audioQueue.current.push({ url, idx });
    playNext();
  };

  const renamePlayers = (text: string) =>
    text.replace(/Player_\d+/g, (m) => personaMap.current[m]?.name ?? m);

  useEffect(() => {
    const id = loadGameId();
    if (!id) { navigate({ to: "/" }); return; }
    if (startedRef.current) return;
    startedRef.current = true;

    (async () => {
      try {
        const gs = await api.gameState(id);
        setRound(gs.round);
        const map: Record<string, Personality | null> = {};
        gs.players.forEach((p) => { map[p.name] = PERSONALITIES.find((x) => x.id === p.personality) ?? null; });
        personaMap.current = map;

        await api.startDiscussion(id);
        await api.simulateDiscussion(id);

        const poll = async () => {
          try {
            const st = await api.discussionStatus(id);
            const parsed: Line[] = [];
            let curRound = 1;
            st.discussion.forEach((raw, i) => {
              if (!raw || raw === "WAITING_FOR_HUMAN_INPUT") return;
              if (raw.startsWith("---")) {
                const m = raw.match(/Round (\d+)/);
                if (m) curRound = parseInt(m[1]);
                return;
              }
              const ci = raw.indexOf(":");
              if (ci <= 0) return;
              const label = raw.slice(0, ci).trim();
              const text = renamePlayers(raw.slice(ci + 1).trim());
              const persona = PERSONALITIES.find((x) => x.id === label) ?? personaMap.current[label] ?? null;
              const meta = st.meta?.[i] ?? null;
              const idx = parsed.length; // spoken-line index
              if (firstSeen.current[idx] === undefined) firstSeen.current[idx] = Date.now();
              if (meta?.audio_url) enqueueAudio(audioUrl(meta.audio_url), idx);
              parsed.push({ player: label, persona, text, round: curRound, audioUrl: audioUrl(meta?.audio_url ?? null), hasMeta: meta != null });
            });
            setLines(parsed);
            if (!st.in_progress) {
              setInProgress(false);
              if (pollRef.current) window.clearInterval(pollRef.current);
            }
          } catch { /* transient */ }
        };
        await poll();
        pollRef.current = window.setInterval(poll, 1200);
      } catch (e: any) {
        setError(e?.message || "The table fell silent (backend error).");
      }
    })();

    return () => { if (pollRef.current) window.clearInterval(pollRef.current); };
  }, []);

  // Re-evaluate reveal periodically (fallback timer).
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 600);
    return () => clearInterval(t);
  }, []);

  // How many leading lines to show: a line appears once its voice starts. Lines
  // with no audio (or whose voice is slow >6s) fall back so nothing gets stuck.
  const now = Date.now();
  let revealCount = 0;
  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i];
    const waited = now - (firstSeen.current[i] || now) > 6000;
    if (!ln.hasMeta) { if (waited) { revealCount++; continue; } break; }        // voice synthesizing
    if (ln.audioUrl && !playedIdx.has(i)) { if (waited) { revealCount++; continue; } break; } // not yet spoken
    revealCount++;
  }
  void tick;
  const shown = lines.slice(0, revealCount);
  const stillTalking = inProgress || revealCount < lines.length;

  return (
    <div className="min-h-screen bg-ink text-paper relative overflow-hidden">
      <FilmGrain />

      <header className="relative mx-auto max-w-6xl px-6 pt-10 pb-2">
        <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.3em] text-paper/50">
          <Link to="/night" className="hover:text-crimson">← back to night</Link>
          <span>Day · {round} · 09:00 AM</span>
        </div>
        <h1 className="mt-10 font-display text-5xl md:text-7xl leading-[1.05]">
          The Round <span className="text-crimson">Table</span>
        </h1>
        <p className="font-serif italic text-paper/70 mt-3 max-w-2xl">
          Cigarettes burn down. Voices rise. Every word is a coin tossed on the table — and somebody's lying.
        </p>
      </header>

      <RedString label="Discussion" />

      <main className="relative mx-auto max-w-4xl px-6 pb-32">
        {error && (
          <div className="mt-12 border border-crimson/60 bg-crimson/10 p-5 font-mono text-xs">
            <p className="uppercase tracking-[0.3em] text-crimson mb-2">Static on the wire</p>
            <p className="text-paper/80">{error}</p>
          </div>
        )}

        {!error && shown.length === 0 && (
          <div className="mt-12 flex items-center gap-4 font-mono text-xs uppercase tracking-[0.3em] text-paper/60">
            <span className="inline-block h-3 w-3 rounded-full bg-crimson animate-ping" />
            <span>Gathering the suspects at the table…</span>
          </div>
        )}

        {shown.length > 0 && (
          <div className="mt-10 space-y-4">
            {shown.map((line, i) => (
              <ChatLine key={`${line.player}-${i}`} line={line} />
            ))}

            {stillTalking && (
              <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.3em] text-paper/40 pl-[4.5rem]">
                <span className="inline-block h-2 w-2 rounded-full bg-crimson animate-ping" />
                someone is talking…
              </div>
            )}

            {!stillTalking && (
              <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-paper/15 pt-6">
                <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-paper/50">
                  The talking's over. Ballots are on the table.
                </span>
                <button
                  onClick={() => navigate({ to: "/vote" })}
                  className="font-display text-xs tracking-[0.3em] uppercase px-5 py-3 bg-crimson text-paper hover:bg-crimson-deep animate-pulse"
                >
                  ▸ Call the Vote
                </button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function ChatLine({ line }: { line: Line }) {
  const label = (line.persona?.name ?? line.player).toUpperCase();
  return (
    <article className="flex gap-4 animate-[fadeIn_0.4s_ease]">
      {line.persona?.portrait ? (
        <img
          src={line.persona.portrait}
          alt={label}
          className="h-14 w-14 object-cover grayscale-[0.55] border border-paper/20 flex-shrink-0"
          onError={(e) => { (e.currentTarget as HTMLImageElement).src = "/static/personalities/default.jpg"; }}
        />
      ) : (
        <div className="h-14 w-14 border border-paper/20 bg-[oklch(0.18_0.02_60)] flex-shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-3 mb-1">
          <span className="font-display text-sm tracking-[0.2em] text-paper">{label}</span>
          <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-paper/40">Round {line.round}</span>
        </div>
        <p className="font-serif italic text-paper/85 text-base leading-snug">"{line.text}"</p>
      </div>
      <style>{`@keyframes fadeIn { from { opacity:0; transform: translateY(4px) } to { opacity:1; transform:none } }`}</style>
    </article>
  );
}
