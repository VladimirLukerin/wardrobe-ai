import { useEffect } from 'react';

import { useAccount } from '@/contexts/account-context';
import { useAccountProfile } from '@/contexts/account-profile-context';

export function AccountProfileReloader() {
  const { accountSessionKey } = useAccount();
  const { reloadProfileFromStorage } = useAccountProfile();

  useEffect(() => {
    if (accountSessionKey === 0) {
      return;
    }

    void reloadProfileFromStorage();
  }, [accountSessionKey, reloadProfileFromStorage]);

  return null;
}
