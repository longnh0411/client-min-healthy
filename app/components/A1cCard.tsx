"use client";

// HbA1c ước tính từ trung bình đường huyết (eAG) — cửa sổ 30/60/90 ngày.
// Luôn kèm chú thích "tham khảo, không thay thế xét nghiệm" (plan.md §3.4).
import { useMemo, useState } from "react";
import { estimateA1c } from "@/lib/glucose";
import type { Meal } from "@/lib/types";

const WINDOWS = [
  { days: 30, label: "30" },
  { days: 60, label: "60" },
  { days: 90, label: "90" },
] as const;

export default function A1cCard({ meals }: { meals: Meal[] }) {
  const [days, setDays] = useState<30 | 60 | 90>(90);
  // Mốc "bây giờ" chụp 1 lần khi mount — tránh gọi Date.now trong render (purity)
  const [now] = useState(() => Date.now());

  const result = useMemo(() => {
    const cutoff = now - days * 86400000;
    const values: number[] = [];
    for (const meal of meals) {
      for (const r of [meal.pre, meal.post]) {
        if (r && new Date(r.measuredAt).getTime() >= cutoff) values.push(r.value);
      }
    }
    return { count: values.length, a1c: estimateA1c(values) };
  }, [meals, days, now]);

  return (
    <section className="rounded-2xl border border-line bg-panel px-5 py-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-medium text-muted">HbA1c ước tính</h2>
        <div className="flex overflow-hidden rounded-lg border border-line" role="group" aria-label="Cửa sổ tính">
          {WINDOWS.map((w) => (
            <button
              key={w.days}
              onClick={() => setDays(w.days)}
              className={`min-h-8 px-2.5 text-xs font-semibold transition ${
                days === w.days ? "bg-accent text-white" : "bg-bg text-muted hover:text-ink"
              }`}
            >
              {w.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-1 flex items-baseline gap-2">
        {result.a1c !== null ? (
          <>
            <span className="reading-value">{result.a1c}%</span>
            <span className="text-xs text-faint">trung bình {days} ngày</span>
          </>
        ) : (
          <span className="text-base text-muted">Chưa đủ dữ liệu</span>
        )}
      </div>

      <p className="mt-1 text-xs leading-5 text-faint">
        {result.a1c !== null
          ? `Ước tính tham khảo từ ${result.count} lần đo trong ${days} ngày, không thay thế xét nghiệm HbA1c.`
          : `Cần tối thiểu 10 lần đo trong ${days} ngày (hiện có ${result.count}).`}
      </p>
    </section>
  );
}
