import { SymbolView } from 'expo-symbols';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import AccountSheet from '@/components/account-sheet';
import AddMemberSheet from '@/components/add-member-sheet';
import BodyParametersSheet from '@/components/body-parameters-sheet';
import StylistSettingsSheet from '@/components/stylist-settings-sheet';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, MaxContentWidth, Spacing, TabScreenScrollPadding } from '@/constants/theme';
import { useAccount } from '@/contexts/account-context';
import { useAccountProfile } from '@/contexts/account-profile-context';
import { useFamily } from '@/contexts/family-context';
import { useOutfitsSync } from '@/contexts/outfits-sync-context';
import { usePreferencesSync } from '@/contexts/preferences-sync-context';
import { useStylePreferences } from '@/contexts/style-preferences-context';
import { useWearHistorySync } from '@/contexts/wear-history-sync-context';
import { useWardrobeSync } from '@/contexts/wardrobe-sync-context';
import { assessLocalAccountState } from '@/services/account-switch';

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
  const { user, logoutFromProfile } = useAccount();
  const { displayName } = useAccountProfile();
  const { status: preferencesSyncStatus } = usePreferencesSync();
  const { status: wardrobeSyncStatus } = useWardrobeSync();
  const { status: outfitsSyncStatus } = useOutfitsSync();
  const { status: wearHistorySyncStatus } = useWearHistorySync();
  const { styles: preferredStyles, colors: preferredColors, hasStylePreferences } =
    useStylePreferences();
  const { members } = useFamily();

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

    messageParts.push('Вы выйдете из текущего аккаунта и начнёте с нового локального профиля.');

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
            <ThemedText style={styles.familyTitle}>СЕМЬЯ</ThemedText>

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
                <View key={member.id} style={styles.familyMember}>
                  <View style={styles.miniAvatar}>
                    <ThemedText style={styles.miniAvatarLetter}>
                      {getInitial(member.name)}
                    </ThemedText>
                  </View>
                  <ThemedText style={styles.memberLabel} numberOfLines={1}>
                    {member.name}
                  </ThemedText>
                </View>
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

          <View style={styles.logoutBlock}>
            <Pressable
              onPress={() => {
                void handleLogoutPress();
              }}
              style={({ pressed }) => [styles.logoutButton, pressed && styles.pressed]}>
              <ThemedText style={styles.logoutText}>Выйти из профиля</ThemedText>
            </Pressable>
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
  familyTitle: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.6,
    color: Colors.light.text,
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
  pressed: {
    opacity: 0.7,
  },
});
