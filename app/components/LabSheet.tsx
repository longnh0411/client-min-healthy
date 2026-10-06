"use client";

// Sheet HbA1c xét nghiệm (SRS S5, FR-LAB-01…04):
// form thêm/sửa (ngày, giá trị %, ghi chú) + danh sách mới nhất trước,
// mức thay đổi so với kết quả liền trước + "App ước tính lúc đó" (Should).
import { useEffect, useMemo, useState } from "react";
import BottomSheet from "./BottomSheet";
import { createLab, deleteLab, listLabs, updateLab } from "@/lib/api";
import { estimateA1c, validateNotFuture } from "@/lib/glucose";
import type { LabResult, Meal } from "@/lib/types";
import { toDatetimeLocal } from "@/lib/format";

interface LabSheetProps {
  open: boolean;
  meals: Meal[];
  offline: boolean;
  onClose: () => void;
  /** Báo trang reload danh sách (badge/card) */
  onChanged?: () => void;
}

/** BR-10/11 trên cửa sổ 90 ngày KẾT THÚC tại ngày xét nghiệm → "App ước tính lúc đó: X%" */
function estimateAt(meals: Meal[], testedAt: string): number | null {
  const end = new Date(testedAt).getTime();
  const start = end - 90 * 86400000;
  const windowed = meals.map((m) => ({
    ...m,
    pre: m.pre && new Date(m.pre.measuredAt).getTime() >= start && new Date(m.pre.measuredAt).getTime() <= end ? m.pre : null,
    post: m.post && new Date(m.post.measuredAt).getTime() >= start && new Date(m.post.measuredAt).getTime() <= end ? m.post : null,
  }));
  return estimateA1c(windowed, new Date(end)).value;
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function fmtDelta1(v: number): string {
  return v >= 0 ? `+${v.toFixed(1)}` : `−${Math.abs(v).toFixed(1)}`;
}

export default function LabSheet({ open, meals, offline, onClose, onChanged }: LabSheetProps) {
  const [labs, setLabs] = useState<LabResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [value, setValue] = useState("");
  const [testedAt, setTestedAt] = useState(toDatetimeLocal(new Date()));
  const [note, setNote] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    listLabs()
      .then(setLabs)
      .catch(() => setLabs([]))
      .finally(() => setLoading(false));
  }, [open]);

  /** Reload danh sách sau thay đổi (nội bộ) */
  const reload = async () => {
    try {
      setLabs(await listLabs());
    } catch {
      setLabs([]);
    }
  };

  // Mức thay đổi = giá trị − kết quả liền trước theo testedAt (danh sách đã sort desc → dòng dưới liền trước)
  const rows = useMemo(    () =>
      labs.map((lab, i) => ({
        lab,
        delta: i < labs.length - 1 ? Math.round((lab.value - labs[i + 1].value) * 10) / 10 : null,
      })),
    [labs],
  );

  const resetForm = () => {
    setValue("");
    setTestedAt(toDatetimeLocal(new Date()));
    setNote("");
    setEditingId(null);
    setConfirmDeleteId(null);
    setError(null);
  };

  const startEdit = (lab: LabResult) => {
    setEditingId(lab.id);
    setValue(String(lab.value));
    setTestedAt(toDatetimeLocal(new Date(lab.testedAt)));
    setNote(lab.note ?? "");
    setConfirmDeleteId(null);
    setError(null);
  };

  const submit = async () => {
    const n = Number(value);
    if (value === "" || !Number.isFinite(n)) {
      setError("Nhập giá trị HbA1c");
      return;
    }
    if (n < 3 || n > 20) {
      setError("Giá trị HbA1c phải trong khoảng 3.0–20.0%");
      return;
    }
    const timeErr = validateNotFuture(testedAt);
    if (timeErr) {
      setError(timeErr);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = { value: Math.round(n * 10) / 10, testedAt: new Date(testedAt).toISOString(), note: note.trim() };
      if (editingId) {
        await updateLab(editingId, payload);
      } else {
        await createLab(payload);
      }
      resetForm();
      await reload();
      onChanged?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không lưu được kết quả");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id);
      return;
    }
    try {
      await deleteLab(id);
      if (editingId === id) resetForm();
      setConfirmDeleteId(null);
      await reload();
      onChanged?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không xoá được kết quả");
    }
  };

  return (
    <BottomSheet open={open} title="HbA1c xét nghiệm" onClose={onClose}>
      <div className="space-y-4">
        {/* ---------- Form thêm / sửa ---------- */}
        <div className="rounded-lg border border-line bg-card-2/50 p-4 space-y-3">
          <p className="text-sm font-semibold">{editingId ? "Sửa kết quả" : "Thêm kết quả"}</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="lab-value" className="mb-1 block text-sm font-semibold">
                Giá trị %
              </label>
              <input
                id="lab-value"
                type="number"
                inputMode="decimal"
                step="0.1"
                placeholder="6.5"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="field"
              />
            </div>
            <div>
              <label htmlFor="lab-date" className="mb-1 block text-sm font-semibold">
                Ngày xét nghiệm
              </label>
              <input
                id="lab-date"
                type="datetime-local"
                value={testedAt}
                onChange={(e) => setTestedAt(e.target.value)}
                className="field"
              />
            </div>
          </div>
          <div>
            <label htmlFor="lab-note" className="mb-1 block text-sm font-semibold">
              Ghi chú (tuỳ chọn)
            </label>
            <input
              id="lab-note"
              type="text"
              maxLength={200}
              placeholder="Xét nghiệm tại…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="field"
            />
          </div>
          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}
          <div className="flex gap-2">
            {editingId && (
              <button
                onClick={resetForm}
                className="inline-flex min-h-11 items-center rounded-full border-[1.5px] border-line px-4 text-sm text-muted transition hover:border-primary hover:text-primary"
              >
                Huỷ sửa
              </button>
            )}
            <button onClick={submit} disabled={saving || offline} className="btn-primary flex-1">
              {offline ? "Đang offline" : saving ? "Đang lưu…" : editingId ? "Lưu sửa" : "Thêm kết quả"}
            </button>
          </div>
        </div>

        {/* ---------- Danh sách: mới nhất trước ---------- */}
        <div className="space-y-2">
          {loading ? (
            <p className="py-6 text-center text-sm text-faint">Đang tải…</p>
          ) : rows.length === 0 ? (
            <p className="rounded-lg border border-dashed border-line px-4 py-8 text-center text-sm text-faint">
              Chưa có kết quả xét nghiệm
            </p>
          ) : (
            rows.map(({ lab, delta }) => {
              const estimate = estimateAt(meals, lab.testedAt);
              return (
                <div key={lab.id} className="rounded-lg border border-line bg-card px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[22px] font-bold tabular-nums leading-none">
                      {lab.value.toFixed(1)}
                      <span className="ml-1 text-sm font-normal text-muted">%</span>
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => startEdit(lab)}
                        className="min-h-9 rounded-lg px-2 text-xs font-semibold text-primary transition hover:bg-card-2"
                      >
                        Sửa
                      </button>
                      <button
                        onClick={() => remove(lab.id)}
                        className={`min-h-9 rounded-lg border px-2.5 text-xs font-semibold transition ${
                          confirmDeleteId === lab.id
                            ? "border-rose-strong bg-rose-strong text-white"
                            : "border-line text-muted hover:border-rose hover:text-rose"
                        }`}
                      >
                        {confirmDeleteId === lab.id ? "Chắc chắn?" : "Xoá"}
                      </button>
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-faint">
                    {fmtDate(lab.testedAt)}
                    {delta !== null && (
                      <span className={`ml-2 font-semibold ${delta < 0 ? "text-primary" : "text-rose-strong"}`}>
                        {fmtDelta1(delta)} so với lần trước
                      </span>
                    )}
                    {lab.note ? ` · ${lab.note}` : ""}
                  </p>
                  <p className="mt-0.5 text-[11px] text-faint">
                    App ước tính lúc đó:{" "}
                    {estimate !== null ? (
                      <span className="font-semibold text-ink">{estimate.toFixed(1)}%</span>
                    ) : (
                      "—"
                    )}
                  </p>
                </div>
              );
            })
          )}
        </div>
      </div>
    </BottomSheet>
  );
}
