import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';

export interface IssueImage {
  id: string;
  imageUrl: string;
  r2Key: string;
}

export interface IncidentReport {
  id: string;
  title: string;
  description?: string;
  checkpointId?: string;
  patrolLogId?: string;
  createdAt: string;
  guard: {
    id: string;
    name: string;
    email: string;
  };
  checkpoint?: {
    id: string;
    name: string;
  };
  images: IssueImage[];
}

export interface PresignedUrlResponse {
  uploadUrl: string;
  imageUrl: string;
  r2Key: string;
}

export interface CreateIncidentPayload {
  title: string;
  description?: string;
  checkpointId?: string;
  patrolLogId?: string;
  images: { imageUrl: string; r2Key: string }[];
}

export function useIncidents() {
  return useQuery<IncidentReport[]>({
    queryKey: ['incidents'],
    queryFn: async () => {
      const res = await apiClient.get<IncidentReport[]>('/incidents');
      return res.data;
    },
  });
}

export function useCreateIncident() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateIncidentPayload) => {
      const res = await apiClient.post<IncidentReport>('/incidents', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incidents'] });
    },
  });
}

/**
 * Utility to request a presigned URL from backend and upload image directly to R2
 */
export async function uploadImageToR2(file: File): Promise<{ imageUrl: string; r2Key: string }> {
  // 1. Get presigned upload URL from backend
  const ext = file.name.split('.').pop() || 'jpg';
  const presignedRes = await apiClient.post<PresignedUrlResponse>('/incidents/upload-url', {
    contentType: file.type || 'image/jpeg',
    fileExtension: ext,
  });

  const { uploadUrl, imageUrl, r2Key } = presignedRes.data;

  // 2. Direct PUT request to R2 uploadUrl (or mock mode fallback)
  if (uploadUrl.includes('mock=true')) {
    // Mock mode if R2 not yet configured in .env
    console.warn('R2 credentials not configured. Using placeholder URL.');
    return { imageUrl: URL.createObjectURL(file), r2Key };
  }

  const uploadRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': file.type || 'image/jpeg',
    },
    body: file,
  });

  if (!uploadRes.ok) {
    throw new Error(`Failed to upload image to Cloudflare R2 (${uploadRes.statusText})`);
  }

  return { imageUrl, r2Key };
}
