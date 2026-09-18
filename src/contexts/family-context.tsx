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
import { AppState, type AppStateStatus } from 'react-native';

import type { FamilyInvite, FamilyMember, OutgoingFamilyInvite } from '@/constants/family';
import { useAccount } from '@/contexts/account-context';
import { AccountApiError } from '@/services/account';
import {
  deleteFamilyMember,
  fetchFamilyInvitesSnapshot,
  fetchFamilySnapshot,
  postFamilyInvite,
  postFamilyInviteAccept,
  postFamilyInviteReject,
} from '@/services/family-api';
import { getAuthToken } from '@/storage/auth-token-storage';
import { canUseFamilyFeatures } from '@/utils/account-capabilities';
import { NETWORK_ERROR_TITLE } from '@/utils/network-error';
import { pruneRemovedFamilyMemberCaches } from '@/utils/clear-family-member-caches';

const FAMILY_FEATURES_DISABLED_ERROR = 'Семейные функции доступны после сохранения аккаунта.';

type FamilyStatus = 'idle' | 'loading' | 'loaded' | 'error';
type FamilyErrorKind = 'network' | 'server';

type FamilyContextValue = {
  members: FamilyMember[];
  incomingInvites: FamilyInvite[];
  outgoingInvites: OutgoingFamilyInvite[];
  pendingIncomingCount: number;
  invitePopup: FamilyInvite | null;
  status: FamilyStatus;
  error: string | null;
  errorKind: FamilyErrorKind | null;
  refreshFamily: () => Promise<void>;
  refreshFamilyIfStale: () => Promise<void>;
  dismissInvitePopup: (inviteId: string) => void;
  inviteMember: (publicId: string) => Promise<void>;
  acceptInvite: (inviteId: string) => Promise<void>;
  rejectInvite: (inviteId: string) => Promise<void>;
  removeMember: (memberPublicId: string) => Promise<void>;
};

const FamilyContext = createContext<FamilyContextValue | null>(null);

const LOAD_ERROR = 'Не удалось загрузить семью';

// Passive triggers (foreground, screen focus) can fire back-to-back; skip if we just refreshed.
const PASSIVE_REFRESH_MIN_INTERVAL_MS = 3000;

function isBackgroundState(state: AppStateStatus | null): boolean {
  return state === 'background' || state === 'inactive';
}

