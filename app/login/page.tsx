"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { isLoggedIn } from "@/lib/session";
import { signInWithGoogle, resolveGoogleRedirect, friendlyAuthError } from "@/lib/firebase";
import { ApiError, googleLogin as apiGoogleLogin } from "@/lib/api";
import { IconBell, IconDrop, IconTrend } from "@/components/icons";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [terms, setTerms] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Toast kiểu Android: hiện ngắn rồi tự ẩn */
  const showToast = (msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2800);
  };

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  const finishLogin = () => {
    const from = new URLSearchParams(window.location.search).get("from");
    // replace (không phải assign) — bỏ /login khỏi history để Back không quay lại đây
    window.location.replace(from && from.startsWith("/") ? from : "/");
  };

  // Đã login mà vẫn còn phiên Firebase redirect (popup bị chặn lần trước) → xử lý nốt
  useEffect(() => {
    const check = () => {
      if (isLoggedIn()) window.location.replace("/");
    };
    check();
    // Back/forward có thể khôi phục trang từ bfcache — JS không chạy lại,
    // phải re-check qua pageshow để không hiện trang login cho người đã login
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) check();
    };
    window.addEventListener("pageshow", onPageShow);
    if (isLoggedIn()) return () => window.removeEventListener("pageshow", onPageShow);

    resolveGoogleRedirect()
      .then((idToken) => {
        if (!idToken) return;
        setLoading(true);
        return apiGoogleLogin(idToken).then(finishLogin);
      })
      .catch((e) => {
        console.error("Đăng nhập Google lỗi:", e); // log gốc cho dev, user chỉ thấy thông điệp thân thiện
        setError(e instanceof ApiError ? e.message : friendlyAuthError(e));
        setLoading(false);
      });
    return () => window.removeEventListener("pageshow", onPageShow);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleGoogle = async () => {
    if (!terms) {
      showToast("Bạn cần tick đồng ý Điều khoản & Chính sách bảo mật trước nhé");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const idToken = await signInWithGoogle();
      if (!idToken) return; // đã chuyển hướng redirect — trang sẽ load lại
      await apiGoogleLogin(idToken);
      finishLogin();
    } catch (e) {
      console.error("Đăng nhập Google lỗi:", e);
      const code = (e as { code?: string })?.code ?? "";
      const msg = e instanceof Error ? e.message : "";
      if (code === "auth/popup-blocked" || msg.includes("popup")) {
        setError("Popup bị chặn — đang chuyển hướng, đợi chút nhé…");
      } else if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
        setError(friendlyAuthError(e));
        setLoading(false);
      } else {
        setError(e instanceof ApiError ? e.message : friendlyAuthError(e));
        setLoading(false);
      }
    }
  };

  return (
    /* Neo cố định toàn màn hình (class .login-page: fixed inset-0) — tài liệu
       không còn chiều cao để cuộn; nội dung vừa → không cuộn, thiếu chỗ thì
       cuộn bên trong cột 412px với nền riêng */
    <main className="login-page flex select-none justify-center overflow-hidden bg-bg dark:bg-[#0F172A]">
      <div className="login-canvas relative flex h-full w-full max-w-[412px] flex-col bg-bg shadow-2xl dark:bg-[#0F172A]">
        {/* ---------- Vệt gradient ambient: hồng / mint / container (design system) ----------
            wrapper overflow-hidden để blob nhô ra ngoài (−bottom-24…) không làm
            cột tính nhầm chiều cao cuộn → hiện scrollbar ảo ---------- */}
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="blob-rose absolute -right-20 -top-24 h-72 w-72 rounded-full blur-3xl" />
          <div className="blob-mint absolute -left-28 top-1/3 h-80 w-80 rounded-full blur-3xl" />
          <div className="blob-dim absolute -bottom-24 right-0 h-64 w-64 rounded-full blur-2xl" />
        </div>

        <main className="z-10 flex flex-1 flex-col px-5 pb-5 pt-5">
          {/* ---------- Logo + thương hiệu + 3 thẻ tính năng — giữa màn hình ---------- */}
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <div className="group relative my-1">
              <div aria-hidden className="logo-halo absolute -inset-2 rounded-full blur-md" />
              <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl border border-line/30 bg-card p-2 shadow-sm backdrop-blur-sm dark:border-slate-700/60 dark:bg-slate-800/80 dark:shadow-lg">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/icon-192.png"
                  alt="Biểu tượng giọt máu Ngọt vừa thui"
                  className="h-full w-full rounded-2xl object-contain drop-shadow-sm transition-transform duration-300 group-hover:scale-105 dark:drop-shadow-md"
                />
              </div>
            </div>

            <div className="mt-2 max-w-[320px] space-y-1.5">
              <h1 className="text-display font-extrabold tracking-tight text-primary">Ngọt vừa thui</h1>
              <p className="text-base font-medium leading-relaxed text-muted">Sổ tay ghi chép đường huyết mỗi ngày</p>
            </div>

            <div className="mt-4 w-full max-w-[340px] space-y-2">
              <FeatureCard
                icon={<IconDrop className="h-5 w-5" />}
                tint="rose"
                title="Ghi chỉ số nhanh"
                desc="Lưu đường huyết sau 3 giây"
              />
              <FeatureCard
                icon={<IconTrend className="h-5 w-5" />}
                tint="mint"
                title="Biểu đồ xu hướng"
                desc="Cảnh báo sớm biến động"
              />
              <FeatureCard
                icon={<IconBell className="h-5 w-5" />}
                tint="indigo"
                title="Nhắc đo đúng giờ"
                desc="Chăm sóc theo nhịp sinh hoạt"
              />
            </div>
          </div>

          {/* ---------- Đăng nhập Google (nhắc tick điều khoản bằng toast nếu bỏ qua) ---------- */}
          <div className="mt-4 w-full space-y-3.5">
            <button
              onClick={handleGoogle}
              disabled={loading}
              className="flex h-14 w-full items-center justify-center gap-3.5 rounded-lg border border-line/70 bg-card text-ink shadow-sm transition hover:border-primary disabled:cursor-not-allowed disabled:opacity-50 dark:border-transparent dark:bg-[#F8FAFC] dark:text-slate-900 dark:shadow-lg dark:hover:bg-white"
            >
              {loading ? (
                <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent dark:border-emerald-400 dark:border-t-transparent" />
              ) : (
                <GoogleMark />
              )}
              <span className="text-lg font-semibold tracking-tight">
                {loading ? "Đang đăng nhập…" : "Tiếp tục với Google"}
              </span>
            </button>

            <label htmlFor="terms-checkbox" className="flex cursor-pointer items-start gap-2 px-2">
              <input
                id="terms-checkbox"
                type="checkbox"
                checked={terms}
                onChange={(e) => setTerms(e.target.checked)}
                className="mt-0.5 h-4 w-4 flex-none cursor-pointer accent-primary dark:accent-emerald-400"
              />
              <span className="text-xs leading-snug text-muted">
                Tôi đã đọc và đồng ý với{" "}
                <a href="#" className="font-semibold text-primary hover:underline">
                  Điều khoản dịch vụ
                </a>{" "}
                và{" "}
                <a href="#" className="font-semibold text-primary hover:underline">
                  Chính sách bảo mật
                </a>
              </span>
            </label>

            {error && (
              <div className="form-error select-text" role="alert">
                {error}
              </div>
            )}

            <p className="pt-1 text-center text-[11px] leading-4 text-faint">
              <span className="align-top text-[9px]">*</span>
              Ứng dụng chỉ để theo dõi, không thay thế tư vấn y tế.
            </p>
          </div>
        </main>
      </div>

      {/* ---------- Toast kiểu Android ---------- */}
      {toast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-10 z-50 flex justify-center px-5">
          <span className="toast-pop rounded-full bg-[#323232] px-4 py-2.5 text-center text-sm text-white shadow-lg">{toast}</span>
        </div>
      )}
    </main>
  );
}

