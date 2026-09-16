import { Stack } from 'expo-router';

export default function WardrobeItemLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="outfits" />
    </Stack>
  );
}
