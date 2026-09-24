import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import { NETWORK_ERROR_MESSAGE, NETWORK_ERROR_TITLE } from '@/utils/network-error';

type NetworkErrorCardProps = {
  onRetry?: () => void;
  compact?: boolean;
};

export function NetworkErrorCard({ onRetry, compact = false }: NetworkErrorCardProps) {
  return (
    <View style={compact ? styles.compact : styles.card}>
      <ThemedText style={compact ? styles.compactTitle : styles.title}>{NETWORK_ERROR_TITLE}</ThemedText>
      <ThemedText themeColor="textSecondary" style={compact ? styles.compactMessage : styles.message}>
        {NETWORK_ERROR_MESSAGE}
      </ThemedText>
      {onRetry ? (
        <Pressable
          onPress={onRetry}
          style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}>
          <ThemedText style={styles.retryButtonText}>Повторить</ThemedText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.one,
    paddingVertical: Spacing.two,
  },
  compact: {
    gap: Spacing.half,
    paddingVertical: Spacing.one,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
  },
  compactTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
  },
  compactMessage: {
    fontSize: 13,
    lineHeight: 18,
  },
  retryButton: {
    alignSelf: 'flex-start',
    marginTop: Spacing.half,
  },
  retryButtonText: {
    color: Colors.light.text,
    fontSize: 14,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.7,
  },
});
