// Service worker duy nhất của app — 3 việc:
// 1. PWA + OFFLINE APP SHELL: precache '/' , '/login' + tài nguyên tĩnh; navigation
//    network-first với fallback cache — mất mạng / đổi mạng (wifi↔4G) trình duyệt
//    KHÔNG còn thay app bằng trang lỗi, vẫn mở được app (kèm banner offline trong UI).
//    Tài nguyên same-origin (/_next/static/...) cache-first (runtime) — tên file có
//    hash nên không stale. API (Render) luôn qua mạng — KHÔNG cache dữ liệu người bệnh.
// 2. FCM background push: nhận data-only message → hiện notification
//    (pattern của firebase-messaging-sw.js chuẩn, config Firebase truyền qua
//     query string lúc đăng ký vì SW không đọc được biến môi trường build)
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js");

// ?apiKey=...&authDomain=...&projectId=...&appId=... — truyền từ notifications.ts
const params = new URLSearchParams(self.location.search);
const firebaseConfig = {
  apiKey: params.get("apiKey"),
  authDomain: params.get("authDomain"),
  projectId: params.get("projectId"),
  appId: params.get("appId"),
};
const APP_NAME = "Ngọt vừa thui";

let messaging = null;
try {
  firebase.initializeApp(firebaseConfig);
  messaging = firebase.messaging();
} catch (e) {
  // Thiếu config (chưa điền env) → SW vẫn chạy cho PWA + offline, chỉ bỏ qua push
}

if (messaging) {
  // Payload backend gửi là data-only { title, body, ... } — chỉ SW render, không double notification
  messaging.onBackgroundMessage((payload) => {
    const data = payload.data || {};
    self.registration.showNotification(data.title || APP_NAME, {
      body: data.body || "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: "min-healthy-reminder",
      data: { target: data.target || "/" },
    });
  });
}

// ---------- Offline app shell ----------
const SHELL_CACHE = "ngot-shell-v1";
const ASSET_CACHE = "ngot-assets-v1";

// Trang + tài nguyên cố định của app shell — dùng khi mạng yếu/mất/đổi mạng
const SHELL_URLS = [
  "/",
  "/login",
  "/theme-init.js",
  "/manifest.webmanifest",
  "/icon-192.png",
  "/icon-apple-180.png",
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) =>
      // add riêng từng URL để 1 URL lỗi (vd icon chưa có) không phá cả install
      Promise.allSettled(SHELL_URLS.map((u) => cache.add(u))),
    ),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // dọn cache phiên bản cũ
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== SHELL_CACHE && k !== ASSET_CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

/** Navigation (mở/refresh trang): mạng trước — offline thì trả app shell từ cache. */
async function handleNavigation(event) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const fresh = await fetch(event.request);
    if (fresh && fresh.ok) cache.put(event.request, fresh.clone());
    return fresh;
  } catch (e) {
    // Mất mạng / ERR_NETWORK_CHANGED → phục vụ từ cache theo đúng path
    const cached =
      (await cache.match(event.request)) ||
      (await cache.match("/")) ||
      (await cache.match("/login"));
    if (cached) return cached;
    return new Response("<h1>Không có mạng</h1><p>Mở lại app khi có kết nối.</p>", {
      status: 503,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // API (monolith Render) và Firebase/Google domain: luôn mạng, không cache
  if (url.pathname.startsWith("/api/") || url.origin !== self.location.origin) return;

  // Mở trang / refresh: mạng trước (dev luôn tươi), offline → app shell từ cache
  if (req.mode === "navigate") {
    event.respondWith(handleNavigation(event));
    return;
  }

  // Tài nguyên same-origin (HTML RSC payload, JS/CSS hash, ảnh, icon): cache-first
  event.respondWith(
    (async () => {
      const cache = await caches.open(ASSET_CACHE);
      const cached = await cache.match(req);
      if (cached) {
        // stale-while-revalidate: trả cache ngay, ngầm cập nhật
        fetch(req)
          .then((res) => {
            if (res && res.ok) cache.put(req, res.clone());
          })
          .catch(() => {});
        return cached;
      }
      const res = await fetch(req);
      if (res && res.ok && (res.type === "basic" || res.type === "default")) {
        cache.put(req, res.clone());
      }
      return res;
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.target) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) return client.focus();
      }
      return self.clients.openWindow(target);
    }),
  );
});
