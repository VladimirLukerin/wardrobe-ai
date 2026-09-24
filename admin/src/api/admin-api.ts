import {
  ApiError,
  type AdminAiEventsResponse,
  type AdminAiSummary,
  type AdminAppSettingEntry,
  type AdminDashboardMetrics,
  type AdminLoginResponse,
  type AdminMeResponse,
  type AdminSettingsResponse,
  type AppSettingKey,
  type AdminUserDetailResponse,
  type AdminUsersListResponse,
  type PaginatedResponse,
  type AdminWardrobeItem,
  type AdminOutfitItem,
  type AdminWearEventItem,
  type AdminFamilyMemberItem,
} from '../types/admin-api';
import { clearStoredAdminToken, getStoredAdminToken, setStoredAdminToken } from '../auth/auth-storage';

export type UnauthorizedHandler = () => void;

let unauthorizedHandler: UnauthorizedHandler | null = null;

export function setUnauthorizedHandler(handler: UnauthorizedHandler | null): void {
  unauthorizedHandler = handler;
}

function getBaseUrl(): string {
  const base = import.meta.env.VITE_ADMIN_API_URL?.trim();

  if (!base) {
    throw new ApiError('VITE_ADMIN_API_URL is not configured.', 0, 'unknown');
  }

  return base.replace(/\/$/, '');
}

type JsonBody = Record<string, unknown> | unknown[] | null;

function parseRetryAfter(headerValue: string | null): number | null {
  if (!headerValue) {
    return null;
  }

  const seconds = Number.parseInt(headerValue, 10);

  return Number.isFinite(seconds) ? seconds : null;
}

function mapStatusToCode(status: number): ApiError['code'] {
  if (status === 401) {
    return 'unauthorized';
  }

  if (status === 403) {
    return 'forbidden';
  }

  if (status === 404) {
    return 'not_found';
  }

  if (status === 429) {
    return 'rate_limited';
  }

  if (status >= 500) {
    return 'server';
  }

  return 'unknown';
}

async function parseErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string };

    if (typeof body.error === 'string' && body.error.trim()) {
      return body.error;
    }
  } catch {
    // ignore
  }

  return 'Unexpected server error.';
}

