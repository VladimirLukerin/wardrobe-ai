import { StyleSheet, View } from 'react-native';

import { HomeOutfitFeed } from '@/components/home-outfit-feed';
import { PrikinColors, PrikinSpacing } from '@/constants/prikin-tokens';

export function HomeWornNowSection() {
  return (
    <View style={styles.wrap}>
      <View style={styles.divider} />
      <HomeOutfitFeed />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: PrikinSpacing.homeSectionGap,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: PrikinColors.divider,
    alignSelf: 'stretch',
  },
});
