import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Platform,
  Pressable,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetModal,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import DateTimePicker from '@react-native-community/datetimepicker';
import MapboxGL from '@rnmapbox/maps';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { ApiConstants } from '@/constants/api';
import { s, vs, ms } from '@/constants/responsive';
import { colors, layout, radii, spacing, typography, weights } from '@/theme';
import { EmptyState } from '@/components/ui/empty-state';
import { Icon } from '@/components/ui/icon';
import {
  PartyPeekSheet,
  PARTY_PEEK_HEIGHT,
  type PartyPeekSheetRef,
} from '@/components/ui/party-peek-sheet';
import { useExplore } from '@/hooks/useExplore';
import { useFavorites } from '@/hooks/useFavorites';
import type { PartyMapItem } from '@/types/parties';

// Set Mapbox access token once (only if present — missing token redirects to onboarding at runtime)
if (ApiConstants.MapboxPublicToken) {
  MapboxGL.setAccessToken(ApiConstants.MapboxPublicToken);
}

// ─── Party Marker ─────────────────────────────────────────────────────────────
const PartyMarker = React.memo(function PartyMarker({
  party,
  onPress,
  isActive,
}: {
  party: PartyMapItem;
  onPress: () => void;
  isActive: boolean;
}) {
  return (
    <MapboxGL.MarkerView
      key={party.id}
      coordinate={[party.longitude, party.latitude]}
      anchor={{ x: 0.5, y: 1 }}
    >
      <TouchableOpacity onPress={onPress} activeOpacity={0.85}>
        <View style={[markerStyles.container, isActive && markerStyles.containerActive]}>
          <View style={markerStyles.pinBody}>
            <LinearGradient
              colors={['#9B20FF', '#6500D2']}
              style={markerStyles.gradient}
            >
              <Ionicons name="flame" size={ms(18)} color="#FFF" />
            </LinearGradient>
          </View>
          <View style={[markerStyles.pinTip, isActive && markerStyles.pinTipActive]} />
        </View>
      </TouchableOpacity>
    </MapboxGL.MarkerView>
  );
});

const markerStyles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  containerActive: {
    transform: [{ scale: 1.15 }],
  },
  pinBody: {
    width: s(44),
    height: s(44),
    borderRadius: s(22),
    overflow: 'hidden',
    borderWidth: 2.5,
    borderColor: '#FFF',
    shadowColor: '#7D08FA',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 8,
  },
  gradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinTip: {
    width: 0,
    height: 0,
    borderLeftWidth: s(7),
    borderRightWidth: s(7),
    borderTopWidth: s(12),
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#6500D2',
    marginTop: -1,
  },
  pinTipActive: {
    borderTopColor: '#9B20FF',
  },
});

