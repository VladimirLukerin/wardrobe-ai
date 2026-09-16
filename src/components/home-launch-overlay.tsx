import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  cancelAnimation,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { APP_BRAND_NAME, HOME_LAUNCH_DURATION_MS } from '@/constants/app-brand';
import { Colors, Spacing } from '@/constants/theme';

type HomeLaunchOverlayProps = {
  onComplete: () => void;
};

export function HomeLaunchOverlay({ onComplete }: HomeLaunchOverlayProps) {
  const insets = useSafeAreaInsets();
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(
      1,
      {
        duration: HOME_LAUNCH_DURATION_MS,
        easing: Easing.out(Easing.cubic),
      },
      (finished) => {
        if (finished) {
          runOnJS(onComplete)();
        }
      },
    );
    return () => cancelAnimation(progress);
  }, [onComplete, progress]);

  const screenHeight = Dimensions.get('window').height;
  const headerCenterY = insets.top + Spacing.three + 14;
  const startTranslateY = screenHeight / 2 - headerCenterY;

  const brandAnimatedStyle = useAnimatedStyle(() => {
    const translateY = startTranslateY * (1 - progress.value);
    const scale = 0.5 + (1 - progress.value) * 0.5;

    return {
      transform: [{ translateY }, { scale }],
      opacity: progress.value < 0.92 ? 1 : 1 - (progress.value - 0.92) / 0.08,
    };
  });

  const overlayAnimatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value < 0.85 ? 1 : 1 - (progress.value - 0.85) / 0.15,
  }));

  return (
    <Animated.View onLayout={() => { void SplashScreen.hideAsync().catch(() => {}); }} style={[styles.overlay, overlayAnimatedStyle]}>
      <View style={[styles.brandAnchor, { top: headerCenterY }]}>
        <Animated.Text style={[styles.launchBrand, brandAnimatedStyle]}>{APP_BRAND_NAME}</Animated.Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: Colors.light.background,
    zIndex: 200,
  },
  brandAnchor: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  launchBrand: {
    fontSize: 34,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: Colors.light.text,
    textAlign: 'center',
  },
});
