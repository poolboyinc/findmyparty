import { useRef, useState } from 'react';
import { Platform, ScrollView, Share, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PressableScale } from '@/components/afterglow/motion';
import { Failed, Loading } from '@/components/afterglow/state';
import { shareText } from '@/components/night/recap';
import { RecapCard, RecapHeader } from '@/components/night/recap-card';
import { Icon } from '@/components/ui/icon';
import { routes } from '@/constants/routes';
import { useNight, useShareNight } from '@/hooks/queries';
import { errorText } from '@/services/errorText';
import type { NightRecap } from '@/types/api';
import { colors, layout, radii, spacing, typography } from '@/theme';

const MAX_CARD_WIDTH = 440;

type Status = { tone: 'ok' | 'problem'; text: string } | null;

/** Captures the card and adds it to Photos. Native modules are loaded on demand so an older build only loses this. */
async function saveCard(card: View): Promise<Status> {
  let uri: string;
  try {
    const { captureRef } = await import('react-native-view-shot');
    uri = await captureRef(card, { format: 'png', quality: 1, result: 'tmpfile' });
  } catch {
    return { tone: 'problem', text: 'The card could not be saved. Try again in a moment.' };
  }
  try {
    const MediaLibrary = await import('expo-media-library');
    const permission = await MediaLibrary.requestPermissionsAsync(true);
    if (!permission.granted) {
      return { tone: 'problem', text: 'To save the card, allow FindMyParty to add photos in Settings.' };
    }
    await MediaLibrary.saveToLibraryAsync(uri);
    return { tone: 'ok', text: 'Saved to your photos.' };
  } catch {
    return { tone: 'problem', text: 'The card could not be saved to your photos.' };
  }
}

/** "Your night" (S-16): the recap card, "Share" (a link to the card's page) and ⌄ (save the card as a picture). */
export default function NightScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { date } = useLocalSearchParams<{ date: string }>();
  const night = useNight(date);
  const share = useShareNight();
  const cardRef = useRef<View>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<Status>(null);

  const cardWidth = Math.min(width - layout.screenMargin * 2, MAX_CARD_WIDTH);

  const close = () => {
    if (router.canGoBack()) router.back();
    else router.replace(routes.pass);
  };

  const onShare = async (recap: NightRecap) => {
    if (share.isPending || !date) return;
    setStatus(null);
    let url = recap.shareUrl;
    if (!url) {
      try {
        url = (await share.mutateAsync(date)).shareUrl;
      } catch (error) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
        setStatus({ tone: 'problem', text: errorText(error) });
        return;
      }
    }
    const text = shareText(recap);
    try {
      await Share.share(Platform.OS === 'ios' ? { message: text, url } : { message: `${text} ${url}` });
    } catch {
      // The share sheet was closed; nothing to say.
    }
  };

  const onSave = async () => {
    if (saving || !cardRef.current) return;
    setSaving(true);
    setStatus(null);
    const result = await saveCard(cardRef.current);
    setSaving(false);
    setStatus(result);
    Haptics.notificationAsync(
      result?.tone === 'ok' ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error,
    ).catch(() => {});
  };

  let body;
  if (night.data) {
    const recap = night.data;
    body = (
      <>
        <RecapCard ref={cardRef} recap={recap} width={cardWidth} />
        <View style={[styles.actions, { width: cardWidth }]}>
          <PressableScale
            onPress={() => void onShare(recap)}
            disabled={share.isPending}
            style={[styles.share, share.isPending && styles.busy]}
            accessibilityRole="button"
            accessibilityLabel="Share"
            accessibilityHint="Makes a link to this card and opens the share sheet"
            accessibilityState={{ busy: share.isPending }}
          >
            <Icon sfSymbol="square.and.arrow.up" ionicon="share-outline" size={18} color={colors.label} />
            <Text style={styles.shareLabel}>Share</Text>
          </PressableScale>
          <PressableScale
            onPress={() => void onSave()}
            disabled={saving}
            style={[styles.save, saving && styles.busy]}
            accessibilityRole="button"
            accessibilityLabel="Save to photos"
            accessibilityState={{ busy: saving }}
          >
            <Icon sfSymbol="chevron.down" ionicon="chevron-down" size={16} color={colors.label} />
          </PressableScale>
        </View>
        {status ? (
          <Text style={[styles.status, status.tone === 'problem' && styles.statusProblem]} accessibilityLiveRegion="polite">
            {status.text}
          </Text>
        ) : null}
      </>
    );
  } else if (night.isPending) {
    body = <Loading />;
  } else {
    body = <Failed error={night.error} onRetry={() => void night.refetch()} />;
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top + spacing.sm }]}>
      <View style={styles.headerWrap}>
        <RecapHeader title="Your night" onClose={close} />
      </View>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}
        showsVerticalScrollIndicator={false}
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
  headerWrap: {
    paddingHorizontal: layout.screenMargin,
  },
  content: {
    flexGrow: 1,
    alignItems: 'center',
    paddingTop: spacing.base,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md - 1,
    marginTop: spacing.lg - 1,
  },
  share: {
    flex: 1,
    height: 55,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radii.button,
    backgroundColor: colors.action,
  },
  shareLabel: {
    ...typography.bodyEmphasized,
    fontWeight: '700',
    color: colors.label,
  },
  save: {
    width: 60,
    height: 55,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.button,
    backgroundColor: colors.surfaceElevated,
  },
  busy: {
    opacity: 0.6,
  },
  status: {
    ...typography.footnote,
    color: colors.labelSecondary,
    textAlign: 'center',
    marginTop: spacing.md,
    paddingHorizontal: layout.screenMargin,
  },
  statusProblem: {
    color: colors.danger,
  },
});
