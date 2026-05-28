import { useState } from 'react';
import {
  ActionSheetIOS,
  Alert,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { DashboardSectionHeader } from '@/components/admin/dashboard-section-header';
import { FormField, FormTextArea } from '@/components/admin/form-field';
import { PickerField } from '@/components/admin/picker-field';
import { Icon } from '@/components/ui/icon';
import { PARTY_GENRES, PERFORMER_TYPES } from '@/constants/parties';
import { colors, radii, spacing, typography, weights } from '@/theme';

const DESCRIPTION_MAX = 2000;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const PLACEHOLDER_PICK = 'Select…';

// ─── Date/time helpers (verbatim from the original create screen) ───
function combineDateTime(date: Date, time: Date): string {
  const combined = new Date(date);
  combined.setHours(time.getHours(), time.getMinutes(), 0, 0);
  return combined.toISOString();
}

function getEndsAt(date: Date, startTime: Date, endTime: Date): string {
  const end = new Date(date);
  end.setHours(endTime.getHours(), endTime.getMinutes(), 0, 0);
  const start = new Date(date);
  start.setHours(startTime.getHours(), startTime.getMinutes(), 0, 0);
  if (end <= start) end.setDate(end.getDate() + 1);
  return end.toISOString();
}

/** The shared, screen-agnostic payload both Create and Update assemble. */
export type PartyFormPayload = {
  title: string;
  description: string;
  price: number;
  capacity: number;
  startsAt: string;
  endsAt: string;
  genre?: string;
  performerName?: string;
  performerType?: string;
  featured: boolean;
};

/** Optional prefill for the Edit flow. Omitted fields fall back to create defaults. */
export type PartyFormInitialValues = {
  title?: string;
  description?: string;
  genre?: string;
  performerType?: string;
  performerName?: string;
  startsAt?: string;
  endsAt?: string;
  price?: number;
  capacity?: number;
  featured?: boolean;
  /** Resolved cover-image URL — shown as the existing cover until a new one is picked. */
  imageUrl?: string | null;
};

function defaultStart(): Date {
  const d = new Date();
  d.setHours(22, 0, 0, 0);
  return d;
}

function defaultEnd(): Date {
  const d = new Date();
  d.setHours(3, 0, 0, 0);
  return d;
}

/**
 * Owns all create/edit party form state, validation, and the cover-image
 * picker. The hosting screen keeps control of the submit action and only calls
 * `validate()` + `buildPayload()`; image handling is exposed so the screen can
 * upload (create) or detect a newly-picked cover (edit). Behavior is identical
 * to the original inline create form.
 */
export function usePartyForm(initial?: PartyFormInitialValues) {
  // ─── Details
  const [partyName, setPartyName] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');

  // ─── Lineup
  const [genre, setGenre] = useState(initial?.genre ?? '');
  const [performerType, setPerformerType] = useState(initial?.performerType ?? '');
  const [performerName, setPerformerName] = useState(initial?.performerName ?? '');

  // ─── When
  const [partyDate, setPartyDate] = useState(() =>
    initial?.startsAt ? new Date(initial.startsAt) : new Date(),
  );
  const [startTime, setStartTime] = useState(() =>
    initial?.startsAt ? new Date(initial.startsAt) : defaultStart(),
  );
  const [endTime, setEndTime] = useState(() =>
    initial?.endsAt ? new Date(initial.endsAt) : defaultEnd(),
  );
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  // ─── Tickets
  const [price, setPrice] = useState(initial?.price != null ? String(initial.price) : '');
  const [capacity, setCapacity] = useState(
    initial?.capacity != null ? String(initial.capacity) : '',
  );

  // ─── Cover image. `existingImageUrl` is the prefilled cover (edit); `imageUri`
  // is set only when the host picks a NEW local image.
  const existingImageUrl = initial?.imageUrl ?? null;
  const [imageUri, setImageUri] = useState<string | null>(null);

  // ─── Visibility
  const [featured, setFeatured] = useState(initial?.featured ?? false);

  // ─── Inline messaging
  const [nameError, setNameError] = useState<string | null>(null);
  const [priceError, setPriceError] = useState<string | null>(null);
  const [capacityError, setCapacityError] = useState<string | null>(null);
  const [imageNotice, setImageNotice] = useState<string | null>(null);

  const formatDate = (d: Date) =>
    d.toLocaleDateString('en-GB', {
      weekday: 'short',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

  const formatTime = (d: Date) =>
    d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

  // ─── Option-set picker (iOS action sheet; Android falls back to an Alert).
  const openOptionPicker = (
    options: readonly string[],
    _current: string,
    onSelect: (value: string) => void,
  ) => {
    Haptics.selectionAsync();
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [...options, 'Cancel'],
          cancelButtonIndex: options.length,
          userInterfaceStyle: 'dark',
        },
        (index) => {
          if (index < options.length) onSelect(options[index]);
        },
      );
      return;
    }
    Alert.alert('Select an option', undefined, [
      ...options.map((opt) => ({ text: opt, onPress: () => onSelect(opt) })),
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  };

  // ─── Cover image picking (16:9, 10 MB guard). Permission denial keeps the
  // system-expected Alert; the size guard surfaces inline instead.
  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Photo library access is required to upload images.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.85,
    });
    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    if (asset.fileSize && asset.fileSize > MAX_IMAGE_BYTES) {
      setImageNotice('That image is over 10 MB. Please choose a smaller one.');
      return;
    }
    setImageNotice(null);
    setImageUri(asset.uri);
  };

  // ─── Validation (inline, no Alert). Returns true when the form is valid.
  const validate = (): boolean => {
    let valid = true;

    if (!partyName.trim()) {
      setNameError('Party name is required.');
      valid = false;
    }

    // Strict numeric formats — parseFloat/parseInt would silently accept
    // trailing garbage ("12abc" → 12), letting a wrong price reach a money field.
    const trimmedPrice = price.trim();
    if (!trimmedPrice || !/^\d+(\.\d{1,2})?$/.test(trimmedPrice)) {
      setPriceError('Enter a valid price (e.g. 15 or 12.50).');
      valid = false;
    }

    const trimmedCapacity = capacity.trim();
    if (
      !trimmedCapacity ||
      !/^\d+$/.test(trimmedCapacity) ||
      Number(trimmedCapacity) < 1 ||
      Number(trimmedCapacity) > 50000
    ) {
      setCapacityError('Capacity must be a whole number between 1 and 50,000.');
      valid = false;
    }

    return valid;
  };

  // ─── Assemble the shared payload. Safe to call only after validate() passes,
  // which guarantees strict numeric formats.
  const buildPayload = (): PartyFormPayload => ({
    title: partyName.trim(),
    description: description.trim(),
    price: Number(price.trim()),
    capacity: Number(capacity.trim()),
    startsAt: combineDateTime(partyDate, startTime),
    endsAt: getEndsAt(partyDate, startTime, endTime),
    genre: genre || undefined,
    performerType: performerType || undefined,
    performerName: performerName.trim() || undefined,
    featured,
  });

  // Field-edit handlers that also clear the matching inline error.
  const onChangeName = (t: string) => {
    setPartyName(t);
    if (nameError) setNameError(null);
  };
  const onChangePrice = (t: string) => {
    setPrice(t);
    if (priceError) setPriceError(null);
  };
  const onChangeCapacity = (t: string) => {
    setCapacity(t);
    if (capacityError) setCapacityError(null);
  };

  return {
    // raw values (read-only consumers / fields binding)
    values: {
      partyName,
      description,
      genre,
      performerType,
      performerName,
      partyDate,
      startTime,
      endTime,
      price,
      capacity,
      featured,
      imageUri,
      existingImageUrl,
    },
    errors: { nameError, priceError, capacityError },
    imageNotice,
    setImageNotice,
    /** True when the host picked a new local cover image this session. */
    hasNewImage: imageUri != null,
    // imperative API
    validate,
    buildPayload,
    // field props for <PartyFormFields/>
    fieldProps: {
      partyName,
      description,
      genre,
      performerType,
      performerName,
      partyDate,
      startTime,
      endTime,
      price,
      capacity,
      featured,
      imageUri,
      existingImageUrl,
      nameError,
      priceError,
      capacityError,
      imageNotice,
      showDatePicker,
      showStartPicker,
      showEndPicker,
      formatDate,
      formatTime,
      onChangeName,
      setDescription,
      setGenre,
      setPerformerType,
      setPerformerName,
      onChangePrice,
      onChangeCapacity,
      setFeatured,
      setPartyDate,
      setStartTime,
      setEndTime,
      setShowDatePicker,
      setShowStartPicker,
      setShowEndPicker,
      openOptionPicker,
      pickImage,
    } satisfies PartyFormFieldsProps,
  };
}

