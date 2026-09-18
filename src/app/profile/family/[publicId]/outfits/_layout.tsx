import { Stack } from 'expo-router';

export default function FamilyOutfitsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[outfitId]" />
    </Stack>
  );
}
