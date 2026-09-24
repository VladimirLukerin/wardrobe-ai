import { SvgXml } from 'react-native-svg';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

type PrikinIllustrationProps = {
  xml: string;
  width: number;
  aspectRatio?: number;
  contentScale?: number;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

export function PrikinIllustration({
  xml,
  width,
  aspectRatio = 390 / 200,
  contentScale = 1,
  style,
  accessibilityLabel,
}: PrikinIllustrationProps) {
  const height = width / aspectRatio;

  return (
    <View
      style={[styles.wrap, { width, height }, style]}
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}>
      <SvgXml
        xml={xml}
        width={width * contentScale}
        height={height * contentScale}
        style={contentScale !== 1 ? { marginLeft: -((width * (contentScale - 1)) / 2) } : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexShrink: 0,
    overflow: 'visible',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
