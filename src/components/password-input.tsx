import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';

type PasswordInputProps = Omit<TextInputProps, 'secureTextEntry'> & {
  value: string;
  onChangeText: (value: string) => void;
};

export function PasswordInput({ value, onChangeText, style, ...rest }: PasswordInputProps) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <View style={styles.container}>
      <TextInput
        {...rest}
        value={value}
        onChangeText={onChangeText}
        style={[styles.input, style]}
        secureTextEntry={!isVisible}
        textContentType="password"
        autoCapitalize="none"
        autoCorrect={false}
      />
      <Pressable
        onPress={() => setIsVisible((current) => !current)}
        hitSlop={8}
        style={({ pressed }) => [styles.toggleButton, pressed && styles.pressed]}>
        <ThemedText style={styles.toggleText}>{isVisible ? 'Скрыть' : 'Показать'}</ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  input: {
    backgroundColor: Colors.light.backgroundElement,
    borderRadius: 14,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    paddingRight: 88,
    fontSize: 16,
    color: Colors.light.text,
  },
  toggleButton: {
    position: 'absolute',
    right: Spacing.two,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    paddingHorizontal: Spacing.one,
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.textSecondary,
  },
  pressed: {
    opacity: 0.85,
  },
});
