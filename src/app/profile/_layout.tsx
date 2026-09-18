import { Stack } from 'expo-router';

export default function ProfileLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="my-style" />
      <Stack.Screen name="family/[publicId]/index" />
      <Stack.Screen name="family/[publicId]/wardrobe" />
    </Stack>
  );
}
