"use client";

// Thanh điều hướng đáy: Lịch sử · Cài đặt · [＋ Ghi đo — nút tròn nổi] · Giao diện · Đăng xuất.
// Nút tròn giữa xòe 2 lựa chọn (Trước ăn / Sau ăn), bấm ra ngoài để đóng.
import { useEffect, useState } from "react";
import { IconDrop, IconGear, IconHistory, IconLogout, IconMoon, IconPlus, IconSun, IconUtensils } from "./icons";

interface BottomNavProps {
  onOpenHistory: () => void;
  onOpenSettings: () => void;
  onOpenPre: () => void;
  onOpenPost: () => void;
  onLogout: () => void;
}

export default function BottomNav({ onOpenHistory, onOpenSettings, onOpenPre, onOpenPost, onLogout }: BottomNavProps) {
  const [dark, setDark] = useState(false);
  const [dialOpen, setDialOpen] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      /* bỏ qua */
    }
  };

  const items = [
    { key: "history", icon: <IconHistory className="h-5 w-5" />, label: "Lịch sử", onClick: onOpenHistory, danger: false },
    { key: "settings", icon: <IconGear className="h-5 w-5" />, label: "Cài đặt", onClick: onOpenSettings, danger: false },
    { key: "theme", icon: dark ? <IconSun className="h-5 w-5" /> : <IconMoon className="h-5 w-5" />, label: dark ? "Sáng" : "Tối", onClick: toggleTheme, danger: false },
    { key: "logout", icon: <IconLogout className="h-5 w-5" />, label: "Đăng xuất", onClick: onLogout, danger: true },
  ];

  return (
    <nav aria-label="Điều hướng" className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-card/95 backdrop-blur">
      <div className="mx-auto grid max-w-[680px] grid-cols-5 items-center px-2 pb-[max(0.375rem,env(safe-area-inset-bottom))] pt-1.5">
        {items.slice(0, 2).map((it) => (
          <NavItem key={it.key} {...it} />
        ))}

        {/* ---------- Nút ghi đo tròn nổi ở giữa (giữa Cài đặt và Giao diện) ---------- */}
        <div className="relative flex min-h-14 items-center justify-center">
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
            className="absolute -top-7 left-1/2 z-50 flex h-14 w-14 -translate-x-1/2 items-center justify-center rounded-full border-4 border-bg bg-primary text-on-primary shadow-ambient transition hover:bg-primary-strong"
          >
            <IconPlus className={`h-6 w-6 transition-transform duration-200 ${dialOpen ? "rotate-45" : ""}`} />
          </button>
        </div>

        {items.slice(2).map((it) => (
          <NavItem key={it.key} {...it} />
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
      className={`flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-lg text-[11px] font-semibold transition ${
        danger ? "text-error hover:bg-card-2" : "text-muted hover:bg-card-2 hover:text-primary"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
