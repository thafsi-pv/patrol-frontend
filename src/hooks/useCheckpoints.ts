import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { queryKeys } from '../api/queryKeys';

export interface Checkpoint {
  id: string;
  qrCode: string;
  name: string;
  description?: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  active: boolean;
  createdAt: string;
  createdBy?: { id: string; name: string; email: string };
  _count?: { patrolLogs: number };
}

export function useCheckpoints() {
  return useQuery({
    queryKey: queryKeys.checkpoints.all,
    queryFn: async () => {
      const { data } = await apiClient.get<Checkpoint[]>('/checkpoints');
      return data;
    },
    staleTime: 3 * 60 * 1000, // 3 minutes
  });
}

export function useCheckpoint(id: string) {
  return useQuery({
    queryKey: queryKeys.checkpoints.detail(id),
    queryFn: async () => {
      const { data } = await apiClient.get<Checkpoint>(`/checkpoints/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

export function useCreateCheckpoint() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dto: {
      name: string;
      description?: string;
      latitude: number;
      longitude: number;
      radiusMeters?: number;
    }) => {
      const { data } = await apiClient.post<Checkpoint>('/checkpoints', dto);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.checkpoints.all }),
  });
}

export function useUpdateCheckpoint() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...dto }: Partial<Checkpoint> & { id: string }) => {
      const { data } = await apiClient.patch<Checkpoint>(`/checkpoints/${id}`, dto);
      return data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.checkpoints.all });
      qc.invalidateQueries({ queryKey: queryKeys.checkpoints.detail(vars.id) });
    },
  });
}

export function useDeleteCheckpoint() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/checkpoints/${id}`);
      return id;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.checkpoints.all }),
  });
}
