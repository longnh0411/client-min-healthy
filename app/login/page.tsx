"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { isLoggedIn } from "@/lib/session";
import { signInWithGoogle, resolveGoogleRedirect } from "@/lib/firebase";
import { ApiError, googleLogin as apiGoogleLogin } from "@/lib/api";
import { IconBell, IconDrop, IconShieldCheck, IconTrend } from "@/components/icons";

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [terms, setTerms] = useState(false);

  const finishLogin = () => {
    const from = new URLSearchParams(window.location.search).get("from");
    window.location.assign(from && from.startsWith("/") ? from : "/");
  };

  // Chưa login mà vẫn còn phiên Firebase redirect (popup bị chặn lần trước) → xử lý nốt
  useEffect(() => {
    if (isLoggedIn()) {
      router.replace("/");
      return;
    }
    resolveGoogleRedirect()
      .then((idToken) => {
        if (!idToken) return;
        setLoading(true);
        return apiGoogleLogin(idToken).then(finishLogin);
      })
      .catch((e) => {
        setError(e instanceof ApiError ? e.message : "Đăng nhập thất bại, thử lại nhé");
        setLoading(false);
      });
  }, [router]);

  const handleGoogle = async () => {
    setError(null);
    setLoading(true);
    try {
      const idToken = await signInWithGoogle();
      if (!idToken) return; // đã chuyển hướng redirect — trang sẽ load lại
      await apiGoogleLogin(idToken);
      finishLogin();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : e instanceof Error ? e.message : null;
      if (msg?.includes("popup")) {
        setError("Popup bị chặn — đang chuyển hướng, đợi chút nhé…");
      } else {
        setError(msg || "Đăng nhập thất bại, thử lại nhé");
        setLoading(false);
      }
    }
  };

  return (
    <main className="relative flex min-h-dvh select-none justify-center bg-bg">
      <div className="relative flex w-full max-w-[412px] flex-col overflow-hidden bg-bg shadow-2xl">
        {/* ---------- Vệt gradient ambient: hồng / mint / container (design system) ---------- */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full blur-3xl"
          style={{ background: "color-mix(in srgb, var(--rose) 16%, transparent)" }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -left-28 top-1/3 h-80 w-80 rounded-full blur-3xl"
          style={{ background: "color-mix(in srgb, var(--primary) 12%, transparent)" }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-24 right-0 h-64 w-64 rounded-full blur-2xl"
          style={{ background: "color-mix(in srgb, var(--card-2) 70%, transparent)" }}
        />

        <main className="z-10 flex flex-1 flex-col justify-between px-5 pb-8 pt-12">
          {/* ---------- Logo + thương hiệu + 3 thẻ tính năng ---------- */}
          <div className="flex flex-col items-center text-center">
            <div className="group relative my-3">
              <div
                aria-hidden
                className="absolute -inset-2 rounded-full opacity-70 blur-md"
                style={{
                  background:
                    "linear-gradient(to bottom, color-mix(in srgb, var(--rose) 32%, transparent), color-mix(in srgb, var(--primary) 16%, transparent))",
                }}
              />
              <div
                className="relative flex h-24 w-24 items-center justify-center rounded-3xl border bg-card p-2 shadow-sm"
                style={{ borderColor: "color-mix(in srgb, var(--line) 30%, transparent)" }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/icon-192.png"
                  alt="Biểu tượng giọt máu Ngọt vừa thui"
                  className="h-full w-full rounded-2xl object-contain drop-shadow-sm transition-transform duration-300 group-hover:scale-105"
                />
              </div>
            </div>

            <div className="mt-4 max-w-[320px] space-y-2">
              <h1 className="text-display font-extrabold tracking-tight text-primary">Ngọt vừa thui</h1>
              <p className="text-base font-medium leading-relaxed text-muted">Sổ tay ghi chép đường huyết mỗi ngày</p>
            </div>

            <div className="mt-6 w-full max-w-[340px] space-y-2.5">
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
                tint="neutral"
                title="Nhắc đo đúng giờ"
                desc="Chăm sóc theo nhịp sinh hoạt"
              />
            </div>
          </div>

          {/* ---------- Đăng nhập Google (sau khi đồng ý điều khoản) ---------- */}
          <div className="mt-6 w-full space-y-4">
            <button
              onClick={handleGoogle}
              disabled={loading || !terms}
              className="flex h-14 w-full items-center justify-center gap-3.5 rounded-lg border bg-card px-4 shadow-sm transition hover:border-primary disabled:cursor-not-allowed disabled:opacity-50"
              style={{ borderColor: "color-mix(in srgb, var(--line) 70%, transparent)" }}
            >
              {loading ? (
                <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              ) : (
                <GoogleMark />
              )}
              <span className="text-lg font-semibold tracking-tight">
                {loading ? "Đang đăng nhập…" : "Tiếp tục với Google"}
              </span>
            </button>

            <div className="flex items-center justify-center gap-2 px-2 py-1">
              <input
                id="terms-checkbox"
                type="checkbox"
                checked={terms}
                onChange={(e) => setTerms(e.target.checked)}
                className="h-4 w-4 cursor-pointer accent-primary"
              />
              <label htmlFor="terms-checkbox" className="cursor-pointer text-xs text-muted">
                Tôi đồng ý với{" "}
                <a href="#" className="font-semibold text-primary hover:underline">
                  Điều khoản
                </a>{" "}
                &amp;{" "}
                <a href="#" className="font-semibold text-primary hover:underline">
                  Chính sách bảo mật
                </a>
              </label>
            </div>

            {error && (
              <div className="form-error select-text" role="alert">
                {error}
              </div>
            )}

            <div className="space-y-1.5 pt-1 text-center">
              <div className="flex items-center justify-center gap-1.5 text-muted">
                <IconShieldCheck className="h-4.5 w-4.5 text-primary" />
                <span className="text-xs font-semibold">Bảo mật y tế &amp; mã hóa dữ liệu 100%</span>
              </div>
              <p className="text-[11px] leading-4 text-faint">
                Ứng dụng chỉ để theo dõi, không thay thế tư vấn y tế.
              </p>
            </div>
          </div>
        </main>
      </div>
    </main>
  );
}

/** Thẻ tính năng: icon trong ô màu theo tint + tiêu đề + mô tả */
function FeatureCard({
  icon,
  tint,
  title,
  desc,
}: {
  icon: ReactNode;
  tint: "rose" | "mint" | "neutral";
  title: string;
  desc: string;
}) {
  const tintStyle =
    tint === "rose"
      ? { background: "var(--rose-soft)", color: "var(--rose)" }
      : tint === "mint"
        ? { background: "var(--primary-soft)", color: "var(--primary)" }
        : { background: "var(--card-2)", color: "var(--muted)" };
  return (
    <div
      className="flex items-center gap-3.5 rounded-lg border bg-card/80 p-3 shadow-sm"
      style={{ borderColor: "color-mix(in srgb, var(--line) 30%, transparent)" }}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={tintStyle}>
        {icon}
      </div>
      <div className="text-left">
        <div className="text-sm font-semibold text-ink">{title}</div>
        <div className="text-xs text-muted">{desc}</div>
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
