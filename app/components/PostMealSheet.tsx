"use client";

// Sheet "Đo sau ăn": gắn vào bữa gần nhất CHƯA có số đo sau ăn (đổi được trong
// 5 bữa gần nhất), số đo + thời gian mặc định "bây giờ" kèm nhãn "sau ăn X phút".
// Chip chọn bữa kèm giờ để phân biệt khi trùng loại bữa.
import { useState } from "react";
import BottomSheet from "./BottomSheet";
import { updateMeal } from "@/lib/api";
import { validateReadingValue, isDangerReading, isSuspiciousJump, minutesAfterMeal } from "@/lib/glucose";
import { MEAL_TYPE_LABELS, type Meal } from "@/lib/types";
import { toDatetimeLocal, fromDatetimeLocal, fmtDuration, fmtTime } from "@/lib/format";

interface PostMealSheetProps {
  open: boolean;
  onClose: () => void;
  /** 5 bữa gần nhất để chọn gắn (mặc định chọn bữa đầu chưa có post) */
  recentMeals: Meal[];
  onSaved: (dangerValue: number | null) => void;
}

export default function PostMealSheet({ open, onClose, recentMeals, onSaved }: PostMealSheetProps) {
  const defaultMeal = recentMeals.find((m) => !m.post) ?? recentMeals[0] ?? null;
  const [mealId, setMealId] = useState<string | null>(null);
  const [value, setValue] = useState("");
  const [measuredAt, setMeasuredAt] = useState(toDatetimeLocal());
  const [error, setError] = useState<string | null>(null);
  const [confirmJump, setConfirmJump] = useState(false);
  const [saving, setSaving] = useState(false);

  const selected = recentMeals.find((m) => m.id === (mealId ?? defaultMeal?.id)) ?? defaultMeal;
  const afterMinutes = selected ? minutesAfterMeal(selected.eatenAt, fromDatetimeLocal(measuredAt)) : 0;

  const reset = () => {
    setMealId(null);
    setValue("");
    setMeasuredAt(toDatetimeLocal());
    setError(null);
    setConfirmJump(false);
  };

  const submit = async () => {
    if (!selected) {
      setError("Chưa có bữa ăn nào để gắn số đo sau ăn");
      return;
    }
    const err = validateReadingValue(value);
    if (err) {
      setError(err);
      return;
    }
    const v = Number(value);

    const lastPost = recentMeals.find((m) => m.post)?.post?.value ?? null;
    if (!confirmJump && isSuspiciousJump(v, lastPost)) {
      setConfirmJump(true);
      setError("Bạn chắc chắn số này đúng?");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const updated = await updateMeal(selected.id, {
        post: { value: v, measuredAt: fromDatetimeLocal(measuredAt) },
      });
      reset();
      onSaved(isDangerReading(updated.post?.value ?? v) ? v : null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không lưu được số đo");
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheet open={open} title="Đo sau ăn" onClose={onClose}>
      <div className="space-y-4">
        {recentMeals.length === 0 ? (
          <p className="text-sm text-muted">Chưa có bữa ăn nào. Hãy bấm “Đo trước ăn” để ghi bữa trước đã.</p>
        ) : (
          <>
            <div>
              <span className="mb-1.5 block text-sm font-semibold">Gắn vào bữa</span>
              <div className="flex flex-wrap gap-2">
                {recentMeals.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className={`pick ${m.post ? "opacity-50" : ""}`}
                    data-on={(mealId ?? defaultMeal?.id) === m.id}
                    onClick={() => setMealId(m.id)}
                  >
                    {MEAL_TYPE_LABELS[m.mealType]} · {fmtTime(m.eatenAt)}
                    {m.post ? " ✓" : ""}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="post-value" className="mb-1 block text-sm font-semibold">
                Số đo đường huyết (mg/dL)
              </label>
              <input
                id="post-value"
                type="number"
                inputMode="numeric"
                placeholder="156"
                value={value}
                onChange={(e) => {
                  setValue(e.target.value);
                  setError(null);
                  setConfirmJump(false);
                }}
                className="field reading-value !py-2.5"
                autoFocus
              />
            </div>

            <div>
              <label htmlFor="post-time" className="mb-1 block text-sm font-semibold">
                Thời gian đo
              </label>
              <input
                id="post-time"
                type="datetime-local"
                value={measuredAt}
                onChange={(e) => setMeasuredAt(e.target.value)}
                className="field"
              />
              {selected && (
                <p className="mt-1 text-xs text-faint">
                  {afterMinutes >= 0
                    ? `Sau ăn ${fmtDuration(afterMinutes)} so với ${MEAL_TYPE_LABELS[selected.mealType].toLowerCase()}`
                    : "Trước giờ ăn — hãy kiểm tra lại thời gian"}
                </p>
              )}
            </div>

            {error && (
              <div className="form-error" role="alert">
                {error}
              </div>
            )}

            <button onClick={submit} disabled={saving || !selected} className="btn-primary w-full">
              {saving ? "Đang lưu…" : "Lưu số đo"}
            </button>
          </>
        )}
      </div>
    </BottomSheet>
  );
}
