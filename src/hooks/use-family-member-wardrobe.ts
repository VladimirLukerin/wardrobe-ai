import { useCallback, useEffect, useState } from 'react';

import type { FamilyMember } from '@/constants/family';
import { useAccount } from '@/contexts/account-context';
import { AccountApiError } from '@/services/account';
import {
  fetchFamilyMemberWardrobe,
  type FamilyWardrobeItem,
  type FamilyWardrobeSnapshot,
} from '@/services/family-api';
import { getAuthToken } from '@/storage/auth-token-storage';
import {
  clearFamilyWardrobeSnapshotCache,
  getFamilyWardrobeSnapshotCache,
  setFamilyWardrobeSnapshotCache,
} from '@/storage/family-wardrobe-snapshot-cache';
import {
  ClientNetworkError,
  isRetryableNetworkError,
  NETWORK_ERROR_TITLE,
} from '@/utils/network-error';

export type FamilyMemberWardrobeErrorKind = 'network' | 'server' | 'forbidden' | 'notFound';

export type FamilyMemberWardrobeState =
  | { status: 'loading' }
  | { status: 'ready'; member: FamilyMember; items: FamilyWardrobeItem[] }
  | { status: 'empty'; member: FamilyMember }
  | {
      status: 'error';
      errorKind: FamilyMemberWardrobeErrorKind;
      message: string;
    };

type UseFamilyMemberWardrobeResult = {
  state: FamilyMemberWardrobeState;
  refresh: () => Promise<void>;
  itemCount: number | null;
};

function stateFromSnapshot(snapshot: FamilyWardrobeSnapshot): FamilyMemberWardrobeState {
  if (snapshot.items.length === 0) {
    return { status: 'empty', member: snapshot.member };
  }

  return {
    status: 'ready',
    member: snapshot.member,
    items: snapshot.items,
  };
}

function getItemCount(state: FamilyMemberWardrobeState): number | null {
  if (state.status === 'ready') {
    return state.items.length;
  }

  if (state.status === 'empty') {
    return 0;
  }

  return null;
}

export function useFamilyMemberWardrobe(publicId: string): UseFamilyMemberWardrobeResult {
  const { isServerAccount } = useAccount();
  const [state, setState] = useState<FamilyMemberWardrobeState>({ status: 'loading' });

  const refresh = useCallback(async () => {
    if (!publicId || !isServerAccount) {
      setState({
        status: 'error',
        errorKind: 'server',
        message: 'Не удалось загрузить гардероб.',
      });
      return;
    }

    const token = await getAuthToken();

    if (!token) {
      setState({
        status: 'error',
        errorKind: 'server',
        message: 'Не удалось загрузить гардероб.',
      });
      return;
    }

    const cachedSnapshot = getFamilyWardrobeSnapshotCache(publicId);

    if (cachedSnapshot) {
      setState(stateFromSnapshot(cachedSnapshot));
    } else {
      setState({ status: 'loading' });
    }

    try {
      const snapshot = await fetchFamilyMemberWardrobe(token, publicId);
      setFamilyWardrobeSnapshotCache(publicId, snapshot);
      setState(stateFromSnapshot(snapshot));
    } catch (error) {
      if (error instanceof ClientNetworkError || isRetryableNetworkError(error)) {
        if (cachedSnapshot) {
          setState(stateFromSnapshot(cachedSnapshot));
          return;
        }

        setState({
          status: 'error',
          errorKind: 'network',
          message: NETWORK_ERROR_TITLE,
        });
        return;
      }

      if (error instanceof AccountApiError) {
        if (error.status === 403) {
          clearFamilyWardrobeSnapshotCache(publicId);
          setState({
            status: 'error',
            errorKind: 'forbidden',
            message: 'Доступ к гардеробу больше недоступен',
          });
          return;
        }

        if (error.status === 404) {
          clearFamilyWardrobeSnapshotCache(publicId);
          setState({
            status: 'error',
            errorKind: 'notFound',
            message: 'Пользователь не найден',
          });
          return;
        }
      }

      if (cachedSnapshot) {
        setState(stateFromSnapshot(cachedSnapshot));
        return;
      }

      setState({
        status: 'error',
        errorKind: 'server',
        message: 'Не удалось загрузить гардероб.',
      });
    }
  }, [isServerAccount, publicId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    state,
    refresh,
    itemCount: getItemCount(state),
  };
}
