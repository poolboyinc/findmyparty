import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ScrollView,
  Alert,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { s, vs, ms } from '@/constants/responsive';
import { adminService } from '@/services/adminService';
import type { HostProfile } from '@/types/auth';

const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] as const;

export default function EditProfileScreen() {
  const insets = useSafeAreaInsets();
  const { height: H } = useWindowDimensions();
  const avatarSize = H * 0.186;       // 157/844
  const avatarInnerSize = H * 0.175;  // 148/844

  const [hostProfile, setHostProfile] = useState<HostProfile | null>(null);

  useEffect(() => {
    adminService.getHostProfile().then(profile => {
      if (profile) setHostProfile(profile);
    });
  }, []);

  const [openTime, setOpenTime] = useState(() => {
    const d = new Date(); d.setHours(8, 0, 0, 0); return d;
  });
  const [closeTime, setCloseTime] = useState(() => {
    const d = new Date(); d.setHours(3, 0, 0, 0); return d;
  });
  const [showOpenPicker, setShowOpenPicker] = useState(false);
  const [showClosePicker, setShowClosePicker] = useState(false);
  const [activeDays, setActiveDays] = useState<Set<string>>(
    new Set(['TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'])
  );

  const formatTime = (d: Date) =>
    d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

  const toggleDay = (day: string) => {
    setActiveDays(prev => {
      const next = new Set(prev);
      next.has(day) ? next.delete(day) : next.add(day);
      return next;
    });
  };

  const handleSave = () => {
    // TODO: Persist working hours & days via venue profile API endpoint
    Alert.alert('Saved', 'Profile settings updated.');
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <LinearGradient
        colors={['#000000', '#0A001A', '#7D08FA']}
        locations={[0, 0.62, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={ms(28)} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Profile</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Avatar + Name */}
        <View style={styles.profileSection}>
          <View style={[styles.avatarRing, { width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2 }]}>
            <LinearGradient
              colors={['#9B20FF', '#7D08FA']}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
            <View style={[styles.avatarInner, { width: avatarInnerSize, height: avatarInnerSize, borderRadius: avatarInnerSize / 2 }]}>
              <Text style={styles.avatarInitials}>
                {hostProfile?.venueName
                  ? hostProfile.venueName.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
                  : '??'}
              </Text>
            </View>
          </View>
          <Text style={styles.venueName}>{hostProfile?.venueName ?? '—'}</Text>
          <TouchableOpacity style={styles.editRow} activeOpacity={0.7}>
            <Text style={styles.editLabel}>Edit</Text>
            <Ionicons name="create-outline" size={ms(20)} color="rgba(255,255,255,0.5)" />
          </TouchableOpacity>
        </View>

        {/* ─── Venue Location (read-only, set by FindMyParty team) ─── */}
        <Text style={styles.sectionTitle}>Venue Location</Text>
        <BlurView intensity={10} tint="dark" style={styles.locationBox}>
          <Ionicons name="location-outline" size={ms(22)} color="rgba(255,255,255,0.6)" />
          <View style={styles.locationText}>
            {hostProfile ? (
              <>
                <Text style={styles.locationAddress}>{hostProfile.address}</Text>
                <Text style={styles.locationCoords}>
                  {hostProfile.latitude.toFixed(5)}, {hostProfile.longitude.toFixed(5)}
                </Text>
              </>
            ) : (
              <Text style={styles.locationAddress}>Loading venue location…</Text>
            )}
          </View>
          <Ionicons name="lock-closed-outline" size={ms(18)} color="rgba(255,255,255,0.35)" />
        </BlurView>
        <Text style={styles.locationHint}>
          Location is managed by the FindMyParty team. Contact support to update it.
        </Text>

        {/* ─── Working Hours ─── */}
        <Text style={[styles.sectionTitle, { marginTop: vs(16) }]}>Working Hours</Text>
        <View style={styles.row}>
          <View style={styles.halfCol}>
            <Text style={styles.fieldLabel}>Open</Text>
            <TouchableOpacity onPress={() => setShowOpenPicker(true)} activeOpacity={0.85}>
              <BlurView intensity={10} tint="dark" style={styles.inputBox}>
                <View style={styles.rowSpaced}>
                  <Text style={styles.inputText}>{formatTime(openTime)}</Text>
                  <Ionicons name="time-outline" size={ms(26)} color="rgba(255,255,255,0.7)" />
                </View>
              </BlurView>
            </TouchableOpacity>
          </View>
          <View style={styles.halfCol}>
            <Text style={styles.fieldLabel}>Close</Text>
            <TouchableOpacity onPress={() => setShowClosePicker(true)} activeOpacity={0.85}>
              <BlurView intensity={10} tint="dark" style={styles.inputBox}>
                <View style={styles.rowSpaced}>
                  <Text style={styles.inputText}>{formatTime(closeTime)}</Text>
                  <Ionicons name="time-outline" size={ms(26)} color="rgba(255,255,255,0.7)" />
                </View>
              </BlurView>
            </TouchableOpacity>
          </View>
        </View>
        {showOpenPicker && (
          <DateTimePicker
            value={openTime}
            mode="time"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={(_, t) => { setShowOpenPicker(false); if (t) setOpenTime(t); }}
            themeVariant="dark"
            accentColor="#7D08FA"
          />
        )}
        {showClosePicker && (
          <DateTimePicker
            value={closeTime}
            mode="time"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={(_, t) => { setShowClosePicker(false); if (t) setCloseTime(t); }}
            themeVariant="dark"
            accentColor="#7D08FA"
          />
        )}

        {/* ─── Working Days ─── */}
        <Text style={[styles.sectionTitle, { marginTop: vs(24) }]}>Working Days</Text>
        <View style={styles.daysRow}>
          {DAYS.map(day => {
            const active = activeDays.has(day);
            return (
              <TouchableOpacity
                key={day}
                onPress={() => toggleDay(day)}
                activeOpacity={0.8}
                style={styles.dayBtnWrapper}
              >
                {active ? (
                  <LinearGradient
                    colors={['#FF6E00', '#7E0AFA']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 0, y: 1 }}
                    style={styles.dayBtn}
                  >
                    <Text style={styles.dayText}>{day}</Text>
                  </LinearGradient>
                ) : (
                  <BlurView intensity={8} tint="dark" style={styles.dayBtnInactive}>
                    <Text style={styles.dayText}>{day}</Text>
                  </BlurView>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ─── Save button ─── */}
        <TouchableOpacity
          activeOpacity={0.82}
          onPress={handleSave}
          style={styles.saveBtnWrapper}
        >
          <BlurView intensity={14} tint="light" style={styles.btnBlur}>
            <LinearGradient
              colors={['#7E0AFA', '#FF6E00']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.saveBtnGradient}
            >
              <Text style={styles.saveBtnText}>Save Changes</Text>
            </LinearGradient>
          </BlurView>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: s(8),
    paddingBottom: vs(12),
    gap: s(8),
  },
  backBtn: { padding: s(8) },
  headerTitle: {
    color: '#FFF',
    fontSize: ms(28),
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
    marginRight: s(44),
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: s(16),
    gap: vs(10),
  },
  profileSection: {
    alignItems: 'center',
    gap: vs(8),
    marginBottom: vs(16),
  },
  avatarRing: {
    // width/height/borderRadius applied inline via useWindowDimensions
    padding: s(3),
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInner: {
    // width/height/borderRadius applied inline via useWindowDimensions
    backgroundColor: '#1A0030',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    color: '#FFF',
    fontSize: ms(48),
    fontWeight: '700',
  },
  venueName: {
    color: '#FFF',
    fontSize: ms(30),
    fontWeight: '700',
    textAlign: 'center',
  },
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(6),
  },
  editLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: ms(22),
    fontWeight: '400',
  },
  sectionTitle: {
    color: '#FFF',
    fontSize: ms(20),
    fontWeight: '600',
    marginBottom: vs(4),
    marginTop: vs(8),
  },
  locationBox: {
    borderRadius: s(15),
    overflow: 'hidden',
    backgroundColor: 'rgba(43,43,43,0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: s(14),
    paddingVertical: vs(12),
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(10),
  },
  locationText: {
    flex: 1,
    gap: vs(2),
  },
  locationAddress: {
    color: '#FFF',
    fontSize: ms(15),
    fontWeight: '400',
  },
  locationCoords: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: ms(12),
  },
  locationHint: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: ms(12),
    marginLeft: s(4),
    marginTop: vs(4),
  },
  fieldLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: ms(13),
    marginBottom: vs(4),
    marginLeft: s(4),
  },
  row: {
    flexDirection: 'row',
    gap: s(8),
  },
  halfCol: {
    flex: 1,
    gap: vs(4),
  },
  inputBox: {
    borderRadius: s(15),
    overflow: 'hidden',
    backgroundColor: 'rgba(43,43,43,0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    height: vs(55),
    justifyContent: 'center',
    paddingHorizontal: s(14),
  },
  inputText: {
    color: '#FFF',
    fontSize: ms(18),
    fontWeight: '400',
  },
  rowSpaced: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  daysRow: {
    flexDirection: 'row',
    gap: s(2),
  },
  dayBtnWrapper: {
    flex: 1,
    height: vs(55),
    borderRadius: s(10),
    overflow: 'hidden',
  },
  dayBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: s(10),
  },
  dayBtnInactive: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(43,43,43,0.85)',
    borderWidth: 1,
    borderColor: 'rgba(112,112,112,0.5)',
    borderRadius: s(10),
  },
  dayText: {
    color: '#FFF',
    fontSize: ms(13),
    fontWeight: '300',
  },
  saveBtnWrapper: {
    width: '100%',
    height: vs(54),
    borderRadius: s(48),
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    marginTop: vs(32),
    alignSelf: 'center',
    maxWidth: s(331),
  },
  btnBlur: { flex: 1 },
  saveBtnGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    color: '#FFF',
    fontSize: ms(20),
    fontWeight: '700',
  },
});
