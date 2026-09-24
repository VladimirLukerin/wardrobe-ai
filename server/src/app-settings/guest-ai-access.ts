import type { Response } from 'express';

import { isGuestAiEnabledForUser } from '../app-settings/app-settings-service';

export const GUEST_AI_DISABLED_MESSAGE = 'AI недоступен для гостевого аккаунта.';

export const GUEST_AI_DISABLED_CODE = 'guest_ai_disabled';

export function isGuestAiAllowedForUser(user: {
  emailVerified: boolean;
  phoneVerified: boolean;
}): boolean {
  return isGuestAiEnabledForUser(user);
}

export function respondGuestAiDisabled(res: Response): void {
  res.status(403).json({
    error: GUEST_AI_DISABLED_MESSAGE,
    code: GUEST_AI_DISABLED_CODE,
  });
}

export function respondIfGuestAiDisabled(
  res: Response,
  user: { emailVerified: boolean; phoneVerified: boolean } | undefined,
): boolean {
  if (!user) {
    return false;
  }

  if (isGuestAiAllowedForUser(user)) {
    return false;
  }

  respondGuestAiDisabled(res);
  return true;
}
