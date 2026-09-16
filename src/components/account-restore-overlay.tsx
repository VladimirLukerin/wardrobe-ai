import { useEffect } from 'react';
import { ActivityIndicator, Modal, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import { useAccount } from '@/contexts/account-context';
import { useWardrobeSync } from '@/contexts/wardrobe-sync-context';

function isSyncSettled(status: string): boolean {
  return status === 'synced' || status === 'pending' || status === 'offline' || status === 'error';
}

export function AccountRestoreOverlay() {
  const { isRestoringAccount, finishAccountRestore } = useAccount();
  const { status: wardrobeStatus } = useWardrobeSync();

  useEffect(() => {
    if (!isRestoringAccount) {
      return;
    }

    if (isSyncSettled(wardrobeStatus)) {
      finishAccountRestore();
    }
  }, [finishAccountRestore, isRestoringAccount, wardrobeStatus]);

  useEffect(() => {
    if (!isRestoringAccount) {
      return;
    }

    const timeout = setTimeout(() => {
      finishAccountRestore();
    }, 15000);

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
