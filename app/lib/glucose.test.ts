import { describe, it, expect } from "vitest";
import {
  classifyReading,
  estimateA1c,
  calcDelta,
  findPreviousMeal,
  isFastingSincePrevious,
  minutesAfterMeal,
  validateReadingValue,
  isDangerReading,
  isSuspiciousJump,
  guessMealType,
  timeInRange,
  previousReading,
  DEFAULT_THRESHOLDS,
  A1C_MIN_READINGS,
} from "./glucose";
import type { Meal } from "./types";

const T = DEFAULT_THRESHOLDS;

// ---------- classifyReading: mọi biên ngưỡng (plan.md §3.3) ----------
describe("classifyReading", () => {
  it("biên trước ăn: <70 Thấp, 70–79 Hơi thấp, 80 Trong mục tiêu, 130 Trong mục tiêu, 131 Cao, 181 Cao, 249 Cao, 250 Rất cao", () => {
    expect(classifyReading(69, "pre", T)).toBe("low");
    expect(classifyReading(70, "pre", T)).toBe("slightly_low");
    expect(classifyReading(79, "pre", T)).toBe("slightly_low");
    expect(classifyReading(80, "pre", T)).toBe("in_target");
    expect(classifyReading(130, "pre", T)).toBe("in_target");
    expect(classifyReading(131, "pre", T)).toBe("high");
    expect(classifyReading(181, "pre", T)).toBe("high");
    expect(classifyReading(249, "pre", T)).toBe("high");
    expect(classifyReading(250, "pre", T)).toBe("very_high");
  });

  it("biên sau ăn: 70–180 Trong mục tiêu, 181 Cao, 250 Rất cao (70 vẫn Thấp)", () => {
    expect(classifyReading(69, "post", T)).toBe("low");
    expect(classifyReading(70, "post", T)).toBe("in_target");
    expect(classifyReading(80, "post", T)).toBe("in_target");
    expect(classifyReading(180, "post", T)).toBe("in_target");
    expect(classifyReading(181, "post", T)).toBe("high");
    expect(classifyReading(249, "post", T)).toBe("high");
    expect(classifyReading(250, "post", T)).toBe("very_high");
  });

  it("ngưỡng chỉnh theo user vẫn phân loại đúng", () => {
    const custom = { low: 65, preMin: 90, preMax: 120, postMax: 160, veryHigh: 300 };
    expect(classifyReading(68, "pre", custom)).toBe("slightly_low");
    expect(classifyReading(165, "post", custom)).toBe("high");
    expect(classifyReading(295, "post", custom)).toBe("high");
    expect(classifyReading(305, "post", custom)).toBe("very_high");
  });
});

// ---------- estimateA1c (plan.md §3.4) ----------
describe("estimateA1c", () => {
  it("avg 154 mg/dL → 7.0%", () => {
    // (154 + 46.7) / 28.7 = 6.996... → 7.0
    const values = new Array(A1C_MIN_READINGS).fill(154);
    expect(estimateA1c(values)).toBe(7);
  });

  it("làm tròn 1 chữ số thập phân", () => {
    const values = new Array(A1C_MIN_READINGS).fill(160);
    // (160 + 46.7) / 28.7 = 7.202... → 7.2
    expect(estimateA1c(values)).toBe(7.2);
  });

  it("dưới 10 lần đo → null (Chưa đủ dữ liệu)", () => {
    expect(estimateA1c([100, 120, 130])).toBeNull();
    expect(estimateA1c(new Array(A1C_MIN_READINGS - 1).fill(154))).toBeNull();
  });

  it("đúng 10 lần đo → có kết quả", () => {
    expect(estimateA1c(new Array(A1C_MIN_READINGS).fill(100))).toBeCloseTo(5.1, 1);
  });
});

// ---------- calcDelta (plan.md §3.2) ----------
describe("calcDelta", () => {
  it("post − pre, dương có dấu xử lý ở fmtDelta", () => {
    expect(calcDelta({ value: 118 }, { value: 156 })).toBe(38);
    expect(calcDelta({ value: 150 }, { value: 122 })).toBe(-28);
  });

  it("thiếu pre hoặc post → null", () => {
    expect(calcDelta(null, { value: 156 })).toBeNull();
    expect(calcDelta({ value: 118 }, null)).toBeNull();
    expect(calcDelta(null, null)).toBeNull();
  });
});

// ---------- bữa trước + "Lúc đói" (plan.md §3.1) ----------
function meal(id: string, eatenAt: string, extra: Partial<Meal> = {}): Meal {
  return {
    id,
    mealType: "lunch",
    eatenAt,
    foods: "",
    note: "",
    photoUrl: null,
    pre: null,
    post: null,
    ...extra,
  };
}

describe("findPreviousMeal", () => {
  const meals = [
    meal("m1", "2026-10-04T11:30:00.000Z"),
    meal("m2", "2026-10-05T01:00:00.000Z"), // bữa sáng
    meal("m3", "2026-10-05T05:00:00.000Z"), // bữa trưa
    meal("m4", "2026-10-05T11:00:00.000Z"), // bữa tối
  ];

  it("bữa trước của bữa trưa là bữa sáng gần nhất trước đó", () => {
    const lunch = meals.find((m) => m.id === "m3")!;
    expect(findPreviousMeal(meals, lunch)?.id).toBe("m2");
  });

  it("bữa trước của bữa sáng là bữa tối hôm trước", () => {
    const breakfast = meals.find((m) => m.id === "m2")!;
    expect(findPreviousMeal(meals, breakfast)?.id).toBe("m1");
  });

  it("bữa đầu tiên → null", () => {
    expect(findPreviousMeal([meals[0]], meals[0])).toBeNull();
  });
});

