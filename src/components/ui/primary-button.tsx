import { ActivityIndicator, Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';

import {
  PrikinButton,
  PrikinColors,
  PrikinRadii,
  PrikinTypography,
} from '@/constants/prikin-tokens';

type PrimaryButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

export function PrimaryButton({
  label,
  onPress,
  disabled = false,
  loading = false,
  style,
  accessibilityLabel,
}: PrimaryButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        isDisabled && styles.buttonDisabled,
        pressed && !isDisabled && styles.pressed,
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={PrikinColors.buttonPrimaryText} />
      ) : (
        <Text style={styles.label}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: PrikinButton.minHeight,
    borderRadius: PrikinRadii.button,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PrikinColors.buttonPrimary,
    paddingHorizontal: PrikinButton.paddingHorizontal,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  label: {
    ...PrikinTypography.buttonLabel,
    color: PrikinColors.buttonPrimaryText,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.88,
  },
});
