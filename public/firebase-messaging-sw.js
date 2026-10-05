// Service worker duy nhất của app — 2 việc:
// 1. PWA: đủ điều kiện cài (fetch handler) — pass-through, không cache (MVP online-first)
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
  // Thiếu config (chưa điền env) → SW vẫn chạy cho PWA, chỉ bỏ qua push
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

// ---------- PWA cơ bản ----------
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Pass-through: MVP online-first, không cache offline (xem README — future work)
self.addEventListener("fetch", () => {
  /* để trình duyệt tự xử lý mạng */
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
