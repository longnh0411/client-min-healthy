import { describe, it, expect } from "vitest";
import {
  classifyReading,
  estimateA1c,
  calcDelta,
  findPreviousMeal,
  previousMealLabel,
  mealSortKey,
  minutesAfterMeal,
  validateReadingValue,
  validateNotFuture,
  validateThresholds,
  isDangerReading,
  isSuspiciousJump,
  guessMealType,
  timeInRange,
  previousReading,
  DEFAULT_THRESHOLDS,
} from "./glucose";
import type { Meal, MealType } from "./types";

const T = DEFAULT_THRESHOLDS;

// ---------- classifyReading: biên 4 mức theo BR-07 (TC-21/22) ----------
describe("classifyReading", () => {
  it("biên trước ăn: 69 Thấp, 70–130 Trong mục tiêu, 131–249 Cao, ≥250 Rất cao", () => {
    expect(classifyReading(69, "pre", T)).toBe("low");
    expect(classifyReading(70, "pre", T)).toBe("in_target");
    expect(classifyReading(130, "pre", T)).toBe("in_target");
    expect(classifyReading(131, "pre", T)).toBe("high");
    expect(classifyReading(249, "pre", T)).toBe("high");
    expect(classifyReading(250, "pre", T)).toBe("very_high");
  });

  it("biên sau ăn: 70–180 Trong mục tiêu, 181 Cao, 250 Rất cao", () => {
    expect(classifyReading(69, "post", T)).toBe("low");
    expect(classifyReading(70, "post", T)).toBe("in_target");
    expect(classifyReading(180, "post", T)).toBe("in_target");
    expect(classifyReading(181, "post", T)).toBe("high");
    expect(classifyReading(250, "post", T)).toBe("very_high");
  });

  it("ngưỡng chỉnh theo user vẫn phân loại đúng", () => {
    const custom = { low: 65, preMax: 120, postMax: 160, veryHigh: 300 };
    expect(classifyReading(64, "pre", custom)).toBe("low");
    expect(classifyReading(65, "pre", custom)).toBe("in_target");
    expect(classifyReading(165, "post", custom)).toBe("high");
    expect(classifyReading(299, "post", custom)).toBe("high");
    expect(classifyReading(300, "post", custom)).toBe("very_high");
  });
});

// ---------- estimateA1c: TB cân bằng + điều kiện BR-11 (TC-30) ----------
function labMeal(id: string, mealType: MealType, eatenAt: string, pre: number | null, post: number | null): Meal {
  const base = new Date(eatenAt);
  return {
    id,
    mealType,
    eatenAt,
    foods: "",
    note: "",
    photoUrl: null,
    pre: pre === null ? null : { value: pre, measuredAt: new Date(base.getTime() - 10 * 60000).toISOString() },
    post: post === null ? null : { value: post, measuredAt: new Date(base.getTime() + 100 * 60000).toISOString() },
  };
}

describe("estimateA1c (BR-10/11)", () => {
  const now = new Date("2026-10-05T10:00:00+07:00");

  it("TC-30: 10 pre=100 + 30 post=160 → 6.2% (TB cân bằng, không phải 6.7%)", () => {
    const meals: Meal[] = [];
    for (let d = 29; d >= 6; d--) {
      const t = new Date(now.getTime() - d * 86400000).toISOString();
      meals.push(labMeal(`p${d}`, "breakfast", t, 100, null));
    }
    for (let d = 29; d >= 0; d--) {
      const t = new Date(now.getTime() - d * 86400000).toISOString();
      meals.push(labMeal(`q${d}`, "lunch", t, null, 160));
    }
    const r = estimateA1c(meals, now);
    expect(r.value).toBe(6.2); // avg = (100+160)/2 = 130 → (130+46.7)/28.7 = 6.2
    expect(r.missing).toBeNull();
  });

  it("TB trước 120, TB sau 160 → 6.5%", () => {
    const meals: Meal[] = [];
    for (let d = 29; d >= 6; d--) {
      const t = new Date(now.getTime() - d * 86400000).toISOString();
      meals.push(labMeal(`a${d}`, "breakfast", t, 120, null));
      meals.push(labMeal(`b${d}`, "lunch", t, null, 160));
    }
    expect(estimateA1c(meals, now).value).toBe(6.5);
  });

  it("thiếu cả 3 tiêu chí → null + missing đủ pre/post/days", () => {
    const r = estimateA1c([], now);
    expect(r.value).toBeNull();
    expect(r.missing).toEqual({ pre: 10, post: 10, days: 13 });
  });

  it("≥10 pre + ≥10 post nhưng trải < 14 ngày → còn thiếu days", () => {
    const meals: Meal[] = [];
    for (let h = 0; h < 12; h++) {
      const t = new Date(now.getTime() - h * 3600000).toISOString();
      meals.push(labMeal(`x${h}`, "breakfast", t, 100, 160));
    }
    const r = estimateA1c(meals, now);
    expect(r.value).toBeNull();
    expect(r.missing).toEqual({ pre: 0, post: 0, days: 13 });
  });

  it("số đo ngoài cửa sổ 90 ngày không tính", () => {
    const meals: Meal[] = [];
    for (let d = 29; d >= 6; d--) {
      const t = new Date(now.getTime() - d * 86400000).toISOString();
      meals.push(labMeal(`a${d}`, "breakfast", t, 120, null));
      meals.push(labMeal(`b${d}`, "lunch", t, null, 160));
    }
    // entry 100 ngày trước — ngoài cửa sổ, không đổi kết quả
    meals.push(labMeal("old", "dinner", new Date(now.getTime() - 100 * 86400000).toISOString(), 400, 400));
    expect(estimateA1c(meals, now).value).toBe(6.5);
  });
});

