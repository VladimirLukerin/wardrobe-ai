import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { getFamilyMemberLabel } from '@/constants/family';
import { Spacing } from '@/constants/theme';
import { useFamily } from '@/contexts/family-context';

export function FamilyInviteBanner() {
  const insets = useSafeAreaInsets();
  const { invitePopup, dismissInvitePopup } = useFamily();

  const handleView = (inviteId: string) => {
    dismissInvitePopup(inviteId);
    router.navigate('/profile');
  };

  // Container stays mounted so the card's exiting animation can play.
  return (
    <View
      pointerEvents="box-none"
      style={[styles.container, { top: Math.max(insets.top, Spacing.two) + Spacing.one }]}>
      {invitePopup ? (
        <Animated.View
          key={invitePopup.id}
          entering={FadeInUp.duration(220)}
          exiting={FadeOutUp.duration(180)}
          style={styles.card}>
          <View style={styles.textBlock}>
            <ThemedText style={styles.title}>Новое приглашение в семью</ThemedText>
            <ThemedText style={styles.subtitle} numberOfLines={2}>
              {getFamilyMemberLabel(invitePopup.sender)} хочет добавить вас в семью
            </ThemedText>
          </View>

          <View style={styles.actions}>
            <Pressable
              onPress={() => handleView(invitePopup.id)}
              style={({ pressed }) => [styles.viewButton, pressed && styles.pressed]}>
              <ThemedText style={styles.viewButtonText}>Посмотреть</ThemedText>
            </Pressable>
            <Pressable
              onPress={() => dismissInvitePopup(invitePopup.id)}
              hitSlop={10}
              accessibilityLabel="Закрыть уведомление"
              style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}>
              <ThemedText style={styles.closeButtonText}>×</ThemedText>
            </Pressable>
          </View>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    zIndex: 100,
  },
  card: {
    width: '100%',
    maxWidth: 520,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
    paddingLeft: Spacing.four,
    paddingRight: Spacing.two,
    borderRadius: 16,
    backgroundColor: 'rgba(20, 20, 22, 0.92)',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  textBlock: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
    color: 'rgba(255, 255, 255, 0.78)',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  viewButton: {
    paddingVertical: Spacing.one + 2,
    paddingHorizontal: Spacing.three,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
  },
  viewButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
  },
  closeButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    fontSize: 24,
    lineHeight: 26,
    color: 'rgba(255, 255, 255, 0.78)',
  },
  pressed: {
    opacity: 0.8,
  },
});