export function FamilyProvider({ children }: { children: ReactNode }) {
  const { isServerAccount, user, accountSessionKey } = useAccount();
  const familyFeaturesEnabled = isServerAccount && canUseFamilyFeatures(user);

  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [incomingInvites, setIncomingInvites] = useState<FamilyInvite[]>([]);
  const [outgoingInvites, setOutgoingInvites] = useState<OutgoingFamilyInvite[]>([]);
  const [status, setStatus] = useState<FamilyStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [errorKind, setErrorKind] = useState<FamilyErrorKind | null>(null);
  // Session-only: lives in memory for the lifetime of the provider, never persisted.
  const [dismissedPopupInviteIds, setDismissedPopupInviteIds] = useState<string[]>([]);

  const refreshInFlightRef = useRef<Promise<void> | null>(null);
  const lastRefreshAtRef = useRef(0);
  const hasLoadedRef = useRef(false);

  const refreshFamily = useCallback(async () => {
    if (refreshInFlightRef.current) {
      await refreshInFlightRef.current;
      return;
    }

    const run = (async () => {
      if (!familyFeaturesEnabled) {
        setMembers([]);
        setIncomingInvites([]);
        setOutgoingInvites([]);
        setStatus('idle');
        setError(null);
        setErrorKind(null);
        hasLoadedRef.current = false;
        return;
      }

      const token = await getAuthToken();

      if (!token) {
        setMembers([]);
        setIncomingInvites([]);
        setOutgoingInvites([]);
        setStatus('idle');
        setError(null);
        setErrorKind(null);
        hasLoadedRef.current = false;
        return;
      }

      if (!hasLoadedRef.current) {
        setStatus('loading');
      }

      setError(null);
      setErrorKind(null);

      try {
        const [familySnapshot, invitesSnapshot] = await Promise.all([
          fetchFamilySnapshot(token),
          fetchFamilyInvitesSnapshot(token),
        ]);

        setMembers(familySnapshot.members);
        setIncomingInvites(invitesSnapshot.incoming);
        setOutgoingInvites(invitesSnapshot.outgoing);
        setStatus('loaded');
        hasLoadedRef.current = true;
        lastRefreshAtRef.current = Date.now();

        if (__DEV__) {
          console.log(
            `[FAMILY] refreshed: ${familySnapshot.members.length} members, ${invitesSnapshot.incoming.length} incoming`,
          );
        }
      } catch (loadError) {
        if (AccountApiError.isNetwork(loadError)) {
          setStatus('error');
          setError(NETWORK_ERROR_TITLE);
          setErrorKind('network');
          return;
        }

        if (!(loadError instanceof AccountApiError)) {
          // Not an API/network problem: keep it visible for developers.
          console.error('Unexpected family refresh error:', loadError);
        }

        setStatus('error');
        setError(loadError instanceof AccountApiError ? loadError.message : LOAD_ERROR);
        setErrorKind('server');
      }
    })();

    refreshInFlightRef.current = run;

    try {
      await run;
    } finally {
      refreshInFlightRef.current = null;
    }
  }, [familyFeaturesEnabled]);

  const refreshFamilyIfStale = useCallback(async () => {
    if (!familyFeaturesEnabled) {
      return;
    }

    if (Date.now() - lastRefreshAtRef.current < PASSIVE_REFRESH_MIN_INTERVAL_MS) {
      return;
    }

    await refreshFamily();
  }, [familyFeaturesEnabled, refreshFamily]);

  useEffect(() => {
    hasLoadedRef.current = false;
    lastRefreshAtRef.current = 0;
    setDismissedPopupInviteIds([]);

    if (familyFeaturesEnabled) {
      void refreshFamily();
      return;
    }

    setMembers([]);
    setIncomingInvites([]);
    setOutgoingInvites([]);
    setStatus('idle');
    setError(null);
    setErrorKind(null);
  }, [familyFeaturesEnabled, refreshFamily, accountSessionKey]);

  useEffect(() => {
    pruneRemovedFamilyMemberCaches(members);
  }, [members]);

  useEffect(() => {
    let previousState: AppStateStatus | null = AppState.currentState;

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active' && isBackgroundState(previousState)) {
        void refreshFamilyIfStale();
      }

      previousState = nextState;
    });

    return () => {
      subscription.remove();
    };
  }, [refreshFamilyIfStale]);

  const dismissInvitePopup = useCallback((inviteId: string) => {
    setDismissedPopupInviteIds((current) =>
      current.includes(inviteId) ? current : [...current, inviteId],
    );
  }, []);

  const inviteMember = useCallback(
    async (publicId: string) => {
      if (!familyFeaturesEnabled) {
        throw new AccountApiError(403, FAMILY_FEATURES_DISABLED_ERROR);
      }

      const token = await getAuthToken();

      if (!token) {
        throw new AccountApiError(401, 'Требуется авторизация');
      }

      const invite = await postFamilyInvite(token, publicId);

      if (__DEV__) {
        console.log('[FAMILY] invite created');
      }

      setOutgoingInvites((current) => {
        const withoutDuplicate = current.filter((item) => item.id !== invite.id);
        return [...withoutDuplicate, invite];
      });

      await refreshFamily();
    },
    [familyFeaturesEnabled, refreshFamily],
  );

  const acceptInvite = useCallback(async (inviteId: string) => {
    if (!familyFeaturesEnabled) {
      throw new AccountApiError(403, FAMILY_FEATURES_DISABLED_ERROR);
    }

    const token = await getAuthToken();

    if (!token) {
      throw new AccountApiError(401, 'Требуется авторизация');
    }

    await postFamilyInviteAccept(token, inviteId);

    if (__DEV__) {
      console.log('[FAMILY] invite accepted');
    }

    setIncomingInvites((current) => current.filter((invite) => invite.id !== inviteId));
    await refreshFamily();
  }, [familyFeaturesEnabled, refreshFamily]);

  const rejectInvite = useCallback(async (inviteId: string) => {
    if (!familyFeaturesEnabled) {
      throw new AccountApiError(403, FAMILY_FEATURES_DISABLED_ERROR);
    }

    const token = await getAuthToken();

    if (!token) {
      throw new AccountApiError(401, 'Требуется авторизация');
    }

    await postFamilyInviteReject(token, inviteId);

    if (__DEV__) {
      console.log('[FAMILY] invite rejected');
    }

    setIncomingInvites((current) => current.filter((invite) => invite.id !== inviteId));
    await refreshFamily();
  }, [familyFeaturesEnabled, refreshFamily]);

  const removeMember = useCallback(
    async (memberPublicId: string) => {
      if (!familyFeaturesEnabled) {
        throw new AccountApiError(403, FAMILY_FEATURES_DISABLED_ERROR);
      }

      const token = await getAuthToken();

      if (!token) {
        throw new AccountApiError(401, 'Требуется авторизация');
      }

      await deleteFamilyMember(token, memberPublicId);

      if (__DEV__) {
        console.log('[FAMILY] member removed');
      }

      await refreshFamily();
    },
    [familyFeaturesEnabled, refreshFamily],
  );

  const invitePopup = useMemo(
    () => incomingInvites.find((invite) => !dismissedPopupInviteIds.includes(invite.id)) ?? null,
    [incomingInvites, dismissedPopupInviteIds],
  );

  const value = useMemo(
    () => ({
      members,
      incomingInvites,
      outgoingInvites,
      pendingIncomingCount: incomingInvites.length,
      invitePopup,
      status,
      error,
      errorKind,
      refreshFamily,
      refreshFamilyIfStale,
      dismissInvitePopup,
      inviteMember,
      acceptInvite,
      rejectInvite,
      removeMember,
    }),
    [
      members,
      incomingInvites,
      outgoingInvites,
      invitePopup,
      status,
      error,
      errorKind,
      refreshFamily,
      refreshFamilyIfStale,
      dismissInvitePopup,
      inviteMember,
      acceptInvite,
      rejectInvite,
      removeMember,
    ],
  );

  return <FamilyContext.Provider value={value}>{children}</FamilyContext.Provider>;
}

export function useFamily() {
  const context = useContext(FamilyContext);

  if (!context) {
    throw new Error('useFamily must be used within FamilyProvider');
  }

  return context;
}
