import { Stack } from 'expo-router';

export default function CreateOutfitLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="build" />
    </Stack>
  );
}
