type TimeUnit = "y" | "mo" | "w" | "d" | "h" | "m" | "s" | "ms";

const msIn: Record<TimeUnit, number> = {
  ms: 1,
  s: 1000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
  w: 604_800_000,
  mo: 2_592_000_000,
  y: 31_536_000_000,
};

export const prettyUnits: Record<TimeUnit, string> = {
  y: "year",
  mo: "month",
  w: "week",
  d: "day",
  h: "hour",
  m: "minute",
  s: "second",
  ms: "millisecond",
};

export const timeMs = (opts: Partial<Record<TimeUnit, number>>) =>
  (Object.keys(opts) as TimeUnit[])
    .map((u) => msIn[u] * (opts[u] || 0))
    .reduce((sum, i) => sum + i, 0);

export const descTime: TimeUnit[] = ["y", "mo", "w", "d", "h", "m", "s"];

export const msToTime = (ms: number): Partial<Record<TimeUnit, number>> => {
  const result: Partial<Record<TimeUnit, number>> = {};

  for (const unit of descTime) {
    if (ms >= msIn[unit]) {
      result[unit] = Math.floor(ms / msIn[unit]);
      ms %= msIn[unit];
    }
  }

  return result;
};
