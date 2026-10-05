"use client";

// Biểu đồ xu hướng SVG tay (pattern EquityChart của client-mim-trading):
// 2 đường pre/post theo thời gian + đường tham chiếu low và postMax. 7/14/30 ngày.
import { useMemo, useState } from "react";
import { DEFAULT_THRESHOLDS, type GlucoseThresholds } from "@/lib/glucose";
import type { Meal } from "@/lib/types";
interface Point {
  t: number;
  value: number;
}

const RANGES = [7, 14, 30] as const;

const W = 640;
const H = 200;
const PAD_L = 34;
const PAD_R = 8;
const PAD_T = 10;
const PAD_B = 20;

export default function TrendChart({ meals, thresholds }: { meals: Meal[]; thresholds?: GlucoseThresholds }) {
  const [days, setDays] = useState<(typeof RANGES)[number]>(7);
  // Mốc "bây giờ" chụp 1 lần khi mount — tránh gọi Date.now trong render (purity)
  const [now] = useState(() => Date.now());
  const T = thresholds ?? DEFAULT_THRESHOLDS;

  const { pre, post, min, max } = useMemo(() => {
    const cutoff = now - days * 86400000;
    const pre: Point[] = [];
    const post: Point[] = [];
    for (const meal of meals) {
      if (meal.pre && new Date(meal.pre.measuredAt).getTime() >= cutoff) {
        pre.push({ t: new Date(meal.pre.measuredAt).getTime(), value: meal.pre.value });
      }
      if (meal.post && new Date(meal.post.measuredAt).getTime() >= cutoff) {
        post.push({ t: new Date(meal.post.measuredAt).getTime(), value: meal.post.value });
      }
    }
    pre.sort((a, b) => a.t - b.t);
    post.sort((a, b) => a.t - b.t);
    const all = [...pre, ...post].map((p) => p.value);
    const lo = Math.min(T.low, ...(all.length ? all : [T.postMax]));
    const hi = Math.max(T.postMax, ...(all.length ? all : [T.low]));
    const pad = Math.max(10, (hi - lo) * 0.1);
    return { pre, post, min: lo - pad, max: hi + pad };
  }, [meals, days, now, T]);

  const x = (t: number) => {
    const start = now - days * 86400000;
    return PAD_L + ((t - start) / (now - start)) * (W - PAD_L - PAD_R);
  };
  const y = (v: number) => PAD_T + (1 - (v - min) / (max - min)) * (H - PAD_T - PAD_B);

  const toPath = (pts: Point[]) =>
    pts.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.t).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");

  const hasData = pre.length > 0 || post.length > 0;

  return (
    <section className="rounded-2xl border border-line bg-panel px-5 py-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-sm font-medium text-muted">Xu hướng đường huyết</h2>
        <div className="flex overflow-hidden rounded-lg border border-line" role="group" aria-label="Khoảng biểu đồ">
          {RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setDays(r)}
              className={`min-h-8 px-2.5 text-xs font-semibold transition ${
                days === r ? "bg-accent text-white" : "bg-bg text-muted hover:text-ink"
              }`}
            >
              {r} ngày
            </button>
          ))}
        </div>
      </div>

      {hasData ? (
        <>
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Đường huyết ${days} ngày qua`}>
            {/* đường tham chiếu low & postMax */}
            <line x1={PAD_L} x2={W - PAD_R} y1={y(T.low)} y2={y(T.low)} stroke="var(--neg)" strokeDasharray="4 4" strokeWidth="1" opacity="0.5" />
            <line x1={PAD_L} x2={W - PAD_R} y1={y(T.postMax)} y2={y(T.postMax)} stroke="var(--amber)" strokeDasharray="4 4" strokeWidth="1" opacity="0.5" />
            <text x={PAD_L} y={y(T.low) - 3} fontSize="9" fill="var(--neg)" opacity="0.8">
              {T.low}
            </text>
            <text x={PAD_L} y={y(T.postMax) - 3} fontSize="9" fill="var(--amber)" opacity="0.8">
              {T.postMax}
            </text>

            <path d={toPath(pre)} fill="none" stroke="var(--blue)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
            <path d={toPath(post)} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

            {pre.map((p, i) => (
              <circle key={`p${i}`} cx={x(p.t)} cy={y(p.value)} r="2.5" fill="var(--blue)" />
            ))}
            {post.map((p, i) => (
              <circle key={`q${i}`} cx={x(p.t)} cy={y(p.value)} r="2.5" fill="var(--accent)" />
            ))}

            {/* nhãn trục Y */}
            <text x={2} y={PAD_T + 8} fontSize="9" fill="var(--faint)">
              {Math.round(max)}
            </text>
            <text x={2} y={H - PAD_B} fontSize="9" fill="var(--faint)">
              {Math.round(min)}
            </text>
          </svg>
          <div className="mt-1 flex gap-4 text-xs text-muted">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-4 rounded" style={{ background: "var(--blue)" }} /> Trước ăn
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-4 rounded" style={{ background: "var(--accent)" }} /> Sau ăn
            </span>
          </div>
        </>
      ) : (
        <p className="py-8 text-center text-sm text-faint">
          Chưa có số đo trong {days} ngày qua.
        </p>
      )}
    </section>
  );
}
