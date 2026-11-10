import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import Svg, { Circle } from 'react-native-svg';
import { PASS_STEP_SECONDS, passCode, passQrText, passStepAt, secondsUntilNextCode } from '@/services/passCode';
import { colors, spacing, typography } from '@/theme';
import { alpha, countdown } from './format';

/** About half the screen's width, as on the mock. */
export const QR_SIZE = 200;

const RING_SIZE = 19;
const RING_STROKE = 3;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;
const RING_TRACK = alpha(colors.ink, 0.16);

type Props = {
  bookingId: string;
  secret: string;
  /** The screen's shared clock, in milliseconds. The code and the countdown follow it. */
  now: number;
};

const ignoreQrError = () => {};

/** The door code: a QR that changes every half minute, and how long until it does. */
export function CodePanel({ bookingId, secret, now }: Props) {
  const step = passStepAt(now);
  const seconds = secondsUntilNextCode(now);

  const value = useMemo(() => {
    try {
      return passQrText(bookingId, passCode(secret, step));
    } catch {
      return null;
    }
  }, [bookingId, secret, step]);

  if (!value) {
    return <Text style={styles.problem}>This pass could not be drawn. Pull down to load it again.</Text>;
  }

  return (
    <View style={styles.panel}>
      <View accessible accessibilityRole="image" accessibilityLabel="Door code. Show it to the host at the door.">
        <QRCode value={value} size={QR_SIZE} color={colors.ink} backgroundColor={colors.paper} ecl="M" onError={ignoreQrError} />
      </View>

      <View style={styles.timer} accessible accessibilityLabel={`New code in ${seconds} seconds`}>
        <Svg width={RING_SIZE} height={RING_SIZE}>
          <Circle cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RING_RADIUS} stroke={RING_TRACK} strokeWidth={RING_STROKE} fill="none" />
          <Circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RING_RADIUS}
            stroke={colors.ink}
            strokeWidth={RING_STROKE}
            fill="none"
            strokeDasharray={[RING_LENGTH, RING_LENGTH]}
            strokeDashoffset={RING_LENGTH * (1 - seconds / PASS_STEP_SECONDS)}
            rotation={-90}
            originX={RING_SIZE / 2}
            originY={RING_SIZE / 2}
          />
        </Svg>
        <Text style={styles.timerText}>New code in {countdown(seconds)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    alignItems: 'center',
    gap: spacing.md,
  },
  timer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  timerText: {
    ...typography.footnote,
    fontWeight: '600',
    color: colors.ink,
    fontVariant: ['tabular-nums'],
  },
  problem: {
    ...typography.footnote,
    color: colors.ink,
    textAlign: 'center',
  },
});
