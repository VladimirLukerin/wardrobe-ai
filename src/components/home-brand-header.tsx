import { StyleSheet, View } from 'react-native';

import { PrikinBrandHeader } from '@/components/prikin/prikin-brand-header';
import { PrikinHomeLayout } from '@/constants/prikin-home-tokens';

export function HomeBrandHeader() {
  return (
    <View style={styles.wrap}>
      <PrikinBrandHeader compact logoWidth={PrikinHomeLayout.logoWidth} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: PrikinHomeLayout.logoBottomGap,
  },
});
