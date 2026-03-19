import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  TouchableOpacity,
  Image,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import * as Location from 'expo-location';
import { partyService } from '@/services/partyService';
import type { PartyMapItem } from '@/types/parties';
import { s, vs, ms } from '@/constants/responsive';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function formatPrice(price: number): string {
  if (price === 0) return 'Free';
  if (price <= 10) return '€';
  if (price <= 25) return '€€';
  return '€€€';
}

// Haversine distance in km
function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function isTonight(iso: string): boolean {
  const partyDate = new Date(iso);
  const now = new Date();
  return (
    partyDate.getFullYear() === now.getFullYear() &&
    partyDate.getMonth() === now.getMonth() &&
    partyDate.getDate() === now.getDate()
  );
}

function isThisWeekend(iso: string): boolean {
  const partyDate = new Date(iso);
  const now = new Date();
  const day = partyDate.getDay(); // 0=Sun, 6=Sat
  const diffDays = Math.floor(
    (partyDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );
  return (day === 5 || day === 6 || day === 0) && diffDays >= 0 && diffDays <= 7;
}

// ─── Party Card ───────────────────────────────────────────────────────────────
function PartyCard({ item }: { item: PartyMapItem }) {
  const { width: W, height: H } = useWindowDimensions();
  const cardWidth = W * 0.78;
  const cardImageHeight = H * 0.199;  // 168/844
  return (
    <TouchableOpacity
      style={[cardStyles.container, { width: cardWidth }]}
      activeOpacity={0.88}
      onPress={() => router.push(`/party/${item.id}`)}
    >
      {/* Image */}
      <View style={[cardStyles.imageWrapper, { height: cardImageHeight }]}>
        {item.imageUrl ? (
          <Image
            source={{ uri: item.imageUrl }}
            style={cardStyles.image}
            resizeMode="cover"
          />
        ) : (
          <LinearGradient
            colors={['#1a0030', '#3D0880', '#7D08FA']}
            style={cardStyles.imagePlaceholder}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Ionicons name="flame" size={ms(36)} color="rgba(255,255,255,0.25)" />
          </LinearGradient>
        )}
        {/* Heart */}
        <TouchableOpacity style={cardStyles.heartBtn} activeOpacity={0.8}>
          <Ionicons name="heart-outline" size={ms(18)} color="#FFF" />
        </TouchableOpacity>
      </View>

      {/* Info row */}
      <View style={cardStyles.infoRow}>
        <View style={cardStyles.infoLeft}>
          <Text style={cardStyles.clubName} numberOfLines={1}>{item.title}</Text>
          <Text style={cardStyles.meta}>
            {formatTime(item.startsAt)}{'  |  '}{formatPrice(item.price)}
          </Text>
        </View>
        <LinearGradient
          colors={['#7D08FA', '#FF6E00']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={cardStyles.ratingBadge}
        >
          <Text style={cardStyles.ratingText}>
            {item.isSoldOut ? 'Sold Out' : `€${item.price.toFixed(0)}`}
          </Text>
        </LinearGradient>
      </View>
    </TouchableOpacity>
  );
}

const cardStyles = StyleSheet.create({
  container: {
    // width applied inline via useWindowDimensions
    marginLeft: s(14),
  },
  imageWrapper: {
    // height applied inline via useWindowDimensions
    borderRadius: s(30),
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#9E47FB',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heartBtn: {
    position: 'absolute',
    top: vs(8),
    right: s(10),
    width: s(28),
    height: vs(28),
    borderRadius: s(14),
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: vs(10),
    paddingRight: s(2),
  },
  infoLeft: {
    flex: 1,
    marginRight: s(8),
    gap: vs(4),
  },
  clubName: {
    color: '#FFF',
    fontSize: ms(20),
    fontWeight: '700',
  },
  meta: {
    color: '#FFF',
    fontSize: ms(15),
    fontWeight: '400',
    opacity: 0.85,
  },
  ratingBadge: {
    height: vs(24),
    paddingHorizontal: s(10),
    borderRadius: s(30),
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.32)',
  },
  ratingText: {
    color: '#FFF',
    fontSize: ms(13),
    fontWeight: '700',
  },
});

// ─── Filter chips ─────────────────────────────────────────────────────────────
type FilterKey = 'all' | 'tonight' | 'free' | 'weekend' | 'premium';
const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All 🎉' },
  { key: 'tonight', label: 'Tonight 🔥' },
  { key: 'free', label: 'Free Entry' },
  { key: 'weekend', label: 'This Weekend' },
  { key: 'premium', label: 'Premium ✨' },
];

