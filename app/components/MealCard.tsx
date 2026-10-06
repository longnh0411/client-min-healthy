"use client";

// Thẻ 1 bữa ăn trong lịch sử: loại bữa + giờ, món, pre → post (+độ chênh),
// chip trạng thái từng số đo, ngữ cảnh "bữa trước" cho số đo trước ăn (plan.md §3.1),
// ảnh phần ăn (nếu có). Bấm thẻ → mở sheet sửa/xoá.
import { MEAL_TYPE_LABELS, type Meal, type GlucoseSettings } from "@/lib/types";
import {
  classifyReading,
  STATUS_META,
  calcDelta,
  findPreviousMeal,
  isFastingSincePrevious,
  minutesAfterMeal,
} from "@/lib/glucose";
import { fmtTime, fmtDelta, fmtDuration, fmtGap } from "@/lib/format";

interface MealCardProps {
  meal: Meal;
  meals: Meal[];
  settings: GlucoseSettings;
  onEdit: (meal: Meal) => void;
}

function ReadingRow({
  label,
  reading,
  kind,
  settings,
  eatenAt,
}: {
  label: string;
  reading: { value: number; measuredAt: string };
  kind: "pre" | "post";
  settings: GlucoseSettings;
  eatenAt: string;
}) {
  const meta = STATUS_META[classifyReading(reading.value, kind, settings)];
  const extra =
    kind === "post" ? ` · sau ăn ${fmtDuration(minutesAfterMeal(eatenAt, reading.measuredAt))}` : "";
  return (
    <span className="inline-flex items-baseline gap-1">
      <span className="text-xs text-muted">{label}</span>
      <strong className="text-[22px] font-bold tabular-nums leading-none">{reading.value}</strong>
      <span className={`chip ${meta.chip}`}>{meta.label}</span>
      {extra && <span className="text-[11px] text-faint">{extra}</span>}
    </span>
  );
}

export default function MealCard({ meal, meals, settings, onEdit }: MealCardProps) {
  const delta = calcDelta(meal.pre, meal.post);
  const prev = findPreviousMeal(meals, meal);
  const fasting = isFastingSincePrevious(prev, meal);
  const deltaArrow = delta === null ? "" : delta > 0 ? "↗" : delta < 0 ? "↘" : "→";

  return (
    <button
      onClick={() => onEdit(meal)}
      className="w-full rounded-lg border border-line bg-card px-4 py-3.5 text-left transition hover:border-primary/60 active:bg-card-2"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-semibold">{MEAL_TYPE_LABELS[meal.mealType]}</span>
            <span className="text-xs text-faint">{fmtTime(meal.eatenAt)}</span>
            <span className="ml-auto text-xs text-faint">Sửa ›</span>
          </div>

          {meal.foods && <p className="mt-0.5 text-sm text-muted">{meal.foods}</p>}
          {meal.note && <p className="mt-0.5 text-xs text-faint">📝 {meal.note}</p>}

          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            {meal.pre ? (
              <ReadingRow label="Trước" reading={meal.pre} kind="pre" settings={settings} eatenAt={meal.eatenAt} />
            ) : (
              <span className="text-xs text-faint">Chưa đo trước ăn</span>
            )}
            {meal.pre && meal.post && (
              <span className="text-xs font-semibold tabular-nums text-muted">
                {deltaArrow} {fmtDelta(delta)}
              </span>
            )}
            {meal.post && <ReadingRow label="Sau" reading={meal.post} kind="post" settings={settings} eatenAt={meal.eatenAt} />}
          </div>

          {/* Ngữ cảnh cho số đo trước ăn: bữa trước đó (tính khi hiển thị, không lưu) */}
          {meal.pre && (
            <p className="mt-1.5 text-xs text-faint">
              {prev
                ? fasting
                  ? `⏱ Lúc đói — bữa trước: ${fmtGap(prev.eatenAt, meal.eatenAt)} trước`
                  : `◂ Bữa trước: ${MEAL_TYPE_LABELS[prev.mealType]} ${fmtTime(prev.eatenAt)}${prev.foods ? ` (${prev.foods})` : ""} — cách ${fmtGap(prev.eatenAt, meal.eatenAt)}${prev.post ? ` · sau ăn ${prev.post.value}` : ""}`
                : "⏱ Chưa có bữa trước trong dữ liệu"}
            </p>
          )}
        </div>

        {meal.photoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={meal.photoUrl} alt={`Ảnh ${MEAL_TYPE_LABELS[meal.mealType].toLowerCase()}`} className="meal-photo" loading="lazy" />
        )}
      </div>
    </button>
  );
}
