import { useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PressableScale } from '@/components/afterglow/motion';
import { Failed, Loading } from '@/components/afterglow/state';
import { SIGN_PRESETS } from '@/components/signs/presets';
import { resolveSign, setSignDraft, useSignDraft } from '@/components/signs/sign-draft';
import { nightWord } from '@/components/signs/sign-format';
import {
  defaultSignText,
  inputFromSignText,
  limitSignInput,
  signTextFromInput,
  signTextHint,
  signTextProblem,
} from '@/components/signs/sign-text';
import { SignTile } from '@/components/signs/sign-tile';
import { useHostVenue, useSignOptions, useUploadSignArtwork } from '@/hooks/queries';
import { errorText } from '@/services/errorText';
import { colors, layout, radii, spacing, typography } from '@/theme';

/** The image picker's own limit is far above what a sign needs. */
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const SWATCH = 44;

/**
 * "Your sign" (S-20, behind the row on Promote): the party it is for, its words (two lines, 24
 * characters), one of six colour looks and an optional image. Nothing is sent from here: "Done" keeps
 * the choices for the booking on Promote, and the platform admin reviews them after booking.
 */
export default function SignArtworkScreen() {
  const insets = useSafeAreaInsets();
  const draft = useSignDraft();
  const options = useSignOptions(draft.week ?? undefined);
  const venue = useHostVenue();
  const upload = useUploadSignArtwork();
  const venueName = venue.data?.venueName ?? '';
  const resolved = resolveSign(draft, options.data?.parties, venueName);

  // Local until "Done", so "Cancel" leaves Promote as it was.
  const [partyId, setPartyId] = useState<string | null>(resolved.party?.id ?? null);
  const [input, setInput] = useState(inputFromSignText(resolved.text));
  const [wordsEdited, setWordsEdited] = useState(draft.text !== '');
  const [presetId, setPresetId] = useState(resolved.preset.id);
  const [artworkUrl, setArtworkUrl] = useState<string | null>(resolved.artworkUrl);
  const [imageNotice, setImageNotice] = useState<string | null>(null);

  const parties = options.data?.parties ?? [];
  const preset = SIGN_PRESETS.find((p) => p.id === presetId) ?? resolved.preset;
  const text = signTextFromInput(input);
  const problem = signTextProblem(text);
  const now = new Date();

  const pickParty = (id: string | null) => {
    Haptics.selectionAsync();
    setPartyId(id);
    // Words nobody wrote follow the party.
    if (!wordsEdited) {
      const title = parties.find((p) => p.id === id)?.title ?? venueName;
      setInput(inputFromSignText(defaultSignText(title)));
    }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Photos are off', 'Allow FindMyParty to read your photos in Settings to add an image.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [2, 1], quality: 0.85 });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    if (asset.fileSize && asset.fileSize > MAX_IMAGE_BYTES) {
      setImageNotice('That image is over 10 MB. Choose a smaller one.');
      return;
    }
    setImageNotice(null);
    upload.mutate(asset.uri, {
      onSuccess: (answer) => setArtworkUrl(answer.artworkUrl),
      onError: (error) => setImageNotice(errorText(error)),
    });
  };

  const done = () => {
    if (problem) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Not yet', signTextHint(text));
      return;
    }
    setSignDraft({ partyId, text: wordsEdited ? text : '', presetId, artworkUrl });
    router.back();
  };

  let parts: ReactNode;
  if (!options.data && options.isError) {
    parts = <Failed error={options.error} onRetry={() => options.refetch()} />;
  } else if (!options.data) {
    parts = <Loading />;
  } else {
    parts = (
      <>
        <View style={styles.preview}>
          <SignTile
            text={text}
            colorTop={preset.colorTop}
            colorBottom={preset.colorBottom}
            ink={preset.ink}
            artworkUrl={artworkUrl}
            size={120}
            wide
          />
        </View>

        <Text style={styles.section} accessibilityRole="header">
          Words
        </Text>
        <TextInput
          value={input}
          onChangeText={(raw) => {
            setInput(limitSignInput(raw));
            setWordsEdited(true);
          }}
          multiline
          autoCapitalize="characters"
          autoCorrect={false}
          placeholder={'NEON\nFRIDAY'}
          placeholderTextColor={colors.labelTertiary}
          style={styles.words}
          accessibilityLabel="Words on the sign, two lines at most"
        />
        <Text style={[styles.hint, problem && problem !== 'empty' && styles.hintBad]}>{signTextHint(text)}, two lines at most</Text>

        <Text style={styles.section} accessibilityRole="header">
          Colours
        </Text>
        <View style={styles.swatches} accessibilityRole="radiogroup">
          {SIGN_PRESETS.map((p) => {
            const chosen = p.id === presetId;
            return (
              <PressableScale
                key={p.id}
                onPress={() => setPresetId(p.id)}
                style={[styles.swatchRing, chosen && styles.swatchRingOn]}
                accessibilityRole="radio"
                accessibilityLabel={p.name}
                accessibilityState={{ checked: chosen }}
              >
                <SignTile text="" colorTop={p.colorTop} colorBottom={p.colorBottom} ink={p.ink} size={SWATCH} />
              </PressableScale>
            );
          })}
        </View>

        <Text style={styles.section} accessibilityRole="header">
          For the party
        </Text>
        <View style={styles.card}>
          {parties.map((party, index) => (
            <ChoiceRow
              key={party.id}
              title={party.title}
              subtitle={partyWhen(party.startsAt, now)}
              chosen={partyId === party.id}
              divided={index > 0}
              onPress={() => pickParty(party.id)}
            />
          ))}
          <ChoiceRow
            title="No party"
            subtitle="The sign is for the venue. A slot in Tonight needs a party."
            chosen={partyId === null}
            divided={parties.length > 0}
            onPress={() => pickParty(null)}
          />
        </View>

        <Text style={styles.section} accessibilityRole="header">
          Image
        </Text>
        <View style={styles.card}>
          <View style={styles.imageRow}>
            <Text style={styles.imageText}>
              {artworkUrl ? 'Your image is shown instead of the colours on the sign’s card.' : 'Optional. Shown on the sign’s card.'}
            </Text>
            {upload.isPending ? (
              <ActivityIndicator color={colors.labelSecondary} />
            ) : (
              <Pressable onPress={pickImage} hitSlop={layout.hitSlop} accessibilityRole="button">
                <Text style={styles.link}>{artworkUrl ? 'Change' : 'Add'}</Text>
              </Pressable>
            )}
          </View>
          {artworkUrl && !upload.isPending ? (
            <Pressable
              onPress={() => setArtworkUrl(null)}
              hitSlop={layout.hitSlop}
              accessibilityRole="button"
              style={styles.remove}
            >
              <Text style={styles.removeLabel}>Remove the image</Text>
            </Pressable>
          ) : null}
        </View>
        {imageNotice ? <Text style={[styles.hint, styles.hintBad]}>{imageNotice}</Text> : null}

        <Text style={styles.footer}>Every sign is reviewed before it goes live.</Text>
      </>
    );
  }

  return (
    <View style={styles.root}>
      <View style={[styles.bar, { paddingTop: Platform.OS === 'ios' ? spacing.md : insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} hitSlop={layout.hitSlop} accessibilityRole="button" style={styles.side}>
          <Text style={styles.cancel}>Cancel</Text>
        </Pressable>
        <Text style={styles.barTitle} accessibilityRole="header">
          Your sign
        </Text>
        <Pressable
          onPress={done}
          disabled={upload.isPending}
          hitSlop={layout.hitSlop}
          accessibilityRole="button"
          accessibilityState={{ disabled: upload.isPending }}
          style={[styles.side, styles.sideRight]}
        >
          <Text style={[styles.done, upload.isPending && styles.doneOff]}>Done</Text>
        </Pressable>
      </View>
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + spacing.xl }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {parts}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

/** "Tonight, 23:00" or "Fri 14, 23:00". */
function partyWhen(startsAt: string, now: Date): string {
  const d = new Date(startsAt);
  if (Number.isNaN(d.getTime())) return '';
  const night = nightWord(startsAt, now);
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return `${night === 'tonight' ? 'Tonight' : night}, ${time}`;
}

type ChoiceRowProps = { title: string; subtitle: string; chosen: boolean; divided: boolean; onPress: () => void };

function ChoiceRow({ title, subtitle, chosen, divided, onPress }: ChoiceRowProps) {
  return (
    <PressableScale
      onPress={onPress}
      scaleTo={0.99}
      haptic={false}
      style={[styles.choice, divided && styles.divided]}
      accessibilityRole="radio"
      accessibilityLabel={`${title}, ${subtitle}`}
      accessibilityState={{ checked: chosen }}
    >
      <View style={[styles.radio, chosen ? styles.radioOn : styles.radioOff]} />
      <View style={styles.choiceText}>
        <Text style={styles.choiceTitle} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.choiceSubtitle}>{subtitle}</Text>
      </View>
    </PressableScale>
  );
}

const RADIO = 19;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  fill: {
    flex: 1,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: layout.screenMargin,
    paddingBottom: spacing.sm,
  },
  side: {
    minWidth: 64,
    minHeight: layout.minTouchTarget,
    justifyContent: 'center',
  },
  sideRight: {
    alignItems: 'flex-end',
  },
  cancel: {
    ...typography.body,
    color: colors.labelSecondary,
  },
  barTitle: {
    ...typography.headline,
    color: colors.label,
    flex: 1,
    textAlign: 'center',
  },
  done: {
    ...typography.bodyEmphasized,
    color: colors.paid,
  },
  doneOff: {
    color: colors.labelTertiary,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: layout.screenMargin,
    paddingTop: spacing.sm,
  },
  preview: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
    borderRadius: radii.card,
    backgroundColor: colors.surface,
  },
  section: {
    ...typography.footnote,
    fontWeight: '600',
    color: colors.labelSecondary,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  words: {
    ...typography.title3,
    fontWeight: '600',
    color: colors.label,
    backgroundColor: colors.surface,
    borderRadius: radii.field,
    paddingHorizontal: 14,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    minHeight: 84,
    textAlignVertical: 'top',
  },
  hint: {
    ...typography.footnote,
    color: colors.labelSecondary,
    marginTop: spacing.sm,
  },
  hintBad: {
    color: colors.danger,
  },
  swatches: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  swatchRing: {
    padding: 3,
    borderRadius: radii.lg + 3,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  swatchRingOn: {
    borderColor: colors.paid,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    paddingHorizontal: 14,
  },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  divided: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.separator,
  },
  radio: {
    width: RADIO,
    height: RADIO,
    borderRadius: RADIO / 2,
  },
  radioOn: {
    borderWidth: 5.5,
    borderColor: colors.paid,
  },
  radioOff: {
    borderWidth: 2,
    borderColor: colors.labelTertiary,
  },
  choiceText: {
    flex: 1,
    gap: 2,
  },
  choiceTitle: {
    ...typography.callout,
    fontWeight: '600',
    color: colors.label,
  },
  choiceSubtitle: {
    ...typography.footnote,
    color: colors.labelSecondary,
  },
  imageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  imageText: {
    ...typography.subheadline,
    color: colors.labelSecondary,
    flex: 1,
  },
  link: {
    ...typography.subheadline,
    fontWeight: '600',
    color: colors.tint,
  },
  remove: {
    paddingBottom: spacing.md,
    alignSelf: 'flex-start',
  },
  removeLabel: {
    ...typography.footnote,
    fontWeight: '600',
    color: colors.danger,
  },
  footer: {
    ...typography.footnote,
    color: colors.labelTertiary,
    marginTop: spacing.lg,
  },
});
