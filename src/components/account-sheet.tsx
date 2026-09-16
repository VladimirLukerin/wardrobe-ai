import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import { useAccountProfile } from '@/contexts/account-profile-context';
import { copyToClipboard } from '@/utils/copy-to-clipboard';

type AccountSheetProps = {
  visible: boolean;
  onClose: () => void;
};

function SectionTitle({ children }: { children: string }) {
  return <ThemedText style={styles.sectionTitle}>{children}</ThemedText>;
}

type ActionRowProps = {
  label: string;
  destructive?: boolean;
  isLast?: boolean;
  onPress: () => void;
};

function ActionRow({ label, destructive = false, isLast = false, onPress }: ActionRowProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionRow,
        isLast && styles.actionRowLast,
        pressed && styles.pressed,
      ]}>
      <ThemedText style={[styles.actionRowLabel, destructive && styles.actionRowLabelDestructive]}>
        {label}
      </ThemedText>
      <SymbolView
        name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
        size={12}
        tintColor={destructive ? '#DC2626' : Colors.light.textSecondary}
      />
    </Pressable>
  );
}

export default function AccountSheet({ visible, onClose }: AccountSheetProps) {
  const insets = useSafeAreaInsets();
  const { localUserId, displayName, setDisplayName, isHydrated } = useAccountProfile();

  const [isEditingName, setIsEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(displayName);
  const [isCopying, setIsCopying] = useState(false);

  const translateY = useSharedValue(0);
  const bottomInset = Math.max(insets.bottom, Spacing.three);

  const handleDismiss = useCallback(() => {
    translateY.value = 0;
    onClose();
  }, [onClose, translateY]);

  const panGesture = Gesture.Pan()
    .activeOffsetY(10)
    .failOffsetX([-24, 24])
    .onUpdate((event) => {
      if (event.translationY > 0) {
        translateY.value = event.translationY;
      }
    })
    .onEnd((event) => {
      if (event.translationY > 72 || event.velocityY > 450) {
        runOnJS(handleDismiss)();
        return;
      }

      translateY.value = withSpring(0);
    });

  const sheetAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  useEffect(() => {
    if (!visible) {
      translateY.value = 0;
      setIsEditingName(false);
      setIsCopying(false);
      return;
    }

    if (isHydrated) {
      setNameDraft(displayName);
    }
  }, [visible, isHydrated, displayName, translateY]);

  const handleCopyId = async () => {
    if (!localUserId || isCopying) {
      return;
    }

    setIsCopying(true);

    const copied = await copyToClipboard(localUserId);

    setIsCopying(false);

    if (copied) {
      Alert.alert('Скопировано', 'ID пользователя скопирован в буфер обмена.');
      return;
    }

    Alert.alert('Не удалось скопировать', `Ваш ID: ${localUserId}`);
  };

  const handleStartEditingName = () => {
    setNameDraft(displayName);
    setIsEditingName(true);
  };

  const handleSaveName = () => {
    const trimmedName = nameDraft.trim();

    if (!trimmedName) {
      return;
    }

    setDisplayName(trimmedName);
    setIsEditingName(false);
  };

  const handleConnectAccount = () => {
    Alert.alert('Подключить аккаунт', 'Авторизация будет доступна позже.');
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Удалить аккаунт',
      'Удаление аккаунта будет доступно после подключения серверного аккаунта.',
      [{ text: 'Понятно' }],
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <GestureHandlerRootView style={styles.overlay}>
        <Animated.View style={[styles.sheet, sheetAnimatedStyle]}>
          <GestureDetector gesture={panGesture}>
            <View style={styles.sheetGrabber}>
              <View style={styles.dragArea}>
                <View style={styles.dragHandle} />
              </View>

              <View style={styles.sheetHeader}>
                <ThemedText style={styles.sheetTitle}>Аккаунт</ThemedText>
                <Pressable
                  onPress={onClose}
                  hitSlop={8}
                  style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}>
                  <ThemedText style={styles.closeButtonText}>×</ThemedText>
                </Pressable>
              </View>
            </View>
          </GestureDetector>

          <KeyboardAvoidingView
            style={styles.keyboardAvoid}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}>
            <ScrollView
              style={styles.scrollView}
              contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomInset }]}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled">
              <View style={styles.formContent}>
                <View style={styles.section}>
                  <SectionTitle>ID ПОЛЬЗОВАТЕЛЯ</SectionTitle>
                  <View style={styles.idRow}>
                    <ThemedText style={styles.idValue}>{localUserId || '—'}</ThemedText>
                    <Pressable
                      onPress={() => {
                        void handleCopyId();
                      }}
                      disabled={!localUserId || isCopying}
                      style={({ pressed }) => [
                        styles.copyButton,
                        (!localUserId || isCopying) && styles.copyButtonDisabled,
                        pressed && styles.pressed,
                      ]}>
                      <SymbolView
                        name={{
                          ios: 'doc.on.doc',
                          android: 'content_copy',
                          web: 'content_copy',
                        }}
                        size={14}
                        tintColor={Colors.light.text}
                      />
                      <ThemedText style={styles.copyButtonText}>Копировать</ThemedText>
                    </Pressable>
                  </View>
                </View>

                <View style={styles.section}>
                  <SectionTitle>ИМЯ</SectionTitle>
                  {isEditingName ? (
                    <View style={styles.nameEditBlock}>
                      <TextInput
                        value={nameDraft}
                        onChangeText={setNameDraft}
                        style={styles.textInput}
                        placeholder="Имя"
                        placeholderTextColor={Colors.light.textSecondary}
                        autoFocus
                        returnKeyType="done"
                        onSubmitEditing={handleSaveName}
                        maxLength={40}
                      />
                      <Pressable
                        onPress={handleSaveName}
                        style={({ pressed }) => [styles.nameSaveButton, pressed && styles.pressed]}>
                        <ThemedText style={styles.nameSaveButtonText}>Готово</ThemedText>
                      </Pressable>
                    </View>
                  ) : (
                    <View style={styles.nameRow}>
                      <ThemedText style={styles.nameValue}>{displayName}</ThemedText>
                      <Pressable
                        onPress={handleStartEditingName}
                        hitSlop={8}
                        style={({ pressed }) => [styles.editButton, pressed && styles.pressed]}>
                        <ThemedText style={styles.editButtonText}>Изменить</ThemedText>
                      </Pressable>
                    </View>
                  )}
                </View>

                <View style={styles.section}>
                  <SectionTitle>СПОСОБ ВХОДА</SectionTitle>
                  <ThemedText style={styles.staticValue}>Не подключён</ThemedText>
                  <ThemedText themeColor="textSecondary" style={styles.sectionHint}>
                    Вход через Apple, Google или email будет добавлен позже.
                  </ThemedText>
                </View>

                <View style={styles.section}>
                  <SectionTitle>УПРАВЛЕНИЕ АККАУНТОМ</SectionTitle>
                  <View style={styles.actionGroup}>
                    <ActionRow label="Подключить аккаунт" onPress={handleConnectAccount} />
                    <ActionRow
                      label="Удалить аккаунт"
                      destructive
                      isLast
                      onPress={handleDeleteAccount}
                    />
                  </View>
                </View>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  sheet: {
    height: '75%',
    backgroundColor: Colors.light.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: Spacing.four,
  },
  sheetGrabber: {
    alignSelf: 'stretch',
  },
  dragArea: {
    alignItems: 'center',
    paddingTop: Spacing.two,
    paddingBottom: Spacing.two,
  },
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.light.backgroundSelected,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.three,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
  },
  closeButton: {
    position: 'absolute',
    right: 0,
    top: -Spacing.one,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    fontSize: 28,
    lineHeight: 28,
    color: Colors.light.textSecondary,
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  formContent: {
    gap: Spacing.five,
  },
  section: {
    gap: Spacing.two,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.6,
    color: Colors.light.text,
  },
  sectionHint: {
    fontSize: 14,
    lineHeight: 20,
  },
  idRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  idValue: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    lineHeight: 24,
    color: Colors.light.text,
    letterSpacing: 0.4,
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one + 2,
    borderRadius: 10,
    backgroundColor: Colors.light.backgroundElement,
  },
  copyButtonDisabled: {
    opacity: 0.5,
  },
  copyButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.light.text,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  nameValue: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 22,
    color: Colors.light.text,
  },
  editButton: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.one,
  },
  editButtonText: {
    fontSize: 15,
    fontWeight: '500',
    color: Colors.light.textSecondary,
  },
  nameEditBlock: {
    gap: Spacing.two,
  },
  textInput: {
    backgroundColor: Colors.light.backgroundElement,
    borderRadius: 14,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontSize: 16,
    color: Colors.light.text,
  },
  nameSaveButton: {
    alignSelf: 'flex-start',
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.one,
  },
  nameSaveButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.light.text,
  },
  staticValue: {
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 22,
    color: Colors.light.text,
  },
  actionGroup: {
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.light.backgroundSelected,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
    paddingHorizontal: Spacing.three,
    backgroundColor: Colors.light.backgroundElement,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.light.backgroundSelected,
  },
  actionRowLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: Colors.light.text,
  },
  actionRowLabelDestructive: {
    color: '#DC2626',
  },
  actionRowLast: {
    borderBottomWidth: 0,
  },
  pressed: {
    opacity: 0.85,
  },
});
