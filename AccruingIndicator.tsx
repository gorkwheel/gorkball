import { useEffect, useState } from "react";

interface Props {
  lastUpdateTs: number;
  paused: boolean;
}

export default function AccruingIndicator({ lastUpdateTs, paused }: Props) {
  const [secondsElapsed, setSecondsElapsed] = useState(0);

  useEffect(() => {
    const tick = () => {
      const now = Math.floor(Date.now() / 1000);
      setSecondsElapsed(Math.min(now - lastUpdateTs, 60));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [lastUpdateTs]);

  const pct = Math.min((secondsElapsed / 60) * 100, 100);

  return (
    <div className="border border-gork-border bg-gork-surface rounded-lg p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-gork-muted uppercase tracking-wider">
          Next Distribution
        </span>
        <div className="flex items-center gap-2">
          {paused ? (
            <span className="text-xs text-gork-yellow font-medium">PAUSED</span>
          ) : (
            <>
              <span className="accrue-dot w-2 h-2 rounded-full bg-gork-accent block" />
              <span className="text-xs text-gork-accent font-medium">ACCRUING</span>
            </>
          )}
        </div>
      </div>
      <div className="w-full bg-gork-border rounded-full h-1.5 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-1000 ease-linear"
          style={{
            width: `${pct}%`,
            background: paused ? "#F59E0B" : "#00E5FF",
          }}
        />
      </div>
      <div className="flex justify-between mt-2">
        <span className="text-xs text-gork-muted">{secondsElapsed}s elapsed</span>
        <span className="text-xs text-gork-muted">
          {Math.max(0, 60 - secondsElapsed)}s remaining
        </span>
      </div>
    </div>
  );
}