// ---------- timeInRange (thẻ tổng quan) ----------
describe("timeInRange", () => {
  it("gom 4 mức về 3 nhóm: thấp, mục tiêu, cao (gồm rất cao)", () => {
    const readings = [
      { value: 65, kind: "pre" as const }, // low
      { value: 100, kind: "pre" as const }, // in_target
      { value: 200, kind: "post" as const }, // high
      { value: 260, kind: "post" as const }, // very_high → high
    ];
    expect(timeInRange(readings, T)).toEqual({ low: 1, inRange: 1, high: 2, total: 4 });
  });

  it("danh sách rỗng → total 0", () => {
    expect(timeInRange([], T)).toEqual({ low: 0, inRange: 0, high: 0, total: 0 });
  });
});

// ---------- calcDelta (BR-20) ----------
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

// ---------- Bữa trước theo (ngày, thứ tự buổi) — BR-08 ----------
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

describe("findPreviousMeal (BR-08 — thứ tự ngày + sáng→trưa→phụ→tối)", () => {
  // 04/10: sáng, trưa (không có tối) — 05/10: sáng
  const meals = [
    meal("m1", "2026-10-03T11:00:00", { mealType: "dinner" }), // Tối 03/10
    meal("m2", "2026-10-04T02:00:00", { mealType: "breakfast" }), // Sáng 04/10
    meal("m3", "2026-10-04T05:00:00", { mealType: "lunch" }), // Trưa 04/10
    meal("m4", "2026-10-05T02:00:00", { mealType: "breakfast" }), // Sáng 05/10
  ];

  it("bữa trước của Sáng 05/10 là Trưa 04/10 — khác ngày, bỏ qua buổi trống", () => {
    expect(findPreviousMeal(meals, meals[3])?.id).toBe("m3");
  });

  it("bữa trước của Trưa 04/10 là Sáng 04/10", () => {
    expect(findPreviousMeal(meals, meals[2])?.id).toBe("m2");
  });

  it("bữa trước của Sáng 04/10 là Tối 03/10 (khác ngày)", () => {
    expect(findPreviousMeal(meals, meals[1])?.id).toBe("m1");
  });

  it("bữa đầu tiên → null", () => {
    expect(findPreviousMeal([meals[0]], meals[0])).toBeNull();
  });

  it("mealSortKey theo thứ tự buổi sáng < trưa < phụ < tối", () => {
    const day = "2026-10-04";
    const k = (t: MealType) => mealSortKey(meal("x", `${day}T02:00:00`, { mealType: t }));
    expect(k("breakfast")).toBeLessThan(k("lunch"));
    expect(k("lunch")).toBeLessThan(k("snack"));
    expect(k("snack")).toBeLessThan(k("dinner"));
  });
});

describe("previousMealLabel (BR-08)", () => {
  const now = new Date("2026-10-05T20:00:00");

  it("hôm nay → 'Sáng nay'", () => {
    expect(previousMealLabel(meal("a", "2026-10-05T02:00:00", { mealType: "breakfast" }), now)).toBe("Sáng nay");
  });

  it("hôm qua → 'Trưa hôm qua'", () => {
    expect(previousMealLabel(meal("b", "2026-10-04T05:00:00", { mealType: "lunch" }), now)).toBe("Trưa hôm qua");
  });

  it("cũ hơn → 'Tối 03/10'", () => {
    expect(previousMealLabel(meal("c", "2026-10-03T11:00:00", { mealType: "dinner" }), now)).toBe("Tối 03/10");
  });
});

