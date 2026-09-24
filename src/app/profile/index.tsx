import { SymbolView } from 'expo-symbols';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import AccountLoginChoiceSheet from '@/components/account-login-choice-sheet';
import AccountSaveSheet from '@/components/account-save-sheet';
import AccountSheet from '@/components/account-sheet';
import AddMemberSheet from '@/components/add-member-sheet';
import BodyParametersSheet from '@/components/body-parameters-sheet';
import { NetworkErrorState } from '@/components/network-error-state';
import {
  PrikinBrandHeader,
  PrikinHandwritten,
} from '@/components/prikin/prikin-brand-header';
import { PrikinPrimaryButton } from '@/components/prikin/prikin-primary-button';
import StylistSettingsSheet from '@/components/stylist-settings-sheet';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { getFamilyMemberLabel } from '@/constants/family';
import {
  PrikinColors,
  PrikinRadii,
  PrikinSpacing,
  PrikinTypography,
} from '@/constants/prikin-tokens';
import { MaxContentWidth, Spacing, TabScreenScrollPadding } from '@/constants/theme';
import { useAccount } from '@/contexts/account-context';
import { useAccountProfile } from '@/contexts/account-profile-context';
import { useFamily } from '@/contexts/family-context';
import { useHomeDailyData } from '@/contexts/home-daily-content-context';
import { useOutfits } from '@/contexts/outfits-context';
import { useOutfitsSync } from '@/contexts/outfits-sync-context';
import { usePreferencesSync } from '@/contexts/preferences-sync-context';
import { useStylistPreferences } from '@/contexts/stylist-preferences-context';
import { useStylePreferences } from '@/contexts/style-preferences-context';
import { useWearHistory } from '@/contexts/wear-history-context';
import { useWearHistorySync } from '@/contexts/wear-history-sync-context';
import { useWardrobe } from '@/contexts/wardrobe-context';
import { useWardrobeSync } from '@/contexts/wardrobe-sync-context';
import { AccountApiError } from '@/services/account';
import { assessLocalAccountState } from '@/services/account-switch';
import {
  DevGenerateDailyOutfitError,
  generateDevDailyOutfitForToday,
} from '@/services/dev-generate-daily-outfit';
import {
  getDailyStylistReminderPermissionStatus,
  requestDailyStylistReminderPermission,
  scheduleDailyStylistDevTestNotification,
} from '@/services/daily-stylist-reminder';
import { refreshDevTestData } from '@/services/dev-refresh-test-data';
import { restoreDevTestDataFromServer } from '@/services/dev-server-restore';
import { isAccountProtected } from '@/utils/account-is-protected';
import { isRetryableNetworkError, NETWORK_ERROR_HINT, NETWORK_ERROR_TITLE } from '@/utils/network-error';
import { getLocalCalendarDateKeyForTimezone } from '@/utils/wear-date';

const LOGOUT_TITLE = 'Выйти из профиля?';

const MINI_AVATAR_SIZE = 48;
const FAMILY_ROW_HEIGHT = MINI_AVATAR_SIZE + Spacing.one + 16;
const AVATAR_SIZE = 88;
const STYLE_ICON_SIZE = 40;

const MY_STYLE_ICONS = [
  { ios: 'tshirt', android: 'checkroom', web: 'checkroom' },
  { ios: 'figure.stand', android: 'accessibility', web: 'accessibility' },
  { ios: 'shoeprints.fill', android: 'hiking', web: 'hiking' },
] as const;

type SymbolIconName = { ios: string; android: string; web: string };

function getInitial(name: string) {
  return name.trim().charAt(0).toUpperCase();
}

function ProfileSettingsRow({
  title,
  subtitle,
  icon,
  onPress,
  isFirst,
}: {
  title: string;
  subtitle: string;
  icon: SymbolIconName;
  onPress: () => void;
  isFirst?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.settingsRow,
        !isFirst && styles.settingsRowBorder,
        pressed && styles.pressed,
      ]}>
      <View style={styles.settingsIconCircle}>
        <SymbolView
          name={{
            ios: icon.ios as 'person',
            android: icon.android as 'person',
            web: icon.web as 'person',
          }}
          size={20}
          tintColor={PrikinColors.textPrimary}
        />
      </View>
      <View style={styles.settingsRowContent}>
        <Text style={styles.settingsTitle}>{title}</Text>
        <Text style={styles.settingsSubtitle}>{subtitle}</Text>
      </View>
      <SymbolView
        name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
        size={14}
        tintColor={PrikinColors.textSecondary}
      />
    </Pressable>
  );
}

