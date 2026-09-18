import type { Response } from 'express';

export function isDevOtpBypassEnabled(): boolean {
  return process.env.NODE_ENV !== 'production' && process.env.AUTH_DEV_BYPASS_OTP === 'true';
}

export function withDevBypassFlag<T extends Record<string, unknown>>(response: T): T & { devBypassAvailable?: true } {
  if (!isDevOtpBypassEnabled()) {
    return response;
  }

  return {
    ...response,
    devBypassAvailable: true,
  };
}

export function ensureDevOtpBypassEnabled(res: Response): boolean {
  if (!isDevOtpBypassEnabled()) {
    res.status(404).json({ error: 'Not found' });
    return false;
  }

  return true;
}
