import { describe, expect, it, vi } from 'vitest';

import { fetchAiSummary } from './admin-api';
import { ApiError } from '../types/admin-api';
import { setStoredAdminToken } from '../auth/auth-storage';

function mockResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(),
    json: async () => body,
  } as Response;
}

describe('admin ai api client', () => {
  it('loads AI summary', async () => {
    setStoredAdminToken('token');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        mockResponse(200, {
          totalCalls: 1,
          successfulCalls: 1,
          failedCalls: 0,
          rateLimitedCalls: 0,
          totalInputTokens: 10,
          totalOutputTokens: 5,
          totalTokens: 15,
          avgDurationMs: 100,
          estimatedTotalCostUsd: null,
          byType: [],
        }),
      ),
    );

    const summary = await fetchAiSummary();
    expect(summary.totalCalls).toBe(1);

    vi.unstubAllGlobals();
  });

  it('maps settings 403 to forbidden', async () => {
    setStoredAdminToken('token');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(mockResponse(403, { error: 'Forbidden' })),
    );

    const { updateAdminSetting } = await import('./admin-api');
    await expect(updateAdminSetting('guest_ai_enabled', false)).rejects.toEqual(
      expect.objectContaining<Partial<ApiError>>({ code: 'forbidden' }),
    );

    vi.unstubAllGlobals();
  });
});
