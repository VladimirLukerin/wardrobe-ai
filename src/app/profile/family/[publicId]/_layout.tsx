import { Stack } from 'expo-router';

import { ProtectedAccountGate } from '@/components/protected-account-gate';

export default function FamilyMemberLayout() {
  return (
    <ProtectedAccountGate>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="wardrobe" />
        <Stack.Screen name="item/[itemId]" />
        <Stack.Screen name="outfits" />
        <Stack.Screen name="paired-outfit" />
      </Stack>
    </ProtectedAccountGate>
  );
}
