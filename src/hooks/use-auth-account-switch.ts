import { useCallback } from 'react';

import { useAccount } from '@/contexts/account-context';
import type { ServerUser } from '@/services/account';

export type AuthSwitchResult = {
  user: ServerUser;
  token: string;
};

export type ConfirmAccountSwitchFn = (
  authResult: AuthSwitchResult,
  onComplete?: () => void,
) => Promise<void>;

export function useAuthEntryAccountSwitch() {
  const { switchToAuthenticatedAccount } = useAccount();

  const confirmAndSwitch = useCallback<ConfirmAccountSwitchFn>(
    async (authResult, onComplete) => {
      onComplete?.();
      await switchToAuthenticatedAccount(authResult.user, authResult.token);
    },
    [switchToAuthenticatedAccount],
  );

  return { confirmAndSwitch };
}
