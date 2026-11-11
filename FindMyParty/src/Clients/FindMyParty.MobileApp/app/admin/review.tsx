import { useState, type ReactNode } from 'react';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';
import Animated, { LinearTransition } from 'react-native-reanimated';
import { AdminScreen } from '@/components/admin/admin-screen';
import { useReducedMotion } from '@/components/afterglow/motion';
import { Empty, Failed, Loading } from '@/components/afterglow/state';
import { ReportCard, ReviewSignCard } from '@/components/signs/review-cards';
import { useAdminReports, useAdminSigns, useMe } from '@/hooks/queries';
import { colors, layout, spacing, typography } from '@/theme';

/**
 * "Platform review", for the platform admin only (reached from the Venue tab): signs waiting for
 * review, then open reports about people. Each card is closed with its own buttons.
 */
export default function ReviewScreen() {
  const me = useMe();
  const isAdmin = me.data?.roles?.includes('Admin') ?? false;

  let content: ReactNode;
  if (me.isLoading) content = <Loading />;
  else if (!isAdmin) content = <Empty title="For the platform admin" body="Only the platform admin can review signs and reports." />;
  else content = <ReviewLists />;

  return (
    <AdminScreen title="Platform review" keyboardAvoiding scroll={false}>
      {content}
    </AdminScreen>
  );
}

function ReviewLists() {
  const signs = useAdminSigns('pendingReview');
  const reports = useAdminReports('open');
  const reduceMotion = useReducedMotion();
  const [refreshing, setRefreshing] = useState(false);
  const glide = reduceMotion ? undefined : LinearTransition.springify();

  const refresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([signs.refetch(), reports.refetch()]);
    } finally {
      setRefreshing(false);
    }
  };

  let signPart: ReactNode;
  if (!signs.data && signs.isError) signPart = <Failed error={signs.error} onRetry={() => signs.refetch()} />;
  else if (!signs.data) signPart = <Loading />;
  else if (signs.data.length === 0) signPart = <Empty title="Nothing to review" />;
  else
    signPart = signs.data.map((sign) => (
      <Animated.View key={sign.id} layout={glide}>
        <ReviewSignCard sign={sign} />
      </Animated.View>
    ));

  let reportPart: ReactNode;
  if (!reports.data && reports.isError) reportPart = <Failed error={reports.error} onRetry={() => reports.refetch()} />;
  else if (!reports.data) reportPart = <Loading />;
  else if (reports.data.length === 0) reportPart = <Empty title="No open reports" />;
  else
    reportPart = reports.data.map((report) => (
      <Animated.View key={report.id} layout={glide}>
        <ReportCard report={report} />
      </Animated.View>
    ));

  return (
    <Animated.ScrollView
      contentContainerStyle={styles.scroll}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.labelSecondary} />}
    >
      <Text style={styles.section} accessibilityRole="header">
        Signs to review
      </Text>
      <View style={styles.list}>{signPart}</View>
      <Text style={styles.section} accessibilityRole="header">
        Reports
      </Text>
      <View style={styles.list}>{reportPart}</View>
    </Animated.ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: layout.screenMargin,
    paddingBottom: spacing.xxxl,
  },
  section: {
    ...typography.footnote,
    fontWeight: '600',
    color: colors.labelSecondary,
    marginTop: spacing.base,
    marginBottom: spacing.sm,
  },
  list: {
    gap: spacing.md,
    minHeight: 80,
  },
});
