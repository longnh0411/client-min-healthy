// Logic nghiệp vụ đường huyết — hàm thuần, có test (glucose.test.ts).
// Đối chiếu BA: BR-04/06/07/08/10/11/14/17/19/20 (`.knowledge-base/business/client-min-healthy/02-SRS.md`).

import type { ReadingKind, Meal, MealType } from "./types";
import { dayKey } from "./format";

export interface GlucoseThresholds {
  low: number;
  preMax: number;
  postMax: number;
  veryHigh: number;
}

/** Ngưỡng mặc định tham khảo ADA (BR-07 / SRS S1) — user chỉnh theo chỉ định bác sĩ. */
export const DEFAULT_THRESHOLDS: GlucoseThresholds = {
  low: 70,
  preMax: 130,
  postMax: 180,
  veryHigh: 250,
};

/** Phân loại 4 mức (BR-07): <low Thấp | ≤max Trong mục tiêu | <veryHigh Cao | ≥veryHigh Rất cao */
export type StatusLevel = "low" | "in_target" | "high" | "very_high";

export function classifyReading(
  value: number,
  kind: ReadingKind,
  t: GlucoseThresholds = DEFAULT_THRESHOLDS,
): StatusLevel {
  if (value < t.low) return "low";
  if (value <= (kind === "pre" ? t.preMax : t.postMax)) return "in_target";
  if (value < t.veryHigh) return "high";
  return "very_high";
}

/** Chip trạng thái: chữ + màu (không dựa vào màu một mình — NFR-03). */
export const STATUS_META: Record<StatusLevel, { label: string; chip: string; dot: string }> = {
  low: { label: "Thấp", chip: "chip-low", dot: "var(--rose)" },
  in_target: { label: "Trong mục tiêu", chip: "chip-in-target", dot: "var(--primary-strong)" },
  high: { label: "Cao", chip: "chip-high", dot: "var(--warn)" },
  very_high: { label: "Rất cao", chip: "chip-very-high", dot: "var(--rose)" },
};

// ---------- HbA1c ước tính (BR-10/11) ----------

export const A1C_WINDOW_DAYS = 90;
export const A1C_MIN_PRE = 10;
export const A1C_MIN_POST = 10;
/** Trải dữ liệu: (ngày muộn nhất − sớm nhất) ≥ 13 tức đủ 14 ngày kể cả đầu-cuối (BR-11). */
export const A1C_MIN_SPAN_DAYS = 13;

export interface A1cResult {
  /** % HbA1c làm tròn 1 số lẻ — null khi chưa đủ dữ liệu */
  value: number | null;
  /** Khi value null: số còn thiếu theo từng tiêu chí (I-A1C-01) */
  missing: { pre: number; post: number; days: number } | null;
}

/**
 * BR-10: A1C% = ((mean(pre) + mean(post)) / 2 + 46.7) / 28.7 — trung bình CÂN BẰNG
 * pre/post (không bị lệch khi số pre ≠ số post), cửa sổ 90 ngày.
 * BR-11: đủ dữ liệu khi ≥10 pre VÀ ≥10 post VÀ trải ≥14 ngày.
 */
export function estimateA1c(meals: Meal[], now: Date = new Date()): A1cResult {
  const cutoff = now.getTime() - A1C_WINDOW_DAYS * 86400000;
  const pre: number[] = [];
  const post: number[] = [];
  let minT = Infinity;
  let maxT = -Infinity;
  for (const m of meals) {
    for (const r of [m.pre, m.post]) {
      if (!r) continue;
      const t = new Date(r.measuredAt).getTime();
      if (t < cutoff) continue;
      (r === m.pre ? pre : post).push(r.value);
      if (t < minT) minT = t;
      if (t > maxT) maxT = t;
    }
  }
  const missingPre = Math.max(0, A1C_MIN_PRE - pre.length);
  const missingPost = Math.max(0, A1C_MIN_POST - post.length);
  const spanDays = pre.length + post.length ? Math.floor((maxT - minT) / 86400000) : 0;
  const missingDays = Math.max(0, A1C_MIN_SPAN_DAYS - spanDays);
  if (missingPre > 0 || missingPost > 0 || missingDays > 0) {
    return { value: null, missing: { pre: missingPre, post: missingPost, days: missingDays } };
  }
  const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
  const balanced = (mean(pre) + mean(post)) / 2;
  return { value: Math.round(((balanced + 46.7) / 28.7) * 10) / 10, missing: null };
}

