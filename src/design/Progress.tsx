/**
 * The one progress line: where you are. Label on the left, the bar, a label on the right ("Task 2 of 3").
 * value is 0 to 1.
 */
export function Progress({ label, value, end, className = "", ...rest }: { label: React.ReactNode; value: number; end?: React.ReactNode; className?: string } & Omit<React.HTMLAttributes<HTMLDivElement>, "className">) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <div className={`ds-progress ${className}`.trim()} {...rest}>
      <span>{label}</span>
      <div className="ds-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={typeof label === "string" ? `${label} progress` : "Progress"}>
        <i style={{ width: `${pct}%` }} />
      </div>
      {end !== undefined && <span>{end}</span>}
    </div>
  );
}
