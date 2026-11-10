import { Linking, Platform, StyleSheet, Text, View } from 'react-native';
import { PressableScale } from '@/components/afterglow/motion';
import { Icon } from '@/components/ui/icon';
import type { Booking } from '@/types/api';
import { colors, layout, radii, spacing, typography } from '@/theme';

type Props = {
  /** The booking of the ticket on screen. Null when only its saved pass is known (no signal). */
  booking: Booking | null;
  onCancel: (booking: Booking) => void;
};

/** Walking directions to a point: Apple Maps on iPhone, Google Maps elsewhere. */
function walkingUrl(latitude: number, longitude: number): string {
  const destination = `${latitude},${longitude}`;
  return Platform.OS === 'ios'
    ? `https://maps.apple.com/?daddr=${destination}&dirflg=w`
    : `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=walking`;
}

/** The two things to do with the ticket on screen: walk to the party, or give the spots back. */
export function PassActions({ booking, onCancel }: Props) {
  const party = booking?.party ?? null;
  // 0,0 is what a party without a place comes back as.
  const hasPlace = !!party && (party.latitude !== 0 || party.longitude !== 0);
  // Once someone from the booking is inside there is nothing left to cancel.
  const canCancel = !!booking && booking.checkedInCount === 0;

  if (!hasPlace && !canCancel) return null;

  return (
    <View style={styles.row}>
      {hasPlace ? (
        <PressableScale
          style={styles.button}
          onPress={() => {
            Linking.openURL(walkingUrl(party.latitude, party.longitude)).catch(() => {});
          }}
          accessibilityRole="button"
          accessibilityLabel="Walk me there"
          accessibilityHint="Opens walking directions to the party in Maps"
        >
          <Icon sfSymbol="figure.walk" ionicon="walk" size={18} color={colors.label} />
          <Text style={styles.label}>Walk me there</Text>
        </PressableScale>
      ) : null}
      {canCancel ? (
        <PressableScale
          style={styles.button}
          onPress={() => onCancel(booking)}
          accessibilityRole="button"
          accessibilityLabel="Cancel booking"
          accessibilityHint="Asks before cancelling"
        >
          <Icon sfSymbol="xmark" ionicon="close" size={16} color={colors.label} />
          <Text style={styles.label}>Cancel booking</Text>
        </PressableScale>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.md - 1,
    paddingHorizontal: layout.screenMargin,
    paddingTop: spacing.base,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 48,
    borderRadius: radii.button,
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  label: {
    ...typography.subheadline,
    fontWeight: '700',
    color: colors.label,
    flexShrink: 1,
  },
});
