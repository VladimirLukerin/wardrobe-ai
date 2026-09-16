import { useCallback, useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
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
import { FAMILY_ROLES, type FamilyRole } from '@/constants/family';
import { Colors, Spacing } from '@/constants/theme';
import { useFamily } from '@/contexts/family-context';
import { findUserById } from '@/services/family-user-search';

type AddMemberMode = 'id' | 'manual';

type AddMemberSheetProps = {
  visible: boolean;
  onClose: () => void;
};

type ChipProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
};

function Chip({ label, selected, onPress }: ChipProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.chipSelected,
        pressed && styles.pressed,
      ]}>
      <ThemedText style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</ThemedText>
    </Pressable>
  );
}

function SegmentButton({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.segment, selected && styles.segmentSelected]}>
      <ThemedText style={[styles.segmentText, selected && styles.segmentTextSelected]}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

export default function AddMemberSheet({ visible, onClose }: AddMemberSheetProps) {
  const insets = useSafeAreaInsets();
  const { addMember } = useFamily();

  const [mode, setMode] = useState<AddMemberMode>('manual');
  const [manualName, setManualName] = useState('');
  const [manualRole, setManualRole] = useState<FamilyRole>('Партнёр');
  const [userId, setUserId] = useState('');
  const [idMessage, setIdMessage] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  const translateY = useSharedValue(0);

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
      setMode('manual');
      setManualName('');
      setManualRole('Партнёр');
      setUserId('');
      setIdMessage(null);
      setIsSearching(false);
      translateY.value = 0;
    }
  }, [visible, translateY]);

  const handleFindUser = async () => {
    const trimmedId = userId.trim();

    if (!trimmedId) {
      return;
    }

    setIsSearching(true);
    setIdMessage(null);

    try {
      const user = await findUserById(trimmedId);

      if (!user) {
        setIdMessage('Поиск по ID будет доступен после подключения аккаунтов.');
      }
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddManual = () => {
    const trimmedName = manualName.trim();

    if (!trimmedName) {
      return;
    }

    addMember({ name: trimmedName, role: manualRole });
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <GestureHandlerRootView style={styles.overlay}>
        <Animated.View
          style={[
            styles.sheet,
            sheetAnimatedStyle,
            { paddingBottom: Math.max(insets.bottom, Spacing.three) },
          ]}>
          <GestureDetector gesture={panGesture}>
            <View style={styles.sheetGrabber}>
              <View style={styles.dragArea}>
                <View style={styles.dragHandle} />
              </View>

              <View style={styles.sheetHeader}>
                <ThemedText style={styles.sheetTitle}>Добавить участника</ThemedText>
                <Pressable
                  onPress={onClose}
                  hitSlop={8}
                  style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}>
                  <ThemedText style={styles.closeButtonText}>×</ThemedText>
                </Pressable>
              </View>

              <View style={styles.segmentedControl}>
                <SegmentButton
                  label="По ID"
                  selected={mode === 'id'}
                  onPress={() => setMode('id')}
                />
                <SegmentButton
                  label="Вручную"
                  selected={mode === 'manual'}
                  onPress={() => setMode('manual')}
                />
              </View>
            </View>
          </GestureDetector>

          <KeyboardAvoidingView
            style={styles.keyboardAvoid}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}>
            <Animated.ScrollView
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled">
              {mode === 'id' ? (
                <View style={styles.modeContent}>
                  <View style={styles.field}>
                    <ThemedText style={styles.fieldLabel}>ID пользователя</ThemedText>
                    <TextInput
                      value={userId}
                      onChangeText={setUserId}
                      style={styles.textInput}
                      placeholder="Введите ID"
                      placeholderTextColor={Colors.light.textSecondary}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>

                  {idMessage && (
                    <View style={styles.infoMessage}>
                      <ThemedText style={styles.infoMessageText}>{idMessage}</ThemedText>
                    </View>
                  )}

                  <Pressable
                    onPress={handleFindUser}
                    disabled={isSearching}
                    style={({ pressed }) => [
                      styles.primaryButton,
                      isSearching && styles.primaryButtonDisabled,
                      pressed && !isSearching && styles.pressed,
                    ]}>
                    <ThemedText style={styles.primaryButtonText}>Найти пользователя</ThemedText>
                  </Pressable>
                </View>
              ) : (
                <View style={styles.modeContent}>
                  <View style={styles.field}>
                    <ThemedText style={styles.fieldLabel}>Имя</ThemedText>
                    <TextInput
                      value={manualName}
                      onChangeText={setManualName}
                      style={styles.textInput}
                      placeholder="Введите имя"
                      placeholderTextColor={Colors.light.textSecondary}
                    />
                  </View>

                  <View style={styles.section}>
                    <ThemedText style={styles.sectionTitle}>Роль в семье</ThemedText>
                    <View style={styles.chipGroup}>
                      {FAMILY_ROLES.map((option) => (
                        <Chip
                          key={option}
                          label={option}
                          selected={manualRole === option}
                          onPress={() => setManualRole(option)}
                        />
                      ))}
                    </View>
                  </View>

                  <Pressable
                    onPress={handleAddManual}
                    style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
                    <ThemedText style={styles.primaryButtonText}>Добавить</ThemedText>
                  </Pressable>
                </View>
              )}
            </Animated.ScrollView>
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
    height: '80%',
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
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: Colors.light.backgroundElement,
    borderRadius: 10,
    padding: Spacing.half,
    marginBottom: Spacing.three,
  },
  segment: {
    flex: 1,
    paddingVertical: Spacing.two,
    borderRadius: 8,
    alignItems: 'center',
  },
  segmentSelected: {
    backgroundColor: Colors.light.background,
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.light.textSecondary,
  },
  segmentTextSelected: {
    color: Colors.light.text,
    fontWeight: '600',
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: Spacing.four,
  },
  modeContent: {
    gap: Spacing.four,
  },
  field: {
    gap: Spacing.one,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
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
  infoMessage: {
    backgroundColor: Colors.light.backgroundElement,
    borderRadius: 10,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  infoMessageText: {
    fontSize: 14,
    lineHeight: 20,
    color: Colors.light.textSecondary,
    textAlign: 'center',
  },
  section: {
    gap: Spacing.three,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
  },
  chipGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: 20,
    backgroundColor: Colors.light.backgroundElement,
  },
  chipSelected: {
    backgroundColor: Colors.light.text,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.light.text,
  },
  chipTextSelected: {
    color: Colors.light.background,
  },
  primaryButton: {
    backgroundColor: Colors.light.text,
    paddingVertical: Spacing.three + 2,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: Spacing.two,
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: Colors.light.background,
    fontSize: 17,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.85,
  },
});
