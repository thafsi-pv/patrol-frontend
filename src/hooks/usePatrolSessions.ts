import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';

export interface RouteCheckpoint {
  id: string;
  orderIndex: number;
  checkpointId: string;
  checkpoint: {
    id: string;
    name: string;
    description?: string;
    latitude: number;
    longitude: number;
    radiusMeters: number;
  };
}

export interface PatrolRoute {
  id: string;
  name: string;
  description?: string;
  active: boolean;
  createdAt: string;
  checkpoints: RouteCheckpoint[];
  _count?: { sessions: number };
}

export interface PatrolSession {
  id: string;
  routeId: string;
  guardId: string;
  startTime: string;
  endTime?: string;
  durationSeconds?: number;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  completedCount: number;
  totalCount: number;
  completionRate: number;
  shift?: string;
  route: { id: string; name: string };
  guard: { id: string; name: string; email: string };
  sessionLogs?: any[];
}

export interface SessionLog {
  id: string;
  sessionId: string;
  checkpointId: string;
  checkpoint: { id: string; name: string; latitude: number; longitude: number };
  scannedAt: string;
  scannedLatitude: number;
  scannedLongitude: number;
  gpsAccuracyMeters?: number;
  distanceMeters?: number;
  isVerified: boolean;
  severity: 'NORMAL' | 'ISSUE_FOUND' | 'EMERGENCY';
  remarks?: string;
  images?: { id: string; imageUrl: string; r2Key: string }[];
}

// ─── Route hooks ──────────────────────────────────────────────────────────────

export function useRoutes() {
  return useQuery<PatrolRoute[]>({
    queryKey: ['routes'],
    queryFn: async () => (await apiClient.get('/routes')).data,
  });
}

export function useRoute(id: string) {
  return useQuery<PatrolRoute>({
    queryKey: ['routes', id],
    queryFn: async () => (await apiClient.get(`/routes/${id}`)).data,
    enabled: !!id,
  });
}

export function useCreateRoute() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; description?: string; checkpointIds: string[] }) =>
      apiClient.post('/routes', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['routes'] }),
  });
}

export function useUpdateRoute() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; name?: string; checkpointIds?: string[]; active?: boolean }) =>
      apiClient.patch(`/routes/${id}`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['routes'] }),
  });
}

export function useDeactivateRoute() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/routes/${id}`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['routes'] }),
  });
}

// ─── Session hooks ────────────────────────────────────────────────────────────

export function useMyActiveSession() {
  return useQuery<PatrolSession | null>({
    queryKey: ['patrol-sessions', 'my-active'],
    queryFn: async () => {
      const res = await apiClient.get('/patrol-sessions/my-active');
      return res.data || null;
    },
    refetchInterval: 30000,
  });
}

export function useActiveSessions() {
  return useQuery<PatrolSession[]>({
    queryKey: ['patrol-sessions', 'active'],
    queryFn: async () => (await apiClient.get('/patrol-sessions/active')).data,
    refetchInterval: 60000, // 1-minute polling as requested
  });
}

export function useSessionStats() {
  return useQuery<{ active: number; completedToday: number; totalToday: number; emergencies: number }>({
    queryKey: ['patrol-sessions', 'stats'],
    queryFn: async () => (await apiClient.get('/patrol-sessions/stats')).data,
    refetchInterval: 60000,
  });
}

export function useSessions(filters?: Record<string, any>) {
  return useQuery({
    queryKey: ['patrol-sessions', filters],
    queryFn: async () => (await apiClient.get('/patrol-sessions', { params: filters })).data,
  });
}

export function useSession(id: string) {
  return useQuery<any>({
    queryKey: ['patrol-sessions', id],
    queryFn: async () => (await apiClient.get(`/patrol-sessions/${id}`)).data,
    enabled: !!id,
  });
}

export function useStartPatrol() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { routeId: string; shift?: string }) =>
      apiClient.post('/patrol-sessions/start', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['patrol-sessions'] }),
  });
}

export function useScanCheckpoint() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ sessionId, ...data }: { sessionId: string; qrCode: string; latitude: number; longitude: number; accuracy?: number; severity?: string; remarks?: string; images?: any[] }) =>
      apiClient.post(`/patrol-sessions/${sessionId}/scan`, data).then(r => r.data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['patrol-sessions', vars.sessionId] });
      qc.invalidateQueries({ queryKey: ['patrol-sessions', 'active'] });
    },
  });
}

export function useEndPatrol() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) =>
      apiClient.post(`/patrol-sessions/${sessionId}/end`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['patrol-sessions'] }),
  });
}
