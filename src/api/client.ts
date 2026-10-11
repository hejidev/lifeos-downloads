import * as SecureStore from "expo-secure-store";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "https://api.lifeos.com.ng/api";
const TOKEN_KEY = "lifeos_staff_token";
const SHIFT_START_KEY = "lifeos_shift_start";
const REQUEST_TIMEOUT_MS = 20000;

export class StaffSessionExpiredError extends Error {
  constructor(message = "Session expired") {
    super(message);
    this.name = "StaffSessionExpiredError";
    Object.setPrototypeOf(this, StaffSessionExpiredError.prototype);
  }
}

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

export class NetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NetworkError";
    Object.setPrototypeOf(this, NetworkError.prototype);
  }
}

export async function saveToken(token: string) {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export function getToken() {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function saveShiftStart(iso: string) {
  await SecureStore.setItemAsync(SHIFT_START_KEY, iso);
}

export async function getShiftStart(): Promise<Date | null> {
  const value = await SecureStore.getItemAsync(SHIFT_START_KEY);
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function clearSession() {
  await Promise.all([
    SecureStore.deleteItemAsync(TOKEN_KEY),
    SecureStore.deleteItemAsync(SHIFT_START_KEY),
  ]);
}

async function request<T>(path: string, init: RequestInit = {}, authenticated = true): Promise<T> {
  const token = authenticated ? await getToken() : null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...((init.headers as Record<string, string> | undefined) ?? {}),
      },
    });
  } catch (err: any) {
    throw new NetworkError(
      err?.name === "AbortError"
        ? "The server took too long to respond."
        : "Can't reach the server. Check your connection."
    );
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 401 && authenticated) {
    await clearSession();
    throw new StaffSessionExpiredError();
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new ApiError(data?.error ?? "Request failed", res.status);
  }

  if (res.status === 204) return null as T;
  return res.json() as Promise<T>;
}

export const staffApi = {
  get: <T = any>(path: string) => request<T>(path),
  post: <T = any>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) }),
};

export async function staffLogin(storeCode: string, name: string, pin: string) {
  const data = await request<{ token?: string }>(
    "/staff-session/login",
    { method: "POST", body: JSON.stringify({ storeCode, name, pin }) },
    false
  );
  if (!data?.token || typeof data.token !== "string") {
    throw new Error("The server didn't return a valid session. The backend may need a redeploy.");
  }
  await saveToken(data.token);
  await saveShiftStart(new Date().toISOString());
  return data;
}