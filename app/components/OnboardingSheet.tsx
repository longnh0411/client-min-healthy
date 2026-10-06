"use client";

// Onboarding S1 (FR-SET-02): sheet "Mục tiêu theo bác sĩ" tự mở lần đầu.
// Điền sẵn ngưỡng ADA — người dùng xác nhận → lưu settings + không hiện lại.
import { useEffect, useState } from "react";
import BottomSheet from "./BottomSheet";
import { updateSettings } from "@/lib/api";
import { DEFAULT_THRESHOLDS, validateThresholds, type GlucoseThresholds } from "@/lib/glucose";
import type { GlucoseSettings } from "@/lib/types";

const FIELDS: { key: keyof GlucoseThresholds; label: string }[] = [
  { key: "low", label: "Thấp <" },
  { key: "preMax", label: "Mục tiêu trước ăn ≤" },
  { key: "postMax", label: "Mục tiêu sau ăn ≤" },
  { key: "veryHigh", label: "Rất cao ≥" },
];

export default function OnboardingSheet({
  open,
  settings,
  onClose,
}: {
  open: boolean;
  settings: GlucoseSettings;
  onClose: (saved: GlucoseSettings) => void;
}) {
  const [thresholds, setThresholds] = useState<GlucoseThresholds>(DEFAULT_THRESHOLDS);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setThresholds({
      low: settings.low,
      preMax: settings.preMax,
      postMax: settings.postMax,
      veryHigh: settings.veryHigh,
    });
    setError(null);
  }, [open, settings]);

  const save = async () => {
    const err = validateThresholds(thresholds);
    if (err) {
      setError(err);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const saved = await updateSettings({
        ...thresholds,
        preMin: settings.preMin,
        reminders: settings.reminders,
      });
      try {
        localStorage.setItem("onboarded", "1");
      } catch {
        /* bỏ qua */
      }
      onClose(saved);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không lưu được cài đặt");
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheet open={open} title="Mục tiêu đường huyết" onClose={() => onClose(settings)}>
      <div className="space-y-4">
        <p className="text-sm text-muted">
          Giá trị gợi ý theo ADA. Hãy dùng mục tiêu bác sĩ đã đặt cho bạn — chỉnh lại rồi bấm bắt đầu.
        </p>
        <div className="space-y-2.5">
          {FIELDS.map((f) => (
            <div key={f.key} className="flex items-center gap-3">
              <label htmlFor={`ob-${f.key}`} className="flex-1 text-sm">
                {f.label}
              </label>
              <input
                id={`ob-${f.key}`}
                type="number"
                inputMode="numeric"
                value={thresholds[f.key]}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  setThresholds((t) => ({ ...t, [f.key]: Number.isFinite(n) && e.target.value !== "" ? Math.trunc(n) : t[f.key] }));
                }}
                className="field !w-28 text-center"
              />
            </div>
          ))}
        </div>
        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}
        <button onClick={save} disabled={saving} className="btn-primary w-full">
          {saving ? "Đang lưu…" : "Bắt đầu sử dụng"}
        </button>
        <p className="text-center text-[11px] text-faint">Có thể chỉnh lại bất cứ lúc nào trong Cài đặt.</p>
      </div>
    </BottomSheet>
  );
}