// ─── Date Picker Modal ────────────────────────────────────────────────────────
function DatePickerModal({
  visible,
  onClose,
  selectedDate,
  onDateChange,
}: {
  visible: boolean;
  onClose: () => void;
  selectedDate: Date | null;
  onDateChange: (date: Date | null) => void;
}) {
  const [tempDate, setTempDate] = useState(selectedDate ?? new Date());

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={dpStyles.overlay}>
        <View style={dpStyles.card}>
          <View style={dpStyles.header}>
            <Text style={dpStyles.title}>Select Date</Text>
            <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
              <Ionicons name="close" size={ms(22)} color="rgba(255,255,255,0.7)" />
            </TouchableOpacity>
          </View>

          <DateTimePicker
            value={tempDate}
            mode="date"
            display={Platform.OS === 'ios' ? 'inline' : 'default'}
            minimumDate={new Date()}
            onChange={(_event, date) => {
              if (date) setTempDate(date);
            }}
            themeVariant="dark"
            accentColor="#7D08FA"
            style={dpStyles.picker}
          />

          <View style={dpStyles.actions}>
            <TouchableOpacity
              style={dpStyles.clearBtn}
              onPress={() => {
                onDateChange(null);
                onClose();
              }}
              activeOpacity={0.8}
            >
              <Text style={dpStyles.clearText}>Clear</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={dpStyles.confirmBtn}
              onPress={() => {
                onDateChange(tempDate);
                onClose();
              }}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={['#9B20FF', '#6500D2']}
                style={dpStyles.confirmGradient}
              >
                <Text style={dpStyles.confirmText}>Confirm</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const dpStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  card: {
    backgroundColor: '#1A1620',
    borderTopLeftRadius: s(28),
    borderTopRightRadius: s(28),
    paddingTop: vs(20),
    paddingBottom: vs(40),
    paddingHorizontal: s(24),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: vs(16),
  },
  title: {
    color: '#FFF',
    fontSize: ms(18),
    fontWeight: '700',
  },
  picker: {
    backgroundColor: 'transparent',
    alignSelf: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: s(12),
    marginTop: vs(20),
  },
  clearBtn: {
    flex: 1,
    height: vs(50),
    borderRadius: s(30),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: ms(16),
    fontWeight: '600',
  },
  confirmBtn: {
    flex: 2,
    height: vs(50),
    borderRadius: s(30),
    overflow: 'hidden',
  },
  confirmGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmText: {
    color: '#FFF',
    fontSize: ms(16),
    fontWeight: '700',
  },
});

// ─── Travel Mode Sheet ───────────────────────────────────────────────────────
//
// Bottom sheet that asks how the user wants to get to the selected party.
// Replaces the legacy `LinearGradient` center-screen modal — same shape as
// the `ConfirmCancelSheet` in `app/my-bookings.tsx`, just with two large
// option tiles instead of stacked buttons.

type TravelModeSheetRef = {
  present: () => void;
  dismiss: () => void;
};

type TravelModeSheetProps = {
  /**
   * The party the user is asking directions to. Shown in the subtitle so the
   * user has context. May be null between dismissal and re-present; the sheet
   * gracefully falls back to a generic subtitle.
   */
  target: PartyMapItem | null;
  onSelect: (mode: 'driving' | 'walking') => void;
  onDismiss: () => void;
};

const TravelModeSheet = forwardRef<TravelModeSheetRef, TravelModeSheetProps>(
  function TravelModeSheet({ target, onSelect, onDismiss }, ref) {
    const sheetRef = useRef<BottomSheetModal>(null);
    const snapPoints = useMemo(() => ['34%'], []);

    useImperativeHandle(
      ref,
      () => ({
        present: () => sheetRef.current?.present(),
        dismiss: () => sheetRef.current?.dismiss(),
      }),
      [],
    );

    const renderBackdrop = useCallback(
      (props: BottomSheetBackdropProps) => (
        <BottomSheetBackdrop
          {...props}
          appearsOnIndex={0}
          disappearsOnIndex={-1}
          opacity={0.5}
          pressBehavior="close"
        />
      ),
      [],
    );

    const handlePick = (mode: 'driving' | 'walking') => {
      Haptics.selectionAsync();
      onSelect(mode);
      sheetRef.current?.dismiss();
    };

    return (
      <BottomSheetModal
        ref={sheetRef}
        snapPoints={snapPoints}
        enablePanDownToClose
        onDismiss={onDismiss}
        backdropComponent={renderBackdrop}
        handleIndicatorStyle={modeStyles.handle}
        backgroundStyle={modeStyles.background}
      >
        <BottomSheetView style={modeStyles.content}>
          <Text style={modeStyles.title} accessibilityRole="header">
            Get directions
          </Text>
          <Text style={modeStyles.body}>
            {target ? `How are you getting to ${target.title}?` : 'How are you getting there?'}
          </Text>
          <View style={modeStyles.options}>
            <Pressable
              onPress={() => handlePick('driving')}
              accessibilityRole="button"
              accessibilityLabel="Driving"
              accessibilityHint="Show driving directions"
              style={({ pressed }) => [modeStyles.option, pressed && modeStyles.optionPressed]}
            >
              <View style={modeStyles.iconBubble}>
                <Icon sfSymbol="car.fill" ionicon="car" size={24} color={colors.tint} />
              </View>
              <Text style={modeStyles.optionLabel}>Driving</Text>
            </Pressable>
            <Pressable
              onPress={() => handlePick('walking')}
              accessibilityRole="button"
              accessibilityLabel="Walking"
              accessibilityHint="Show walking directions"
              style={({ pressed }) => [modeStyles.option, pressed && modeStyles.optionPressed]}
            >
              <View style={modeStyles.iconBubble}>
                <Icon sfSymbol="figure.walk" ionicon="walk" size={24} color={colors.tint} />
              </View>
              <Text style={modeStyles.optionLabel}>Walking</Text>
            </Pressable>
          </View>
        </BottomSheetView>
      </BottomSheetModal>
    );
  },
);

