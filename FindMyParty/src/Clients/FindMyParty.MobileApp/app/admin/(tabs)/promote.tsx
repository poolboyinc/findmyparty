import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PressableScale } from '@/components/afterglow/motion';
import { Empty, Failed, Loading } from '@/components/afterglow/state';
import { Display } from '@/components/afterglow/text';
import { useHostGate } from '@/components/host/use-host-gate';
import { BookedSigns } from '@/components/signs/booked-signs';
import { chooseFrom } from '@/components/signs/choose';
import { FormatRows } from '@/components/signs/format-rows';
import { PreviewCard } from '@/components/signs/preview-card';
import { resolveSign, setSignDraft, useSignDraft } from '@/components/signs/sign-draft';
import {
  bookableSpots,
  bookingPrice,
  bookLabel,
  localDateKey,
  nightWord,
  pickSpot,
  spotLabel,
  weekPhrase,
} from '@/components/signs/sign-format';
import { signTextHint, signTextProblem } from '@/components/signs/sign-text';
import { SignTile } from '@/components/signs/sign-tile';
import { Icon } from '@/components/ui/icon';
import { routes } from '@/constants/routes';
import { useBookSign, useHostVenue, useSignOptions } from '@/hooks/queries';
import { ApiError } from '@/services/apiClient';
import { errorText } from '@/services/errorText';
import { colors, layout, radii, spacing, typography } from '@/theme';
import type { SignFormat, SignInput, SignOptions } from '@/types/api';

const FORMAT_ORDER: readonly SignFormat[] = ['facade', 'hologram', 'tonightSlot'];

/** The Promote tab. Nothing is requested or painted until the host role is confirmed. */
export default function PromoteTab() {
  const allowed = useHostGate();
  if (!allowed) {
    return (
      <View style={styles.root}>
        <Loading />
      </View>
    );
  }
  return <PromoteScreen />;
}

/**
 * "Put a sign in the city" (S-20): the host picks a week, a format and a spot, sees their sign on the
 * real wall, and books it. Every booking waits for the platform admin; nothing is charged in the app.
 */
