import { useFonts } from 'expo-font';
import { Platform } from 'react-native';

export function usePrikinFonts(): { fontsLoaded: boolean; fontFamily: { sans: string; handwritten: string } } {
  const [loaded] = useFonts({
    Caveat: require('../../assets/fonts/Caveat.ttf'),
  });

  const sansLoaded = Platform.OS === 'ios' || Platform.OS === 'web' || Platform.OS === 'android';

  const sans = Platform.select({
    ios: 'Arial',
    android: 'sans-serif',
    default: 'sans-serif',
    web: 'Arial, Helvetica, sans-serif',
  }) as string;

  return {
    fontsLoaded: loaded && sansLoaded,
    fontFamily: {
      sans,
      handwritten: loaded ? 'Caveat' : sans,
    },
  };
}
