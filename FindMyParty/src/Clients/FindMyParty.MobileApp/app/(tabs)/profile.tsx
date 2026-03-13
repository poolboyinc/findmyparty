import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  StatusBar,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';

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
          <Ionicons name={icon} size={22} color="#A855F7" />
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
    gap: 4,
  },
  iconWrapper: {
    width: 46,
    height: 46,
    borderRadius: 23,
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
        shadowRadius: 10,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  value: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '800',
  },
  label: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 14,
  },
  separator: {
    width: 1,
    height: 52,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function ProfileScreen() {
  const insets = useSafeAreaInsets();

  const handleSavedEvents = () => {
    // TODO: navigate to saved events
  };

  const handleEditProfile = () => {
    // TODO: navigate to edit profile
  };

  const handleSignOut = () => {
    // TODO: clear auth tokens, then navigate back to onboarding
    router.replace('/onboarding');
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Full-screen gradient background */}
      <LinearGradient
        colors={['rgba(0,0,0,0.98)', 'rgba(125,8,250,0.95)', 'rgba(255,110,0,0.92)']}
        locations={[0.19, 0.65, 1.0]}
        style={StyleSheet.absoluteFill}
      />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Avatar ── */}
        <View style={styles.avatarSection}>
          <View style={styles.avatarGlow}>
            <View style={styles.avatarRing}>
              <View style={styles.avatarInner}>
                <Ionicons name="person" size={70} color="rgba(255,255,255,0.9)" />
              </View>
            </View>
          </View>
        </View>

        {/* ── Name + Username ── */}
        <View style={styles.nameSection}>
          <Text style={styles.name}>Jane Doe</Text>
          <Text style={styles.username}>@janedoe</Text>
        </View>

        {/* ── Stats ── */}
        <View style={styles.statsCard}>
          <StatItem
            icon="calendar-outline"
            value="24"
            label={'Parties\nAttended'}
            showSeparator
          />
          <StatItem
            icon="trophy-outline"
            value="8"
            label={'Achieve-\nments'}
            showSeparator
          />
          <StatItem
            icon="heart-outline"
            value="47"
            label={'Favorites'}
          />
        </View>

        {/* ── Action buttons ── */}
        <View style={styles.actionRow}>
          {/* Saved Events */}
          <TouchableOpacity
            style={styles.actionBtnWrapper}
            onPress={handleSavedEvents}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={['#7D08FA', '#FF6E00']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.actionBtnGradient}
            >
              <View style={styles.actionBtnBorder}>
                <Ionicons name="bookmark-outline" size={18} color="#FFF" />
                <Text style={styles.actionBtnText}>Saved Events</Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>

          {/* Edit Profile */}
          <TouchableOpacity
            style={styles.actionBtnWrapper}
            onPress={handleEditProfile}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={['#7E0AFA', '#5700B4']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.actionBtnGradient}
            >
              <View style={[styles.actionBtnBorder, { borderColor: '#7E0AFA' }]}>
                <Ionicons name="pencil-outline" size={18} color="#FFF" />
                <Text style={styles.actionBtnText}>Edit Profile</Text>
              </View>
            </LinearGradient>
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
            <Ionicons name="log-out-outline" size={20} color="rgba(255,255,255,0.85)" />
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
        <Ionicons name={icon} size={20} color="#CA99FF" />
      </View>
      <Text style={menuStyles.label}>{label}</Text>
      <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.3)" />
    </TouchableOpacity>
  );
}

const menuStyles = StyleSheet.create({
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 4,
    gap: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  iconWrapper: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(125,8,250,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    flex: 1,
    color: 'rgba(255,255,255,0.8)',
    fontSize: 15,
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
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  // Avatar
  avatarSection: {
    marginBottom: 20,
  },
  avatarGlow: {
    width: 180,
    height: 180,
    borderRadius: 90,
    alignItems: 'center',
    justifyContent: 'center',
    // Purple glow
    ...Platform.select({
      ios: {
        shadowColor: '#A600FF',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 30,
      },
      android: {
        elevation: 20,
      },
    }),
  },
  avatarRing: {
    width: 168,
    height: 168,
    borderRadius: 84,
    padding: 3,
    backgroundColor: 'rgba(125,8,250,0.4)',
    borderWidth: 2,
    borderColor: 'rgba(125,8,250,0.6)',
  },
  avatarInner: {
    flex: 1,
    borderRadius: 80,
    backgroundColor: '#3D0880',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Name
  nameSection: {
    alignItems: 'center',
    gap: 6,
    marginBottom: 28,
  },
  name: {
    color: '#FFF',
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  username: {
    color: '#CA99FF',
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  // Stats
  statsCard: {
    flexDirection: 'row',
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 24,
    paddingVertical: 20,
    paddingHorizontal: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  // Action buttons
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    marginBottom: 24,
  },
  actionBtnWrapper: {
    flex: 1,
    borderRadius: 30,
    overflow: 'hidden',
    height: 54,
  },
  actionBtnGradient: {
    flex: 1,
  },
  actionBtnBorder: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 30,
    borderWidth: 1.5,
    borderColor: '#FF26E2',
    margin: 1.5,
  },
  actionBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
  // Divider
  divider: {
    width: '100%',
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginBottom: 8,
  },
  // Menu
  menuSection: {
    width: '100%',
    marginBottom: 24,
  },
  // Sign out
  signOutWrapper: {
    width: '100%',
    height: 54,
    borderRadius: 30,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(112,58,250,0.35)',
  },
  signOutGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  signOutText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 16,
    fontWeight: '700',
  },
});
