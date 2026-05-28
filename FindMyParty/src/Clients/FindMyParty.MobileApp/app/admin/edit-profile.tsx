import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';
import { AdminScreen } from '@/components/admin/admin-screen';
import { FormField } from '@/components/admin/form-field';
import { PickerField } from '@/components/admin/picker-field';
import { PrimaryButton } from '@/components/ui/primary-button';
import { Icon } from '@/components/ui/icon';
import { adminService } from '@/services/adminService';
import type { HostProfile } from '@/types/auth';
import { colors, radii, spacing, typography, weights } from '@/theme';

const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] as const;
type DayCode = (typeof DAYS)[number];

const AVATAR_SIZE = 112;
const DAY_CHIP_HEIGHT = 44;
const SUCCESS_DISMISS_MS = 2400;

// ─── Time helpers ─────────────────────────────────────────────────────────
// Parse a .NET TimeOnly string ("HH:mm:ss") into today-anchored Date.
// Anything malformed/empty returns null so the UI falls back to "Set time".
function parseTimeString(value: string | null | undefined): Date | null {
  if (!value) return null;
  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(value);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = match[3] ? Number(match[3]) : 0;
  if (
    Number.isNaN(hours) ||
    Number.isNaN(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }
  const d = new Date();
  d.setHours(hours, minutes, seconds, 0);
  return d;
}

// Serialize a Date back to "HH:mm:ss" for the PATCH payload.
function formatTimeForApi(value: Date | null): string | null {
  if (!value) return null;
  const hh = String(value.getHours()).padStart(2, '0');
  const mm = String(value.getMinutes()).padStart(2, '0');
  // Seconds aren't user-editable here; persist as :00 to match .NET TimeOnly precision.
  return `${hh}:${mm}:00`;
}

// "HH:mm" for the PickerField display value. Null/undefined → placeholder.
function formatTimeForDisplay(value: Date | null): string {
  if (!value) return 'Set time';
  return value.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

// First two word-initials of the venue name, uppercased. Falls back to "?".
function getInitials(venueName: string): string {
  const trimmed = venueName.trim();
  if (!trimmed) return '?';
  const initials = trimmed
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return initials || '?';
}

export default function EditProfileScreen() {
  const [hostProfile, setHostProfile] = useState<HostProfile | null>(null);
  const [venueName, setVenueName] = useState('');
  const [openTime, setOpenTime] = useState<Date | null>(null);
  const [closeTime, setCloseTime] = useState<Date | null>(null);
  const [activeDays, setActiveDays] = useState<Set<string>>(new Set());
  const [showOpenPicker, setShowOpenPicker] = useState(false);
  const [showClosePicker, setShowClosePicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [successVisible, setSuccessVisible] = useState(false);

  // ─── Hydrate from the API once on mount. The `cancelled` flag guards a
  // late response from setting state on an unmounted component.
  useEffect(() => {
    let cancelled = false;
    adminService.getHostProfile().then((profile) => {
      if (cancelled || !profile) return;
      setHostProfile(profile);
      setVenueName(profile.venueName);
      setOpenTime(parseTimeString(profile.workingHoursOpen));
      setCloseTime(parseTimeString(profile.workingHoursClose));
      setActiveDays(
        new Set(
          profile.workingDays
            ? profile.workingDays
                .split(',')
                .map((d) => d.trim())
                .filter(Boolean)
            : [],
        ),
      );
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // ─── Auto-dismiss the success notice. Clears on unmount or when the notice
  // is toggled off early by another save attempt.
  useEffect(() => {
    if (!successVisible) return;
    const handle = setTimeout(() => setSuccessVisible(false), SUCCESS_DISMISS_MS);
    return () => clearTimeout(handle);
  }, [successVisible]);

  const onChangeVenueName = (next: string) => {
    setVenueName(next);
    if (nameError) setNameError(null);
  };

  const toggleDay = (day: DayCode) => {
    Haptics.selectionAsync();
    setActiveDays((prev) => {
      const next = new Set(prev);
      if (next.has(day)) {
        next.delete(day);
      } else {
        next.add(day);
      }
      return next;
    });
  };

  const handleSave = async () => {
    setSubmitError(null);
    setNameError(null);
    Haptics.selectionAsync();

    const trimmedName = venueName.trim();
    if (!trimmedName) {
      setNameError('Venue name is required.');
      return;
    }

    setLoading(true);
    try {
      const ok = await adminService.updateMyVenueProfile({
        venueName: trimmedName,
        workingHoursOpen: formatTimeForApi(openTime),
        workingHoursClose: formatTimeForApi(closeTime),
        workingDays: activeDays.size > 0 ? Array.from(activeDays).join(',') : null,
      });
      if (!ok) {
        setSubmitError("Couldn't save your changes. Check your connection and try again.");
        setLoading(false);
        return;
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSuccessVisible(true);
      // Refresh the local profile so the header initials/name reflect the save.
      setHostProfile((prev) => (prev ? { ...prev, venueName: trimmedName } : prev));
    } catch {
      setSubmitError("Couldn't save your changes. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  // Header display values: prefer the saved profile name so the initials don't
  // shimmer as the host types. Fall back to placeholders while loading.
  const displayName = hostProfile?.venueName ?? (venueName || '—');
  const initials = hostProfile ? getInitials(hostProfile.venueName) : '?';

  return (
    <AdminScreen title="Edit Profile">
      {/* ─── Avatar + venue name ─── */}
      <View style={styles.avatarBlock}>
        <View
          style={styles.avatar}
          accessible
          accessibilityRole="image"
          accessibilityLabel={`Venue initials ${initials}`}
        >
          <Text style={styles.avatarInitials}>{initials}</Text>
        </View>
        <Text style={styles.venueHeading} numberOfLines={2}>
          {displayName}
        </Text>
      </View>

      {/* ─── Venue Details ─── */}
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>Venue Details</Text>
        <FormField
          label="Venue Name"
          value={venueName}
          onChangeText={onChangeVenueName}
          maxLength={120}
          helper="Shown to guests across FindMyParty."
          error={nameError}
          returnKeyType="done"
          autoCapitalize="words"
        />
      </View>

      {/* ─── Location (read-only) ─── */}
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>Location</Text>
        <View
          style={styles.locationCard}
          accessible
          accessibilityLabel={
            hostProfile
              ? `Venue location: ${hostProfile.address}. This field is managed by the FindMyParty team.`
              : 'Loading venue location'
          }
        >
          <Icon
            sfSymbol="mappin.and.ellipse"
            ionicon="location-outline"
            size={20}
            color={colors.labelSecondary}
          />
          <View style={styles.locationTextCol}>
            {hostProfile ? (
              <>
                <Text style={styles.locationAddress} numberOfLines={2}>
                  {hostProfile.address}
                </Text>
                <Text style={styles.locationCoords}>
                  {hostProfile.latitude.toFixed(5)}, {hostProfile.longitude.toFixed(5)}
                </Text>
              </>
            ) : (
              <Text style={styles.locationAddress}>Loading venue location…</Text>
            )}
          </View>
          <Icon
            sfSymbol="lock.fill"
            ionicon="lock-closed"
            size={16}
            color={colors.labelTertiary}
          />
        </View>
        <Text style={styles.helperText}>
          Location is managed by the FindMyParty team. Contact support to move your venue.
        </Text>
      </View>

      {/* ─── Working Hours ─── */}
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>Working Hours</Text>
        <View style={styles.row}>
          <View style={styles.half}>
            <PickerField
              label="Opens"
              value={formatTimeForDisplay(openTime)}
              icon={
                <Icon
                  sfSymbol="clock"
                  ionicon="time-outline"
                  size={20}
                  color={colors.labelSecondary}
                />
              }
              onPress={() => setShowOpenPicker(true)}
            />
          </View>
          <View style={styles.half}>
            <PickerField
              label="Closes"
              value={formatTimeForDisplay(closeTime)}
              icon={
                <Icon
                  sfSymbol="clock"
                  ionicon="time-outline"
                  size={20}
                  color={colors.labelSecondary}
                />
              }
              onPress={() => setShowClosePicker(true)}
            />
          </View>
        </View>
        {showOpenPicker && (
          <DateTimePicker
            // Seed the spinner with the current value, or 22:00 today as a sensible
            // default when nothing has been set yet.
            value={openTime ?? (() => {
              const d = new Date();
              d.setHours(22, 0, 0, 0);
              return d;
            })()}
            mode="time"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={(_, t) => {
              setShowOpenPicker(false);
              if (t) setOpenTime(t);
            }}
            themeVariant="dark"
            accentColor={colors.tint}
          />
        )}
        {showClosePicker && (
          <DateTimePicker
            value={closeTime ?? (() => {
              const d = new Date();
              d.setHours(3, 0, 0, 0);
              return d;
            })()}
            mode="time"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={(_, t) => {
              setShowClosePicker(false);
              if (t) setCloseTime(t);
            }}
            themeVariant="dark"
            accentColor={colors.tint}
          />
        )}
        <Text style={styles.helperText}>Used to show guests when your venue is open.</Text>
      </View>

      {/* ─── Working Days ─── */}
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>Working Days</Text>
        <View style={styles.daysRow}>
          {DAYS.map((day) => {
            const active = activeDays.has(day);
            return (
              <Pressable
                key={day}
                onPress={() => toggleDay(day)}
                accessibilityRole="button"
                accessibilityLabel={day}
                accessibilityState={{ selected: active }}
                accessibilityHint={
                  active ? 'Removes this day from your working days' : 'Adds this day to your working days'
                }
                style={({ pressed }) => [
                  styles.dayChip,
                  active ? styles.dayChipActive : styles.dayChipInactive,
                  pressed && styles.dayChipPressed,
                ]}
              >
                <Text style={active ? styles.dayChipTextActive : styles.dayChipTextInactive}>
                  {day}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* ─── Inline submit / success rows ─── */}
      {submitError ? (
        <Animated.Text
          entering={FadeIn.duration(200)}
          style={styles.submitError}
          accessibilityLiveRegion="polite"
        >
          {submitError}
        </Animated.Text>
      ) : null}
      {successVisible ? (
        <Animated.Text
          entering={FadeIn.duration(200)}
          style={styles.submitSuccess}
          accessibilityLiveRegion="polite"
        >
          Profile saved.
        </Animated.Text>
      ) : null}

      <View style={styles.saveBlock}>
        <PrimaryButton
          label="Save Changes"
          onPress={handleSave}
          loading={loading}
          disabled={loading}
          accessibilityHint="Saves your venue profile changes"
        />
      </View>
    </AdminScreen>
  );
}

const styles = StyleSheet.create({
  // ─── Avatar block
  avatarBlock: {
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    ...typography.largeTitle,
    fontWeight: weights.bold,
    color: colors.label,
  },
  venueHeading: {
    ...typography.title2,
    fontWeight: weights.bold,
    color: colors.label,
    textAlign: 'center',
  },

  // ─── Sections
  section: {
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  sectionHeader: {
    ...typography.subheadline,
    fontWeight: weights.semibold,
    color: colors.labelSecondary,
    paddingHorizontal: spacing.xs,
    marginBottom: spacing.sm,
  },
  helperText: {
    ...typography.footnote,
    color: colors.labelSecondary,
    paddingHorizontal: spacing.xs,
  },

  // ─── Location card
  locationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.field,
    borderWidth: 1,
    borderColor: colors.hairline,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
  },
  locationTextCol: {
    flex: 1,
    gap: spacing.xxs,
  },
  locationAddress: {
    ...typography.body,
    color: colors.label,
  },
  locationCoords: {
    ...typography.caption2,
    color: colors.labelTertiary,
  },

  // ─── Working hours row
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  half: {
    flex: 1,
  },

  // ─── Day chips
  daysRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  dayChip: {
    flex: 1,
    height: DAY_CHIP_HEIGHT,
    borderRadius: radii.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayChipInactive: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.hairline,
  },
  dayChipActive: {
    backgroundColor: colors.brand.tintBg,
    borderColor: colors.tint,
  },
  dayChipPressed: {
    opacity: 0.85,
  },
  dayChipTextInactive: {
    ...typography.caption1,
    fontWeight: weights.semibold,
    color: colors.labelSecondary,
  },
  dayChipTextActive: {
    ...typography.caption1,
    fontWeight: weights.semibold,
    color: colors.tint,
  },

  // ─── Status rows
  submitError: {
    ...typography.footnote,
    color: colors.danger,
    paddingHorizontal: spacing.xs,
    marginBottom: spacing.sm,
  },
  submitSuccess: {
    ...typography.footnote,
    color: colors.success,
    paddingHorizontal: spacing.xs,
    marginBottom: spacing.sm,
  },

  // ─── Save block
  saveBlock: {
    marginTop: spacing.lg,
  },
});
