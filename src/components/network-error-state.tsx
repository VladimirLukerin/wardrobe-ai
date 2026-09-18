import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import { NETWORK_ERROR_HINT, NETWORK_ERROR_TITLE, RETRY_LABEL } from '@/utils/network-error';

type NetworkErrorStateProps = {
  onRetry: () => void;
  title?: string;
  hint?: string | null;
  isRetrying?: boolean;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** Friendly "server unreachable" state with a retry action. */
export function NetworkErrorState({
  onRetry,
  title = NETWORK_ERROR_TITLE,
  hint = NETWORK_ERROR_HINT,
  isRetrying = false,
  compact = false,
  style,
}: NetworkErrorStateProps) {
  return (
    <View style={[styles.container, compact && styles.containerCompact, style]}>
      <ThemedText style={[styles.title, compact && styles.titleCompact]}>{title}</ThemedText>
      {hint ? (
        <ThemedText themeColor="textSecondary" style={styles.hint}>
          {hint}
        </ThemedText>
      ) : null}
      <Pressable
        onPress={onRetry}
        disabled={isRetrying}
        style={({ pressed }) => [
          styles.retryButton,
          compact && styles.retryButtonCompact,
          isRetrying && styles.retryButtonDisabled,
          pressed && !isRetrying && styles.pressed,
        ]}>
        <ThemedText style={styles.retryButtonText}>
          {isRetrying ? 'Повторяем…' : RETRY_LABEL}
        </ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
    backgroundColor: Colors.light.backgroundElement,
    borderRadius: 16,
  },
  containerCompact: {
    alignItems: 'flex-start',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: 12,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.light.text,
    textAlign: 'center',
  },
  titleCompact: {
    fontSize: 15,
    textAlign: 'left',
  },
  hint: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: Spacing.one,
    minHeight: 40,
    justifyContent: 'center',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    borderRadius: 12,
    backgroundColor: Colors.light.text,
  },
  retryButtonCompact: {
    minHeight: 36,
    paddingHorizontal: Spacing.three,
  },
  retryButtonDisabled: {
    opacity: 0.5,
  },
  retryButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.light.background,
  },
  pressed: {
    opacity: 0.85,
  },
});
