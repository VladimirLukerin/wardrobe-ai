import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Linking, Modal, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import {
  DEFAULT_STYLIST_PREFERENCES,
  STYLE_EXPERIMENT_LABELS,
  STYLE_EXPERIMENTS,
  WARDROBE_MODE_LABELS,
  WARDROBE_MODES,
  type StylistPreferences,
} from '@/constants/stylist-preferences';
import { Colors, Spacing } from '@/constants/theme';
import { usePreferencesSync } from '@/contexts/preferences-sync-context';
import { useStylistPreferences } from '@/contexts/stylist-preferences-context';
import {
  getDailyStylistReminderPermissionStatus,
  reconcileDailyStylistReminder,
  requestDailyStylistReminderPermission,
  saveDailyStylistReminderEnabled,
} from '@/services/daily-stylist-reminder';
import { loadDailyStylistReminderState } from '@/storage/daily-stylist-reminder-storage';
import { getDeviceTimeZone } from '@/utils/daily-stylist-reminder-plan';

type StylistSettingsSheetProps = {
  visible: boolean;
  onClose: () => void;
};

const SAVE_BUTTON_HEIGHT = 52;
const DAILY_STYLIST_TIME_OPTIONS = ['07:00', '08:00', '09:00', '10:00', '18:00'] as const;
const FLOATING_SAVE_AREA_HEIGHT = Spacing.three + SAVE_BUTTON_HEIGHT + Spacing.two;

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

function SectionTitle({ children }: { children: string }) {
  return <ThemedText style={styles.sectionTitle}>{children}</ThemedText>;
}

type ToggleRowProps = {
  title: string;
  subtitle?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
};

function ToggleRow({ title, subtitle, value, onValueChange }: ToggleRowProps) {
  return (
    <View style={styles.toggleRow}>
      <View style={styles.toggleText}>
        <ThemedText style={styles.toggleTitle}>{title}</ThemedText>
        {subtitle ? (
          <ThemedText themeColor="textSecondary" style={styles.toggleSubtitle}>
            {subtitle}
          </ThemedText>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: Colors.light.backgroundSelected, true: Colors.light.text }}
        thumbColor={Colors.light.background}
      />
    </View>
  );
}

type ModeOptionProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
};

function ModeOption({ label, selected, onPress }: ModeOptionProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.modeOption,
        selected && styles.modeOptionSelected,
        pressed && styles.pressed,
      ]}>
      <ThemedText style={[styles.modeOptionText, selected && styles.modeOptionTextSelected]}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

