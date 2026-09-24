import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PasswordInput } from '@/components/password-input';
import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import { useAccount } from '@/contexts/account-context';
import { AccountApiError } from '@/services/account';
import { refreshCurrentUserAfterPasswordChange, setPassword } from '@/services/password-auth';

type SetPasswordSheetProps = {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
};

function resolveError(error: unknown): string {
  if (error instanceof AccountApiError) {
    if (error.status === 0) {
      return 'Не удалось подключиться к серверу';
    }

    if (error.code === 'PASSWORD_ALREADY_SET') {
      return 'Пароль уже установлен';
    }

    return error.message;
  }

  return 'Не удалось сохранить пароль';
}

export default function SetPasswordSheet({ visible, onClose, onSuccess }: SetPasswordSheetProps) {
  const insets = useSafeAreaInsets();
  const { applyAuthenticatedUser } = useAccount();
  const [password, setPasswordValue] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const bottomInset = Math.max(insets.bottom, Spacing.three);

  const resetState = useCallback(() => {
    setPasswordValue('');
    setConfirmPassword('');
    setIsSaving(false);
    setErrorMessage(null);
  }, []);

  useEffect(() => {
    if (!visible) {
      resetState();
    }
  }, [visible, resetState]);

  const handleSave = async () => {
    if (password !== confirmPassword) {
      setErrorMessage('Пароли не совпадают');
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      await setPassword(password);
      const user = await refreshCurrentUserAfterPasswordChange();
      applyAuthenticatedUser(user);
      onClose();
      onSuccess?.();
    } catch (error) {
      setErrorMessage(resolveError(error));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <KeyboardAvoidingView
          style={styles.keyboardAvoid}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}>
          <View style={[styles.sheet, { paddingBottom: bottomInset }]}>
            <View style={styles.header}>
              <ThemedText style={styles.title}>Создать пароль</ThemedText>
              <Pressable onPress={onClose} hitSlop={8} style={({ pressed }) => [pressed && styles.pressed]}>
                <ThemedText style={styles.closeButton}>×</ThemedText>
              </Pressable>
            </View>

            <ScrollView
              contentContainerStyle={styles.content}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}>
              <ThemedText themeColor="textSecondary" style={styles.subtitle}>
                С паролем вы сможете входить без кода из email.
              </ThemedText>

              <PasswordInput
                value={password}
                onChangeText={setPasswordValue}
                placeholder="Новый пароль"
                placeholderTextColor={Colors.light.textSecondary}
                returnKeyType="next"
              />

              <PasswordInput
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Повторите пароль"
                placeholderTextColor={Colors.light.textSecondary}
                returnKeyType="done"
                onSubmitEditing={() => {
                  void handleSave();
                }}
              />

              {errorMessage ? <ThemedText style={styles.errorText}>{errorMessage}</ThemedText> : null}

              <Pressable
                onPress={() => {
                  void handleSave();
                }}
                disabled={isSaving}
                style={({ pressed }) => [
                  styles.primaryButton,
                  isSaving && styles.primaryButtonDisabled,
                  pressed && styles.pressed,
                ]}>
                {isSaving ? (
                  <ActivityIndicator color={Colors.light.background} />
                ) : (
                  <ThemedText style={styles.primaryButtonText}>Сохранить пароль</ThemedText>
                )}
              </Pressable>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  keyboardAvoid: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '75%',
    backgroundColor: Colors.light.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.three,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
  },
  closeButton: {
    fontSize: 28,
    lineHeight: 28,
    color: Colors.light.textSecondary,
  },
  content: {
    gap: Spacing.three,
    paddingBottom: Spacing.two,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
  },
  errorText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#DC2626',
  },
  primaryButton: {
    minHeight: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.text,
    paddingHorizontal: Spacing.three,
  },
  primaryButtonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.background,
  },
  pressed: {
    opacity: 0.85,
  },
});
