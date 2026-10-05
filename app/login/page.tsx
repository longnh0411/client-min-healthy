"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isLoggedIn } from "@/lib/session";
import { signInWithGoogle, resolveGoogleRedirect } from "@/lib/firebase";
import { ApiError, googleLogin as apiGoogleLogin } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    <main className="login-grid relative flex min-h-screen flex-col items-center justify-center px-5">
      <div className="login-card w-full max-w-sm rounded-2xl border border-line bg-panel p-7 shadow-sm">
        <div className="mb-1 text-center text-5xl">🩸</div>
        <h1 className="mb-1 text-center text-2xl font-bold">Ngọt vừa thui</h1>
        <p className="mb-6 text-center text-sm text-muted">
          Sổ tay đường huyết — ghi đo trước/sau bữa ăn, hiểu con số của mình.
        </p>

        <button
          onClick={handleGoogle}
          disabled={loading}
          className="flex min-h-12 w-full items-center justify-center gap-3 rounded-xl border border-line bg-bg px-4 text-base font-semibold transition hover:border-accent hover:text-accent disabled:opacity-60"
        >
          {loading ? (
            <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          ) : (
            <GoogleMark />
          )}
          {loading ? "Đang đăng nhập…" : "Đăng nhập bằng Google"}
        </button>

        {error && (
          <div className="mt-4 rounded-lg border border-neg/40 bg-neg/10 px-3 py-2 text-sm text-neg" role="alert">
            {error}
          </div>
        )}
      </div>

      <p className="mt-6 max-w-sm text-center text-xs leading-5 text-faint">
        Ứng dụng chỉ để theo dõi, không thay thế tư vấn y tế. Hãy đối chiếu ngưỡng đường huyết
        với chỉ định của bác sĩ điều trị.
      </p>
    </main>
  );
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}
