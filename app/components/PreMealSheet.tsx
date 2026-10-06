"use client";

// Sheet "Đo trước ăn" (SRS S2): số đo → loại bữa (tự đoán theo giờ BR-06, sửa được)
// → món ăn (≤200) → ghi chú (≤300) → thời gian (không tương lai BR-04) → ảnh (tuỳ chọn).
// Validate theo thứ tự: BR-01 → BR-04 → BR-15 (lệch >100) → BR-17 (trùng buổi đã có số đo).
import { useMemo, useState } from "react";
import BottomSheet from "./BottomSheet";
import { IconCamera, IconX } from "./icons";
import { createMeal } from "@/lib/api";
import { uploadMealPhoto } from "@/lib/upload";
import {
  validateReadingValue,
  validateNotFuture,
  isDangerReading,
  isSuspiciousJump,
  findPreviousMeal,
  previousMealLabel,
  guessMealType,
} from "@/lib/glucose";
import { MEAL_TYPE_LABELS, type Meal, type MealType, type GlucoseSettings } from "@/lib/types";
import { dayKey, toDatetimeLocal, fromDatetimeLocal } from "@/lib/format";

interface PreMealSheetProps {
  open: boolean;
  onClose: () => void;
  meals: Meal[];
  settings: GlucoseSettings;
  /** Mất mạng → vô hiệu nút Lưu (FR-NET-01) */
  offline: boolean;
  onSaved: (dangerValue: number | null) => void;
}

export default function PreMealSheet({ open, onClose, meals, settings, offline, onSaved }: PreMealSheetProps) {
  const [value, setValue] = useState("");
  const [mealType, setMealType] = useState<MealType>("breakfast");
  const [foods, setFoods] = useState("");
  const [note, setNote] = useState("");
  const [measuredAt, setMeasuredAt] = useState(toDatetimeLocal());
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmJump, setConfirmJump] = useState(false);
  const [confirmDup, setConfirmDup] = useState(false);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setValue("");
    setMealType(guessMealType());
    setFoods("");
    setNote("");
    setMeasuredAt(toDatetimeLocal());
    setPhoto(null);
    setPhotoPreview(null);
    setError(null);
    setConfirmJump(false);
    setConfirmDup(false);
  };

  // Bữa "ảo" tại thời điểm đang nhập — để tìm bữa trước làm ngữ cảnh (BR-08)
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

  const handlePhoto = (f: File | undefined) => {
    if (!f) return;
    setPhoto(f);
    setPhotoPreview(URL.createObjectURL(f));
  };

  /** BR-17 (adapted): đã có entry cùng ngày + cùng buổi có số đo trước → hỏi xác nhận. */
  const hasDuplicatePre = () =>
    meals.some(
      (m) => m.pre && dayKey(m.eatenAt) === dayKey(pseudo.eatenAt) && m.mealType === mealType,
    );

  const submit = async () => {
    const err = validateReadingValue(value);
    if (err) {
      setError(err);
      return;
    }
    const v = Number(value);

    const timeErr = validateNotFuture(measuredAt);
    if (timeErr) {
      setError(timeErr);
      return;
    }

    // BR-15: lệch >100 so với số đo pre gần nhất → hỏi xác nhận
    const lastPre = meals.find((m) => m.pre)?.pre?.value ?? null;
    if (!confirmJump && isSuspiciousJump(v, lastPre)) {
      setConfirmJump(true);
      setError("Bạn chắc chắn số này đúng?");
      return;
    }

    // BR-17: buổi này hôm đó đã có số đo trước → hỏi xác nhận trước khi thêm
    if (!confirmDup && hasDuplicatePre()) {
      setConfirmDup(true);
      setError(
        `Buổi ${MEAL_TYPE_LABELS[mealType].toLowerCase()} hôm nay đã có số đo trước ăn. Vẫn lưu thêm?`,
      );
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
        note: note.trim(),
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
          <label htmlFor="pre-value" className="mb-1 block text-sm font-semibold">
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
              setConfirmDup(false);
            }}
            className="field reading-value !py-2.5"
            autoFocus
          />
        </div>

        <div>
          <span className="mb-1.5 block text-sm font-semibold">Bữa nào?</span>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(MEAL_TYPE_LABELS) as MealType[]).map((t) => (
              <button key={t} type="button" className="pick" data-on={mealType === t} onClick={() => setMealType(t)}>
                {MEAL_TYPE_LABELS[t]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="pre-foods" className="mb-1 block text-sm font-semibold">
            Món ăn (tuỳ chọn)
          </label>
          <input
            id="pre-foods"
            type="text"
            maxLength={200}
            placeholder="Cơm, thịt kho, canh…"
            value={foods}
            onChange={(e) => setFoods(e.target.value)}
            className="field"
          />
        </div>

        <div>
          <label htmlFor="pre-note" className="mb-1 block text-sm font-semibold">
            Ghi chú (tuỳ chọn)
          </label>
          <input
            id="pre-note"
            type="text"
            maxLength={300}
            placeholder="Thuốc, vận động…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="field"
          />
        </div>

        <div>
          <label htmlFor="pre-time" className="mb-1 block text-sm font-semibold">
            Thời gian đo
          </label>
          <input
            id="pre-time"
            type="datetime-local"
            value={measuredAt}
            onChange={(e) => setMeasuredAt(e.target.value)}
            className="field"
          />
        </div>

        <div>
          <span className="mb-1.5 block text-sm font-semibold">Ảnh phần ăn (tuỳ chọn)</span>
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
                className="inline-flex min-h-9 items-center gap-1.5 rounded-full border-[1.5px] border-line px-3 text-sm text-muted transition hover:border-rose hover:text-rose"
              >
                <IconX className="h-4 w-4" /> Xoá ảnh
              </button>
            </div>
          ) : (
            <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border-[1.5px] border-dashed border-line px-4 text-sm text-muted transition hover:border-primary hover:text-primary">
              <IconCamera className="h-4.5 w-4.5" /> Chọn ảnh
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

        {/* Ngữ cảnh bữa trước — BR-08, tính khi hiển thị */}
        {value && prevMeal && (
          <div className="rounded-md bg-card-2 px-4 py-3 text-sm">
            <p className="font-semibold">
              ▸ Bữa trước: {prevMeal.foods ? `${prevMeal.foods} · ` : ""}
              {previousMealLabel(prevMeal, new Date())}
              {prevMeal.post ? ` · sau ăn ${prevMeal.post.value} mg/dL` : ""}
            </p>
          </div>
        )}

        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}

        <button
          onClick={submit}
          disabled={saving || offline}
          className="btn-primary w-full"
          title={offline ? "Đang offline" : undefined}
        >
          {offline ? "Đang offline — không thể lưu" : saving ? "Đang lưu…" : "Lưu số đo"}
        </button>
      </div>
    </BottomSheet>
  );
}
