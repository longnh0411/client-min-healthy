// Bearer-auth session store — port từ client-mim-trading/app/lib/session.ts.
// Tokens (access/refresh) lưu client-side; rememberMe: true → localStorage,
// false → sessionStorage. `user` key giữ object tối giản cho hiển thị.
const ACCESS_KEY = "access_token";
const REFRESH_KEY = "refresh_token";
const USER_KEY = "user";

function storage(persist: boolean): Storage {
  return persist ? localStorage : sessionStorage;
}

function rawGet(key: string): string | null {
  try {
    return localStorage.getItem(key) ?? sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface SessionUser {
  email?: string;
  name?: string;
  picture?: string;
}

/** Lưu tokens (+ user tối giản). persist chọn localStorage/sessionStorage. */
export const setTokens = (tokens: AuthTokens, persist = true) => {
  const s = storage(persist);
  s.setItem(ACCESS_KEY, tokens.accessToken);
  s.setItem(REFRESH_KEY, tokens.refreshToken);
};

export const setUser = (data: unknown, persist = true) =>
  storage(persist).setItem(USER_KEY, JSON.stringify(data));

export const getUser = (): SessionUser | null => {
  const raw = rawGet(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SessionUser;
  } catch {
    return null;
  }
};

export const getAccessToken = (): string | null => rawGet(ACCESS_KEY);
export const getRefreshToken = (): string | null => rawGet(REFRESH_KEY);

export const isLoggedIn = (): boolean => !!getAccessToken();

/** Xoá toàn bộ session (cả 2 storage, cả 3 key). */
export const clearUser = () => {
  [ACCESS_KEY, REFRESH_KEY, USER_KEY].forEach((k) => {
    try {
      localStorage.removeItem(k);
      sessionStorage.removeItem(k);
    } catch {
      /* storage chặn (private mode) thì bỏ qua */
    }
  });
};