// ─── Presentational fields ────────────────────────────────────────────────

type PartyFormFieldsProps = {
  partyName: string;
  description: string;
  genre: string;
  performerType: string;
  performerName: string;
  partyDate: Date;
  startTime: Date;
  endTime: Date;
  price: string;
  capacity: string;
  featured: boolean;
  imageUri: string | null;
  existingImageUrl: string | null;
  nameError: string | null;
  priceError: string | null;
  capacityError: string | null;
  imageNotice: string | null;
  showDatePicker: boolean;
  showStartPicker: boolean;
  showEndPicker: boolean;
  formatDate: (d: Date) => string;
  formatTime: (d: Date) => string;
  onChangeName: (t: string) => void;
  setDescription: (t: string) => void;
  setGenre: (v: string) => void;
  setPerformerType: (v: string) => void;
  setPerformerName: (v: string) => void;
  onChangePrice: (t: string) => void;
  onChangeCapacity: (t: string) => void;
  setFeatured: (v: boolean) => void;
  setPartyDate: (d: Date) => void;
  setStartTime: (d: Date) => void;
  setEndTime: (d: Date) => void;
  setShowDatePicker: (v: boolean) => void;
  setShowStartPicker: (v: boolean) => void;
  setShowEndPicker: (v: boolean) => void;
  openOptionPicker: (
    options: readonly string[],
    current: string,
    onSelect: (value: string) => void,
  ) => void;
  pickImage: () => void;
};

