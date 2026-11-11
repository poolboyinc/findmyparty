import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { FormField } from '@/components/admin/form-field';
import { chooseOption } from '@/components/admin/option-sheet';
import type { ClockTime } from '@/components/admin/party-input';
import { PickerField } from '@/components/admin/picker-field';
import { TimeField } from '@/components/admin/time-field';
import { PressableScale } from '@/components/afterglow/motion';
import { Icon } from '@/components/ui/icon';
import { PrimaryButton } from '@/components/ui/primary-button';
import { resolveMediaUrl } from '@/constants/api';
import { useUpdateHostVenue, useUploadVenueImage } from '@/hooks/queries';
import { errorText } from '@/services/errorText';
import { colors, layout, radii, spacing, typography, weights } from '@/theme';
import type { HostVenue } from '@/types/api';
import { DAYS, parseDays, parseTimeString, type Day } from './venue-hours';

/** The kinds of venue a host can pick (BUILD-3-SPEC §3.3, Host: Venue). */
export const VENUE_KINDS = ['Club', 'Bar', 'Rooftop', 'Garden', 'Warehouse', 'Other'] as const;
const NO_KIND = 'Not set';
const SAVED_SHOWN_MS = 2400;

function clockFrom(value: string | null): ClockTime | null {
  const d = parseTimeString(value);
  return d ? { hours: d.getHours(), minutes: d.getMinutes() } : null;
}

/** "HH:mm:ss" as the server stores a TimeOnly. */
function clockForApi(t: ClockTime | null): string | null {
  return t ? `${String(t.hours).padStart(2, '0')}:${String(t.minutes).padStart(2, '0')}:00` : null;
}

const DAY_OPTIONS = DAYS.map((day) => ({ value: day, label: day }));

/**
 * The venue as guests see it: picture, name, kind, area, the days and hours it opens. Starts from the
 * venue as loaded; a background refresh does not overwrite what is being typed.
 */
