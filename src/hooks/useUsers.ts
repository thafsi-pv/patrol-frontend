import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { queryKeys } from '../api/queryKeys';

export interface AppUser {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'GUARD';
  deviceId?: string;
  mobileNumber?: string;
  whatsappAlertEnabled: boolean;
  createdAt: string;
}

export function useUsers() {
  return useQuery({
    queryKey: queryKeys.users.all,
    queryFn: async () => {
      const { data } = await apiClient.get<AppUser[]>('/users');
      return data;
    },
    staleTime: 60 * 1000,
  });
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dto: {
      email: string;
      name: string;
      password: string;
      role: 'ADMIN' | 'GUARD';
      mobileNumber?: string;
      whatsappAlertEnabled?: boolean;
    }) => {
      const { data } = await apiClient.post<AppUser>('/users', dto);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.users.all }),
  });
}

export function useToggleWhatsAppAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, enabled }: { userId: string; enabled: boolean }) => {
      const { data } = await apiClient.patch(`/users/${userId}/whatsapp-alert`, { enabled });
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.users.all }),
  });
}
