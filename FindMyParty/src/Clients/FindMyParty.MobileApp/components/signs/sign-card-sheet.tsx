import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, type Href } from 'expo-router';
import { BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PressableScale } from '@/components/afterglow/motion';
import { SponsoredTag } from '@/components/afterglow/sponsored-tag';
import { routes } from '@/constants/routes';
import { useHideSign, usePerk } from '@/hooks/queries';
import { errorText } from '@/services/errorText';
import { colors, layout, radii, spacing, typography } from '@/theme';
import type { MapSign, PerkItem } from '@/types/api';
import { SignTile } from './sign-tile';
import { WhySheet } from './why-sheet';

type Props = {
  /** The tapped sign; null closes the card. */
  sign: MapSign | null;
  /** The card has gone (swiped down, hidden, or left for another screen). The map clears its selection. */
  onDismiss: () => void;
};

/** A just-presented sheet gets this long to mount before it may be dismissed (see `VenueSheet`). */
const PRESENT_SETTLE_MS = 150;
/** The mock's 40 pt tile on a 286 pt screen, scaled to an iPhone. */
const TILE = 55;

/**
 * The card a sign opens on the map (S-19): amber "Sponsored" and "Why am I seeing this?", the brand's
 * tile, what it offers, and two things to do: take the offer, or hide the sign. A venue's own sign
 * (`own`) is not an ad, so it has no "Sponsored" line.
 *
 * Usage (the map screen): `<SignCardSheet sign={selectedSign} onDismiss={() => setSelectedSignId(null)} />`
 */
export function SignCardSheet({ sign, onDismiss }: Props) {
  const sheet = useRef<BottomSheetModal>(null);
  const insets = useSafeAreaInsets();
  const hide = useHideSign();
  const [why, setWhy] = useState<string | null>(null);

  // Keep showing the last sign while the card slides away, instead of an empty card.
  const [last, setLast] = useState<MapSign | null>(sign);
  useEffect(() => {
    if (sign) setLast(sign);
  }, [sign]);
  const shown = sign ?? last;

  const presented = useRef(false);
  const presentedAt = useRef(0);
  const signId = sign?.id ?? null;
  useEffect(() => {
    if (signId) {
      presented.current = true;
      presentedAt.current = Date.now();
      sheet.current?.present();
      return;
    }
    setWhy(null);
    if (!presented.current) return;
    const wait = Math.max(0, PRESENT_SETTLE_MS - (Date.now() - presentedAt.current));
    const timer = setTimeout(() => {
      presented.current = false;
      sheet.current?.dismiss();
    }, wait);
    return () => clearTimeout(timer);
  }, [signId]);

  const close = () => {
    presented.current = false;
    setWhy(null);
    sheet.current?.dismiss();
  };

  /** Close first, so the card is not still open when the user comes back. */
  const open = (href: Href) => {
    close();
    router.push(href);
  };

  const onHide = () => {
    if (!shown) return;
    const id = shown.id;
    close();
    hide.mutate(id, {
      onError: (error) => Alert.alert('Could not hide this sign', errorText(error)),
    });
  };

  return (
    <>
      <BottomSheetModal
        ref={sheet}
        enableDynamicSizing
        enablePanDownToClose
        onDismiss={() => {
          presented.current = false;
          onDismiss();
        }}
        handleIndicatorStyle={styles.handle}
        backgroundStyle={styles.background}
      >
        <BottomSheetView style={[styles.content, { paddingBottom: insets.bottom + spacing.base }]}>
          {shown ? (
            <Card
              sign={shown}
              onWhy={() => setWhy(shown.advertiser)}
              onOpen={open}
              onHide={onHide}
              hiding={hide.isPending}
            />
          ) : null}
        </BottomSheetView>
      </BottomSheetModal>
      <WhySheet advertiser={why} onDismiss={() => setWhy(null)} />
    </>
  );
}

type CardProps = {
  sign: MapSign;
  onWhy: () => void;
  onOpen: (href: Href) => void;
  onHide: () => void;
  hiding: boolean;
};

