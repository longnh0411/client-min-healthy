"use client";

import AuthGate from "@/components/AuthGate";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getAccessToken, getUser, isLoggedIn } from "@/lib/session";
import type { SessionUser } from "@/lib/session";
import { logout, listMeals, getSettings } from "@/lib/api";
import { syncTokenOnLoad, onForegroundMessage } from "@/lib/notifications";
import type { Meal, GlucoseSettings } from "@/lib/types";
import InstallPrompt from "@/components/InstallPrompt";
import StatusCard from "@/components/StatusCard";
import A1cCard from "@/components/A1cCard";
import TrendChart from "@/components/TrendChart";
import MealCard from "@/components/MealCard";
import SafetyBanner from "@/components/SafetyBanner";
import PreMealSheet from "@/components/PreMealSheet";
import PostMealSheet from "@/components/PostMealSheet";
import EditMealSheet from "@/components/EditMealSheet";
import SettingsSheet from "@/components/SettingsSheet";
import BottomNav from "@/components/BottomNav";
import NotificationSheet from "@/components/NotificationSheet";
import { DropMark, IconPlus } from "@/components/icons";
import { dayGroupLabel, dayKey } from "@/lib/format";
import { listNotifications } from "@/lib/api";

// Số bữa tối đa tải cho A1c 90 ngày + biểu đồ + lịch sử (5 trang × 100)
const MAX_MEALS = 500;

