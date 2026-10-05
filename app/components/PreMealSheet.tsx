"use client";

// Sheet "Đo trước ăn": số đo → loại bữa (tự đoán theo giờ, sửa được) → món ăn
// (tuỳ chọn) → ảnh (tuỳ chọn) → thời gian (mặc định bây giờ, sửa khi nhập bù).
// Ngay khi nhập số đo, hiện thẻ "Bữa trước" làm ngữ cảnh (plan.md §3.1/§5.3).
import { useMemo, useState } from "react";
import BottomSheet from "./BottomSheet";
import { createMeal } from "@/lib/api";
import { uploadMealPhoto } from "@/lib/upload";
import {
  validateReadingValue,
  isDangerReading,
  isSuspiciousJump,
  findPreviousMeal,
  isFastingSincePrevious,
  guessMealType,
} from "@/lib/glucose";
import { MEAL_TYPE_LABELS, type Meal, type MealType, type GlucoseSettings } from "@/lib/types";
import { toDatetimeLocal, fromDatetimeLocal, fmtGap, fmtTime } from "@/lib/format";

interface PreMealSheetProps {
  open: boolean;
  onClose: () => void;
  meals: Meal[];
  settings: GlucoseSettings;
  onSaved: (dangerValue: number | null) => void;
}

export default function PreMealSheet({ open, onClose, meals, settings, onSaved }: PreMealSheetProps) {
  const [value, setValue] = useState("");
  const [mealType, setMealType] = useState<MealType>("breakfast");
  const [foods, setFoods] = useState("");
  const [measuredAt, setMeasuredAt] = useState(toDatetimeLocal());
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmJump, setConfirmJump] = useState(false);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setValue("");
    setMealType(guessMealType());
    setFoods("");
    setMeasuredAt(toDatetimeLocal());
    setPhoto(null);
    setPhotoPreview(null);
    setError(null);
    setConfirmJump(false);
  };

  // Bữa "ảo" tại thời điểm đang nhập — để tìm bữa trước và tính lúc đói
  const pseudo: Meal = useMemo(
    () => ({
      id: "",
      mealType,
      eatenAt: fromDatetimeLocal(measuredAt),
      foods: "",
      note: "",
      photoUrl: null,
      pre: null,
      post: null,
    }),
    [mealType, measuredAt],
  );

  const prevMeal = useMemo(() => {
    if (!value) return null;
    return findPreviousMeal(meals, pseudo);
  }, [value, meals, pseudo]);

  const fasting = prevMeal ? isFastingSincePrevious(prevMeal, pseudo) : false;

  const handlePhoto = (f: File | undefined) => {
    if (!f) return;
    setPhoto(f);
    setPhotoPreview(URL.createObjectURL(f));
  };

  const submit = async () => {
    const err = validateReadingValue(value);
    if (err) {
      setError(err);
      return;
    }
    const v = Number(value);

    // Lệch >100 so với số đo trước cùng loại → hỏi xác nhận (plan.md §3.6)
    const lastPre = meals.find((m) => m.pre)?.pre?.value ?? null;
    if (!confirmJump && isSuspiciousJump(v, lastPre)) {
      setConfirmJump(true);
      setError("Bạn chắc chắn số này đúng?");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      let photoUrl: string | null = null;
      if (photo) {
        const uploaded = await uploadMealPhoto(photo);
        photoUrl = uploaded.publicUrl;
      }
      const created = await createMeal({
        mealType,
        eatenAt: fromDatetimeLocal(measuredAt),
        foods: foods.trim(),
        pre: { value: v, measuredAt: fromDatetimeLocal(measuredAt) },
        photoUrl,
      });
      reset();
      onSaved(isDangerReading(created.pre?.value ?? v, settings) ? v : null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không lưu được số đo");
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheet open={open} title="Đo trước ăn" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label htmlFor="pre-value" className="mb-1 block text-sm font-medium">
            Số đo đường huyết (mg/dL)
          </label>
          <input
            id="pre-value"
            type="number"
            inputMode="numeric"
            placeholder="112"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setError(null);
              setConfirmJump(false);
            }}
            className="reading-value w-full rounded-xl border border-line bg-panel px-4 py-3 outline-none focus:border-accent"
            autoFocus
          />
        </div>

        <div>
          <span className="mb-1 block text-sm font-medium">Bữa nào?</span>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(MEAL_TYPE_LABELS) as MealType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setMealType(t)}
                className={`min-h-11 rounded-xl border px-3 text-sm font-medium transition ${
                  mealType === t ? "border-accent bg-accent-soft text-accent" : "border-line hover:border-accent"
                }`}
              >
                {MEAL_TYPE_LABELS[t]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="pre-foods" className="mb-1 block text-sm font-medium">
            Món ăn (tuỳ chọn)
          </label>
          <input
            id="pre-foods"
            type="text"
            placeholder="Cơm, thịt kho, canh…"
            value={foods}
            onChange={(e) => setFoods(e.target.value)}
            className="min-h-11 w-full rounded-xl border border-line bg-panel px-3 text-base outline-none focus:border-accent"
          />
        </div>

        <div>
          <label htmlFor="pre-time" className="mb-1 block text-sm font-medium">
            Thời gian đo
          </label>
          <input
            id="pre-time"
            type="datetime-local"
            value={measuredAt}
            onChange={(e) => setMeasuredAt(e.target.value)}
            className="min-h-11 w-full rounded-xl border border-line bg-panel px-3 text-base outline-none focus:border-accent"
          />
        </div>

        <div>
          <span className="mb-1 block text-sm font-medium">Ảnh phần ăn (tuỳ chọn)</span>
          {photoPreview ? (
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photoPreview} alt="Ảnh bữa ăn" className="meal-photo !h-16 !w-16" />
              <button
                type="button"
                onClick={() => {
                  setPhoto(null);
                  setPhotoPreview(null);
                }}
                className="min-h-9 rounded-lg border border-line px-3 text-sm text-muted transition hover:border-neg hover:text-neg"
              >
                Xoá ảnh
              </button>
            </div>
          ) : (
            <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-dashed border-line px-4 text-sm text-muted transition hover:border-accent hover:text-accent">
              📷 Chọn ảnh
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => handlePhoto(e.target.files?.[0])}
              />
            </label>
          )}
        </div>

        {/* Ngữ cảnh bữa trước — giúp hiểu con số trước ăn */}
        {prevMeal && (
          <div className="rounded-xl border border-line bg-panel px-4 py-3 text-sm">
            <p className="font-medium">
              {fasting ? "⏱ Lúc đói" : `◂ Bữa trước: ${MEAL_TYPE_LABELS[prevMeal.mealType]} ${fmtTime(prevMeal.eatenAt)}`}
            </p>
            <p className="mt-0.5 text-xs text-faint">
              {prevMeal.foods ? `${prevMeal.foods} · ` : ""}
              cách {fmtGap(prevMeal.eatenAt, fromDatetimeLocal(measuredAt))}
              {prevMeal.post ? ` · sau bữa đó ${prevMeal.post.value} mg/dL` : ""}
            </p>
          </div>
        )}

        {error && (
          <div className="rounded-lg border px-3 py-2 text-sm" role="alert" style={{ borderColor: "color-mix(in srgb, var(--neg) 40%, transparent)", background: "color-mix(in srgb, var(--neg) 8%, transparent)", color: "var(--neg)" }}>
            {error}
          </div>
        )}

        <button
          onClick={submit}
          disabled={saving}
          className="min-h-12 w-full rounded-xl bg-accent text-base font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
        >
          {saving ? "Đang lưu…" : "Lưu số đo"}
        </button>
      </div>
    </BottomSheet>
  );
}
