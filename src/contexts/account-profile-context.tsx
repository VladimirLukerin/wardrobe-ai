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
import { markLocalPreferencesUpdated } from '@/storage/preferences-sync-storage';

type SyncServerIdentityInput = {
  publicId: string;
  serverUserId: string;
  displayName?: string | null;
};

type AccountProfileContextValue = AccountProfile & {
  setDisplayName: (displayName: string) => void;
  applySyncedDisplayName: (displayName: string) => void;
  syncServerIdentity: (input: SyncServerIdentityInput) => void;
  reloadProfileFromStorage: () => Promise<void>;
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
          setAccount({
            ...DEFAULT_ACCOUNT_PROFILE,
            displayName: DEFAULT_DISPLAY_NAME,
          });
          setIsHydrated(true);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const applySyncedDisplayName = useCallback((displayName: string) => {
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

    void markLocalPreferencesUpdated();
  }, []);

  const reloadProfileFromStorage = useCallback(async () => {
    try {
      const stored = await loadProfileAccount();
      setAccount(stored);
    } catch {
      setAccount({
        ...DEFAULT_ACCOUNT_PROFILE,
        displayName: DEFAULT_DISPLAY_NAME,
      });
    } finally {
      setIsHydrated(true);
    }
  }, []);

  const syncServerIdentity = useCallback((input: SyncServerIdentityInput) => {
    setAccount((current) => {
      const nextDisplayName =
        input.displayName && input.displayName.trim().length > 0
          ? input.displayName.trim()
          : current.displayName;

      const next: AccountProfile = {
        ...current,
        publicId: input.publicId,
        serverUserId: input.serverUserId,
        localUserId: input.publicId,
        displayName: nextDisplayName,
      };

      void saveProfileAccount(next);

      if (__DEV__) {
        console.log(`[NAME UPDATE] profile displayName=${nextDisplayName}`);
      }

      return next;
    });
  }, []);

  const value = useMemo(
    () => ({
      ...account,
      setDisplayName,
      applySyncedDisplayName,
      syncServerIdentity,
      reloadProfileFromStorage,
      isHydrated,
    }),
    [
      account,
      setDisplayName,
      applySyncedDisplayName,
      syncServerIdentity,
      reloadProfileFromStorage,
      isHydrated,
    ],
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
