import { useEffect } from 'react';
import { StyleSheet, Image, Text, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { router } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { authService } from '@/services/authService';
import { ApiConstants } from '@/constants/api';

async function checkBackendHealth(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`${ApiConstants.GatewayBaseUrl}/health`, {
      signal: controller.signal,
    });
    clearTimeout(id);
    return res.ok;
  } catch {
    return false;
  }
}

async function getInitialRoute(): Promise<'/onboarding' | '/(tabs)'> {
  try {
    const [authenticated, backendUp] = await Promise.all([
      authService.isAuthenticated(),
      checkBackendHealth(),
    ]);
    if (!backendUp) return '/onboarding';
    return authenticated ? '/(tabs)' : '/onboarding';
  } catch {
    return '/onboarding';
  }
}

export default function SplashPage() {
  const { height: H } = useWindowDimensions();
  const logoSize = H * 0.19;

  const opacity = useSharedValue(0);
  const translateY = useSharedValue(16);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  useEffect(() => {
    SplashScreen.hideAsync();

    opacity.value = withTiming(1, { duration: 700, easing: Easing.out(Easing.ease) });
    translateY.value = withTiming(0, { duration: 700, easing: Easing.out(Easing.ease) });

    const timer = setTimeout(async () => {
      const route = await getInitialRoute();
      router.replace(route);
    }, 1800);

    return () => clearTimeout(timer);
  }, []);

  return (
    <LinearGradient
      colors={['#05020A', '#0A0612', '#1F0F2E', '#3B0764']}
      locations={[0, 0.4, 0.75, 1]}
      style={styles.container}
    >
      <Animated.View style={[styles.content, animatedStyle]}>
        <Image
          source={require('@/assets/images/fmp_logo.png')}
          style={{ width: logoSize, height: logoSize }}
          resizeMode="contain"
        />
        <Text style={styles.title}>FindMyParty</Text>
      </Animated.View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    alignItems: 'center',
    gap: 20,
  },
  title: {
    color: '#F5EBFF',
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: 2,
    textShadowColor: '#B026FF',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 18,
  },
});
