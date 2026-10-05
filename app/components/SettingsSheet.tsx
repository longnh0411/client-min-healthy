"use client";

// Sheet Cài đặt: 2 phần — (1) Ngưỡng phân loại theo chỉ định bác sĩ,
// (2) Nhắc nhở đo (bật thông báo FCM + quản lý tối đa 6 mốc giờ).
import { useEffect, useState } from "react";
import BottomSheet from "./BottomSheet";
import { updateSettings } from "@/lib/api";
import { enableNotifications, disableNotifications, isMessagingConfigured } from "@/lib/notifications";
import { DEFAULT_THRESHOLDS, type GlucoseThresholds } from "@/lib/glucose";
import { REMINDER_KIND_LABELS, type GlucoseSettings, type GlucoseReminder, type ReminderKind } from "@/lib/types";

interface SettingsSheetProps {
  open: boolean;
  settings: GlucoseSettings;
  notificationsEnabled: boolean;
  onClose: () => void;
  onSaved: (settings: GlucoseSettings, notificationsEnabled: boolean) => void;
}

const THRESHOLD_FIELDS: { key: keyof GlucoseThresholds; label: string; hint: string }[] = [
  { key: "low", label: "Thấp <", hint: "mg/dL — dưới mức này là hạ đường huyết" },
  { key: "preMin", label: "Hơi thấp (trước ăn) <", hint: "mg/dL — đo trước ăn dưới mức này" },
  { key: "preMax", label: "Mục tiêu trước ăn ≤", hint: "mg/dL — đo trước ăn trong mục tiêu" },
  { key: "postMax", label: "Mục tiêu sau ăn ≤", hint: "mg/dL — đo sau ăn trong mục tiêu" },
  { key: "veryHigh", label: "Rất cao ≥", hint: "mg/dL — hiện cảnh báo an toàn" },
];

