import { Fragment, useCallback, useReducer, useRef, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PressableScale } from '@/components/afterglow/motion';
import { Empty, Failed, Loading } from '@/components/afterglow/state';
import { Display } from '@/components/afterglow/text';
import { EarnSheet, type EarnSheetRef } from '@/components/glow/earn-sheet';
import { GlowRing } from '@/components/glow/glow-ring';
import { LevelLadder } from '@/components/glow/level-ladder';
import { PerkList } from '@/components/glow/perk-list';
import { nightLabel } from '@/components/glow/when';
import { PrimaryButton } from '@/components/ui/primary-button';
import { routes } from '@/constants/routes';
import { useGlow, usePerks } from '@/hooks/queries';
import { useHomeCity } from '@/hooks/useHomeCity';
import { ApiError } from '@/services/api';
import { formatGlow } from '@/services/glow';
import { colors, layout, radii, spacing, typography } from '@/theme';
import type { GlowNight, GlowSummary } from '@/types/api';

/** The Glow tab (S-17): where the guest stands, the perks that gives them, and the nights that earned it. All from the server. */
export default function GlowTab() {
  const insets = useSafeAreaInsets();
  const { slug, city } = useHomeCity();
  const glow = useGlow();
  const perks = usePerks(slug);
  const earnSheet = useRef<EarnSheetRef>(null);
  const [refreshing, setRefreshing] = useState(false);

  const { refetch: refetchGlow } = glow;
  const { refetch: refetchPerks } = perks;

  // react-native-screens v4 can hand a tab back unpainted; a render on focus repaints it.
  // Coming back is also a reason to look again: there may have been a scan or a claim since.
  const [, repaint] = useReducer((n: number) => n + 1, 0);
  useFocusEffect(
    useCallback(() => {
      repaint();
      void refetchGlow({ cancelRefetch: false });
      void refetchPerks({ cancelRefetch: false });
    }, [refetchGlow, refetchPerks]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([refetchGlow(), refetchPerks()]);
    } finally {
      setRefreshing(false);
    }
  }, [refetchGlow, refetchPerks]);

  const summary = glow.data;
  const signedOut = glow.error instanceof ApiError && glow.error.kind === 'signed_out';
  const tabBarRoom = insets.bottom + layout.floatingTabBarHeight + layout.floatingTabBarBottomOffset + spacing.base;

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.base, paddingBottom: tabBarRoom }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          summary ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.labelSecondary} /> : undefined
        }
      >
        <View style={styles.header}>
          <Display size="lg" accessibilityRole="header">
            Glow
          </Display>
          {summary && summary.streakWeeks > 0 ? <Text style={styles.streak}>{summary.streakWeeks}-week streak</Text> : null}
        </View>

        {summary ? (
          <>
            <Standing summary={summary} onPress={() => earnSheet.current?.present()} />

            <Text style={styles.section} accessibilityRole="header">
              Your perks
            </Text>
            {perks.data ? (
              perks.data.length > 0 ? (
                <PerkList perks={perks.data} balance={summary.balance} />
              ) : (
                <View style={styles.perksState}>
                  <Empty title="No perks here yet" body={`Venues in ${city?.name ?? 'your city'} have not switched any on.`} />
                </View>
              )
            ) : perks.isPending ? (
              <View style={styles.perksState}>
                <Loading />
              </View>
            ) : (
              <View style={styles.perksState}>
                <Failed error={perks.error} onRetry={() => refetchPerks()} />
              </View>
            )}

            <LastNights nights={summary.lastNights} />
          </>
        ) : glow.isPending ? (
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
            <Failed error={glow.error} onRetry={() => refetchGlow()} />
          </View>
        )}
      </ScrollView>

      {summary ? <EarnSheet ref={earnSheet} multiplierFromWeek={summary.multiplierFromWeek} /> : null}
    </View>
  );
}

