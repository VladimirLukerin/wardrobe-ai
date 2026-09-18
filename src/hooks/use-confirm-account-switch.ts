import { useCallback } from 'react';
import { Alert } from 'react-native';

import { useAccount } from '@/contexts/account-context';
import { useOutfitsSync } from '@/contexts/outfits-sync-context';
import { usePreferencesSync } from '@/contexts/preferences-sync-context';
import { useWearHistorySync } from '@/contexts/wear-history-sync-context';
import { useWardrobeSync } from '@/contexts/wardrobe-sync-context';
import type { AuthSwitchResult, ConfirmAccountSwitchFn } from '@/hooks/use-auth-account-switch';
import { assessLocalAccountState } from '@/services/account-switch';

export function useConfirmAccountSwitch() {
  const { user, switchToAuthenticatedAccount } = useAccount();
  const { status: preferencesStatus } = usePreferencesSync();
  const { status: wardrobeStatus } = useWardrobeSync();
  const { status: outfitsStatus } = useOutfitsSync();
  const { status: wearHistoryStatus } = useWearHistorySync();

  const performAccountSwitch = useCallback(
    async (authResult: AuthSwitchResult, onComplete?: () => void) => {
      onComplete?.();
      await switchToAuthenticatedAccount(authResult.user, authResult.token);
    },
    [switchToAuthenticatedAccount],
  );

  const confirmAndSwitch = useCallback<ConfirmAccountSwitchFn>(
    async (authResult, onComplete) => {
      const isSameAccount = user?.id === authResult.user.id;

      if (isSameAccount) {
        await performAccountSwitch(authResult, onComplete);
        return;
      }

      const assessment = await assessLocalAccountState();
      const hasPendingSync =
        preferencesStatus === 'pending' ||
        wardrobeStatus === 'pending' ||
        outfitsStatus === 'pending' ||
        wearHistoryStatus === 'pending' ||
        assessment.hasPendingSyncMetadata;

      const needsConfirmation = assessment.hasMeaningfulLocalData || hasPendingSync;

      if (!needsConfirmation) {
        await performAccountSwitch(authResult, onComplete);
        return;
      }

      const message = hasPendingSync
        ? 'Есть несинхронизированные изменения.\n\nЛокальные данные текущего аккаунта будут заменены данными аккаунта, в который вы входите. Убедитесь, что изменения синхронизированы.'
        : 'Локальные данные текущего аккаунта будут заменены данными аккаунта, в который вы входите. Убедитесь, что изменения синхронизированы.';

      Alert.alert('Переключиться на другой аккаунт?', message, [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Продолжить',
          style: 'destructive',
          onPress: () => {
            void performAccountSwitch(authResult, onComplete);
          },
        },
      ]);
    },
    [
      outfitsStatus,
      performAccountSwitch,
      preferencesStatus,
      user?.id,
      wardrobeStatus,
      wearHistoryStatus,
    ],
  );

  return { confirmAndSwitch };
}
