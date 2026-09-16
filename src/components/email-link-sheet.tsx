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

import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import { useAccount } from '@/contexts/account-context';
import { AccountApiError } from '@/services/account';
import { requestEmailLinkCode, verifyEmailLinkCode } from '@/services/email-auth';

type EmailLinkSheetProps = {
  visible: boolean;
  onClose: () => void;
};

type Step = 'email' | 'code';

function resolveRequestError(error: unknown): string {
  if (error instanceof AccountApiError) {
    if (error.status === 0) {
      return 'Не удалось подключиться к серверу';
    }

    if (error.code === 'EMAIL_ALREADY_VERIFIED') {
      return 'Email уже подключён';
    }

    if (error.code === 'EMAIL_ALREADY_IN_USE') {
      return 'Этот email уже привязан к другому аккаунту';
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

    if (error.code === 'EMAIL_ALREADY_IN_USE') {
      return 'Этот email уже привязан к другому аккаунту';
    }

    return error.message;
  }

  return 'Не удалось подтвердить код';
}

export default function EmailLinkSheet({ visible, onClose }: EmailLinkSheetProps) {
  const insets = useSafeAreaInsets();
  const { applyAuthenticatedUser } = useAccount();

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [resendAfterSeconds, setResendAfterSeconds] = useState(0);
  const [isRequesting, setIsRequesting] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const bottomInset = Math.max(insets.bottom, Spacing.three);

  const resetState = useCallback(() => {
    setStep('email');
    setEmail('');
    setCode('');
    setChallengeId(null);
    setResendAfterSeconds(0);
    setIsRequesting(false);
    setIsVerifying(false);
    setErrorMessage(null);
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

  const handleRequestCode = async () => {
    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      setErrorMessage('Введите email');
      return;
    }

    setIsRequesting(true);
    setErrorMessage(null);

    try {
      const response = await requestEmailLinkCode(trimmedEmail);
      setChallengeId(response.challengeId);
      setResendAfterSeconds(response.resendAfterSeconds);
      setStep('code');
      setCode('');
    } catch (error) {
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
      const response = await verifyEmailLinkCode({
        challengeId,
        code: trimmedCode,
      });

      applyAuthenticatedUser(response.user);
      onClose();
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

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <KeyboardAvoidingView
          style={styles.keyboardAvoid}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}>
          <View style={[styles.sheet, { paddingBottom: bottomInset }]}>
            <View style={styles.header}>
              <ThemedText style={styles.title}>Подключить email</ThemedText>
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
                    Email поможет восстановить аккаунт на другом устройстве.
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

                  {errorMessage ? (
                    <ThemedText style={styles.errorText}>{errorMessage}</ThemedText>
                  ) : null}

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
                      <ThemedText style={styles.primaryButtonText}>Получить код</ThemedText>
                    )}
                  </Pressable>
                </>
              ) : (
                <>
                  <ThemedText themeColor="textSecondary" style={styles.subtitle}>
                    Код отправлен на {email.trim()}
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

                  {errorMessage ? (
                    <ThemedText style={styles.errorText}>{errorMessage}</ThemedText>
                  ) : null}

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
                      <ThemedText style={styles.primaryButtonText}>Подтвердить</ThemedText>
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
              )}
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
    maxHeight: '70%',
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
