import {
  FAMILY_ENDPOINT,
  FAMILY_INVITES_ENDPOINT,
  familyInviteAcceptEndpoint,
  familyInviteRejectEndpoint,
  familyMemberEndpoint,
} from '@/config/api';
import type { FamilyInvite, FamilyMember, OutgoingFamilyInvite } from '@/constants/family';
import { AccountApiError, apiFetch } from '@/services/account';

export type FamilySnapshot = {
  members: FamilyMember[];
};

export type FamilyInvitesSnapshot = {
  incoming: FamilyInvite[];
  outgoing: OutgoingFamilyInvite[];
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
