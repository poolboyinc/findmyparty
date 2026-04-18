import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  StatusBar,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useProfile } from '@/hooks/useProfile';
import { s, vs, ms } from '@/constants/responsive';
import { AmbientBackdrop } from '@/components/ui/ambient-backdrop';

// ─── Stat item ────────────────────────────────────────────────────────────────
function StatItem({
  icon,
  value,
  label,
  showSeparator,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  value: string;
  label: string;
  showSeparator?: boolean;
}) {
  return (
    <View style={statStyles.wrapper}>
      <View style={statStyles.item}>
        <View style={statStyles.iconWrapper}>
          <Ionicons name={icon} size={ms(22)} color="#A855F7" />
        </View>
        <Text style={statStyles.value}>{value}</Text>
        <Text style={statStyles.label}>{label}</Text>
      </View>
      {showSeparator && <View style={statStyles.separator} />}
    </View>
  );
}

const statStyles = StyleSheet.create({
  wrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  item: {
    flex: 1,
    alignItems: 'center',
    gap: vs(4),
  },
  iconWrapper: {
    width: s(46),
    height: vs(46),
    borderRadius: s(23),
    backgroundColor: 'rgba(125,8,250,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(125,8,250,0.3)',
    // Purple glow
    ...Platform.select({
      ios: {
        shadowColor: '#A600FF',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.6,
        shadowRadius: s(10),
      },
      android: {
        elevation: 6,
      },
    }),
  },
  value: {
    color: '#FFF',
    fontSize: ms(20),
    fontWeight: '800',
  },
  label: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: ms(11),
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: vs(14),
  },
  separator: {
    width: 1,
    height: vs(52),
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { height: H } = useWindowDimensions();
  const { userInfo, bookingCount, load, logout } = useProfile();

  const avatarGlowSize = H * 0.213;   // 180/844
  const avatarRingSize = H * 0.199;   // 168/844

  useFocusEffect(
    React.useCallback(() => {
      load();
    }, [load])
  );

  const handleSavedEvents = () => {
    router.push('/my-bookings');
  };

  const handleEditProfile = () => {
    // TODO: navigate to edit profile
  };

  const handleSignOut = async () => {
    await logout();
    router.replace('/onboarding');
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <AmbientBackdrop variant="default" />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + vs(24), paddingBottom: 128 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Avatar ── */}
        <View style={styles.avatarSection}>
          <View style={[styles.avatarGlow, { width: avatarGlowSize, height: avatarGlowSize, borderRadius: avatarGlowSize / 2 }]}>
            <View style={[styles.avatarRing, { width: avatarRingSize, height: avatarRingSize, borderRadius: avatarRingSize / 2 }]}>
              <View style={styles.avatarInner}>
                <Ionicons name="person" size={avatarRingSize * 0.42} color="rgba(255,255,255,0.9)" />
              </View>
            </View>
          </View>
        </View>

        {/* ── Name + Username ── */}
        <View style={styles.nameSection}>
          <Text style={styles.name}>{userInfo?.userName ?? '—'}</Text>
          <Text style={styles.username}>{userInfo?.email ?? ''}</Text>
        </View>

        {/* ── Stats ── */}
        <View style={styles.statsCard}>
          <StatItem
            icon="calendar-outline"
            value={String(bookingCount)}
            label={'Parties\nAttended'}
            showSeparator
          />
          <StatItem
            icon="trophy-outline"
            value="—"
            label={'Achieve-\nments'}
            showSeparator
          />
          <StatItem
            icon="heart-outline"
            value="—"
            label={'Favorites'}
          />
        </View>

        {/* ── Action buttons ── */}
        <View style={styles.actionRow}>
          {/* Saved Events — primary neon CTA */}
          <TouchableOpacity
            style={styles.actionBtnWrapper}
            onPress={handleSavedEvents}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={['#B026FF', '#7E22CE']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.actionBtnGradient}
            >
              <View style={[styles.actionBtnBorder, { borderColor: 'rgba(255,255,255,0.20)' }]}>
                <Ionicons name="bookmark" size={ms(18)} color="#FFF" />
                <Text style={styles.actionBtnText}>Saved Events</Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>

          {/* Edit Profile — ghost variant */}
          <TouchableOpacity
            style={styles.actionBtnWrapper}
            onPress={handleEditProfile}
            activeOpacity={0.85}
          >
            <View style={styles.ghostBtn}>
              <Ionicons name="pencil-outline" size={ms(18)} color="#D8B4FE" />
              <Text style={[styles.actionBtnText, { color: '#D8B4FE' }]}>Edit Profile</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* ── Divider ── */}
        <View style={styles.divider} />

        {/* ── Menu items ── */}
        <View style={styles.menuSection}>
          <MenuItem icon="notifications-outline" label="Notifications" onPress={() => { /* TODO */ }} />
          <MenuItem icon="shield-outline" label="Privacy & Security" onPress={() => { /* TODO */ }} />
          <MenuItem icon="help-circle-outline" label="Help & Support" onPress={() => { /* TODO */ }} />
          <MenuItem icon="star-outline" label="Rate the App" onPress={() => { /* TODO */ }} />
        </View>

        {/* ── Sign Out ── */}
        <TouchableOpacity
          style={styles.signOutWrapper}
          onPress={handleSignOut}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={['#6500D2', '#7E0AFA']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.signOutGradient}
          >
            <Ionicons name="log-out-outline" size={ms(20)} color="rgba(255,255,255,0.85)" />
            <Text style={styles.signOutText}>Sign Out</Text>
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

// ─── Menu Item ────────────────────────────────────────────────────────────────
function MenuItem({
  icon,
  label,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={menuStyles.item} onPress={onPress} activeOpacity={0.7}>
      <View style={menuStyles.iconWrapper}>
        <Ionicons name={icon} size={ms(20)} color="#CA99FF" />
      </View>
      <Text style={menuStyles.label}>{label}</Text>
      <Ionicons name="chevron-forward" size={ms(16)} color="rgba(255,255,255,0.3)" />
    </TouchableOpacity>
  );
}

const menuStyles = StyleSheet.create({
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: vs(14),
    paddingHorizontal: s(4),
    gap: s(14),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  iconWrapper: {
    width: s(38),
    height: vs(38),
    borderRadius: s(19),
    backgroundColor: 'rgba(125,8,250,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    flex: 1,
    color: 'rgba(255,255,255,0.8)',
    fontSize: ms(15),
    fontWeight: '500',
  },
});

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
  },
  content: {
    paddingHorizontal: s(24),
    alignItems: 'center',
  },
  // Avatar
  avatarSection: {
    marginBottom: vs(20),
  },
  avatarGlow: {
    // width/height/borderRadius applied inline via useWindowDimensions
    alignItems: 'center',
    justifyContent: 'center',
    // Purple glow
    ...Platform.select({
      ios: {
        shadowColor: '#A600FF',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: s(30),
      },
      android: {
        elevation: 20,
      },
    }),
  },
  avatarRing: {
    // width/height/borderRadius applied inline via useWindowDimensions
    padding: s(3),
    backgroundColor: 'rgba(125,8,250,0.4)',
    borderWidth: 2,
    borderColor: 'rgba(125,8,250,0.6)',
  },
  avatarInner: {
    flex: 1,
    borderRadius: s(80),
    backgroundColor: '#3D0880',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Name
  nameSection: {
    alignItems: 'center',
    gap: vs(6),
    marginBottom: vs(28),
  },
  name: {
    color: '#FFF',
    fontSize: ms(32),
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  username: {
    color: '#CA99FF',
    fontSize: ms(18),
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  // Stats
  statsCard: {
    flexDirection: 'row',
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: s(24),
    paddingVertical: vs(20),
    paddingHorizontal: s(16),
    marginBottom: vs(24),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  // Action buttons
  actionRow: {
    flexDirection: 'row',
    gap: s(12),
    width: '100%',
    marginBottom: vs(24),
  },
  actionBtnWrapper: {
    flex: 1,
    borderRadius: s(30),
    overflow: 'hidden',
    height: vs(54),
  },
  actionBtnGradient: {
    flex: 1,
  },
  actionBtnBorder: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: s(6),
    borderRadius: s(30),
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.20)',
    margin: 1.5,
  },
  ghostBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: s(6),
    borderRadius: s(30),
    borderWidth: 1,
    borderColor: 'rgba(216,180,254,0.32)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  actionBtnText: {
    color: '#FFF',
    fontSize: ms(13),
    fontWeight: '700',
  },
  // Divider
  divider: {
    width: '100%',
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginBottom: vs(8),
  },
  // Menu
  menuSection: {
    width: '100%',
    marginBottom: vs(24),
  },
  // Sign out
  signOutWrapper: {
    width: '100%',
    height: vs(54),
    borderRadius: s(30),
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(112,58,250,0.35)',
  },
  signOutGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: s(8),
  },
  signOutText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: ms(16),
    fontWeight: '700',
  },
});
