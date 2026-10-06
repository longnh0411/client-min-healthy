"use client";

// Sheet Cài đặt: 3 phần — (1) Giao diện sáng/tối, (2) Ngưỡng phân loại theo
// chỉ định bác sĩ, (3) Nhắc nhở đo (bật thông báo FCM + tối đa 6 mốc giờ).
import { useEffect, useState } from "react";
import BottomSheet from "./BottomSheet";
import { IconMoon, IconSun } from "./icons";
import { updateSettings } from "@/lib/api";
import { enableNotifications, disableNotifications, isMessagingConfigured } from "@/lib/notifications";
import { DEFAULT_THRESHOLDS, validateThresholds, type GlucoseThresholds } from "@/lib/glucose";
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
  { key: "preMax", label: "Mục tiêu trước ăn ≤", hint: "mg/dL — đo trước ăn trong mục tiêu" },
  { key: "postMax", label: "Mục tiêu sau ăn ≤", hint: "mg/dL — đo sau ăn trong mục tiêu" },
  { key: "veryHigh", label: "Rất cao ≥", hint: "mg/dL — hiện cảnh báo an toàn" },
];

/** Toggle switch (selection control của design system: 24px vùng chạm, track mint khi bật) */
function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 flex-none rounded-full border transition ${
        checked ? "border-primary bg-primary" : "border-line bg-card-2"
      }`}
    >
      <span
        className={`absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full transition-all ${
          checked ? "left-[calc(100%-1.25rem)] bg-on-primary" : "left-1 bg-faint"
        }`}
      />
    </button>
  );
}

export default function SettingsSheet({ open, settings, notificationsEnabled, onClose, onSaved }: SettingsSheetProps) {
  const [thresholds, setThresholds] = useState<GlucoseThresholds>(DEFAULT_THRESHOLDS);
  const [reminders, setReminders] = useState<GlucoseReminder[]>([]);
  const [notifOn, setNotifOn] = useState(notificationsEnabled);
  const [dark, setDark] = useState(false);
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
    setReminders(settings.reminders.map((r) => ({ ...r })));
    setNotifOn(notificationsEnabled);
    setDark(document.documentElement.classList.contains("dark"));
    setError(null);
  }, [open, settings, notificationsEnabled]);

  const setTheme = (next: boolean) => {
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      /* bỏ qua */
    }
  };

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
    const err = validateThresholds(thresholds);
    if (err) {
      setError(err);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      // Giữ nguyên preMin cũ (client không còn dùng để phân loại — BR-07 4 mức)
      const saved = await updateSettings({ ...thresholds, preMin: settings.preMin, reminders });
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
        {/* ---------- Giao diện ---------- */}
        <section>
          <h3 className="mb-2 text-sm font-bold">Giao diện</h3>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className="pick justify-center" data-on={!dark} onClick={() => setTheme(false)}>
              <IconSun className="h-4 w-4" /> Sáng
            </button>
            <button type="button" className="pick justify-center" data-on={dark} onClick={() => setTheme(true)}>
              <IconMoon className="h-4 w-4" /> Tối
            </button>
          </div>
        </section>

        {/* ---------- Ngưỡng phân loại ---------- */}
        <section>
          <h3 className="mb-1 text-sm font-bold">Ngưỡng đường huyết (mg/dL)</h3>
          <p className="mb-3 text-xs text-faint">Mặc định tham khảo ADA — hãy chỉnh theo chỉ định của bác sĩ điều trị.</p>
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
                  className="field !w-24 text-center"
                />
              </div>
            ))}
          </div>
        </section>

        {/* ---------- Nhắc nhở đo ---------- */}
        <section>
          <div className="mb-1 flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold">Nhắc nhở đo</h3>
            <button
              onClick={toggleNotifications}
              className={`inline-flex min-h-9 items-center rounded-full border-[1.5px] px-3 text-xs font-bold transition ${
                notifOn ? "border-primary bg-primary-soft text-primary" : "border-line text-muted hover:border-primary"
              }`}
            >
              {notifOn ? "🔔 Đang bật" : "🔕 Bật thông báo"}
            </button>
          </div>
          <p className="mb-3 text-xs text-faint">Bật thông báo để nhận push nhắc đo đúng giờ bạn đặt (tối đa 6 mốc).</p>

          <div className="space-y-2">
            {reminders.map((r, i) => (
              <div key={i} className="flex items-center gap-2 rounded-md border border-line px-3 py-2">
                <input
                  aria-label="Giờ nhắc"
                  type="time"
                  value={r.time}
                  onChange={(e) => updateReminder(i, { time: e.target.value })}
                  className="field !min-h-10 !w-[6.2rem] !px-2 !text-sm"
                />
                <select
                  aria-label="Loại nhắc"
                  value={r.kind}
                  onChange={(e) => updateReminder(i, { kind: e.target.value as ReminderKind })}
                  className="field !min-h-10 flex-1 !px-2 !text-sm"
                >
                  {(Object.keys(REMINDER_KIND_LABELS) as ReminderKind[]).map((k) => (
                    <option key={k} value={k}>
                      {REMINDER_KIND_LABELS[k]}
                    </option>
                  ))}
                </select>
                <Switch checked={r.enabled} onChange={(v) => updateReminder(i, { enabled: v })} label={`Bật mốc nhắc ${r.time}`} />
                <button
                  type="button"
                  onClick={() => removeReminder(i)}
                  className="inline-flex h-10 w-9 flex-none items-center justify-center rounded-md text-muted transition hover:text-rose"
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
              className="mt-2 min-h-10 w-full rounded-full border-[1.5px] border-dashed border-line text-sm text-muted transition hover:border-primary hover:text-primary"
            >
              + Thêm mốc nhắc
            </button>
          )}
        </section>

        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}

        <button onClick={save} disabled={saving} className="btn-primary w-full">
          {saving ? "Đang lưu…" : "Lưu cài đặt"}
        </button>
      </div>
    </BottomSheet>
  );
}
