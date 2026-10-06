"use client";

// Thẻ tổng quan: HbA1c ước tính (eAG) + thanh Time in Range 3 màu
// (mint = trong mục tiêu, hồng mềm = cao, hồng đậm = thấp) — cửa sổ 30/60/90 ngày.
// Luôn kèm chú thích "tham khảo, không thay thế xét nghiệm" (plan.md §3.4).
import { useMemo, useState } from "react";
import { estimateA1c, timeInRange, type GlucoseThresholds } from "@/lib/glucose";
import type { Meal } from "@/lib/types";

const WINDOWS = [
  { days: 30, label: "30" },
  { days: 60, label: "60" },
  { days: 90, label: "90" },
] as const;

export default function A1cCard({ meals, thresholds }: { meals: Meal[]; thresholds: GlucoseThresholds }) {
  const [days, setDays] = useState<30 | 60 | 90>(90);
  // Mốc "bây giờ" chụp 1 lần khi mount — tránh gọi Date.now trong render (purity)
  const [now] = useState(() => Date.now());

  const result = useMemo(() => {
    const cutoff = now - days * 86400000;
    const readings: { value: number; kind: "pre" | "post" }[] = [];
    for (const meal of meals) {
      if (meal.pre && new Date(meal.pre.measuredAt).getTime() >= cutoff)
        readings.push({ value: meal.pre.value, kind: "pre" });
      if (meal.post && new Date(meal.post.measuredAt).getTime() >= cutoff)
        readings.push({ value: meal.post.value, kind: "post" });
    }
    const values = readings.map((r) => r.value);
    return { count: readings.length, a1c: estimateA1c(values), tir: timeInRange(readings, thresholds) };
  }, [meals, days, now, thresholds]);

  const pct = (n: number) => (result.tir.total ? Math.round((n / result.tir.total) * 100) : 0);

  return (
    <section className="rounded-lg border border-line bg-card px-5 py-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="label-caps text-faint">HbA1c ước tính</h2>
        <div className="segmented" role="group" aria-label="Cửa sổ tính">
          {WINDOWS.map((w) => (
            <button key={w.days} onClick={() => setDays(w.days)} aria-pressed={days === w.days}>
              {w.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-2 flex items-baseline gap-2">
        {result.a1c !== null ? (
          <>
            <span className="reading-value">{result.a1c}%</span>
            <span className="text-xs text-faint">trung bình {days} ngày · {result.count} lần đo</span>
          </>
        ) : (
          <span className="text-sm text-muted">Chưa đủ dữ liệu — cần ≥ 10 lần đo trong {days} ngày (hiện có {result.count})</span>
        )}
      </div>

      {/* Time in Range — segmented bar 3 màu */}
      {result.tir.total > 0 && (
        <div className="mt-3">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-xs font-semibold">Time in Range</span>
            <span className="text-xs font-semibold tabular-nums text-primary">{pct(result.tir.inRange)}%</span>
          </div>
          <div className="mt-1.5 flex h-2.5 gap-px overflow-hidden rounded-full bg-card-2" role="img"
            aria-label={`Trong mục tiêu ${pct(result.tir.inRange)}%, cao ${pct(result.tir.high)}%, thấp ${pct(result.tir.low)}%`}>
            <span className="basis-0" style={{ flexGrow: result.tir.low, background: "var(--rose)" }} />
            <span className="basis-0" style={{ flexGrow: result.tir.inRange, background: "var(--primary-strong)" }} />
            <span className="basis-0" style={{ flexGrow: result.tir.high, background: "color-mix(in srgb, var(--rose-strong) 55%, transparent)" }} />
          </div>
          <p className="mt-1.5 text-[11px] text-faint">
            Thấp {pct(result.tir.low)}% · Mục tiêu {pct(result.tir.inRange)}% · Cao {pct(result.tir.high)}%
          </p>
        </div>
      )}

      <p className="mt-2 text-xs leading-5 text-faint">
        {result.a1c !== null && "Ước tính tham khảo từ lần đo, không thay thế xét nghiệm HbA1c."}
      </p>
    </section>
  );
}
