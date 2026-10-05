"use client";

// Sheet sửa/xoá bữa ăn: chỉnh mọi trường (loại bữa, giờ ăn, món, ghi chú, ảnh,
// số đo trước/sau + thời gian đo). Xoá có xác nhận 2 bước.
import { useEffect, useState } from "react";
import BottomSheet from "./BottomSheet";
import { updateMeal, deleteMeal } from "@/lib/api";
import { uploadMealPhoto } from "@/lib/upload";
import { validateReadingValue } from "@/lib/glucose";
import { MEAL_TYPE_LABELS, type Meal, type MealType } from "@/lib/types";
import { toDatetimeLocal, fromDatetimeLocal } from "@/lib/format";

interface EditMealSheetProps {
  meal: Meal | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function EditMealSheet({ meal, onClose, onSaved }: EditMealSheetProps) {
  const [mealType, setMealType] = useState<MealType>("breakfast");
  const [eatenAt, setEatenAt] = useState(toDatetimeLocal());
  const [foods, setFoods] = useState("");
  const [note, setNote] = useState("");
  const [preValue, setPreValue] = useState("");
  const [preAt, setPreAt] = useState(toDatetimeLocal());
  const [postValue, setPostValue] = useState("");
  const [postAt, setPostAt] = useState(toDatetimeLocal());
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);

  // Đổ dữ liệu bữa ăn vào form mỗi khi mở
  useEffect(() => {
    if (!meal) return;
    setMealType(meal.mealType);
    setEatenAt(toDatetimeLocal(new Date(meal.eatenAt)));
    setFoods(meal.foods ?? "");
    setNote(meal.note ?? "");
    setPreValue(meal.pre ? String(meal.pre.value) : "");
    setPreAt(meal.pre ? toDatetimeLocal(new Date(meal.pre.measuredAt)) : toDatetimeLocal(new Date(meal.eatenAt)));
    setPostValue(meal.post ? String(meal.post.value) : "");
    setPostAt(meal.post ? toDatetimeLocal(new Date(meal.post.measuredAt)) : toDatetimeLocal());
    setPhotoUrl(meal.photoUrl);
    setError(null);
    setConfirmDelete(false);
  }, [meal]);

  if (!meal) return null;

  const submit = async () => {
    const preErr = preValue ? validateReadingValue(preValue) : null;
    if (preErr) {
      setError(`Số đo trước ăn: ${preErr}`);
      return;
    }
    const postErr = postValue ? validateReadingValue(postValue) : null;
    if (postErr) {
      setError(`Số đo sau ăn: ${postErr}`);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await updateMeal(meal.id, {
        mealType,
        eatenAt: fromDatetimeLocal(eatenAt),
        foods: foods.trim(),
        note: note.trim(),
        photoUrl,
        pre: preValue ? { value: Number(preValue), measuredAt: fromDatetimeLocal(preAt) } : null,
        post: postValue ? { value: Number(postValue), measuredAt: fromDatetimeLocal(postAt) } : null,
      });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không lưu được thay đổi");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setSaving(true);
    try {
      await deleteMeal(meal.id);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không xoá được bữa ăn");
      setSaving(false);
    }
  };

  const handleUpload = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const uploaded = await uploadMealPhoto(file);
      setPhotoUrl(uploaded.publicUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không tải được ảnh");
    } finally {
      setUploading(false);
    }
  };

