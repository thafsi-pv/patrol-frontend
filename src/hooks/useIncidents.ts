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
  timestamp?: number;
  signature?: string;
  apiKey?: string;
  cloudName?: string;
  publicId?: string;
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
 * Utility to request a signed Cloudinary upload params from backend and upload image directly to Cloudinary
 */
export async function uploadImageToR2(file: File): Promise<{ imageUrl: string; r2Key: string }> {
  // 1. Get signed upload parameters from backend
  const ext = file.name.split('.').pop() || 'jpg';
  const presignedRes = await apiClient.post<PresignedUrlResponse>('/incidents/upload-url', {
    contentType: file.type || 'image/jpeg',
    fileExtension: ext,
  });

  const { uploadUrl, imageUrl, r2Key, timestamp, signature, apiKey } = presignedRes.data;

  // 2. Direct upload to Cloudinary using FormData (or mock mode fallback if not configured yet)
  if (uploadUrl.includes('mock=true')) {
    console.warn('Cloudinary credentials not configured in .env yet. Using mock image URL.');
    return { imageUrl: URL.createObjectURL(file), r2Key };
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('api_key', apiKey || '');
  formData.append('timestamp', String(timestamp || ''));
  formData.append('signature', signature || '');
  formData.append('folder', 'patrol_issues');

  const uploadRes = await fetch(uploadUrl, {
    method: 'POST',
    body: formData,
  });

  if (!uploadRes.ok) {
    const errJson = await uploadRes.json().catch(() => ({}));
    throw new Error(`Failed to upload image (${errJson?.error?.message || uploadRes.statusText})`);
  }

  const resData = await uploadRes.json();

  return {
    imageUrl: resData.secure_url || imageUrl,
    r2Key: resData.public_id || r2Key,
  };
}