export default function ProfileScreen() {
  const [isAddMemberSheetVisible, setIsAddMemberSheetVisible] = useState(false);
  const [isBodyParametersSheetVisible, setIsBodyParametersSheetVisible] = useState(false);
  const [isStylistSettingsSheetVisible, setIsStylistSettingsSheetVisible] = useState(false);
  const [isAccountSheetVisible, setIsAccountSheetVisible] = useState(false);
  const [isSaveAccountVisible, setIsSaveAccountVisible] = useState(false);
  const [isLoginChoiceVisible, setIsLoginChoiceVisible] = useState(false);
  const [isDevRefreshInProgress, setIsDevRefreshInProgress] = useState(false);
  const [isDevServerRestoreInProgress, setIsDevServerRestoreInProgress] = useState(false);
  const [isDevDailyGenerateInProgress, setIsDevDailyGenerateInProgress] = useState(false);
  const [isDevDailyNotificationTestInProgress, setIsDevDailyNotificationTestInProgress] =
    useState(false);
  const { user, logoutFromProfile, devResetTestAccount, isServerAccount } = useAccount();
  const { displayName } = useAccountProfile();
  const { status: preferencesSyncStatus } = usePreferencesSync();
  const { status: wardrobeSyncStatus, runWardrobeSync } = useWardrobeSync();
  const { status: outfitsSyncStatus, runOutfitsSync } = useOutfitsSync();
  const { status: wearHistorySyncStatus, runWearHistorySync } = useWearHistorySync();
  const { resetForDevServerRestore: resetWardrobeForDevServerRestore, items: wardrobeItems } =
    useWardrobe();
  const { resetForDevServerRestore: resetOutfitsForDevServerRestore } = useOutfits();
  const { resetForDevServerRestore: resetWearHistoryForDevServerRestore } = useWearHistory();
  const { styles: preferredStyles, colors: preferredColors, hasStylePreferences } =
    useStylePreferences();
  const { timezone } = useStylistPreferences();
  const { refreshDailyContent } = useHomeDailyData();
  const localDate = useMemo(() => getLocalCalendarDateKeyForTimezone(timezone), [timezone]);
  const {
    members,
    incomingInvites,
    outgoingInvites,
    pendingIncomingCount,
    status,
    error,
    errorKind,
    refreshFamily,
    refreshFamilyIfStale,
    acceptInvite,
    rejectInvite,
  } = useFamily();
  const isProtected = isAccountProtected(user);
  useFocusEffect(
    useCallback(() => {
      void refreshFamilyIfStale();
    }, [refreshFamilyIfStale]),
  );

  const handleInviteAction = async (action: () => Promise<void>) => {
    try {
      await action();
    } catch (actionError) {
      const message =
        actionError instanceof AccountApiError
          ? actionError.message
          : 'Не удалось обработать приглашение';

      Alert.alert('Ошибка', message);
    }
  };

  const handleLogoutPress = async () => {
    const assessment = await assessLocalAccountState();
    const hasPendingSync =
      preferencesSyncStatus === 'pending' ||
      wardrobeSyncStatus === 'pending' ||
      outfitsSyncStatus === 'pending' ||
      wearHistorySyncStatus === 'pending' ||
      assessment.hasPendingSyncMetadata;

    const messageParts: string[] = [];

    if (!isAccountProtected(user)) {
      messageParts.push(
        'Без подтверждённого email или телефона восстановить этот аккаунт после выхода будет невозможно.',
      );
    }

    if (hasPendingSync) {
      messageParts.push('Есть несинхронизированные изменения.');
    }

    messageParts.push('Вы вернётесь на экран входа. Локальные данные этого профиля будут удалены с устройства.');

    Alert.alert(LOGOUT_TITLE, messageParts.join('\n\n'), [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Выйти',
        style: 'destructive',
        onPress: () => {
          void logoutFromProfile();
        },
      },
    ]);
  };

  const handleDevResetPress = () => {
    Alert.alert(
      'Сбросить тестовый аккаунт?',
      'Локальные данные, onboarding и session будут удалены с устройства. Серверные данные не затрагиваются.',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Сбросить',
          style: 'destructive',
          onPress: () => {
            void devResetTestAccount();
          },
        },
      ],
    );
  };

  const handleDevRefreshPress = () => {
    Alert.alert(
      'Обновить тестовые данные?',
      'Локальный sync cache будет сброшен, данные подтянутся с сервера. Auth и серверные данные не затрагиваются.',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Обновить',
          onPress: () => {
            void (async () => {
              setIsDevRefreshInProgress(true);

              try {
                await refreshDevTestData({
                  runWardrobeSync,
                  runOutfitsSync,
                  runWearHistorySync,
                });
              } catch (error) {
                Alert.alert(
                  'Не удалось обновить',
                  error instanceof Error ? error.message : 'Попробуйте ещё раз.',
                );
              } finally {
                setIsDevRefreshInProgress(false);
              }
            })();
          },
        },
      ],
    );
  };

  const handleDevGenerateDailyPress = () => {
    void (async () => {
      if (isDevDailyGenerateInProgress) {
        return;
      }

      setIsDevDailyGenerateInProgress(true);

      try {
        await generateDevDailyOutfitForToday({
          isServerAccount,
          localDate,
          wardrobeItemCount: wardrobeItems.length,
        });
        console.log('[DEV DAILY] refresh home');
        refreshDailyContent();
        Alert.alert('Образ на сегодня создан');
      } catch (error) {
        if (isRetryableNetworkError(error)) {
          Alert.alert(NETWORK_ERROR_TITLE, NETWORK_ERROR_HINT);
          return;
        }

        if (error instanceof AccountApiError || error instanceof DevGenerateDailyOutfitError) {
          Alert.alert('Не удалось создать образ', error.message);
          return;
        }

        Alert.alert(
          'Не удалось создать образ',
          error instanceof Error ? error.message : 'Попробуйте ещё раз.',
        );
      } finally {
        setIsDevDailyGenerateInProgress(false);
      }
    })();
  };

  const handleDevNotificationTestPress = () => {
    void (async () => {
      if (isDevDailyNotificationTestInProgress) {
        return;
      }

      setIsDevDailyNotificationTestInProgress(true);

      try {
        const permissionStatus = await getDailyStylistReminderPermissionStatus();

        if (permissionStatus === 'undetermined') {
          const permissionResult = await requestDailyStylistReminderPermission();

          if (permissionResult.status !== 'granted') {
            Alert.alert(
              'Уведомления недоступны',
              'Уведомления отключены в настройках устройства.',
            );
            return;
          }
        } else if (permissionStatus === 'denied') {
          Alert.alert(
            'Уведомления недоступны',
            'Уведомления отключены в настройках устройства.',
          );
          return;
        }

        const result = await scheduleDailyStylistDevTestNotification();

        if (!result.ok) {
          Alert.alert('Не удалось запланировать тестовое уведомление');
          return;
        }

        Alert.alert('Тестовое уведомление через 5 секунд');
      } finally {
        setIsDevDailyNotificationTestInProgress(false);
      }
    })();
  };

  const handleDevServerRestorePress = () => {
    Alert.alert(
      'Восстановить тестовые данные с сервера?',
      'Локальный тестовый гардероб, образы и история будут заменены данными сервера.',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Восстановить',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setIsDevServerRestoreInProgress(true);

              try {
                await restoreDevTestDataFromServer({
                  resetWardrobeForDevServerRestore,
                  resetOutfitsForDevServerRestore,
                  resetWearHistoryForDevServerRestore,
                  runWardrobeSync,
                  runOutfitsSync,
                  runWearHistorySync,
                });
              } catch (error) {
                Alert.alert(
                  'Не удалось восстановить',
                  error instanceof Error ? error.message : 'Попробуйте ещё раз.',
                );
              } finally {
                setIsDevServerRestoreInProgress(false);
              }
            })();
          },
        },
      ],
    );
  };

  const displayedStyles = preferredStyles.slice(0, 3).join('   ');

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          <PrikinBrandHeader />

          <Text style={styles.screenTitle}>Профиль</Text>
          <PrikinHandwritten style={styles.tagline}>Всё о тебе</PrikinHandwritten>

          <View style={styles.heroSection}>
            {isProtected ? (
              <View style={styles.userBlock}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarLetter}>{getInitial(displayName)}</Text>
                </View>
                <Text style={styles.userName}>{displayName}</Text>
              </View>
            ) : (
              <View style={styles.guestBlock}>
                <View style={styles.guestAvatar}>
                  <SymbolView
                    name={{ ios: 'person', android: 'person', web: 'person' }}
                    size={36}
                    tintColor={PrikinColors.textSecondary}
                    weight="regular"
                  />
                </View>
                <Text style={styles.guestTitle}>Давай знакомиться</Text>
                <Text style={styles.guestSubtitle}>Настроим всё под тебя</Text>
                <PrikinPrimaryButton
                  label="Войти"
                  variant="outline"
                  onPress={() => setIsLoginChoiceVisible(true)}
                  style={styles.guestLoginButton}
                />
                <Pressable
                  onPress={() => setIsSaveAccountVisible(true)}
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.guestSaveLink, pressed && styles.pressed]}>
                  <Text style={styles.guestSaveLinkText}>Сохранить аккаунт</Text>
                </Pressable>
              </View>
            )}
          </View>

          <>
              <Pressable
                onPress={() => router.push('/profile/my-style')}
                accessibilityRole="button"
                style={({ pressed }) => [styles.myStyleCard, pressed && styles.pressed]}>
                <View style={styles.myStyleHeader}>
                  <Text style={styles.cardTitle}>Мой стиль</Text>
                  <SymbolView
                    name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
                    size={14}
                    tintColor={PrikinColors.textSecondary}
                  />
                </View>

                <View style={styles.myStyleIconRow}>
                  {MY_STYLE_ICONS.map((icon) => (
                    <View key={icon.ios} style={styles.myStyleIconCircle}>
                      <SymbolView
                        name={{
                          ios: icon.ios as 'tshirt',
                          android: icon.android as 'checkroom',
                          web: icon.web as 'checkroom',
                        }}
                        size={20}
                        tintColor={PrikinColors.textPrimary}
                      />
                    </View>
                  ))}
                </View>

                {hasStylePreferences ? (
                  <View style={styles.myStyleContent}>
                    {preferredStyles.length > 0 && (
                      <Text style={styles.myStyleValues}>{displayedStyles}</Text>
                    )}

                    {preferredColors.length > 0 && (
                      <View style={styles.favoriteColors}>
                        <Text style={styles.favoriteColorsLabel}>Любимые цвета</Text>
                        <Text style={styles.myStyleValues}>{preferredColors.join(' · ')}</Text>
                      </View>
                    )}
                  </View>
                ) : (
                  <Text style={styles.myStyleEmpty}>Добавьте стили и любимые цвета</Text>
                )}
              </Pressable>

              <View style={styles.familyCard}>
              <View style={styles.familyHeader}>
                <Text style={styles.cardTitle}>Семья</Text>
                {pendingIncomingCount > 0 ? (
                  <View style={styles.familyBadge}>
                    <ThemedText style={styles.familyBadgeText}>{pendingIncomingCount}</ThemedText>
                  </View>
                ) : null}
              </View>

              {status === 'loading' && members.length === 0 ? (
                <ThemedText themeColor="textSecondary" style={styles.familyStatusText}>
                  Загрузка…
                </ThemedText>
              ) : null}

              {status === 'error' && errorKind === 'network' ? (
                <NetworkErrorState
                  compact
                  onRetry={() => {
                    void refreshFamily();
                  }}
                />
              ) : null}

              {status === 'error' && errorKind !== 'network' ? (
                <View style={styles.familyStatusCard}>
                  <ThemedText themeColor="textSecondary" style={styles.familyStatusText}>
                    {error ?? 'Не удалось загрузить семью'}
                  </ThemedText>
                  <Pressable
                    onPress={() => {
                      void refreshFamily();
                    }}
                    style={({ pressed }) => [styles.familyRetryButton, pressed && styles.pressed]}>
                    <ThemedText style={styles.familyRetryButtonText}>Повторить</ThemedText>
                  </Pressable>
                </View>
              ) : null}

              {incomingInvites.map((invite) => (
                <View key={invite.id} style={styles.familyInviteCard}>
                  <ThemedText style={styles.familyInviteText}>
                    {getFamilyMemberLabel(invite.sender)} хочет добавить вас в семью
                  </ThemedText>
                  <View style={styles.familyInviteActions}>
                    <Pressable
                      onPress={() => {
                        void handleInviteAction(() => acceptInvite(invite.id));
                      }}
                      style={({ pressed }) => [styles.familyAcceptButton, pressed && styles.pressed]}>
                      <ThemedText style={styles.familyAcceptButtonText}>Принять</ThemedText>
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        void handleInviteAction(() => rejectInvite(invite.id));
                      }}
                      style={({ pressed }) => [styles.familyRejectButton, pressed && styles.pressed]}>
                      <ThemedText style={styles.familyRejectButtonText}>Отклонить</ThemedText>
                    </Pressable>
                  </View>
                </View>
              ))}

              {outgoingInvites.map((invite) => (
                <View key={invite.id} style={styles.familyOutgoingCard}>
                  <ThemedText themeColor="textSecondary" style={styles.familyOutgoingText}>
                    Приглашение отправлено: {getFamilyMemberLabel(invite.recipient)}
                  </ThemedText>
                </View>
              ))}

              {status === 'loaded' &&
              members.length === 0 &&
              incomingInvites.length === 0 &&
              outgoingInvites.length === 0 ? (
                <ThemedText themeColor="textSecondary" style={styles.familyEmptyText}>
                  Добавьте близких по ID пользователя, чтобы видеть их здесь после принятия
                  приглашения.
                </ThemedText>
              ) : null}

              <ScrollView
                horizontal
                nestedScrollEnabled
                showsHorizontalScrollIndicator={false}
                style={styles.familyScroll}
                contentContainerStyle={styles.familyRow}>
                <View style={styles.familyMember}>
                  <View style={styles.miniAvatar}>
                    <ThemedText style={styles.miniAvatarLetter}>
                      {getInitial(displayName)}
                    </ThemedText>
                  </View>
                  <ThemedText style={styles.memberLabel}>Я</ThemedText>
                </View>

                {members.map((member) => (
                  <Pressable
                    key={member.publicId}
                    onPress={() =>
                      router.push({
                        pathname: '/profile/family/[publicId]',
                        params: {
                          publicId: member.publicId,
                          displayName: getFamilyMemberLabel(member),
                        },
                      })
                    }
                    accessibilityRole="button"
                    accessibilityLabel={`Открыть профиль: ${getFamilyMemberLabel(member)}`}
                    style={({ pressed }) => [styles.familyMember, pressed && styles.pressed]}>
                    <View style={styles.miniAvatar}>
                      <ThemedText style={styles.miniAvatarLetter}>
                        {getInitial(getFamilyMemberLabel(member))}
                      </ThemedText>
                    </View>
                    <ThemedText style={styles.memberLabel} numberOfLines={1}>
                      {getFamilyMemberLabel(member)}
                    </ThemedText>
                  </Pressable>
                ))}

                <Pressable
                  onPress={() => setIsAddMemberSheetVisible(true)}
                  style={({ pressed }) => [styles.familyMember, pressed && styles.pressed]}>
                  <View style={styles.addMemberAvatar}>
                    <ThemedText style={styles.addMemberPlus}>+</ThemedText>
                  </View>
                  <ThemedText themeColor="textSecondary" style={styles.memberLabel}>
                    Добавить
                  </ThemedText>
                </Pressable>
              </ScrollView>
            </View>

              <View style={styles.settingsCard}>
                <ProfileSettingsRow
                  isFirst
                  title="Мои параметры"
                  subtitle="Для более точного подбора"
                  icon={{ ios: 'ruler', android: 'straighten', web: 'straighten' }}
                  onPress={() => setIsBodyParametersSheetVisible(true)}
                />
                <ProfileSettingsRow
                  title="Настройки стилиста"
                  subtitle="Твои пожелания к образам"
                  icon={{ ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' }}
                  onPress={() => setIsStylistSettingsSheetVisible(true)}
                />
                <ProfileSettingsRow
                  title="Совместные образы"
                  subtitle="Образы с близкими"
                  icon={{ ios: 'person.2', android: 'people', web: 'people' }}
                  onPress={() => router.push('/profile/paired-outfits')}
                />
                <ProfileSettingsRow
                  title="Аккаунт"
                  subtitle="Вход и данные профиля"
                  icon={{ ios: 'person.crop.circle', android: 'account_circle', web: 'account_circle' }}
                  onPress={() => setIsAccountSheetVisible(true)}
                />
              </View>
            </>

          <View style={styles.logoutBlock}>
            {isProtected ? (
              <Pressable
                onPress={() => {
                  void handleLogoutPress();
                }}
                style={({ pressed }) => [styles.logoutButton, pressed && styles.pressed]}>
                <ThemedText style={styles.logoutText}>Выйти из профиля</ThemedText>
              </Pressable>
            ) : null}
            {__DEV__ ? (
              <>
                <Pressable
                  onPress={handleDevGenerateDailyPress}
                  disabled={isDevDailyGenerateInProgress}
                  style={({ pressed }) => [
                    styles.devServerRestoreButton,
                    pressed && styles.pressed,
                    isDevDailyGenerateInProgress && styles.devRefreshButtonDisabled,
                  ]}>
                  {isDevDailyGenerateInProgress ? (
                    <ActivityIndicator color={PrikinColors.textSecondary} />
                  ) : (
                    <ThemedText style={styles.devServerRestoreText}>
                      Сгенерировать образ на сегодня
                    </ThemedText>
                  )}
                </Pressable>
                <Pressable
                  onPress={handleDevNotificationTestPress}
                  disabled={isDevDailyNotificationTestInProgress}
                  style={({ pressed }) => [
                    styles.devServerRestoreButton,
                    pressed && styles.pressed,
                    isDevDailyNotificationTestInProgress && styles.devRefreshButtonDisabled,
                  ]}>
                  {isDevDailyNotificationTestInProgress ? (
                    <ActivityIndicator color={PrikinColors.textSecondary} />
                  ) : (
                    <ThemedText style={styles.devServerRestoreText}>
                      Тест уведомления через 5 секунд
                    </ThemedText>
                  )}
                </Pressable>
                <Pressable
                  onPress={handleDevServerRestorePress}
                  disabled={isDevServerRestoreInProgress}
                  style={({ pressed }) => [
                    styles.devServerRestoreButton,
                    pressed && styles.pressed,
                    isDevServerRestoreInProgress && styles.devRefreshButtonDisabled,
                  ]}>
                  {isDevServerRestoreInProgress ? (
                    <ActivityIndicator color={PrikinColors.textSecondary} />
                  ) : (
                    <ThemedText style={styles.devServerRestoreText}>
                      Восстановить тестовые данные с сервера
                    </ThemedText>
                  )}
                </Pressable>
                <Pressable
                  onPress={handleDevRefreshPress}
                  disabled={isDevRefreshInProgress}
                  style={({ pressed }) => [
                    styles.devRefreshButton,
                    pressed && styles.pressed,
                    isDevRefreshInProgress && styles.devRefreshButtonDisabled,
                  ]}>
                  {isDevRefreshInProgress ? (
                    <ActivityIndicator color={PrikinColors.textSecondary} />
                  ) : (
                    <ThemedText style={styles.devRefreshText}>Обновить тестовые данные</ThemedText>
                  )}
                </Pressable>
                <Pressable
                  onPress={handleDevResetPress}
                  style={({ pressed }) => [styles.devResetButton, pressed && styles.pressed]}>
                  <ThemedText style={styles.devResetText}>Сбросить тестовый аккаунт</ThemedText>
                </Pressable>
              </>
            ) : null}
          </View>
        </ScrollView>

        <AddMemberSheet
          visible={isAddMemberSheetVisible}
          onClose={() => setIsAddMemberSheetVisible(false)}
        />
        <BodyParametersSheet
          visible={isBodyParametersSheetVisible}
          onClose={() => setIsBodyParametersSheetVisible(false)}
        />
        <StylistSettingsSheet
          visible={isStylistSettingsSheetVisible}
          onClose={() => setIsStylistSettingsSheetVisible(false)}
        />
        <AccountSheet
          visible={isAccountSheetVisible}
          onClose={() => setIsAccountSheetVisible(false)}
        />
        <AccountSaveSheet
          visible={isSaveAccountVisible}
          onClose={() => setIsSaveAccountVisible(false)}
        />
        <AccountLoginChoiceSheet
          visible={isLoginChoiceVisible}
          onClose={() => setIsLoginChoiceVisible(false)}
        />
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: PrikinColors.background,
  },
  safeArea: {
    flex: 1,
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    width: '100%',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: PrikinSpacing.screenHorizontal,
    paddingBottom: TabScreenScrollPadding,
  },
  screenTitle: {
    ...PrikinTypography.screenTitle,
    marginTop: Spacing.one,
  },
  tagline: {
    marginTop: PrikinSpacing.welcomeTaglineTop / 2,
    marginBottom: PrikinSpacing.sectionGap,
  },
  heroSection: {
    marginBottom: PrikinSpacing.sectionGap,
  },
  userBlock: {
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: PrikinColors.surface,
    borderRadius: PrikinRadii.card,
    paddingVertical: Spacing.four,
    paddingHorizontal: PrikinSpacing.cardPadding,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PrikinColors.borderSubtle,
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: PrikinColors.profileAvatarCircle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    fontSize: 32,
    fontWeight: '600',
    color: PrikinColors.textSecondary,
  },
  userName: {
    ...PrikinTypography.sectionTitle,
    textAlign: 'center',
  },
  guestBlock: {
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: PrikinColors.surface,
    borderRadius: PrikinRadii.card,
    paddingVertical: Spacing.five,
    paddingHorizontal: PrikinSpacing.cardPadding,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PrikinColors.borderSubtle,
  },
  guestAvatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: PrikinColors.profileAvatarCircle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guestTitle: {
    ...PrikinTypography.sectionTitle,
    textAlign: 'center',
  },
  guestSubtitle: {
    ...PrikinTypography.bodySecondary,
    textAlign: 'center',
  },
  guestLoginButton: {
    alignSelf: 'stretch',
    marginTop: Spacing.two,
  },
  guestSaveLink: {
    paddingVertical: Spacing.two,
  },
  guestSaveLinkText: {
    ...PrikinTypography.textAction,
    color: PrikinColors.textSecondary,
  },
  myStyleCard: {
    backgroundColor: PrikinColors.profileMutedGreenAlt,
    borderRadius: PrikinRadii.card,
    padding: PrikinSpacing.cardPadding,
    gap: Spacing.three,
    marginBottom: PrikinSpacing.sectionGap,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PrikinColors.borderSubtle,
  },
  myStyleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTitle: {
    ...PrikinTypography.sectionTitle,
  },
  myStyleIconRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  myStyleIconCircle: {
    width: STYLE_ICON_SIZE,
    height: STYLE_ICON_SIZE,
    borderRadius: STYLE_ICON_SIZE / 2,
    backgroundColor: PrikinColors.profileAvatarCircle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  myStyleContent: {
    gap: Spacing.two,
  },
  myStyleValues: {
    ...PrikinTypography.body,
  },
  favoriteColors: {
    gap: Spacing.one,
  },
  favoriteColorsLabel: {
    ...PrikinTypography.caption,
  },
  myStyleEmpty: {
    ...PrikinTypography.bodySecondary,
  },
  settingsCard: {
    backgroundColor: PrikinColors.surface,
    borderRadius: PrikinRadii.card,
    overflow: 'hidden',
    marginTop: PrikinSpacing.sectionGap,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PrikinColors.borderSubtle,
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
    paddingHorizontal: PrikinSpacing.cardPadding,
    minHeight: 64,
  },
  settingsRowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: PrikinColors.divider,
  },
  settingsIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: PrikinColors.profileAvatarCircle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsRowContent: {
    flex: 1,
    gap: 2,
    paddingRight: Spacing.two,
  },
  settingsTitle: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600',
    color: PrikinColors.textPrimary,
  },
  settingsSubtitle: {
    ...PrikinTypography.caption,
  },
  familyCard: {
    backgroundColor: PrikinColors.profileMutedGreen,
    borderRadius: PrikinRadii.card,
    padding: PrikinSpacing.cardPadding,
    gap: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PrikinColors.borderSubtle,
  },
  familyScroll: {
    flexGrow: 0,
    height: FAMILY_ROW_HEIGHT,
  },
  familyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  familyBadge: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DC2626',
  },
  familyBadgeText: {
    fontSize: 12,
    lineHeight: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  familyStatusText: {
    fontSize: 14,
    lineHeight: 20,
  },
  familyStatusCard: {
    gap: Spacing.two,
  },
  familyRetryButton: {
    alignSelf: 'flex-start',
    paddingVertical: Spacing.one,
  },
  familyRetryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: PrikinColors.textPrimary,
  },
  familyInviteCard: {
    backgroundColor: PrikinColors.surface,
    borderRadius: PrikinRadii.input,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  familyInviteText: {
    ...PrikinTypography.body,
  },
  familyInviteActions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  familyAcceptButton: {
    flex: 1,
    minHeight: 40,
    borderRadius: PrikinRadii.input,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PrikinColors.buttonPrimary,
  },
  familyAcceptButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: PrikinColors.buttonPrimaryText,
  },
  familyRejectButton: {
    flex: 1,
    minHeight: 40,
    borderRadius: PrikinRadii.input,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: PrikinColors.borderSubtle,
  },
  familyRejectButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: PrikinColors.textPrimary,
  },
  familyOutgoingCard: {
    backgroundColor: PrikinColors.surface,
    borderRadius: PrikinRadii.input,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  familyOutgoingText: {
    fontSize: 14,
    lineHeight: 20,
  },
  familyEmptyText: {
    fontSize: 14,
    lineHeight: 20,
  },
  familyRow: {
    gap: Spacing.three,
    paddingRight: Spacing.two,
  },
  familyMember: {
    width: 64,
    alignItems: 'center',
    gap: Spacing.one,
  },
  miniAvatar: {
    width: MINI_AVATAR_SIZE,
    height: MINI_AVATAR_SIZE,
    borderRadius: MINI_AVATAR_SIZE / 2,
    backgroundColor: PrikinColors.profileAvatarCircle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniAvatarLetter: {
    fontSize: 18,
    fontWeight: '600',
    color: PrikinColors.textSecondary,
  },
  addMemberAvatar: {
    width: MINI_AVATAR_SIZE,
    height: MINI_AVATAR_SIZE,
    borderRadius: MINI_AVATAR_SIZE / 2,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: PrikinColors.textSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  addMemberPlus: {
    fontSize: 24,
    fontWeight: '400',
    color: PrikinColors.textSecondary,
    lineHeight: 28,
  },
  memberLabel: {
    ...PrikinTypography.caption,
    color: PrikinColors.textPrimary,
    textAlign: 'center',
    maxWidth: 64,
  },
  logoutBlock: {
    marginTop: PrikinSpacing.sectionGap,
    paddingTop: Spacing.three,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: PrikinColors.divider,
    alignItems: 'center',
  },
  logoutButton: {
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
  },
  logoutText: {
    ...PrikinTypography.textAction,
    color: PrikinTypography.error.color,
  },
  devResetButton: {
    marginTop: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
  },
  devServerRestoreButton: {
    marginTop: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    alignItems: 'center',
    minHeight: 40,
    justifyContent: 'center',
  },
  devRefreshButton: {
    marginTop: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    alignItems: 'center',
    minHeight: 40,
    justifyContent: 'center',
  },
  devRefreshButtonDisabled: {
    opacity: 0.6,
  },
  devRefreshText: {
    ...PrikinTypography.bodySecondary,
  },
  devServerRestoreText: {
    ...PrikinTypography.bodySecondary,
    textAlign: 'center',
  },
  devResetText: {
    ...PrikinTypography.bodySecondary,
  },
  pressed: {
    opacity: 0.7,
  },
});
