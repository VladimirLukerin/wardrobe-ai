import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { useAccountProfile } from '@/contexts/account-profile-context';
import {
  AccountApiError,
  createAnonymousAccount,
  getCurrentUser,
  logoutSession,
  type ServerUser,
} from '@/services/account';
import { prepareLocalStateForAccountSwitch } from '@/services/account-switch';
import {
  isAccountCacheFresh,
  loadAccountCache,
  saveCachedAccountUser,
  saveValidatedAccountUser,
} from '@/storage/account-cache-storage';
import { clearAuthToken, getAuthToken, setAuthToken } from '@/storage/auth-token-storage';

type AccountContextValue = {
  user: ServerUser | null;
  publicId: string | null;
  isHydrated: boolean;
  isSyncing: boolean;
  isServerAccount: boolean;
  isRestoringAccount: boolean;
  accountSessionKey: number;
  error: string | null;
  refreshAccount: () => Promise<void>;
  applyAuthenticatedUser: (user: ServerUser) => void;
  switchToAuthenticatedAccount: (user: ServerUser, token: string) => Promise<void>;
  finishAccountRestore: () => void;
  logoutFromProfile: () => Promise<void>;
};

const AccountContext = createContext<AccountContextValue | null>(null);

const OFFLINE_ERROR = 'Нет соединения с сервером';

function getCachedPublicId(publicId?: string, legacyLocalUserId?: string): string | null {
  if (publicId && publicId.trim().length > 0) {
    return publicId;
  }

  if (legacyLocalUserId && legacyLocalUserId.trim().length > 0) {
    return legacyLocalUserId;
  }

  return null;
}