function PromoteScreen() {
  const insets = useSafeAreaInsets();
  const draft = useSignDraft();
  const options = useSignOptions(draft.week ?? undefined);
  const venue = useHostVenue();
  const book = useBookSign();
  const [picked, setPicked] = useState<SignFormat>('facade');
  const [pickedSpotId, setPickedSpotId] = useState<string | null>(null);
  const [barHeight, setBarHeight] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  // While another week loads, keep the last one on screen (dimmed) instead of a spinner.
  const [kept, setKept] = useState<SignOptions | null>(null);
  useEffect(() => {
    if (options.data) setKept(options.data);
  }, [options.data]);
  const data = options.data ?? kept;
  const stale = !options.data;

  const venueId = venue.data?.venueId ?? null;
  const venueName = venue.data?.venueName ?? null;
  const sign = resolveSign(draft, data?.parties, venueName ?? '');

  const unavailable = useMemo(() => {
    const off = new Set<SignFormat>();
    if (!data) return off;
    for (const format of FORMAT_ORDER) {
      if (format === 'tonightSlot') {
        const info = data.formats.find((f) => f.format === format);
        if (!info || info.free <= 0 || data.parties.length === 0) off.add(format);
      } else if (bookableSpots(data.spots, format, venueId).length === 0) {
        off.add(format);
      }
    }
    return off;
  }, [data, venueId]);

  // The format shown: the one picked while it can be booked, else the first that can.
  const shownFormats = data ? FORMAT_ORDER.filter((f) => data.formats.some((info) => info.format === f)) : [];
  const format = !unavailable.has(picked) ? picked : (shownFormats.find((f) => !unavailable.has(f)) ?? picked);
  const formatInfo = data?.formats.find((f) => f.format === format);
  const spot = data ? pickSpot(data.spots, format, venueId, pickedSpotId) : null;
  const choices = data ? bookableSpots(data.spots, format, venueId) : [];
  const price = bookingPrice(formatInfo, spot);
  const now = new Date();

  const refresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([options.refetch(), venue.refetch()]);
    } finally {
      setRefreshing(false);
    }
  };

  const chooseWeek = () => {
    if (!data) return;
    chooseFrom(
      'Week',
      data.weeks.map((w) => w.label),
      (index) => setSignDraft({ week: data.weeks[index].id }),
    );
  };

  const chooseSpot = () => {
    chooseFrom(
      'Spot',
      choices.map((s) => `${spotLabel(s)}${s.area ? `, ${s.area}` : ''}`),
      (index) => setPickedSpotId(choices[index].id),
    );
  };

  const selectFormat = (next: SignFormat) => {
    Haptics.selectionAsync();
    setPicked(next);
  };

  const canBook =
    !!data && !stale && !book.isPending && !unavailable.has(format) && (format === 'tonightSlot' ? !!sign.party : !!spot);

  let label: string;
  if (!data || unavailable.has(format)) {
    label = data ? `Nothing free ${weekPhrase(data.week)}` : 'Book';
  } else {
    label = bookLabel({
      format,
      spotNumber: spot?.number ?? null,
      price,
      night: format === 'tonightSlot' && sign.party ? nightWord(sign.party.startsAt, now) : null,
    });
  }

  const submit = () => {
    if (!data || !canBook) return;
    if (signTextProblem(sign.text)) {
      Alert.alert('Your sign needs words', signTextHint(sign.text), [
        { text: 'Not now', style: 'cancel' },
        { text: 'Edit the sign', onPress: () => router.push(routes.signArtwork) },
      ]);
      return;
    }
    const look = {
      text: sign.text,
      colorTop: sign.preset.colorTop,
      colorBottom: sign.preset.colorBottom,
      ink: sign.preset.ink,
      artworkUrl: sign.artworkUrl,
    };
    const input: SignInput =
      format === 'tonightSlot'
        ? { format, partyId: sign.party?.id, ...look }
        : { format, spotId: spot?.id, week: data.week.id, partyId: sign.party?.id, ...look };

    book.mutate(input, {
      onSuccess: () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('Booked', 'We look at every sign before it goes live, and let you know when it is approved.');
      },
      onError: (error) => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert('Not booked', errorText(error));
        if (error instanceof ApiError && (error.code === 'spot_taken' || error.code === 'slot_full')) options.refetch();
      },
    });
  };

  const tabClearance = insets.bottom + layout.floatingTabBarHeight + layout.floatingTabBarBottomOffset + spacing.md;

  let body: ReactNode;
  if (!data && options.isError) {
    body = <Failed error={options.error} onRetry={() => options.refetch()} />;
  } else if (!data) {
    body = <Loading />;
  } else if (data.formats.length === 0) {
    body = <Empty title="No signs in your city yet" body="When there are walls to book, they show here." />;
  } else {
    body = (
      <View style={[styles.flow, stale && styles.stale]}>
        <PreviewCard
          format={format}
          spot={spot}
          sign={sign}
          venueName={venueName}
          emptyLine={`Nothing free ${weekPhrase(data.week)}`}
          onChooseSpot={format !== 'tonightSlot' && choices.length > 1 ? chooseSpot : undefined}
        />

        <Text style={styles.section} accessibilityRole="header">
          Format
        </Text>
        <FormatRows formats={sortFormats(data)} week={data.week} selected={format} unavailable={unavailable} onSelect={selectFormat} />

        <Text style={styles.section} accessibilityRole="header">
          Your sign
        </Text>
        <PressableScale
          onPress={() => router.push(routes.signArtwork)}
          style={styles.yourSign}
          accessibilityRole="button"
          accessibilityLabel={`${sign.party ? `${sign.party.title} artwork` : 'Your sign'}. Reviewed before it goes live`}
          accessibilityHint="Change the words, colours and image"
        >
          <SignTile
            text={sign.text}
            colorTop={sign.preset.colorTop}
            colorBottom={sign.preset.colorBottom}
            ink={sign.preset.ink}
            artworkUrl={sign.artworkUrl}
            size={47}
            style={styles.thumb}
          />
          <View style={styles.yourSignText}>
            <Text style={styles.rowTitle} numberOfLines={1}>
              {sign.party ? `${sign.party.title} artwork` : 'Your sign'}
            </Text>
            <Text style={styles.rowSubtitle}>Reviewed before it goes live</Text>
          </View>
          <Icon sfSymbol="chevron.right" ionicon="chevron-forward" size={14} color={colors.labelTertiary} />
        </PressableScale>

        <BookedSigns bookings={data.mine} today={localDateKey(now)} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + spacing.sm, paddingBottom: (data ? barHeight : tabClearance) + spacing.lg },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.labelSecondary} />}
      >
        <View style={styles.header}>
          {router.canGoBack() ? (
            <PressableScale
              onPress={() => router.back()}
              hitSlop={layout.hitSlop}
              style={styles.square}
              accessibilityRole="button"
              accessibilityLabel="Back"
            >
              <Icon sfSymbol="chevron.left" ionicon="chevron-back" size={18} color={colors.label} />
            </PressableScale>
          ) : (
            <View style={styles.squareSpace} />
          )}
          <Text style={styles.portal}>Host portal</Text>
          {data ? (
            <PressableScale
              onPress={chooseWeek}
              style={styles.week}
              accessibilityRole="button"
              accessibilityLabel={`Week: ${data.week.label}. Choose another week`}
            >
              <Text style={styles.weekLabel} numberOfLines={1}>
                {data.week.label}
              </Text>
              <Icon sfSymbol="chevron.down" ionicon="chevron-down" size={12} color={colors.labelSecondary} />
            </PressableScale>
          ) : (
            <View style={styles.squareSpace} />
          )}
        </View>

        <Display style={styles.title} accessibilityRole="header">
          {'Put a sign\nin the city'}
        </Display>

        {body}
      </ScrollView>

      {data && data.formats.length > 0 ? (
        <View
          style={[styles.bar, { paddingBottom: tabClearance }]}
          onLayout={(e) => setBarHeight(Math.ceil(e.nativeEvent.layout.height))}
        >
          <PressableScale
            onPress={submit}
            disabled={!canBook}
            haptic={false}
            style={[styles.book, !canBook && !book.isPending && styles.bookOff]}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityHint="Sends the sign for review"
            accessibilityState={{ disabled: !canBook, busy: book.isPending }}
          >
            {book.isPending ? (
              <ActivityIndicator color={colors.ink} />
            ) : (
              <Text style={[styles.bookLabel, !canBook && styles.bookLabelOff]} numberOfLines={1}>
                {label}
              </Text>
            )}
          </PressableScale>
        </View>
      ) : null}
    </View>
  );
}

