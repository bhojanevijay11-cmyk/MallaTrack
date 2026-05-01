import type { AttendanceTrendPoint } from "./mockData";

type Props = {
  series: AttendanceTrendPoint[];
  /** Query failed — do not show a misleading “no data” empty chart. */
  loadFailed?: boolean;
};

const W = 560;
const H = 160;
const PAD = { top: 12, right: 10, bottom: 28, left: 32 };
const INNER_W = W - PAD.left - PAD.right;
const INNER_H = H - PAD.top - PAD.bottom;

function buildPath(points: AttendanceTrendPoint[]): { line: string; area: string } {
  if (points.length === 0) return { line: "", area: "" };
  const minV = 70;
  const maxV = 100;
  const n = points.length;
  const xAt = (i: number) => PAD.left + (i / Math.max(1, n - 1)) * INNER_W;
  const yAt = (v: number) =>
    PAD.top + INNER_H - ((v - minV) / (maxV - minV)) * INNER_H;

  const coords = points.map((p, i) => [xAt(i), yAt(p.valuePct)] as const);
  const line = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const baseY = PAD.top + INNER_H;
  const area = `${line} L ${coords[coords.length - 1][0].toFixed(1)} ${baseY} L ${coords[0][0].toFixed(1)} ${baseY} Z`;
  return { line, area };
}

export function AttendanceTrendCard({ series, loadFailed = false }: Props) {
  const hasData = series.length > 0;
  const { line, area } = buildPath(series);
  const last = series[series.length - 1]?.valuePct;

  return (
    <section className="rounded-xl border border-slate-200/90 bg-white p-3 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-slate-900">
            Attendance trend
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Daily check-in rate across all batches (last 7 days).
          </p>
        </div>
        <div className="text-right">
          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-slate-400">
            Latest day
          </p>
          <p className="text-xl font-semibold tabular-nums text-slate-900">
            {last === undefined ? "—" : `${last}%`}
          </p>
        </div>
      </div>

      <div className="mt-4 w-full cursor-crosshair overflow-x-auto">
        {loadFailed ? (
          <div
            className="flex h-[176px] w-full min-w-[280px] items-center justify-center rounded-lg border border-dashed border-red-200 bg-red-50/50 px-4 text-center text-[13px] text-red-900"
            role="alert"
          >
            Attendance trend could not be loaded. Refresh the page or try again.
          </div>
        ) : !hasData ? (
          <div
            className="flex h-[176px] w-full min-w-[280px] flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-slate-200 bg-muted/20 px-4 text-center text-[13px] text-slate-600"
            role="status"
          >
            <span className="font-medium text-slate-800">No rate trend to show</span>
            <span className="text-slate-500">
              When students are active in batches, daily attendance rates appear here for the last
              seven India calendar days (same basis as Today attendance %).
            </span>
          </div>
        ) : (
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="h-[176px] w-full min-w-[280px]"
            role="img"
            aria-label="Line chart of attendance percentage over the last seven days"
          >
            <defs>
              <linearGradient id="attFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(24 95% 53%)" stopOpacity="0.18" />
                <stop offset="100%" stopColor="hsl(24 95% 53%)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <line
              x1={PAD.left}
              y1={PAD.top + INNER_H}
              x2={PAD.left + INNER_W}
              y2={PAD.top + INNER_H}
              stroke="hsl(214 24% 88%)"
              strokeWidth="1"
            />
            {[80, 85, 90, 95].map((tick) => {
              const y =
                PAD.top +
                INNER_H -
                ((tick - 70) / 30) * INNER_H;
              return (
                <g key={tick}>
                  <line
                    x1={PAD.left}
                    y1={y}
                    x2={PAD.left + INNER_W}
                    y2={y}
                    stroke="hsl(214 24% 92%)"
                    strokeDasharray="4 6"
                    strokeWidth="1"
                  />
                  <text
                    x={PAD.left - 6}
                    y={y + 4}
                    textAnchor="end"
                    fill="#94a3b8"
                    fontSize={10}
                  >
                    {tick}%
                  </text>
                </g>
              );
            })}
            <path d={area} fill="url(#attFill)" />
            <path
              d={line}
              fill="none"
              stroke="hsl(24 95% 53%)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {series.map((p, i) => {
              const x = PAD.left + (i / Math.max(1, series.length - 1)) * INNER_W;
              const y =
                PAD.top +
                INNER_H -
                ((p.valuePct - 70) / 30) * INNER_H;
              return (
                <g key={p.label}>
                  <title>{`${p.label}: ${p.valuePct}%`}</title>
                  <circle cx={x} cy={y} r="4" fill="white" stroke="hsl(24 95% 53%)" strokeWidth="2" />
                  <text
                    x={x}
                    y={H - 8}
                    textAnchor="middle"
                    fill="#64748b"
                    fontSize={11}
                    fontWeight={500}
                  >
                    {p.label}
                  </text>
                </g>
              );
            })}
          </svg>
        )}
      </div>
    </section>
  );
}
