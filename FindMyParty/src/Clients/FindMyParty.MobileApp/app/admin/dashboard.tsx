import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { authService } from '@/services/authService';

export default function AdminDashboardScreen() {
  const insets = useSafeAreaInsets();
  const [userName, setUserName] = useState('Morrison Pub');

  useEffect(() => {
    authService.getUserInfo().then(info => {
      if (info?.userName) setUserName(info.userName);
    });
  }, []);

  const handleLogout = async () => {
    await authService.logout();
    router.replace('/onboarding');
  };

  // Initials avatar fallback
  const initials = userName
    .split(' ')
    .map(w => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <LinearGradient
        colors={['#000000', '#0A001A', '#7D08FA']}
        locations={[0, 0.62, 1]}
        style={StyleSheet.absoluteFill}
      />

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 30 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Top-right hamburger */}
        <TouchableOpacity style={styles.menuBtn} activeOpacity={0.7}>
          <Ionicons name="menu" size={30} color="rgba(255,255,255,0.9)" />
        </TouchableOpacity>

        {/* Avatar + Name */}
        <View style={styles.profileSection}>
          <View style={styles.avatarRing}>
            <LinearGradient
              colors={['#9B20FF', '#7D08FA']}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
            <BlurView intensity={0} tint="dark" style={styles.avatarInner}>
              <Text style={styles.avatarInitials}>{initials}</Text>
            </BlurView>
          </View>
          <Text style={styles.venueName}>{userName}</Text>
        </View>

        {/* Action buttons */}
        <View style={styles.buttonsArea}>
          {/* Edit profile — solid purple */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => router.push('/admin/edit-profile')}
            style={styles.btnWrapper}
          >
            <BlurView intensity={14} tint="light" style={styles.btnBlur}>
              <LinearGradient
                colors={['#7E0AFA', '#7E0AFA']}
                style={styles.btnGradient}
              >
                <Text style={styles.btnText}>Edit profile</Text>
              </LinearGradient>
            </BlurView>
          </TouchableOpacity>

          {/* Create party — purple → orange */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => router.push('/admin/create-party')}
            style={styles.btnWrapper}
          >
            <BlurView intensity={14} tint="light" style={styles.btnBlur}>
              <LinearGradient
                colors={['#7E0AFA', '#FF6E00']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.btnGradient}
              >
                <Text style={styles.btnText}>Create party</Text>
              </LinearGradient>
            </BlurView>
          </TouchableOpacity>

          {/* Manage parties — purple → orange */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => router.push('/admin/manage-parties')}
            style={styles.btnWrapper}
          >
            <BlurView intensity={14} tint="light" style={styles.btnBlur}>
              <LinearGradient
                colors={['#7E0AFA', '#FF6E00']}
                start={{ x: 0.07, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.btnGradient}
              >
                <Text style={styles.btnText}>Manage parties</Text>
              </LinearGradient>
            </BlurView>
          </TouchableOpacity>
        </View>

        {/* Log out — outline */}
        <TouchableOpacity
          activeOpacity={0.82}
          onPress={handleLogout}
          style={styles.logoutWrapper}
        >
          <BlurView intensity={20} tint="dark" style={styles.logoutBlur}>
            <LinearGradient
              colors={['#7E0AFA', '#5B0297']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.logoutGradient}
            >
              <Text style={styles.btnText}>Log out</Text>
            </LinearGradient>
          </BlurView>
        </TouchableOpacity>
      </ScrollView>

      {/* Chat Support FAB */}
      <TouchableOpacity style={[styles.fab, { bottom: insets.bottom + 24 }]} activeOpacity={0.85}>
        <LinearGradient
          colors={['#FF6E00', '#7D08FA']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.fabGradient}
        >
          <BlurView intensity={10} tint="light" style={StyleSheet.absoluteFill} />
          <Ionicons name="chatbubble-outline" size={32} color="#FFF" />
        </LinearGradient>
      </TouchableOpacity>
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
    paddingHorizontal: 36,
    gap: 10,
  },
  menuBtn: {
    alignSelf: 'flex-end',
    padding: 8,
    marginBottom: 10,
  },
  profileSection: {
    alignItems: 'center',
    gap: 10,
    marginBottom: 24,
  },
  avatarRing: {
    width: 157,
    height: 157,
    borderRadius: 80,
    padding: 3,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInner: {
    width: 148,
    height: 148,
    borderRadius: 74,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1A0030',
  },
  avatarInitials: {
    color: '#FFF',
    fontSize: 48,
    fontWeight: '700',
  },
  venueName: {
    color: '#FFF',
    fontSize: 32,
    fontWeight: '700',
    textAlign: 'center',
  },
  buttonsArea: {
    width: '100%',
    alignItems: 'center',
    gap: 14,
    marginTop: 10,
  },
  btnWrapper: {
    width: 331,
    height: 57,
    borderRadius: 48,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
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
    letterSpacing: 0.2,
  },
  logoutWrapper: {
    width: 331,
    height: 51,
    borderRadius: 48,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    marginTop: 40,
  },
  logoutBlur: {
    flex: 1,
  },
  logoutGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fab: {
    position: 'absolute',
    right: 20,
    width: 64,
    height: 64,
    borderRadius: 32,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    shadowColor: '#7D08FA',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 10,
  },
  fabGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
