import { useEffect } from 'react';
import { StyleSheet, Image, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';

async function getInitialRoute(): Promise<'/onboarding' | '/(tabs)'> {
  try {
    const token = await SecureStore.getItemAsync('auth_token');
    return token ? '/(tabs)' : '/onboarding';
  } catch {
    return '/onboarding';
  }
}

export default function SplashPage() {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(16);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  useEffect(() => {
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
      colors={['#000000', '#000000', '#1A0035', '#4A0088']}
      locations={[0, 0.45, 0.72, 1]}
      style={styles.container}
    >
      <Animated.View style={[styles.content, animatedStyle]}>
        <Image
          source={require('@/assets/images/fmp_logo.png')}
          style={styles.logo}
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
    gap: 16,
  },
  logo: {
    width: 160,
    height: 160,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
