import { OUTFITS_ENDPOINT, OUTFITS_SYNC_ENDPOINT } from '@/config/api';
import type { SavedOutfitSource } from '@/constants/saved-outfit';
import { AccountApiError } from '@/services/account';

export type SavedOutfitMetadata = {
  id: string;
  title: string;
  description: string;
  source: SavedOutfitSource | null;
  itemIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type SavedOutfitDeletedMetadata = {
  id: string;
  deletedAt: string;
};

export type OutfitsSnapshot = {
  outfits: SavedOutfitMetadata[];
  deletedOutfits: SavedOutfitDeletedMetadata[];
  serverTime: string;
};

export type OutfitsSyncItemPayload = {
  id: string;
  title: string;
  description: string;
  source: SavedOutfitSource | null;
  itemIds: string[];
  createdAt: string;
  clientUpdatedAt: string;
};

export type OutfitsSyncDeletePayload = {
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

export async function fetchOutfitsSnapshot(token: string): Promise<OutfitsSnapshot> {
  const response = await fetch(OUTFITS_ENDPOINT, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  return parseJsonResponse<OutfitsSnapshot>(response);
}

export async function postOutfitsSync(
  token: string,
  payload: {
    outfits: OutfitsSyncItemPayload[];
    deletedOutfits: OutfitsSyncDeletePayload[];
  },
): Promise<OutfitsSnapshot> {
  const response = await fetch(OUTFITS_SYNC_ENDPOINT, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  return parseJsonResponse<OutfitsSnapshot>(response);
}
