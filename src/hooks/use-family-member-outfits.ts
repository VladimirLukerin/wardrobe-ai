import { useCallback, useEffect, useState } from 'react';

import type { FamilyMember } from '@/constants/family';
import { useAccount } from '@/contexts/account-context';
import { AccountApiError } from '@/services/account';
import {
  fetchFamilyMemberOutfits,
  type FamilyMemberOutfit,
  type FamilyOutfitsSnapshot,
} from '@/services/family-api';
import { getAuthToken } from '@/storage/auth-token-storage';
import {
  clearFamilyOutfitsSnapshotCache,
  getFamilyOutfitsSnapshotCache,
  setFamilyOutfitsSnapshotCache,
} from '@/storage/family-outfits-snapshot-cache';
import {
  ClientNetworkError,
  isRetryableNetworkError,
  NETWORK_ERROR_TITLE,
} from '@/utils/network-error';

export type FamilyMemberOutfitsErrorKind = 'network' | 'server' | 'forbidden' | 'notFound';

export type FamilyMemberOutfitsState =
  | { status: 'loading' }
  | { status: 'ready'; member: FamilyMember; outfits: FamilyMemberOutfit[] }
  | { status: 'empty'; member: FamilyMember }
  | {
      status: 'error';
      errorKind: FamilyMemberOutfitsErrorKind;
      message: string;
    };

type UseFamilyMemberOutfitsResult = {
  state: FamilyMemberOutfitsState;
  refresh: () => Promise<void>;
  outfitCount: number | null;
};

function stateFromSnapshot(snapshot: FamilyOutfitsSnapshot): FamilyMemberOutfitsState {
  if (snapshot.outfits.length === 0) {
    return { status: 'empty', member: snapshot.member };
  }

  return {
    status: 'ready',
    member: snapshot.member,
    outfits: snapshot.outfits,
  };
}

function getOutfitCount(state: FamilyMemberOutfitsState): number | null {
  if (state.status === 'ready') {
    return state.outfits.length;
  }

  if (state.status === 'empty') {
    return 0;
  }

  return null;
}

export function useFamilyMemberOutfits(publicId: string): UseFamilyMemberOutfitsResult {
  const { isServerAccount } = useAccount();
  const [state, setState] = useState<FamilyMemberOutfitsState>({ status: 'loading' });

  const refresh = useCallback(async () => {
    if (!publicId || !isServerAccount) {
      setState({
        status: 'error',
        errorKind: 'server',
        message: 'Не удалось загрузить образы.',
      });
      return;
    }

    const token = await getAuthToken();

    if (!token) {
      setState({
        status: 'error',
        errorKind: 'server',
        message: 'Не удалось загрузить образы.',
      });
      return;
    }

    const cachedSnapshot = getFamilyOutfitsSnapshotCache(publicId);

    if (cachedSnapshot) {
      setState(stateFromSnapshot(cachedSnapshot));
    } else {
      setState({ status: 'loading' });
    }

    try {
      const snapshot = await fetchFamilyMemberOutfits(token, publicId);
      setFamilyOutfitsSnapshotCache(publicId, snapshot);
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
          clearFamilyOutfitsSnapshotCache(publicId);
          setState({
            status: 'error',
            errorKind: 'forbidden',
            message: 'Доступ больше недоступен',
          });
          return;
        }

        if (error.status === 404) {
          clearFamilyOutfitsSnapshotCache(publicId);
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
        message: 'Не удалось загрузить образы.',
      });
    }
  }, [isServerAccount, publicId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    state,
    refresh,
    outfitCount: getOutfitCount(state),
  };
}
