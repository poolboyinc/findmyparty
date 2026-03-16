import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Modal,
  Platform,
  StatusBar,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import DateTimePicker from '@react-native-community/datetimepicker';
import MapboxGL from '@rnmapbox/maps';
import * as Location from 'expo-location';
import { ApiConstants } from '@/constants/api';

// Set Mapbox access token once
MapboxGL.setAccessToken(ApiConstants.MapboxPublicToken);

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// ─── Mock data ────────────────────────────────────────────────────────────────
interface Party {
  id: string;
  name: string;
  genre: string;
  time: string;
  price: string;
  rating: number;
  reviews: number;
  coordinate: [number, number];
}

const MOCK_PARTIES: Party[] = [
  {
    id: '1',
    name: 'Monkey Club – DJ Proximus',
    genre: 'Techno',
    time: '23–03h',
    price: '€€',
    rating: 4.5,
    reviews: 347,
    coordinate: [20.456, 44.803],
  },
  {
    id: '2',
    name: 'Freestyler – Funk Night',
    genre: 'Funk',
    time: '22–04h',
    price: '€',
    rating: 4.2,
    reviews: 128,
    coordinate: [20.462, 44.807],
  },
  {
    id: '3',
    name: 'Plastic – Trance Party',
    genre: 'Trance',
    time: '00–06h',
    price: '€€€',
    rating: 4.8,
    reviews: 512,
    coordinate: [20.468, 44.798],
  },
  {
    id: '4',
    name: 'Drugstore – House Sessions',
    genre: 'House',
    time: '22–05h',
    price: '€€',
    rating: 4.6,
    reviews: 289,
    coordinate: [20.453, 44.811],
  },
  {
    id: '5',
    name: 'Lava Bar – Deep Vibes',
    genre: 'Deep House',
    time: '21–03h',
    price: '€',
    rating: 4.1,
    reviews: 95,
    coordinate: [20.472, 44.802],
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDate(date: Date): string {
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

// ─── Party Marker ─────────────────────────────────────────────────────────────
function PartyMarker({
  party,
  onPress,
  isActive,
}: {
  party: Party;
  onPress: () => void;
  isActive: boolean;
}) {
  return (
    <MapboxGL.MarkerView
      key={party.id}
      coordinate={party.coordinate}
      anchor={{ x: 0.5, y: 1 }}
    >
      <TouchableOpacity onPress={onPress} activeOpacity={0.85}>
        <View style={[markerStyles.container, isActive && markerStyles.containerActive]}>
          <View style={markerStyles.pinBody}>
            <LinearGradient
              colors={['#9B20FF', '#6500D2']}
              style={markerStyles.gradient}
            >
              <Ionicons name="flame" size={18} color="#FFF" />
            </LinearGradient>
          </View>
          <View style={[markerStyles.pinTip, isActive && markerStyles.pinTipActive]} />
        </View>
      </TouchableOpacity>
    </MapboxGL.MarkerView>
  );
}

const markerStyles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  containerActive: {
    transform: [{ scale: 1.15 }],
  },
  pinBody: {
    width: 44,
    height: 44,
    borderRadius: 22,
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
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderTopWidth: 12,
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
  party: Party;
  onClose: () => void;
  translateY: Animated.Value;
}) {
  return (
    <Animated.View style={[cardStyles.container, { transform: [{ translateY }] }]}>
      {/* Image section */}
      <View style={cardStyles.imageSection}>
        <LinearGradient
          colors={['#1a0030', '#3D0880', '#7D08FA']}
          style={cardStyles.imagePlaceholder}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Ionicons name="musical-notes" size={48} color="rgba(255,255,255,0.3)" />
        </LinearGradient>

        {/* Dot indicators */}
        <View style={cardStyles.dotsRow}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={[cardStyles.dot, i === 0 && cardStyles.dotActive]} />
          ))}
        </View>

        {/* Heart + Close buttons */}
        <View style={cardStyles.imageActions}>
          <TouchableOpacity style={cardStyles.actionBtn} activeOpacity={0.8}>
            <Ionicons name="heart-outline" size={20} color="#7D08FA" />
          </TouchableOpacity>
          <TouchableOpacity style={cardStyles.actionBtn} onPress={onClose} activeOpacity={0.8}>
            <Ionicons name="close" size={20} color="#333" />
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
              {party.name}
            </Text>
            <Text style={cardStyles.partyMeta}>
              {party.genre}{'  ·  '}{party.time}{'  ·  '}{party.price}
            </Text>
          </View>

          {/* Rating badge */}
          <View style={cardStyles.ratingBadge}>
            <Text style={cardStyles.ratingText}>
              ⭐ {party.rating}
            </Text>
            <Text style={cardStyles.reviewCount}>({party.reviews})</Text>
          </View>
        </View>

        {/* CTA */}
        <TouchableOpacity style={cardStyles.ctaButton} activeOpacity={0.85}>
          <Text style={cardStyles.ctaText}>View Details</Text>
        </TouchableOpacity>
      </LinearGradient>
    </Animated.View>
  );
}

