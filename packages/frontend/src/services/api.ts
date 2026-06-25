import axios from 'axios';
import type { AxiosInstance } from 'axios';
import { useAuthStore } from '@/stores/authStore';

const api: AxiosInstance = axios.create({
  baseURL: import.meta.env['VITE_API_URL'] ?? '/api',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT on every request
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers['Authorization'] = `Bearer ${token}`;
  return config;
});

// Auto-refresh on 401
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      const refreshToken = useAuthStore.getState().refreshToken;
      if (refreshToken) {
        try {
          const { data } = await axios.post('/api/auth/refresh', { refreshToken });
          useAuthStore.getState().setTokens(data.data.accessToken, data.data.refreshToken);
          original.headers['Authorization'] = `Bearer ${data.data.accessToken}`;
          return api(original);
        } catch {
          useAuthStore.getState().logout();
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  },
);

export default api;