export async function adminFetch<T>(
  path: string,
  options: {
    method?: string;
    body?: JsonBody;
    auth?: boolean;
  } = {},
): Promise<T> {
  const url = `${getBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`;
  const headers: Record<string, string> = {};

  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  if (options.auth !== false) {
    const token = getStoredAdminToken();

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  let response: Response;

  try {
    response = await fetch(url, {
      method: options.method ?? 'GET',
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new ApiError('Server unavailable.', 0, 'network');
  }

  if (response.status === 204) {
    return undefined as T;
  }

  if (!response.ok) {
    const message = await parseErrorMessage(response);
    const code = mapStatusToCode(response.status);

    if (response.status === 401) {
      clearStoredAdminToken();
      unauthorizedHandler?.();
    }

    throw new ApiError(
      message,
      response.status,
      code,
      parseRetryAfter(response.headers.get('Retry-After')),
    );
  }

  return (await response.json()) as T;
}

export async function adminLogin(email: string, password: string): Promise<AdminLoginResponse> {
  const result = await adminFetch<AdminLoginResponse>('/admin/auth/login', {
    method: 'POST',
    auth: false,
    body: { email, password },
  });

  setStoredAdminToken(result.token);
  return result;
}

export async function adminLogout(): Promise<void> {
  try {
    await adminFetch<void>('/admin/auth/logout', { method: 'POST' });
  } finally {
    clearStoredAdminToken();
  }
}

export async function adminMe(): Promise<AdminMeResponse> {
  return adminFetch<AdminMeResponse>('/admin/auth/me');
}

export async function fetchDashboard(): Promise<AdminDashboardMetrics> {
  return adminFetch<AdminDashboardMetrics>('/admin/dashboard');
}

export async function fetchUsers(params: {
  q?: string;
  accountType?: 'guest' | 'protected';
  limit?: number;
  cursor?: string | null;
}): Promise<AdminUsersListResponse> {
  const search = new URLSearchParams();

  if (params.q?.trim()) {
    search.set('q', params.q.trim());
  }

  if (params.accountType) {
    search.set('accountType', params.accountType);
  }

  if (params.limit) {
    search.set('limit', String(params.limit));
  }

  if (params.cursor) {
    search.set('cursor', params.cursor);
  }

  const query = search.toString();
  return adminFetch<AdminUsersListResponse>(`/admin/users${query ? `?${query}` : ''}`);
}

export async function fetchUserDetail(userId: string): Promise<AdminUserDetailResponse> {
  return adminFetch<AdminUserDetailResponse>(`/admin/users/${encodeURIComponent(userId)}`);
}

export async function fetchUserWardrobe(
  userId: string,
  cursor?: string | null,
): Promise<PaginatedResponse<AdminWardrobeItem>> {
  const search = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
  return adminFetch<PaginatedResponse<AdminWardrobeItem>>(
    `/admin/users/${encodeURIComponent(userId)}/wardrobe${search}`,
  );
}

export async function fetchUserOutfits(
  userId: string,
  cursor?: string | null,
): Promise<PaginatedResponse<AdminOutfitItem>> {
  const search = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
  return adminFetch<PaginatedResponse<AdminOutfitItem>>(
    `/admin/users/${encodeURIComponent(userId)}/outfits${search}`,
  );
}

export async function fetchUserWearHistory(
  userId: string,
  cursor?: string | null,
): Promise<PaginatedResponse<AdminWearEventItem>> {
  const search = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
  return adminFetch<PaginatedResponse<AdminWearEventItem>>(
    `/admin/users/${encodeURIComponent(userId)}/wear-history${search}`,
  );
}

export async function fetchUserFamily(
  userId: string,
  cursor?: string | null,
): Promise<PaginatedResponse<AdminFamilyMemberItem>> {
  const search = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
  return adminFetch<PaginatedResponse<AdminFamilyMemberItem>>(
    `/admin/users/${encodeURIComponent(userId)}/family${search}`,
  );
}

export async function fetchAiSummary(params?: {
  from?: string;
  to?: string;
  type?: 'photo' | 'suggest' | 'daily' | 'paired';
}): Promise<AdminAiSummary> {
  const search = new URLSearchParams();

  if (params?.from) {
    search.set('from', params.from);
  }

  if (params?.to) {
    search.set('to', params.to);
  }

  if (params?.type) {
    search.set('type', params.type);
  }

  const query = search.toString();
  return adminFetch<AdminAiSummary>(`/admin/ai/summary${query ? `?${query}` : ''}`);
}

export async function fetchAiEvents(params?: {
  limit?: number;
  cursor?: string | null;
  type?: 'photo' | 'suggest' | 'daily' | 'paired';
  status?: string;
}): Promise<AdminAiEventsResponse> {
  const search = new URLSearchParams();

  if (params?.limit) {
    search.set('limit', String(params.limit));
  }

  if (params?.cursor) {
    search.set('cursor', params.cursor);
  }

  if (params?.type) {
    search.set('type', params.type);
  }

  if (params?.status) {
    search.set('status', params.status);
  }

  const query = search.toString();
  return adminFetch<AdminAiEventsResponse>(`/admin/ai/events${query ? `?${query}` : ''}`);
}

export async function fetchAdminSettings(): Promise<AdminSettingsResponse> {
  return adminFetch<AdminSettingsResponse>('/admin/settings');
}

export async function updateAdminSetting(
  key: AppSettingKey,
  value: boolean | number | string,
): Promise<{ setting: AdminAppSettingEntry }> {
  return adminFetch<{ setting: AdminAppSettingEntry }>(`/admin/settings/${encodeURIComponent(key)}`, {
    method: 'PUT',
    body: { value },
  });
}

export { clearStoredAdminToken, getStoredAdminToken };
