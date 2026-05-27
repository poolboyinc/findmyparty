import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  StatusBar,
  ActivityIndicator,
  Linking,
  Alert,
  Platform,
  Modal,
  Share,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { router, useLocalSearchParams } from 'expo-router';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import {
  BottomSheetModal,
  BottomSheetBackdrop,
  BottomSheetView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { partyService } from '@/services/partyService';
import { ApiConstants, resolveMediaUrl } from '@/constants/api';
import { bookingService } from '@/services/bookingService';
import { useFavorites } from '@/hooks/useFavorites';
import { Icon } from '@/components/ui/icon';
import { PrimaryButton } from '@/components/ui/primary-button';
import { colors, radii, spacing, typography, weights, layout } from '@/theme';
import type { PartyDetail } from '@/types/parties';
import { ms } from '@/constants/responsive';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function priceTier(price: number): string {
  if (price === 0) return 'Free';
  if (price <= 10) return '€';
  if (price <= 25) return '€€';
  return '€€€';
}

// Fixed-width leading-icon column so info-row labels left-align cleanly.
const ICON_COL = 28;
// Static-map snapshot dimensions (px requested at @2x; rendered ~150pt tall).
const MAP_SNAPSHOT_HEIGHT = 150;
const MAP_SNAPSHOT_WIDTH = 600;

// ─── Liquid Glass button ───────────────────────────────────────────────────────
function GlassButton({
  size = ms(48),
  tint = 'dark',
  children,
  onPress,
  style,
  accessibilityLabel,
}: {
  size?: number;
  tint?: 'dark' | 'light';
  children: React.ReactNode;
  onPress?: () => void;
  style?: object;
  accessibilityLabel?: string;
}) {
  return (
    <TouchableOpacity
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: colors.hairline,
        },
        style,
      ]}
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <BlurView
        intensity={Platform.OS === 'ios' ? 60 : 80}
        tint={tint}
        style={StyleSheet.absoluteFill}
      />
      <View style={[StyleSheet.absoluteFill, styles.glassOverlay]} />
      <View style={styles.glassInner}>{children}</View>
    </TouchableOpacity>
  );
}

// ─── Info row ─────────────────────────────────────────────────────────────────
function InfoRow({
  sfSymbol,
  ionicon,
  children,
  iconColor = colors.label,
}: {
  sfSymbol: Parameters<typeof Icon>[0]['sfSymbol'];
  ionicon: Parameters<typeof Icon>[0]['ionicon'];
  children: React.ReactNode;
  iconColor?: string;
}) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIconCol}>
        <Icon sfSymbol={sfSymbol} ionicon={ionicon} size={22} color={iconColor} />
      </View>
      <View style={styles.infoBody}>{children}</View>
    </View>
  );
}

// ─── Divider ──────────────────────────────────────────────────────────────────
function Divider() {
  return <View style={styles.divider} />;
}

