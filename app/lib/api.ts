/**
 * API client gọi monolith api-longnh-tools (Render) bằng Bearer token.
 * Port từ client-mim-trading/app/lib/api.ts — fetch thuần, auto refresh 401
 * rồi retry một lần, unwrap envelope { success, result, message }.
 *
 * Env: NEXT_PUBLIC_API_BASE_URL (vd https://api-...onrender.com). Trống →
 * same-origin "/api".
 *
 * Endpoint:
 * - /min-healthy/*  — service Sổ đường huyết (meals, settings) — qua PREFIX
 * - /auth/social    — login Google bằng Firebase idToken — raw
 * - /users/upload/presign — presigned PUT URL ảnh R2 — raw
 * - /notification/* — đăng ký FCM token + in-app notifications — raw
 */
import {
  clearUser,
  getAccessToken,
  getRefreshToken,
  setTokens,
  setUser,
  type AuthTokens,
} from "@/lib/session";
import type { Meal, MealPage, MealType, GlucoseSettings } from "@/lib/types";

const BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/+$/, "") + "/api";
const PREFIX = "/min-healthy";
const APP_ID = "min-healthy";

interface Envelope<T> {
  success: boolean;
  result: T;
  message: string;
}

/** Lỗi HTTP từ API — message lấy từ body (Nest: { code, message } hoặc { message }) */
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

let refreshing: Promise<boolean> | null = null;

/** POST /auth/refresh bằng refreshToken (bearer flow). Lưu tokens mới nếu ok. */
export async function refreshTokens(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;
  try {
    const res = await fetch(`${BASE}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return false;
    const env = (await res.json()) as Envelope<AuthTokens>;
    if (env?.result?.accessToken && env?.result?.refreshToken) {
      setTokens({ accessToken: env.result.accessToken, refreshToken: env.result.refreshToken });
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/** Refresh dùng chung cho nhiều request 401 cùng lúc (single-flight). */
function refreshOnce(): Promise<boolean> {
  if (!refreshing) {
    refreshing = refreshTokens().finally(() => {
      refreshing = null;
    });
  }
  return refreshing;
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  /** Không retry sau refresh (dùng cho chính request refresh). */
  noRetry?: boolean;
  /** Path hệ thống (không qua prefix /min-healthy): /auth/*, /users/*, /notification/* */
  raw?: boolean;
}

/** Request thô: trả envelope đầy đủ. 401 → refresh → retry 1 lần; vẫn 401 → clear + throw. */
async function request<T>(path: string, opts: RequestOptions = {}): Promise<Envelope<T>> {
  const url = `${BASE}${opts.raw ? "" : PREFIX}${path}`;
  const token = getAccessToken();
  const res = await fetch(url, {
    method: opts.method || "GET",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });

  if (res.status === 401 && !opts.noRetry) {
    if (await refreshOnce()) return request<T>(path, { ...opts, noRetry: true });
    clearUser();
    throw new ApiError(401, "Phiên đăng nhập đã hết hạn");
  }

  let env: Envelope<T> | null = null;
  try {
    env = (await res.json()) as Envelope<T>;
  } catch {
    /* body rỗng / không phải JSON */
  }

  if (!res.ok) {
    const msg =
      (env as unknown as { message?: string })?.message ||
      env?.message ||
      `Lỗi HTTP ${res.status}`;
    throw new ApiError(res.status, msg);
  }
  if (env && env.success === false) {
    throw new ApiError(res.status, env.message || "Yêu cầu thất bại");
  }
  return env as Envelope<T>;
}

async function apiGet<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const env = await request<T>(path, opts);
  return env.result;
}

async function apiSend<T>(
  method: "POST" | "PUT" | "PATCH" | "DELETE",
  path: string,
  body?: unknown,
  opts: RequestOptions = {},
): Promise<T> {
  const env = await request<T>(path, { ...opts, method, body });
  return env.result;
}

// ---------- Auth ----------

/**
 * Đăng nhập Google: gửi Firebase idToken lên hệ thống chung (POST /auth/social).
 * Backend verify idToken, tìm/tạo user và trả access/refresh token.
 */
export async function googleLogin(idToken: string): Promise<void> {
  const env = await request<AuthTokens>("/auth/social", {
    method: "POST",
    body: { idToken, provider: "google", app: APP_ID },
    raw: true,
    noRetry: true,
  });
  setTokens(env.result, true);
  setUser({ provider: "google" }, true);
}

/** Đăng xuất: thu hồi server-side (best-effort) rồi xoá session local. */
export async function logout(): Promise<void> {
  try {
    await request("/auth/logout", { method: "POST", raw: true });
  } catch {
    /* hết hạn/không kết nối vẫn xoá local */
  }
  clearUser();
}

// ---------- Meals ----------

export interface MealQuery {
  page?: number;
  limit?: number;
  from?: string; // YYYY-MM-DD
  to?: string; // YYYY-MM-DD
}

export function listMeals(query: MealQuery = {}): Promise<MealPage> {
  const params = new URLSearchParams();
  if (query.page) params.set("page", String(query.page));
  if (query.limit) params.set("limit", String(query.limit));
  if (query.from) params.set("from", query.from);
  if (query.to) params.set("to", query.to);
  const qs = params.toString();
  return apiGet<MealPage>(`/meals${qs ? `?${qs}` : ""}`);
}

export interface MealPayload {
  mealType: MealType;
  eatenAt: string;
  foods?: string;
  note?: string;
  photoUrl?: string | null;
  pre?: { value: number; measuredAt: string } | null;
  post?: { value: number; measuredAt: string } | null;
}

export function createMeal(payload: MealPayload): Promise<Meal> {
  return apiSend<Meal>("POST", "/meals", payload);
}

/** PATCH /meals/:id — field undefined = không đổi; null = xoá (pre/post/photoUrl/foods/note). */
export function updateMeal(
  id: string,
  payload: Partial<MealPayload>,
): Promise<Meal> {
  return apiSend<Meal>("PATCH", `/meals/${id}`, payload);
}

export function deleteMeal(id: string): Promise<{ id: string }> {
  return apiSend<{ id: string }>("DELETE", `/meals/${id}`);
}

// ---------- Settings ----------

export function getSettings(): Promise<GlucoseSettings> {
  return apiGet<GlucoseSettings>("/settings");
}

export function updateSettings(
  payload: Partial<GlucoseSettings>,
): Promise<GlucoseSettings> {
  return apiSend<GlucoseSettings>("PUT", "/settings", payload);
}

// ---------- Ảnh R2 (dùng chung endpoint user của monolith) ----------

export interface PresignResult {
  uploadUrl: string;
  publicUrl: string;
  path: string;
  key: string;
}

export function presignMealPhoto(filename: string, contentType: string): Promise<PresignResult> {
  return apiSend<PresignResult>(
    "POST",
    "/users/upload/presign",
    { category: "meal", filename, contentType },
    { raw: true },
  );
}

// ---------- FCM notification (endpoint chung của monolith) ----------

export function registerFcmToken(token: string): Promise<unknown> {
  return apiSend("POST", "/notification/register", { token, platform: "web", app: APP_ID }, { raw: true });
}

export function unregisterFcmToken(token: string): Promise<unknown> {
  return apiSend("DELETE", "/notification/unregister", { token }, { raw: true });
}
