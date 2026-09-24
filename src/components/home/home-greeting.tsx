import { StyleSheet, Text, View } from 'react-native';

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
    paddingTop: 2,
  },
  greeting: {
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 24,
    color: PrikinColors.textPrimary,
  },
});
