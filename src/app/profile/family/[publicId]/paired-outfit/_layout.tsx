import { Stack } from 'expo-router';

export default function PairedOutfitLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="matching" />
      <Stack.Screen name="result" />
    </Stack>
  );
}
