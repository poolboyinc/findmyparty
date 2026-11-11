import { useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PressableScale, useReducedMotion } from '@/components/afterglow/motion';
import { SponsoredTag } from '@/components/afterglow/sponsored-tag';
import { Failed, Loading } from '@/components/afterglow/state';
import { Display } from '@/components/afterglow/text';
import { SquareControl } from '@/components/finding/hero';
import { ClaimCode } from '@/components/glow/claim-code';
import { PrimaryButton } from '@/components/ui/primary-button';
import { useClaimPerk, useGlow, usePerk } from '@/hooks/queries';
import { ApiError } from '@/services/api';
import { errorText } from '@/services/errorText';
import { formatGlow } from '@/services/glow';
import { colors, fonts, layout, radii, spacing, typography } from '@/theme';
import type { PerkItem } from '@/types/api';

/** "#ffd23c" from what the server stored ("ffd23c" or "#FFD23C"), or the fallback. */
function hex(value: string | null, fallback: string): string {
  if (!value) return fallback;
  const v = value.trim();
  return /^#?[0-9a-f]{6}$/i.test(v) ? (v.startsWith('#') ? v : `#${v}`) : fallback;
}

/** A sponsored perk (opened from Glow's "Your perks" or a sign's card): what it is, what it costs, and once claimed, its code. */
export default function PerkScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const perk = usePerk(id);
  const glow = useGlow();

  // A page sheet on iOS starts below the status bar already.
  const top = Platform.OS === 'ios' ? spacing.lg : insets.top + spacing.base;
  const signedOut = perk.error instanceof ApiError && perk.error.kind === 'signed_out';

  return (
    <View style={[styles.root, { paddingTop: top }]}>
      <View style={styles.bar}>
        <SquareControl sfSymbol="xmark" ionicon="close" onPress={() => router.back()} accessibilityLabel="Close" tone="solid" />
      </View>

      {perk.data ? (
        <PerkBody perk={perk.data} balance={glow.data?.balance ?? null} bottom={insets.bottom} />
      ) : perk.isPending ? (
        <Loading />
      ) : signedOut ? (
        <View style={styles.signedOut}>
          <Text style={styles.body}>Sign in to claim perks with your Glow.</Text>
          <PrimaryButton label="Sign in" onPress={() => router.replace('/onboarding')} />
        </View>
      ) : (
        <Failed error={perk.error} onRetry={() => perk.refetch()} />
      )}
    </View>
  );
}

function PerkBody({ perk, balance, bottom }: { perk: PerkItem; balance: number | null; bottom: number }) {
  const claimPerk = useClaimPerk();
  const reduceMotion = useReducedMotion();
  const [now] = useState(() => new Date());

  // The answer to the claim shows at once; the refetch it triggers brings the same claim back.
  const claim = perk.claim ?? claimPerk.data ?? null;
  const short = perk.state === 'short' || (balance !== null && balance < perk.glowCost);
  const locked = perk.state === 'locked';
  const venue = perk.venueNames[0] ?? 'the venue';

  const claimIt = () => {
    Alert.alert(`Spend ${formatGlow(perk.glowCost)} Glow?`, `${perk.title}, to show at ${venue}. A claim cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Claim',
        onPress: () =>
          claimPerk.mutate(perk.id, {
            onSuccess: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
            onError: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
          }),
      },
    ]);
  };

  const ink = hex(perk.ink, colors.ink);

  return (
    <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottom + spacing.xl }]} showsVerticalScrollIndicator={false}>
      {/* The sponsor's own colours: an illustration, like a sign in the city. */}
      <LinearGradient
        colors={[hex(perk.colorTop, colors.paid), hex(perk.colorBottom, colors.paid)]}
        style={styles.tile}
        accessible
        accessibilityRole="image"
        accessibilityLabel={perk.sponsorName ?? perk.title}
      >
        <Text style={[styles.logo, { color: ink }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>
          {perk.logoText ?? perk.sponsorName ?? ''}
        </Text>
      </LinearGradient>

      <View style={styles.heading}>
        <Display size="md" accessibilityRole="header">
          {perk.title}
        </Display>
        <SponsoredTag />
        <Text style={styles.body}>{perk.subtitle}</Text>
      </View>

      {claim ? (
        <Animated.View entering={reduceMotion ? undefined : ZoomIn.springify().damping(14).stiffness(120)}>
          <ClaimCode claim={claim} now={now} />
        </Animated.View>
      ) : (
        <View style={styles.spend}>
          <View style={styles.costRow}>
            <Text style={styles.costLabel}>Costs</Text>
            <Text style={styles.costValue}>{formatGlow(perk.glowCost)} Glow</Text>
          </View>
          <View style={styles.line} />
          <View style={styles.costRow}>
            <Text style={styles.costLabel}>You have</Text>
            <Text style={styles.costValue}>{balance === null ? '…' : `${formatGlow(balance)} to spend`}</Text>
          </View>

          <PressableScale
            onPress={claimIt}
            disabled={short || locked || claimPerk.isPending}
            style={[styles.claim, (short || locked) && styles.claimOff]}
            accessibilityRole="button"
            accessibilityLabel={`Claim for ${formatGlow(perk.glowCost)} Glow`}
            accessibilityState={{ disabled: short || locked || claimPerk.isPending, busy: claimPerk.isPending }}
          >
            <Text style={styles.claimLabel}>
              {claimPerk.isPending ? 'Claiming…' : `Claim for ${formatGlow(perk.glowCost)} Glow`}
            </Text>
          </PressableScale>

          {locked ? (
            <Text style={styles.note}>Unlocks at {perk.minLevelName}.</Text>
          ) : short && balance !== null ? (
            <Text style={styles.note}>You need {formatGlow(perk.glowCost - balance)} more Glow.</Text>
          ) : (
            <Text style={styles.note}>Glow you spend never lowers your level.</Text>
          )}
          {claimPerk.error ? (
            <Text style={styles.error} accessibilityLiveRegion="polite">
              {errorText(claimPerk.error)}
            </Text>
          ) : null}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  bar: {
    paddingHorizontal: layout.screenMargin,
    paddingBottom: spacing.sm,
    alignItems: 'flex-start',
  },
  content: {
    paddingHorizontal: layout.screenMargin,
    gap: spacing.lg,
  },
  tile: {
    height: 150,
    borderRadius: radii.ticket,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  logo: {
    fontFamily: fonts.display,
    fontSize: 56,
    lineHeight: 60,
  },
  heading: {
    gap: spacing.xs,
  },
  body: {
    ...typography.callout,
    color: colors.labelSecondary,
  },
  spend: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: spacing.base,
    gap: spacing.md,
  },
  costRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  costLabel: {
    ...typography.body,
    color: colors.labelSecondary,
  },
  costValue: {
    ...typography.bodyEmphasized,
    color: colors.label,
    fontVariant: ['tabular-nums'],
  },
  line: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.separator,
  },
  claim: {
    marginTop: spacing.xs,
    minHeight: layout.buttonHeight,
    borderRadius: radii.button,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.base,
  },
  claimOff: {
    opacity: 0.45,
  },
  claimLabel: {
    ...typography.headline,
    color: colors.paid,
  },
  note: {
    ...typography.footnote,
    color: colors.labelSecondary,
  },
  error: {
    ...typography.subheadline,
    color: colors.danger,
  },
  signedOut: {
    paddingHorizontal: layout.screenMargin,
    paddingTop: spacing.xl,
    gap: spacing.base,
  },
});
