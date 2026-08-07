import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { queryKeys } from '../api/queryKeys';
import type { PatrolStatus } from './usePatrolLogs';

interface ScanPayload {
  qrCode: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  deviceId?: string;
}

export interface ScanResult {
  status: PatrolStatus;
  distanceMeters: number | null;
  radiusMeters?: number;
  checkpointName?: string;
  flagReason?: string | null;
  underlyingResult?: string;
  message: string;
}

export function useScanMutation() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (payload: ScanPayload): Promise<ScanResult> => {
      const deviceId =
        payload.deviceId ?? localStorage.getItem('patrol_device_id') ?? undefined;
      const { data } = await apiClient.post<ScanResult>('/patrol/scan', {
        ...payload,
        deviceId,
      });
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['patrol-logs'] });
      qc.invalidateQueries({ queryKey: queryKeys.dashboardStats });
    },
  });
}
