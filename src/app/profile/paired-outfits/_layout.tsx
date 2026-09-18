import { Stack } from 'expo-router';

import { ProtectedAccountGate } from '@/components/protected-account-gate';

export default function SavedPairedOutfitsLayout() {
  return (
    <ProtectedAccountGate>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="[id]" />
      </Stack>
    </ProtectedAccountGate>
  );
}
