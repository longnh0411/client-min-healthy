"use client";

// Thẻ HbA1c ước tính (SRS C4, BR-10/11): TB cân bằng pre/post, cửa sổ 90 ngày,
// đủ điều kiện ≥10 pre VÀ ≥10 post VÀ trải ≥14 ngày — thiếu → I-A1C-01.
// Kèm Time in Range (value-add ngoài BA) + chú thích I-A1C-02.
import { useMemo, useState } from "react";
import { estimateA1c, timeInRange, type GlucoseThresholds } from "@/lib/glucose";
import type { Meal } from "@/lib/types";

export default function A1cCard({ meals, thresholds }: { meals: Meal[]; thresholds: GlucoseThresholds }) {
  // Mốc "bây giờ" chụp 1 lần khi mount — tránh gọi Date.now trong render (purity)
  const [now] = useState(() => Date.now());

  const result = useMemo(() => {
    const readings: { value: number; kind: "pre" | "post" }[] = [];
    for (const meal of meals) {
      if (meal.pre && new Date(meal.pre.measuredAt).getTime() >= now - 90 * 86400000)
        readings.push({ value: meal.pre.value, kind: "pre" });
      if (meal.post && new Date(meal.post.measuredAt).getTime() >= now - 90 * 86400000)
        readings.push({ value: meal.post.value, kind: "post" });
    }
    return { estimate: estimateA1c(meals, new Date(now)), tir: timeInRange(readings, thresholds) };
  }, [meals, now, thresholds]);

  const pct = (n: number) => (result.tir.total ? Math.round((n / result.tir.total) * 100) : 0);
  const { value: a1c, missing } = result.estimate;

  return (
    <section className="rounded-lg border border-line bg-card px-5 py-4">
      <h2 className="label-caps text-faint">HbA1c ước tính</h2>

      {a1c !== null ? (
        <div className="mt-2 flex items-baseline gap-2">
          <span className="reading-value">{a1c}%</span>
          <span className="text-xs text-faint">
            90 ngày gần nhất · {result.tir.total} lần đo
          </span>
        </div>
      ) : (
        <p className="mt-2 text-sm text-muted">
          Cần thêm dữ liệu: còn thiếu {missing!.pre} số đo trước ăn, {missing!.post} số đo sau ăn
          {missing!.days > 0 ? `, ${missing!.days} ngày` : ""}.
        </p>
      )}

      {/* Time in Range — segmented bar 3 màu (value-add) */}
      {result.tir.total > 0 && (
        <div className="mt-3">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-xs font-semibold">Time in Range</span>
            <span className="text-xs font-semibold tabular-nums text-primary">{pct(result.tir.inRange)}%</span>
          </div>
          <div
            className="mt-1.5 flex h-2.5 gap-px overflow-hidden rounded-full bg-card-2"
            role="img"
            aria-label={`Trong mục tiêu ${pct(result.tir.inRange)}%, cao ${pct(result.tir.high)}%, thấp ${pct(result.tir.low)}%`}
          >
            <span className="basis-0" style={{ flexGrow: result.tir.low, background: "var(--rose)" }} />
            <span className="basis-0" style={{ flexGrow: result.tir.inRange, background: "var(--primary-strong)" }} />
            <span
              className="basis-0"
              style={{ flexGrow: result.tir.high, background: "color-mix(in srgb, var(--rose-strong) 55%, transparent)" }}
            />
          </div>
          <p className="mt-1.5 text-[11px] text-faint">
            Thấp {pct(result.tir.low)}% · Mục tiêu {pct(result.tir.inRange)}% · Cao {pct(result.tir.high)}%
          </p>
        </div>
      )}

      <p className="mt-2 text-xs leading-5 text-faint">
        Ước tính tham khảo từ lần đo, không thay thế xét nghiệm HbA1c.
      </p>
    </section>
  );
}
