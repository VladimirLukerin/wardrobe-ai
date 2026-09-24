import { StyleSheet, View } from 'react-native';
import { SvgXml } from 'react-native-svg';

import { PRIKIN_HANDWRITTEN_TAGLINE_SVG } from '@/components/home/prikin-handwritten-tagline-svg';
import { PrikinHomeLayout } from '@/constants/prikin-home-tokens';

/** Future admin/app-config can select among these without restructuring Home. */
export type HomeDayMessageSource = 'default-handwritten';

type HomeDayMessageProps = {
  source?: HomeDayMessageSource;
};

const TAGLINE_ASPECT = 98 / 498;

export function HomeDayMessage({ source = 'default-handwritten' }: HomeDayMessageProps) {
  if (source !== 'default-handwritten') {
    return null;
  }

  const width = PrikinHomeLayout.dayMessageWidth;
  const height = width * TAGLINE_ASPECT;

  return (
    <View style={styles.wrap} accessibilityRole="text" accessibilityLabel="Удачного дня">
      <SvgXml xml={PRIKIN_HANDWRITTEN_TAGLINE_SVG} width={width} height={height} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    maxWidth: '100%',
  },
});
