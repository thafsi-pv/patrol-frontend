import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { queryKeys } from '../api/queryKeys';

export type PatrolStatus = 'SUCCESS' | 'OUT_OF_RANGE' | 'UNKNOWN_QR' | 'FLAGGED';

export interface PatrolLog {
  id: string;
  qrCode: string;
  checkpointId?: string;
  checkpoint?: { id: string; name: string };
  guardId: string;
  guard?: { id: string; name: string; email: string };
  scannedLatitude: number;
  scannedLongitude: number;
  gpsAccuracyMeters?: number;
  distanceMeters?: number;
  status: PatrolStatus;
  flagReason?: string;
  deviceId?: string;
  createdAt: string;
}

export interface LogsFilter {
  checkpointId?: string;
  guardId?: string;
  status?: PatrolStatus;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

export interface PagedLogs {
  data: PatrolLog[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function usePatrolLogs(filters: LogsFilter = {}) {
  return useQuery({
    queryKey: queryKeys.patrolLogs.all(filters),
    queryFn: async () => {
      const { data } = await apiClient.get<PagedLogs>('/patrol/logs', {
        params: filters,
      });
      return data;
    },
    staleTime: 30 * 1000, // 30 seconds — near-real-time
    refetchOnWindowFocus: true,
  });
}

export function usePatrolLog(id: string) {
  return useQuery({
    queryKey: queryKeys.patrolLogs.detail(id),
    queryFn: async () => {
      const { data } = await apiClient.get<PatrolLog>(`/patrol/logs/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

export function useDashboardStats() {
  return useQuery({
    queryKey: queryKeys.dashboardStats,
    queryFn: async () => {
      const { data } = await apiClient.get('/patrol/dashboard-stats');
      return data as {
        totalCheckpoints: number;
        scansToday: number;
        flaggedToday: number;
        totalGuards: number;
      };
    },
    staleTime: 60 * 1000,
    refetchOnWindowFocus: true,
  });
}
