import { StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Block } from '@/components/afterglow/block';
import { colors, radii, spacing, typography } from '@/theme';
import type { PerkClaim } from '@/types/api';
import { clockTime, goodUntil } from './when';

const QR_SIZE = 200;
const ignoreQrError = () => {};

/**
 * A claimed perk: the code to show at the venue (`qrText`, scanned by the door), or what became of it.
 * Drawn like the pass: dark code on paper.
 */
export function ClaimCode({ claim, now }: { claim: PerkClaim; now: Date }) {
  if (claim.status === 'redeemed') {
    const at = clockTime(claim.redeemedAt);
    return (
      <View style={styles.done} accessible accessibilityRole="text" accessibilityLabel={`Redeemed${at ? ` at ${at}` : ''}`}>
        <Block label="Redeemed" tone="earned" />
        <Text style={styles.doneText}>
          {claim.venueName} took this{at ? ` at ${at}` : ''}. Enjoy it.
        </Text>
      </View>
    );
  }

  if (claim.status === 'expired') {
    return (
      <View style={styles.done}>
        <Text style={styles.doneText}>This claim has expired.</Text>
      </View>
    );
  }

  const until = goodUntil(claim.expiresAt, now);
  return (
    <View style={styles.ticket}>
      <View accessible accessibilityRole="image" accessibilityLabel={`Claim code. Show it at ${claim.venueName}.`}>
        <QRCode value={claim.qrText} size={QR_SIZE} color={colors.ink} backgroundColor={colors.paper} ecl="M" onError={ignoreQrError} />
      </View>
      <Text style={styles.showAt}>Show this at {claim.venueName}</Text>
      {until ? <Text style={styles.until}>{until}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  ticket: {
    alignItems: 'center',
    backgroundColor: colors.paper,
    borderRadius: radii.ticket,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  showAt: {
    ...typography.headline,
    color: colors.ink,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  until: {
    ...typography.footnote,
    color: colors.ink,
    opacity: 0.6,
    fontVariant: ['tabular-nums'],
  },
  done: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: spacing.base,
    gap: spacing.sm,
  },
  doneText: {
    ...typography.subheadline,
    color: colors.labelSecondary,
  },
});
