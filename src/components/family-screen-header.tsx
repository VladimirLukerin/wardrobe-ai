import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';

type FamilyScreenHeaderProps = {
  title: string;
};

export function FamilyScreenHeader({ title }: FamilyScreenHeaderProps) {
  return (
    <View style={styles.header}>
      <Pressable
        onPress={() => router.back()}
        hitSlop={8}
        style={({ pressed }) => [styles.back, pressed && styles.pressed]}>
        <SymbolView
          name={{ ios: 'chevron.left', android: 'chevron_left', web: 'chevron_left' }}
          size={18}
          tintColor={Colors.light.text}
        />
        <ThemedText style={styles.backText}>Назад</ThemedText>
      </Pressable>
      <ThemedText style={styles.title} numberOfLines={1}>
        {title}
      </ThemedText>
      <View style={styles.spacer} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Spacing.one,
    paddingBottom: Spacing.two,
    gap: Spacing.two,
  },
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    minWidth: 88,
  },
  backText: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.light.text,
  },
  title: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    color: Colors.light.text,
    textAlign: 'center',
  },
  spacer: {
    minWidth: 88,
  },
  pressed: {
    opacity: 0.7,
  },
});
