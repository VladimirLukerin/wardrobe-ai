import { useEffect } from 'react';
import { ActivityIndicator, Modal, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import { useAccount } from '@/contexts/account-context';
import { useOutfitsSync } from '@/contexts/outfits-sync-context';
import { usePreferencesSync } from '@/contexts/preferences-sync-context';
import { useWearHistorySync } from '@/contexts/wear-history-sync-context';
import { useWardrobeSync } from '@/contexts/wardrobe-sync-context';

function isSyncSettled(status: string): boolean {
  return status === 'synced' || status === 'pending' || status === 'offline' || status === 'error';
}

export function AccountRestoreOverlay() {
  const { isRestoringAccount, finishAccountRestore } = useAccount();
  const { status: preferencesStatus } = usePreferencesSync();
  const { status: wardrobeStatus } = useWardrobeSync();
  const { status: outfitsStatus } = useOutfitsSync();
  const { status: wearHistoryStatus } = useWearHistorySync();

  useEffect(() => {
    if (!isRestoringAccount) {
      return;
    }

    const allSettled =
      isSyncSettled(preferencesStatus) &&
      isSyncSettled(wardrobeStatus) &&
      isSyncSettled(outfitsStatus) &&
      isSyncSettled(wearHistoryStatus);

    if (allSettled) {
      finishAccountRestore();
    }
  }, [
    finishAccountRestore,
    isRestoringAccount,
    outfitsStatus,
    preferencesStatus,
    wardrobeStatus,
    wearHistoryStatus,
  ]);

  useEffect(() => {
    if (!isRestoringAccount) {
      return;
    }

    const timeout = setTimeout(() => {
      finishAccountRestore();
    }, 30000);

    return () => {
      clearTimeout(timeout);
    };
  }, [finishAccountRestore, isRestoringAccount]);

  if (!isRestoringAccount) {
    return null;
  }

  return (
    <Modal visible transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.card}>
          <ActivityIndicator size="large" color={Colors.light.text} />
          <ThemedText style={styles.title}>Восстанавливаем аккаунт…</ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.subtitle}>
            Загружаем настройки и гардероб
          </ThemedText>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    paddingHorizontal: Spacing.four,
  },
  card: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 20,
    backgroundColor: Colors.light.background,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.five,
    alignItems: 'center',
    gap: Spacing.two,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
});
