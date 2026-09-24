import { SymbolView } from 'expo-symbols';
import { StyleSheet, View } from 'react-native';

import { PrikinColors } from '@/constants/prikin-tokens';

export type PrikinTabIconName = 'home' | 'wardrobe' | 'outfits' | 'profile';

const ICONS: Record<
  PrikinTabIconName,
  { ios: string; android: string; web: string; iosFilled: string; androidFilled: string; webFilled: string }
> = {
  home: {
    ios: 'house',
    android: 'home',
    web: 'home',
    iosFilled: 'house.fill',
    androidFilled: 'home',
    webFilled: 'home',
  },
  wardrobe: {
    ios: 'hanger',
    android: 'checkroom',
    web: 'checkroom',
    iosFilled: 'hanger',
    androidFilled: 'checkroom',
    webFilled: 'checkroom',
  },
  outfits: {
    ios: 'tshirt',
    android: 'checkroom',
    web: 'checkroom',
    iosFilled: 'tshirt.fill',
    androidFilled: 'checkroom',
    webFilled: 'checkroom',
  },
  profile: {
    ios: 'person',
    android: 'person',
    web: 'person',
    iosFilled: 'person.fill',
    androidFilled: 'person',
    webFilled: 'person',
  },
};

export function PrikinTabIcon({
  name,
  focused,
  size = 24,
}: {
  name: PrikinTabIconName;
  focused: boolean;
  size?: number;
}) {
  const config = ICONS[name];
  const tint = focused ? PrikinColors.tabActive : PrikinColors.tabInactive;

  return (
    <View style={styles.wrap}>
      <SymbolView
        name={{
          ios: (focused ? config.iosFilled : config.ios) as 'house',
          android: (focused ? config.androidFilled : config.android) as 'home',
          web: (focused ? config.webFilled : config.web) as 'home',
        }}
        size={size}
        tintColor={tint}
        weight={focused ? 'semibold' : 'regular'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
