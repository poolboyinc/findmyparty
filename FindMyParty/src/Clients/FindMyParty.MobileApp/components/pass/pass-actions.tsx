import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { PressableScale } from '@/components/afterglow/motion';
import { Icon } from '@/components/ui/icon';
import { routes } from '@/constants/routes';
import type { Booking } from '@/types/api';
import { colors, layout, radii, spacing, typography } from '@/theme';
import { cancelLabel, showSendToGuest } from './format';

type Props = {
  /** The booking of the ticket on screen. Null when only its saved pass is known (no signal). */
  booking: Booking | null;
  onSendToGuest: (booking: Booking) => void;
  onCancel: (booking: Booking) => void;
};

/** Walking directions in Maps, for a party that has a place but no venue the city map knows. */
function walkingUrl(latitude: number, longitude: number): string {
  const destination = `${latitude},${longitude}`;
  return Platform.OS === 'ios'
    ? `https://maps.apple.com/?daddr=${destination}&dirflg=w`
    : `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=walking`;
}

/**
 * Under the ticket: "Walk me there" (the walk on the city map), "Send to a guest", and the quiet
 * link to cancel the pass (or, on a pass someone gave you, to give it back).
 */
export function PassActions({ booking, onSendToGuest, onCancel }: Props) {
  const party = booking?.party ?? null;
  const venueId = party?.venueId ?? null;
  // 0,0 is what a party without a place comes back as.
  const hasPlace = !!party && (!!venueId || party.latitude !== 0 || party.longitude !== 0);
  const canSend = showSendToGuest(booking);
  const cancel = cancelLabel(booking);

  if (!booking || (!hasPlace && !canSend && !cancel)) return null;

  const walk = () => {
    if (venueId) router.navigate(routes.walkTo(venueId));
    else if (party) Linking.openURL(walkingUrl(party.latitude, party.longitude)).catch(() => {});
  };

  return (
    <View style={styles.root}>
      {hasPlace || canSend ? (
        <View style={styles.row}>
          {hasPlace ? (
            <PressableScale
              style={styles.button}
              onPress={walk}
              accessibilityRole="button"
              accessibilityLabel="Walk me there"
              accessibilityHint={venueId ? 'Shows the walk to the venue on the city map' : 'Opens walking directions in Maps'}
            >
              <Icon sfSymbol="figure.walk" ionicon="walk" size={18} color={colors.label} />
              <Text style={styles.label} numberOfLines={1}>
                Walk me there
              </Text>
            </PressableScale>
          ) : null}
          {canSend ? (
            <PressableScale
              style={styles.button}
              onPress={() => onSendToGuest(booking)}
              accessibilityRole="button"
              accessibilityLabel="Send to a guest"
              accessibilityHint="Turns a spot on this pass into a link for a friend"
            >
              <Icon sfSymbol="person.2" ionicon="people-outline" size={18} color={colors.label} />
              <Text style={styles.label} numberOfLines={1}>
                Send to a guest
              </Text>
            </PressableScale>
          ) : null}
        </View>
      ) : null}

      {cancel ? (
        <Pressable
          onPress={() => onCancel(booking)}
          hitSlop={layout.hitSlop}
          style={styles.cancel}
          accessibilityRole="button"
          accessibilityLabel={cancel}
          accessibilityHint="Asks before it does anything"
        >
          {({ pressed }) => <Text style={[styles.cancelLabel, pressed && styles.cancelPressed]}>{cancel}</Text>}
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    paddingHorizontal: layout.screenMargin,
    paddingTop: spacing.base,
    alignItems: 'stretch',
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md - 1,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    height: 50,
    borderRadius: radii.button,
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: spacing.md,
  },
  label: {
    ...typography.subheadline,
    fontSize: 16,
    fontWeight: '700',
    color: colors.label,
    flexShrink: 1,
  },
  cancel: {
    alignSelf: 'center',
    marginTop: spacing.lg,
    paddingVertical: spacing.xs,
  },
  cancelLabel: {
    ...typography.footnote,
    color: colors.labelTertiary,
  },
  cancelPressed: {
    color: colors.labelSecondary,
  },
});
