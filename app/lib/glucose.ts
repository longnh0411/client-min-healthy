// Logic nghiệp vụ đường huyết — hàm thuần, có test (glucose.test.ts).
// Tham chiếu plan.md §3: phân loại theo ngưỡng, eAG→HbA1c, ngữ cảnh bữa trước, độ chênh.

import type { ReadingKind, Meal, MealType } from "./types";

export interface GlucoseThresholds {
  low: number;
  preMin: number;
  preMax: number;
  postMax: number;
  veryHigh: number;
}

/** Ngưỡng mặc định tham khảo ADA (plan.md §3.3) — user chỉnh theo chỉ định bác sĩ. */
export const DEFAULT_THRESHOLDS: GlucoseThresholds = {
  low: 70,
  preMin: 80,
  preMax: 130,
  postMax: 180,
  veryHigh: 250,
};

export type StatusLevel = "low" | "slightly_low" | "in_target" | "high" | "very_high";

/**
 * Phân loại 1 số đo theo ngưỡng (plan.md §3.3):
 *   < low → low | pre & < preMin → slightly_low
 *   ≤ (pre ? preMax : postMax) → in_target | < veryHigh → high | else very_high
 */
export function classifyReading(
  value: number,
  kind: ReadingKind,
  t: GlucoseThresholds = DEFAULT_THRESHOLDS,
): StatusLevel {
  if (value < t.low) return "low";
  if (kind === "pre" && value < t.preMin) return "slightly_low";
  if (value <= (kind === "pre" ? t.preMax : t.postMax)) return "in_target";
  if (value < t.veryHigh) return "high";
  return "very_high";
}

/** Chip trạng thái: chữ + màu (không dựa vào màu một mình — có chữ rõ ràng). */
export const STATUS_META: Record<StatusLevel, { label: string; chip: string; dot: string }> = {
  low: { label: "Thấp", chip: "chip-low", dot: "var(--neg)" },
  slightly_low: { label: "Hơi thấp", chip: "chip-slightly-low", dot: "var(--amber)" },
  in_target: { label: "Trong mục tiêu", chip: "chip-in-target", dot: "var(--pos)" },
  high: { label: "Cao", chip: "chip-high", dot: "var(--amber)" },
  very_high: { label: "Rất cao", chip: "chip-very-high", dot: "var(--neg)" },
};

/**
 * Ước tính HbA1c theo công thức eAG (ADAG): A1C% = (avg + 46.7) / 28.7.
 * Cần tối thiểu 10 lần đo, làm tròn 1 chữ số thập phân; thiếu dữ liệu → null.
 */
export const A1C_MIN_READINGS = 10;

export function estimateA1c(values: number[]): number | null {
  if (values.length < A1C_MIN_READINGS) return null;
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.round(((avg + 46.7) / 28.7) * 10) / 10;
}

/** Độ chênh sau ăn − trước ăn (mg/dL); thiếu 1 trong 2 → null. */
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

/**
 * Bữa ngay trước bữa X = bữa có eatenAt lớn nhất nhưng nhỏ hơn eatenAt của X
 * (plan.md §3.1). meals không cần sắp sẵn — hàm tự quét.
 */
export function findPreviousMeal(meals: Meal[], meal: Meal): Meal | null {
  const at = new Date(meal.eatenAt).getTime();
  let prev: Meal | null = null;
  let prevAt = -Infinity;
  for (const m of meals) {
    const t = new Date(m.eatenAt).getTime();
    if (t < at && t > prevAt) {
      prevAt = t;
      prev = m;
    }
  }
  return prev;
}

/** Khoảng cách đến bữa trước ≥ 8 giờ → "Lúc đói" (plan.md §3.1). */
export const FASTING_GAP_MINUTES = 8 * 60;

export function isFastingSincePrevious(prev: Meal | null, meal: Meal): boolean {
  if (!prev) return false;
  const gap = (new Date(meal.eatenAt).getTime() - new Date(prev.eatenAt).getTime()) / 60000;
  return gap >= FASTING_GAP_MINUTES;
}

/** Giá trị hợp lệ: số nguyên 20–600 mg/dL — trả thông báo lỗi tiếng Việt hoặc null. */
export function validateReadingValue(raw: string | number): string | null {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (raw === "" || !Number.isFinite(n)) return "Nhập số đo đường huyết";
  if (!Number.isInteger(n)) return "Số đo phải là số nguyên (mg/dL)";
  if (n < 20 || n > 600) return "Số đo phải trong khoảng 20–600 mg/dL";
  return null;
}

/** Ngưỡng an toàn: hiện banner cảnh báo khi < low hoặc ≥ veryHigh (plan.md §3.5). */
export function isDangerReading(value: number, t: GlucoseThresholds = DEFAULT_THRESHOLDS): boolean {
  return value < t.low || value >= t.veryHigh;
}

/** So lệch >100 mg/dL với số đo liền trước cùng loại → hỏi xác nhận (plan.md §3.6). */
export function isSuspiciousJump(value: number, previousSameKind: number | null | undefined): boolean {
  if (previousSameKind === null || previousSameKind === undefined) return false;
  return Math.abs(value - previousSameKind) > 100;
}

/** Đoán loại bữa theo giờ hiện tại (người dùng sửa được sau). */
export function guessMealType(now: Date = new Date()): MealType {
  const h = now.getHours();
  if (h < 11) return "breakfast";
  if (h < 15) return "lunch";
  if (h < 21) return "dinner";
  return "snack";
}
