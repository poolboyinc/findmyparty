import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import Animated, {
  Easing,
  FadeInDown,
  LinearTransition,
  SlideOutRight,
} from 'react-native-reanimated';
import { Icon } from '@/components/ui/icon';
import { EmptyState } from '@/components/ui/empty-state';
import { useFavorites } from '@/hooks/useFavorites';
import { partyService } from '@/services/partyService';
import { resolveMediaUrl } from '@/constants/api';
import type { PartyDetail } from '@/types/parties';
import { colors, layout, radii, spacing, typography, weights } from '@/theme';

const ROW_IMAGE_HEIGHT = 88;
const ROW_IMAGE_WIDTH = Math.round((ROW_IMAGE_HEIGHT * 16) / 9);
const BACK_SIZE = 44;

function formatStart(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatPrice(price: number): string {
  if (price <= 0) return 'Free';
  return `€${price.toFixed(price % 1 === 0 ? 0 : 2)}`;
}

type FavoriteRowProps = {
  party: PartyDetail;
  index: number;
  onPress: () => void;
  onToggleFavorite: () => void;
};

// Stagger cap: indexes past 8 settle simultaneously so a 30-favorite list
// doesn't take 1.2s+ to finish animating in.
const STAGGER_CAP_INDEX = 8;
const STAGGER_STEP_MS = 40;
const ROW_ENTER_DURATION_MS = 180;
const ROW_EXIT_DURATION_MS = 220;
const ROW_LAYOUT_DURATION_MS = 220;

function FavoriteRow({ party, index, onPress, onToggleFavorite }: FavoriteRowProps) {
  const imageUri = resolveMediaUrl(party.imageUrl);
  const enterDelay = Math.min(index, STAGGER_CAP_INDEX) * STAGGER_STEP_MS;

  return (
    <Animated.View
      entering={FadeInDown.delay(enterDelay)
        .duration(ROW_ENTER_DURATION_MS)
        .easing(Easing.out(Easing.quad))}
      exiting={SlideOutRight.duration(ROW_EXIT_DURATION_MS).easing(Easing.out(Easing.cubic))}
    >
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${party.title}, ${formatStart(party.startsAt)}`}
        style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      >
        <View style={styles.imageWrap}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.image} resizeMode="cover" />
          ) : (
            <LinearGradient
              colors={[colors.brand.deep, colors.brand.magenta]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.image}
            />
          )}
        </View>
        <View style={styles.rowText}>
          <Text style={styles.rowTitle} numberOfLines={1}>
            {party.title}
          </Text>
          <Text style={styles.rowDate} numberOfLines={1}>
            {formatStart(party.startsAt)}
          </Text>
          <Text style={styles.rowPrice} numberOfLines={1}>
            {formatPrice(party.price)}
          </Text>
        </View>
        <Pressable
          onPress={onToggleFavorite}
          hitSlop={layout.hitSlop}
          accessibilityRole="button"
          accessibilityLabel={`Remove ${party.title} from favorites`}
          style={({ pressed }) => [styles.heartBtn, pressed && styles.heartBtnPressed]}
        >
          <Icon sfSymbol="heart.fill" ionicon="heart" size={22} color={colors.pink} />
        </Pressable>
      </Pressable>
    </Animated.View>
  );
}

export default function FavoritesScreen() {
  const { isFavorite, toggle, loaded, ids } = useFavorites();
  const [parties, setParties] = useState<PartyDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // `allSettled` so a single failed fetch (deleted party server-side, transient
  // network error on one of N) doesn't collapse the entire list into an empty
  // state. Fulfilled-null values (party not found) are filtered out separately.
  const fetchParties = useCallback(async (idList: string[]): Promise<PartyDetail[]> => {
    const results = await Promise.allSettled(
      idList.map((id) => partyService.getPartyById(id)),
    );
    return results
      .filter(
        (r): r is PromiseFulfilledResult<PartyDetail | null> => r.status === 'fulfilled',
      )
      .map((r) => r.value)
      .filter((p): p is PartyDetail => p !== null);
  }, []);

  // Refetch on mount and every focus so newly-added favorites from other
  // screens land in the list when the user returns here. `ids` comes directly
  // from useFavorites so it reflects the latest in-memory state and never
  // races against the AsyncStorage write queue.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        if (!loaded) return;
        setLoading(true);
        try {
          const next = await fetchParties(ids);
          if (!cancelled) setParties(next);
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [fetchParties, loaded, ids]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const next = await fetchParties(ids);
      setParties(next);
    } finally {
      setRefreshing(false);
    }
  }, [fetchParties, ids]);

  const handleBack = () => {
    Haptics.selectionAsync();
    router.back();
  };

  const handleRowPress = (id: string) => {
    Haptics.selectionAsync();
    router.push(`/party/${id}`);
  };

  const handleToggle = (id: string) => {
    Haptics.selectionAsync();
    toggle(id);
    // Optimistically drop from the list so the row vanishes immediately.
    setParties((prev) => prev.filter((p) => p.id !== id));
  };

  // Defensive: filter visible rows by current favorite membership so
  // un-favorites from elsewhere clear immediately even before refetch.
  const visible = parties.filter((p) => isFavorite(p.id));

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <View style={styles.header}>
        <Pressable
          onPress={handleBack}
          accessibilityRole="button"
          accessibilityLabel="Back"
          accessibilityHint="Returns to the previous screen"
          hitSlop={layout.hitSlop}
          style={({ pressed }) => [styles.backWrap, pressed && styles.backPressed]}
        >
          <BlurView intensity={40} tint="dark" style={styles.backBlur}>
            <Icon sfSymbol="chevron.left" ionicon="chevron-back" size={22} color={colors.label} />
          </BlurView>
        </Pressable>
        <Text style={styles.headerTitle} accessibilityRole="header" numberOfLines={1}>
          Favorites
        </Text>
        <View style={styles.spacer} />
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.tint} />
        </View>
      ) : visible.length === 0 ? (
        <View style={styles.centered}>
          <EmptyState
            sfSymbol="heart"
            ionicon="heart-outline"
            title="No favorites yet"
            body="Tap the heart on any party to save it here."
          />
        </View>
      ) : (
        <Animated.FlatList
          data={visible}
          keyExtractor={(item) => item.id}
          // `itemLayoutAnimation` makes neighbors flow up smoothly into the
          // gap left by a row that exits (slide-out via row-level `exiting`).
          itemLayoutAnimation={LinearTransition.duration(ROW_LAYOUT_DURATION_MS)}
          renderItem={({ item, index }) => (
            <FavoriteRow
              party={item}
              index={index}
              onPress={() => handleRowPress(item.id)}
              onToggleFavorite={() => handleToggle(item.id)}
            />
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.tint}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  backWrap: {
    width: BACK_SIZE,
    height: BACK_SIZE,
    borderRadius: BACK_SIZE / 2,
    overflow: 'hidden',
    backgroundColor: colors.surfaceElevated,
  },
  backBlur: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.95 }],
  },
  headerTitle: {
    flex: 1,
    ...typography.headline,
    color: colors.label,
    textAlign: 'center',
  },
  spacer: {
    width: BACK_SIZE,
    height: BACK_SIZE,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingHorizontal: layout.screenMargin,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
  },
  separator: {
    height: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.card,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  rowPressed: {
    backgroundColor: colors.surfaceElevated,
  },
  imageWrap: {
    width: ROW_IMAGE_WIDTH,
    height: ROW_IMAGE_HEIGHT,
    borderRadius: radii.md,
    overflow: 'hidden',
    backgroundColor: colors.surfaceElevated,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  rowText: {
    flex: 1,
    gap: spacing.xxs,
  },
  rowTitle: {
    ...typography.bodyEmphasized,
    color: colors.label,
  },
  rowDate: {
    ...typography.subheadline,
    color: colors.labelSecondary,
  },
  rowPrice: {
    ...typography.footnote,
    color: colors.labelTertiary,
    fontWeight: weights.semibold,
  },
  heartBtn: {
    width: layout.minTouchTarget,
    height: layout.minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heartBtnPressed: {
    opacity: 0.6,
  },
});
