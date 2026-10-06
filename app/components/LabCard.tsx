"use client";

// Thẻ HbA1c xét nghiệm (SRS C5, FR-LAB-01): kết quả gần nhất + nút thêm,
// chạm mở LabSheet xem danh sách đầy đủ.
import type { LabResult } from "@/lib/types";

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

export default function LabCard({ labs, onOpen }: { labs: LabResult[]; onOpen: () => void }) {
  const latest = labs[0] ?? null;

  return (
    <section className="rounded-lg border border-line bg-card px-5 py-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="label-caps text-faint">HbA1c xét nghiệm</h2>
        <button
          onClick={onOpen}
          className="inline-flex min-h-9 items-center rounded-full border-[1.5px] border-line px-3 text-xs font-semibold text-muted transition hover:border-primary hover:text-primary"
        >
          + Thêm kết quả
        </button>
      </div>

      {latest ? (
        <>
          <button onClick={onOpen} className="mt-2 flex items-baseline gap-2 text-left">
            <span className="reading-value">{latest.value.toFixed(1)}%</span>
            <span className="text-xs text-faint">
              {fmtDate(latest.testedAt)}
              {labs.length > 1 ? ` · ${labs.length} kết quả` : ""}
            </span>
          </button>
          {labs.length > 1 && (
            <button onClick={onOpen} className="mt-1 text-xs text-primary underline">
              Xem tất cả
            </button>
          )}
        </>
      ) : (
        <p className="mt-2 text-sm text-muted">Chưa có kết quả — thêm kết quả xét nghiệm gần nhất của bạn.</p>
      )}
    </section>
  );
}
