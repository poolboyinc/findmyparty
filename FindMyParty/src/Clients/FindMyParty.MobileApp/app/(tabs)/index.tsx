import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Modal,
  Platform,
  StatusBar,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import DateTimePicker from '@react-native-community/datetimepicker';
import MapboxGL from '@rnmapbox/maps';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { ApiConstants, resolveMediaUrl } from '@/constants/api';
import { s, vs, ms } from '@/constants/responsive';
import { useExplore } from '@/hooks/useExplore';
import type { PartyMapItem } from '@/types/parties';

// Set Mapbox access token once (only if present — missing token redirects to onboarding at runtime)
if (ApiConstants.MapboxPublicToken) {
  MapboxGL.setAccessToken(ApiConstants.MapboxPublicToken);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
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

// ─── Party Popup Card ─────────────────────────────────────────────────────────
function PartyCard({
  party,
  onClose,
  translateY,
}: {
  party: PartyMapItem;
  onClose: () => void;
  translateY: Animated.Value;
}) {
  const { height: H } = useWindowDimensions();
  const imageSectionHeight = H * 0.213;  // 180/844
  return (
    <Animated.View style={[cardStyles.container, { transform: [{ translateY }] }]}>
      {/* Image section */}
      <View style={[cardStyles.imageSection, { height: imageSectionHeight }]}>
        {resolveMediaUrl(party.imageUrl) ? (
          <Image
            source={{ uri: resolveMediaUrl(party.imageUrl)! }}
            style={cardStyles.imagePlaceholder}
            resizeMode="cover"
          />
        ) : (
          <LinearGradient
            colors={['#1a0030', '#3D0880', '#7D08FA']}
            style={cardStyles.imagePlaceholder}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Ionicons name="musical-notes" size={ms(48)} color="rgba(255,255,255,0.3)" />
          </LinearGradient>
        )}

        {/* Heart + Close buttons */}
        <View style={cardStyles.imageActions}>
          <TouchableOpacity style={cardStyles.actionBtn} activeOpacity={0.8}>
            <Ionicons name="heart-outline" size={ms(20)} color="#7D08FA" />
          </TouchableOpacity>
          <TouchableOpacity style={cardStyles.actionBtn} onPress={onClose} activeOpacity={0.8}>
            <Ionicons name="close" size={ms(20)} color="#333" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Info section */}
      <LinearGradient
        colors={['#7D08FA', '#5B0297']}
        style={cardStyles.infoSection}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={cardStyles.infoRow}>
          <View style={cardStyles.infoLeft}>
            <Text style={cardStyles.partyName} numberOfLines={1}>
              {party.title}
            </Text>
            <Text style={cardStyles.partyMeta}>
              {formatTime(party.startsAt)}{'  ·  '}€{party.price}
            </Text>
          </View>

          {/* Sold out badge */}
          {party.isSoldOut && (
            <View style={cardStyles.ratingBadge}>
              <Text style={cardStyles.ratingText}>Sold Out</Text>
            </View>
          )}
        </View>

        {/* CTA */}
        <TouchableOpacity
          style={cardStyles.ctaButton}
          activeOpacity={0.85}
          onPress={() => router.push(`/party/${party.id}`)}
        >
          <Text style={cardStyles.ctaText}>View Details</Text>
        </TouchableOpacity>
      </LinearGradient>
    </Animated.View>
  );
}

const cardStyles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: s(16),
    right: s(16),
    bottom: vs(16),
    borderRadius: s(24),
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 16,
  },
  imageSection: {
    // height applied inline via useWindowDimensions
    position: 'relative',
  },
  imagePlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotsRow: {
    position: 'absolute',
    bottom: vs(10),
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: s(6),
  },
  dot: {
    width: s(6),
    height: s(6),
    borderRadius: s(3),
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  dotActive: {
    backgroundColor: '#FFF',
    width: s(18),
  },
  imageActions: {
    position: 'absolute',
    top: s(12),
    right: s(12),
    flexDirection: 'row',
    gap: s(8),
  },
  actionBtn: {
    width: s(36),
    height: s(36),
    borderRadius: s(18),
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  infoSection: {
    paddingHorizontal: s(18),
    paddingTop: vs(14),
    paddingBottom: vs(18),
    gap: vs(12),
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  infoLeft: {
    flex: 1,
    marginRight: s(12),
    gap: vs(4),
  },
  partyName: {
    color: '#FFF',
    fontSize: ms(18),
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  partyMeta: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: ms(14),
    fontWeight: '400',
  },
  ratingBadge: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: s(20),
    paddingHorizontal: s(10),
    paddingVertical: vs(6),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  ratingText: {
    color: '#FFF',
    fontSize: ms(13),
    fontWeight: '700',
  },

  ctaButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: s(30),
    height: vs(44),
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  ctaText: {
    color: '#FFF',
    fontSize: ms(15),
    fontWeight: '700',
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

// ─── Main Screen ─────────────────────────────────────────────────────────────
export default function ExploreScreen() {
  const insets = useSafeAreaInsets();
  const { parties, loadParties } = useExplore();
  const [selectedParty, setSelectedParty] = useState<PartyMapItem | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [userCoords, setUserCoords] = useState<[number, number] | null>(null);
  const [locationDenied, setLocationDenied] = useState(false);
  const cameraRef = useRef<MapboxGL.Camera>(null);

  // Guard: redirect if Mapbox token is missing
  useEffect(() => {
    if (!ApiConstants.MapboxPublicToken) {
      router.replace('/onboarding');
    }
  }, []);

  // Request location permission, fly to user, and load nearby parties
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationDenied(true);
        loadParties(); // still load all parties without location filter
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const coords: [number, number] = [loc.coords.longitude, loc.coords.latitude];
      setUserCoords(coords);
      cameraRef.current?.flyTo(coords, 800);
      loadParties(loc.coords.latitude, loc.coords.longitude);
    })();
  }, []);

  const handleMarkerPress = useCallback((party: PartyMapItem) => {
    setSelectedParty(party);
  }, []);

  // Card slide-up animation
  const cardAnim = useRef(new Animated.Value(300)).current;

  useEffect(() => {
    if (selectedParty) {
      Animated.spring(cardAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 80,
        friction: 12,
      }).start();
    } else {
      Animated.timing(cardAnim, {
        toValue: 300,
        duration: 220,
        useNativeDriver: true,
      }).start();
    }
  }, [selectedParty]);

  const handleCloseCard = () => {
    Animated.timing(cardAnim, {
      toValue: 300,
      duration: 220,
      useNativeDriver: true,
    }).start(() => setSelectedParty(null));
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* ── Map ── */}
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
          animationMode="flyTo"
          animationDuration={0}
        />
        <MapboxGL.UserLocation visible androidRenderMode="compass" />

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

      {/* ── Header bar ── */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity
          style={styles.searchBar}
          activeOpacity={0.8}
          onPress={() => router.push('/(tabs)/explore')}
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
        <View style={styles.locationBanner}>
          <Ionicons name="location-outline" size={ms(18)} color="rgba(255,255,255,0.85)" />
          <Text style={styles.locationBannerText}>
            Enable location to discover parties near you
          </Text>
        </View>
      )}

      {/* ── Date picker FAB ── */}
      {!selectedParty && (
        <TouchableOpacity
          style={styles.datePickerFab}
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

      {/* ── Party popup card ── */}
      {selectedParty && (
        <PartyCard
          party={selectedParty}
          onClose={handleCloseCard}
          translateY={cardAnim}
        />
      )}

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
});
