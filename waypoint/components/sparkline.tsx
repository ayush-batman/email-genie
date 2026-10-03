export function Sparkline({ values, className = "h-10 w-full" }: { values: number[]; className?: string }) {
  if (values.length < 2) return <div className={className} />;
  const max = Math.max(1, ...values);
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * 100},${30 - (v / max) * 26}`);
  return (
    <svg viewBox="0 0 100 32" preserveAspectRatio="none" className={className} aria-hidden>
      <path d={`M${pts.join("L")}L100,32L0,32Z`} fill="var(--accent)" fillOpacity={0.1} />
      <path d={`M${pts.join("L")}`} fill="none" stroke="var(--accent)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  );
}
