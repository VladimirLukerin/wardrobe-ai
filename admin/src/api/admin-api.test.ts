import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  adminFetch,
  adminLogin,
  adminLogout,
  clearStoredAdminToken,
  setUnauthorizedHandler,
} from './admin-api';
import { setStoredAdminToken } from '../auth/auth-storage';
import { ApiError } from '../types/admin-api';

function mockResponse({
  status,
  body,
  headers,
}: {
  status: number;
  body?: unknown;
  headers?: Record<string, string>;
}): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(headers),
    json: async () => body,
  } as Response;
}

describe('admin api client', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    clearStoredAdminToken();
    setUnauthorizedHandler(null);
  });

  it('rejects unauthenticated fetch with 401', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(mockResponse({ status: 401, body: { error: 'Unauthorized' } })),
    );

    await expect(adminFetch('/admin/users')).rejects.toEqual(
      expect.objectContaining<Partial<ApiError>>({ code: 'unauthorized', status: 401 }),
    );
  });

  it('maps 429 to rate_limited with retry-after', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        mockResponse({
          status: 429,
          body: { error: 'Too many attempts' },
          headers: { 'Retry-After': '30' },
        }),
      ),
    );

    await expect(adminFetch('/admin/users')).rejects.toEqual(
      expect.objectContaining<Partial<ApiError>>({
        code: 'rate_limited',
        retryAfterSeconds: 30,
      }),
    );
  });

  it('stores token on successful login', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        mockResponse({
          status: 200,
          body: {
            token: 'session-token',
            admin: {
              id: '1',
              email: 'admin@example.com',
              role: 'owner',
              createdAt: '2026-01-01T00:00:00.000Z',
              lastLoginAt: null,
            },
          },
        }),
      ),
    );

    const result = await adminLogin('admin@example.com', 'secret-password');
    expect(result.token).toBe('session-token');
    expect(sessionStorage.getItem('prikin_admin_session_token')).toBe('session-token');
  });

  it('clears token on logout even if request fails', async () => {
    setStoredAdminToken('session-token');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

    await expect(adminLogout()).rejects.toEqual(
      expect.objectContaining<Partial<ApiError>>({ code: 'network' }),
    );
    expect(sessionStorage.getItem('prikin_admin_session_token')).toBeNull();
  });

  it('invokes unauthorized handler on 401', async () => {
    const handler = vi.fn();
    setUnauthorizedHandler(handler);

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(mockResponse({ status: 401, body: { error: 'Unauthorized' } })),
    );

    setStoredAdminToken('expired');

    await expect(adminFetch('/admin/auth/me')).rejects.toBeInstanceOf(ApiError);
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