export function AccountProvider({ children }: { children: ReactNode }) {
  const {
    displayName,
    publicId: cachedPublicId,
    localUserId,
    isHydrated: isProfileHydrated,
    syncServerIdentity,
  } = useAccountProfile();

  const [user, setUser] = useState<ServerUser | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isServerAccount, setIsServerAccount] = useState(false);
  const [isRestoringAccount, setIsRestoringAccount] = useState(false);
  const [accountSessionKey, setAccountSessionKey] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const bootstrapStartedRef = useRef(false);
  const accountCacheLoadedRef = useRef(false);

  const applyServerUser = useCallback(
    (nextUser: ServerUser) => {
      setUser(nextUser);
      setIsServerAccount(true);
      setError(null);
      syncServerIdentity({
        publicId: nextUser.publicId,
        serverUserId: nextUser.id,
        displayName: nextUser.displayName,
      });
      void saveCachedAccountUser(nextUser);
    },
    [syncServerIdentity],
  );

  const bootstrapAccount = useCallback(
    async (forceRefresh = false) => {
      if (!isProfileHydrated) {
        return;
      }

      setIsSyncing(true);

      try {
        const token = await getAuthToken();

        if (token) {
          if (!forceRefresh) {
            const cache = await loadAccountCache();

            if (cache && isAccountCacheFresh(cache.lastAccountValidatedAt)) {
              applyServerUser(cache.user);
              return;
            }
          }

          try {
            const currentUser = await getCurrentUser(token);
            await saveValidatedAccountUser(currentUser);
            applyServerUser(currentUser);
            return;
          } catch (requestError) {
            if (requestError instanceof AccountApiError && requestError.status === 401) {
              await clearAuthToken();
            } else {
              const cache = await loadAccountCache();

              if (cache?.user) {
                applyServerUser(cache.user);
                setError(OFFLINE_ERROR);
                return;
              }

              const cachedId = getCachedPublicId(cachedPublicId, localUserId);

              if (cachedId) {
                setIsServerAccount(Boolean(cachedPublicId));
                setError(OFFLINE_ERROR);
                return;
              }

              setError(OFFLINE_ERROR);
              return;
            }
          }
        }

        try {
          const created = await createAnonymousAccount(displayName);
          await setAuthToken(created.token);
          await saveValidatedAccountUser(created.user);
          applyServerUser(created.user);
        } catch (createError) {
          const cachedId = getCachedPublicId(cachedPublicId, localUserId);

          if (cachedId) {
            setIsServerAccount(Boolean(cachedPublicId));
            setError(OFFLINE_ERROR);
            return;
          }

          if (createError instanceof AccountApiError) {
            setError(createError.message);
            return;
          }

          setError(OFFLINE_ERROR);
        }
      } finally {
        setIsSyncing(false);
        setIsHydrated(true);
      }
    },
    [applyServerUser, cachedPublicId, displayName, isProfileHydrated, localUserId],
  );

  useEffect(() => {
    if (accountCacheLoadedRef.current) {
      return;
    }

    accountCacheLoadedRef.current = true;

    void loadAccountCache().then((cache) => {
      if (cache?.user) {
        setUser(cache.user);
        setIsServerAccount(true);
      }
    });
  }, []);

  useEffect(() => {
    if (!isProfileHydrated || bootstrapStartedRef.current) {
      return;
    }

    bootstrapStartedRef.current = true;
    void bootstrapAccount(false);
  }, [bootstrapAccount, isProfileHydrated]);

  const refreshAccount = useCallback(async () => {
    await bootstrapAccount(true);
  }, [bootstrapAccount]);

  const applyAuthenticatedUser = useCallback(
    (nextUser: ServerUser) => {
      applyServerUser(nextUser);
    },
    [applyServerUser],
  );

  const finishAccountRestore = useCallback(() => {
    setIsRestoringAccount(false);
  }, []);

  const switchToAuthenticatedAccount = useCallback(
    async (nextUser: ServerUser, nextToken: string) => {
      const isSameAccount = user?.id === nextUser.id;

      if (isSameAccount) {
        await setAuthToken(nextToken);
        await saveValidatedAccountUser(nextUser);
        applyServerUser(nextUser);
        return;
      }

      setIsRestoringAccount(true);

      try {
        await prepareLocalStateForAccountSwitch();
        await setAuthToken(nextToken);
        await saveValidatedAccountUser(nextUser);
        applyServerUser(nextUser);
        setAccountSessionKey((current) => current + 1);
        setError(null);
      } catch (switchError) {
        setIsRestoringAccount(false);
        throw switchError;
      }
    },
    [applyServerUser, user?.id],
  );

  const logoutFromProfile = useCallback(async () => {
    setIsSyncing(true);

    try {
      const token = await getAuthToken();
      const logoutDisplayName = displayName.trim() || user?.displayName?.trim() || undefined;

      if (token) {
        try {
          await logoutSession(token);
        } catch {
          // Best-effort server logout; local reset still proceeds.
        }
      }

      await clearAuthToken();
      await prepareLocalStateForAccountSwitch();

      setUser(null);
      setIsServerAccount(false);
      setIsRestoringAccount(false);
      setError(null);
      setAccountSessionKey((current) => current + 1);

      const created = await createAnonymousAccount(logoutDisplayName);
      await setAuthToken(created.token);
      await saveValidatedAccountUser(created.user);
      applyServerUser(created.user);
    } catch (logoutError) {
      if (logoutError instanceof AccountApiError) {
        setError(logoutError.message);
        return;
      }

      setError(OFFLINE_ERROR);
    } finally {
      setIsSyncing(false);
      setIsHydrated(true);
    }
  }, [applyServerUser, displayName, user?.displayName]);

  const publicId = user?.publicId ?? getCachedPublicId(cachedPublicId, localUserId);

  const value = useMemo(
    () => ({
      user,
      publicId,
      isHydrated,
      isSyncing,
      isServerAccount,
      isRestoringAccount,
      accountSessionKey,
      error,
      refreshAccount,
      applyAuthenticatedUser,
      switchToAuthenticatedAccount,
      finishAccountRestore,
      logoutFromProfile,
    }),
    [
      user,
      publicId,
      isHydrated,
      isSyncing,
      isServerAccount,
      isRestoringAccount,
      accountSessionKey,
      error,
      refreshAccount,
      applyAuthenticatedUser,
      switchToAuthenticatedAccount,
      finishAccountRestore,
      logoutFromProfile,
    ],
  );

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

export function useAccount() {
  const context = useContext(AccountContext);

  if (!context) {
    throw new Error('useAccount must be used within AccountProvider');
  }

  return context;
}
