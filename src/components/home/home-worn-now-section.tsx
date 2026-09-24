import { StyleSheet, View } from 'react-native';

import { HomeOutfitFeed } from '@/components/home-outfit-feed';
import { PrikinHomeLayout } from '@/constants/prikin-home-tokens';
import { PrikinColors } from '@/constants/prikin-tokens';

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
    gap: PrikinHomeLayout.communitySectionTopGap,
    marginTop: 0,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: PrikinColors.divider,
    alignSelf: 'stretch',
  },
});
