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

import ForgotPasswordSheet from '@/components/forgot-password-sheet';
import { PasswordInput } from '@/components/password-input';
import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import type { ConfirmAccountSwitchFn } from '@/hooks/use-auth-account-switch';
import { AccountApiError } from '@/services/account';
import {
  devBypassEmailLoginCode,
  lookupEmailAccount,
  requestEmailLoginCode,
  verifyEmailLoginCode,
} from '@/services/email-auth';
import { loginWithPassword } from '@/services/password-auth';
import { isDevOtpBypassAvailable } from '@/utils/dev-otp-bypass';

type EmailLoginSheetProps = {
  visible: boolean;
  confirmAndSwitch: ConfirmAccountSwitchFn;
  onClose: () => void;
  onSuccess?: () => void;
  onCreateAccount?: (email: string) => void | Promise<void>;
  overlayStyle?: 'dimmed' | 'transparent';
};

type Step = 'email' | 'password' | 'no-password' | 'unknown' | 'otp-code';

function resolvePasswordError(error: unknown): string {
  if (error instanceof AccountApiError) {
    if (error.status === 0) {
      return 'Не удалось подключиться к серверу';
    }

    if (error.code === 'auth_rate_limited') {
      return error.message;
    }

    if (error.code === 'INVALID_CREDENTIALS') {
      return error.message;
    }

    return error.message;
  }

  return 'Не удалось выполнить вход';
}

function resolveLookupError(error: unknown): string {
  if (error instanceof AccountApiError) {
    if (error.status === 0) {
      return 'Не удалось подключиться к серверу';
    }

    return error.message;
  }

  return 'Не удалось проверить email';
}

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

  return 'Не удалось подтвердить код';
}