describe("isFastingSincePrevious", () => {
  const prev = meal("p", "2026-10-04T22:00:00.000Z");

  it("≥ 8 giờ → lúc đói", () => {
    const cur = meal("c", "2026-10-05T06:01:00.000Z"); // 8h01 sau bữa trước
    expect(isFastingSincePrevious(prev, cur)).toBe(true);
  });

  it("< 8 giờ → không phải lúc đói", () => {
    const cur = meal("c", "2026-10-05T05:59:00.000Z"); // 7h59
    expect(isFastingSincePrevious(prev, cur)).toBe(false);
  });

  it("không có bữa trước → không lúc đói", () => {
    expect(isFastingSincePrevious(null, meal("c", "2026-10-05T06:01:00.000Z"))).toBe(false);
  });
});

// ---------- minutesAfterMeal (plan.md §3.2) ----------
describe("minutesAfterMeal", () => {
  it("12:00 ăn → 13:55 đo = 115 phút (hiện '1g 55p')", () => {
    expect(minutesAfterMeal("2026-10-05T05:00:00.000Z", "2026-10-05T06:55:00.000Z")).toBe(115);
  });

  it("đo trước giờ ăn (nhập bù sai) → kẹp về 0", () => {
    expect(minutesAfterMeal("2026-10-05T05:00:00.000Z", "2026-10-05T04:00:00.000Z")).toBe(0);
  });
});

// ---------- validate dữ liệu nhập (plan.md §3.6) ----------
describe("validateReadingValue", () => {
  it("số nguyên 20–600 hợp lệ", () => {
    expect(validateReadingValue(20)).toBeNull();
    expect(validateReadingValue("112")).toBeNull();
    expect(validateReadingValue(600)).toBeNull();
  });

  it("ngoài khoảng / không nguyên / rỗng → lỗi tiếng Việt", () => {
    expect(validateReadingValue("")).toBe("Nhập số đo đường huyết");
    expect(validateReadingValue(19)).toContain("20–600");
    expect(validateReadingValue(601)).toContain("20–600");
    expect(validateReadingValue(112.5)).toContain("số nguyên");
    expect(validateReadingValue("abc")).toBe("Nhập số đo đường huyết");
  });
});

describe("isDangerReading (banner an toàn — plan.md §3.5)", () => {
  it("< low hoặc ≥ veryHigh → nguy hiểm", () => {
    expect(isDangerReading(65, T)).toBe(true);
    expect(isDangerReading(70, T)).toBe(false);
    expect(isDangerReading(250, T)).toBe(true);
    expect(isDangerReading(249, T)).toBe(false);
  });
});

describe("isSuspiciousJump (xác nhận lệch >100 — plan.md §3.6)", () => {
  it("lệch > 100 so với đo trước cùng loại → đáng ngờ", () => {
    expect(isSuspiciousJump(250, 120)).toBe(true);
    expect(isSuspiciousJump(210, 120)).toBe(false);
    expect(isSuspiciousJump(120, null)).toBe(false);
  });
});

describe("guessMealType", () => {
  it("theo giờ máy: sáng/trưa/tối/khuya", () => {
    expect(guessMealType(new Date(2026, 9, 5, 7, 0))).toBe("breakfast");
    expect(guessMealType(new Date(2026, 9, 5, 12, 0))).toBe("lunch");
    expect(guessMealType(new Date(2026, 9, 5, 19, 0))).toBe("dinner");
    expect(guessMealType(new Date(2026, 9, 5, 23, 0))).toBe("snack");
  });
});

// ---------- timeInRange (thẻ tổng quan — design system) ----------
describe("timeInRange", () => {
  it("gom 5 mức phân loại về 3 nhóm: thấp (low+hơi thấp), mục tiêu, cao", () => {
    const readings = [
      { value: 65, kind: "pre" as const }, // low
      { value: 75, kind: "pre" as const }, // slightly_low
      { value: 100, kind: "pre" as const }, // in_target
      { value: 200, kind: "post" as const }, // high
      { value: 260, kind: "post" as const }, // very_high
    ];
    expect(timeInRange(readings, T)).toEqual({ low: 2, inRange: 1, high: 2, total: 5 });
  });

  it("danh sách rỗng → total 0", () => {
    expect(timeInRange([], T)).toEqual({ low: 0, inRange: 0, high: 0, total: 0 });
  });
});

// ---------- previousReading (xu hướng trên thẻ trạng thái) ----------
describe("previousReading", () => {
  const meals = [
    meal("m1", "2026-10-04T02:00:00.000Z", { pre: { value: 110, measuredAt: "2026-10-04T02:00:00.000Z" } }),
    meal("m2", "2026-10-04T10:00:00.000Z", { post: { value: 180, measuredAt: "2026-10-04T11:30:00.000Z" } }),
    meal("m3", "2026-10-05T02:00:00.000Z", { pre: { value: 95, measuredAt: "2026-10-05T02:00:00.000Z" } }),
  ];

  it("lần đo trước cùng loại ngay trước mốc mới nhất", () => {
    expect(previousReading(meals, "pre", "2026-10-05T02:00:00.000Z")).toEqual({
      value: 110,
      measuredAt: "2026-10-04T02:00:00.000Z",
    });
  });

  it("post riêng biệt với pre", () => {
    expect(previousReading(meals, "post", "2026-10-05T02:00:00.000Z")).toEqual({
      value: 180,
      measuredAt: "2026-10-04T11:30:00.000Z",
    });
  });

  it("không có số đo trước đó → null (kể cả chính mốc đó)", () => {
    expect(previousReading(meals, "pre", "2026-10-04T02:00:00.000Z")).toBeNull();
    expect(previousReading([], "pre", "2026-10-05T02:00:00.000Z")).toBeNull();
  });
});
