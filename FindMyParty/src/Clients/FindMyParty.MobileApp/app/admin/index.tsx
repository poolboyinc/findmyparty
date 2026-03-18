import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  StatusBar,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';

export default function AdminSplashScreen() {
  const insets = useSafeAreaInsets();
  const { height: H } = useWindowDimensions();
  const logoSize = H * 0.213;  // 180/844

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <LinearGradient
        colors={['#000000', '#0A001A', '#7D08FA']}
        locations={[0, 0.57, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Centre content */}
      <View style={[styles.content, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 30 }]}>
        <View style={styles.logoArea}>
          <Image
            source={require('@/assets/images/fmp_logo.png')}
            style={{ width: logoSize, height: logoSize }}
            resizeMode="contain"
          />
          <Text style={styles.brandName}>FindMyParty</Text>
          <Text style={styles.portalTitle}>Admin Portal</Text>
          <Text style={styles.subtitle}>Manage your parties effortlessly</Text>
        </View>

        {/* Jump In button — liquid glass pill */}
        <TouchableOpacity
          activeOpacity={0.82}
          onPress={() => router.push('/admin/login')}
          style={styles.btnWrapper}
        >
          <BlurView intensity={18} tint="light" style={styles.btnBlur}>
            <LinearGradient
              colors={['#9B20FF', '#7E0AFA']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.btnGradient}
            >
              <Text style={styles.btnText}>Jump In</Text>
            </LinearGradient>
          </BlurView>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 36,
  },
  logoArea: {
    alignItems: 'center',
    gap: 10,
    marginTop: 40,
  },
  // logo size applied inline via useWindowDimensions
  brandName: {
    color: '#FFF',
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  portalTitle: {
    color: '#FFF',
    fontSize: 40,
    fontWeight: '600',
    letterSpacing: 0.2,
    marginTop: 4,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 22,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 20,
    lineHeight: 30,
  },
  btnWrapper: {
    width: '100%',
    height: 51,
    borderRadius: 48,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(157,157,157,0.6)',
    marginBottom: 20,
  },
  btnBlur: {
    flex: 1,
  },
  btnGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
