import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Failed, Loading } from '@/components/afterglow/state';
import { ownerLine } from '@/components/night/recap';
import { RecapCard, RecapHeader } from '@/components/night/recap-card';
import { PrimaryButton } from '@/components/ui/primary-button';
import { usePublicRecap } from '@/hooks/queries';
import { colors, layout, spacing } from '@/theme';

const MAX_CARD_WIDTH = 440;

/**
 * Someone's shared night (`/r/{token}` → `recap/{token}`). Works signed out: the card as they shared
 * it, and the way into the app.
 */
export default function SharedRecapScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { token } = useLocalSearchParams<{ token: string }>();
  const recap = usePublicRecap(token);
  const cardWidth = Math.min(width - layout.screenMargin * 2, MAX_CARD_WIDTH);

  const close = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)');
  };

  const title = recap.data ? `${ownerLine(recap.data.handle, null)}'s night` : 'A night out';

  let body;
  if (recap.data) {
    body = (
      <>
        <RecapCard recap={recap.data} width={cardWidth} />
        <View style={[styles.button, { width: cardWidth }]}>
          <PrimaryButton
            label="See what is on tonight"
            onPress={() => router.replace('/(tabs)')}
            accessibilityHint="Opens the city map"
          />
        </View>
      </>
    );
  } else if (recap.isPending) {
    body = <Loading />;
  } else {
    body = <Failed error={recap.error} onRetry={() => void recap.refetch()} />;
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top + spacing.sm }]}>
      <View style={styles.headerWrap}>
        <RecapHeader title={title} onClose={close} />
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
  button: {
    marginTop: spacing.lg - 1,
  },
});
