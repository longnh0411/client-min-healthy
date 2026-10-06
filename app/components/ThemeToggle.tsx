"use client";

// Đổi sáng/tối — port từ ThemeToggle của client-mim-trading (giữ đơn giản: không
// dùng View Transitions để tránh phụ thuộc API chưa phổ biến).
import { useEffect, useState } from "react";
import { IconMoon, IconSun } from "./icons";

export default function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      /* bỏ qua */
    }
  };

  return (
    <button
      onClick={toggle}
      aria-label={dark ? "Chế độ sáng" : "Chế độ tối"}
      title={dark ? "Chế độ sáng" : "Chế độ tối"}
      className="btn-ghost-icon"
    >
      {dark ? <IconSun /> : <IconMoon />}
    </button>
  );
}