// ---------- previousReading (xu hướng thẻ trạng thái) ----------
describe("previousReading", () => {
  const meals = [
    meal("m1", "2026-10-04T02:00:00", { pre: { value: 110, measuredAt: "2026-10-04T02:00:00" } }),
    meal("m2", "2026-10-04T10:00:00", { post: { value: 180, measuredAt: "2026-10-04T11:30:00" } }),
    meal("m3", "2026-10-05T02:00:00", { pre: { value: 95, measuredAt: "2026-10-05T02:00:00" } }),
  ];

  it("lần đo trước cùng loại ngay trước mốc mới nhất", () => {
    expect(previousReading(meals, "pre", "2026-10-05T02:00:00")).toEqual({
      value: 110,
      measuredAt: "2026-10-04T02:00:00",
    });
  });

  it("post riêng biệt với pre", () => {
    expect(previousReading(meals, "post", "2026-10-05T02:00:00")).toEqual({
      value: 180,
      measuredAt: "2026-10-04T11:30:00",
    });
  });

  it("không có số đo trước đó → null (kể cả chính mốc đó)", () => {
    expect(previousReading(meals, "pre", "2026-10-04T02:00:00")).toBeNull();
    expect(previousReading([], "pre", "2026-10-05T02:00:00")).toBeNull();
  });
});

// ---------- minutesAfterMeal ----------
describe("minutesAfterMeal", () => {
  it("12:00 ăn → 13:55 đo = 115 phút", () => {
    expect(minutesAfterMeal("2026-10-05T05:00:00.000Z", "2026-10-05T06:55:00.000Z")).toBe(115);
  });

  it("đo trước giờ ăn (nhập bù sai) → kẹp về 0", () => {
    expect(minutesAfterMeal("2026-10-05T05:00:00.000Z", "2026-10-05T04:00:00.000Z")).toBe(0);
  });
});

// ---------- validate dữ liệu nhập (BR-01/04) ----------
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

describe("validateNotFuture (BR-04 / E-VAL-03)", () => {
  const now = new Date("2026-10-05T10:00:00");

  it("quá khứ / hiện tại hợp lệ", () => {
    expect(validateNotFuture(new Date("2026-10-05T09:59:00"), now)).toBeNull();
    expect(validateNotFuture(now, now)).toBeNull();
  });

  it("tương lai → lỗi", () => {
    expect(validateNotFuture(new Date("2026-10-05T10:00:01"), now)).toContain("tương lai");
    expect(validateNotFuture("not-a-date", now)).toContain("không hợp lệ");
  });
});

describe("isDangerReading (banner an toàn — BR-14)", () => {
  it("< low hoặc ≥ veryHigh → nguy hiểm; biên 70/249 không", () => {
    expect(isDangerReading(69, T)).toBe(true);
    expect(isDangerReading(70, T)).toBe(false);
    expect(isDangerReading(250, T)).toBe(true);
    expect(isDangerReading(249, T)).toBe(false);
  });
});

describe("isSuspiciousJump (xác nhận lệch >100 — BR-15)", () => {
  it("lệch > 100 so với đo trước cùng loại → đáng ngờ; đúng 100 không", () => {
    expect(isSuspiciousJump(250, 120)).toBe(true);
    expect(isSuspiciousJump(220, 120)).toBe(false);
    expect(isSuspiciousJump(120, null)).toBe(false);
  });
});

describe("guessMealType (BR-06)", () => {
  it("0–9:59 sáng, 10–13:59 trưa, 14–16:59 phụ, 17–23:59 tối", () => {
    expect(guessMealType(new Date(2026, 9, 5, 9, 59))).toBe("breakfast");
    expect(guessMealType(new Date(2026, 9, 5, 10, 0))).toBe("lunch");
    expect(guessMealType(new Date(2026, 9, 5, 13, 59))).toBe("lunch");
    expect(guessMealType(new Date(2026, 9, 5, 14, 0))).toBe("snack");
    expect(guessMealType(new Date(2026, 9, 5, 16, 59))).toBe("snack");
    expect(guessMealType(new Date(2026, 9, 5, 17, 0))).toBe("dinner");
    expect(guessMealType(new Date(2026, 9, 5, 23, 0))).toBe("dinner");
  });
});

// ---------- validateThresholds (BR-19) ----------
describe("validateThresholds (BR-19)", () => {
  it("bộ ngưỡng mặc định hợp lệ", () => {
    expect(validateThresholds(T)).toBeNull();
  });

  it("ngoài khoảng từng ngưỡng → lỗi", () => {
    expect(validateThresholds({ low: 49, preMax: 130, postMax: 180, veryHigh: 250 })).toContain("50–100");
    expect(validateThresholds({ low: 70, preMax: 190, postMax: 180, veryHigh: 250 })).toContain("100–180");
    expect(validateThresholds({ low: 70, preMax: 130, postMax: 110, veryHigh: 250 })).toContain("120–250");
    expect(validateThresholds({ low: 70, preMax: 130, postMax: 180, veryHigh: 500 })).toContain("200–400");
  });

  it("sai thứ tự (mọi ngưỡng vẫn trong khoảng) → E-VAL-05", () => {
    expect(validateThresholds({ low: 100, preMax: 100, postMax: 130, veryHigh: 250 })).toContain("thứ tự");
    expect(validateThresholds({ low: 70, preMax: 130, postMax: 250, veryHigh: 200 })).toContain("thứ tự");
  });
});
