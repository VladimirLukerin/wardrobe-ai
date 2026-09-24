import { SvgXml } from 'react-native-svg';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

type PrikinIllustrationProps = {
  xml: string;
  width: number;
  aspectRatio?: number;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

export function PrikinIllustration({
  xml,
  width,
  aspectRatio = 390 / 200,
  style,
  accessibilityLabel,
}: PrikinIllustrationProps) {
  const height = width / aspectRatio;

  return (
    <View style={[styles.wrap, style]} accessibilityRole="image" accessibilityLabel={accessibilityLabel}>
      <SvgXml xml={xml} width={width} height={height} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'stretch',
    overflow: 'hidden',
  },
});
