interface Props {
  /** [t, price|null] points, oldest first. */
  points: [number, number | null][];
  /** Draws a dashed reference line (the normal price). */
  reference?: number | null;
  width?: number;
  height?: number;
  label: string;
}

/** Tiny price line. Gaps (null) break the line. */
export function Sparkline({ points, reference, width = 120, height = 40, label }: Props) {
  const values = points.map((p) => p[1]).filter((v): v is number => v !== null);
  if (values.length < 2) {
    return (
      <span className="inline-flex items-center text-[11.5px] text-muted" style={{ width, height }}>
        not enough history
      </span>
    );
  }
  const all = reference ? [...values, reference] : values;
  const lo = Math.min(...all);
  const hi = Math.max(...all);
  const t0 = points[0][0];
  const t1 = points[points.length - 1][0];
  const x = (t: number) => (t1 === t0 ? 0 : ((t - t0) / (t1 - t0)) * width);
  const y = (v: number) => (hi === lo ? height / 2 : height - 2 - ((v - lo) / (hi - lo)) * (height - 4));

  let d = "";
  let pen = false;
  for (const [t, v] of points) {
    if (v === null) {
      pen = false;
      continue;
    }
    d += `${pen ? "L" : "M"}${x(t).toFixed(1)},${y(v).toFixed(1)}`;
    pen = true;
  }

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label}>
      {reference ? (
        <line
          x1="0"
          x2={width}
          y1={y(reference)}
          y2={y(reference)}
          stroke="#5b6475"
          strokeWidth="1"
          strokeDasharray="3 3"
        />
      ) : null}
      <path d={d} fill="none" stroke="#8ab8ff" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}
