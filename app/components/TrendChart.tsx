"use client";

// Biểu đồ xu hướng SVG tay: 2 đường pre (hồng)/post (mint) theo thời gian,
// band mục tiêu mint giữa low→postMax, lưới + nhãn trục ngày, tooltip chạm/hover.
// 7/14/30 ngày.
import { useMemo, useRef, useState } from "react";
import { DEFAULT_THRESHOLDS, type GlucoseThresholds } from "@/lib/glucose";
import type { Meal } from "@/lib/types";
import { fmtTime, dayKey } from "@/lib/format";

interface Point {
  t: number;
  value: number;
}

const RANGES = [7, 14, 30] as const;

const W = 640;
const H = 220;
const PAD_L = 34;
const PAD_R = 12;
const PAD_T = 12;
const PAD_B = 26;

interface HoverPoint extends Point {
  series: "pre" | "post";
}

export default function TrendChart({ meals, thresholds }: { meals: Meal[]; thresholds?: GlucoseThresholds }) {
  const [days, setDays] = useState<(typeof RANGES)[number]>(7);
  const [hover, setHover] = useState<HoverPoint | null>(null);
  // Mốc "bây giờ" chụp 1 lần khi mount — tránh gọi Date.now trong render (purity)
  const [now] = useState(() => Date.now());
  const svgRef = useRef<SVGSVGElement | null>(null);
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

  // ----- Trục: 4 lưới ngang + 4 mốc ngày -----
  const gridVals = useMemo(() => [0, 1, 2, 3].map((i) => min + ((max - min) * i) / 3), [min, max]);
  const xTicks = useMemo(
    () =>
      [0, 1, 2, 3].map((i) => {
        const t = now - days * 86400000 + ((days * 86400000) * i) / 3;
        const d = new Date(t);
        return { t, label: i === 3 ? "Nay" : d.toLocaleDateString("vi-VN", { day: "numeric", month: "numeric" }) };
      }),
    [days, now],
  );

  // ----- Tooltip: điểm gần nhất trong bán kính ~28 đơn vị viewBox -----
  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const sx = ((e.clientX - rect.left) / rect.width) * W;
    let best: HoverPoint | null = null;
    let bestD = Infinity;
    for (const [series, pts] of [
      ["pre", pre],
      ["post", post],
    ] as const) {
      for (const p of pts) {
        const d = Math.abs(x(p.t) - sx);
        if (d < bestD) {
          bestD = d;
          best = { ...p, series };
        }
      }
    }
    setHover(bestD <= 28 ? best : null);
  };

  return (
    <section className="rounded-lg border border-line bg-card px-5 py-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="label-caps text-faint">Xu hướng đường huyết</h2>
        <div className="segmented" role="group" aria-label="Khoảng biểu đồ">
          {RANGES.map((r) => (
            <button key={r} onClick={() => setDays(r)} aria-pressed={days === r} aria-label={`Biểu đồ ${r} ngày`}>
              {r}
            </button>
          ))}
        </div>
      </div>

      {hasData ? (
        <div className="relative">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${W} ${H}`}
            className="w-full touch-none"
            role="img"
            aria-label={`Đường huyết ${days} ngày qua`}
            onPointerMove={onPointerMove}
            onPointerLeave={() => setHover(null)}
          >
            {/* band mục tiêu low → postMax (mint nhạt) */}
            <rect
              x={PAD_L}
              y={Math.max(PAD_T, y(T.postMax))}
              width={W - PAD_L - PAD_R}
              height={Math.max(0, Math.min(H - PAD_B, y(T.low)) - Math.max(PAD_T, y(T.postMax)))}
              fill="color-mix(in srgb, var(--primary) 7%, transparent)"
            />

            {/* lưới ngang + nhãn trục Y */}
            {gridVals.map((v, i) => (
              <g key={i}>
                <line x1={PAD_L} x2={W - PAD_R} y1={y(v)} y2={y(v)} stroke="var(--line)" strokeWidth="0.75" opacity="0.45" />
                <text x={2} y={y(v) + 3} fontSize="9" fill="var(--faint)">
                  {Math.round(v)}
                </text>
              </g>
            ))}

            {/* đường tham chiếu low (hồng) & postMax (warn) */}
            <line x1={PAD_L} x2={W - PAD_R} y1={y(T.low)} y2={y(T.low)} stroke="var(--rose)" strokeDasharray="4 4" strokeWidth="1" opacity="0.55" />
            <line x1={PAD_L} x2={W - PAD_R} y1={y(T.postMax)} y2={y(T.postMax)} stroke="var(--warn)" strokeDasharray="4 4" strokeWidth="1" opacity="0.55" />

            {/* nhãn trục X */}
            {xTicks.map((tick, i) => (
              <text
                key={i}
                x={Math.min(W - PAD_R, Math.max(PAD_L, x(tick.t)))}
                y={H - 8}
                fontSize="9"
                fill="var(--faint)"
                textAnchor={i === 0 ? "start" : i === 3 ? "end" : "middle"}
              >
                {tick.label}
              </text>
            ))}

            <path d={toPath(pre)} fill="none" stroke="var(--rose-strong)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
            <path d={toPath(post)} fill="none" stroke="var(--primary-strong)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

            {pre.map((p, i) => (
              <circle key={`p${i}`} cx={x(p.t)} cy={y(p.value)} r="2.5" fill="var(--rose-strong)" />
            ))}
            {post.map((p, i) => (
              <circle key={`q${i}`} cx={x(p.t)} cy={y(p.value)} r="2.5" fill="var(--primary-strong)" />
            ))}

            {/* điểm đang hover */}
            {hover && (
              <circle cx={x(hover.t)} cy={y(hover.value)} r="4.5" fill="var(--card)" stroke={hover.series === "pre" ? "var(--rose-strong)" : "var(--primary-strong)"} strokeWidth="2" />
            )}
          </svg>

          {/* tooltip nổi ngoài SVG để không biến dạng theo viewBox */}
          {hover && (
            <div
              className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-md border border-line bg-card px-2.5 py-1.5 text-xs shadow-lg"
              style={{ left: `${Math.min(88, Math.max(12, (x(hover.t) / W) * 100))}%`, top: `${(y(hover.value) / H) * 100 - 2}%` }}
            >
              <span className="font-bold tabular-nums">{hover.value}</span> mg/dL ·{" "}
              <span style={{ color: hover.series === "pre" ? "var(--rose-strong)" : "var(--primary-strong)" }}>
                {hover.series === "pre" ? "Trước ăn" : "Sau ăn"}
              </span>
              <span className="text-faint">
                {" "}
                · {dayKey(new Date(hover.t)) === dayKey(new Date(now)) ? "Hôm nay" : new Date(hover.t).toLocaleDateString("vi-VN", { day: "numeric", month: "numeric" })} {fmtTime(new Date(hover.t))}
              </span>
            </div>
          )}
        </div>
      ) : (
        <p className="py-8 text-center text-sm text-faint">Chưa có số đo trong {days} ngày qua.</p>
      )}

      <div className="mt-1 flex gap-4 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-4 rounded-full" style={{ background: "var(--rose-strong)" }} /> Trước ăn
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-4 rounded-full" style={{ background: "var(--primary-strong)" }} /> Sau ăn
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-4 rounded" style={{ background: "color-mix(in srgb, var(--primary) 12%, transparent)" }} /> Mục tiêu
        </span>
      </div>
    </section>
  );
}
