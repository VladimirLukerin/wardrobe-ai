import {
  Tabs,
  TabList,
  TabTrigger,
  TabSlot,
  TabTriggerSlotProps,
  TabListProps,
} from 'expo-router/ui';
import { SymbolView } from 'expo-symbols';
import { Pressable, View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from './themed-text';

import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { captureWardrobePhoto } from '@/utils/capture-wardrobe-photo';

type TabIconName = {
  ios: 'house.fill' | 'tshirt.fill' | 'sparkles' | 'person.fill' | 'camera.fill';
  android: 'home' | 'checkroom' | 'auto_awesome' | 'person' | 'photo_camera';
  web: 'home' | 'checkroom' | 'auto_awesome' | 'person' | 'photo_camera';
};

export default function AppTabs() {
  return (
    <Tabs>
      <TabSlot style={styles.slot} />
      <TabList asChild>
        <CustomTabList>
          <TabTrigger name="home" href="/" asChild>
            <TabButton icon={{ ios: 'house.fill', android: 'home', web: 'home' }}>Главная</TabButton>
          </TabTrigger>
          <TabTrigger name="garderob" href="/garderob" asChild>
            <TabButton icon={{ ios: 'tshirt.fill', android: 'checkroom', web: 'checkroom' }}>
              Гардероб
            </TabButton>
          </TabTrigger>

          <CameraTabButton />

          <TabTrigger name="create-outfit" href="/create-outfit" asChild>
            <TabButton icon={{ ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' }}>
              Образы
            </TabButton>
          </TabTrigger>
          <TabTrigger name="profile" href="/profile" asChild>
            <TabButton icon={{ ios: 'person.fill', android: 'person', web: 'person' }}>
              Профиль
            </TabButton>
          </TabTrigger>
        </CustomTabList>
      </TabList>
    </Tabs>
  );
}

function CameraTabButton() {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Сфотографировать вещь"
      onPress={() => {
        void captureWardrobePhoto();
      }}
      style={({ pressed }) => [styles.cameraButton, pressed && styles.pressed]}>
      <View style={styles.cameraButtonInner}>
        <SymbolView
          name={{ ios: 'camera.fill', android: 'photo_camera', web: 'photo_camera' }}
          size={26}
          tintColor={Colors.light.background}
        />
      </View>
    </Pressable>
  );
}

type TabButtonProps = TabTriggerSlotProps & {
  icon: TabIconName;
  children: string;
};

function TabButton({ children, isFocused, icon, ...props }: TabButtonProps) {
  const tint = isFocused ? Colors.light.text : Colors.light.textSecondary;

  return (
    <Pressable {...props} style={({ pressed }) => [styles.tabButton, pressed && styles.pressed]}>
      <SymbolView name={icon} size={22} tintColor={tint} />
      <ThemedText type="small" style={[styles.tabLabel, { color: tint }]}>
        {children}
      </ThemedText>
    </Pressable>
  );
}

function CustomTabList(props: TabListProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      {...props}
      style={[styles.tabListContainer, { paddingBottom: Math.max(insets.bottom, Spacing.two) }]}>
      <View style={styles.innerContainer}>{props.children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  slot: {
    height: '100%',
  },
  tabListContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    paddingTop: Spacing.two,
    paddingHorizontal: Spacing.two,
    backgroundColor: Colors.light.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.light.backgroundSelected,
    alignItems: 'center',
  },
  innerContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.one,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.half,
    paddingVertical: Spacing.one,
    minHeight: 52,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  cameraButton: {
    width: 64,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -22,
    marginBottom: Spacing.one,
  },
  cameraButtonInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.light.text,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  pressed: {
    opacity: 0.7,
  },
});
