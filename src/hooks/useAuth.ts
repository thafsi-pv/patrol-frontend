import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { useAuthStore } from '../store/authStore';

// Generate or retrieve a persistent device fingerprint
function getDeviceId(): string {
  let id = localStorage.getItem('patrol_device_id');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('patrol_device_id', id);
  }
  return id;
}

export function useLogin() {
  const { setAuth } = useAuthStore();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (credentials: { email: string; password: string }) => {
      const deviceId = getDeviceId();
      const { data } = await apiClient.post('/auth/login', {
        ...credentials,
        deviceId,
      });
      return data as { accessToken: string; user: any };
    },
    onSuccess: (data) => {
      setAuth(data.accessToken, data.user);
      queryClient.invalidateQueries();
    },
  });
}

export function useLogout() {
  const { clearAuth } = useAuthStore();
  const queryClient = useQueryClient();

  return () => {
    clearAuth();
    queryClient.clear();
    window.location.href = '/login';
  };
}