/**
 * Thẻ tính năng: icon trong ô màu theo tint + tiêu đề + mô tả.
 * Dark mode dùng tint đặc biệt theo mockup: rose/emerald/indigo trên nền tối.
 */
function FeatureCard({
  icon,
  tint,
  title,
  desc,
}: {
  icon: ReactNode;
  tint: "rose" | "mint" | "indigo";
  title: string;
  desc: string;
}) {
  const tintClass =
    tint === "rose"
      ? "bg-[var(--rose-soft)] text-[var(--rose)] dark:border dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-400"
      : tint === "mint"
        ? "bg-[var(--primary-soft)] text-[var(--primary)] dark:border dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400"
        : "bg-[var(--card-2)] text-[var(--muted)] dark:border dark:border-indigo-500/20 dark:bg-indigo-500/10 dark:text-indigo-400";
  return (
    <div className="flex items-center gap-3.5 rounded-lg border border-line/30 bg-card/80 p-3 shadow-sm backdrop-blur-sm dark:border-slate-700/50 dark:bg-slate-900/90 dark:p-4">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tintClass}`}>{icon}</div>
      <div className="text-left">
        <div className="text-sm font-semibold text-ink dark:text-slate-100">{title}</div>
        <div className="text-xs text-muted dark:text-slate-400">{desc}</div>
      </div>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      />
    </svg>
  );
}