// ---------- Time in Range (thẻ tổng quan — value-add ngoài BA) ----------

export interface TirBreakdown {
  low: number;
  inRange: number;
  high: number;
  total: number;
}

/** Gom 4 mức về 3 nhóm: Thấp (low) / trong mục tiêu / Cao (high + very_high). */
export function timeInRange(
  readings: { value: number; kind: ReadingKind }[],
  t: GlucoseThresholds = DEFAULT_THRESHOLDS,
): TirBreakdown {
  const b: TirBreakdown = { low: 0, inRange: 0, high: 0, total: readings.length };
  for (const r of readings) {
    const level = classifyReading(r.value, r.kind, t);
    if (level === "in_target") b.inRange++;
    else if (level === "low") b.low++;
    else b.high++;
  }
  return b;
}

// ---------- Độ chênh (BR-20) ----------

/** post − pre; thiếu 1 trong 2 → null. */
export function calcDelta(
  pre: { value: number } | null | undefined,
  post: { value: number } | null | undefined,
): number | null {
  if (!pre || !post) return null;
  return post.value - pre.value;
}

/** Số phút sau bữa ăn của 1 lần đo sau ăn: post.measuredAt − eatenAt. */
export function minutesAfterMeal(eatenAt: string | Date, postMeasuredAt: string | Date): number {
  const a = new Date(eatenAt).getTime();
  const b = new Date(postMeasuredAt).getTime();
  return Math.max(0, Math.round((b - a) / 60000));
}

// ---------- Bữa trước (BR-08) ----------

/** Thứ tự buổi trong ngày theo BA: sáng → trưa → phụ → tối. */
export const MEAL_ORDER: Record<MealType, number> = { breakfast: 0, lunch: 1, snack: 2, dinner: 3 };

/** Khóa sắp xếp entry: (ngày, thứ tự buổi). */
export function mealSortKey(m: Meal): number {
  return Number(dayKey(m.eatenAt).replaceAll("-", "")) * 10 + MEAL_ORDER[m.mealType];
}

/**
 * Bữa trước của X = entry đứng ngay trước theo (ngày, thứ tự buổi) — kể cả khác ngày,
 * bỏ qua buổi trống (BR-08). Tính khi hiển thị, không lưu.
 */
export function findPreviousMeal(meals: Meal[], meal: Meal): Meal | null {
  const k = mealSortKey(meal);
  let best: Meal | null = null;
  let bestK = -Infinity;
  for (const m of meals) {
    const mk = mealSortKey(m);
    if (mk < k && mk > bestK) {
      bestK = mk;
      best = m;
    }
  }
  return best;
}

const MEAL_SHORT: Record<MealType, string> = { breakfast: "Sáng", lunch: "Trưa", snack: "Phụ", dinner: "Tối" };

/** Nhãn ngày·buổi cho thẻ "Bữa trước": "Sáng nay" / "Trưa hôm qua" / "Tối 03/10". */
export function previousMealLabel(m: Meal, now: Date = new Date()): string {
  const s = MEAL_SHORT[m.mealType];
  const dk = dayKey(m.eatenAt);
  if (dk === dayKey(now)) return `${s} nay`;
  if (dk === dayKey(new Date(now.getTime() - 86400000))) return `${s} hôm qua`;
  const dt = new Date(m.eatenAt);
  return `${s} ${String(dt.getDate()).padStart(2, "0")}/${String(dt.getMonth() + 1).padStart(2, "0")}`;
}

