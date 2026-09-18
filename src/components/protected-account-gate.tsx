import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import AccountSaveSheet from '@/components/account-save-sheet';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { useAccount } from '@/contexts/account-context';
import { canUseFamilyFeatures } from '@/utils/account-capabilities';

type ProtectedAccountGateProps = {
  children: ReactNode;
};

export function ProtectedAccountGate({ children }: ProtectedAccountGateProps) {
  const { user } = useAccount();
  const [isSaveAccountVisible, setIsSaveAccountVisible] = useState(false);

  if (canUseFamilyFeatures(user)) {
    return <>{children}</>;
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.content}>
          <Pressable
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace('/profile');
              }
            }}
            style={({ pressed }) => [styles.backLink, pressed && styles.pressed]}>
            <ThemedText style={styles.backLinkText}>Назад</ThemedText>
          </Pressable>

          <View style={styles.messageBlock}>
            <ThemedText style={styles.title}>
              Сохраните аккаунт, чтобы использовать семейные функции.
            </ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.subtitle}>
              Подключите email или телефон, чтобы добавить близких и создавать совместные образы.
            </ThemedText>
          </View>

          <Pressable
            onPress={() => setIsSaveAccountVisible(true)}
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
            <ThemedText style={styles.primaryButtonText}>Сохранить аккаунт</ThemedText>
          </Pressable>
        </View>

        <AccountSaveSheet
          visible={isSaveAccountVisible}
          onClose={() => setIsSaveAccountVisible(false)}
        />
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  safeArea: {
    flex: 1,
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    width: '100%',
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    gap: Spacing.four,
  },
  backLink: {
    alignSelf: 'flex-start',
    paddingVertical: Spacing.one,
  },
  backLinkText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.light.text,
  },
  messageBlock: {
    gap: Spacing.two,
    paddingTop: Spacing.five,
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
    lineHeight: 28,
    color: Colors.light.text,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
  },
  primaryButton: {
    minHeight: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.text,
    paddingHorizontal: Spacing.three,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.background,
  },
  pressed: {
    opacity: 0.85,
  },
});
