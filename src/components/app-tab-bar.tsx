import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { TabTrigger, TabTriggerSlotProps } from 'expo-router/ui';
import { ImageSourcePropType, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { PhotoCaptureOnboardingSheet } from '@/components/photo-capture-onboarding-sheet';
import { Colors, Spacing } from '@/constants/theme';
import { useAddWardrobeItem } from '@/hooks/use-add-wardrobe-item';

type TabIconConfig =
  | { type: 'image'; source: ImageSourcePropType }
  | { type: 'symbol'; ios: string; android: string; web: string };

type TabConfig = {
  name: string;
  label: string;
  icon: TabIconConfig;
};

const LEFT_TABS: TabConfig[] = [
  {
    name: 'home',
    label: 'Главная',
    icon: { type: 'image', source: require('@/assets/images/tabIcons/home.png') },
  },
  {
    name: 'garderob',
    label: 'Гардероб',
    icon: { type: 'image', source: require('@/assets/images/tabIcons/explore.png') },
  },
];

const RIGHT_TABS = [
  {
    name: 'create-outfit',
    label: 'Образы',
    icon: {
      type: 'symbol' as const,
      ios: 'sparkles',
      android: 'auto_awesome',
      web: 'auto_awesome',
    },
  },
  {
    name: 'profile',
    label: 'Профиль',
    icon: { type: 'symbol' as const, ios: 'person', android: 'person', web: 'person' },
  },
] satisfies TabConfig[];

function TabBarItem({
  label,
  icon,
  isFocused,
  ...props
}: TabTriggerSlotProps & Pick<TabConfig, 'label' | 'icon'>) {
  const tintColor = isFocused ? Colors.light.text : Colors.light.textSecondary;

  return (
    <Pressable {...props} style={({ pressed }) => [styles.tabItem, pressed && styles.pressed]}>
      {icon.type === 'image' ? (
        <Image
          source={icon.source}
          style={styles.tabIconImage}
          tintColor={tintColor}
          contentFit="contain"
        />
      ) : (
        <SymbolView
          name={{
            ios: icon.ios as 'sparkles' | 'person',
            android: icon.android as 'auto_awesome' | 'person',
            web: icon.web as 'auto_awesome' | 'person',
          }}
          size={22}
          tintColor={tintColor}
        />
      )}
      <ThemedText style={[styles.tabLabel, { color: tintColor }]}>{label}</ThemedText>
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
      <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, Spacing.two) }]}>
      <View style={styles.bar}>
        <View style={styles.sideGroup}>
          {LEFT_TABS.map((tab) => (
            <TabBarButton key={tab.name} tab={tab} />
          ))}
        </View>

        <View style={styles.cameraSlot}>
          <Pressable
            onPress={takePhoto}
            style={({ pressed }) => [styles.cameraButton, pressed && styles.pressed]}>
            <SymbolView
              name={{ ios: 'camera.fill', android: 'photo_camera', web: 'photo_camera' }}
              size={28}
              tintColor={Colors.light.background}
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
    backgroundColor: Colors.light.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.light.backgroundSelected,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.two,
    paddingTop: Spacing.two,
    minHeight: 56,
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
    gap: Spacing.one,
    paddingVertical: Spacing.one,
  },
  tabIconImage: {
    width: 22,
    height: 22,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  cameraSlot: {
    width: 72,
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: -Spacing.four,
  },
  cameraButton: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: Colors.light.text,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 6,
  },
  pressed: {
    opacity: 0.85,
  },
});
