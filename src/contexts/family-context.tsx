import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

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

type FamilyStatus = 'idle' | 'loading' | 'loaded' | 'error';

type FamilyContextValue = {
  members: FamilyMember[];
  incomingInvites: FamilyInvite[];
  outgoingInvites: OutgoingFamilyInvite[];
  status: FamilyStatus;
  error: string | null;
  refreshFamily: () => Promise<void>;
  inviteMember: (publicId: string) => Promise<void>;
  acceptInvite: (inviteId: string) => Promise<void>;
  rejectInvite: (inviteId: string) => Promise<void>;
  removeMember: (memberPublicId: string) => Promise<void>;
};

const FamilyContext = createContext<FamilyContextValue | null>(null);

const LOAD_ERROR = 'Не удалось загрузить семью';

export function FamilyProvider({ children }: { children: ReactNode }) {
  const { isServerAccount, accountSessionKey } = useAccount();

  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [incomingInvites, setIncomingInvites] = useState<FamilyInvite[]>([]);
  const [outgoingInvites, setOutgoingInvites] = useState<OutgoingFamilyInvite[]>([]);
  const [status, setStatus] = useState<FamilyStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const refreshFamily = useCallback(async () => {
    if (!isServerAccount) {
      setMembers([]);
      setIncomingInvites([]);
      setOutgoingInvites([]);
      setStatus('idle');
      setError(null);
      return;
    }

    const token = await getAuthToken();

    if (!token) {
      setMembers([]);
      setIncomingInvites([]);
      setOutgoingInvites([]);
      setStatus('idle');
      setError(null);
      return;
    }

    setStatus('loading');
    setError(null);

    try {
      const [familySnapshot, invitesSnapshot] = await Promise.all([
        fetchFamilySnapshot(token),
        fetchFamilyInvitesSnapshot(token),
      ]);

      setMembers(familySnapshot.members);
      setIncomingInvites(invitesSnapshot.incoming);
      setOutgoingInvites(invitesSnapshot.outgoing);
      setStatus('loaded');
    } catch (loadError) {
      const message =
        loadError instanceof AccountApiError ? loadError.message : LOAD_ERROR;

      setStatus('error');
      setError(message);
    }
  }, [isServerAccount]);

  useEffect(() => {
    void refreshFamily();
  }, [refreshFamily, accountSessionKey]);

  const inviteMember = useCallback(
    async (publicId: string) => {
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
    },
    [],
  );

  const acceptInvite = useCallback(async (inviteId: string) => {
    const token = await getAuthToken();

    if (!token) {
      throw new AccountApiError(401, 'Требуется авторизация');
    }

    await postFamilyInviteAccept(token, inviteId);

    if (__DEV__) {
      console.log('[FAMILY] invite accepted');
    }

    await refreshFamily();
  }, [refreshFamily]);

  const rejectInvite = useCallback(async (inviteId: string) => {
    const token = await getAuthToken();

    if (!token) {
      throw new AccountApiError(401, 'Требуется авторизация');
    }

    await postFamilyInviteReject(token, inviteId);

    if (__DEV__) {
      console.log('[FAMILY] invite rejected');
    }

    setIncomingInvites((current) => current.filter((invite) => invite.id !== inviteId));
  }, []);

  const removeMember = useCallback(
    async (memberPublicId: string) => {
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
    [refreshFamily],
  );

  const value = useMemo(
    () => ({
      members,
      incomingInvites,
      outgoingInvites,
      status,
      error,
      refreshFamily,
      inviteMember,
      acceptInvite,
      rejectInvite,
      removeMember,
    }),
    [
      members,
      incomingInvites,
      outgoingInvites,
      status,
      error,
      refreshFamily,
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
