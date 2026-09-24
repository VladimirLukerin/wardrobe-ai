import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';

type FamilyMemberAvatarProps = {
  initial: string;
  size?: number;
};

export function FamilyMemberAvatar({ initial, size = 96 }: FamilyMemberAvatarProps) {
  return (
    <View
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
        },
      ]}>
      <ThemedText style={[styles.initial, { fontSize: Math.round(size * 0.34) }]}>{initial}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    backgroundColor: Colors.light.backgroundElement,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: {
    fontWeight: '600',
    color: Colors.light.textSecondary,
  },
});
