import { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { PressableScale } from '@/components/afterglow/motion';
import { useResolveReport, useReviewSign } from '@/hooks/queries';
import { errorText } from '@/services/errorText';
import { colors, radii, spacing, typography } from '@/theme';
import type { AdminReport, AdminSign } from '@/types/api';
import { openReportsLine, reportedByLine } from './review-format';
import { bookingTitle, dateRange, dayText, euros } from './sign-format';
import { signLines } from './sign-text';
import { SignTile } from './sign-tile';

/**
 * One sign waiting for review: the art, the words, who booked it and where, the dates and the price
 * to invoice. Approve, or reject with a note the host reads on Promote.
 */
export function ReviewSignCard({ sign }: { sign: AdminSign }) {
  const review = useReviewSign();
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState('');

  const send = (approve: boolean) => {
    const input = approve ? { id: sign.id, approve: true as const } : { id: sign.id, approve: false as const, note: note.trim() };
    review.mutate(input, {
      onSuccess: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
      onError: (error) => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert(approve ? 'Not approved' : 'Not rejected', errorText(error));
      },
    });
  };

  const by = [sign.advertiserName, sign.venueName].filter((part, i, all) => part && all.indexOf(part) === i).join(', ');

  return (
    <View style={styles.card}>
      <View style={styles.top}>
        <SignTile
          text={sign.text}
          colorTop={sign.colorTop}
          colorBottom={sign.colorBottom}
          ink={sign.ink}
          artworkUrl={sign.artworkUrl}
          size={56}
        />
        <View style={styles.text}>
          <Text style={styles.title}>{signLines(sign.text).join(' ')}</Text>
          <Text style={styles.line}>{by || sign.bookedBy}</Text>
          <Text style={styles.line}>{bookingTitle(sign)}</Text>
          <Text style={styles.line}>
            {dateRange(sign.startsOn, sign.endsOn)}, {euros(sign.price)} to invoice
          </Text>
          <Text style={styles.faint}>
            Booked by {sign.bookedBy}, {dayText(sign.createdAt)}
          </Text>
        </View>
      </View>

      {rejecting ? (
        <View style={styles.rejectBox}>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="Tell the host why"
            placeholderTextColor={colors.labelTertiary}
            maxLength={300}
            multiline
            style={styles.note}
            accessibilityLabel="Why the sign is not approved"
          />
          <View style={styles.actions}>
            <Action label="Back" onPress={() => setRejecting(false)} disabled={review.isPending} />
            <Action
              label="Reject"
              tone="danger"
              onPress={() => send(false)}
              disabled={review.isPending || note.trim() === ''}
              busy={review.isPending}
            />
          </View>
        </View>
      ) : (
        <View style={styles.actions}>
          <Action label="Reject" onPress={() => setRejecting(true)} disabled={review.isPending} />
          <Action label="Approve" tone="primary" onPress={() => send(true)} disabled={review.isPending} busy={review.isPending} />
        </View>
      )}
    </View>
  );
}

/** One open report: who was reported, by whom and why, and the three ways to close it. */
export function ReportCard({ report }: { report: AdminReport }) {
  const resolve = useResolveReport();
  const more = openReportsLine(report.reported.openReports);

  const act = (action: 'dismiss' | 'suspendSharing' | 'ban') => {
    resolve.mutate(
      { id: report.id, action },
      {
        onSuccess: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
        onError: (error) => Alert.alert('Not done', errorText(error)),
      },
    );
  };

  const confirmBan = () =>
    Alert.alert(`Ban @${report.reported.handle}?`, 'The account is locked and cannot sign in.', [
      { text: 'Keep', style: 'cancel' },
      { text: 'Ban', style: 'destructive', onPress: () => act('ban') },
    ]);

  return (
    <View style={styles.card}>
      <View style={styles.text}>
        <Text style={styles.title}>
          {report.reported.displayName} <Text style={styles.handle}>@{report.reported.handle}</Text>
        </Text>
        <Text style={styles.line}>{reportedByLine(report)}</Text>
        {report.note ? <Text style={styles.quote}>{report.note}</Text> : null}
        {more ? <Text style={styles.warn}>{more}</Text> : null}
        <Text style={styles.faint}>{dayText(report.createdAt)}</Text>
      </View>
      <View style={styles.actions}>
        <Action label="Dismiss" onPress={() => act('dismiss')} disabled={resolve.isPending} />
        <Action label="Suspend sharing" onPress={() => act('suspendSharing')} disabled={resolve.isPending} />
        <Action label="Ban" tone="danger" onPress={confirmBan} disabled={resolve.isPending} busy={resolve.isPending && resolve.variables?.action === 'ban'} />
      </View>
    </View>
  );
}

type ActionProps = {
  label: string;
  onPress: () => void;
  tone?: 'plain' | 'primary' | 'danger';
  disabled?: boolean;
  busy?: boolean;
};

function Action({ label, onPress, tone = 'plain', disabled = false, busy = false }: ActionProps) {
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      style={[styles.action, tone === 'primary' && styles.actionPrimary, disabled && styles.actionOff]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, busy }}
    >
      {busy ? (
        <ActivityIndicator color={colors.label} />
      ) : (
        <Text style={[styles.actionLabel, tone === 'danger' && styles.actionDanger]} numberOfLines={1}>
          {label}
        </Text>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: 14,
    gap: spacing.md,
  },
  top: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  text: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...typography.headline,
    color: colors.label,
  },
  handle: {
    ...typography.subheadline,
    fontWeight: '400',
    color: colors.labelSecondary,
  },
  line: {
    ...typography.footnote,
    color: colors.labelSecondary,
  },
  quote: {
    ...typography.subheadline,
    color: colors.label,
    marginTop: spacing.xs,
  },
  warn: {
    ...typography.footnote,
    fontWeight: '600',
    color: colors.danger,
  },
  faint: {
    ...typography.footnote,
    color: colors.labelTertiary,
  },
  rejectBox: {
    gap: spacing.md,
  },
  note: {
    ...typography.subheadline,
    color: colors.label,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.field,
    padding: spacing.md,
    minHeight: 64,
    textAlignVertical: 'top',
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  action: {
    flex: 1,
    minHeight: 44,
    borderRadius: radii.button,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  actionPrimary: {
    backgroundColor: colors.action,
  },
  actionOff: {
    opacity: 0.5,
  },
  actionLabel: {
    ...typography.subheadline,
    fontWeight: '600',
    color: colors.label,
  },
  actionDanger: {
    color: colors.danger,
  },
});
