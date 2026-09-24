import { StyleSheet, Text, View } from 'react-native';

import { useAccount } from '@/contexts/account-context';
import { PrikinHomeLayout } from '@/constants/prikin-home-tokens';
import { PrikinColors } from '@/constants/prikin-tokens';
import { formatHomeGreetingLine } from '@/utils/home-greeting';
import { isAccountProtected } from '@/utils/account-is-protected';

type HomeGreetingProps = {
  displayName: string | null | undefined;
  profileHydrated: boolean;
};

export function HomeGreeting({ displayName, profileHydrated }: HomeGreetingProps) {
  const { user } = useAccount();
  const isProtectedAccount = isAccountProtected(user);

  return (
    <View style={styles.wrap}>
      <Text style={styles.greeting}>
        {formatHomeGreetingLine(displayName, profileHydrated, { isProtectedAccount })}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingTop: 2,
  },
  greeting: {
    fontSize: PrikinHomeLayout.greetingFontSize,
    fontWeight: '700',
    lineHeight: PrikinHomeLayout.greetingLineHeight,
    color: PrikinColors.textPrimary,
  },
});
