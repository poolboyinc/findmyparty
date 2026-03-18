import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';

const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] as const;

export default function EditProfileScreen() {
  const insets = useSafeAreaInsets();

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
          <Ionicons name="arrow-back" size={28} color="#FFF" />
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
          <View style={styles.avatarRing}>
            <LinearGradient
              colors={['#9B20FF', '#7D08FA']}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
            <View style={styles.avatarInner}>
              <Text style={styles.avatarInitials}>MP</Text>
            </View>
          </View>
          <Text style={styles.venueName}>Morrison Pub</Text>
          <TouchableOpacity style={styles.editRow} activeOpacity={0.7}>
            <Text style={styles.editLabel}>Edit</Text>
            <Ionicons name="create-outline" size={20} color="rgba(255,255,255,0.5)" />
          </TouchableOpacity>
        </View>

        {/* ─── Working Hours ─── */}
        <Text style={styles.sectionTitle}>Working Hours</Text>
        <View style={styles.row}>
          <View style={styles.halfCol}>
            <Text style={styles.fieldLabel}>Open</Text>
            <TouchableOpacity onPress={() => setShowOpenPicker(true)} activeOpacity={0.85}>
              <BlurView intensity={10} tint="dark" style={styles.inputBox}>
                <View style={styles.rowSpaced}>
                  <Text style={styles.inputText}>{formatTime(openTime)}</Text>
                  <Ionicons name="time-outline" size={26} color="rgba(255,255,255,0.7)" />
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
                  <Ionicons name="time-outline" size={26} color="rgba(255,255,255,0.7)" />
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
        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Working Days</Text>
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
    paddingHorizontal: 8,
    paddingBottom: 12,
    gap: 8,
  },
  backBtn: { padding: 8 },
  headerTitle: {
    color: '#FFF',
    fontSize: 28,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
    marginRight: 44,
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 10,
  },
  profileSection: {
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
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
    backgroundColor: '#1A0030',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    color: '#FFF',
    fontSize: 48,
    fontWeight: '700',
  },
  venueName: {
    color: '#FFF',
    fontSize: 30,
    fontWeight: '700',
    textAlign: 'center',
  },
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  editLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 22,
    fontWeight: '400',
  },
  sectionTitle: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 4,
    marginTop: 8,
  },
  fieldLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    marginBottom: 4,
    marginLeft: 4,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  halfCol: {
    flex: 1,
    gap: 4,
  },
  inputBox: {
    borderRadius: 15,
    overflow: 'hidden',
    backgroundColor: 'rgba(43,43,43,0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    height: 55,
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  inputText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '400',
  },
  rowSpaced: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  daysRow: {
    flexDirection: 'row',
    gap: 2,
  },
  dayBtnWrapper: {
    flex: 1,
    height: 55,
    borderRadius: 10,
    overflow: 'hidden',
  },
  dayBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  dayBtnInactive: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(43,43,43,0.85)',
    borderWidth: 1,
    borderColor: 'rgba(112,112,112,0.5)',
    borderRadius: 10,
  },
  dayText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '300',
  },
  saveBtnWrapper: {
    width: '100%',
    height: 54,
    borderRadius: 48,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    marginTop: 32,
    alignSelf: 'center',
    maxWidth: 331,
  },
  btnBlur: { flex: 1 },
  saveBtnGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '700',
  },
});
