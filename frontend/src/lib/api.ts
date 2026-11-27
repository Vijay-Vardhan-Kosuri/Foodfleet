import axios from "axios";

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";
export const WS_BASE_URL =
  import.meta.env.VITE_WS_BASE_URL ||
  (window.location.protocol === "https:" ? `wss://${window.location.host}` : `ws://${window.location.host}`);

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("ff_access_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let isRefreshing = false;
let failedQueue: Array<{ resolve: (token: string) => void; reject: (err: unknown) => void }> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((p) => {
    if (error) p.reject(error);
    else if (token) p.resolve(token);
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      const refresh = localStorage.getItem("ff_refresh_token");
      if (!refresh) {
        return Promise.reject(error);
      }
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({
            resolve: (token: string) => {
              originalRequest.headers.Authorization = `Bearer ${token}`;
              resolve(api(originalRequest));
            },
            reject,
          });
        });
      }
      originalRequest._retry = true;
      isRefreshing = true;
      try {
        const res = await axios.post(`${API_BASE_URL}/auth/refresh/`, { refresh });
        const newAccess = res.data.access;
        localStorage.setItem("ff_access_token", newAccess);
        if (res.data.refresh) {
          localStorage.setItem("ff_refresh_token", res.data.refresh);
        }
        processQueue(null, newAccess);
        originalRequest.headers.Authorization = `Bearer ${newAccess}`;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        localStorage.removeItem("ff_access_token");
        localStorage.removeItem("ff_refresh_token");
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  }
);

export function extractApiError(err: unknown, fallback = "Something went wrong."): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { message?: string; detail?: string; errors?: Record<string, unknown> } | undefined;
    if (data?.message) return data.message;
    if (data?.detail) return data.detail;
    if (data?.errors && typeof data.errors === "object") {
      const firstVal = Object.values(data.errors)[0];
      if (Array.isArray(firstVal) && firstVal[0]) return String(firstVal[0]);
      if (typeof firstVal === "string") return firstVal;
    }
  }
  return fallback;
}
