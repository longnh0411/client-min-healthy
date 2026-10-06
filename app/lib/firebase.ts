// Firebase Web SDK — chỉ dùng Auth (Google) + Messaging (FCM).
// Config từ env NEXT_PUBLIC_FIREBASE_* (cùng Firebase project với backend).
// Lazy init + isFirebaseConfigured() để app vẫn chạy (hiện báo lỗi thân thiện)
// khi chưa điền env — không crash lúc import.
import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import {
  GoogleAuthProvider,
  getAuth,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  type Auth,
} from "firebase/auth";

export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "",
};

export function isFirebaseConfigured(): boolean {
  return !!(firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId && firebaseConfig.appId);
}

export function getFirebaseApp(): FirebaseApp {
  return getApps()[0] ?? initializeApp(firebaseConfig);
}

export function getFirebaseAuth(): Auth {
  return getAuth(getFirebaseApp());
}

export const FIREBASE_CFG_ERROR = "Chưa cấu hình Firebase — điền NEXT_PUBLIC_FIREBASE_* vào .env.local (xem .env.example).";

/**
 * Firebase AuthError → thông điệp tiếng Việt thân thiện.
 * UI KHÔNG BAO GIỜ hiện mã lỗi thô (vd "auth/api-key-not-valid.-please-pass-a-valid-api-key")
 * — lỗi gốc chỉ log console phía dev. Firebase hay gắn suffix dài vào code nên so bằng startsWith.
 */
const AUTH_ERROR_MAP: readonly (readonly [prefix: string, message: string])[] = [
  ["auth/api-key-not-valid", "Đăng nhập đang được bảo trì — bạn quay lại thử sau ít phút nhé."],
  ["auth/invalid-api-key", "Đăng nhập đang được bảo trì — bạn quay lại thử sau ít phút nhé."],
  ["auth/unauthorized-domain", "Trang này chưa được phép đăng nhập Google — bạn báo lại cho chúng mình để xử lý nhé."],
  ["auth/operation-not-allowed", "Đăng nhập bằng Google đang tạm tắt — bạn quay lại thử sau ít phút nhé."],
  ["auth/configuration-not-found", "Đăng nhập bằng Google đang tạm tắt — bạn quay lại thử sau ít phút nhé."],
  ["auth/network-request-failed", "Mạng chập chờn — kiểm tra kết nối rồi thử lại nhé."],
  ["auth/popup-closed-by-user", "Bạn vừa đóng cửa sổ đăng nhập — bấm lại khi sẵn sàng nhé."],
  ["auth/cancelled-popup-request", "Bạn vừa đóng cửa sổ đăng nhập — bấm lại khi sẵn sàng nhé."],
  ["auth/user-token-expired", "Phiên Google đã hết hạn — thử lại nhé."],
  ["auth/timeout", "Hết thời gian chờ đăng nhập — thử lại nhé."],
  ["auth/user-disabled", "Tài khoản Google này đã bị khoá."],
  ["auth/internal-error", "Có lỗi bất ngờ từ Google — bạn thử lại trong ít phút nhé."],
];

export function friendlyAuthError(e: unknown): string {
  const code = (e as { code?: string })?.code ?? "";
  for (const [prefix, message] of AUTH_ERROR_MAP) {
    if (code.startsWith(prefix)) return message;
  }
  if (code.startsWith("auth/")) return "Đăng nhập không thành công — bạn thử lại trong ít phút nhé.";
  return "Đăng nhập thất bại, thử lại nhé";
}

/**
 * Mở popup đăng nhập Google. Popup bị chặn (iOS Safari in-app) → tự fallback
 * signInWithRedirect; caller cần gọi resolveGoogleRedirect() lúc app load.
 * Trả Firebase idToken để đưa lên POST /auth/social.
 */
export async function signInWithGoogle(): Promise<string> {
  if (!isFirebaseConfigured()) throw new Error(FIREBASE_CFG_ERROR);
  const auth = getFirebaseAuth();
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  try {
    const cred = await signInWithPopup(auth, provider);
    return await cred.user.getIdToken();
  } catch (err) {
    const code = (err as { code?: string })?.code ?? "";
    // popup bị chặn / không hỗ trợ → redirect (full-page, iOS Safari vẫn chạy)
    if (
      code === "auth/popup-blocked" ||
      code === "auth/operation-not-supported-in-this-environment" ||
      code === "auth/cancelled-popup-request"
    ) {
      await signInWithRedirect(auth, provider);
      return ""; // trang sẽ reload sau redirect
    }
    throw err;
  }
}

/** Sau redirect về: lấy kết quả (nếu có) và trả idToken. Không có phiên redirect → null. */
export async function resolveGoogleRedirect(): Promise<string | null> {
  if (!isFirebaseConfigured()) return null;
  try {
    const result = await getRedirectResult(getFirebaseAuth());
    if (!result) return null;
    return await result.user.getIdToken();
  } catch {
    return null;
  }
}
