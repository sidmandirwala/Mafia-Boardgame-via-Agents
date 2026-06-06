export function RedString({ label }: { label?: string }) {
  return (
    <div className="relative flex items-center gap-4 py-6" aria-hidden={!label}>
      <span className="h-px flex-1 bg-gradient-to-r from-transparent via-crimson to-crimson" />
      {label && (
        <span className="font-display text-xs tracking-[0.4em] uppercase text-crimson">
          {label}
        </span>
      )}
      <span className="h-px flex-1 bg-gradient-to-l from-transparent via-crimson to-crimson" />
    </div>
  );
}