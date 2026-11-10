import { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';
import { useQueryClient } from '@tanstack/react-query';
import { AdminScreen } from '@/components/admin/admin-screen';
import { FormField } from '@/components/admin/form-field';
import { PickerField } from '@/components/admin/picker-field';
import { PressableScale } from '@/components/afterglow/motion';
import { Failed, Loading } from '@/components/afterglow/state';
import { Display } from '@/components/afterglow/text';
import {
  DAYS,
  formatTimeForApi,
  formatTimeForDisplay,
  parseDays,
  parseTimeString,
  timeAt,
  type Day,
} from '@/components/host/venue-hours';
import { PrimaryButton } from '@/components/ui/primary-button';
import { Icon } from '@/components/ui/icon';
import { keys, useHostVenue } from '@/hooks/queries';
import { api } from '@/services/apiClient';
import { errorText } from '@/services/errorText';
import type { HostVenue } from '@/types/api';
import type { UpdateMyVenueProfileRequest } from '@/types/auth';
import { colors, radii, spacing, typography, weights } from '@/theme';

const DAY_CHIP_HEIGHT = 44;
const SUCCESS_DISMISS_MS = 2400;

export default function EditProfileScreen() {
  const venue = useHostVenue();

  if (!venue.data) {
    return (
      <AdminScreen title="Venue profile" keyboardAvoiding={false}>
        {venue.isError ? <Failed error={venue.error} onRetry={() => venue.refetch()} /> : <Loading />}
      </AdminScreen>
    );
  }
  // The form starts from the venue as loaded; a background refresh must not overwrite what is being typed.
  return <ProfileForm venue={venue.data} />;
}

function ProfileForm({ venue }: { venue: HostVenue }) {
  const client = useQueryClient();
  const [venueName, setVenueName] = useState(venue.venueName);
  const [openTime, setOpenTime] = useState<Date | null>(() => parseTimeString(venue.workingHoursOpen));
  const [closeTime, setCloseTime] = useState<Date | null>(() => parseTimeString(venue.workingHoursClose));
  const [activeDays, setActiveDays] = useState<Day[]>(() => parseDays(venue.workingDays));
  const [showOpenPicker, setShowOpenPicker] = useState(false);
  const [showClosePicker, setShowClosePicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [successVisible, setSuccessVisible] = useState(false);

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

  const toggleDay = (day: Day) => {
    setActiveDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  };

  const handleSave = async () => {
    setSubmitError(null);
    setNameError(null);
    setSuccessVisible(false);

    const trimmedName = venueName.trim();
    if (!trimmedName) {
      setNameError('Venue name is required.');
      return;
    }

    const body: UpdateMyVenueProfileRequest = {
      venueName: trimmedName,
      workingHoursOpen: formatTimeForApi(openTime),
      workingHoursClose: formatTimeForApi(closeTime),
      // Always in week order, whatever order they were tapped in.
      workingDays: activeDays.length > 0 ? DAYS.filter((d) => activeDays.includes(d)).join(',') : null,
    };

    setLoading(true);
    try {
      await api.request<void>('/api/hosts/profile', { method: 'PATCH', body });
      // The Live header and the scanner show the venue name from the same cached profile.
      await client.invalidateQueries({ queryKey: keys.hostVenue });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSuccessVisible(true);
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setSubmitError(errorText(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminScreen title="Venue profile" headerDisabled={loading}>
      <Display size="lg" style={styles.venueHeading} numberOfLines={2}>
        {venue.venueName}
      </Display>

      {/* ─── Venue details ─── */}
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>Venue details</Text>
        <FormField
          label="Venue name"
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
          accessibilityLabel={`Venue location: ${venue.address}. This is managed by the FindMyParty team.`}
        >
          <Icon sfSymbol="mappin.and.ellipse" ionicon="location-outline" size={20} color={colors.labelSecondary} />
          <View style={styles.locationTextCol}>
            <Text style={styles.locationAddress} numberOfLines={2}>
              {venue.address}
            </Text>
            <Text style={styles.locationCoords}>
              {venue.latitude.toFixed(5)}, {venue.longitude.toFixed(5)}
            </Text>
          </View>
          <Icon sfSymbol="lock.fill" ionicon="lock-closed" size={16} color={colors.labelTertiary} />
        </View>
        <Text style={styles.helperText}>
          Location is managed by the FindMyParty team. Contact support to move your venue.
        </Text>
      </View>

      {/* ─── Working hours ─── */}
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>Working hours</Text>
        <View style={styles.row}>
          <View style={styles.half}>
            <PickerField
              label="Opens"
              value={formatTimeForDisplay(openTime)}
              icon={<Icon sfSymbol="clock" ionicon="time-outline" size={20} color={colors.labelSecondary} />}
              onPress={() => setShowOpenPicker(true)}
            />
          </View>
          <View style={styles.half}>
            <PickerField
              label="Closes"
              value={formatTimeForDisplay(closeTime)}
              icon={<Icon sfSymbol="clock" ionicon="time-outline" size={20} color={colors.labelSecondary} />}
              onPress={() => setShowClosePicker(true)}
            />
          </View>
        </View>
        {showOpenPicker && (
          <DateTimePicker
            // Seed the spinner with the current value, or 22:00 as a sensible default.
            value={openTime ?? timeAt(22)}
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
            value={closeTime ?? timeAt(3)}
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

      {/* ─── Working days ─── */}
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>Working days</Text>
        <View style={styles.daysRow}>
          {DAYS.map((day) => {
            const active = activeDays.includes(day);
            return (
              <PressableScale
                key={day}
                onPress={() => toggleDay(day)}
                accessibilityRole="button"
                accessibilityLabel={day}
                accessibilityState={{ selected: active }}
                accessibilityHint={active ? 'Removes this day from your working days' : 'Adds this day to your working days'}
                style={[styles.dayChip, active ? styles.dayChipActive : styles.dayChipInactive]}
              >
                <Text style={active ? styles.dayChipTextActive : styles.dayChipTextInactive}>{day}</Text>
              </PressableScale>
            );
          })}
        </View>
      </View>

      {/* ─── Inline submit / success rows ─── */}
      {submitError ? (
        <Text style={styles.submitError} accessibilityLiveRegion="polite">
          {submitError}
        </Text>
      ) : null}
      {successVisible ? (
        <Text style={styles.submitSuccess} accessibilityLiveRegion="polite">
          Profile saved.
        </Text>
      ) : null}

      <View style={styles.saveBlock}>
        <PrimaryButton
          label="Save changes"
          onPress={handleSave}
          loading={loading}
          disabled={loading}
          accessibilityHint="Saves your venue profile"
        />
      </View>
    </AdminScreen>
  );
}

const styles = StyleSheet.create({
  venueHeading: {
    marginBottom: spacing.xl,
  },

  // ─── Sections
  section: {
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  sectionHeader: {
    ...typography.headline,
    color: colors.label,
    marginBottom: spacing.xs,
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
    backgroundColor: colors.surface,
    borderRadius: radii.field,
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

  // ─── Day chips: a chosen day is a solid white block with dark text; the rest are flat.
  daysRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  dayChip: {
    flex: 1,
    minHeight: DAY_CHIP_HEIGHT,
    borderRadius: radii.chip,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayChipInactive: {
    backgroundColor: colors.surface,
  },
  dayChipActive: {
    backgroundColor: colors.label,
  },
  dayChipTextInactive: {
    ...typography.footnote,
    fontWeight: weights.semibold,
    color: colors.labelSecondary,
  },
  dayChipTextActive: {
    ...typography.footnote,
    fontWeight: weights.semibold,
    color: colors.ink,
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
    color: colors.earned,
    paddingHorizontal: spacing.xs,
    marginBottom: spacing.sm,
  },

  // ─── Save block
  saveBlock: {
    marginTop: spacing.lg,
  },
});
