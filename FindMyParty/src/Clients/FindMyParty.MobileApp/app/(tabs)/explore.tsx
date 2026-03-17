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
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { partyService } from '@/services/partyService';
import type { PartyMapItem } from '@/types/parties';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH * 0.78;
const CARD_IMAGE_HEIGHT = 168;

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

// ─── Party Card ───────────────────────────────────────────────────────────────
function PartyCard({ item }: { item: PartyMapItem }) {
  return (
    <TouchableOpacity
      style={cardStyles.container}
      activeOpacity={0.88}
      onPress={() => router.push(`/party/${item.id}`)}
    >
      {/* Image */}
      <View style={cardStyles.imageWrapper}>
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
            <Ionicons name="flame" size={36} color="rgba(255,255,255,0.25)" />
          </LinearGradient>
        )}
        {/* Heart */}
        <TouchableOpacity style={cardStyles.heartBtn} activeOpacity={0.8}>
          <Ionicons name="heart-outline" size={18} color="#FFF" />
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
    width: CARD_WIDTH,
    marginLeft: 14,
  },
  imageWrapper: {
    height: CARD_IMAGE_HEIGHT,
    borderRadius: 30,
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
    top: 8,
    right: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingRight: 2,
  },
  infoLeft: {
    flex: 1,
    marginRight: 8,
    gap: 4,
  },
  clubName: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '700',
  },
  meta: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '400',
    opacity: 0.85,
  },
  ratingBadge: {
    height: 24,
    paddingHorizontal: 10,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.32)',
  },
  ratingText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
});

// ─── Filter chip ──────────────────────────────────────────────────────────────
const FILTERS = [
  { label: 'Top Rated ⭐️' },
  { label: 'Sort by', hasArrow: true },
  { label: 'Price', hasArrow: true },
  { label: 'Promotions' },
];

function FilterRow() {
  const [active, setActive] = useState(0);
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={filterStyles.row}
    >
      {FILTERS.map((f, i) => (
        <TouchableOpacity
          key={i}
          style={[filterStyles.chip, active === i && filterStyles.chipActive]}
          onPress={() => setActive(i)}
          activeOpacity={0.8}
        >
          <Text style={filterStyles.chipText}>{f.label}</Text>
          {f.hasArrow && (
            <Ionicons name="chevron-down" size={14} color="#FFF" style={{ marginLeft: 2 }} />
          )}
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const filterStyles = StyleSheet.create({
  row: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 25,
    paddingHorizontal: 12,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: '#9739FB',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  chipActive: {
    backgroundColor: 'rgba(125,8,250,0.35)',
  },
  chipText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '500',
  },
});

// ─── Main Screen ─────────────────────────────────────────────────────────────
export default function PartiesScreen() {
  const insets = useSafeAreaInsets();
  const [parties, setParties] = useState<PartyMapItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    partyService.getParties().then((data) => {
      setParties(data);
      setLoading(false);
    });
  }, []);

  // Split into sections — first half "Popping tonight", second half "Your favorites"
  const popping = parties.slice(0, Math.ceil(parties.length / 2));
  const favorites = parties.slice(Math.ceil(parties.length / 2));

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
      >
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
          {/* Search bar */}
          <TouchableOpacity style={styles.searchBar} activeOpacity={0.8}>
            <Ionicons name="search" size={20} color="rgba(255,255,255,0.8)" />
            <View style={styles.searchDivider} />
            <Text style={styles.searchPlaceholder}>Search...</Text>
          </TouchableOpacity>
          {/* Bell */}
          <TouchableOpacity style={styles.bellBtn} activeOpacity={0.8}>
            <Ionicons name="notifications-outline" size={22} color="#FFF" />
          </TouchableOpacity>
        </View>

        {/* Filter chips */}
        <FilterRow />

        {/* Popping tonight */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Popping tonight 🔥</Text>
          <Ionicons name="information-circle-outline" size={17} color="rgba(255,255,255,0.5)" />
        </View>

        {loading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color="#7D08FA" />
          </View>
        ) : popping.length === 0 ? (
          <Text style={styles.emptyText}>No parties tonight</Text>
        ) : (
          <FlatList
            horizontal
            data={popping}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <PartyCard item={item} />}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalList}
            scrollEnabled
          />
        )}

        {/* Your favorites */}
        <Text style={[styles.sectionTitle, { marginTop: 28, marginLeft: 14 }]}>
          Your favorites
        </Text>

        {favorites.length === 0 ? (
          <Text style={styles.emptyText}>Save parties to see them here</Text>
        ) : (
          <FlatList
            horizontal
            data={favorites}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <PartyCard item={item} />}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalList}
            scrollEnabled
          />
        )}

        {/* Nearby label */}
        <Text style={[styles.sectionTitle, { marginTop: 28, marginLeft: 14 }]}>
          Nearby
        </Text>
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
    paddingHorizontal: 14,
    paddingBottom: 4,
    gap: 10,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: '#FFF',
    paddingHorizontal: 14,
    gap: 10,
    // purple → black gradient background
    backgroundColor: 'rgba(126,10,250,0.55)',
  },
  searchDivider: {
    width: 1,
    height: 20,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  searchPlaceholder: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 18,
    fontWeight: '100',
    flex: 1,
  },
  bellBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: 14,
    marginTop: 14,
    marginBottom: 12,
  },
  sectionTitle: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: '700',
  },
  horizontalList: {
    paddingRight: 14,
  },
  loadingRow: {
    height: CARD_IMAGE_HEIGHT + 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 14,
    marginLeft: 14,
    marginBottom: 8,
  },
});
