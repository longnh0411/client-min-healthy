"use client";

// 2 thẻ cao nhất 30 ngày (FR-SUM-01…03): "Lúc đói cao nhất" (max pre) và
// "Lúc no cao nhất" (max post). Bằng nhau → lấy ngày gần nhất.
// Chạm thẻ → cuộn tới entry tương ứng trong lịch sử (FR-SUM-03).
import { useMemo } from "react";
import { classifyReading, STATUS_META, minutesAfterMeal, type GlucoseThresholds } from "@/lib/glucose";
import { MEAL_TYPE_LABELS, type Meal } from "@/lib/types";
import { fmtDuration } from "@/lib/format";

function pickMax(meals: Meal[], kind: "pre" | "post", cutoff: number): Meal | null {
  let best: Meal | null = null;
  let bestValue = -Infinity;
  let bestT = -Infinity;
  for (const m of meals) {
    const r = kind === "pre" ? m.pre : m.post;
    if (!r) continue;
    const t = new Date(r.measuredAt).getTime();
    if (t < cutoff) continue;
    // giá trị cao hơn thắng; bằng nhau → ngày gần nhất
    if (r.value > bestValue || (r.value === bestValue && t > bestT)) {
      bestValue = r.value;
      bestT = t;
      best = m;
    }
  }
  return best;
}

export default function MaxCards({
  meals,
  thresholds,
  now,
  onJumpTo,
}: {
  meals: Meal[];
  thresholds: GlucoseThresholds;
  now: number;
  onJumpTo: (meal: Meal) => void;
}) {
  const cutoff = now - 30 * 86400000;
  const { maxPre, maxPost } = useMemo(
    () => ({ maxPre: pickMax(meals, "pre", cutoff), maxPost: pickMax(meals, "post", cutoff) }),
    [meals, cutoff],
  );

  const label = (m: Meal | null, kind: "pre" | "post") => {
    if (!m) return "Chưa có số đo";
    const r = kind === "pre" ? m.pre : m.post;
    if (!r) return "Chưa có số đo";
    const chip = STATUS_META[classifyReading(r.value, kind, thresholds)];
    const dt = new Date(r.measuredAt);
    const ngay = `${String(dt.getDate()).padStart(2, "0")}/${String(dt.getMonth() + 1).padStart(2, "0")}`;
    const after = kind === "post" ? ` · sau ăn ${fmtDuration(minutesAfterMeal(m.eatenAt, r.measuredAt))}` : "";    return `${chip.label} · ${ngay} · ${MEAL_TYPE_LABELS[m.mealType]}${after}`;
  };

  const card = (m: Meal | null, kind: "pre" | "post", title: string) => {
    const r = m ? (kind === "pre" ? m.pre : m.post) : null;
    return (
      <button
        type="button"
        onClick={() => m && onJumpTo(m)}
        disabled={!m}
        className="flex-1 rounded-lg border border-line bg-card px-4 py-3 text-left transition enabled:hover:border-primary/60 disabled:cursor-default"
      >
        <p className="label-caps text-faint">{title}</p>
        <p className="mt-1 text-[22px] font-bold tabular-nums leading-none">
          {r ? r.value : <span className="text-sm font-normal text-muted">Chưa có số đo</span>}
        </p>
        <p className="mt-1 truncate text-[11px] text-faint">{label(m, kind)}</p>
      </button>
    );
  };

  return (
    <section aria-label="Số đo cao nhất 30 ngày" className="flex gap-3">
      {card(maxPre, "pre", "Lúc đói cao nhất · 30 ngày")}
      {card(maxPost, "post", "Lúc no cao nhất · 30 ngày")}
    </section>
  );
}
