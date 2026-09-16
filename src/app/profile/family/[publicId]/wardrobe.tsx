import { SymbolView } from 'expo-symbols';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FamilyScreenHeader } from '@/components/family-screen-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, MaxContentWidth, Spacing, TabScreenScrollPadding } from '@/constants/theme';
import { useFamilyMemberRoute } from '@/hooks/use-family-member-route';

/**
 * Placeholder for the read-only family wardrobe. Intentionally makes no requests:
 * the real screen will plug a family wardrobe API in here later.
 */
export default function FamilyMemberWardrobeScreen() {
  const { label } = useFamilyMemberRoute();

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <FamilyScreenHeader title="Гардероб" />

        <View style={styles.content}>
          <View style={styles.iconCircle}>
            <SymbolView
              name={{ ios: 'tshirt', android: 'checkroom', web: 'checkroom' }}
              size={32}
              tintColor={Colors.light.textSecondary}
            />
          </View>
          <ThemedText style={styles.title}>{label} — гардероб</ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.subtitle}>
            Скоро здесь можно будет смотреть вещи члена семьи.
          </ThemedText>
        </View>
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
    paddingHorizontal: Spacing.four,
    paddingBottom: TabScreenScrollPadding,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingBottom: Spacing.six,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.backgroundElement,
    marginBottom: Spacing.two,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.light.text,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    maxWidth: 300,
  },
});