function FilterRow({
  active,
  onSelect,
}: {
  active: FilterKey;
  onSelect: (k: FilterKey) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={filterStyles.row}
    >
      {FILTERS.map((f) => (
        <TouchableOpacity
          key={f.key}
          style={[filterStyles.chip, active === f.key && filterStyles.chipActive]}
          onPress={() => onSelect(f.key)}
          activeOpacity={0.8}
        >
          <Text style={filterStyles.chipText}>{f.label}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const filterStyles = StyleSheet.create({
  row: {
    paddingHorizontal: s(14),
    paddingVertical: vs(10),
    gap: s(10),
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    height: vs(30),
    paddingHorizontal: s(14),
    borderRadius: s(30),
    borderWidth: 1,
    borderColor: '#9739FB',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  chipActive: {
    backgroundColor: 'rgba(125,8,250,0.45)',
    borderColor: '#B060FF',
  },
  chipText: {
    color: '#FFF',
    fontSize: ms(13),
    fontWeight: '500',
  },
});

// ─── Section ──────────────────────────────────────────────────────────────────
function Section({ title, data }: { title: string; data: PartyMapItem[] }) {
  if (data.length === 0) return null;
  return (
    <>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      <FlatList
        horizontal
        data={data}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <PartyCard item={item} />}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.horizontalList}
        scrollEnabled
      />
    </>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────
export default function PartiesScreen() {
  const insets = useSafeAreaInsets();
  const { height: H } = useWindowDimensions();
  const [parties, setParties] = useState<PartyMapItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);

  const loadParties = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    let lat: number | undefined;
    let lng: number | undefined;
    if (status === 'granted') {
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      lat = loc.coords.latitude;
      lng = loc.coords.longitude;
      setUserCoords({ lat, lng });
    }
    const data = await partyService.getParties(lat, lng);
    setParties(data);
  };

  useEffect(() => {
    loadParties().finally(() => setLoading(false));
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadParties();
    setRefreshing(false);
  };

  // Sort all parties by distance if we have location
  const sortedByDistance = userCoords
    ? [...parties].sort(
        (a, b) =>
          distanceKm(userCoords.lat, userCoords.lng, a.latitude, a.longitude) -
          distanceKm(userCoords.lat, userCoords.lng, b.latitude, b.longitude)
      )
    : parties;

  // Apply text search first
  const searchFiltered = searchQuery.trim()
    ? sortedByDistance.filter((p) =>
        p.title.toLowerCase().includes(searchQuery.trim().toLowerCase())
      )
    : sortedByDistance;

  // Apply active filter
  const filtered: PartyMapItem[] = (() => {
    switch (activeFilter) {
      case 'tonight':
        return searchFiltered.filter((p) => isTonight(p.startsAt));
      case 'free':
        return searchFiltered.filter((p) => p.price === 0);
      case 'weekend':
        return searchFiltered.filter((p) => isThisWeekend(p.startsAt));
      case 'premium':
        return searchFiltered.filter((p) => p.price > 25);
      default:
        return searchFiltered;
    }
  })();

  // Category sections for "All" view
  const nearby = searchFiltered.slice(0, 10);
  const tonight = searchFiltered.filter((p) => isTonight(p.startsAt));
  const freeEntry = searchFiltered.filter((p) => p.price === 0);
  const thisWeekend = searchFiltered.filter(
    (p) => isThisWeekend(p.startsAt) && !isTonight(p.startsAt)
  );
  const premium = searchFiltered.filter((p) => p.price > 25);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Full-screen gradient background */}
      <LinearGradient
        colors={['#000000', '#000000', '#7D08FA']}
        locations={[0, 0.33, 1]}
        style={StyleSheet.absoluteFill}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 20 }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#7D08FA" colors={['#7D08FA']} />
        }
      >
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={ms(20)} color="rgba(255,255,255,0.8)" />
            <View style={styles.searchDivider} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search..."
              placeholderTextColor="rgba(255,255,255,0.7)"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} activeOpacity={0.7}>
                <Ionicons name="close-circle" size={ms(18)} color="rgba(255,255,255,0.6)" />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity style={styles.bellBtn} activeOpacity={0.8}>
            <Ionicons name="notifications-outline" size={ms(22)} color="#FFF" />
          </TouchableOpacity>
        </View>

        {/* Filter chips */}
        <FilterRow active={activeFilter} onSelect={setActiveFilter} />

        {loading ? (
          <View style={[styles.loadingRow, { height: H * 0.199 + 60 }]}>
            <ActivityIndicator color="#7D08FA" />
          </View>
        ) : activeFilter !== 'all' ? (
          // Single filtered list
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                {FILTERS.find((f) => f.key === activeFilter)?.label}
              </Text>
            </View>
            {filtered.length === 0 ? (
              <Text style={styles.emptyText}>No parties found</Text>
            ) : (
              <FlatList
                horizontal
                data={filtered}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => <PartyCard item={item} />}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.horizontalList}
                scrollEnabled
              />
            )}
          </>
        ) : (
          // All categories
          <>
            <Section
              title={userCoords ? 'Nearby 📍' : 'All Parties 🎉'}
              data={nearby}
            />
            <Section title="Tonight 🔥" data={tonight} />
            <Section title="Free Entry 🆓" data={freeEntry} />
            <Section title="This Weekend 🗓️" data={thisWeekend} />
            <Section title="Premium ✨" data={premium} />
            {nearby.length === 0 && (
              <Text style={styles.emptyText}>No parties available</Text>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
  },
  scroll: {
    paddingTop: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: s(14),
    paddingBottom: vs(4),
    gap: s(10),
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: vs(40),
    borderRadius: s(30),
    borderWidth: 1,
    borderColor: '#FFF',
    paddingHorizontal: s(14),
    gap: s(10),
    backgroundColor: 'rgba(126,10,250,0.55)',
  },
  searchDivider: {
    width: s(1),
    height: vs(20),
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  searchInput: {
    color: '#FFF',
    fontSize: ms(18),
    fontWeight: '300',
    flex: 1,
    paddingVertical: 0,
  },
  bellBtn: {
    width: s(32),
    height: vs(32),
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(6),
    marginLeft: s(14),
    marginTop: vs(14),
    marginBottom: vs(12),
  },
  sectionTitle: {
    color: '#FFF',
    fontSize: ms(22),
    fontWeight: '700',
  },
  horizontalList: {
    paddingRight: s(14),
  },
  loadingRow: {
    // height applied inline via useWindowDimensions
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: ms(14),
    marginLeft: s(14),
    marginBottom: vs(8),
  },
});
