import {
  FAMILY_ENDPOINT,
  FAMILY_INVITES_ENDPOINT,
  familyInviteAcceptEndpoint,
  familyInviteRejectEndpoint,
  familyMemberEndpoint,
  familyMemberOutfitsEndpoint,
  familyMemberWardrobeEndpoint,
} from '@/config/api';
import type { FamilyInvite, FamilyMember, OutgoingFamilyInvite } from '@/constants/family';
import type { SavedOutfitSource } from '@/constants/saved-outfit';
import type { ImageProcessingStatus } from '@/constants/wardrobe-item';
import { fetch } from 'expo/fetch';
import { AccountApiError, apiFetch } from '@/services/account';
import { NETWORK_ERROR_MESSAGE, isNetworkFailure, warnNetworkFailure } from '@/utils/network-error';

export type FamilySnapshot = {
  members: FamilyMember[];
};

export type FamilyInvitesSnapshot = {
  incoming: FamilyInvite[];
  outgoing: OutgoingFamilyInvite[];
};

export type FamilyWardrobeItemImagesMetadata = {
  originalAvailable: boolean;
  processedAvailable: boolean;
  originalUpdatedAt: string | null;
  processedUpdatedAt: string | null;
};

export type FamilyWardrobeItem = {
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
  images: FamilyWardrobeItemImagesMetadata;
  updatedAt: string;
  createdAt: string;
};

export type FamilyWardrobeSnapshot = {
  member: FamilyMember;
  items: FamilyWardrobeItem[];
};

export type FamilyMemberOutfit = {
  id: string;
  title: string;
  description: string;
  source: SavedOutfitSource | null;
  itemIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type FamilyOutfitsSnapshot = {
  member: FamilyMember;
  outfits: FamilyMemberOutfit[];
};

export type FamilyWardrobeImageDownloadResult = {
  bytes: Uint8Array;
  contentType: string;
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

export async function fetchFamilySnapshot(token: string): Promise<FamilySnapshot> {
  const response = await apiFetch(FAMILY_ENDPOINT, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  return parseJsonResponse<FamilySnapshot>(response);
}

export async function fetchFamilyInvitesSnapshot(token: string): Promise<FamilyInvitesSnapshot> {
  const response = await apiFetch(FAMILY_INVITES_ENDPOINT, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  return parseJsonResponse<FamilyInvitesSnapshot>(response);
}

export async function postFamilyInvite(
  token: string,
  publicId: string,
): Promise<OutgoingFamilyInvite> {
  const response = await apiFetch(`${FAMILY_ENDPOINT}/invite`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ publicId }),
  });

  return parseJsonResponse<OutgoingFamilyInvite>(response);
}

export async function postFamilyInviteAccept(token: string, inviteId: string): Promise<void> {
  const response = await apiFetch(familyInviteAcceptEndpoint(inviteId), {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  await parseJsonResponse<{ ok: true }>(response);
}

export async function postFamilyInviteReject(token: string, inviteId: string): Promise<void> {
  const response = await apiFetch(familyInviteRejectEndpoint(inviteId), {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  await parseJsonResponse<{ ok: true }>(response);
}

export async function deleteFamilyMember(token: string, memberPublicId: string): Promise<void> {
  const response = await apiFetch(familyMemberEndpoint(memberPublicId), {
    method: 'DELETE',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  await parseJsonResponse<{ ok: true }>(response);
}

export async function fetchFamilyMemberWardrobe(
  token: string,
  memberPublicId: string,
): Promise<FamilyWardrobeSnapshot> {
  const response = await apiFetch(familyMemberWardrobeEndpoint(memberPublicId), {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  return parseJsonResponse<FamilyWardrobeSnapshot>(response);
}

export async function fetchFamilyMemberOutfits(
  token: string,
  memberPublicId: string,
): Promise<FamilyOutfitsSnapshot> {
  const response = await apiFetch(familyMemberOutfitsEndpoint(memberPublicId), {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  return parseJsonResponse<FamilyOutfitsSnapshot>(response);
}

export async function downloadFamilyMemberWardrobeImage(
  token: string,
  endpoint: string,
): Promise<FamilyWardrobeImageDownloadResult> {
  let response: Response;

  try {
    response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  } catch (error) {
    if (isNetworkFailure(error)) {
      warnNetworkFailure('FAMILY IMAGE CLIENT', error);
      throw new AccountApiError(0, NETWORK_ERROR_MESSAGE, 'network');
    }

    throw error;
  }

  if (!response.ok) {
    throw new AccountApiError(response.status, `Request failed with status ${response.status}`);
  }

  const contentType = response.headers.get('content-type') ?? 'application/octet-stream';
  const bytes = await response.bytes();

  if (bytes.byteLength === 0) {
    throw new AccountApiError(500, 'Empty image response');
  }

  return {
    bytes,
    contentType,
  };
}
