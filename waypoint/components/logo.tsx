export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-semibold tracking-tight ${className}`}>
      <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden>
        <rect width="24" height="24" rx="7" fill="var(--accent)" />
        <path d="M6 15.5 10 9l3.5 5L18 7" fill="none" stroke="var(--accent-fg)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Waypoint
    </span>
  );
}
