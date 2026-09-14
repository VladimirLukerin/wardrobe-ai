import { DefaultTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import { WardrobeProvider } from '@/contexts/wardrobe-context';

SplashScreen.preventAutoHideAsync();

export default function TabLayout() {
  return (
    <WardrobeProvider>
      <ThemeProvider value={DefaultTheme}>
        <AnimatedSplashOverlay />
        <AppTabs />
      </ThemeProvider>
    </WardrobeProvider>
  );
}
