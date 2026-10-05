"use client";

// Thẻ "Trạng thái hiện tại": số đo gần nhất + chip trạng thái + thời điểm đo.
// Chỉ mô tả trạng thái của số đo — không nhận xét "tốt/chưa tốt" (plan.md §3.3).
import { classifyReading, STATUS_META, type GlucoseThresholds } from "@/lib/glucose";
import type { Meal } from "@/lib/types";
import { fmtRelative } from "@/lib/format";

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

export default function StatusCard({ meals, thresholds }: { meals: Meal[]; thresholds: GlucoseThresholds }) {
  const latest = latestReading(meals);
  if (!latest) return null;

  const level = classifyReading(latest.value, latest.kind, thresholds);
  const meta = STATUS_META[level];

  return (
    <section className="rounded-2xl border border-line bg-panel px-5 py-4">
      <h2 className="mb-1 text-sm font-medium text-muted">Lần đo gần nhất</h2>
      <div className="flex items-center gap-3">
        <span className="reading-value-xl">{latest.value}</span>
        <span className="text-sm text-muted">mg/dL</span>
        <span className={`chip ${meta.chip}`}>{meta.label}</span>
      </div>
      <p className="mt-1 text-sm text-muted">
        {latest.kind === "pre" ? "Trước ăn" : "Sau ăn"} · {fmtRelative(latest.measuredAt)}
      </p>
    </section>
  );
}