/** Số đo cùng loại gần nhất TRƯỚC mốc `beforeIso` — xu hướng ↗/→/↘ trên thẻ trạng thái. */
export function previousReading(
  meals: Meal[],
  kind: ReadingKind,
  beforeIso: string,
): { value: number; measuredAt: string } | null {
  const at = new Date(beforeIso).getTime();
  let best: { value: number; measuredAt: string } | null = null;
  let bestT = -Infinity;
  for (const m of meals) {
    const r = kind === "pre" ? m.pre : m.post;
    if (!r) continue;
    const rt = new Date(r.measuredAt).getTime();
    if (rt < at && rt > bestT) {
      bestT = rt;
      best = r;
    }
  }
  return best;
}

// ---------- Validate dữ liệu nhập (BR-01/04, E-VAL-01/03) ----------

/** Giá trị hợp lệ: số nguyên 20–600 mg/dL — trả thông báo lỗi tiếng Việt hoặc null. */
export function validateReadingValue(raw: string | number): string | null {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (raw === "" || !Number.isFinite(n)) return "Nhập số đo đường huyết";
  if (!Number.isInteger(n)) return "Số đo phải là số nguyên (mg/dL)";
  if (n < 20 || n > 600) return "Số đo phải trong khoảng 20–600 mg/dL";
  return null;
}

/** BR-04: không cho chọn thời điểm ở tương lai (E-VAL-03). */
export function validateNotFuture(value: string | Date, now: Date = new Date()): string | null {
  const t = new Date(value).getTime();
  if (!Number.isFinite(t)) return "Thời gian không hợp lệ";
  if (t > now.getTime()) return "Không được chọn thời gian ở tương lai";
  return null;
}

/** Ngưỡng an toàn: banner W-SAFE-01 khi < low hoặc ≥ veryHigh (BR-14). */
export function isDangerReading(value: number, t: GlucoseThresholds = DEFAULT_THRESHOLDS): boolean {
  return value < t.low || value >= t.veryHigh;
}

/** So lệch >100 mg/dL với số đo liền trước cùng loại → hỏi xác nhận (plan §3.6 / BR-15). */
export function isSuspiciousJump(value: number, previousSameKind: number | null | undefined): boolean {
  if (previousSameKind === null || previousSameKind === undefined) return false;
  return Math.abs(value - previousSameKind) > 100;
}

/** Đoán loại bữa theo giờ hiện tại (BR-06): 0–9:59 sáng, 10–13:59 trưa, 14–16:59 phụ, 17–23:59 tối. */
export function guessMealType(now: Date = new Date()): MealType {
  const h = now.getHours();
  if (h < 10) return "breakfast";
  if (h < 14) return "lunch";
  if (h < 17) return "snack";
  return "dinner";
}

// ---------- Validate ngưỡng cài đặt (BR-19) ----------

/** BR-19: khoảng hợp lệ từng ngưỡng + thứ tự thấp < mục tiêu < rất cao. Trả lỗi tiếng Việt hoặc null. */
export function validateThresholds(t: GlucoseThresholds): string | null {
  const ranges: [keyof GlucoseThresholds, number, number][] = [
    ["low", 50, 100],
    ["preMax", 100, 180],
    ["postMax", 120, 250],
    ["veryHigh", 200, 400],
  ];
  for (const [key, min, max] of ranges) {
    if (t[key] < min || t[key] > max) return `Ngưỡng phải trong khoảng ${min}–${max} mg/dL`;
  }
  if (!(t.low < t.preMax && t.low < t.postMax && t.preMax < t.veryHigh && t.postMax < t.veryHigh)) {
    return "Các ngưỡng phải theo thứ tự: thấp < mục tiêu < rất cao.";
  }
  return null;
}
