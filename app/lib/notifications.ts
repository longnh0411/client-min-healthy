// FCM web push: xin quyền → lấy token (vapid) → đăng ký lên monolith
// (POST /notification/register, app=min-healthy). Nhận foreground message → callback.
// Background messages do public/firebase-messaging-sw.js xử lý (SW duy nhất của app,
// đăng ký tại scope "/" — vừa push vừa đủ điều kiện cài PWA).
import { isSupported, getToken, onMessage, deleteToken, type Messaging } from "firebase/messaging";
import { getFirebaseApp, firebaseConfig, isFirebaseConfigured } from "./firebase";
import { registerFcmToken, unregisterFcmToken } from "./api";

const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || "";

export function isMessagingConfigured(): boolean {
  return isFirebaseConfigured() && !!VAPID_KEY;
}

/** Đăng ký SW app (kèm config Firebase qua query string — SW không đọc được env build). */
async function ensureServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return null;
  const qs = new URLSearchParams({
    apiKey: firebaseConfig.apiKey,
    authDomain: firebaseConfig.authDomain,
    projectId: firebaseConfig.projectId,
    appId: firebaseConfig.appId,
  }).toString();
  const reg = await navigator.serviceWorker.register(`/firebase-messaging-sw.js?${qs}`, { scope: "/" });
  await navigator.serviceWorker.ready;
  return reg;
}

async function getMessagingIfSupported(): Promise<Messaging | null> {
  if (!isMessagingConfigured()) return null;
  if (typeof window === "undefined" || !("Notification" in window)) return null;
  if (!(await isSupported())) return null;
  const registration = await ensureServiceWorker();
  if (!registration) return null;
  const { getMessaging } = await import("firebase/messaging");
  return getMessaging(getFirebaseApp());
}

/** Đăng ký nhận push: xin quyền → getToken → POST register. Trả token hoặc null (bị từ chối/chưa config). */
export async function enableNotifications(): Promise<string | null> {
  const messaging = await getMessagingIfSupported();
  if (!messaging) return null;

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return null;

  const swRegistration = await navigator.serviceWorker.ready;
  const token = await getToken(messaging, {
    vapidKey: VAPID_KEY,
    serviceWorkerRegistration: swRegistration,
  });
  if (!token) return null;
  await registerFcmToken(token);
  return token;
}

/** Mở app: lấy token hiện tại và đăng ký lại nếu FCM đã rotate (backend dedup theo token). */
export async function syncTokenOnLoad(): Promise<void> {
  try {
    if (typeof window === "undefined" || Notification.permission !== "granted") return;
    const messaging = await getMessagingIfSupported();
    if (!messaging) return;
    const swRegistration = await navigator.serviceWorker.ready;
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: swRegistration,
    });
    if (token) await registerFcmToken(token);
  } catch {
    /* chưa cấp quyền / SW chưa sẵn sàng — bỏ qua */
  }
}

/** Nhận push khi app đang mở (foreground) — gọi callback để hiện toast. */
export async function onForegroundMessage(cb: (title: string, body: string) => void): Promise<() => void> {
  const messaging = await getMessagingIfSupported();
  if (!messaging) return () => {};
  return onMessage(messaging, (payload) => {
    const data = (payload.data ?? {}) as { title?: string; body?: string };
    cb(data.title ?? "Ngọt vừa thui", data.body ?? "");
  });
}

/** Đăng xuất: gỡ token khỏi backend + xoá token khỏi browser (best-effort). */
export async function disableNotifications(): Promise<void> {
  try {
    const messaging = await getMessagingIfSupported();
    if (!messaging) return;
    const swRegistration = await navigator.serviceWorker.ready;
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: swRegistration,
    });
    if (token) {
      await unregisterFcmToken(token).catch(() => {});
      await deleteToken(messaging);
    }
  } catch {
    /* bỏ qua — logout không được fail vì notification */
  }
}
