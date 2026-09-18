import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FamilyScreenHeader } from '@/components/family-screen-header';
import { NetworkErrorState } from '@/components/network-error-state';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, MaxContentWidth, Spacing, TabScreenScrollPadding } from '@/constants/theme';
import { useFamily } from '@/contexts/family-context';
import { useFamilyMemberRoute } from '@/hooks/use-family-member-route';
import { AccountApiError } from '@/services/account';

const AVATAR_SIZE = 96;

type RemoveError = { kind: 'network' } | { kind: 'other'; message: string };

function getInitial(name: string) {
  return name.trim().charAt(0).toUpperCase();
}

export default function FamilyMemberScreen() {
  const { publicId, member, label, isResolving, familyStatus } = useFamilyMemberRoute();
  const { removeMember } = useFamily();

  const [isRemoving, setIsRemoving] = useState(false);
  const [hasRemoved, setHasRemoved] = useState(false);
  const [removeError, setRemoveError] = useState<RemoveError | null>(null);

  const performRemove = useCallback(async () => {
    if (!publicId || isRemoving) {
      return;
    }

    setIsRemoving(true);
    setRemoveError(null);

    try {
      await removeMember(publicId);
      setHasRemoved(true);

      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/profile');
      }
    } catch (error) {
      if (AccountApiError.isNetwork(error)) {
        setRemoveError({ kind: 'network' });
        return;
      }

      if (!(error instanceof AccountApiError)) {
        console.error('Unexpected family member removal error:', error);
      }

      setRemoveError({
        kind: 'other',
        message:
          error instanceof AccountApiError ? error.message : 'Не удалось удалить из семьи.',
      });
    } finally {
      setIsRemoving(false);
    }
  }, [isRemoving, publicId, removeMember]);

  const handleRemovePress = () => {
    Alert.alert(
      'Удалить из семьи?',
      `${label} больше не будет видеть вас в своей семье, а вы — его.`,
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Удалить',
          style: 'destructive',
          onPress: () => {
            void performRemove();
          },
        },
      ],
    );
  };

  const handleOpenWardrobe = () => {
    router.push({
      pathname: '/profile/family/[publicId]/wardrobe',
      params: { publicId, displayName: label },
    });
  };

  const handleCreatePairedOutfit = () => {
    router.push({
      pathname: '/profile/family/[publicId]/paired-outfit',
      params: { publicId },
    });
  };

  // Member disappears from the list after a successful removal; don't flash the
  // "not in family" state while we are already navigating back.
  const memberMissing =
    !member && !isResolving && !isRemoving && !hasRemoved && familyStatus === 'loaded';

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <FamilyScreenHeader title="Член семьи" />

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.hero}>
            <View style={styles.avatar}>
              <ThemedText style={styles.avatarLetter}>{getInitial(label)}</ThemedText>
            </View>
            <ThemedText style={styles.name}>{label}</ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.publicId} selectable>
              {publicId}
            </ThemedText>

            {memberMissing ? (
              <View style={[styles.statusPill, styles.statusPillMuted]}>
                <ThemedText style={[styles.statusText, styles.statusTextMuted]}>
                  Больше не в вашей семье
                </ThemedText>
              </View>
            ) : (
              <View style={styles.statusPill}>
                <ThemedText style={styles.statusText}>В вашей семье</ThemedText>
              </View>
            )}
          </View>

          {memberMissing ? (
            <Pressable
              onPress={() => router.back()}
              style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
              <ThemedText style={styles.primaryButtonText}>Вернуться</ThemedText>
            </Pressable>
          ) : (
            <View style={styles.actions}>
              <Pressable
                onPress={handleOpenWardrobe}
                disabled={isRemoving}
                style={({ pressed }) => [
                  styles.primaryButton,
                  isRemoving && styles.buttonDisabled,
                  pressed && !isRemoving && styles.pressed,
                ]}>
                <ThemedText style={styles.primaryButtonText}>Гардероб</ThemedText>
              </Pressable>

              <Pressable
                onPress={handleCreatePairedOutfit}
                disabled={isRemoving}
                style={({ pressed }) => [
                  styles.secondaryButton,
                  isRemoving && styles.buttonDisabled,
                  pressed && !isRemoving && styles.pressed,
                ]}>
                <ThemedText style={styles.secondaryButtonText}>Создать совместный образ</ThemedText>
              </Pressable>

              {removeError?.kind === 'network' ? (
                <NetworkErrorState
                  compact
                  isRetrying={isRemoving}
                  onRetry={() => {
                    void performRemove();
                  }}
                />
              ) : null}

              {removeError?.kind === 'other' ? (
                <ThemedText themeColor="textSecondary" style={styles.errorText}>
                  {removeError.message}
                </ThemedText>
              ) : null}

              <Pressable
                onPress={handleRemovePress}
                disabled={isRemoving}
                style={({ pressed }) => [
                  styles.destructiveButton,
                  isRemoving && styles.buttonDisabled,
                  pressed && !isRemoving && styles.pressed,
                ]}>
                {isRemoving ? (
                  <ActivityIndicator size="small" color={DESTRUCTIVE_COLOR} />
                ) : (
                  <ThemedText style={styles.destructiveButtonText}>Удалить из семьи</ThemedText>
                )}
              </Pressable>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const DESTRUCTIVE_COLOR = '#DC2626';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    paddingBottom: TabScreenScrollPadding,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  scrollContent: {
    gap: Spacing.five,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.four,
  },
  hero: {
    alignItems: 'center',
    gap: Spacing.two,
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: Colors.light.backgroundElement,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.one,
  },
  avatarLetter: {
    fontSize: 36,
    fontWeight: '600',
    color: Colors.light.textSecondary,
  },
  name: {
    fontSize: 22,
    fontWeight: '600',
    color: Colors.light.text,
    textAlign: 'center',
  },
  publicId: {
    fontSize: 14,
    letterSpacing: 0.4,
  },
  statusPill: {
    marginTop: Spacing.one,
    paddingVertical: Spacing.one + 2,
    paddingHorizontal: Spacing.three,
    borderRadius: 999,
    backgroundColor: '#E8F5EC',
  },
  statusPillMuted: {
    backgroundColor: Colors.light.backgroundElement,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1F7A3C',
  },
  statusTextMuted: {
    color: Colors.light.textSecondary,
  },
  actions: {
    gap: Spacing.three,
  },
  primaryButton: {
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: Colors.light.text,
  },
  primaryButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.light.background,
  },
  secondaryButton: {
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.light.backgroundSelected,
  },
  secondaryButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.light.text,
  },
  destructiveButton: {
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: DESTRUCTIVE_COLOR,
  },
  destructiveButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: DESTRUCTIVE_COLOR,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  errorText: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.85,
  },
});
