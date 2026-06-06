export function FilmGrain() {
  return (
    <>
      {/* Grain layer */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-[60] opacity-[0.18] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.05  0 0 0 0 0.05  0 0 0 0 0.05  0 0 0 0.9 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")",
          backgroundSize: "220px 220px",
          animation: "grain-shift 1.2s steps(6) infinite",
        }}
      />
      {/* Vignette */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-[55]"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 40%, oklch(0.08 0.01 60 / 0.7) 100%)",
        }}
      />
      {/* Scanline (subtle) */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-[58] opacity-[0.08]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent 0 2px, oklch(0 0 0) 2px 3px)",
        }}
      />
    </>
  );
}