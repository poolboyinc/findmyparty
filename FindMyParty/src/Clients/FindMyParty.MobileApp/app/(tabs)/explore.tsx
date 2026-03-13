import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

// ─── Mock data ────────────────────────────────────────────────────────────────
interface PartyListItem {
  id: string;
  name: string;
  venue: string;
  genre: string;
  time: string;
  price: string;
  rating: number;
  date: string;
}

const MOCK_PARTIES: PartyListItem[] = [
  {
    id: '1',
    name: 'DJ Proximus',
    venue: 'Monkey Club',
    genre: 'Techno',
    time: '23–03h',
    price: '€€',
    rating: 4.5,
    date: 'Sat, 15 Mar',
  },
  {
    id: '2',
    name: 'Funk Night',
    venue: 'Freestyler',
    genre: 'Funk',
    time: '22–04h',
    price: '€',
    rating: 4.2,
    date: 'Fri, 14 Mar',
  },
  {
    id: '3',
    name: 'Trance Party',
    venue: 'Plastic',
    genre: 'Trance',
    time: '00–06h',
    price: '€€€',
    rating: 4.8,
    date: 'Sat, 15 Mar',
  },
  {
    id: '4',
    name: 'House Sessions',
    venue: 'Drugstore',
    genre: 'House',
    time: '22–05h',
    price: '€€',
    rating: 4.6,
    date: 'Sun, 16 Mar',
  },
  {
    id: '5',
    name: 'Deep Vibes',
    venue: 'Lava Bar',
    genre: 'Deep House',
    time: '21–03h',
    price: '€',
    rating: 4.1,
    date: 'Thu, 13 Mar',
  },
];

// ─── Party Card ───────────────────────────────────────────────────────────────
function PartyCard({ item }: { item: PartyListItem }) {
  return (
    <TouchableOpacity style={cardStyles.container} activeOpacity={0.8}>
      {/* Color band / image placeholder */}
      <LinearGradient
        colors={['#1a0030', '#7D08FA']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={cardStyles.imageBand}
      >
        <Ionicons name="flame" size={32} color="rgba(255,255,255,0.35)" />
      </LinearGradient>

      {/* Info */}
      <View style={cardStyles.info}>
        <View style={cardStyles.topRow}>
          <Text style={cardStyles.venueName} numberOfLines={1}>
            {item.venue}
          </Text>
          <View style={cardStyles.ratingPill}>
            <Text style={cardStyles.ratingText}>⭐ {item.rating}</Text>
          </View>
        </View>

        <Text style={cardStyles.eventName} numberOfLines={1}>
          {item.name}
        </Text>

        <View style={cardStyles.metaRow}>
          <View style={cardStyles.chip}>
            <Ionicons name="musical-note" size={12} color="#CA99FF" />
            <Text style={cardStyles.chipText}>{item.genre}</Text>
          </View>
          <View style={cardStyles.chip}>
            <Ionicons name="time-outline" size={12} color="#CA99FF" />
            <Text style={cardStyles.chipText}>{item.time}</Text>
          </View>
          <View style={cardStyles.chip}>
            <Ionicons name="cash-outline" size={12} color="#CA99FF" />
            <Text style={cardStyles.chipText}>{item.price}</Text>
          </View>
        </View>
      </View>

      {/* Date badge */}
      <View style={cardStyles.dateBadge}>
        <Text style={cardStyles.dateText}>{item.date}</Text>
      </View>

      {/* Arrow */}
      <TouchableOpacity style={cardStyles.arrowBtn} activeOpacity={0.7}>
        <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.5)" />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const cardStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1620',
    borderRadius: 20,
    marginHorizontal: 16,
    marginBottom: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  imageBand: {
    width: 72,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 5,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  venueName: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
    marginRight: 8,
  },
  ratingPill: {
    backgroundColor: 'rgba(125,8,250,0.25)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: 'rgba(125,8,250,0.4)',
  },
  ratingText: {
    color: '#CA99FF',
    fontSize: 12,
    fontWeight: '600',
  },
  eventName: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 13,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
    marginTop: 2,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(125,8,250,0.15)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: 'rgba(125,8,250,0.25)',
  },
  chipText: {
    color: '#CA99FF',
    fontSize: 11,
    fontWeight: '500',
  },
  dateBadge: {
    paddingHorizontal: 10,
  },
  dateText: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 11,
    fontWeight: '500',
  },
  arrowBtn: {
    paddingRight: 12,
    paddingLeft: 4,
  },
});

// ─── Filter chips ─────────────────────────────────────────────────────────────
const FILTERS = ['All', 'Tonight', 'This Weekend', 'Techno', 'House', 'Funk'];

function FilterChips({
  active,
  onSelect,
}: {
  active: string;
  onSelect: (f: string) => void;
}) {
  return (
    <FlatList
      horizontal
      data={FILTERS}
      keyExtractor={(item) => item}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={filterStyles.list}
      renderItem={({ item }) => {
        const isActive = item === active;
        return (
          <TouchableOpacity
            style={[filterStyles.chip, isActive && filterStyles.chipActive]}
            onPress={() => onSelect(item)}
            activeOpacity={0.75}
          >
            {isActive ? (
              <LinearGradient
                colors={['#9B20FF', '#6500D2']}
                style={filterStyles.chipGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Text style={[filterStyles.chipText, filterStyles.chipTextActive]}>
                  {item}
                </Text>
              </LinearGradient>
            ) : (
              <Text style={filterStyles.chipText}>{item}</Text>
            )}
          </TouchableOpacity>
        );
      }}
    />
  );
}

const filterStyles = StyleSheet.create({
  list: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  chip: {
    borderRadius: 30,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  chipActive: {
    borderColor: 'transparent',
  },
  chipGradient: {
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  chipText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    fontWeight: '600',
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  chipTextActive: {
    color: '#FFF',
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function PartiesScreen() {
  const insets = useSafeAreaInsets();
  const [activeFilter, setActiveFilter] = React.useState('All');

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <FlatList
        data={MOCK_PARTIES}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <PartyCard item={item} />}
        ListHeaderComponent={
          <>
            {/* Header */}
            <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
              <View>
                <Text style={styles.subtitle}>Discover</Text>
                <Text style={styles.title}>Parties</Text>
              </View>
              <TouchableOpacity style={styles.searchIconBtn} activeOpacity={0.8}>
                <Ionicons name="search" size={20} color="rgba(255,255,255,0.8)" />
              </TouchableOpacity>
            </View>

            {/* Filter chips */}
            <FilterChips active={activeFilter} onSelect={setActiveFilter} />

            {/* Section label */}
            <View style={styles.sectionRow}>
              <Text style={styles.sectionLabel}>
                {MOCK_PARTIES.length} events near you
              </Text>
              <TouchableOpacity activeOpacity={0.7}>
                <Text style={styles.sortText}>Sort ↕</Text>
              </TouchableOpacity>
            </View>
          </>
        }
        ListFooterComponent={<View style={{ height: insets.bottom + 20 }} />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
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
  list: {
    paddingBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  subtitle: {
    color: '#7D08FA',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  title: {
    color: '#FFF',
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginTop: 2,
  },
  searchIconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  sectionLabel: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 13,
    fontWeight: '500',
  },
  sortText: {
    color: '#7D08FA',
    fontSize: 13,
    fontWeight: '700',
  },
});
