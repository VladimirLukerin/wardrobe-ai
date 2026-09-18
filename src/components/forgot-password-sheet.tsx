import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PasswordInput } from '@/components/password-input';
import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import type { ConfirmAccountSwitchFn } from '@/hooks/use-auth-account-switch';
import { AccountApiError } from '@/services/account';
import {
  requestPasswordResetCode,
  verifyPasswordReset,
} from '@/services/password-auth';

type ForgotPasswordSheetProps = {
  visible: boolean;
  confirmAndSwitch: ConfirmAccountSwitchFn;
  initialEmail?: string;
  skipEmailEntry?: boolean;
  onClose: () => void;
  onSuccess?: () => void;
};

type Step = 'email' | 'confirm-email' | 'code' | 'password';

function resolveRequestError(error: unknown): string {
  if (error instanceof AccountApiError) {
    if (error.status === 0) {
      return 'Не удалось подключиться к серверу';
    }

    return error.message;
  }

  return 'Не удалось отправить код';
}

function resolveVerifyError(error: unknown): string {
  if (error instanceof AccountApiError) {
    if (error.status === 0) {
      return 'Не удалось подключиться к серверу';
    }

    return error.message;
  }

  return 'Не удалось сбросить пароль';
}

export default function ForgotPasswordSheet({
  visible,
  confirmAndSwitch,
  initialEmail = '',
  skipEmailEntry = false,
  onClose,
  onSuccess,
}: ForgotPasswordSheetProps) {
  const insets = useSafeAreaInsets();
  const initialStep: Step =
    skipEmailEntry && initialEmail.trim().length > 0 ? 'confirm-email' : 'email';
  const [step, setStep] = useState<Step>(initialStep);
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [resendAfterSeconds, setResendAfterSeconds] = useState(0);
  const [isRequesting, setIsRequesting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const bottomInset = Math.max(insets.bottom, Spacing.three);

  const resetState = useCallback(() => {
    setStep(initialStep);
    setEmail(initialEmail);
    setCode('');
    setNewPassword('');
    setConfirmPassword('');
    setChallengeId(null);
    setResendAfterSeconds(0);
    setIsRequesting(false);
    setIsSubmitting(false);
    setErrorMessage(null);
  }, [initialEmail, initialStep]);

  useEffect(() => {
    if (!visible) {
      resetState();
      return;
    }

    setEmail(initialEmail);
    setStep(skipEmailEntry && initialEmail.trim().length > 0 ? 'confirm-email' : 'email');
  }, [visible, initialEmail, resetState, skipEmailEntry]);

  useEffect(() => {
    if (resendAfterSeconds <= 0) {
      return;
    }

    const timer = setTimeout(() => {
      setResendAfterSeconds((current) => Math.max(0, current - 1));
    }, 1000);

    return () => {
      clearTimeout(timer);
    };
  }, [resendAfterSeconds]);

  const handleRequestCode = async () => {
    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      setErrorMessage('Введите email');
      return;
    }

    setIsRequesting(true);
    setErrorMessage(null);

    try {
      const response = await requestPasswordResetCode(trimmedEmail);
      setChallengeId(response.challengeId);
      setResendAfterSeconds(response.resendAfterSeconds);
      setStep('code');
      setCode('');
    } catch (error) {
      if (error instanceof AccountApiError && error.status === 429 && error.resendAfterSeconds) {
        setResendAfterSeconds(error.resendAfterSeconds);
        setErrorMessage(null);

        if (challengeId) {
          return;
        }

        return;
      }

      setErrorMessage(resolveRequestError(error));
    } finally {
      setIsRequesting(false);
    }
  };

  const handleContinueToPassword = () => {
    const trimmedCode = code.trim();

    if (trimmedCode.length !== 6) {
      setErrorMessage('Введите 6-значный код');
      return;
    }

    setStep('password');
    setErrorMessage(null);
  };

  const handleResetPassword = async () => {
    if (!challengeId) {
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage('Пароли не совпадают');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const authResult = await verifyPasswordReset({
        challengeId,
        code: code.trim(),
        newPassword,
      });

      await confirmAndSwitch(authResult, () => {
        onClose();
        onSuccess?.();
      });
    } catch (error) {
      setErrorMessage(resolveVerifyError(error));
    } finally {
      setIsSubmitting(false);
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
              <ThemedText style={styles.title}>Восстановление пароля</ThemedText>
              <Pressable onPress={onClose} hitSlop={8} style={({ pressed }) => [pressed && styles.pressed]}>
                <ThemedText style={styles.closeButton}>×</ThemedText>
              </Pressable>
            </View>

            <ScrollView
              contentContainerStyle={styles.content}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}>
              {step === 'email' ? (
                <>
                  <ThemedText themeColor="textSecondary" style={styles.subtitle}>
                    Если к этому email привязан аккаунт, мы отправим код для сброса пароля.
                  </ThemedText>

                  <TextInput
                    value={email}
                    onChangeText={setEmail}
                    style={styles.textInput}
                    placeholder="Email"
                    placeholderTextColor={Colors.light.textSecondary}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    textContentType="emailAddress"
                    returnKeyType="done"
                    onSubmitEditing={() => {
                      void handleRequestCode();
                    }}
                  />

                  {errorMessage ? <ThemedText style={styles.errorText}>{errorMessage}</ThemedText> : null}

                  {resendAfterSeconds > 0 ? (
                    <ThemedText themeColor="textSecondary" style={styles.subtitle}>
                      Отправить снова через {resendAfterSeconds} сек
                    </ThemedText>
                  ) : null}

                  <Pressable
                    onPress={() => {
                      void handleRequestCode();
                    }}
                    disabled={isRequesting || resendAfterSeconds > 0}
                    style={({ pressed }) => [
                      styles.primaryButton,
                      (isRequesting || resendAfterSeconds > 0) && styles.primaryButtonDisabled,
                      pressed && styles.pressed,
                    ]}>
                    {isRequesting ? (
                      <ActivityIndicator color={Colors.light.background} />
                    ) : (
                      <ThemedText style={styles.primaryButtonText}>Отправить код</ThemedText>
                    )}
                  </Pressable>
                </>
              ) : null}

              {step === 'confirm-email' ? (
                <>
                  <ThemedText themeColor="textSecondary" style={styles.subtitle}>
                    Мы отправим код для сброса пароля на этот email.
                  </ThemedText>

                  <ThemedText style={styles.emailValue}>{email.trim()}</ThemedText>

                  {errorMessage ? <ThemedText style={styles.errorText}>{errorMessage}</ThemedText> : null}

                  {resendAfterSeconds > 0 ? (
                    <ThemedText themeColor="textSecondary" style={styles.subtitle}>
                      Отправить снова через {resendAfterSeconds} сек
                    </ThemedText>
                  ) : null}

                  <Pressable
                    onPress={() => {
                      void handleRequestCode();
                    }}
                    disabled={isRequesting || resendAfterSeconds > 0}
                    style={({ pressed }) => [
                      styles.primaryButton,
                      (isRequesting || resendAfterSeconds > 0) && styles.primaryButtonDisabled,
                      pressed && styles.pressed,
                    ]}>
                    {isRequesting ? (
                      <ActivityIndicator color={Colors.light.background} />
                    ) : (
                      <ThemedText style={styles.primaryButtonText}>Отправить код</ThemedText>
                    )}
                  </Pressable>
                </>
              ) : null}

              {step === 'code' ? (
                <>
                  <ThemedText themeColor="textSecondary" style={styles.subtitle}>
                    Если к этому email привязан аккаунт, мы отправили код.
                  </ThemedText>

                  <TextInput
                    value={code}
                    onChangeText={setCode}
                    style={styles.textInput}
                    placeholder="000000"
                    placeholderTextColor={Colors.light.textSecondary}
                    keyboardType="number-pad"
                    maxLength={6}
                    autoFocus
                    returnKeyType="done"
                    onSubmitEditing={handleContinueToPassword}
                  />

                  {errorMessage ? <ThemedText style={styles.errorText}>{errorMessage}</ThemedText> : null}

                  {resendAfterSeconds > 0 && !errorMessage ? (
                    <ThemedText themeColor="textSecondary" style={styles.subtitle}>
                      Отправить снова через {resendAfterSeconds} сек
                    </ThemedText>
                  ) : null}

                  <Pressable
                    onPress={handleContinueToPassword}
                    style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
                    <ThemedText style={styles.primaryButtonText}>Продолжить</ThemedText>
                  </Pressable>

                  <Pressable
                    onPress={() => {
                      void handleRequestCode();
                    }}
                    disabled={resendAfterSeconds > 0 || isRequesting}
                    style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
                    <ThemedText
                      themeColor={resendAfterSeconds > 0 ? 'textSecondary' : undefined}
                      style={styles.secondaryButtonText}>
                      {resendAfterSeconds > 0
                        ? `Отправить снова через ${resendAfterSeconds} сек`
                        : 'Отправить код снова'}
                    </ThemedText>
                  </Pressable>
                </>
              ) : null}

              {step === 'password' ? (
                <>
                  <PasswordInput
                    value={newPassword}
                    onChangeText={setNewPassword}
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
                      void handleResetPassword();
                    }}
                  />

                  {errorMessage ? <ThemedText style={styles.errorText}>{errorMessage}</ThemedText> : null}

                  <Pressable
                    onPress={() => {
                      void handleResetPassword();
                    }}
                    disabled={isSubmitting}
                    style={({ pressed }) => [
                      styles.primaryButton,
                      isSubmitting && styles.primaryButtonDisabled,
                      pressed && styles.pressed,
                    ]}>
                    {isSubmitting ? (
                      <ActivityIndicator color={Colors.light.background} />
                    ) : (
                      <ThemedText style={styles.primaryButtonText}>Сохранить пароль</ThemedText>
                    )}
                  </Pressable>
                </>
              ) : null}
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
    maxHeight: '80%',
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
  emailValue: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.light.text,
  },
  textInput: {
    backgroundColor: Colors.light.backgroundElement,
    borderRadius: 14,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontSize: 16,
    color: Colors.light.text,
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
  secondaryButton: {
    alignItems: 'center',
    paddingVertical: Spacing.two,
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '500',
    color: Colors.light.text,
  },
  pressed: {
    opacity: 0.85,
  },
});
