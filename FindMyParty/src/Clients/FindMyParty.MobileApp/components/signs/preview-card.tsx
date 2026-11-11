import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PressableScale } from '@/components/afterglow/motion';
import { Poster } from '@/components/afterglow/poster';
import { SponsoredTag } from '@/components/afterglow/sponsored-tag';
import { SignPreview } from '@/components/city/sign-preview';
import { colors, radii, spacing, typography } from '@/theme';
import type { SignFormat, SignSpot } from '@/types/api';
import type { ResolvedSign } from './sign-draft';
import { spotLabel } from './sign-format';

type Props = {
  format: SignFormat;
  /** The wall or roof shown; null when nothing of this format is free. */
  spot: SignSpot | null;
  sign: ResolvedSign;
  /** For the Tonight row's poster colours. */
  venueName: string | null;
  /** What to say when there is no spot to show: "Nothing free this week". */
  emptyLine: string;
  /** Opens the spot chooser; absent when there is nothing else to choose. */
  onChooseSpot?: () => void;
};

/** The mock's 150 pt card on a 286 pt screen, scaled to an iPhone. */
export const PREVIEW_HEIGHT = 205;

/**
 * The top of Promote (S-20): the host's sign on the real spot in the night city, with an amber edge
 * and "Preview, spot 3, Njegoševa". Tapping it picks another free spot of the same format.
 * A slot in Tonight has no wall, so it previews the row as guests will see it in the Tonight list.
 */
export function PreviewCard({ format, spot, sign, venueName, emptyLine, onChooseSpot }: Props) {
  let label: string;
  let body: ReactNode;

  if (format === 'tonightSlot') {
    label = 'Preview, Slot in Tonight';
    body = <TonightRow sign={sign} venueName={venueName} />;
  } else if (spot) {
    label = `Preview, ${spotLabel(spot).replace(/^Spot/, 'spot')}`;
    body = (
      <SignPreview
        spot={spot}
        text={sign.text}
        colorTop={sign.preset.colorTop}
        colorBottom={sign.preset.colorBottom}
        ink={sign.preset.ink}
        style={StyleSheet.absoluteFill}
      />
    );
  } else {
    label = 'Preview';
    body = (
      <View style={styles.center}>
        <Text style={styles.empty}>{emptyLine}</Text>
      </View>
    );
  }

  const content = (
    <>
      {body}
      <View style={styles.label} pointerEvents="none">
        <Text style={styles.labelText} numberOfLines={1}>
          {label}
        </Text>
      </View>
    </>
  );

  if (!onChooseSpot) {
    return (
      <View style={styles.card} accessible accessibilityLabel={label}>
        {content}
      </View>
    );
  }

  return (
    <PressableScale
      onPress={onChooseSpot}
      scaleTo={0.985}
      style={styles.card}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint="Choose another free spot"
    >
      {content}
    </PressableScale>
  );
}

function TonightRow({ sign, venueName }: { sign: ResolvedSign; venueName: string | null }) {
  const title = sign.party?.title ?? 'Your party';
  return (
    <View style={styles.center}>
      <View style={styles.row}>
        <Poster
          imageUrl={sign.party?.imageUrl ?? null}
          title={title}
          venueName={venueName}
          titleSize={11}
          style={styles.poster}
        />
        <View style={styles.rowText}>
          <Text style={styles.rowTitle} numberOfLines={1}>
            {title}
          </Text>
          <SponsoredTag />
          {venueName ? (
            <Text style={styles.rowVenue} numberOfLines={1}>
              {venueName}
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    height: PREVIEW_HEIGHT,
    overflow: 'hidden',
    backgroundColor: colors.bg,
    borderLeftWidth: 3,
    borderLeftColor: colors.paid,
    borderTopLeftRadius: radii.badge,
    borderBottomLeftRadius: radii.badge,
    borderTopRightRadius: radii.card,
    borderBottomRightRadius: radii.card,
  },
  label: {
    position: 'absolute',
    left: 11,
    top: 11,
    right: 11,
    flexDirection: 'row',
  },
  labelText: {
    ...typography.footnote,
    fontWeight: '600',
    color: colors.paid,
    backgroundColor: colors.scrim,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radii.xs,
    overflow: 'hidden',
  },
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
  },
  empty: {
    ...typography.subheadline,
    color: colors.labelSecondary,
    textAlign: 'center',
  },
  row: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    marginTop: spacing.lg,
    borderRadius: radii.card,
    backgroundColor: colors.surfaceElevated,
  },
  poster: {
    width: 56,
    height: 56,
    borderRadius: radii.chip,
  },
  rowText: {
    flex: 1,
    gap: 1,
  },
  rowTitle: {
    ...typography.headline,
    color: colors.label,
  },
  rowVenue: {
    ...typography.footnote,
    color: colors.labelSecondary,
  },
});