// ─── Main Screen ─────────────────────────────────────────────────────────────
export default function PartyDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { height: H } = useWindowDimensions();
  const HERO_HEIGHT = H * 0.42; // 354/844
  const [party, setParty] = useState<PartyDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [ticketCount, setTicketCount] = useState(1);
  const [imagePreviewVisible, setImagePreviewVisible] = useState(false);
  const [locationLabel, setLocationLabel] = useState<string | null>(null);
  const { isFavorite, toggle: toggleFavorite } = useFavorites();

  const ticketSheetRef = useRef<BottomSheetModal>(null);

  // iOS bounce + scroll position captured for the (scaffolded) hero parallax.
  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollY.value = e.contentOffset.y;
    },
  });
  const heroAnimatedStyle = useAnimatedStyle(() => {
    // Parallax: as content scrolls up, the hero drifts up at half-rate so it
    // trails the content (classic iOS detail-header feel). Clamped so it never
    // moves on overscroll (that's the stretch's job).
    const parallax = interpolate(
      scrollY.value,
      [0, HERO_HEIGHT],
      [0, HERO_HEIGHT * 0.5],
      Extrapolation.CLAMP,
    );
    // Stretch: on overscroll (negative scrollY) the hero scales up. Pairing it
    // with a top-anchored upward translate (half the added height) makes the
    // image grow DOWNWARD from the top edge instead of from its center — so it
    // fills the gap the bounce opens, no seam at the top.
    const scale = interpolate(
      scrollY.value,
      [-HERO_HEIGHT, 0],
      [1.6, 1],
      Extrapolation.CLAMP,
    );
    return {
      transform: [
        { translateY: scrollY.value < 0 ? -scrollY.value * 0.5 : parallax },
        { scale },
      ],
    };
  });

  useEffect(() => {
    if (!id) return;
    partyService.getPartyById(id).then((data) => {
      setParty(data);
      setLoading(false);
    });
  }, [id]);

  // Reverse-geocode the coordinates into a human label ("District, City").
  // Never surface raw coordinates — null out on failure.
  useEffect(() => {
    if (!party) return;
    let cancelled = false;
    (async () => {
      try {
        const results = await Location.reverseGeocodeAsync({
          latitude: party.latitude,
          longitude: party.longitude,
        });
        if (cancelled) return;
        const first = results[0];
        if (!first) {
          setLocationLabel(null);
          return;
        }
        const area = first.district ?? first.subregion ?? null;
        const city = first.city ?? first.region ?? null;
        const label = [area, city].filter(Boolean).join(', ');
        setLocationLabel(label.length > 0 ? label : null);
      } catch {
        if (!cancelled) setLocationLabel(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [party?.latitude, party?.longitude]);

  if (loading) {
    return (
      <View style={styles.loadingRoot}>
        <ActivityIndicator size="large" color={colors.tint} />
      </View>
    );
  }

  if (!party) {
    return (
      <View style={styles.loadingRoot}>
        <Text style={styles.errorText}>Party not found</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backFallback}>
          <Text style={styles.backFallbackText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const mapsUrl = `https://maps.google.com/?q=${party.latitude},${party.longitude}`;
  const hasToken = !!ApiConstants.MapboxPublicToken;
  const staticMapUrl = hasToken
    ? `https://api.mapbox.com/styles/v1/mapbox/dark-v11/static/pin-s+8B5CF6(${party.longitude},${party.latitude})/${party.longitude},${party.latitude},14,0/${MAP_SNAPSHOT_WIDTH}x${MAP_SNAPSHOT_HEIGHT}@2x?access_token=${ApiConstants.MapboxPublicToken}`
    : null;

  const remainingCapacity = party.capacity - (party.ticketsSold ?? 0);
  const maxTickets = Math.min(remainingCapacity, 10);
  const ctaLabel = party.isSoldOut
    ? 'Sold Out'
    : party.price > 0
      ? 'Get Tickets'
      : 'Reserve a Spot';

  const handleReserve = () => {
    if (party.isSoldOut || booking) return;
    setTicketCount(1);
    ticketSheetRef.current?.present();
  };

  const handleHeartPress = () => {
    if (!party) return;
    Haptics.selectionAsync();
    toggleFavorite(party.id);
  };

  const handleShare = async () => {
    if (!party) return;
    Haptics.selectionAsync();
    try {
      await Share.share({
        title: party.title,
        message: `Check out ${party.title} on FindMyParty — https://findmyparty.app/p/${party.id}`,
      });
    } catch {
      // User dismissed or share failed — no-op.
    }
  };

  const handleConfirmBooking = async () => {
    ticketSheetRef.current?.dismiss();
    setBooking(true);
    try {
      const bookingId = await bookingService.createBooking(party.id, ticketCount);
      if (bookingId) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(
          'You\'re in!',
          `${ticketCount} ticket${ticketCount > 1 ? 's' : ''} reserved. Check your bookings for details.`,
        );
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert('Could not reserve', 'Something went wrong. Please try again.');
      }
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setBooking(false);
    }
  };

  const renderBackdrop = (props: BottomSheetBackdropProps) => (
    <BottomSheetBackdrop
      {...props}
      appearsOnIndex={0}
      disappearsOnIndex={-1}
      opacity={0.5}
      pressBehavior="close"
    />
  );

  // Floating CTA bar height — content gets a matching bottom spacer so the bar
  // never occludes the description.
  const ctaBarHeight = layout.buttonHeight + spacing.base * 2 + insets.bottom;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        bounces
      >
        {/* ── Hero ── */}
        <Animated.View style={heroAnimatedStyle}>
          <TouchableOpacity
            style={[styles.heroWrapper, { height: HERO_HEIGHT }]}
            activeOpacity={0.9}
            onPress={resolveMediaUrl(party.imageUrl) ? () => setImagePreviewVisible(true) : undefined}
          >
            {resolveMediaUrl(party.imageUrl) ? (
              <Image
                source={{ uri: resolveMediaUrl(party.imageUrl)! }}
                style={[styles.heroImage, { height: HERO_HEIGHT }]}
                resizeMode="cover"
              />
            ) : (
              <LinearGradient
                colors={['#1a0030', '#3D0880', '#7D08FA']}
                style={[styles.heroImage, { height: HERO_HEIGHT }]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              />
            )}

            {/* Gradient fade to the screen background — final stop matches
                colors.bg so there's no seam where the hero meets content. */}
            <LinearGradient
              colors={['transparent', 'rgba(10,10,12,0.55)', colors.bg]}
              style={styles.heroFade}
              pointerEvents="none"
            />

            {/* Back button — liquid glass */}
            <GlassButton
              size={44}
              style={{ position: 'absolute', left: spacing.base, top: insets.top + spacing.md }}
              onPress={() => router.back()}
              accessibilityLabel="Back"
            >
              <Ionicons name="chevron-back" size={ms(22)} color={colors.label} />
            </GlassButton>

            {/* Heart + Share — liquid glass */}
            <View style={[styles.actionRow, { top: insets.top + spacing.md }]}>
              <GlassButton
                size={48}
                onPress={handleHeartPress}
                accessibilityLabel={isFavorite(party.id) ? 'Remove from favorites' : 'Add to favorites'}
              >
                <Ionicons
                  name={isFavorite(party.id) ? 'heart' : 'heart-outline'}
                  size={ms(22)}
                  color={isFavorite(party.id) ? colors.pink : colors.label}
                />
              </GlassButton>
              <GlassButton size={48} onPress={handleShare} accessibilityLabel="Share party">
                <Ionicons name="share-outline" size={ms(22)} color={colors.label} />
              </GlassButton>
            </View>

            {/* Club name + price tier */}
            <View style={styles.heroOverlay} pointerEvents="none">
              <Text style={styles.clubName}>{party.title}</Text>
              <LinearGradient
                colors={[colors.brand.deep, colors.brand.orange]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.priceBadge}
              >
                <Text style={styles.priceBadgeText}>
                  {party.isSoldOut ? 'Sold Out' : priceTier(party.price)}
                </Text>
              </LinearGradient>
            </View>
          </TouchableOpacity>
        </Animated.View>

        {/* ── Info card ── */}
        <View style={styles.infoCard}>
          {/* Date & time */}
          <InfoRow sfSymbol="calendar" ionicon="calendar-outline">
            <Text style={styles.infoText}>{formatDate(party.startsAt)}</Text>
            <Text style={styles.infoTextStrong}>
              {formatTime(party.startsAt)}–{formatTime(party.endsAt)}
            </Text>
          </InfoRow>

          <Divider />

          {/* Location — static map snapshot + reverse-geocoded label */}
          <InfoRow sfSymbol="mappin.and.ellipse" ionicon="location-outline">
            {locationLabel ? (
              <Text style={styles.infoText} numberOfLines={2}>
                {locationLabel}
              </Text>
            ) : null}
            <TouchableOpacity onPress={() => Linking.openURL(mapsUrl)}>
              <Text style={styles.openMaps}>Open in Maps</Text>
            </TouchableOpacity>
          </InfoRow>

          <TouchableOpacity
            style={styles.mapSnapshot}
            activeOpacity={0.9}
            onPress={() => Linking.openURL(mapsUrl)}
            accessibilityRole="button"
            accessibilityLabel="Open location in Maps"
          >
            {staticMapUrl ? (
              <Image
                source={{ uri: staticMapUrl }}
                style={StyleSheet.absoluteFill}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.mapPlaceholder}>
                <Icon
                  sfSymbol="map"
                  ionicon="map-outline"
                  size={28}
                  color={colors.labelTertiary}
                />
              </View>
            )}
          </TouchableOpacity>

          <Divider />

          {/* Price — one concise line */}
          <InfoRow sfSymbol="eurosign.circle" ionicon="cash-outline" iconColor={colors.labelSecondary}>
            <Text style={styles.infoText}>
              {party.price > 0 ? `Entrance €${party.price.toFixed(0)}` : 'Free entrance'}
            </Text>
          </InfoRow>
        </View>

        {/* Description */}
        {!!party.description && (
          <View style={styles.descBlock}>
            <Text style={styles.descText}>{party.description}</Text>
          </View>
        )}

        {/* Bottom spacer — equals the floating CTA bar height so content isn't occluded. */}
        <View style={{ height: ctaBarHeight + spacing.lg }} />
      </Animated.ScrollView>

      {/* ── Pinned CTA bar ── */}
      <View style={[styles.ctaBar, { paddingBottom: insets.bottom + spacing.base }]}>
        <BlurView
          intensity={Platform.OS === 'ios' ? 40 : 70}
          tint="dark"
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.ctaBarInner}>
          <PrimaryButton
            label={ctaLabel}
            variant="gradient"
            onPress={handleReserve}
            loading={booking}
            disabled={party.isSoldOut}
            accessibilityHint="Reserve tickets for this party"
          />
        </View>
      </View>

      {/* ── Ticket picker sheet ── */}
      <BottomSheetModal
        ref={ticketSheetRef}
        enableDynamicSizing
        backdropComponent={renderBackdrop}
        handleIndicatorStyle={styles.sheetHandle}
        backgroundStyle={styles.sheetBackground}
      >
        <BottomSheetView style={[styles.sheetContent, { paddingBottom: insets.bottom + spacing.lg }]}>
          <Text style={styles.sheetTitle} accessibilityRole="header">
            How many tickets?
          </Text>

          <View style={styles.stepperRow}>
            <TouchableOpacity
              style={styles.stepperBtn}
              onPress={() => {
                // Haptic only on a real change — silence at the lower bound (1)
                // signals the wall to the user without a misleading buzz.
                setTicketCount((c) => {
                  if (c <= 1) return c;
                  Haptics.selectionAsync();
                  return c - 1;
                });
              }}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Decrease ticket count"
            >
              <Ionicons name="remove" size={ms(24)} color={colors.label} />
            </TouchableOpacity>

            <Text style={styles.stepperValue}>{ticketCount}</Text>

            <TouchableOpacity
              style={styles.stepperBtn}
              onPress={() => {
                // Haptic only on a real change — silence at the upper bound
                // (maxTickets) is the deliberate "wall" cue, matching decrement.
                setTicketCount((c) => {
                  if (c >= maxTickets) return c;
                  Haptics.selectionAsync();
                  return c + 1;
                });
              }}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Increase ticket count"
            >
              <Ionicons name="add" size={ms(24)} color={colors.label} />
            </TouchableOpacity>
          </View>

          <Text style={styles.sheetTotal}>
            Total: €{(ticketCount * party.price).toFixed(2)}
          </Text>

          <View style={styles.sheetCta}>
            <PrimaryButton
              label="Confirm"
              variant="gradient"
              onPress={handleConfirmBooking}
              accessibilityHint="Confirm and reserve your tickets"
            />
          </View>
        </BottomSheetView>
      </BottomSheetModal>

      {/* ── Fullscreen image preview ── */}
      <Modal
        visible={imagePreviewVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setImagePreviewVisible(false)}
      >
        <TouchableOpacity
          style={styles.imagePreviewBackdrop}
          activeOpacity={1}
          onPress={() => setImagePreviewVisible(false)}
        >
          <BlurView intensity={Platform.OS === 'ios' ? 80 : 100} tint="dark" style={StyleSheet.absoluteFill} />
          {resolveMediaUrl(party.imageUrl) && (
            <Image
              source={{ uri: resolveMediaUrl(party.imageUrl)! }}
              style={styles.imagePreviewImage}
              resizeMode="contain"
            />
          )}
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  loadingRoot: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.base,
  },
  errorText: {
    ...typography.body,
    color: colors.label,
  },
  backFallback: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    backgroundColor: colors.tint,
    borderRadius: radii.pill,
  },
  backFallbackText: {
    ...typography.bodyEmphasized,
    color: colors.label,
  },

  // ── Glass button ──
  glassOverlay: {
    backgroundColor: colors.fillTertiary,
  },
  glassInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Hero ──
  heroWrapper: {
    // height applied inline from useWindowDimensions
    overflow: 'hidden',
  },
  heroImage: {
    width: '100%',
    // height applied inline from useWindowDimensions
  },
  heroFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '45%', // relative to heroWrapper height
  },
  actionRow: {
    position: 'absolute',
    right: spacing.base,
    flexDirection: 'row',
    gap: spacing.sm,
  },
  heroOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: spacing.xxl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  clubName: {
    ...typography.largeTitle,
    fontWeight: weights.heavy,
    color: colors.label,
    textAlign: 'center',
    textShadowColor: colors.scrim,
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
    paddingHorizontal: spacing.base,
  },
  priceBadge: {
    height: 28,
    paddingHorizontal: spacing.base,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  priceBadgeText: {
    ...typography.subheadline,
    fontWeight: weights.bold,
    color: colors.label,
  },

  // ── Info card ──
  infoCard: {
    marginHorizontal: spacing.md,
    marginTop: spacing.base,
    borderRadius: radii.card,
    overflow: 'hidden',
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.hairline,
    paddingVertical: spacing.xs,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.base,
    paddingHorizontal: spacing.base,
    gap: spacing.md,
  },
  infoIconCol: {
    width: ICON_COL,
    alignItems: 'center',
  },
  infoBody: {
    flex: 1,
    gap: spacing.xxs,
  },
  infoText: {
    ...typography.body,
    color: colors.label,
  },
  infoTextStrong: {
    ...typography.bodyEmphasized,
    color: colors.label,
  },
  openMaps: {
    ...typography.footnote,
    color: colors.tint,
    fontWeight: weights.semibold,
  },
  mapSnapshot: {
    height: MAP_SNAPSHOT_HEIGHT,
    marginHorizontal: spacing.base,
    marginBottom: spacing.sm,
    borderRadius: radii.card,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  mapPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.separator,
    marginHorizontal: spacing.base,
  },

  // ── Description ──
  descBlock: {
    marginHorizontal: spacing.base,
    marginTop: spacing.base,
  },
  descText: {
    ...typography.subheadline,
    color: colors.labelSecondary,
    lineHeight: 22,
  },

  // ── Pinned CTA bar ──
  ctaBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: spacing.base,
    paddingHorizontal: spacing.base,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
    overflow: 'hidden',
  },
  ctaBarInner: {
    // PrimaryButton fills the width.
  },

  // ── Ticket sheet ──
  sheetBackground: {
    backgroundColor: colors.surfaceElevated,
    borderTopLeftRadius: radii.xxl,
    borderTopRightRadius: radii.xxl,
  },
  sheetHandle: {
    backgroundColor: colors.labelTertiary,
    width: layout.sheetHandleWidth,
  },
  sheetContent: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    gap: spacing.lg,
    alignItems: 'center',
  },
  sheetTitle: {
    ...typography.title2,
    fontWeight: weights.bold,
    color: colors.label,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xl,
  },
  stepperBtn: {
    width: 48,
    height: 48,
    borderRadius: radii.pill,
    backgroundColor: colors.brand.tintBg,
    borderWidth: 1,
    borderColor: colors.tint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValue: {
    ...typography.largeTitle,
    fontWeight: weights.heavy,
    color: colors.label,
    minWidth: 50,
    textAlign: 'center',
  },
  sheetTotal: {
    ...typography.callout,
    fontWeight: weights.semibold,
    color: colors.labelSecondary,
  },
  sheetCta: {
    width: '100%',
  },

  // ── Fullscreen image preview ──
  imagePreviewBackdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imagePreviewImage: {
    width: '92%',
    height: '60%',
    borderRadius: radii.card,
  },
});
