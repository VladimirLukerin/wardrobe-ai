import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { APP_BRAND_NAME } from '@/constants/app-brand';
import { Colors, Spacing } from '@/constants/theme';

export function HomeBrandHeader() {
  return (
    <View style={styles.header}>
      <View style={styles.logoPlaceholder} />
      <ThemedText style={styles.brandTitle}>{APP_BRAND_NAME}</ThemedText>
    </View>
  );
}

const LOGO_SIZE = 28;

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingTop: Spacing.one,
    paddingBottom: Spacing.two,
  },
  logoPlaceholder: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    borderRadius: LOGO_SIZE / 2,
    backgroundColor: Colors.light.backgroundElement,
  },
  brandTitle: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: Colors.light.text,
  },
});
