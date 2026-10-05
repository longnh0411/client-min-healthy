"use client";

import AuthGate from "@/components/AuthGate";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getAccessToken, getUser, isLoggedIn } from "@/lib/session";
import { logout, listMeals, getSettings } from "@/lib/api";
import { syncTokenOnLoad, onForegroundMessage } from "@/lib/notifications";
import type { Meal, GlucoseSettings } from "@/lib/types";
import ThemeToggle from "@/components/ThemeToggle";
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
import { dayGroupLabel, dayKey } from "@/lib/format";

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
  const [menuOpen, setMenuOpen] = useState(false);

  const [preOpen, setPreOpen] = useState(false);
  const [postOpen, setPostOpen] = useState(false);
  const [editMeal, setEditMeal] = useState<Meal | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

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

  const user = getUser();

  return (
    <div className="mx-auto min-h-screen max-w-2xl px-4 pb-24">
      <AuthGate />

      {/* ---------- Header ---------- */}
      <header className="sticky top-0 z-40 -mx-4 mb-4 flex items-center justify-between gap-2 border-b border-line bg-bg/90 px-4 py-3 backdrop-blur">
        <h1 className="text-lg font-bold">
          🩸 Ngọt vừa thui
          {user?.email && <span className="ml-2 hidden text-xs font-normal text-faint sm:inline">{user.email}</span>}
        </h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSettingsOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-line text-base transition hover:bg-panel2"
            aria-label="Cài đặt"
            title="Cài đặt ngưỡng & nhắc đo"
          >
            ⚙️
          </button>
          <div className="relative">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-line text-base transition hover:bg-panel2"
              aria-label="Menu"
            >
              ⋮
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-10 z-50 w-44 overflow-hidden rounded-xl border border-line bg-panel shadow-lg">
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    setSettingsOpen(true);
                  }}
                  className="block w-full px-4 py-2.5 text-left text-sm transition hover:bg-panel2"
                >
                  Cài đặt ngưỡng
                </button>
                <button
                  onClick={handleLogout}
                  className="block w-full px-4 py-2.5 text-left text-sm text-neg transition hover:bg-panel2"
                >
                  Đăng xuất
                </button>
              </div>
            )}
          </div>
          <ThemeToggle />
        </div>
      </header>

      <InstallPrompt />

      {dangerValue !== null && (
        <div className="mb-4">
          <SafetyBanner value={dangerValue} onClose={() => setDangerValue(null)} />
        </div>
      )}

      {loading ? (
        <div className="space-y-4" aria-busy="true" aria-label="Đang tải">
          <div className="skeleton h-24 w-full" />
          <div className="skeleton h-24 w-full" />
          <div className="skeleton h-40 w-full" />
          <div className="skeleton h-64 w-full" />
        </div>
      ) : error ? (
        <div className="rounded-xl border px-4 py-3 text-sm" role="alert" style={{ borderColor: "color-mix(in srgb, var(--neg) 40%, transparent)", background: "color-mix(in srgb, var(--neg) 8%, transparent)", color: "var(--neg)" }}>
          {error}{" "}
          <button onClick={load} className="underline">
            Thử lại
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <StatusCard meals={meals} thresholds={settings!} />
          <A1cCard meals={meals} />

          {/* ---------- Nút thao tác nhanh ---------- */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setPreOpen(true)}
              className="min-h-14 rounded-2xl bg-accent text-base font-bold text-white shadow-sm transition hover:opacity-90"
            >
              🩸 Đo trước ăn
            </button>
            <button
              onClick={() => setPostOpen(true)}
              className="min-h-14 rounded-2xl border-2 border-accent bg-bg text-base font-bold text-accent transition hover:bg-accent-soft"
            >
              🍽 Đo sau ăn
            </button>
          </div>

          <TrendChart meals={meals} thresholds={settings!} />

          {/* ---------- Lịch sử theo ngày ---------- */}
          <section>
            <h2 className="mb-2 text-sm font-medium text-muted">Lịch sử</h2>
            {meals.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-line px-6 py-10 text-center">
                <p className="text-3xl">🌾</p>
                <p className="mt-2 text-sm text-muted">
                  Chưa có số đo nào — bấm “Đo trước ăn” để bắt đầu.
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                {grouped.map((g) => (
                  <div key={g.key}>
                    <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-faint">{g.label}</h3>
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
        </div>
      )}

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
          <PostMealSheet
            open={postOpen}
            onClose={() => setPostOpen(false)}
            recentMeals={recentMeals}
            onSaved={handleSaved}
          />
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

      {/* Toast foreground push */}
      {toast && (
        <div className="fixed inset-x-4 bottom-20 z-50 mx-auto max-w-md rounded-xl border border-line bg-panel px-4 py-3 text-sm shadow-lg" role="status">
          {toast}
        </div>
      )}

      {/* Footer disclaimer cố định (plan.md §3.5) */}
      <footer className="mt-10 text-center text-xs leading-5 text-faint">
        Ứng dụng chỉ để theo dõi, không thay thế tư vấn y tế.
      </footer>
    </div>
  );
}