const modeStyles = StyleSheet.create({
  background: {
    backgroundColor: colors.surfaceElevated,
    borderTopLeftRadius: radii.xxl,
    borderTopRightRadius: radii.xxl,
  },
  handle: {
    backgroundColor: colors.labelTertiary,
    width: layout.sheetHandleWidth,
  },
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  title: {
    ...typography.title3,
    fontWeight: weights.bold,
    color: colors.label,
    textAlign: 'center',
  },
  body: {
    ...typography.callout,
    color: colors.labelSecondary,
    textAlign: 'center',
  },
  options: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  option: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
  },
  optionPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  iconBubble: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.brand.tintBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionLabel: {
    ...typography.bodyEmphasized,
    color: colors.label,
  },
});

// ─── Route line type ─────────────────────────────────────────────────────────
type RouteGeoJSON = {
  type: 'FeatureCollection';
  features: Array<{
    type: 'Feature';
    properties: Record<string, unknown>;
    geometry: { type: 'LineString'; coordinates: number[][] };
  }>;
};

// ─── Main Screen ─────────────────────────────────────────────────────────────
export default function ExploreScreen() {
  const insets = useSafeAreaInsets();
  const { parties, loadParties } = useExplore();
  const { isFavorite, toggle: toggleFavorite } = useFavorites();
  // Lifts floating controls clear of the new GlassTabBar floating pill.
  const tabBarClearance =
    insets.bottom +
    layout.floatingTabBarHeight +
    layout.floatingTabBarBottomOffset +
    spacing.base;
  const [selectedParty, setSelectedParty] = useState<PartyMapItem | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [userCoords, setUserCoords] = useState<[number, number] | null>(null);
  const [locationDenied, setLocationDenied] = useState(false);
  const cameraRef = useRef<MapboxGL.Camera>(null);
  const peekSheetRef = useRef<PartyPeekSheetRef>(null);
  const modeSheetRef = useRef<TravelModeSheetRef>(null);

  // Navigation / routing state.
  //
  // `directionsTarget` captures the party at the moment the user taps the
  // peek's Directions button. We need this because tapping Directions now
  // dismisses the peek sheet (whose `onDismiss` clears `selectedParty`),
  // so by the time the mode sheet's `onSelect` fires `selectedParty` is
  // already null. Hold the target on a separate slot so the two sheets can
  // overlap their animations without state collisions.
  const [directionsTarget, setDirectionsTarget] = useState<PartyMapItem | null>(null);
  const [travelMode, setTravelMode] = useState<'driving' | 'walking'>('driving');
  const [routeGeoJSON, setRouteGeoJSON] = useState<RouteGeoJSON | null>(null);
  const [navigating, setNavigating] = useState(false);
  const [navigationTarget, setNavigationTarget] = useState<PartyMapItem | null>(null);

  // Fetch route from Mapbox Directions API
  const fetchRoute = useCallback(async (mode: 'driving' | 'walking', destination: PartyMapItem) => {
    if (!userCoords || !ApiConstants.MapboxPublicToken) return;
    try {
      const url = `https://api.mapbox.com/directions/v5/mapbox/${mode}/${userCoords[0]},${userCoords[1]};${destination.longitude},${destination.latitude}?geometries=geojson&overview=full&access_token=${ApiConstants.MapboxPublicToken}`;
      const res = await fetch(url);
      const json = await res.json();
      if (json.routes?.[0]?.geometry) {
        const geoJSON: RouteGeoJSON = {
          type: 'FeatureCollection',
          features: [{
            type: 'Feature',
            properties: {},
            geometry: json.routes[0].geometry,
          }],
        };
        setRouteGeoJSON(geoJSON);
        setTravelMode(mode);
        setNavigating(true);
        setNavigationTarget(destination);
        setSelectedParty(null);
      }
    } catch (e) {
      console.warn('Failed to fetch route:', e);
    }
  }, [userCoords]);

  // Start directions from party card. Capture the target FIRST, then dismiss
  // the peek sheet (which fires `onDismiss` → `setSelectedParty(null)`), then
  // present the travel-mode sheet. Sequencing matters: the peek sheet's
  // animation begins before the mode sheet's, so the two slide past each
  // other rather than overlapping.
  const handleDirections = useCallback(() => {
    if (!userCoords || !selectedParty) return;
    Haptics.selectionAsync();
    setDirectionsTarget(selectedParty);
    peekSheetRef.current?.dismiss();
    modeSheetRef.current?.present();
  }, [userCoords, selectedParty]);

  // Mode picked in the bottom sheet — fetch and draw the route. Uses the
  // captured `directionsTarget` rather than `selectedParty` (which the peek
  // dismissal has already cleared).
  const handleModeSelect = useCallback((mode: 'driving' | 'walking') => {
    if (directionsTarget) {
      fetchRoute(mode, directionsTarget);
    }
  }, [directionsTarget, fetchRoute]);

  // Cancel navigation
  const handleCancelNavigation = useCallback(() => {
    setNavigating(false);
    setRouteGeoJSON(null);
    setNavigationTarget(null);
    // Restore default zoom
    if (userCoords) {
      cameraRef.current?.setCamera({
        centerCoordinate: userCoords,
        zoomLevel: 13.5,
        animationDuration: 800,
      });
    }
  }, [userCoords]);

  // If the Mapbox token isn't configured we render an inline placeholder in
  // place of the map. The other tabs keep working, and the user can navigate
  // to /parties via the placeholder's action — no auth-style redirect.
  const hasMap = !!ApiConstants.MapboxPublicToken;

  // Request location permission, fly to user, and load nearby parties
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationDenied(true);
        loadParties();
        return;
      }

      // Use cached location for instant first load
      const last = await Location.getLastKnownPositionAsync();
      if (last) {
        const coords: [number, number] = [last.coords.longitude, last.coords.latitude];
        setUserCoords(coords);
        cameraRef.current?.flyTo(coords, 800);
        loadParties(last.coords.latitude, last.coords.longitude);
      }

      // Get accurate fix in background — only refetch if moved >~500m
      const accurate = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const newCoords: [number, number] = [accurate.coords.longitude, accurate.coords.latitude];

      if (!last) {
        setUserCoords(newCoords);
        cameraRef.current?.flyTo(newCoords, 800);
        loadParties(accurate.coords.latitude, accurate.coords.longitude);
      } else {
        const dist = Math.hypot(
          newCoords[0] - last.coords.longitude,
          newCoords[1] - last.coords.latitude,
        );
        if (dist > 0.005) {
          setUserCoords(newCoords);
          loadParties(accurate.coords.latitude, accurate.coords.longitude);
        }
      }
    })();
  }, []);

  const handleMarkerPress = useCallback((party: PartyMapItem) => {
    setSelectedParty(party);
    peekSheetRef.current?.present();
    // Center on the TRUE pin coordinate and let Mapbox do the screen-space math:
    // padding the bottom by the peek-sheet footprint (+ safe area + a cushion)
    // shrinks the effective viewport so the pin lands centered in the visible
    // strip above the sheet — no fragile lat/zoom magic numbers. easeTo at ~450ms
    // glides the camera in sync with the sheet's present animation.
    cameraRef.current?.setCamera({
      centerCoordinate: [party.longitude, party.latitude],
      padding: {
        paddingBottom: PARTY_PEEK_HEIGHT + insets.bottom + 24,
        paddingTop: 0,
        paddingLeft: 0,
        paddingRight: 0,
      },
      animationMode: 'easeTo',
      animationDuration: 450,
    });
  }, [insets.bottom]);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* ── Map (or placeholder when Mapbox is not configured) ── */}
      {hasMap ? (
        <MapboxGL.MapView
          style={styles.map}
          styleURL="mapbox://styles/mapbox/dark-v11"
          logoEnabled={false}
          attributionEnabled={false}
          compassEnabled={false}
          scaleBarEnabled={false}
        >
          <MapboxGL.Camera
            ref={cameraRef}
            defaultSettings={{
              centerCoordinate: userCoords ?? [19.2594, 42.4411],
              zoomLevel: 13.5,
            }}
            followUserLocation={navigating}
            followZoomLevel={navigating ? 16.5 : undefined}
            animationMode="flyTo"
            animationDuration={navigating ? 1000 : 0}
          />
          <MapboxGL.UserLocation visible androidRenderMode="compass" />

          {/* Route line */}
          {routeGeoJSON && (
            <MapboxGL.ShapeSource id="routeLine" shape={routeGeoJSON}>
              <MapboxGL.LineLayer
                id="routeLineLayer"
                style={
                  travelMode === 'walking'
                    ? {
                        lineColor: '#B44AFF',
                        lineWidth: 5,
                        lineCap: 'round',
                        lineJoin: 'round',
                        lineDasharray: [1.5, 2],
                      }
                    : {
                        lineColor: '#B44AFF',
                        lineWidth: 5,
                        lineCap: 'round',
                        lineJoin: 'round',
                      }
                }
              />
            </MapboxGL.ShapeSource>
          )}

          {/* Party markers */}
          {parties.map((party) => (
            <PartyMarker
              key={party.id}
              party={party}
              isActive={selectedParty?.id === party.id}
              onPress={handleMarkerPress.bind(null, party)}
            />
          ))}
        </MapboxGL.MapView>
      ) : (
        <View style={styles.placeholder}>
          <EmptyState
            sfSymbol="map.fill"
            ionicon="map"
            title="Map unavailable"
            body="We can&apos;t show parties on the map right now. Try the Parties tab to see what&apos;s happening."
            action={{
              label: 'Go to Parties',
              onPress: () => router.push('/(tabs)/parties'),
            }}
          />
        </View>
      )}

      {/* ── Header bar ── */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity
          style={styles.searchBar}
          activeOpacity={0.8}
          onPress={() => router.push('/(tabs)/parties')}
        >
          <Ionicons name="search" size={ms(17)} color="rgba(255,255,255,0.6)" />
          <View style={styles.dividerV} />
          <Text style={styles.searchPlaceholder}>Search parties, venues...</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.filterBtn} activeOpacity={0.8}>
          <Ionicons name="options" size={ms(20)} color="rgba(255,255,255,0.9)" />
        </TouchableOpacity>
      </View>

      {/* ── Location denied banner ── */}
      {locationDenied && (
        <View style={[styles.locationBanner, { bottom: tabBarClearance + vs(52) + spacing.sm }]}>
          <Ionicons name="location-outline" size={ms(18)} color="rgba(255,255,255,0.85)" />
          <Text style={styles.locationBannerText}>
            Enable location to discover parties near you
          </Text>
        </View>
      )}

      {/* ── FAB: cancel navigation OR date picker ── */}
      {hasMap && !selectedParty && navigating && (
        <TouchableOpacity
          style={[styles.datePickerFab, styles.cancelNavFab, { bottom: tabBarClearance }]}
          onPress={handleCancelNavigation}
          activeOpacity={0.75}
        >
          <View style={styles.cancelNavInner}>
            <Ionicons name="close" size={ms(24)} color="#FFF" />
          </View>
        </TouchableOpacity>
      )}
      {hasMap && !selectedParty && !navigating && (
        <TouchableOpacity
          style={[styles.datePickerFab, { bottom: tabBarClearance }]}
          onPress={() => setShowDatePicker(true)}
          activeOpacity={0.75}
        >
          <BlurView intensity={60} tint="light" style={styles.fabBlur}>
            <View style={styles.fabInner}>
              <Ionicons name="calendar" size={ms(20)} color="rgba(255,255,255,0.92)" />
              {selectedDate && (
                <View style={styles.fabDot} />
              )}
            </View>
          </BlurView>
        </TouchableOpacity>
      )}

      {/* ── Travel mode sheet (themed BottomSheetModal) ── */}
      <TravelModeSheet
        ref={modeSheetRef}
        target={directionsTarget}
        onSelect={handleModeSelect}
        onDismiss={() => setDirectionsTarget(null)}
      />

      {/* ── Date picker modal ── */}
      <DatePickerModal
        visible={showDatePicker}
        onClose={() => setShowDatePicker(false)}
        selectedDate={selectedDate}
        onDateChange={(date) => {
          setSelectedDate(date);
          const dateStr = date ? date.toISOString().split('T')[0] : undefined;
          if (userCoords) {
            loadParties(userCoords[1], userCoords[0], dateStr);
          } else {
            loadParties(0, 0, dateStr);
          }
        }}
      />

      {/* ── Party peek sheet ── */}
      <PartyPeekSheet
        ref={peekSheetRef}
        party={selectedParty}
        onDirections={handleDirections}
        hasLocation={!!userCoords}
        isFavorited={selectedParty ? isFavorite(selectedParty.id) : false}
        onHeartPress={() => {
          if (!selectedParty) return;
          Haptics.selectionAsync();
          toggleFavorite(selectedParty.id);
        }}
        onDismiss={() => setSelectedParty(null)}
      />
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0D0B10',
  },
  map: {
    flex: 1,
  },
  placeholder: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Location banner
  locationBanner: {
    position: 'absolute',
    left: s(16),
    right: s(16),
    bottom: vs(90),
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(8),
    backgroundColor: 'rgba(125,8,250,0.85)',
    borderRadius: s(16),
    paddingHorizontal: s(14),
    paddingVertical: vs(12),
  },
  locationBannerText: {
    color: '#FFF',
    fontSize: ms(13),
    fontWeight: '500',
    flex: 1,
  },
  // Header
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: s(16),
    paddingBottom: vs(14),
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(10),
    backgroundColor: 'rgba(17,15,20,0.82)',
    borderBottomLeftRadius: s(20),
    borderBottomRightRadius: s(20),
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: s(22),
    height: vs(44),
    paddingHorizontal: s(14),
    gap: s(10),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  dividerV: {
    width: 1,
    height: vs(18),
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  searchPlaceholder: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: ms(14),
    flex: 1,
  },
  filterBtn: {
    width: s(44),
    height: s(44),
    borderRadius: s(22),
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  // Date picker FAB
  datePickerFab: {
    position: 'absolute',
    right: s(20),
    bottom: vs(24),
    width: s(52),
    height: s(52),
    borderRadius: s(26),
    overflow: 'hidden',
    // Liquid glass border
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 12,
  },
  fabBlur: {
    flex: 1,
    // Subtle purple tint overlay simulating iOS liquid glass
    backgroundColor: 'rgba(120,60,255,0.18)',
  },
  fabInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabDot: {
    position: 'absolute',
    top: s(10),
    right: s(10),
    width: s(7),
    height: s(7),
    borderRadius: s(4),
    backgroundColor: '#A855F7',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.7)',
  },
  cancelNavFab: {
    backgroundColor: 'rgba(220,50,50,0.9)',
    borderColor: 'rgba(255,255,255,0.4)',
  },
  cancelNavInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
