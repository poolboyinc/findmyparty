import { Fragment, useCallback, useReducer, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Failed, Loading } from '@/components/afterglow/state';
import { Display } from '@/components/afterglow/text';
import { EarnList } from '@/components/glow/earn-list';
import { GlowRing } from '@/components/glow/glow-ring';
import { LevelLadder } from '@/components/glow/level-ladder';
import { useGlow } from '@/components/glow/use-glow';
import { shortDate } from '@/components/pass/format';
import { PrimaryButton } from '@/components/ui/primary-button';
import { ApiError } from '@/services/api';
import { LEVELS, formatGlow, type Glow, type HistoryRow } from '@/services/glow';
import { colors, layout, radii, spacing, typography } from '@/theme';

/** How many past nights the list shows. */
const HISTORY_ROWS = 12;

/** The Glow tab: where the guest stands (ring, level, ladder), how Glow is earned, and the nights that earned it. */
export default function GlowTab() {
  const insets = useSafeAreaInsets();
  const { glow, bookings } = useGlow();
  const { error, isPending, refetch } = bookings;
  const [refreshing, setRefreshing] = useState(false);

  // react-native-screens v4 can hand a tab back unpainted; a render on focus repaints it.
  // Coming back is also a reason to look again: there may have been a scan since.
  const [, repaint] = useReducer((n: number) => n + 1, 0);
  useFocusEffect(
    useCallback(() => {
      repaint();
      void refetch({ cancelRefetch: false });
    }, [refetch]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  const signedOut = error instanceof ApiError && error.kind === 'signed_out';
  const tabBarRoom = insets.bottom + layout.floatingTabBarHeight + layout.floatingTabBarBottomOffset + spacing.base;

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.base, paddingBottom: tabBarRoom }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.labelSecondary} />}
      >
        <View style={styles.header}>
          <Display size="lg" accessibilityRole="header">
            Glow
          </Display>
          {glow && glow.streak > 0 ? <Text style={styles.streak}>{glow.streak}-week streak</Text> : null}
        </View>

        {glow ? (
          <GlowBoard glow={glow} />
        ) : isPending ? (
          <View style={styles.state}>
            <Loading />
          </View>
        ) : signedOut ? (
          <View style={styles.signedOut}>
            <Text style={styles.signedOutText}>Sign in to see your Glow</Text>
            <PrimaryButton label="Sign in" onPress={() => router.replace('/onboarding')} />
          </View>
        ) : (
          <View style={styles.state}>
            <Failed error={error} onRetry={() => refetch()} />
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function GlowBoard({ glow }: { glow: Glow }) {
  const history = glow.history.slice(0, HISTORY_ROWS);
  return (
    <>
      <View style={styles.card}>
        <GlowRing total={glow.total} fill={glow.ring} />
        <View style={styles.standing}>
          <Text style={styles.levelOf}>
            Level {glow.levelNumber} of {LEVELS.length}
          </Text>
          <Display size="lg" color={colors.earned} style={styles.levelName} numberOfLines={1} adjustsFontSizeToFit>
            {glow.level.name}
          </Display>
          {glow.next && glow.toNext !== null ? (
            <Text style={styles.toNext}>
              <Text style={styles.toNextFigure}>{formatGlow(glow.toNext)}</Text> to {glow.next.name}
            </Text>
          ) : (
            <Text style={styles.toNext}>The top level</Text>
          )}
        </View>
      </View>

      <View style={styles.ladder}>
        <LevelLadder current={glow.level.name} ladder={glow.ladder} />
      </View>

      <Text style={styles.section} accessibilityRole="header">
        How you earn
      </Text>
      <EarnList />

      {history.length > 0 ? (
        <>
          <Text style={styles.section} accessibilityRole="header">
            {history.length === 1 ? 'Last night' : 'Last nights'}
          </Text>
          <View>
            {history.map((row, i) => (
              <Fragment key={row.bookingId}>
                {i > 0 ? <View style={styles.line} /> : null}
                <HistoryLine row={row} />
              </Fragment>
            ))}
          </View>
        </>
      ) : null}
    </>
  );
}

function HistoryLine({ row }: { row: HistoryRow }) {
  const date = shortDate(new Date(row.at));
  return (
    <View style={styles.historyRow} accessible accessibilityRole="text" accessibilityLabel={`${row.title}, ${date}, plus ${row.points} Glow`}>
      <View style={styles.historyWords}>
        <Text style={styles.historyTitle} numberOfLines={1}>
          {row.title}
        </Text>
        <Text style={styles.historyDate}>{date}</Text>
      </View>
      <Text style={styles.historyPoints}>+{formatGlow(row.points)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: layout.screenMargin,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  streak: {
    ...typography.subheadline,
    fontWeight: '700',
    color: colors.earned,
    fontVariant: ['tabular-nums'],
  },
  card: {
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg - 1,
    padding: spacing.lg - 1,
    backgroundColor: colors.surface,
    borderRadius: radii.card,
  },
  standing: {
    flex: 1,
  },
  levelOf: {
    ...typography.footnote,
    fontWeight: '600',
    color: colors.labelTertiary,
  },
  levelName: {
    marginTop: spacing.xs + 1,
  },
  toNext: {
    ...typography.subheadline,
    color: colors.labelSecondary,
    marginTop: spacing.xs + 1,
    fontVariant: ['tabular-nums'],
  },
  toNextFigure: {
    fontWeight: '700',
    color: colors.label,
  },
  ladder: {
    marginTop: spacing.md + 1,
  },
  section: {
    ...typography.subheadline,
    fontWeight: '600',
    color: colors.labelSecondary,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  line: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.separator,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm + 1,
  },
  historyWords: {
    flex: 1,
    gap: spacing.xxs,
  },
  historyTitle: {
    ...typography.body,
    color: colors.label,
  },
  historyDate: {
    ...typography.footnote,
    color: colors.labelTertiary,
  },
  historyPoints: {
    ...typography.bodyEmphasized,
    color: colors.earned,
    fontVariant: ['tabular-nums'],
  },
  state: {
    minHeight: 240,
    justifyContent: 'center',
  },
  signedOut: {
    gap: spacing.base,
    paddingTop: spacing.xl,
  },
  signedOutText: {
    ...typography.body,
    color: colors.labelSecondary,
  },
});
