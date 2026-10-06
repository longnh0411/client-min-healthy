"use client";

// Thanh điều hướng đáy: Lịch sử · Cài đặt · [＋ Ghi đo — nút tròn nổi] · Thông báo · Đăng xuất.
// Nút tròn giữa xòe 2 lựa chọn (Trước ăn / Sau ăn), bấm ra ngoài để đóng.
// Dark mode đã chuyển vào sheet Cài đặt; Thông báo mở sheet danh sách.
import { useState } from "react";
import { IconBell, IconDrop, IconGear, IconHistory, IconLogout, IconPlus, IconUtensils } from "./icons";

interface BottomNavProps {
  onOpenHistory: () => void;
  onOpenSettings: () => void;
  onOpenPre: () => void;
  onOpenPost: () => void;
  onOpenNotifications: () => void;
  notifUnread: number;
  onLogout: () => void;
}

export default function BottomNav({
  onOpenHistory,
  onOpenSettings,
  onOpenPre,
  onOpenPost,
  onOpenNotifications,
  notifUnread,
  onLogout,
}: BottomNavProps) {
  const [dialOpen, setDialOpen] = useState(false);

  const items = [
    { key: "history", icon: <IconHistory className="h-6 w-6" />, label: "Lịch sử", onClick: onOpenHistory, danger: false },
    { key: "settings", icon: <IconGear className="h-6 w-6" />, label: "Cài đặt", onClick: onOpenSettings, danger: false },
    {
      key: "notif",
      icon: (
        <span className="relative">
          <IconBell className="h-6 w-6" />
          {notifUnread > 0 && (
            <span
              aria-hidden
              className="absolute -right-1.5 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-strong px-1 text-[9px] font-bold text-white"
            >
              {notifUnread > 9 ? "9+" : notifUnread}
            </span>
          )}
        </span>
      ),
      label: "Thông báo",
      onClick: onOpenNotifications,
      danger: false,
    },
    { key: "logout", icon: <IconLogout className="h-6 w-6" />, label: "Đăng xuất", onClick: onLogout, danger: true },
  ];

  return (
    <nav aria-label="Điều hướng" className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-card/95 backdrop-blur">
      <div className="mx-auto grid max-w-[680px] grid-cols-5 items-center px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1">
        {items.slice(0, 2).map(({ key, ...rest }) => (
          <NavItem key={key} {...rest} />
        ))}

        {/* ---------- Nút ghi đo tròn nổi ở giữa (giữa Cài đặt và Thông báo) ---------- */}
        <div className="relative flex h-11 items-center justify-center">
          {dialOpen && (
            <>
              <button aria-hidden tabIndex={-1} className="fixed inset-0 z-40 cursor-default" onClick={() => setDialOpen(false)} />
              <div className="toast-pop absolute bottom-full left-1/2 z-50 mb-3 flex -translate-x-1/2 flex-col items-stretch gap-2">
                <button
                  onClick={() => {
                    setDialOpen(false);
                    onOpenPre();
                  }}
                  className="flex min-h-11 items-center gap-2 whitespace-nowrap rounded-full border border-line bg-card px-4 text-sm font-semibold text-ink shadow-lg transition hover:border-primary hover:text-primary"
                >
                  <IconDrop className="h-4 w-4 text-rose-strong" /> Đo trước ăn
                </button>
                <button
                  onClick={() => {
                    setDialOpen(false);
                    onOpenPost();
                  }}
                  className="flex min-h-11 items-center gap-2 whitespace-nowrap rounded-full border border-line bg-card px-4 text-sm font-semibold text-ink shadow-lg transition hover:border-primary hover:text-primary"
                >
                  <IconUtensils className="h-4 w-4 text-primary-strong" /> Đo sau ăn
                </button>
              </div>
            </>
          )}
          <button
            onClick={() => setDialOpen((v) => !v)}
            aria-label="Ghi số đo"
            aria-expanded={dialOpen}
            className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-bg bg-primary text-on-primary shadow-ambient ring-1 ring-line transition hover:bg-primary-strong"
          >
            <IconPlus className={`h-6 w-6 transition-transform duration-200 ${dialOpen ? "rotate-45" : ""}`} />
          </button>
        </div>

        {items.slice(2).map(({ key, ...rest }) => (
          <NavItem key={key} {...rest} />
        ))}
      </div>
    </nav>
  );
}

function NavItem({
  icon,
  label,
  onClick,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger: boolean;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`flex h-11 items-center justify-center rounded-lg transition ${
        danger ? "text-error hover:bg-card-2" : "text-muted hover:bg-card-2 hover:text-primary"
      }`}
    >
      {icon}
    </button>
  );
}
