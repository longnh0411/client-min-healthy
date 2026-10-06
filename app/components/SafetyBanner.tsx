"use client";

// Banner an toàn: hiện khi lưu số đo < low hoặc ≥ veryHigh (plan.md §3.5).
// Nền hồng mềm (#FFF1F2 theo DESIGN.md), accent rose — không tư vấn liều thuốc.
import { IconWarn } from "./icons";

export default function SafetyBanner({ value, onClose }: { value: number; onClose: () => void }) {
  return (
    <div
      className="flex items-start gap-3 rounded-lg border px-4 py-3 text-sm"
      style={{
        borderColor: "color-mix(in srgb, var(--rose) 35%, transparent)",
        background: "var(--rose-soft)",
      }}
      role="alert"
    >
      <IconWarn className="mt-0.5 flex-none text-rose-strong" />
      <div className="flex-1">
        <p className="font-semibold" style={{ color: "var(--rose-strong)" }}>
          Số đo {value} mg/dL ngoài vùng an toàn
        </p>
        <p className="mt-0.5" style={{ color: "var(--muted)" }}>
          Hãy xử trí theo hướng dẫn của bác sĩ. Nếu có triệu chứng nặng (lú lẫn, ngất, khó thở…), gọi cấp cứu{" "}
          <a href="tel:115" className="font-bold underline" style={{ color: "var(--rose-strong)" }}>
            115
          </a>
          .
        </p>
      </div>
      <button
        onClick={onClose}
        aria-label="Đóng cảnh báo"
        className="flex h-7 w-7 flex-none items-center justify-center rounded-full text-muted transition hover:bg-black/5 dark:hover:bg-white/10"
      >
        ✕
      </button>
    </div>
  );
}
