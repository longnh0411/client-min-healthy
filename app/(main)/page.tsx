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
import OnboardingSheet from "@/components/OnboardingSheet";
import MaxCards from "@/components/MaxCards";
import LabCard from "@/components/LabCard";
import LabSheet from "@/components/LabSheet";
import { DropMark, IconPlus } from "@/components/icons";
import { dayGroupLabel, dayKey } from "@/lib/format";
import { listLabs, listNotifications } from "@/lib/api";
import type { LabResult } from "@/lib/types";

// Số bữa tối đa tải cho A1c 90 ngày + biểu đồ + thẻ cao nhất (5 trang × 100)
const MAX_MEALS = 500;
// Số bữa hiển thị mỗi lần "Tải thêm" lịch sử
const HISTORY_PAGE_SIZE = 20;

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
  const [offline, setOffline] = useState(false);
  const [onboarded, setOnboarded] = useState<boolean | null>(null);
  const [labs, setLabs] = useState<LabResult[]>([]);
  const [labOpen, setLabOpen] = useState(false);

  // FR-NET-01: mất mạng → banner + vô hiệu nút Lưu; có mạng lại tự phục hồi
  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    setOffline(!navigator.onLine);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  // FR-SET-02: lần đầu dùng app (chưa onboarded) → mở sheet mục tiêu theo bác sĩ
  useEffect(() => {
    let v = false;
    try {
      v = localStorage.getItem("onboarded") === "1";
    } catch {
      v = false;
    }
    setOnboarded(v);
  }, []);

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
      listLabs()
        .then(setLabs)
        .catch(() => setLabs([]));
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

  // Lịch sử hiển thị dạng infinite scroll: hiện HISTORY_PAGE_SIZE entry mỗi lần,
  // sentinel chạm viewport → tự tải thêm khối tiếp theo (không cần bấm).
  // meals rỗng → về 20 (reset khi xoá hết dữ liệu).
  const isEmpty = meals.length === 0;
  const [historyLimit, setHistoryLimit] = useState(HISTORY_PAGE_SIZE);
  useEffect(() => {
    if (isEmpty) setHistoryLimit(HISTORY_PAGE_SIZE);
  }, [isEmpty]);
  const hasMore = meals.length > historyLimit;
  // Infinite scroll: chạm gần đáy trang (còn < 600px) → nạp thêm khối tiếp theo.
  // Scroll listener đơn giản — không phụ thuộc sentinel nên không sai lệch khi remount.
  useEffect(() => {
    if (!hasMore) return;
    const onScroll = () => {
      const remaining = document.documentElement.scrollHeight - window.scrollY - window.innerHeight;
      if (remaining < 600) setHistoryLimit((n) => n + HISTORY_PAGE_SIZE);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [hasMore]);

  // Nhóm lịch sử hiển thị theo ngày (giờ máy)
  const visibleMeals = useMemo(() => meals.slice(0, historyLimit), [meals, historyLimit]);
  const grouped = useMemo(() => {
    const groups: { key: string; label: string; meals: Meal[] }[] = [];
    for (const meal of visibleMeals) {
      const key = dayKey(meal.eatenAt);
      let g = groups.find((x) => x.key === key);
      if (!g) {
        g = { key, label: dayGroupLabel(meal.eatenAt), meals: [] };
        groups.push(g);
      }
      g.meals.push(meal);
    }
    return groups;
  }, [visibleMeals]);

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

  // FR-SUM-03: chạm thẻ cao nhất → cuộn tới entry tương ứng
  const handleJumpToMeal = (meal: Meal) => {
    document.getElementById(`meal-${meal.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
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

      {/* FR-NET-01: banner mất mạng */}
      {offline && (
        <div
          className="mb-4 flex items-start gap-3 rounded-lg border px-4 py-3 text-sm"
          style={{
            borderColor: "color-mix(in srgb, var(--warn) 45%, transparent)",
            background: "color-mix(in srgb, var(--warn) 10%, transparent)",
          }}
          role="alert"
        >
          <p className="flex-1" style={{ color: "var(--warn)" }}>
            Đang offline. Hãy kết nối mạng để lưu số đo.
          </p>
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
          <MaxCards meals={meals} thresholds={settings!} now={Date.now()} onJumpTo={handleJumpToMeal} />
          <A1cCard meals={meals} thresholds={settings!} />
          <LabCard labs={labs} onOpen={() => setLabOpen(true)} />
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

                {hasMore && (
                  <div aria-hidden className="flex justify-center py-4">
                    <span className="text-xs text-faint">Cuộn xuống để tải thêm · còn {meals.length - historyLimit} bữa</span>
                  </div>
                )}
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

      {/* FR-LAB: sheet HbA1c xét nghiệm — danh sách + thêm/sửa/xoá */}
      <LabSheet
        open={labOpen}
        meals={meals}
        offline={offline}
        onClose={() => setLabOpen(false)}
        onChanged={async () => {
          try {
            const { listLabs: reloadLabs } = await import("@/lib/api");
            setLabs(await reloadLabs());
          } catch {
            /* bỏ qua */
          }
        }}
      />

      {/* FR-SET-02: onboarding mục tiêu — hiện khi settings đã tải và chưa onboarded */}
      {settings && onboarded === false && (
        <OnboardingSheet
          open
          settings={settings}
          onClose={(saved) => {
            setSettings(saved);
            setOnboarded(true);
          }}
        />
      )}

      {/* ---------- Sheets ---------- */}
      {settings && (
        <>
          <PreMealSheet
            open={preOpen}
            onClose={() => setPreOpen(false)}
            meals={meals}
            settings={settings}
            offline={offline}
            onSaved={handleSaved}
          />
          <PostMealSheet
            open={postOpen}
            onClose={() => setPostOpen(false)}
            recentMeals={recentMeals}
            offline={offline}
            onSaved={handleSaved}
          />
          <EditMealSheet meal={editMeal} offline={offline} onClose={() => setEditMeal(null)} onSaved={() => handleSaved(null)} />
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