  return (
    <BottomSheet open title={`Sửa ${MEAL_TYPE_LABELS[meal.mealType].toLowerCase()}`} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <span className="mb-1 block text-sm font-medium">Bữa</span>
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
          <label htmlFor="edit-eaten" className="mb-1 block text-sm font-medium">
            Thời điểm ăn
          </label>
          <input
            id="edit-eaten"
            type="datetime-local"
            value={eatenAt}
            onChange={(e) => setEatenAt(e.target.value)}
            className="min-h-11 w-full rounded-xl border border-line bg-panel px-3 text-base outline-none focus:border-accent"
          />
        </div>

        <div>
          <label htmlFor="edit-foods" className="mb-1 block text-sm font-medium">
            Món ăn
          </label>
          <input
            id="edit-foods"
            type="text"
            value={foods}
            onChange={(e) => setFoods(e.target.value)}
            className="min-h-11 w-full rounded-xl border border-line bg-panel px-3 text-base outline-none focus:border-accent"
          />
        </div>

        <div>
          <label htmlFor="edit-note" className="mb-1 block text-sm font-medium">
            Ghi chú (thuốc, vận động…)
          </label>
          <input
            id="edit-note"
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="min-h-11 w-full rounded-xl border border-line bg-panel px-3 text-base outline-none focus:border-accent"
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="edit-pre" className="mb-1 block text-sm font-medium">
              Trước ăn (mg/dL)
            </label>
            <input
              id="edit-pre"
              type="number"
              inputMode="numeric"
              placeholder="Bỏ trống = xoá"
              value={preValue}
              onChange={(e) => setPreValue(e.target.value)}
              className="min-h-11 w-full rounded-xl border border-line bg-panel px-3 text-base outline-none focus:border-accent"
            />
            {preValue && (
              <input
                aria-label="Thời gian đo trước ăn"
                type="datetime-local"
                value={preAt}
                onChange={(e) => setPreAt(e.target.value)}
                className="mt-1.5 min-h-10 w-full rounded-lg border border-line bg-panel px-2 text-sm outline-none focus:border-accent"
              />
            )}
          </div>
          <div>
            <label htmlFor="edit-post" className="mb-1 block text-sm font-medium">
              Sau ăn (mg/dL)
            </label>
            <input
              id="edit-post"
              type="number"
              inputMode="numeric"
              placeholder="Bỏ trống = xoá"
              value={postValue}
              onChange={(e) => setPostValue(e.target.value)}
              className="min-h-11 w-full rounded-xl border border-line bg-panel px-3 text-base outline-none focus:border-accent"
            />
            {postValue && (
              <input
                aria-label="Thời gian đo sau ăn"
                type="datetime-local"
                value={postAt}
                onChange={(e) => setPostAt(e.target.value)}
                className="mt-1.5 min-h-10 w-full rounded-lg border border-line bg-panel px-2 text-sm outline-none focus:border-accent"
              />
            )}
          </div>
        </div>

        <div>
          <span className="mb-1 block text-sm font-medium">Ảnh phần ăn</span>
          <div className="flex items-center gap-3">
            {photoUrl ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photoUrl} alt="Ảnh bữa ăn" className="meal-photo !h-16 !w-16" loading="lazy" />
                <button
                  type="button"
                  onClick={() => setPhotoUrl(null)}
                  className="min-h-9 rounded-lg border border-line px-3 text-sm text-muted transition hover:border-neg hover:text-neg"
                >
                  Xoá ảnh
                </button>
              </>
            ) : (
              <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-dashed border-line px-4 text-sm text-muted transition hover:border-accent hover:text-accent">
                {uploading ? "Đang tải…" : "📷 Thêm ảnh"}
                <input type="file" accept="image/*" className="hidden" disabled={uploading} onChange={(e) => handleUpload(e.target.files?.[0])} />
              </label>
            )}
          </div>
        </div>

        {error && (
          <div className="rounded-lg border px-3 py-2 text-sm" role="alert" style={{ borderColor: "color-mix(in srgb, var(--neg) 40%, transparent)", background: "color-mix(in srgb, var(--neg) 8%, transparent)", color: "var(--neg)" }}>
            {error}
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={handleDelete}
            disabled={saving}
            className={`min-h-12 rounded-xl border px-4 text-sm font-semibold transition disabled:opacity-60 ${
              confirmDelete ? "border-neg bg-neg text-white" : "border-line text-muted hover:border-neg hover:text-neg"
            }`}
          >
            {confirmDelete ? "Bấm lần nữa để xoá" : "Xoá"}
          </button>
          <button
            onClick={submit}
            disabled={saving}
            className="min-h-12 flex-1 rounded-xl bg-accent text-base font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
          >
            {saving ? "Đang lưu…" : "Lưu thay đổi"}
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}
