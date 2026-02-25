import clsx from "clsx";

interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
  mono?: boolean;
}

export default function StatCard({ label, value, sub, accent, mono }: StatCardProps) {
  return (
    <div className="border border-gork-border bg-gork-surface rounded-lg p-5 flex flex-col gap-1">
      <span className="text-xs text-gork-muted uppercase tracking-wider">{label}</span>
      <span
        className={clsx(
          "text-xl font-semibold break-all",
          mono && "font-mono text-base",
          accent ? "text-gork-accent" : "text-gork-text"
        )}
      >
        {value}
      </span>
      {sub && <span className="text-xs text-gork-muted mt-0.5">{sub}</span>}
    </div>
  );
}
