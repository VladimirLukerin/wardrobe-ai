import { Stack } from 'expo-router';

export default function GarderobLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="add-item" />
      <Stack.Screen name="[id]" />
    </Stack>
  );
}
