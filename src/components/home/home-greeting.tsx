import { StyleSheet, Text, View } from 'react-native';

import { PrikinHomeLayout } from '@/constants/prikin-home-tokens';
import { PrikinColors } from '@/constants/prikin-tokens';
import { formatHomeGreetingLine } from '@/utils/home-greeting';

type HomeGreetingProps = {
  displayName: string | null | undefined;
  profileHydrated: boolean;
};

export function HomeGreeting({ displayName, profileHydrated }: HomeGreetingProps) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.greeting}>{formatHomeGreetingLine(displayName, profileHydrated)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingTop: 4,
  },
  greeting: {
    fontSize: PrikinHomeLayout.greetingFontSize,
    fontWeight: '700',
    lineHeight: PrikinHomeLayout.greetingLineHeight,
    color: PrikinColors.textPrimary,
  },
});
