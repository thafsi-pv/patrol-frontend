import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

export const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT from localStorage on every request
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('patrol_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// On 401 — clear auth and redirect to login
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('patrol_token');
      localStorage.removeItem('patrol_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  },
);
