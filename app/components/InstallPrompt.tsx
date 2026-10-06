"use client";

// Gợi ý cài PWA: beforeinstallprompt (Android/Chrome) hoặc hướng dẫn iOS
// "Thêm vào Màn hình chính". Người dùng tắt thì nhớ vào localStorage.
// Nền mint wash (#E6F4EA theo DESIGN.md) — banner động viên, không phải cảnh báo.
import { useEffect, useState } from "react";
import { IconDownload } from "./icons";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "install_dismissed";

export default function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);

  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      /* bỏ qua */
    }
    if (dismissed) return;

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    // iOS Safari không có beforeinstallprompt — hiện hướng dẫn thủ công
    const isIos = /iphone|ipad|ipod/i.test(window.navigator.userAgent);
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches;
    if (isIos && !isStandalone) setShowIosHint(true);

    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  const dismiss = () => {
    setDeferred(null);
    setShowIosHint(false);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* bỏ qua */
    }
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
  };

  if (!deferred && !showIosHint) return null;

  return (
    <div
      className="mb-4 flex items-start gap-3 rounded-lg border px-4 py-3 text-sm"
      style={{
        borderColor: "color-mix(in srgb, var(--primary) 30%, transparent)",
        background: "var(--primary-soft)",
      }}
    >
      <IconDownload className="mt-0.5 flex-none text-primary" />
      {deferred ? (
        <div className="flex-1">
          <p className="font-medium">Cài “Ngọt vừa thui” vào máy để mở nhanh hơn?</p>
          <div className="mt-2 flex gap-2">
            <button
              onClick={install}
              className="inline-flex min-h-9 items-center rounded-full bg-primary px-4 text-sm font-bold text-on-primary shadow-ambient transition hover:bg-primary-strong"
            >
              Cài ngay
            </button>
            <button onClick={dismiss} className="inline-flex min-h-9 items-center rounded-full px-3 text-sm text-muted transition hover:text-ink">
              Để sau
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1">
          <p className="font-medium">Cài lên màn hình chính</p>
          <p className="mt-0.5 text-muted">
            Trên iPhone: bấm nút <strong>Chia sẻ</strong> ↓ rồi chọn <strong>“Thêm vào Màn hình chính”</strong>.
          </p>
          <button onClick={dismiss} className="mt-1.5 text-xs text-faint underline">
            Đã biết, ẩn đi
          </button>
        </div>
      )}
    </div>
  );
}
