import { Stack } from 'expo-router';

export default function FamilyMemberLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="wardrobe" />
      <Stack.Screen name="outfits" />
      <Stack.Screen name="paired-outfit" />
    </Stack>
  );
}
