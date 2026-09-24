import { Pressable, StyleSheet, Text, View, type PressableProps } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { PrikinButton, PrikinColors, PrikinHomeRadii, PrikinRadii, PrikinTypography } from '@/constants/prikin-tokens';
import type { PressableStateCallbackType, StyleProp, ViewStyle } from 'react-native';

type PrikinPrimaryButtonProps = PressableProps & {
  label: string;
  variant?: 'filled' | 'outline';
  size?: 'default' | 'compact';
  showPlusIcon?: boolean;
  style?: StyleProp<ViewStyle> | ((state: PressableStateCallbackType) => StyleProp<ViewStyle>);
};

export function PrikinPrimaryButton({
  label,
  variant = 'filled',
  size = 'default',
  showPlusIcon = false,
  style,
  ...props
}: PrikinPrimaryButtonProps) {
  const isOutline = variant === 'outline';
  const isCompact = size === 'compact';

  return (
    <Pressable
      {...props}
      accessibilityRole="button"
      style={(state) => [
        styles.base,
        isCompact ? styles.compact : styles.defaultHeight,
        isCompact ? styles.compactRadius : styles.defaultRadius,
        isOutline ? styles.outline : styles.filled,
        state.pressed && styles.pressed,
        typeof style === 'function' ? style(state) : style,
      ]}>
      <View style={styles.content}>
        {showPlusIcon ? (
          <SymbolView
            name={{ ios: 'plus', android: 'add', web: 'add' }}
            size={isCompact ? 20 : 18}
            tintColor={isOutline ? PrikinColors.buttonPrimary : PrikinColors.buttonPrimaryText}
          />
        ) : null}
        <Text
          style={[
            styles.label,
            isCompact && styles.labelCompact,
            isOutline ? styles.labelOutline : styles.labelFilled,
          ]}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingHorizontal: PrikinButton.paddingHorizontal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  defaultHeight: {
    minHeight: PrikinButton.minHeight,
  },
  compact: {
    minHeight: PrikinButton.compactMinHeight,
  },
  defaultRadius: {
    borderRadius: PrikinRadii.button,
  },
  compactRadius: {
    borderRadius: 26,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  filled: {
    backgroundColor: PrikinColors.buttonPrimary,
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: PrikinColors.buttonPrimary,
  },
  label: {
    ...PrikinTypography.buttonLabel,
  },
  labelCompact: {
    fontSize: 16,
    lineHeight: 20,
  },
  labelFilled: {
    color: PrikinColors.buttonPrimaryText,
  },
  labelOutline: {
    color: PrikinColors.buttonPrimary,
  },
  pressed: {
    opacity: 0.88,
  },
});