/** Facade, hologram, slot: the order drawn, whatever order the server sends. */
function sortFormats(data: SignOptions) {
  return [...data.formats].sort((a, b) => FORMAT_ORDER.indexOf(a.format) - FORMAT_ORDER.indexOf(b.format));
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: layout.screenMargin,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    minHeight: layout.minTouchTarget,
  },
  square: {
    width: layout.minTouchTarget,
    height: layout.minTouchTarget,
    borderRadius: radii.card,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  squareSpace: {
    width: layout.minTouchTarget,
  },
  portal: {
    ...typography.footnote,
    fontWeight: '600',
    color: colors.labelTertiary,
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    zIndex: -1,
  },
  week: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    height: layout.minTouchTarget - 3,
    paddingHorizontal: spacing.md,
    borderRadius: radii.card,
    backgroundColor: colors.surface,
  },
  weekLabel: {
    ...typography.subheadline,
    fontWeight: '600',
    color: colors.label,
  },
  title: {
    fontSize: 33,
    lineHeight: 35,
    marginTop: 14,
    marginBottom: 14,
  },
  flow: {
    flexGrow: 1,
  },
  stale: {
    opacity: 0.5,
  },
  section: {
    ...typography.footnote,
    fontWeight: '600',
    color: colors.labelSecondary,
    marginTop: spacing.base,
    marginBottom: spacing.sm,
  },
  yourSign: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: radii.card,
    backgroundColor: colors.surface,
  },
  thumb: {
    borderRadius: radii.lg,
  },
  yourSignText: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    ...typography.callout,
    fontWeight: '600',
    color: colors.label,
  },
  rowSubtitle: {
    ...typography.footnote,
    color: colors.labelSecondary,
  },
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: spacing.base,
    paddingHorizontal: 22,
    backgroundColor: colors.surface,
  },
  book: {
    height: layout.buttonHeight,
    borderRadius: radii.button,
    backgroundColor: colors.paid,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  bookOff: {
    backgroundColor: colors.fillTertiary,
  },
  bookLabel: {
    ...typography.bodyEmphasized,
    color: colors.ink,
  },
  bookLabelOff: {
    color: colors.labelTertiary,
  },
});