export default function StylistSettingsSheet({ visible, onClose }: StylistSettingsSheetProps) {
  const insets = useSafeAreaInsets();
  const {
    setStylistPreferences,
    isHydrated,
    considerWeather,
    styleExperiment,
    wardrobeMode,
    avoidRepeatedOutfits,
    dailyStylistEnabled,
    dailyStylistTime,
    timezone,
  } = useStylistPreferences();
  const { queuePreferencesSync } = usePreferencesSync();

  const [draft, setDraft] = useState<StylistPreferences>(DEFAULT_STYLIST_PREFERENCES);
  const [draftReminderEnabled, setDraftReminderEnabled] = useState(false);
  const [reminderMessage, setReminderMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const wasVisibleRef = useRef(false);

  const translateY = useSharedValue(0);
  const bottomInset = Math.max(insets.bottom, Spacing.three);
  const scrollBottomPadding = FLOATING_SAVE_AREA_HEIGHT + bottomInset;

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
      wasVisibleRef.current = false;
      return;
    }

    if (!isHydrated || wasVisibleRef.current) {
      return;
    }

    wasVisibleRef.current = true;
    void loadDailyStylistReminderState().then((reminderState) => {
      setDraftReminderEnabled(reminderState.dailyStylistReminderEnabled);
    });
    setDraft({
      considerWeather,
      styleExperiment,
      wardrobeMode,
      avoidRepeatedOutfits,
      dailyStylistEnabled,
      dailyStylistTime,
      timezone,
    });
    setReminderMessage(null);
  }, [
    visible,
    isHydrated,
    considerWeather,
    styleExperiment,
    wardrobeMode,
    avoidRepeatedOutfits,
    dailyStylistEnabled,
    dailyStylistTime,
    timezone,
    translateY,
  ]);

  const showPermissionDeniedAlert = useCallback(() => {
    Alert.alert(
      'Уведомления недоступны',
      'Уведомления отключены в настройках устройства.',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Открыть настройки',
          onPress: () => {
            void Linking.openSettings();
          },
        },
      ],
    );
  }, []);

  const handleReminderToggle = useCallback(
    async (value: boolean) => {
      setReminderMessage(null);

      if (!value) {
        setDraftReminderEnabled(false);
        return;
      }

      if (!draft.dailyStylistEnabled) {
        return;
      }

      const currentStatus = await getDailyStylistReminderPermissionStatus();

      if (currentStatus === 'denied') {
        setDraftReminderEnabled(false);
        setReminderMessage('Уведомления отключены в настройках устройства.');
        showPermissionDeniedAlert();
        return;
      }

      const permissionResult =
        currentStatus === 'granted'
          ? { status: 'granted' as const }
          : await requestDailyStylistReminderPermission();

      if (permissionResult.status !== 'granted') {
        setDraftReminderEnabled(false);
        setReminderMessage('Уведомления отключены в настройках устройства.');
        showPermissionDeniedAlert();
        return;
      }

      setDraftReminderEnabled(true);
    },
    [draft.dailyStylistEnabled, showPermissionDeniedAlert],
  );

  const handleSave = async () => {
    if (isSaving) {
      return;
    }

    setIsSaving(true);

    try {
      const deviceTimeZone = getDeviceTimeZone();
      const nextPreferences: StylistPreferences = {
        ...draft,
        timezone: deviceTimeZone ?? draft.timezone,
      };

      if (!nextPreferences.dailyStylistEnabled) {
        setDraftReminderEnabled(false);
      }

      setStylistPreferences(nextPreferences);
      await saveDailyStylistReminderEnabled(
        nextPreferences.dailyStylistEnabled && draftReminderEnabled,
      );

      const reconcileResult = await reconcileDailyStylistReminder({
        stylistPreferences: nextPreferences,
      });

      queuePreferencesSync();

      if (
        draftReminderEnabled &&
        nextPreferences.dailyStylistEnabled &&
        !reconcileResult.state.dailyStylistReminderEnabled
      ) {
        setDraftReminderEnabled(false);
        setReminderMessage('Не удалось включить напоминание на этом устройстве.');
        return;
      }

      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const deviceTimeZoneLabel = getDeviceTimeZone() ?? draft.timezone;

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
                <ThemedText style={styles.sheetTitle}>Настройки стилиста</ThemedText>
                <Pressable
                  onPress={onClose}
                  hitSlop={8}
                  style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}>
                  <ThemedText style={styles.closeButtonText}>×</ThemedText>
                </Pressable>
              </View>
            </View>
          </GestureDetector>

          <View style={styles.sheetBody}>
            <ScrollView
              style={styles.scrollView}
              contentContainerStyle={[styles.scrollContent, { paddingBottom: scrollBottomPadding }]}
              showsVerticalScrollIndicator={false}>
              <View style={styles.formContent}>
                <View style={styles.section}>
                  <SectionTitle>ПОГОДА</SectionTitle>
                  <ToggleRow
                    title="Учитывать погоду при подборе"
                    subtitle="Стилист будет учитывать температуру и погодные условия."
                    value={draft.considerWeather}
                    onValueChange={(value) =>
                      setDraft((current) => ({ ...current, considerWeather: value }))
                    }
                  />
                </View>

                <View style={styles.section}>
                  <SectionTitle>ЭКСПЕРИМЕНТЫ СО СТИЛЕМ</SectionTitle>
                  <ThemedText themeColor="textSecondary" style={styles.sectionHint}>
                    Насколько сильно стилист может отходить от ваших привычных предпочтений?
                  </ThemedText>
                  <View style={styles.chipGroup}>
                    {STYLE_EXPERIMENTS.map((option) => (
                      <Chip
                        key={option}
                        label={STYLE_EXPERIMENT_LABELS[option]}
                        selected={draft.styleExperiment === option}
                        onPress={() =>
                          setDraft((current) => ({ ...current, styleExperiment: option }))
                        }
                      />
                    ))}
                  </View>
                </View>

                <View style={styles.section}>
                  <SectionTitle>ГАРДЕРОБ</SectionTitle>
                  <View style={styles.modeOptions}>
                    {WARDROBE_MODES.map((option) => (
                      <ModeOption
                        key={option}
                        label={WARDROBE_MODE_LABELS[option]}
                        selected={draft.wardrobeMode === option}
                        onPress={() =>
                          setDraft((current) => ({ ...current, wardrobeMode: option }))
                        }
                      />
                    ))}
                  </View>
                </View>

                <View style={styles.section}>
                  <SectionTitle>ОБРАЗ НА КАЖДЫЙ ДЕНЬ</SectionTitle>
                  <ToggleRow
                    title="Образ на каждый день"
                    subtitle="Стилист будет подбирать отдельный образ на каждый день."
                    value={draft.dailyStylistEnabled}
                    onValueChange={(value) => {
                      setDraft((current) => ({ ...current, dailyStylistEnabled: value }));

                      if (!value) {
                        setDraftReminderEnabled(false);
                        setReminderMessage(null);
                      }
                    }}
                  />
                  {draft.dailyStylistEnabled ? (
                    <>
                      <ToggleRow
                        title="Напоминать об образе"
                        subtitle="Уведомим в выбранное время на этом устройстве."
                        value={draftReminderEnabled}
                        onValueChange={(value) => {
                          void handleReminderToggle(value);
                        }}
                      />
                      {reminderMessage ? (
                        <ThemedText themeColor="textSecondary" style={styles.reminderMessage}>
                          {reminderMessage}
                        </ThemedText>
                      ) : null}
                    </>
                  ) : null}
                  <ThemedText themeColor="textSecondary" style={styles.sectionHint}>
                    Время рекомендации
                  </ThemedText>
                  <View style={styles.chipGroup}>
                    {DAILY_STYLIST_TIME_OPTIONS.map((option) => (
                      <Chip
                        key={option}
                        label={option}
                        selected={draft.dailyStylistTime === option}
                        onPress={() =>
                          setDraft((current) => ({ ...current, dailyStylistTime: option }))
                        }
                      />
                    ))}
                  </View>
                  <ThemedText themeColor="textSecondary" style={styles.sectionHint}>
                    Часовой пояс устройства
                  </ThemedText>
                  <View style={styles.timezoneReadOnly}>
                    <ThemedText style={styles.timezoneReadOnlyText}>{deviceTimeZoneLabel}</ThemedText>
                  </View>
                </View>

                <View style={styles.section}>
                  <SectionTitle>РАЗНООБРАЗИЕ</SectionTitle>
                  <ToggleRow
                    title="Не повторять одни и те же образы"
                    subtitle="По возможности стилист будет чаще использовать разные сочетания вещей."
                    value={draft.avoidRepeatedOutfits}
                    onValueChange={(value) =>
                      setDraft((current) => ({ ...current, avoidRepeatedOutfits: value }))
                    }
                  />
                </View>
              </View>
            </ScrollView>

            <View style={[styles.floatingSaveArea, { paddingBottom: bottomInset }]}>
              <Pressable
                onPress={() => {
                  void handleSave();
                }}
                disabled={isSaving}
                style={({ pressed }) => [
                  styles.primaryButton,
                  pressed && styles.pressed,
                  isSaving && styles.primaryButtonDisabled,
                ]}>
                <ThemedText style={styles.primaryButtonText}>Сохранить</ThemedText>
              </Pressable>
            </View>
          </View>
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
  sheetBody: {
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
    gap: Spacing.three,
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
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  toggleText: {
    flex: 1,
    gap: Spacing.one,
  },
  toggleTitle: {
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 22,
    color: Colors.light.text,
  },
  toggleSubtitle: {
    fontSize: 14,
    lineHeight: 20,
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
  modeOptions: {
    gap: Spacing.two,
  },
  modeOption: {
    minHeight: 52,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.light.backgroundSelected,
    backgroundColor: Colors.light.backgroundElement,
    justifyContent: 'center',
  },
  modeOptionSelected: {
    backgroundColor: Colors.light.text,
    borderColor: Colors.light.text,
  },
  modeOptionText: {
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 20,
    color: Colors.light.text,
  },
  modeOptionTextSelected: {
    color: Colors.light.background,
  },
  timezoneReadOnly: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.light.backgroundSelected,
    paddingHorizontal: Spacing.three,
    justifyContent: 'center',
    backgroundColor: Colors.light.backgroundElement,
  },
  timezoneReadOnlyText: {
    fontSize: 16,
    color: Colors.light.text,
  },
  reminderMessage: {
    fontSize: 14,
    lineHeight: 20,
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  timezoneInput: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.light.backgroundSelected,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
    color: Colors.light.text,
    backgroundColor: Colors.light.backgroundElement,
  },
  floatingSaveArea: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: Spacing.three,
    backgroundColor: Colors.light.background,
  },
  primaryButton: {
    backgroundColor: Colors.light.text,
    minHeight: SAVE_BUTTON_HEIGHT,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
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
