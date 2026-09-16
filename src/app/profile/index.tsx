import { SymbolView } from 'expo-symbols';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import AccountLoginChoiceSheet from '@/components/account-login-choice-sheet';
import AccountSaveSheet from '@/components/account-save-sheet';
import AccountSheet from '@/components/account-sheet';
import AddMemberSheet from '@/components/add-member-sheet';
import BodyParametersSheet from '@/components/body-parameters-sheet';
import { NetworkErrorState } from '@/components/network-error-state';
import StylistSettingsSheet from '@/components/stylist-settings-sheet';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { getFamilyMemberLabel } from '@/constants/family';
import { Colors, MaxContentWidth, Spacing, TabScreenScrollPadding } from '@/constants/theme';
import { useAccount } from '@/contexts/account-context';
import { useAccountProfile } from '@/contexts/account-profile-context';
import { useFamily } from '@/contexts/family-context';
import { useOutfitsSync } from '@/contexts/outfits-sync-context';
import { usePreferencesSync } from '@/contexts/preferences-sync-context';
import { useStylePreferences } from '@/contexts/style-preferences-context';
import { useWearHistorySync } from '@/contexts/wear-history-sync-context';
import { useWardrobeSync } from '@/contexts/wardrobe-sync-context';
import { AccountApiError } from '@/services/account';
import { assessLocalAccountState } from '@/services/account-switch';
import { isAccountProtected } from '@/utils/account-is-protected';

const PROFILE = {
  completion: 70,
} as const;

const STYLE_HINT = 'Ваш стиль пока изучается';
const STYLE_TOOLTIP =
  'Оценивайте образы, чтобы мы лучше понимали ваши предпочтения.';

const LOGOUT_TITLE = 'Выйти из профиля?';

const MINI_AVATAR_SIZE = 48;
const FAMILY_ROW_HEIGHT = MINI_AVATAR_SIZE + Spacing.one + 16;

function getInitial(name: string) {
  return name.trim().charAt(0).toUpperCase();
}

