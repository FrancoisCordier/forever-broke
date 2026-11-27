import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { dateTime, formatGold, shortDate } from "../lib/format.ts";

export interface Point {
  t: number;
  price: number | null;
  qty: number;
}

interface Props {
  points: Point[];
  normal: number | null;
  upTo: number | null;
  /** Unix seconds; drawn as a vertical marker. */
  raidT: number;
  /** x-axis end (unix s); lets the raid marker show even before raid day. */
  until: number;
}

const AXIS = { stroke: "#2c3340", tick: { fill: "#a3acbb", fontSize: 12 } };
const goldTick = (c: number) => (c >= 10000 ? `${Math.round(c / 1000) / 10}g` : formatGold(c));

const tooltipStyle = {
  contentStyle: { background: "#12151b", border: "1px solid #2c3340", borderRadius: 10, color: "#e8eaef" },
  labelStyle: { color: "#a3acbb" },
  labelFormatter: (t: unknown) => dateTime(Number(t)),
};

/** Price line (with normal, buy-up-to and raid-day markers) above a units-listed bar chart. */
export function PriceChart({ points, normal, upTo, raidT, until }: Props) {
  const start = points[0]?.t ?? until;
  const domain: [number, number] = [start, Math.max(until, points.at(-1)?.t ?? until)];
  const xAxis = {
    ...AXIS,
    dataKey: "t",
    type: "number" as const,
    domain,
    scale: "time" as const,
    tickFormatter: (t: number) => shortDate(t),
    minTickGap: 40,
  };

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={points} margin={{ top: 16, right: 16, bottom: 0, left: 8 }}>
          <CartesianGrid stroke="#232833" vertical={false} />
          <XAxis {...xAxis} />
          <YAxis {...AXIS} width={56} tickFormatter={goldTick} domain={["auto", "auto"]} />
          <Tooltip
            {...tooltipStyle}
            formatter={(v: unknown) => [typeof v === "number" ? formatGold(v) : "not listed", "Now"]}
          />
          {normal ? (
            <ReferenceLine y={normal} stroke="#7d8696" strokeDasharray="6 5" ifOverflow="extendDomain" />
          ) : null}
          {upTo ? <ReferenceLine y={upTo} stroke="#4fd1a0" strokeDasharray="2 5" ifOverflow="extendDomain" /> : null}
          <ReferenceLine
            x={raidT}
            stroke="#f6a64c"
            strokeWidth={2}
            label={{ value: "Raids open", position: "insideTopRight", fill: "#f6b26b", fontSize: 12 }}
          />
          <Line
            dataKey="price"
            stroke="#8ab8ff"
            strokeWidth={2}
            dot={false}
            connectNulls={false}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
      <ResponsiveContainer width="100%" height={90}>
        <BarChart data={points} margin={{ top: 4, right: 16, bottom: 0, left: 8 }}>
          <XAxis {...xAxis} hide />
          <YAxis {...AXIS} width={56} tickCount={2} />
          <Tooltip {...tooltipStyle} formatter={(v: unknown) => [Number(v).toLocaleString("en-GB"), "Units listed"]} />
          <ReferenceLine x={raidT} stroke="#f6a64c" strokeWidth={2} />
          <Bar dataKey="qty" fill="#3a4354" isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