const cardStyles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 100,
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 16,
  },
  imageSection: {
    height: 180,
    position: 'relative',
  },
  imagePlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotsRow: {
    position: 'absolute',
    bottom: 10,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  dotActive: {
    backgroundColor: '#FFF',
    width: 18,
  },
  imageActions: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
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
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 18,
    gap: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  infoLeft: {
    flex: 1,
    marginRight: 12,
    gap: 4,
  },
  partyName: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  partyMeta: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 14,
    fontWeight: '400',
  },
  ratingBadge: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  ratingText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
  reviewCount: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
  },
  ctaButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 30,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  ctaText: {
    color: '#FFF',
    fontSize: 15,
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
  onDateChange: (date: Date) => void;
}) {
  const [tempDate, setTempDate] = useState(selectedDate ?? new Date());

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={dpStyles.overlay}>
        <View style={dpStyles.card}>
          <View style={dpStyles.header}>
            <Text style={dpStyles.title}>Select Date</Text>
            <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
              <Ionicons name="close" size={22} color="rgba(255,255,255,0.7)" />
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
                onDateChange(new Date());
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
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 20,
    paddingBottom: 40,
    paddingHorizontal: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700',
  },
  picker: {
    backgroundColor: 'transparent',
    alignSelf: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  clearBtn: {
    flex: 1,
    height: 50,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 16,
    fontWeight: '600',
  },
  confirmBtn: {
    flex: 2,
    height: 50,
    borderRadius: 30,
    overflow: 'hidden',
  },
  confirmGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
});

// ─── Main Screen ─────────────────────────────────────────────────────────────
export default function ExploreScreen() {
  const insets = useSafeAreaInsets();
  const [selectedParty, setSelectedParty] = useState<Party | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [userCoords, setUserCoords] = useState<[number, number] | null>(null);
  const cameraRef = useRef<MapboxGL.Camera>(null);

  // Request location permission and fly to user on mount
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const coords: [number, number] = [loc.coords.longitude, loc.coords.latitude];
      setUserCoords(coords);
      cameraRef.current?.flyTo(coords, 800);
    })();
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
            centerCoordinate: userCoords ?? [20.462, 44.803],
            zoomLevel: 13.5,
          }}
          animationMode="flyTo"
          animationDuration={0}
        />
        <MapboxGL.UserLocation visible androidRenderMode="compass" />

        {/* Party markers */}
        {MOCK_PARTIES.map((party) => (
          <PartyMarker
            key={party.id}
            party={party}
            isActive={selectedParty?.id === party.id}
            onPress={() => setSelectedParty(party)}
          />
        ))}
      </MapboxGL.MapView>

      {/* ── Header bar ── */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={17} color="rgba(255,255,255,0.6)" />
          <View style={styles.dividerV} />
          <Text style={styles.searchPlaceholder}>Search parties, venues...</Text>
        </View>
        <TouchableOpacity style={styles.filterBtn} activeOpacity={0.8}>
          <Ionicons name="options" size={20} color="rgba(255,255,255,0.9)" />
        </TouchableOpacity>
      </View>

      {/* ── Date picker FAB ── */}
      <TouchableOpacity
        style={styles.datePickerFab}
        onPress={() => setShowDatePicker(true)}
        activeOpacity={0.75}
      >
        <BlurView intensity={60} tint="light" style={styles.fabBlur}>
          <View style={styles.fabInner}>
            <Ionicons name="calendar" size={20} color="rgba(255,255,255,0.92)" />
            {selectedDate && (
              <View style={styles.fabDot} />
            )}
          </View>
        </BlurView>
      </TouchableOpacity>

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
  // Header
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(17,15,20,0.82)',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 22,
    height: 44,
    paddingHorizontal: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  dividerV: {
    width: 1,
    height: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  searchPlaceholder: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 14,
    flex: 1,
  },
  filterBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  // Date picker FAB
  datePickerFab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 52,
    height: 52,
    borderRadius: 26,
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
    top: 10,
    right: 10,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#A855F7',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.7)',
  },
});
