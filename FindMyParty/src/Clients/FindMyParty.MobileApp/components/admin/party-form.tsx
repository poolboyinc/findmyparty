import { Image, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { DashboardSectionHeader } from '@/components/admin/dashboard-section-header';
import { PressableScale } from '@/components/afterglow/motion';
import { Icon } from '@/components/ui/icon';
import { AGE_LIMITS, PARTY_GENRES } from '@/constants/parties';
import { colors, radii, spacing, typography } from '@/theme';
import { ChoiceRow } from './choice-row';
import { FormField, FormTextArea } from './form-field';
import { LineupEditor } from './lineup-editor';
import { chooseOption } from './option-sheet';
import { PickerField } from './picker-field';
import { DateField, TimeField } from './time-field';
import type { PartyForm } from './use-party-form';

const DESCRIPTION_MAX = 2000;
const NO_GENRE = 'No genre';

const AGE_OPTIONS: readonly { value: number | null; label: string }[] = [
  { value: null, label: 'None' },
  ...AGE_LIMITS.map((age) => ({ value: age, label: `${age}+` })),
];

function today(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/**
 * The party form's body: details, music, when, line-up, entry (price, capacity, age limit, hold) and the
 * cover. State and checks live in `usePartyForm`; the screen around it owns saving.
 */
export function PartyFormFields({ form }: { form: PartyForm }) {
  const { draft, set, errors } = form;
  const coverPreview = form.imageUri ?? form.existingImageUrl;

  const pickGenre = () =>
    chooseOption('Genre', [...PARTY_GENRES, NO_GENRE], (index) => set('genre', index < PARTY_GENRES.length ? PARTY_GENRES[index] : null));

  return (
    <>
      <View style={styles.section}>
        <DashboardSectionHeader title="Details" />
        <FormField
          label="Party name"
          placeholder="e.g. Neon Friday"
          value={draft.title}
          onChangeText={(t) => set('title', t)}
          error={errors.title}
          maxLength={120}
          returnKeyType="next"
        />
        <FormTextArea
          label="Description"
          placeholder="What should guests know?"
          value={draft.description}
          onChangeText={(t) => set('description', t)}
          maxLength={DESCRIPTION_MAX}
        />
        <PickerField
          label="Genre"
          value={draft.genre ?? NO_GENRE}
          icon={<Icon sfSymbol="music.note" ionicon="musical-notes-outline" size={20} color={colors.labelSecondary} />}
          onPress={pickGenre}
        />
      </View>

      <View style={styles.section}>
        <DashboardSectionHeader title="When" />
        <DateField label="Date" value={draft.day} minimumDate={today()} onChange={(d) => set('day', d)} />
        <View style={styles.row}>
          <View style={styles.half}>
            <TimeField label="Starts" value={draft.start} onChange={(t) => set('start', t)} />
          </View>
          <View style={styles.half}>
            <TimeField label="Ends" value={draft.end} onChange={(t) => set('end', t)} />
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <DashboardSectionHeader title="Line-up" />
        <LineupEditor
          acts={draft.acts}
          partyStart={draft.start}
          error={errors.acts}
          onChange={(acts) => set('acts', acts)}
          newKey={form.newKey}
        />
      </View>

      <View style={styles.section}>
        <DashboardSectionHeader title="Entry" />
        <View style={styles.row}>
          <View style={styles.half}>
            <FormField
              label="Price at the door (€)"
              placeholder="0"
              value={draft.price}
              onChangeText={(t) => set('price', t)}
              error={errors.price}
              keyboardType="decimal-pad"
            />
          </View>
          <View style={styles.half}>
            <FormField
              label="Capacity"
              placeholder="0"
              value={draft.capacity}
              onChangeText={(t) => set('capacity', t)}
              error={errors.capacity}
              keyboardType="number-pad"
            />
          </View>
        </View>
        <View style={styles.group}>
          <Text style={styles.label}>Age limit</Text>
          <ChoiceRow label="Age limit" options={AGE_OPTIONS} value={draft.ageLimit} onChange={(age) => set('ageLimit', age)} />
        </View>
        <FormField
          label="Held for (minutes)"
          placeholder="90"
          value={draft.holdMinutes}
          onChangeText={(t) => set('holdMinutes', t)}
          error={errors.holdMinutes}
          helper="Passes nobody scanned go back to the door after this."
          keyboardType="number-pad"
          maxLength={3}
        />
      </View>

      <View style={styles.section}>
        <DashboardSectionHeader title="Cover image" />
        <PressableScale
          onPress={form.pickImage}
          scaleTo={0.99}
          style={styles.imageTile}
          accessibilityRole="button"
          accessibilityLabel={coverPreview ? 'Change the cover image' : 'Add a cover image'}
          accessibilityHint="Opens your photos"
        >
          {coverPreview ? (
            <Image source={{ uri: coverPreview }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          ) : (
            <View style={styles.imageEmpty}>
              <Icon sfSymbol="photo" ionicon="image-outline" size={32} color={colors.labelTertiary} />
              <Text style={styles.imageEmptyLabel}>Add a 16:9 cover image</Text>
            </View>
          )}
        </PressableScale>
        {form.imageNotice ? (
          <Animated.Text entering={FadeIn.duration(200)} style={styles.notice} accessibilityLiveRegion="polite">
            {form.imageNotice}
          </Animated.Text>
        ) : null}
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
  group: {
    gap: spacing.xs,
  },
  label: {
    ...typography.subheadline,
    fontWeight: '600',
    color: colors.labelSecondary,
    paddingHorizontal: spacing.xs,
  },
  imageTile: {
    aspectRatio: 16 / 9,
    borderRadius: radii.field,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageEmpty: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  imageEmptyLabel: {
    ...typography.footnote,
    color: colors.labelTertiary,
  },
  notice: {
    ...typography.footnote,
    color: colors.labelSecondary,
    paddingHorizontal: spacing.xs,
  },
});
