import { create } from 'zustand';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'GUARD';
  deviceId?: string;
}

interface AuthStore {
  token: string | null;
  user: AuthUser | null;
  setAuth: (token: string, user: AuthUser) => void;
  clearAuth: () => void;
}

// Hydrate from localStorage on module load
const storedToken = localStorage.getItem('patrol_token');
const storedUser = localStorage.getItem('patrol_user');

export const useAuthStore = create<AuthStore>((set) => ({
  token: storedToken,
  user: storedUser ? JSON.parse(storedUser) : null,

  setAuth: (token, user) => {
    localStorage.setItem('patrol_token', token);
    localStorage.setItem('patrol_user', JSON.stringify(user));
    set({ token, user });
  },

  clearAuth: () => {
    localStorage.removeItem('patrol_token');
    localStorage.removeItem('patrol_user');
    set({ token: null, user: null });
  },
}));
