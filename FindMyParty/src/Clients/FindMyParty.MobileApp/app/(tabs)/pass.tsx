import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Failed, Loading } from '@/components/afterglow/state';
import { Display } from '@/components/afterglow/text';
import { savedUpcoming, splitBookings } from '@/components/pass/format';
import { NoPass, PassBoard } from '@/components/pass/pass-board';
import { useNow } from '@/components/pass/useNow';
import { useSavedPasses } from '@/components/pass/usePassData';
import { PrimaryButton } from '@/components/ui/primary-button';
import { useMe, useMyBookings } from '@/hooks/queries';
import { ApiError } from '@/services/api';
import { errorText } from '@/services/errorText';
import { colors, layout, spacing, typography } from '@/theme';

/** The Pass tab: the ticket for tonight (or the next night), and the nights before it. */
export default function PassTab() {
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  const now = useNow();
  const { data, error, isPending, refetch } = useMyBookings();
  const me = useMe();
  const [refreshing, setRefreshing] = useState(false);

  // Coming back to the tab is a reason to look again: a new booking, a scan, a party called off.
  useFocusEffect(
    useCallback(() => {
      void refetch({ cancelRefetch: false });
    }, [refetch]),
  );

  const signedOut = error instanceof ApiError && error.kind === 'signed_out';

  // With no signal and nothing loaded (the app was opened at the door), fall back to the passes saved on the phone.
  const cannotLoad = !data && !!error && !signedOut;
  const saved = useSavedPasses(cannotLoad);

  // The split only needs the minute, so the lists stay the same objects from one second to the next.
  const minute = Math.floor(now / 60_000) * 60_000;
  const { upcoming, past } = useMemo(() => splitBookings(data ?? [], minute), [data, minute]);
  const savedEntries = useMemo(() => savedUpcoming(saved ?? [], minute), [saved, minute]);

  const onRefresh = () => {
    setRefreshing(true);
    refetch().finally(() => setRefreshing(false));
  };

  const guestName = me.data?.userName ?? null;

  let body: ReactNode;
  if (signedOut) {
    body = (
      <View style={styles.signIn}>
        <Text style={styles.signInText}>Sign in to see your passes</Text>
        <PrimaryButton label="Sign in" onPress={() => router.push('/onboarding')} accessibilityHint="Opens sign in" />
      </View>
    );
  } else if (data) {
    body =
      data.length === 0 ? (
        <NoPass title="No pass yet" fill />
      ) : (
        <PassBoard entries={upcoming} past={past} now={now} focused={focused} guestName={guestName} />
      );
  } else if (isPending || (cannotLoad && saved === null)) {
    body = <Loading />;
  } else if (savedEntries.length > 0) {
    body = (
      <PassBoard
        entries={savedEntries}
        past={[]}
        now={now}
        focused={focused}
        guestName={guestName}
        notice={`${errorText(error)} Showing the pass saved on this phone.`}
      />
    );
  } else {
    body = <Failed error={error} onRetry={() => void refetch()} />;
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top + spacing.md }]}>
      <Display size="md" style={styles.title} accessibilityRole="header">
        Pass
      </Display>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + layout.floatingTabBarHeight + layout.floatingTabBarBottomOffset + spacing.base },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.labelSecondary} />}
      >
        {body}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  title: {
    paddingHorizontal: layout.screenMargin,
    paddingBottom: spacing.base,
  },
  scroll: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
  },
  signIn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.base,
    padding: spacing.xl,
  },
  signInText: {
    ...typography.headline,
    color: colors.label,
    textAlign: 'center',
  },
});