export default function EmailLoginSheet({
  visible,
  confirmAndSwitch,
  onClose,
  onSuccess,
  onCreateAccount,
  overlayStyle = 'dimmed',
}: EmailLoginSheetProps) {
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [resendAfterSeconds, setResendAfterSeconds] = useState(0);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [isPasswordLoggingIn, setIsPasswordLoggingIn] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isForgotPasswordVisible, setIsForgotPasswordVisible] = useState(false);

  const bottomInset = Math.max(insets.bottom, Spacing.three);

  const resetState = useCallback(() => {
    setStep('email');
    setEmail('');
    setPassword('');
    setCode('');
    setChallengeId(null);
    setResendAfterSeconds(0);
    setIsLookingUp(false);
    setIsPasswordLoggingIn(false);
    setIsRequesting(false);
    setIsVerifying(false);
    setIsCreatingAccount(false);
    setErrorMessage(null);
    setIsForgotPasswordVisible(false);
  }, []);

  useEffect(() => {
    if (!visible) {
      resetState();
    }
  }, [visible, resetState]);

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

  const returnToEmailStep = () => {
    setStep('email');
    setPassword('');
    setCode('');
    setChallengeId(null);
    setErrorMessage(null);
  };

  const handleEmailChange = (nextEmail: string) => {
    setEmail(nextEmail);

    if (step !== 'email') {
      setPassword('');
      setStep('email');
      setErrorMessage(null);
    }
  };

  const handleContinueEmail = async () => {
    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      setErrorMessage('Введите email');
      return;
    }

    setIsLookingUp(true);
    setErrorMessage(null);

    try {
      const lookup = await lookupEmailAccount(trimmedEmail);

      if (lookup.exists && lookup.hasPassword) {
        setStep('password');
        return;
      }

      if (lookup.exists && !lookup.hasPassword) {
        setStep('no-password');
        return;
      }

      setStep('unknown');
    } catch (error) {
      setErrorMessage(resolveLookupError(error));
    } finally {
      setIsLookingUp(false);
    }
  };

  const handlePasswordLogin = async () => {
    const trimmedEmail = email.trim();

    if (!trimmedEmail || !password) {
      return;
    }

    setIsPasswordLoggingIn(true);
    setErrorMessage(null);

    try {
      const authResult = await loginWithPassword({
        email: trimmedEmail,
        password,
      });

      await confirmAndSwitch(authResult, () => {
        onClose();
        onSuccess?.();
      });
    } catch (error) {
      setErrorMessage(resolvePasswordError(error));
    } finally {
      setIsPasswordLoggingIn(false);
    }
  };

  const handleRequestCode = async () => {
    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      setErrorMessage('Введите email');
      return;
    }

    setIsRequesting(true);
    setErrorMessage(null);

    try {
      const response = await requestEmailLoginCode(trimmedEmail);

      if (isDevOtpBypassAvailable(response)) {
        setIsVerifying(true);

        try {
          const loginResult = await devBypassEmailLoginCode(response.challengeId);
          await confirmAndSwitch(loginResult, () => {
            onClose();
            onSuccess?.();
          });
          return;
        } catch (error) {
          setErrorMessage(resolveVerifyError(error));
          return;
        } finally {
          setIsVerifying(false);
        }
      }

      setChallengeId(response.challengeId);
      setResendAfterSeconds(response.resendAfterSeconds);
      setStep('otp-code');
      setCode('');
    } catch (error) {
      if (error instanceof AccountApiError && error.status === 429 && error.resendAfterSeconds) {
        setResendAfterSeconds(error.resendAfterSeconds);
        setErrorMessage(null);
        return;
      }

      setErrorMessage(resolveRequestError(error));
    } finally {
      setIsRequesting(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!challengeId) {
      return;
    }

    const trimmedCode = code.trim();

    if (trimmedCode.length !== 6) {
      setErrorMessage('Введите 6-значный код');
      return;
    }

    setIsVerifying(true);
    setErrorMessage(null);

    try {
      const loginResult = await verifyEmailLoginCode({
        challengeId,
        code: trimmedCode,
      });

      await confirmAndSwitch(loginResult, () => {
        onClose();
        onSuccess?.();
      });
    } catch (error) {
      setErrorMessage(resolveVerifyError(error));
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResendCode = async () => {
    if (resendAfterSeconds > 0 || isRequesting) {
      return;
    }

    await handleRequestCode();
  };

  const handleCreateAccount = async () => {
    const trimmedEmail = email.trim();

    if (!trimmedEmail || !onCreateAccount) {
      return;
    }

    setIsCreatingAccount(true);
    setErrorMessage(null);

    try {
      await onCreateAccount(trimmedEmail);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Не удалось создать аккаунт');
    } finally {
      setIsCreatingAccount(false);
    }
  };

  return (
    <>
      <Modal visible={visible && !isForgotPasswordVisible} transparent animationType="slide" onRequestClose={onClose}>
        <View style={[styles.overlay, overlayStyle === 'transparent' && styles.overlayTransparent]}>
          <KeyboardAvoidingView
            style={styles.keyboardAvoid}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}>
            <View style={[styles.sheet, { paddingBottom: bottomInset }]}>
              <View style={styles.header}>
                <ThemedText style={styles.title}>Войти по email</ThemedText>
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
                    <TextInput
                      value={email}
                      onChangeText={handleEmailChange}
                      style={styles.textInput}
                      placeholder="Email"
                      placeholderTextColor={Colors.light.textSecondary}
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="email-address"
                      textContentType="emailAddress"
                      returnKeyType="done"
                      onSubmitEditing={() => {
                        void handleContinueEmail();
                      }}
                    />

                    {errorMessage ? <ThemedText style={styles.errorText}>{errorMessage}</ThemedText> : null}

                    <Pressable
                      onPress={() => {
                        void handleContinueEmail();
                      }}
                      disabled={isLookingUp}
                      style={({ pressed }) => [
                        styles.primaryButton,
                        isLookingUp && styles.primaryButtonDisabled,
                        pressed && styles.pressed,
                      ]}>
                      {isLookingUp ? (
                        <ActivityIndicator color={Colors.light.background} />
                      ) : (
                        <ThemedText style={styles.primaryButtonText}>Продолжить</ThemedText>
                      )}
                    </Pressable>
                  </>
                ) : null}

                {step === 'password' ? (
                  <>
                    <View style={styles.emailRow}>
                      <ThemedText style={styles.emailValue}>{email.trim()}</ThemedText>
                      <Pressable onPress={returnToEmailStep} style={({ pressed }) => [pressed && styles.pressed]}>
                        <ThemedText style={styles.linkButtonText}>Изменить</ThemedText>
                      </Pressable>
                    </View>

                    <PasswordInput
                      value={password}
                      onChangeText={setPassword}
                      placeholder="Пароль"
                      placeholderTextColor={Colors.light.textSecondary}
                      returnKeyType="done"
                      onSubmitEditing={() => {
                        if (password.length > 0) {
                          void handlePasswordLogin();
                        }
                      }}
                    />

                    {errorMessage ? <ThemedText style={styles.errorText}>{errorMessage}</ThemedText> : null}

                    {password.length > 0 ? (
                      <Pressable
                        onPress={() => {
                          void handlePasswordLogin();
                        }}
                        disabled={isPasswordLoggingIn}
                        style={({ pressed }) => [
                          styles.primaryButton,
                          isPasswordLoggingIn && styles.primaryButtonDisabled,
                          pressed && styles.pressed,
                        ]}>
                        {isPasswordLoggingIn ? (
                          <ActivityIndicator color={Colors.light.background} />
                        ) : (
                          <ThemedText style={styles.primaryButtonText}>Войти</ThemedText>
                        )}
                      </Pressable>
                    ) : null}

                    <Pressable
                      onPress={() => setIsForgotPasswordVisible(true)}
                      style={({ pressed }) => [styles.linkButton, pressed && styles.pressed]}>
                      <ThemedText style={styles.linkButtonText}>Забыли пароль?</ThemedText>
                    </Pressable>

                    <Pressable
                      onPress={() => {
                        void handleRequestCode();
                      }}
                      disabled={isRequesting}
                      style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
                      <ThemedText style={styles.secondaryButtonText}>Войти по коду из email</ThemedText>
                    </Pressable>
                  </>
                ) : null}

                {step === 'no-password' ? (
                  <>
                    <View style={styles.emailRow}>
                      <ThemedText style={styles.emailValue}>{email.trim()}</ThemedText>
                      <Pressable onPress={returnToEmailStep} style={({ pressed }) => [pressed && styles.pressed]}>
                        <ThemedText style={styles.linkButtonText}>Изменить</ThemedText>
                      </Pressable>
                    </View>

                    <ThemedText themeColor="textSecondary" style={styles.subtitle}>
                      Для этого аккаунта пароль ещё не создан.
                    </ThemedText>

                    {errorMessage ? <ThemedText style={styles.errorText}>{errorMessage}</ThemedText> : null}

                    <Pressable
                      onPress={() => {
                        void handleRequestCode();
                      }}
                      disabled={isRequesting}
                      style={({ pressed }) => [
                        styles.primaryButton,
                        isRequesting && styles.primaryButtonDisabled,
                        pressed && styles.pressed,
                      ]}>
                      {isRequesting ? (
                        <ActivityIndicator color={Colors.light.background} />
                      ) : (
                        <ThemedText style={styles.primaryButtonText}>Войти по коду из email</ThemedText>
                      )}
                    </Pressable>

                    <Pressable
                      onPress={returnToEmailStep}
                      style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
                      <ThemedText style={styles.secondaryButtonText}>Использовать другой email</ThemedText>
                    </Pressable>
                  </>
                ) : null}

                {step === 'unknown' ? (
                  <>
                    <View style={styles.emailRow}>
                      <ThemedText style={styles.emailValue}>{email.trim()}</ThemedText>
                      <Pressable onPress={returnToEmailStep} style={({ pressed }) => [pressed && styles.pressed]}>
                        <ThemedText style={styles.linkButtonText}>Изменить</ThemedText>
                      </Pressable>
                    </View>

                    <ThemedText themeColor="textSecondary" style={styles.subtitle}>
                      Аккаунт с таким email не найден.
                    </ThemedText>

                    {errorMessage ? <ThemedText style={styles.errorText}>{errorMessage}</ThemedText> : null}

                    <Pressable
                      onPress={() => {
                        void handleCreateAccount();
                      }}
                      disabled={isCreatingAccount || !onCreateAccount}
                      style={({ pressed }) => [
                        styles.primaryButton,
                        (isCreatingAccount || !onCreateAccount) && styles.primaryButtonDisabled,
                        pressed && styles.pressed,
                      ]}>
                      {isCreatingAccount ? (
                        <ActivityIndicator color={Colors.light.background} />
                      ) : (
                        <ThemedText style={styles.primaryButtonText}>Создать аккаунт</ThemedText>
                      )}
                    </Pressable>

                    <Pressable
                      onPress={returnToEmailStep}
                      style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
                      <ThemedText style={styles.secondaryButtonText}>Использовать другой email</ThemedText>
                    </Pressable>
                  </>
                ) : null}

                {step === 'otp-code' ? (
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
                      onSubmitEditing={() => {
                        void handleVerifyCode();
                      }}
                    />

                    {errorMessage ? <ThemedText style={styles.errorText}>{errorMessage}</ThemedText> : null}

                    <Pressable
                      onPress={() => {
                        void handleVerifyCode();
                      }}
                      disabled={isVerifying}
                      style={({ pressed }) => [
                        styles.primaryButton,
                        isVerifying && styles.primaryButtonDisabled,
                        pressed && styles.pressed,
                      ]}>
                      {isVerifying ? (
                        <ActivityIndicator color={Colors.light.background} />
                      ) : (
                        <ThemedText style={styles.primaryButtonText}>Войти</ThemedText>
                      )}
                    </Pressable>

                    <Pressable
                      onPress={() => {
                        void handleResendCode();
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
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <ForgotPasswordSheet
        visible={visible && isForgotPasswordVisible}
        confirmAndSwitch={confirmAndSwitch}
        initialEmail={email}
        skipEmailEntry
        onClose={() => setIsForgotPasswordVisible(false)}
        onSuccess={onSuccess}
      />
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  overlayTransparent: {
    backgroundColor: 'transparent',
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
  emailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  emailValue: {
    flex: 1,
    fontSize: 16,
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
  linkButton: {
    alignItems: 'center',
    paddingVertical: Spacing.one,
  },
  linkButtonText: {
    fontSize: 15,
    fontWeight: '500',
    color: Colors.light.text,
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