export function VenueForm({ venue }: { venue: HostVenue }) {
  const update = useUpdateHostVenue();
  const upload = useUploadVenueImage();
  const [name, setName] = useState(venue.venueName);
  const [kind, setKind] = useState<string | null>(venue.kind);
  const [area, setArea] = useState(venue.area ?? '');
  const [opens, setOpens] = useState<ClockTime | null>(() => clockFrom(venue.workingHoursOpen));
  const [closes, setCloses] = useState<ClockTime | null>(() => clockFrom(venue.workingHoursClose));
  const [days, setDays] = useState<Day[]>(() => parseDays(venue.workingDays));
  const [nameError, setNameError] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    if (!message?.ok) return;
    const timer = setTimeout(() => setMessage(null), SAVED_SHOWN_MS);
    return () => clearTimeout(timer);
  }, [message]);

  const toggleDay = (day: Day) => setDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));

  const save = async () => {
    setMessage(null);
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError('Give the venue a name.');
      return;
    }
    try {
      await update.mutateAsync({
        venueName: trimmed,
        kind,
        area: area.trim() || null,
        workingHoursOpen: clockForApi(opens),
        workingHoursClose: clockForApi(closes),
        // Always in week order, whatever order they were tapped in.
        workingDays: days.length > 0 ? DAYS.filter((d) => days.includes(d)).join(',') : null,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setMessage({ text: 'Saved.', ok: true });
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setMessage({ text: errorText(error), ok: false });
    }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Photos are off', 'Allow FindMyParty to use your photos in Settings to add a picture.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [16, 9], quality: 0.85 });
    if (result.canceled || !result.assets[0]) return;
    try {
      await upload.mutateAsync(result.assets[0].uri);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Picture not uploaded', errorText(error));
    }
  };

  const image = resolveMediaUrl(venue.imageUrl);

  return (
    <View style={styles.wrap}>
      <PressableScale
        onPress={pickImage}
        disabled={upload.isPending}
        scaleTo={0.99}
        style={styles.image}
        accessibilityRole="button"
        accessibilityLabel={image ? 'Change the venue picture' : 'Add a venue picture'}
        accessibilityState={{ busy: upload.isPending }}
      >
        {image ? <Image source={{ uri: image }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}
        {upload.isPending ? (
          <ActivityIndicator color={colors.label} />
        ) : image ? null : (
          <View style={styles.imageEmpty}>
            <Icon sfSymbol="photo" ionicon="image-outline" size={28} color={colors.labelTertiary} />
            <Text style={styles.imageLabel}>Add a picture of the venue</Text>
          </View>
        )}
      </PressableScale>

      <FormField
        label="Name"
        value={name}
        onChangeText={(t) => {
          setName(t);
          setNameError(null);
        }}
        error={nameError}
        maxLength={120}
        autoCapitalize="words"
      />
      <View style={styles.pair}>
        <View style={styles.half}>
          <PickerField
            label="Kind"
            value={kind ?? NO_KIND}
            onPress={() => chooseOption('Kind of venue', [...VENUE_KINDS, NO_KIND], (i) => setKind(i < VENUE_KINDS.length ? VENUE_KINDS[i] : null))}
          />
        </View>
        <View style={styles.half}>
          <FormField label="Area" placeholder="e.g. Stara Varoš" value={area} onChangeText={setArea} maxLength={60} autoCapitalize="words" />
        </View>
      </View>
      <View style={styles.pair}>
        <View style={styles.half}>
          <TimeField label="Opens" value={opens} fallback={{ hours: 22, minutes: 0 }} onChange={setOpens} />
        </View>
        <View style={styles.half}>
          <TimeField label="Closes" value={closes} fallback={{ hours: 3, minutes: 0 }} onChange={setCloses} />
        </View>
      </View>
      <View style={styles.group}>
        <Text style={styles.label}>Open on</Text>
        <View style={styles.days}>
          {DAY_OPTIONS.map((option) => {
            const on = days.includes(option.value);
            return (
              <PressableScale
                key={option.value}
                onPress={() => toggleDay(option.value)}
                style={[styles.day, on ? styles.dayOn : styles.dayOff]}
                accessibilityRole="checkbox"
                accessibilityLabel={option.label}
                accessibilityState={{ checked: on }}
              >
                <Text style={on ? styles.dayLabelOn : styles.dayLabelOff}>{option.label}</Text>
              </PressableScale>
            );
          })}
        </View>
      </View>

      {message ? (
        <Text style={[styles.message, message.ok ? styles.saved : styles.failed]} accessibilityLiveRegion="polite">
          {message.text}
        </Text>
      ) : null}
      <PrimaryButton label="Save venue" onPress={save} loading={update.isPending} disabled={update.isPending} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.md,
  },
  image: {
    aspectRatio: 16 / 9,
    borderRadius: radii.card,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageEmpty: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  imageLabel: {
    ...typography.footnote,
    color: colors.labelTertiary,
  },
  pair: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  half: {
    flex: 1,
  },
  group: {
    gap: spacing.xs,
  },
  label: {
    ...typography.subheadline,
    fontWeight: weights.semibold,
    color: colors.labelSecondary,
    paddingHorizontal: spacing.xs,
  },
  days: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  day: {
    flex: 1,
    minHeight: layout.minTouchTarget,
    borderRadius: radii.chip,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayOff: {
    backgroundColor: colors.surface,
  },
  dayOn: {
    backgroundColor: colors.label,
  },
  dayLabelOff: {
    ...typography.footnote,
    fontWeight: weights.semibold,
    color: colors.labelSecondary,
  },
  dayLabelOn: {
    ...typography.footnote,
    fontWeight: weights.semibold,
    color: colors.ink,
  },
  message: {
    ...typography.footnote,
    paddingHorizontal: spacing.xs,
  },
  saved: {
    color: colors.earned,
  },
  failed: {
    color: colors.danger,
  },
});
