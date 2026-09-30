import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import type { ApiResponse, ApiError, Paginated } from '../types';
import { useBackendStore } from '../lib/backend';
import toast from 'react-hot-toast';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api/v1';

let offlineToastShownAt = 0;

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

let isRefreshing = false;
let refreshQueue: Array<{ onSuccess: (token: string) => void; onFailure: (error: unknown) => void }> = [];

const getTokens = () => ({
  accessToken: localStorage.getItem('accessToken'),
  refreshToken: localStorage.getItem('refreshToken'),
});

const clearTokens = () => {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
};

const completeRefresh = (accessToken: string) => {
  localStorage.setItem('accessToken', accessToken);
  refreshQueue.forEach(({ onSuccess }) => onSuccess(accessToken));
  refreshQueue = [];
  isRefreshing = false;
};

const failRefresh = (error: unknown) => {
  refreshQueue.forEach(({ onFailure }) => onFailure(error));
  refreshQueue = [];
  isRefreshing = false;
  clearTokens();
  window.location.href = '/auth/login';
};

const refreshAccessToken = async (): Promise<string> => {
  const { refreshToken } = getTokens();
  if (!refreshToken) throw new Error('No refresh token');

  if (!isRefreshing) {
    isRefreshing = true;
    try {
      const response = await axios.post(`${API_BASE_URL}/auth/refresh-token`, { refreshToken });
      const tokens = response.data?.data?.tokens ?? response.data?.data;
      const token = tokens?.accessToken ?? response.data?.data?.token;
      if (!token) throw new Error('Refresh failed');
      completeRefresh(token);
      return token;
    } catch (error) {
      failRefresh(error);
      throw error;
    }
  }

  return new Promise((resolve, reject) => {
    refreshQueue.push({
      onSuccess: (token) => resolve(token),
      onFailure: (error) => reject(error),
    });
  });
};

// Request interceptor - Add auth token
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const { accessToken } = getTokens();
    if (accessToken && config.headers) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

// Response interceptor - Handle 401 with refresh + global network/server failures
apiClient.interceptors.response.use(
  (response) => {
    useBackendStore.setState({ status: 'online' });
    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      const url = originalRequest.url ?? '';
      if (url.includes('/auth/login') || url.includes('/auth/refresh')) {
        clearTokens();
        return Promise.reject(error);
      }
      originalRequest._retry = true;
      try {
        const token = await refreshAccessToken();
        originalRequest.headers.Authorization = `Bearer ${token}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        return Promise.reject(refreshError);
      }
    }

    // Global server/network down handling: no HTTP response means the backend
    // is unreachable, a timeout, or a gateway failure. A plain 5xx is the
    // server responding with an application error, which is NOT the same as
    // being offline — treating it as offline raised a false "server offline"
    // banner for ordinary backend bugs.
    const status = error.response?.status;
    const transportDown = !error.response ||
      error.code === 'ERR_NETWORK' ||
      error.code === 'ECONNABORTED' ||
      error.code === 'ETIMEDOUT' ||
      status === 502 ||
      status === 503 ||
      status === 504;

    if (transportDown) {
      useBackendStore.setState({ status: 'offline' });
      const now = Date.now();
      if (now - offlineToastShownAt > 25000) {
        offlineToastShownAt = now;
        toast.error(
          error.code === 'ECONNABORTED'
            ? 'The server took too long to respond. Please try again.'
            : 'Cannot reach the server. Make sure the backend is running and try again.',
          { duration: 5000 }
        );
      }
    }

    return Promise.reject(error);
  }
);

export const getErrorMessage = (error: unknown): string => {
  if (axios.isAxiosError<ApiError>(error)) {
    if (!error.response) {
      if (error.code === 'ECONNABORTED') return 'The server took too long to respond. Please try again.';
      return 'Cannot reach the server. Make sure the backend is running and try again.';
    }
    const status = error.response.status;
    const data = error.response.data;
    const nested = data && typeof data.error === 'object' ? data.error : null;
    const message =
      (nested && typeof nested.message === 'string' ? nested.message : undefined) ||
      data?.message ||
      data?.error ||
      error.message ||
      'Something went wrong';
    if (status >= 500) return 'Something went wrong on the server. Please try again in a moment.';
    return typeof message === 'string' ? message : 'Something went wrong';
  }
  if (error instanceof Error) return error.message;
  return 'Something went wrong';
};

export const getErrorCode = (error: unknown): string => {
  if (axios.isAxiosError<ApiError>(error)) {
    const data = error.response?.data;
    const code =
      (data?.error && typeof data.error === 'object' ? (data.error as { code?: string }).code : undefined) ||
      error.response?.status?.toString();
    return code ?? 'UNKNOWN';
  }
  return 'UNKNOWN';
};

export const getErrorKind = (error: unknown): 'network' | 'server' | 'auth' | 'generic' => {
  if (axios.isAxiosError<ApiError>(error)) {
    if (!error.response) return 'network';
    if (error.response.status >= 500) return 'server';
    if (error.response.status === 401 || error.response.status === 403) return 'auth';
  }
  return 'generic';
};

// Typed helpers
export const apiGet = async <T>(url: string, params?: Record<string, unknown>): Promise<T> => {
  const response = await apiClient.get<ApiResponse<T>>(url, { params });
  return response.data.data as T;
};

export const apiPaginated = async <T>(url: string, params?: Record<string, unknown>): Promise<Paginated<T>> => {
  const response = await apiClient.get<ApiResponse<Paginated<T>>>(url, { params });
  const data = response.data.data as Paginated<T>;
  if (data && Array.isArray((data as unknown as { items?: T[] }).items)) return data;
  return {
    items: (data as unknown as T[]) ?? [],
    total: response.data.meta?.total ?? 0,
    page: response.data.meta?.page ?? 1,
    pageSize: response.data.meta?.pageSize ?? 20,
    totalPages: response.data.meta?.totalPages ?? 1,
  };
};

export const apiPost = async <T>(url: string, data?: unknown, params?: Record<string, unknown>): Promise<T> => {
  const response = await apiClient.post<ApiResponse<T>>(url, data, { params });
  return response.data.data as T;
};

export const apiPatch = async <T>(url: string, data?: unknown): Promise<T> => {
  const response = await apiClient.patch<ApiResponse<T>>(url, data);
  return response.data.data as T;
};

export const apiPut = async <T>(url: string, data?: unknown): Promise<T> => {
  const response = await apiClient.put<ApiResponse<T>>(url, data);
  return response.data.data as T;
};

export const apiDelete = async <T>(url: string, params?: Record<string, unknown>): Promise<T> => {
  const response = await apiClient.delete<ApiResponse<T>>(url, { params });
  return response.data.data as T;
};

export default apiClient;