/** The ring card and the ladder under it. The card opens "How you earn". */
function Standing({ summary, onPress }: { summary: GlowSummary; onPress: () => void }) {
  const { level, next, toNext } = summary;
  const spoken =
    `${formatGlow(summary.lifetime)} Glow. Level ${level.number} of ${summary.levels.length}, ${level.name}.` +
    (next && toNext !== null ? ` ${formatGlow(toNext)} to ${next.name}.` : ' The top level.');

  return (
    <>
      <PressableScale
        onPress={onPress}
        scaleTo={0.98}
        style={styles.card}
        accessibilityRole="button"
        accessibilityLabel={spoken}
        accessibilityHint="Shows how you earn Glow"
      >
        <GlowRing total={summary.lifetime} fill={summary.ring} />
        <View style={styles.standing}>
          <Text style={styles.levelOf}>
            Level {level.number} of {summary.levels.length}
          </Text>
          <Display size="lg" color={colors.earned} style={styles.levelName} numberOfLines={1} adjustsFontSizeToFit>
            {level.name}
          </Display>
          {next && toNext !== null ? (
            <Text style={styles.toNext}>
              <Text style={styles.toNextFigure}>{formatGlow(toNext)}</Text> to {next.name}
            </Text>
          ) : (
            <Text style={styles.toNext}>The top level</Text>
          )}
        </View>
      </PressableScale>

      <View style={styles.ladder}>
        <LevelLadder levels={summary.levels} current={level.name} ladder={summary.ladder} />
      </View>
    </>
  );
}

/** "Last night" (one row) or "Last nights": what each scan earned. A row opens that night's recap. */
function LastNights({ nights }: { nights: GlowNight[] }) {
  const several = nights.length > 1;
  return (
    <>
      <Text style={styles.section} accessibilityRole="header">
        {several ? 'Last nights' : 'Last night'}
      </Text>
      {nights.length === 0 ? (
        <Text style={styles.noNights}>Nothing yet. Your first scan at a door starts your Glow.</Text>
      ) : (
        <View>
          {nights.map((night, i) => (
            <Fragment key={`${night.bookingId}-${night.at}`}>
              {i > 0 ? <View style={styles.line} /> : null}
              <NightLine night={night} withDate={several} />
            </Fragment>
          ))}
        </View>
      )}
    </>
  );
}

function NightLine({ night, withDate }: { night: GlowNight; withDate: boolean }) {
  const date = nightLabel(night.date);
  return (
    <PressableScale
      onPress={() => router.push(routes.night(night.date))}
      scaleTo={0.98}
      style={styles.nightRow}
      accessibilityRole="button"
      accessibilityLabel={`${night.title}, ${date}, plus ${formatGlow(night.points)} Glow`}
      accessibilityHint="Opens the recap of that night"
    >
      <View style={styles.nightWords}>
        <Text style={styles.nightTitle} numberOfLines={1}>
          {night.title}
        </Text>
        {withDate ? <Text style={styles.nightDate}>{date}</Text> : null}
      </View>
      <Text style={styles.nightPoints}>+{formatGlow(night.points)}</Text>
    </PressableScale>
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
    ...typography.footnote,
    fontWeight: '700',
    color: colors.earned,
    fontVariant: ['tabular-nums'],
  },
  card: {
    marginTop: spacing.md + 1,
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
    ...typography.caption1,
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
  perksState: {
    minHeight: 140,
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.card,
  },
  line: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.separator,
  },
  nightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm + 1,
  },
  nightWords: {
    flex: 1,
    gap: spacing.xxs,
  },
  nightTitle: {
    ...typography.body,
    color: colors.label,
  },
  nightDate: {
    ...typography.footnote,
    color: colors.labelTertiary,
  },
  nightPoints: {
    ...typography.bodyEmphasized,
    color: colors.earned,
    fontVariant: ['tabular-nums'],
  },
  noNights: {
    ...typography.subheadline,
    color: colors.labelSecondary,
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
