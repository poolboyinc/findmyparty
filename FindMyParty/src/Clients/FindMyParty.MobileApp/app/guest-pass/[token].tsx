import { StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PressableScale } from '@/components/afterglow/motion';
import { Failed, Loading } from '@/components/afterglow/state';
import { Display } from '@/components/afterglow/text';
import { clock, shortDate, venueLine } from '@/components/pass/format';
import { Icon } from '@/components/ui/icon';
import { PrimaryButton } from '@/components/ui/primary-button';
import { routes } from '@/constants/routes';
import { useClaimGuestPass, useGuestPassPreview } from '@/hooks/queries';
import { errorText } from '@/services/errorText';
import { askForPush } from '@/services/push';
import { colors, layout, radii, spacing, typography } from '@/theme';

/** Opened from a guest link (`/g/{token}` → `guest-pass/{token}`): who sent it, the party, and "Take this pass". */
export default function GuestPassScreen() {
  const insets = useSafeAreaInsets();
  const { token } = useLocalSearchParams<{ token: string }>();
  const preview = useGuestPassPreview(token);
  const claim = useClaimGuestPass();

  const close = () => {
    if (router.canGoBack()) router.back();
    else router.replace(routes.pass);
  };

  const take = () => {
    if (!token || claim.isPending) return;
    claim.mutate(token, {
      onSuccess: () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        void askForPush();
        router.replace(routes.pass);
      },
      onError: () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      },
    });
  };

  let body;
  if (preview.data) {
    const data = preview.data;
    const start = new Date(data.startsAt);
    const when = Number.isNaN(start.getTime()) ? '' : `${shortDate(start)}, doors ${clock(start)}`;
    const where = venueLine(data.venueName, null);
    body = (
      <View style={styles.body}>
        <Text style={styles.from}>{data.hostName} sent you a pass</Text>
        <Display size="lg" accessibilityRole="header" numberOfLines={3}>
          {data.partyTitle}
        </Display>
        {where || when ? <Text style={styles.detail}>{[where, when].filter(Boolean).join(', ')}</Text> : null}
        <Text style={styles.explain}>One spot, with your own door code. You earn your own Glow when you are scanned in.</Text>

        <View style={styles.footer}>
          {data.status === 'open' ? (
            <>
              {claim.error ? (
                <Text style={styles.error} accessibilityLiveRegion="polite">
                  {errorText(claim.error)}
                </Text>
              ) : null}
              <PrimaryButton label="Take this pass" onPress={take} loading={claim.isPending} accessibilityHint="Adds the pass to your Pass tab" />
            </>
          ) : (
            <Text style={styles.closed}>
              {data.status === 'taken' ? 'Someone already took this pass.' : 'This pass is no longer valid.'}
            </Text>
          )}
        </View>
      </View>
    );
  } else if (preview.isPending) {
    body = <Loading />;
  } else {
    body = <Failed error={preview.error} onRetry={() => void preview.refetch()} />;
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + spacing.base }]}>
      <PressableScale onPress={close} style={styles.close} accessibilityRole="button" accessibilityLabel="Close">
        <Icon sfSymbol="xmark" ionicon="close" size={16} color={colors.label} />
      </PressableScale>
      {body}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: layout.screenMargin,
  },
  close: {
    width: 41,
    height: 41,
    borderRadius: radii.chip + 2,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    paddingTop: spacing.xxl,
    gap: spacing.md,
  },
  from: {
    ...typography.subheadline,
    fontWeight: '700',
    color: colors.label,
  },
  detail: {
    ...typography.subheadline,
    color: colors.labelSecondary,
  },
  explain: {
    ...typography.callout,
    color: colors.labelSecondary,
    marginTop: spacing.sm,
  },
  footer: {
    marginTop: 'auto',
    gap: spacing.md,
  },
  error: {
    ...typography.subheadline,
    color: colors.danger,
  },
  closed: {
    ...typography.callout,
    color: colors.labelSecondary,
    textAlign: 'center',
  },
});
