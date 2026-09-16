import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import {
  DEFAULT_ACCOUNT_PROFILE,
  DEFAULT_DISPLAY_NAME,
  type AccountProfile,
} from '@/constants/account-profile';
import { loadProfileAccount, saveProfileAccount } from '@/storage/profile-storage';
import { generateLocalUserId } from '@/utils/generate-local-user-id';

type AccountProfileContextValue = AccountProfile & {
  setDisplayName: (displayName: string) => void;
  isHydrated: boolean;
};

const AccountProfileContext = createContext<AccountProfileContextValue | null>(null);

export function AccountProfileProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<AccountProfile>(DEFAULT_ACCOUNT_PROFILE);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    let isMounted = true;

    loadProfileAccount()
      .then((stored) => {
        if (isMounted) {
          setAccount(stored);
          setIsHydrated(true);
        }
      })
      .catch(() => {
        if (isMounted) {
          const fallbackAccount: AccountProfile = {
            localUserId: generateLocalUserId(),
            displayName: DEFAULT_DISPLAY_NAME,
          };

          void saveProfileAccount(fallbackAccount);
          setAccount(fallbackAccount);
          setIsHydrated(true);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const setDisplayName = useCallback((displayName: string) => {
    const trimmedName = displayName.trim();

    if (!trimmedName) {
      return;
    }

    setAccount((current) => {
      const next = {
        ...current,
        displayName: trimmedName,
      };

      void saveProfileAccount(next);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({
      ...account,
      setDisplayName,
      isHydrated,
    }),
    [account, setDisplayName, isHydrated],
  );

  return (
    <AccountProfileContext.Provider value={value}>{children}</AccountProfileContext.Provider>
  );
}

export function useAccountProfile() {
  const context = useContext(AccountProfileContext);

  if (!context) {
    throw new Error('useAccountProfile must be used within AccountProfileProvider');
  }

  return context;
}

export type { AccountProfile };
