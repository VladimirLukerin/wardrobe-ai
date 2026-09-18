import { WARDROBE_SYNC_ENDPOINT, WARDROBE_ENDPOINT } from '@/config/api';
import type { ImageProcessingStatus } from '@/constants/wardrobe-item';
import { AccountApiError, apiFetch } from '@/services/account';

export type WardrobeItemImagesMetadata = {
  originalAvailable: boolean;
  processedAvailable: boolean;
  originalUpdatedAt: string | null;
  processedUpdatedAt: string | null;
};

export type WardrobeItemMetadata = {
  id: string;
  name: string;
  baseName: string;
  category: string;
  color: string;
  pattern: string;
  printDescription: string | null;
  style: string;
  isFavorite: boolean;
  imageProcessingStatus: ImageProcessingStatus | null;
  images: WardrobeItemImagesMetadata;
  updatedAt: string;
};

export type WardrobeDeletedItemMetadata = {
  id: string;
  deletedAt: string;
};

export type WardrobeSnapshot = {
  items: WardrobeItemMetadata[];
  deletedItems: WardrobeDeletedItemMetadata[];
  serverTime: string;
};

export type WardrobeSyncItemPayload = {
  id: string;
  name: string;
  baseName: string;
  category: string;
  color: string;
  pattern: string;
  printDescription: string | null;
  style: string;
  isFavorite: boolean;
  imageProcessingStatus: ImageProcessingStatus | null;
  clientUpdatedAt: string;
};

export type WardrobeSyncDeletePayload = {
  id: string;
  clientDeletedAt: string;
};

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => null)) as T | { error?: string } | null;

  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string'
        ? payload.error
        : `Request failed with status ${response.status}`;

    throw new AccountApiError(response.status, message);
  }

  return payload as T;
}

export async function fetchWardrobeSnapshot(token: string): Promise<WardrobeSnapshot> {
  const response = await apiFetch(WARDROBE_ENDPOINT, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  return parseJsonResponse<WardrobeSnapshot>(response);
}

export async function postWardrobeSync(
  token: string,
  payload: {
    items: WardrobeSyncItemPayload[];
    deletedItems: WardrobeSyncDeletePayload[];
  },
): Promise<WardrobeSnapshot> {
  const response = await apiFetch(WARDROBE_SYNC_ENDPOINT, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  return parseJsonResponse<WardrobeSnapshot>(response);
}
