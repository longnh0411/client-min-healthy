"use client";

// Bottom sheet chung: backdrop + panel trượt từ dưới lên, drag handle, ESC/đám mây
// để đóng. Mọi form của app (đo trước ăn, đo sau ăn, sửa bữa, cài đặt) nằm trong sheet này.
import { useEffect, useState, type ReactNode } from "react";
import { IconX } from "./icons";

interface BottomSheetProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

export default function BottomSheet({ open, title, onClose, children }: BottomSheetProps) {
  const [closing, setClosing] = useState(false);

  // Animation đóng xong mới unmount để panel trượt xuống mượt
  const requestClose = () => {
    if (closing) return;
    setClosing(true);
    setTimeout(() => {
      setClosing(false);
      onClose();
    }, 180);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") requestClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, closing]);

  if (!open) return null;

  return (
    <div className={`fixed inset-0 z-50 ${closing ? "sheet-closing" : ""}`} role="dialog" aria-modal="true" aria-label={title}>
      <div className="sheet-backdrop absolute inset-0 bg-black/45" onClick={requestClose} />
      <div className="sheet-panel absolute inset-x-0 bottom-0 mx-auto flex max-h-[92dvh] w-full max-w-lg flex-col rounded-t-lg border border-line bg-card shadow-2xl">
        {/* drag handle — affordance vuốt xuống */}
        <div aria-hidden className="mx-auto mt-2.5 h-1 w-10 flex-none rounded-full bg-line" />
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
          <button onClick={requestClose} aria-label="Đóng" className="btn-ghost-icon">
            <IconX />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">{children}</div>
      </div>
    </div>
  );
}
