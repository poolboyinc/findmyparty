import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  StatusBar,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { s, vs, ms } from '@/constants/responsive';
import { authService } from '@/services/authService';

export default function AdminLoginScreen() {
  const insets = useSafeAreaInsets();
  const { height: H } = useWindowDimensions();
  const logoSize = H * 0.154;  // 130/844
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Please fill in all fields.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const success = await authService.login(email.trim(), password);
      if (!success) {
        setError('Invalid credentials. Please try again.');
        return;
      }
      const userInfo = await authService.getUserInfo();
      const role = userInfo?.role ?? '';
      if (role === 'Host' || role === 'Admin') {
        router.replace('/admin/dashboard');
      } else {
        await authService.logout();
        setError('Access denied. Host or Admin account required.');
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <LinearGradient
        colors={['#000000', '#0A001A', '#7D08FA']}
        locations={[0, 0.13, 1]}
        style={StyleSheet.absoluteFill}
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 30 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Logo */}
          <View style={styles.logoArea}>
            <Image
              source={require('@/assets/images/fmp_logo.png')}
              style={{ width: logoSize, height: logoSize }}
              resizeMode="contain"
            />
            <Text style={styles.brandName}>FindMyParty</Text>
          </View>

          {/* Form */}
          <View style={styles.formArea}>
            {/* Username / Email field */}
            <BlurView intensity={12} tint="dark" style={styles.fieldBlur}>
              <View style={styles.fieldRow}>
                <Ionicons name="person-outline" size={ms(26)} color="rgba(255,255,255,0.75)" />
                <TextInput
                  style={styles.input}
                  placeholder="Username"
                  placeholderTextColor="rgba(255,255,255,0.5)"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  returnKeyType="next"
                />
              </View>
              <View style={styles.fieldUnderline} />
            </BlurView>

            {/* Password field */}
            <BlurView intensity={12} tint="dark" style={[styles.fieldBlur, { marginTop: vs(24) }]}>
              <View style={styles.fieldRow}>
                <Ionicons name="lock-closed-outline" size={ms(26)} color="rgba(255,255,255,0.75)" />
                <TextInput
                  style={styles.input}
                  placeholder="Password"
                  placeholderTextColor="rgba(255,255,255,0.5)"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  returnKeyType="done"
                  onSubmitEditing={handleLogin}
                />
                <TouchableOpacity onPress={() => setShowPassword(v => !v)} activeOpacity={0.7}>
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={ms(22)}
                    color="rgba(255,255,255,0.5)"
                  />
                </TouchableOpacity>
              </View>
              <View style={styles.fieldUnderline} />
            </BlurView>

            {/* Error message */}
            {error && <Text style={styles.errorText}>{error}</Text>}
          </View>

          {/* Jump In button */}
          <TouchableOpacity
            activeOpacity={0.82}
            onPress={handleLogin}
            disabled={loading}
            style={styles.btnWrapper}
          >
            <BlurView intensity={18} tint="light" style={styles.btnBlur}>
              <LinearGradient
                colors={['#9B20FF', '#7E0AFA']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.btnGradient}
              >
                {loading ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.btnText}>Jump In</Text>
                )}
              </LinearGradient>
            </BlurView>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
  },
  content: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: s(36),
    gap: vs(40),
  },
  logoArea: {
    alignItems: 'center',
    gap: vs(10),
  },
  brandName: {
    color: '#FFF',
    fontSize: ms(26),
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  formArea: {
    width: '100%',
  },
  fieldBlur: {
    overflow: 'hidden',
    borderRadius: s(4),
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: s(8),
    paddingVertical: vs(10),
    gap: s(14),
  },
  input: {
    flex: 1,
    color: '#FFF',
    fontSize: ms(22),
    fontWeight: '300',
  },
  fieldUnderline: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.45)',
    marginHorizontal: s(8),
  },
  errorText: {
    color: '#FF6B6B',
    fontSize: ms(14),
    fontWeight: '500',
    textAlign: 'center',
    marginTop: vs(16),
  },
  btnWrapper: {
    width: '100%',
    height: vs(51),
    borderRadius: s(48),
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(157,157,157,0.6)',
    marginBottom: vs(10),
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
    fontSize: ms(20),
    fontWeight: '700',
  },
});