export default function HomePage() {
  const router = useRouter();
  const [meals, setMeals] = useState<Meal[]>([]);
  const [settings, setSettings] = useState<GlucoseSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dangerValue, setDangerValue] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [notifEnabled, setNotifEnabled] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifUnread, setNotifUnread] = useState(0);
  const [notifRefresh, setNotifRefresh] = useState(0);

  // Số thông báo chưa đọc cho badge trên nav — reload khi có push / khi đọc xong
  useEffect(() => {
    listNotifications(false)
      .then((r) => setNotifUnread(r.length))
      .catch(() => setNotifUnread(0));
  }, [notifRefresh, notifOpen]);

  const [preOpen, setPreOpen] = useState(false);
  const [postOpen, setPostOpen] = useState(false);
  const [editMeal, setEditMeal] = useState<Meal | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  // Đọc user sau mount (localStorage không có ở server → tránh lệch hydration)
  const [user, setUser] = useState<SessionUser | null>(null);
  useEffect(() => setUser(getUser()), []);

  const load = async () => {
    if (!isLoggedIn()) return;
    setError(null);
    try {
      // Lấy dần tới khi đủ 90 ngày dữ liệu (hoặc hết trang)
      let all: Meal[] = [];
      let page = 1;
      for (;;) {
        const res = await listMeals({ page, limit: 100 });
        all = all.concat(res.items);
        if (page >= res.totalPages || all.length >= MAX_MEALS) break;
        page++;
      }
      setMeals(all.slice(0, MAX_MEALS));
      setSettings(await getSettings());
    } catch (e) {
      const status = (e as { status?: number }).status;
      if (status === 401) {
        router.replace("/login");
        return;
      }
      setError(e instanceof Error ? e.message : "Không tải được dữ liệu");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!getAccessToken()) {
      router.replace("/login");
      return;
    }
    load();
    // FCM: đăng ký lại token (nếu đã cấp quyền) + nhận push foreground → toast
    let unsubMsg: (() => void) | undefined;
    syncTokenOnLoad().then(() => setNotifEnabled(Notification.permission === "granted"));
    onForegroundMessage((title, body) => {
      setToast(`${title}: ${body}`);
      setTimeout(() => setToast(null), 5000);
      setNotifRefresh((k) => k + 1); // push mới đến → badge thông báo reload
    }).then((un) => {
      unsubMsg = un;
    });
    return () => {
      unsubMsg?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 5 bữa gần nhất cho sheet "Đo sau ăn" (mặc định gắn bữa chưa có post gần nhất)
  const recentMeals = useMemo(() => meals.slice(0, 5), [meals]);

  // Nhóm lịch sử theo ngày (giờ máy)
  const grouped = useMemo(() => {
    const groups: { key: string; label: string; meals: Meal[] }[] = [];
    for (const meal of meals) {
      const key = dayKey(meal.eatenAt);
      let g = groups.find((x) => x.key === key);
      if (!g) {
        g = { key, label: dayGroupLabel(meal.eatenAt), meals: [] };
        groups.push(g);
      }
      g.meals.push(meal);
    }
    return groups;
  }, [meals]);

  const handleSaved = async (danger: number | null) => {
    setDangerValue(danger);
    setPreOpen(false);
    setPostOpen(false);
    setEditMeal(null);
    await load();
  };

  const handleLogout = async () => {
    await logout();
    router.replace("/login");
    router.refresh();
  };

  const handleOpenHistory = () => {
    document.getElementById("history")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="mx-auto min-h-screen max-w-[680px] px-5 pb-28 sm:px-8">
      <AuthGate />

      {/* ---------- Header: thương hiệu ---------- */}
      <header className="sticky top-0 z-40 -mx-5 mb-5 flex items-center justify-between gap-2 border-b border-line bg-bg/85 px-5 py-3 backdrop-blur sm:-mx-8 sm:px-8">
        <h1 className="flex items-center gap-2 text-lg font-bold tracking-tight">
          <DropMark size={22} />
          Ngọt vừa thui
          {user?.email && (
            <span className="ml-1 hidden text-xs font-normal text-faint sm:inline">{user.email}</span>
          )}
        </h1>
      </header>

      <InstallPrompt />

      {dangerValue !== null && (
        <div className="mb-4">
          <SafetyBanner value={dangerValue} onClose={() => setDangerValue(null)} />
        </div>
      )}

      {loading ? (
        <div className="space-y-4" aria-busy="true" aria-label="Đang tải">
          <div className="skeleton h-28 w-full" />
          <div className="skeleton h-32 w-full" />
          <div className="skeleton h-56 w-full" />
          <div className="skeleton h-64 w-full" />
        </div>
      ) : error ? (
        <div className="form-error" role="alert">
          {error}{" "}
          <button onClick={load} className="underline">
            Thử lại
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <StatusCard meals={meals} thresholds={settings!} />
          <A1cCard meals={meals} thresholds={settings!} />
          <TrendChart meals={meals} thresholds={settings!} />

          {/* ---------- Lịch sử theo ngày (BottomNav cuộn tới đây) ---------- */}
          <section id="history" className="scroll-mt-16">
            <h2 className="label-caps mb-2 text-faint">Lịch sử</h2>
            {meals.length === 0 ? (
              <div className="rounded-lg border border-dashed border-line px-6 py-10 text-center">
                <p className="text-3xl">🌾</p>
                <p className="mt-2 text-sm text-muted">Chưa có số đo nào — ghi bữa đầu tiên để bắt đầu nhé.</p>
                <button onClick={() => setPreOpen(true)} className="btn-secondary mx-auto mt-4 !min-h-10 !text-sm">
                  <IconPlus className="h-4 w-4" /> Ghi bữa đầu tiên
                </button>
              </div>
            ) : (
              <div className="space-y-5">
                {grouped.map((g) => (
                  <div key={g.key}>
                    <h3 className="label-caps mb-2 text-faint">{g.label}</h3>
                    <div className="space-y-2.5">
                      {g.meals.map((m) => (
                        <MealCard key={m.id} meal={m} meals={meals} settings={settings!} onEdit={setEditMeal} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Footer disclaimer (plan.md §3.5) */}
          <footer className="pt-2 text-center text-xs leading-5 text-faint">
            Ứng dụng chỉ để theo dõi, không thay thế tư vấn y tế.
          </footer>
        </div>
      )}

      {/* ---------- Thanh điều hướng đáy: Lịch sử · Cài đặt · [＋ Ghi đo] · Thông báo · Đăng xuất ---------- */}
      <BottomNav
        onOpenHistory={handleOpenHistory}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenPre={() => setPreOpen(true)}
        onOpenPost={() => setPostOpen(true)}
        onOpenNotifications={() => setNotifOpen(true)}
        notifUnread={notifUnread}
        onLogout={handleLogout}
      />

      <NotificationSheet
        open={notifOpen}
        onClose={() => setNotifOpen(false)}
        onChanged={() => setNotifRefresh((k) => k + 1)}
      />

      {/* ---------- Sheets ---------- */}
      {settings && (
        <>
          <PreMealSheet
            open={preOpen}
            onClose={() => setPreOpen(false)}
            meals={meals}
            settings={settings}
            onSaved={handleSaved}
          />
          <PostMealSheet open={postOpen} onClose={() => setPostOpen(false)} recentMeals={recentMeals} onSaved={handleSaved} />
          <EditMealSheet meal={editMeal} onClose={() => setEditMeal(null)} onSaved={() => handleSaved(null)} />
          <SettingsSheet
            open={settingsOpen}
            settings={settings}
            notificationsEnabled={notifEnabled}
            onClose={() => setSettingsOpen(false)}
            onSaved={(s, n) => {
              setSettings(s);
              setNotifEnabled(n);
              setSettingsOpen(false);
            }}
          />
        </>
      )}

      {/* Toast foreground push — phía trên thanh điều hướng */}
      {toast && (
        <div
          className="fixed inset-x-4 z-50 mx-auto max-w-md rounded-lg border border-line bg-card px-4 py-3 text-sm shadow-lg"
          style={{ bottom: "calc(4.75rem + env(safe-area-inset-bottom))" }}
          role="status"
        >
          {toast}
        </div>
      )}
    </div>
  );
}
