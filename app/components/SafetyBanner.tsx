"use client";

// Banner an toàn: hiện khi lưu số đo < low hoặc ≥ veryHigh (plan.md §3.5).
// Chỉ nhắc xử trí theo hướng dẫn bác sĩ + số cấp cứu — không tư vấn liều thuốc.
export default function SafetyBanner({ value, onClose }: { value: number; onClose: () => void }) {
  return (
    <div
      className="flex items-start gap-3 rounded-xl border px-4 py-3 text-sm"
      style={{
        borderColor: "color-mix(in srgb, var(--neg) 45%, transparent)",
        background: "color-mix(in srgb, var(--neg) 10%, transparent)",
      }}
      role="alert"
    >
      <span className="text-lg leading-none">⚠️</span>
      <div className="flex-1">
        <p className="font-semibold" style={{ color: "var(--neg)" }}>
          Số đo {value} mg/dL ngoài vùng an toàn
        </p>
        <p className="mt-0.5" style={{ color: "var(--muted)" }}>
          Hãy xử trí theo hướng dẫn của bác sĩ. Nếu có triệu chứng nặng (lú lẫn, ngất, khó thở…), gọi cấp cứu{" "}
          <a href="tel:115" className="font-bold underline" style={{ color: "var(--neg)" }}>
            115
          </a>
          .
        </p>
      </div>
      <button
        onClick={onClose}
        aria-label="Đóng cảnh báo"
        className="flex h-7 w-7 flex-none items-center justify-center rounded-md text-muted transition hover:bg-black/10"
      >
        ✕
      </button>
    </div>
  );
}
