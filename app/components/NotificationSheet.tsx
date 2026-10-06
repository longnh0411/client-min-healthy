"use client";

// Sheet danh sách in-app notification (GET /notification) — mở từ bottom nav.
// Bấm 1 mục = đánh dấu đã đọc; nút "Đọc tất cả" khi còn mục chưa đọc.
import { useEffect, useState } from "react";
import BottomSheet from "./BottomSheet";
import { listNotifications, markAllNotificationsRead, markNotificationRead } from "@/lib/api";
import type { AppNotification } from "@/lib/types";
import { fmtRelative } from "@/lib/format";

interface NotificationSheetProps {
  open: boolean;
  onClose: () => void;
  /** Gọi sau khi trạng thái đọc thay đổi để nav cập nhật badge */
  onChanged?: () => void;
}

export default function NotificationSheet({ open, onClose, onChanged }: NotificationSheetProps) {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    listNotifications()
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [open]);

  const unread = items.filter((n) => !n.is_read).length;

  const markAll = async () => {
    try {
      await markAllNotificationsRead();
      setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
      onChanged?.();
    } catch {
      /* bỏ qua */
    }
  };

  const markOne = async (id: string) => {
    if (items.find((n) => n.id === id)?.is_read) return;
    try {
      await markNotificationRead(id);
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
      onChanged?.();
    } catch {
      /* bỏ qua */
    }
  };

  return (
    <BottomSheet open={open} title="Thông báo" onClose={onClose}>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted">
            {loading ? "Đang tải…" : unread > 0 ? `${unread} thông báo chưa đọc` : "Bạn đã đọc hết thông báo"}
          </p>
          {unread > 0 && (
            <button onClick={markAll} className="text-xs font-semibold text-primary hover:underline">
              Đọc tất cả
            </button>
          )}
        </div>

        {items.length === 0 && !loading ? (
          <p className="rounded-lg border border-dashed border-line px-4 py-10 text-center text-sm text-faint">
            Chưa có thông báo nào
          </p>
        ) : (
          <div className="space-y-2">
            {items.map((n) => (
              <button
                key={n.id}
                onClick={() => markOne(n.id)}
                className={`flex w-full gap-2.5 rounded-lg border px-4 py-3 text-left transition hover:border-primary/60 ${
                  n.is_read ? "border-line bg-card" : "border-primary/30 bg-primary-soft"
                }`}
              >
                <span
                  aria-hidden
                  className={`mt-1.5 h-2 w-2 flex-none rounded-full ${n.is_read ? "bg-transparent" : "bg-primary"}`}
                />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-ink">{n.title}</span>
                  <span className="block text-xs text-muted">{n.body}</span>
                  <span className="mt-0.5 block text-[11px] text-faint">{fmtRelative(n.createdAt)}</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </BottomSheet>
  );
}
