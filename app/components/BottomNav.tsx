"use client";

// Thanh điều hướng đáy: Lịch sử · Cài đặt · Giao diện (dark mode) · Đăng xuất.
// Mọi chức năng này chuyển từ header xuống đây theo yêu cầu UI.
import { useEffect, useState } from "react";
import { IconGear, IconHistory, IconLogout, IconMoon, IconSun } from "./icons";

interface BottomNavProps {
  onOpenHistory: () => void;
  onOpenSettings: () => void;
  onLogout: () => void;
}

export default function BottomNav({ onOpenHistory, onOpenSettings, onLogout }: BottomNavProps) {
  const [dark, setDark] = useState(false);

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
    {
      key: "theme",
      icon: dark ? <IconSun className="h-5 w-5" /> : <IconMoon className="h-5 w-5" />,
      label: dark ? "Sáng" : "Tối",
      onClick: toggleTheme,
      danger: false,
    },
    { key: "logout", icon: <IconLogout className="h-5 w-5" />, label: "Đăng xuất", onClick: onLogout, danger: true },
  ];

  return (
    <nav aria-label="Điều hướng" className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-card/95 backdrop-blur">
      <div className="mx-auto grid max-w-[680px] grid-cols-4 px-2 pb-[max(0.375rem,env(safe-area-inset-bottom))] pt-1.5">
        {items.map((it) => (
          <button
            key={it.key}
            onClick={it.onClick}
            className={`flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-lg text-[11px] font-semibold transition ${
              it.danger ? "text-error hover:bg-card-2" : "text-muted hover:bg-card-2 hover:text-primary"
            }`}
          >
            {it.icon}
            {it.label}
          </button>
        ))}
      </div>
    </nav>
  );
}