export default function ProfileScreen() {
  const [isTooltipVisible, setIsTooltipVisible] = useState(false);
  const [isAddMemberSheetVisible, setIsAddMemberSheetVisible] = useState(false);
  const [isBodyParametersSheetVisible, setIsBodyParametersSheetVisible] = useState(false);
  const [isStylistSettingsSheetVisible, setIsStylistSettingsSheetVisible] = useState(false);
  const [isAccountSheetVisible, setIsAccountSheetVisible] = useState(false);
  const [isSaveAccountVisible, setIsSaveAccountVisible] = useState(false);
  const [isLoginChoiceVisible, setIsLoginChoiceVisible] = useState(false);
  const { user, logoutFromProfile, devResetTestAccount } = useAccount();
  const { displayName } = useAccountProfile();
  const { status: preferencesSyncStatus } = usePreferencesSync();
  const { status: wardrobeSyncStatus } = useWardrobeSync();
  const { status: outfitsSyncStatus } = useOutfitsSync();
  const { status: wearHistorySyncStatus } = useWearHistorySync();
  const { styles: preferredStyles, colors: preferredColors, hasStylePreferences } =
    useStylePreferences();
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

    if (!user?.emailVerified && !user?.phoneVerified) {
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

  const toggleTooltip = () => {
    setIsTooltipVisible((visible) => !visible);
  };

  const displayedStyles = preferredStyles.slice(0, 3).join('   ');

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {isTooltipVisible && (
          <Pressable style={styles.dismissOverlay} onPress={() => setIsTooltipVisible(false)} />
        )}

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            {isProtected ? (
              <>
                <View style={styles.avatar}>
                  <ThemedText style={styles.avatarLetter}>{getInitial(displayName)}</ThemedText>
                </View>

                <ThemedText style={styles.name}>{displayName}</ThemedText>

                <View style={styles.styleSection}>
                  <View style={styles.styleRow}>
                    <ThemedText themeColor="textSecondary" style={styles.styleHint}>
                      {STYLE_HINT}
                    </ThemedText>
                    <Pressable
                      onPress={toggleTooltip}
                      hitSlop={8}
                      style={({ pressed }) => pressed && styles.pressed}>
                      <SymbolView
                        name={{ ios: 'info.circle', android: 'info', web: 'info' }}
                        size={16}
                        tintColor={Colors.light.textSecondary}
                      />
                    </Pressable>
                  </View>

                  {isTooltipVisible && (
                    <View style={styles.tooltip}>
                      <ThemedText style={styles.tooltipText}>{STYLE_TOOLTIP}</ThemedText>
                    </View>
                  )}
                </View>

                <ThemedText themeColor="textSecondary" style={styles.completionText}>
                  Профиль заполнен на {PROFILE.completion}%
                </ThemedText>

                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${PROFILE.completion}%` }]} />
                </View>
              </>
            ) : (
              <>
                <ThemedText style={styles.name}>Гостевой профиль</ThemedText>

                <View style={styles.guestCard}>
                  <ThemedText style={styles.guestCardTitle}>Аккаунт не защищён</ThemedText>
                  <ThemedText themeColor="textSecondary" style={styles.guestCardText}>
                    Подключите email или телефон, чтобы сохранить гардероб и восстановить его на
                    другом устройстве.
                  </ThemedText>

                  <Pressable
                    onPress={() => setIsSaveAccountVisible(true)}
                    style={({ pressed }) => [styles.guestPrimaryButton, pressed && styles.pressed]}>
                    <ThemedText style={styles.guestPrimaryButtonText}>Сохранить аккаунт</ThemedText>
                  </Pressable>

                  <Pressable
                    onPress={() => setIsLoginChoiceVisible(true)}
                    style={({ pressed }) => [styles.guestSecondaryButton, pressed && styles.pressed]}>
                    <ThemedText style={styles.guestSecondaryButtonText}>
                      Войти в существующий аккаунт
                    </ThemedText>
                  </Pressable>
                </View>
              </>
            )}
          </View>

          <Pressable
            onPress={() => router.push('/profile/my-style')}
            style={({ pressed }) => [styles.myStyleBlock, pressed && styles.pressed]}>
            <View style={styles.myStyleHeader}>
              <ThemedText style={styles.myStyleTitle}>МОЙ СТИЛЬ</ThemedText>
              <SymbolView
                name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
                size={14}
                tintColor={Colors.light.textSecondary}
              />
            </View>

            {hasStylePreferences ? (
              <View style={styles.myStyleContent}>
                {preferredStyles.length > 0 && (
                  <ThemedText style={styles.myStyleValues}>{displayedStyles}</ThemedText>
                )}

                {preferredColors.length > 0 && (
                  <View style={styles.favoriteColors}>
                    <ThemedText themeColor="textSecondary" style={styles.favoriteColorsLabel}>
                      Любимые цвета
                    </ThemedText>
                    <ThemedText style={styles.myStyleValues}>
                      {preferredColors.join(' · ')}
                    </ThemedText>
                  </View>
                )}
              </View>
            ) : (
              <ThemedText themeColor="textSecondary" style={styles.myStyleEmpty}>
                Добавьте стили и любимые цвета
              </ThemedText>
            )}
          </Pressable>

          <View style={styles.familyBlock}>
            <View style={styles.familyHeader}>
              <ThemedText style={styles.familyTitle}>СЕМЬЯ</ThemedText>
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
                Добавьте близких по ID пользователя, чтобы видеть их здесь после принятия приглашения.
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
                      params: { publicId: member.publicId, displayName: getFamilyMemberLabel(member) },
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

          <Pressable
            onPress={() => setIsBodyParametersSheetVisible(true)}
            style={({ pressed }) => [styles.settingsRow, pressed && styles.pressed]}>
            <ThemedText style={styles.settingsTitle}>Мои параметры</ThemedText>
            <SymbolView
              name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
              size={12}
              tintColor={Colors.light.textSecondary}
            />
          </Pressable>

          <Pressable
            onPress={() => setIsStylistSettingsSheetVisible(true)}
            style={({ pressed }) => [styles.settingsRow, pressed && styles.pressed]}>
            <ThemedText style={styles.settingsTitle}>Настройки стилиста</ThemedText>
            <SymbolView
              name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
              size={12}
              tintColor={Colors.light.textSecondary}
            />
          </Pressable>

          {isProtected ? (
            <Pressable
              onPress={() => setIsAccountSheetVisible(true)}
              style={({ pressed }) => [styles.settingsRow, pressed && styles.pressed]}>
              <ThemedText style={styles.settingsTitle}>Аккаунт</ThemedText>
              <SymbolView
                name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
                size={12}
                tintColor={Colors.light.textSecondary}
              />
            </Pressable>
          ) : null}

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
              <Pressable
                onPress={handleDevResetPress}
                style={({ pressed }) => [styles.devResetButton, pressed && styles.pressed]}>
                <ThemedText style={styles.devResetText}>Сбросить тестовый аккаунт</ThemedText>
              </Pressable>
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

const AVATAR_SIZE = 88;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
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
    paddingHorizontal: Spacing.four,
    paddingBottom: TabScreenScrollPadding,
  },
  familyScroll: {
    flexGrow: 0,
    height: FAMILY_ROW_HEIGHT,
  },
  dismissOverlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 1,
  },
  header: {
    alignItems: 'center',
    paddingTop: Spacing.five,
    gap: Spacing.two,
    zIndex: 2,
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: Colors.light.backgroundElement,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.one,
  },
  avatarLetter: {
    fontSize: 32,
    fontWeight: '600',
    color: Colors.light.textSecondary,
  },
  name: {
    fontSize: 26,
    fontWeight: '600',
    lineHeight: 32,
    color: Colors.light.text,
    textAlign: 'center',
  },
  styleSection: {
    alignItems: 'center',
    gap: Spacing.two,
    zIndex: 3,
  },
  styleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  styleHint: {
    fontSize: 15,
    lineHeight: 22,
  },
  tooltip: {
    backgroundColor: Colors.light.backgroundElement,
    borderRadius: 10,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    maxWidth: 280,
  },
  tooltipText: {
    fontSize: 14,
    lineHeight: 20,
    color: Colors.light.text,
    textAlign: 'center',
  },
  completionText: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: Spacing.two,
  },
  progressTrack: {
    width: '100%',
    maxWidth: 240,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.light.backgroundElement,
    overflow: 'hidden',
    marginTop: Spacing.one,
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: Colors.light.text,
  },
  guestCard: {
    width: '100%',
    marginTop: Spacing.two,
    borderRadius: 16,
    backgroundColor: Colors.light.backgroundElement,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  guestCardTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.light.text,
    textAlign: 'center',
  },
  guestCardText: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  guestPrimaryButton: {
    minHeight: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.text,
    paddingHorizontal: Spacing.three,
  },
  guestPrimaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.background,
  },
  guestSecondaryButton: {
    minHeight: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.light.backgroundSelected,
    paddingHorizontal: Spacing.three,
  },
  guestSecondaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.light.text,
  },
  myStyleBlock: {
    marginTop: Spacing.five,
    paddingTop: Spacing.four,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.light.backgroundSelected,
    gap: Spacing.two,
  },
  myStyleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  myStyleTitle: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.6,
    color: Colors.light.text,
  },
  myStyleContent: {
    gap: Spacing.two,
  },
  myStyleValues: {
    fontSize: 15,
    lineHeight: 22,
    color: Colors.light.text,
  },
  favoriteColors: {
    gap: Spacing.one,
  },
  favoriteColorsLabel: {
    fontSize: 13,
    lineHeight: 18,
  },
  myStyleEmpty: {
    fontSize: 15,
    lineHeight: 22,
  },
  settingsRow: {
    marginTop: Spacing.four,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.one,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.light.backgroundSelected,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 36,
  },
  settingsTitle: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
    color: Colors.light.text,
  },
  familyBlock: {
    marginTop: Spacing.five,
    paddingTop: Spacing.four,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.light.backgroundSelected,
    gap: Spacing.three,
  },
  familyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  familyTitle: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.6,
    color: Colors.light.text,
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
    color: Colors.light.text,
  },
  familyInviteCard: {
    backgroundColor: Colors.light.backgroundElement,
    borderRadius: 12,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  familyInviteText: {
    fontSize: 15,
    lineHeight: 22,
    color: Colors.light.text,
  },
  familyInviteActions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  familyAcceptButton: {
    flex: 1,
    minHeight: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.text,
  },
  familyAcceptButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.light.background,
  },
  familyRejectButton: {
    flex: 1,
    minHeight: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.light.backgroundSelected,
  },
  familyRejectButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.light.text,
  },
  familyOutgoingCard: {
    backgroundColor: Colors.light.backgroundElement,
    borderRadius: 12,
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
    backgroundColor: Colors.light.backgroundElement,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniAvatarLetter: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.textSecondary,
  },
  addMemberAvatar: {
    width: MINI_AVATAR_SIZE,
    height: MINI_AVATAR_SIZE,
    borderRadius: MINI_AVATAR_SIZE / 2,
    borderWidth: 1.5,
    borderColor: Colors.light.backgroundSelected,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addMemberPlus: {
    fontSize: 24,
    fontWeight: '400',
    color: Colors.light.textSecondary,
    lineHeight: 28,
  },
  memberLabel: {
    fontSize: 12,
    lineHeight: 16,
    color: Colors.light.text,
    textAlign: 'center',
    maxWidth: 64,
  },
  logoutBlock: {
    marginTop: Spacing.four,
    paddingTop: Spacing.three,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.light.backgroundSelected,
    alignItems: 'center',
  },
  logoutButton: {
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#DC2626',
  },
  devResetButton: {
    marginTop: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
  },
  devResetText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.light.textSecondary,
  },
  pressed: {
    opacity: 0.7,
  },
});