/**
 * Presentational form body: the Details / Lineup / When / Tickets / Cover /
 * Visibility sections, native pickers, image tile, and Featured switch. Drives
 * entirely off the props returned by `usePartyForm().fieldProps`.
 */
export function PartyFormFields(props: PartyFormFieldsProps) {
  const coverPreview = props.imageUri ?? props.existingImageUrl;

  return (
    <>
      {/* ─── Details ─── */}
      <View style={styles.section}>
        <DashboardSectionHeader title="Details" />
        <FormField
          label="Party name"
          placeholder="e.g. Midnight Rooftop"
          value={props.partyName}
          onChangeText={props.onChangeName}
          error={props.nameError}
          returnKeyType="next"
        />
        <FormTextArea
          label="Description"
          placeholder="What's the vibe?"
          value={props.description}
          onChangeText={props.setDescription}
          maxLength={DESCRIPTION_MAX}
        />
      </View>

      {/* ─── Lineup ─── */}
      <View style={styles.section}>
        <DashboardSectionHeader title="Lineup" />
        <PickerField
          label="Genre"
          value={props.genre || PLACEHOLDER_PICK}
          icon={<Icon sfSymbol="music.note" ionicon="musical-notes-outline" size={20} color={colors.labelSecondary} />}
          onPress={() => props.openOptionPicker(PARTY_GENRES, props.genre, props.setGenre)}
        />
        <PickerField
          label="Performer type"
          value={props.performerType || PLACEHOLDER_PICK}
          icon={<Icon sfSymbol="person.fill" ionicon="person-outline" size={20} color={colors.labelSecondary} />}
          onPress={() =>
            props.openOptionPicker(PERFORMER_TYPES, props.performerType, props.setPerformerType)
          }
        />
        <FormField
          label="Performer name"
          placeholder="e.g. DJ Marko"
          value={props.performerName}
          onChangeText={props.setPerformerName}
        />
      </View>

      {/* ─── When ─── */}
      <View style={styles.section}>
        <DashboardSectionHeader title="When" />
        <PickerField
          label="Date"
          value={props.formatDate(props.partyDate)}
          icon={<Icon sfSymbol="calendar" ionicon="calendar-outline" size={20} color={colors.labelSecondary} />}
          onPress={() => props.setShowDatePicker(true)}
        />
        {props.showDatePicker && (
          <DateTimePicker
            value={props.partyDate}
            mode="date"
            display={Platform.OS === 'ios' ? 'inline' : 'default'}
            minimumDate={new Date()}
            onChange={(_, date) => {
              props.setShowDatePicker(false);
              if (date) props.setPartyDate(date);
            }}
            themeVariant="dark"
            accentColor={colors.tint}
          />
        )}

        <View style={styles.row}>
          <View style={styles.half}>
            <PickerField
              label="Start time"
              value={props.formatTime(props.startTime)}
              icon={<Icon sfSymbol="clock" ionicon="time-outline" size={20} color={colors.labelSecondary} />}
              onPress={() => props.setShowStartPicker(true)}
            />
          </View>
          <View style={styles.half}>
            <PickerField
              label="End time"
              value={props.formatTime(props.endTime)}
              icon={<Icon sfSymbol="clock" ionicon="time-outline" size={20} color={colors.labelSecondary} />}
              onPress={() => props.setShowEndPicker(true)}
            />
          </View>
        </View>
        {props.showStartPicker && (
          <DateTimePicker
            value={props.startTime}
            mode="time"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={(_, t) => {
              props.setShowStartPicker(false);
              if (t) props.setStartTime(t);
            }}
            themeVariant="dark"
            accentColor={colors.tint}
          />
        )}
        {props.showEndPicker && (
          <DateTimePicker
            value={props.endTime}
            mode="time"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={(_, t) => {
              props.setShowEndPicker(false);
              if (t) props.setEndTime(t);
            }}
            themeVariant="dark"
            accentColor={colors.tint}
          />
        )}
      </View>

      {/* ─── Tickets ─── */}
      <View style={styles.section}>
        <DashboardSectionHeader title="Tickets" />
        <View style={styles.row}>
          <View style={styles.half}>
            <FormField
              label="Price (€)"
              placeholder="0"
              value={props.price}
              onChangeText={props.onChangePrice}
              error={props.priceError}
              keyboardType="decimal-pad"
            />
          </View>
          <View style={styles.half}>
            <FormField
              label="Capacity"
              placeholder="0"
              value={props.capacity}
              onChangeText={props.onChangeCapacity}
              error={props.capacityError}
              keyboardType="number-pad"
            />
          </View>
        </View>
      </View>

      {/* ─── Cover image ─── */}
      <View style={styles.section}>
        <DashboardSectionHeader title="Cover image" />
        <Pressable
          onPress={props.pickImage}
          accessibilityRole="button"
          accessibilityLabel={coverPreview ? 'Change cover image' : 'Add cover image'}
          accessibilityHint="Opens your photo library"
          style={({ pressed }) => [styles.imageTile, pressed && styles.imageTilePressed]}
        >
          {coverPreview ? (
            <>
              <Image source={{ uri: coverPreview }} style={StyleSheet.absoluteFill} resizeMode="cover" />
              <View style={styles.imageBadge}>
                <Icon sfSymbol="checkmark.circle.fill" ionicon="checkmark-circle" size={24} color={colors.label} />
              </View>
            </>
          ) : (
            <View style={styles.imageEmpty}>
              <Icon sfSymbol="photo" ionicon="image-outline" size={32} color={colors.labelTertiary} />
              <Text style={styles.imageEmptyLabel}>Add a 16:9 cover image</Text>
            </View>
          )}
        </Pressable>
        {props.imageNotice ? (
          <Animated.Text
            entering={FadeIn.duration(200)}
            style={styles.notice}
            accessibilityLiveRegion="polite"
          >
            {props.imageNotice}
          </Animated.Text>
        ) : null}
      </View>

      {/* ─── Visibility ─── */}
      <View style={styles.section}>
        <DashboardSectionHeader title="Visibility" />
        <View style={styles.switchRow}>
          <View style={styles.switchText}>
            <Text style={styles.switchLabel}>Featured</Text>
            <Text style={styles.switchHelper}>
              Featured parties appear at the top of search results
            </Text>
          </View>
          <Switch
            value={props.featured}
            onValueChange={(next) => {
              Haptics.selectionAsync();
              props.setFeatured(next);
            }}
            trackColor={{ false: colors.fill, true: colors.tint }}
            thumbColor={colors.label}
            ios_backgroundColor={colors.fill}
            accessibilityLabel="Featured"
            accessibilityRole="switch"
            accessibilityState={{ checked: props.featured }}
          />
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  half: {
    flex: 1,
  },
  imageTile: {
    aspectRatio: 16 / 9,
    borderRadius: radii.field,
    overflow: 'hidden',
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageTilePressed: {
    opacity: 0.85,
  },
  imageEmpty: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  imageEmptyLabel: {
    ...typography.footnote,
    color: colors.labelTertiary,
  },
  imageBadge: {
    position: 'absolute',
    bottom: spacing.sm,
    right: spacing.sm,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.base,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.field,
    borderWidth: 1,
    borderColor: colors.hairline,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
  },
  switchText: {
    flex: 1,
    gap: spacing.xxs,
  },
  switchLabel: {
    ...typography.body,
    fontWeight: weights.semibold,
    color: colors.label,
  },
  switchHelper: {
    ...typography.footnote,
    color: colors.labelSecondary,
  },
  notice: {
    ...typography.footnote,
    color: colors.labelSecondary,
    paddingHorizontal: spacing.xs,
  },
});
