import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { bookingService } from '@/services/bookingService';
import type { BookingItem } from '@/types/bookings';
import { getStatusColor, getStatusBackgroundColor } from '@/types/bookings';
import { s, vs, ms } from '@/constants/responsive';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function PartyBookingsScreen() {
  const insets = useSafeAreaInsets();
  const { partyId, partyTitle } = useLocalSearchParams<{ partyId: string; partyTitle: string }>();

  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadBookings = () => {
    if (!partyId) return Promise.resolve();
    return bookingService.getPartyBookings(partyId).then(setBookings);
  };

  useEffect(() => {
    loadBookings().finally(() => setLoading(false));
  }, [partyId]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadBookings();
    setRefreshing(false);
  };

  const totalTickets = bookings
    .filter(b => b.status !== 'Cancelled')
    .reduce((sum, b) => sum + b.ticketCount, 0);

  const totalRevenue = bookings
    .filter(b => b.status !== 'Cancelled')
    .reduce((sum, b) => sum + b.totalPrice, 0);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <LinearGradient
        colors={['#000000', '#0A001A', '#7D08FA']}
        locations={[0, 0.62, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={ms(28)} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>Bookings</Text>
      </View>

      {partyTitle && (
        <Text style={styles.partyTitle} numberOfLines={1}>{partyTitle}</Text>
      )}

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color="#7D08FA" />
        </View>
      ) : bookings.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="ticket-outline" size={ms(60)} color="rgba(255,255,255,0.25)" />
          <Text style={styles.emptyText}>No bookings yet</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 30 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#7D08FA" colors={['#7D08FA']} />
          }
        >
          {/* Summary strip */}
          <BlurView intensity={10} tint="dark" style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{bookings.length}</Text>
              <Text style={styles.summaryLabel}>Bookings</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{totalTickets}</Text>
              <Text style={styles.summaryLabel}>Tickets</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>€{totalRevenue.toFixed(0)}</Text>
              <Text style={styles.summaryLabel}>Revenue</Text>
            </View>
          </BlurView>

          {/* Booking list */}
          {bookings.map(b => (
            <BlurView key={b.id} intensity={10} tint="dark" style={styles.card}>
              <View style={styles.cardRow}>
                <View style={styles.cardLeft}>
                  <Text style={styles.cardTickets}>
                    {b.ticketCount} {b.ticketCount === 1 ? 'ticket' : 'tickets'}
                  </Text>
                  <Text style={styles.cardDate}>{formatDate(b.createdAt)}</Text>
                </View>
                <View style={styles.cardRight}>
                  <Text style={styles.cardPrice}>€{b.totalPrice.toFixed(2)}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusBackgroundColor(b.status) }]}>
                    <Text style={[styles.statusText, { color: getStatusColor(b.status) }]}>{b.status}</Text>
                  </View>
                </View>
              </View>
            </BlurView>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: s(8),
    paddingBottom: vs(4),
    gap: s(8),
  },
  backBtn: { padding: s(8) },
  headerTitle: {
    color: '#FFF',
    fontSize: ms(30),
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
    marginRight: s(44),
  },
  partyTitle: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: ms(14),
    textAlign: 'center',
    paddingHorizontal: s(20),
    marginBottom: vs(12),
  },
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: vs(12),
  },
  emptyText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: ms(22),
    fontWeight: '600',
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: s(12),
    gap: vs(8),
  },
  summaryRow: {
    borderRadius: s(15),
    overflow: 'hidden',
    backgroundColor: 'rgba(43,43,43,0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    flexDirection: 'row',
    paddingVertical: vs(16),
    marginBottom: vs(8),
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
    gap: vs(4),
  },
  summaryValue: {
    color: '#FFF',
    fontSize: ms(22),
    fontWeight: '700',
  },
  summaryLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: ms(12),
  },
  summaryDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  card: {
    borderRadius: s(15),
    overflow: 'hidden',
    backgroundColor: 'rgba(43,43,43,0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: s(14),
    paddingVertical: vs(14),
  },
  cardLeft: { gap: vs(4) },
  cardTickets: {
    color: '#FFF',
    fontSize: ms(17),
    fontWeight: '600',
  },
  cardDate: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: ms(13),
  },
  cardRight: {
    alignItems: 'flex-end',
    gap: vs(6),
  },
  cardPrice: {
    color: '#FFF',
    fontSize: ms(17),
    fontWeight: '700',
  },
  statusBadge: {
    borderRadius: s(20),
    paddingHorizontal: s(10),
    paddingVertical: vs(3),
  },
  statusText: {
    fontSize: ms(12),
    fontWeight: '600',
  },
});
