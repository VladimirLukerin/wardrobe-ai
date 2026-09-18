import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';

type PhotoCaptureOnboardingSheetProps = {
  visible: boolean;
  onContinue: () => void;
  onSkipForever: () => void;
  onClose: () => void;
};

const SILHOUETTES = [
  { label: 'Футболка', width: 72, height: 88, borderRadius: 12 },
  { label: 'Брюки', width: 56, height: 96, borderRadius: 10 },
  { label: 'Куртка', width: 84, height: 92, borderRadius: 14 },
  { label: 'Обувь', width: 88, height: 36, borderRadius: 18 },
] as const;

const TIPS = [
  'одна вещь в кадре',
  'вещь целиком видна',
  'нейтральный фон',
  'хорошее освещение',
  'без сильных теней',
] as const;

export function PhotoCaptureAnimationSlot() {
  const fade = useRef(new Animated.Value(1)).current;
  const [silhouetteIndex, setSilhouetteIndex] = useState(0);

  useEffect(() => {
    const cycle = Animated.loop(
      Animated.sequence([
        Animated.timing(fade, {
          toValue: 0.2,
          duration: 450,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(fade, {
          toValue: 1,
          duration: 450,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );

    cycle.start();

    const interval = setInterval(() => {
      setSilhouetteIndex((current) => (current + 1) % SILHOUETTES.length);
    }, 900);

    return () => {
      cycle.stop();
      clearInterval(interval);
    };
  }, [fade]);

  const silhouette = SILHOUETTES[silhouetteIndex];

  return (
    <View style={styles.animationSlot}>
      <Animated.View
        style={[
          styles.silhouette,
          {
            width: silhouette.width,
            height: silhouette.height,
            borderRadius: silhouette.borderRadius,
            opacity: fade,
          },
        ]}
      />
      <ThemedText themeColor="textSecondary" style={styles.silhouetteLabel}>
        {silhouette.label}
      </ThemedText>
    </View>
  );
}

export function PhotoCaptureOnboardingSheet({
  visible,
  onContinue,
  onSkipForever,
  onClose,
}: PhotoCaptureOnboardingSheetProps) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, Spacing.three) }]}>
          <PhotoCaptureAnimationSlot />

          <ThemedText style={styles.title}>Как сфотографировать вещь</ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.subtitle}>
            Пожалуйста, сфотографируйте одну вещь в вертикальном положении на нейтральном фоне.
          </ThemedText>

          <View style={styles.tips}>
            {TIPS.map((tip) => (
              <ThemedText key={tip} themeColor="textSecondary" style={styles.tip}>
                • {tip}
              </ThemedText>
            ))}
          </View>

          <Pressable
            onPress={onContinue}
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
            <ThemedText style={styles.primaryButtonText}>Продолжить</ThemedText>
          </Pressable>

          <Pressable
            onPress={onSkipForever}
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
            <ThemedText style={styles.secondaryButtonText}>Больше не показывать</ThemedText>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  sheet: {
    backgroundColor: Colors.light.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    gap: Spacing.three,
  },
  animationSlot: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 140,
    gap: Spacing.two,
  },
  silhouette: {
    backgroundColor: '#D1D5DB',
  },
  silhouetteLabel: {
    fontSize: 13,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
  },
  tips: {
    gap: Spacing.one,
  },
  tip: {
    fontSize: 15,
    lineHeight: 22,
  },
  primaryButton: {
    minHeight: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.text,
    marginTop: Spacing.one,
  },
  primaryButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.light.background,
  },
  secondaryButton: {
    alignItems: 'center',
    paddingVertical: Spacing.two,
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '500',
    color: Colors.light.textSecondary,
  },
  pressed: {
    opacity: 0.85,
  },
});
