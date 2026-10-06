"use client";

// Thẻ "Lần đo gần nhất" — metric card của design system: nền card trắng,
// micro-stroke viền + thanh dọc màu theo trạng thái, số metric-huge 48/800,
// mũi tên xu hướng so với lần đo trước cùng loại. Không nhận xét "tốt/chưa tốt".
import { classifyReading, STATUS_META, previousReading, type GlucoseThresholds } from "@/lib/glucose";
import type { Meal } from "@/lib/types";
import { fmtDelta, fmtRelative } from "@/lib/format";

interface LatestReading {
  value: number;
  kind: "pre" | "post";
  measuredAt: string;
  meal: Meal;
}

export function latestReading(meals: Meal[]): LatestReading | null {
  let best: LatestReading | null = null;
  for (const meal of meals) {
    if (meal.pre) {
      const t = new Date(meal.pre.measuredAt).getTime();
      if (!best || t > new Date(best.measuredAt).getTime()) {
        best = { value: meal.pre.value, kind: "pre", measuredAt: meal.pre.measuredAt, meal };
      }
    }
    if (meal.post) {
      const t = new Date(meal.post.measuredAt).getTime();
      if (!best || t > new Date(best.measuredAt).getTime()) {
        best = { value: meal.post.value, kind: "post", measuredAt: meal.post.measuredAt, meal };
      }
    }
  }
  return best;
}

/** Màu accent micro-stroke theo trạng thái (dual-spectrum mint/rose + warn) */
const LEVEL_ACCENT: Record<string, string> = {
  low: "var(--rose)",
  slightly_low: "var(--warn)",
  in_target: "var(--primary-strong)",
  high: "var(--rose-strong)",
  very_high: "var(--rose)",
};

export default function StatusCard({ meals, thresholds }: { meals: Meal[]; thresholds: GlucoseThresholds }) {
  const latest = latestReading(meals);
  if (!latest) return null;

  const level = classifyReading(latest.value, latest.kind, thresholds);
  const meta = STATUS_META[level];
  const accent = LEVEL_ACCENT[level];

  // Xu hướng so với lần đo trước cùng loại: ↗ tăng / ↘ giảm / → tương đương (±4)
  const prev = previousReading(meals, latest.kind, latest.measuredAt);
  const diff = prev ? latest.value - prev.value : null;
  const arrow = diff === null ? "" : diff > 4 ? "↗" : diff < -4 ? "↘" : "→";

  return (
    <section
      aria-label="Lần đo gần nhất"
      className="relative overflow-hidden rounded-lg border bg-card px-5 py-4"
      style={{ borderColor: `color-mix(in srgb, ${accent} 32%, var(--line))` }}
    >
      <span aria-hidden className="absolute inset-y-0 left-0 w-1" style={{ background: accent }} />
      <div className="flex items-center justify-between gap-2">
        <h2 className="label-caps text-faint">Lần đo gần nhất</h2>
        <span className={`chip ${meta.chip}`}>{meta.label}</span>
      </div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="reading-value-xl">{latest.value}</span>
        <span className="text-sm font-medium text-muted">mg/dL</span>
      </div>
      <p className="mt-1.5 text-sm text-muted">
        {latest.kind === "pre" ? "Trước ăn" : "Sau ăn"} · {fmtRelative(latest.measuredAt)}
        {diff !== null && (
          <span className="ml-2 font-semibold tabular-nums" title="So với lần đo trước cùng loại">
            {arrow} {fmtDelta(diff)}
          </span>
        )}
      </p>
      {latest.meal.foods && <p className="mt-0.5 truncate text-xs text-faint">{latest.meal.foods}</p>}
    </section>
  );
}
