import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { queryKeys } from '../api/queryKeys';

export interface AppUser {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'GUARD';
  deviceId?: string;
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
    }) => {
      const { data } = await apiClient.post<AppUser>('/users', dto);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.users.all }),
  });
}
