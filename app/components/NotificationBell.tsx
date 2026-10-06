"use client";

// Chuông thông báo: dropdown danh sách in-app notification (GET /notification).
// Bấm 1 mục → đánh dấu đã đọc; nút "Đọc tất cả" khi còn chưa đọc.
import { useEffect, useRef, useState } from "react";
import { listNotifications, markAllNotificationsRead, markNotificationRead } from "@/lib/api";
import type { AppNotification } from "@/lib/types";
import { fmtRelative } from "@/lib/format";
import { IconBell } from "./icons";

export default function NotificationBell({ refreshKey }: { refreshKey: number }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[]>([]);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const load = async () => {
    try {
      setItems(await listNotifications());
    } catch {
      /* im lặng — dropdown vẫn mở ở trạng thái trống */
    }
  };

  useEffect(() => {
    load();
  }, [refreshKey]);

  // Đóng khi bấm ra ngoài
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const unread = items.filter((n) => !n.is_read).length;

  const markAll = async () => {
    try {
      await markAllNotificationsRead();
      setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch {
      /* bỏ qua */
    }
  };

  const markOne = async (id: string) => {
    if (items.find((n) => n.id === id)?.is_read) return;
    try {
      await markNotificationRead(id);
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    } catch {
      /* bỏ qua */
    }
  };

  return (
    <div className="relative" ref={wrapRef}>
      <button onClick={() => setOpen((v) => !v)} className="btn-ghost-icon relative" aria-label="Thông báo" aria-expanded={open}>
        <IconBell />
        {unread > 0 && (
          <span
            aria-hidden
            className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-strong px-1 text-[10px] font-bold text-white"
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-lg border border-line bg-card shadow-lg">
          <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
            <p className="text-sm font-semibold">Thông báo</p>
            {unread > 0 && (
              <button onClick={markAll} className="text-xs font-semibold text-primary hover:underline">
                Đọc tất cả
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-faint">Chưa có thông báo nào</p>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  onClick={() => markOne(n.id)}
                  className={`flex w-full gap-2.5 border-b border-line/60 px-4 py-3 text-left transition last:border-b-0 hover:bg-card-2 ${
                    n.is_read ? "" : "bg-primary-soft/40"
                  }`}
                >
                  <span aria-hidden className={`mt-1.5 h-2 w-2 flex-none rounded-full ${n.is_read ? "bg-transparent" : "bg-primary"}`} />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-ink">{n.title}</span>
                    <span className="block text-xs text-muted">{n.body}</span>
                    <span className="mt-0.5 block text-[11px] text-faint">{fmtRelative(n.createdAt)}</span>
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
