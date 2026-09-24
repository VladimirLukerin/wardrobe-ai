import { TabTrigger, TabTriggerSlotProps } from 'expo-router/ui';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PhotoCaptureOnboardingSheet } from '@/components/photo-capture-onboarding-sheet';
import { PrikinTabIcon, type PrikinTabIconName } from '@/components/prikin/prikin-tab-icon';
import { PrikinColors, PrikinSpacing, PrikinTypography } from '@/constants/prikin-tokens';
import { Spacing } from '@/constants/theme';
import { useAddWardrobeItem } from '@/hooks/use-add-wardrobe-item';

type TabConfig = {
  name: string;
  label: string;
  icon: PrikinTabIconName;
};

const LEFT_TABS: TabConfig[] = [
  { name: 'home', label: 'Главная', icon: 'home' },
  { name: 'garderob', label: 'Гардероб', icon: 'wardrobe' },
];

const RIGHT_TABS: TabConfig[] = [
  { name: 'create-outfit', label: 'Образы', icon: 'outfits' },
  { name: 'profile', label: 'Профиль', icon: 'profile' },
];

function TabBarItem({
  label,
  icon,
  isFocused,
  ...props
}: TabTriggerSlotProps & Pick<TabConfig, 'label' | 'icon'>) {
  const color = isFocused ? PrikinColors.tabActive : PrikinColors.tabInactive;

  return (
    <Pressable {...props} style={({ pressed }) => [styles.tabItem, pressed && styles.pressed]}>
      <PrikinTabIcon name={icon} focused={Boolean(isFocused)} size={22} />
      <Text style={[isFocused ? styles.tabLabelActive : styles.tabLabel, { color }]}>{label}</Text>
    </Pressable>
  );
}

function TabBarButton({ tab }: { tab: TabConfig }) {
  return (
    <TabTrigger name={tab.name} asChild>
      <TabBarItem label={tab.label} icon={tab.icon} />
    </TabTrigger>
  );
}

export function AppTabBar() {
  const insets = useSafeAreaInsets();
  const {
    takePhoto,
    isPhotoOnboardingVisible,
    handlePhotoOnboardingContinue,
    handlePhotoOnboardingSkipForever,
    handlePhotoOnboardingClose,
  } = useAddWardrobeItem();

  return (
    <>
      <PhotoCaptureOnboardingSheet
        visible={isPhotoOnboardingVisible}
        onContinue={handlePhotoOnboardingContinue}
        onSkipForever={handlePhotoOnboardingSkipForever}
        onClose={handlePhotoOnboardingClose}
      />
      <View
        style={[
          styles.container,
          { paddingBottom: Math.max(insets.bottom, Spacing.two) },
        ]}>
        <View style={styles.bar}>
          <View style={styles.sideGroup}>
            {LEFT_TABS.map((tab) => (
              <TabBarButton key={tab.name} tab={tab} />
            ))}
          </View>

          <View style={styles.cameraSlot}>
            <Pressable
              onPress={takePhoto}
              accessibilityRole="button"
              accessibilityLabel="Добавить вещь с камеры"
              style={({ pressed }) => [styles.cameraButton, pressed && styles.pressed]}>
              <SymbolView
                name={{ ios: 'camera.fill', android: 'photo_camera', web: 'photo_camera' }}
                size={20}
                tintColor={PrikinColors.buttonPrimaryText}
              />
            </Pressable>
          </View>

          <View style={styles.sideGroup}>
            {RIGHT_TABS.map((tab) => (
              <TabBarButton key={tab.name} tab={tab} />
            ))}
          </View>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: PrikinColors.tabBarBackground,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: PrikinColors.borderSubtle,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.one,
    paddingTop: 4,
    minHeight: 46,
  },
  sideGroup: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingVertical: 2,
  },
  tabLabel: {
    ...PrikinTypography.tabLabel,
    fontSize: 10,
    lineHeight: 12,
  },
  tabLabelActive: {
    ...PrikinTypography.tabLabelActive,
    fontSize: 10,
    lineHeight: 12,
  },
  cameraSlot: {
    width: 60,
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: -Spacing.two,
  },
  cameraButton: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: PrikinColors.buttonPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.16,
    shadowRadius: 6,
    elevation: 5,
  },
  pressed: {
    opacity: 0.88,
  },
});