function Card({ sign, onWhy, onOpen, onHide, hiding }: CardProps) {
  const { card } = sign;
  const perk = usePerk(card.perkId ?? undefined);
  const action = mainAction(card, perk.data);

  return (
    <>
      {sign.own ? null : (
        <View style={styles.topRow}>
          <SponsoredTag />
          <Pressable
            onPress={onWhy}
            hitSlop={layout.hitSlop}
            accessibilityRole="button"
            accessibilityLabel="Why am I seeing this?"
            accessibilityHint={`Says who paid for this sign`}
          >
            {({ pressed }) => <Text style={[styles.why, pressed && styles.whyPressed]}>Why am I seeing this?</Text>}
          </Pressable>
        </View>
      )}

      <View style={styles.offer}>
        <SignTile
          text={card.logoText || sign.advertiser}
          colorTop={sign.colorTop}
          colorBottom={sign.colorBottom}
          ink={sign.ink}
          size={TILE}
        />
        <View style={styles.offerText}>
          <Text style={styles.title} numberOfLines={2} accessibilityRole="header">
            {card.title}
          </Text>
          {card.subtitle ? (
            <Text style={styles.subtitle} numberOfLines={2}>
              {card.subtitle}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={styles.actions}>
        {action ? (
          <PressableScale
            onPress={() => onOpen(action.href)}
            style={[styles.button, styles.mainButton]}
            accessibilityRole="button"
            accessibilityLabel={action.label}
          >
            <Text style={styles.mainLabel} numberOfLines={1}>
              {action.label}
            </Text>
          </PressableScale>
        ) : null}
        <PressableScale
          onPress={onHide}
          disabled={hiding}
          style={[styles.button, styles.hideButton, !action && styles.hideAlone]}
          accessibilityRole="button"
          accessibilityLabel="Hide"
          accessibilityHint="Stops showing this sign to you"
          accessibilityState={{ disabled: hiding }}
        >
          <Text style={styles.hideLabel}>Hide</Text>
        </PressableScale>
      </View>
    </>
  );
}

/** "Claim for 400 Glow" for a perk, "See the party" or "See the venue" otherwise, nothing when it leads nowhere. */
function mainAction(card: MapSign['card'], perk: PerkItem | undefined): { label: string; href: Href } | null {
  if (card.perkId) {
    let label = 'See the perk';
    if (perk?.state === 'claimed') label = 'Show your code';
    else if (perk) label = `Claim for ${perk.glowCost.toLocaleString('en-US')} Glow`;
    return { label, href: routes.perk(card.perkId) };
  }
  if (card.partyId) return { label: 'See the party', href: `/party/${card.partyId}` };
  if (card.venueId) return { label: 'See the venue', href: `/venue/${card.venueId}` };
  return null;
}

const styles = StyleSheet.create({
  background: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.sheet,
    borderTopRightRadius: radii.sheet,
  },
  handle: {
    backgroundColor: colors.labelTertiary,
    width: layout.sheetHandleWidth,
  },
  content: {
    paddingHorizontal: 22,
    paddingTop: spacing.xs,
    gap: 14,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  why: {
    ...typography.footnote,
    color: colors.labelTertiary,
  },
  whyPressed: {
    color: colors.labelSecondary,
  },
  offer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  offerText: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...typography.headline,
    color: colors.label,
  },
  subtitle: {
    ...typography.footnote,
    color: colors.labelSecondary,
  },
  actions: {
    flexDirection: 'row',
    gap: 11,
  },
  button: {
    minHeight: 47,
    borderRadius: radii.button,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
  },
  mainButton: {
    flex: 1,
    paddingHorizontal: spacing.base,
  },
  mainLabel: {
    ...typography.subheadline,
    fontWeight: '600',
    color: colors.paid,
  },
  hideButton: {
    paddingHorizontal: spacing.lg,
  },
  hideAlone: {
    flex: 1,
  },
  hideLabel: {
    ...typography.subheadline,
    fontWeight: '600',
    color: colors.label,
  },
});