export default function SettingsSheet({
  open,
  settings,
  notificationsEnabled,
  onClose,
  onSaved,
}: SettingsSheetProps) {
  const [thresholds, setThresholds] = useState<GlucoseThresholds>(DEFAULT_THRESHOLDS);
  const [reminders, setReminders] = useState<GlucoseReminder[]>([]);
  const [notifOn, setNotifOn] = useState(notificationsEnabled);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setThresholds({
      low: settings.low,
      preMin: settings.preMin,
      preMax: settings.preMax,
      postMax: settings.postMax,
      veryHigh: settings.veryHigh,
    });
    setReminders(settings.reminders.map((r) => ({ ...r })));
    setNotifOn(notificationsEnabled);
    setError(null);
  }, [open, settings, notificationsEnabled]);

  const setField = (key: keyof GlucoseThresholds, v: string) => {
    const n = Number(v);
    setThresholds((t) => ({ ...t, [key]: Number.isFinite(n) && v !== "" ? Math.trunc(n) : t[key] }));
  };

  const toggleNotifications = async () => {
    setError(null);
    if (notifOn) {
      await disableNotifications();
      setNotifOn(false);
      return;
    }
    if (!isMessagingConfigured()) {
      setError("Chưa cấu hình Firebase/VAPID key — xem .env.example để biết cách lấy.");
      return;
    }
    const token = await enableNotifications();
    if (token) {
      setNotifOn(true);
    } else {
      setError("Bạn chưa cho phép thông báo — hãy bật quyền thông báo trong trình duyệt.");
    }
  };

  const addReminder = () => {
    if (reminders.length >= 6) return;
    setReminders((r) => [...r, { time: "07:30", kind: "pre", enabled: true }]);
  };

  const updateReminder = (idx: number, patch: Partial<GlucoseReminder>) => {
    setReminders((r) => r.map((x, i) => (i === idx ? { ...x, ...patch } : x)));
  };

  const removeReminder = (idx: number) => {
    setReminders((r) => r.filter((_, i) => i !== idx));
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const saved = await updateSettings({ ...thresholds, reminders });
      onSaved(saved, notifOn);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không lưu được cài đặt");
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheet open={open} title="Cài đặt" onClose={onClose}>
      <div className="space-y-5">
        {/* ---------- Ngưỡng phân loại ---------- */}
        <section>
          <h3 className="mb-1 text-sm font-bold">Ngưỡng đường huyết (mg/dL)</h3>
          <p className="mb-3 text-xs text-faint">
            Mặc định tham khảo ADA — hãy chỉnh theo chỉ định của bác sĩ điều trị.
          </p>
          <div className="space-y-2.5">
            {THRESHOLD_FIELDS.map((f) => (
              <div key={f.key} className="flex items-center gap-3">
                <label htmlFor={`th-${f.key}`} className="flex-1 text-sm">
                  {f.label}
                  <span className="block text-[11px] text-faint">{f.hint}</span>
                </label>
                <input
                  id={`th-${f.key}`}
                  type="number"
                  inputMode="numeric"
                  value={thresholds[f.key]}
                  onChange={(e) => setField(f.key, e.target.value)}
                  className="min-h-11 w-24 rounded-xl border border-line bg-panel px-3 text-center text-base outline-none focus:border-accent"
                />
              </div>
            ))}
          </div>
        </section>

        {/* ---------- Nhắc nhở đo ---------- */}
        <section>
          <div className="mb-1 flex items-center justify-between">
            <h3 className="text-sm font-bold">Nhắc nhở đo</h3>
            <button
              onClick={toggleNotifications}
              className={`min-h-9 rounded-full border px-3 text-xs font-semibold transition ${
                notifOn ? "border-accent bg-accent-soft text-accent" : "border-line text-muted hover:border-accent"
              }`}
            >
              {notifOn ? "🔔 Đang bật" : "🔕 Bật thông báo"}
            </button>
          </div>
          <p className="mb-3 text-xs text-faint">
            Bật thông báo để nhận push nhắc đo đúng giờ bạn đặt (tối đa 6 mốc).
          </p>

          <div className="space-y-2">
            {reminders.map((r, i) => (
              <div key={i} className="flex items-center gap-2 rounded-xl border border-line px-3 py-2">
                <input
                  aria-label="Giờ nhắc"
                  type="time"
                  value={r.time}
                  onChange={(e) => updateReminder(i, { time: e.target.value })}
                  className="min-h-10 rounded-lg border border-line bg-panel px-2 text-sm outline-none focus:border-accent"
                />
                <select
                  aria-label="Loại nhắc"
                  value={r.kind}
                  onChange={(e) => updateReminder(i, { kind: e.target.value as ReminderKind })}
                  className="min-h-10 flex-1 rounded-lg border border-line bg-panel px-2 text-sm outline-none focus:border-accent"
                >
                  {(Object.keys(REMINDER_KIND_LABELS) as ReminderKind[]).map((k) => (
                    <option key={k} value={k}>
                      {REMINDER_KIND_LABELS[k]}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => updateReminder(i, { enabled: !r.enabled })}
                  className={`min-h-10 rounded-lg px-2 text-sm transition ${r.enabled ? "text-accent" : "text-faint"}`}
                  aria-label={r.enabled ? "Tắt mốc này" : "Bật mốc này"}
                >
                  {r.enabled ? "Bật" : "Tắt"}
                </button>
                <button
                  type="button"
                  onClick={() => removeReminder(i)}
                  className="min-h-10 min-w-9 rounded-lg text-muted transition hover:text-neg"
                  aria-label="Xoá mốc này"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          {reminders.length < 6 && (
            <button
              onClick={addReminder}
              className="mt-2 min-h-10 w-full rounded-xl border border-dashed border-line text-sm text-muted transition hover:border-accent hover:text-accent"
            >
              + Thêm mốc nhắc
            </button>
          )}
        </section>

        {error && (
          <div className="rounded-lg border px-3 py-2 text-sm" role="alert" style={{ borderColor: "color-mix(in srgb, var(--neg) 40%, transparent)", background: "color-mix(in srgb, var(--neg) 8%, transparent)", color: "var(--neg)" }}>
            {error}
          </div>
        )}

        <button
          onClick={save}
          disabled={saving}
          className="min-h-12 w-full rounded-xl bg-accent text-base font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
        >
          {saving ? "Đang lưu…" : "Lưu cài đặt"}
        </button>
      </div>
    </BottomSheet>
  );
}
