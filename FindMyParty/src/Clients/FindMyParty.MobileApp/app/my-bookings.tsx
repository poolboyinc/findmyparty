import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { bookingService } from '@/services/bookingService';
import { getStatusColor, getStatusBorderColor } from '@/types/bookings';
import type { BookingItem } from '@/types/bookings';
import { s, vs, ms } from '@/constants/responsive';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function BookingCard({ booking, onCancel }: { booking: BookingItem; onCancel: (id: string) => void }) {
  return (
    <BlurView intensity={12} tint="dark" style={styles.card}>
      {/* Status strip */}
      <View style={[styles.statusStrip, { borderColor: getStatusBorderColor(booking.status) }]}>
        <View style={[styles.statusDot, { backgroundColor: getStatusColor(booking.status) }]} />
        <Text style={[styles.statusText, { color: getStatusColor(booking.status) }]}>
          {booking.status}
        </Text>
      </View>

      {/* Main info */}
      <View style={styles.cardBody}>
        <View style={styles.row}>
          <Ionicons name="ticket-outline" size={ms(20)} color="rgba(255,255,255,0.6)" />
          <Text style={styles.label}>Tickets</Text>
          <Text style={styles.value}>{booking.ticketCount}</Text>
        </View>

        <View style={styles.row}>
          <Ionicons name="cash-outline" size={ms(20)} color="rgba(255,255,255,0.6)" />
          <Text style={styles.label}>Total</Text>
          <Text style={styles.value}>€{booking.totalPrice.toFixed(2)}</Text>
        </View>

        <View style={styles.row}>
          <Ionicons name="calendar-outline" size={ms(20)} color="rgba(255,255,255,0.6)" />
          <Text style={styles.label}>Booked on</Text>
          <Text style={styles.value}>{formatDate(booking.createdAt)}</Text>
        </View>
      </View>

      {/* Actions */}
      <View style={styles.cardActions}>
        <TouchableOpacity
          style={styles.detailBtn}
          activeOpacity={0.8}
          onPress={() => router.push(`/party/${booking.partyId}`)}
        >
          <Text style={styles.detailBtnText}>View Party</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.cancelBtn}
          activeOpacity={0.8}
          onPress={() => onCancel(booking.id)}
        >
          <Text style={styles.cancelBtnText}>Cancel Booking</Text>
        </TouchableOpacity>
      </View>
    </BlurView>
  );
}

export default function MyBookingsScreen() {
  const insets = useSafeAreaInsets();
  const { } = useWindowDimensions();
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const data = await bookingService.getMyBookings();
    setBookings(data);
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handleCancel = useCallback((bookingId: string) => {
    Alert.alert(
      'Cancel Booking',
      'Are you sure you want to cancel this booking? This cannot be undone.',
      [
        { text: 'Keep It', style: 'cancel' },
        {
          text: 'Cancel Booking',
          style: 'destructive',
          onPress: async () => {
            const success = await bookingService.cancelBooking(bookingId);
            if (success) {
              await load();
            } else {
              Alert.alert('Failed', 'Could not cancel the booking. Please try again.');
            }
          },
        },
      ]
    );
  }, [load]);

  const active = bookings.filter(b => b.status !== 'Cancelled');

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <LinearGradient
        colors={['#000000', '#0A001A', '#7D08FA']}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + vs(10) }]}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={ms(28)} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Tickets</Text>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#7D08FA" />
        </View>
      ) : active.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="ticket-outline" size={ms(60)} color="rgba(255,255,255,0.2)" />
          <Text style={styles.emptyTitle}>No bookings yet</Text>
          <Text style={styles.emptySubtitle}>Find a party on the map and reserve your spot</Text>
          <TouchableOpacity
            style={styles.exploreBtn}
            activeOpacity={0.85}
            onPress={() => router.replace('/(tabs)')}
          >
            <LinearGradient
              colors={['#7E0AFA', '#FF6E00']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.exploreBtnGradient}
            >
              <Text style={styles.exploreBtnText}>Explore Parties</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + vs(30) }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#7D08FA" colors={['#7D08FA']} />
          }
        >
          {active.map(b => (
            <BookingCard key={b.id} booking={b} onCancel={handleCancel} />
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
    paddingBottom: vs(12),
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
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: vs(14),
    paddingHorizontal: s(32),
  },
  emptyTitle: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: ms(22),
    fontWeight: '700',
    textAlign: 'center',
  },
  emptySubtitle: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: ms(15),
    textAlign: 'center',
    lineHeight: vs(22),
  },
  exploreBtn: {
    marginTop: vs(8),
    borderRadius: s(30),
    overflow: 'hidden',
    width: '100%',
    height: vs(50),
  },
  exploreBtnGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exploreBtnText: {
    color: '#FFF',
    fontSize: ms(16),
    fontWeight: '700',
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: s(16),
    gap: vs(12),
  },
  card: {
    borderRadius: s(18),
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(30,20,50,0.5)',
  },
  statusStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(8),
    paddingHorizontal: s(16),
    paddingVertical: vs(10),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
    borderLeftWidth: 3,
  },
  statusDot: {
    width: s(8),
    height: s(8),
    borderRadius: s(4),
  },
  statusText: {
    fontSize: ms(13),
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  cardBody: {
    padding: s(16),
    gap: vs(12),
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(10),
  },
  label: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: ms(14),
    flex: 1,
  },
  value: {
    color: '#FFF',
    fontSize: ms(15),
    fontWeight: '600',
  },
  cardActions: {
    flexDirection: 'row',
    gap: s(10),
    paddingHorizontal: s(16),
    paddingBottom: vs(14),
  },
  detailBtn: {
    flex: 1,
    height: vs(40),
    borderRadius: s(20),
    backgroundColor: 'rgba(125,8,250,0.3)',
    borderWidth: 1,
    borderColor: 'rgba(125,8,250,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailBtnText: {
    color: '#FFF',
    fontSize: ms(14),
    fontWeight: '600',
  },
  cancelBtn: {
    flex: 1,
    height: vs(40),
    borderRadius: s(20),
    backgroundColor: 'rgba(239,68,68,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    color: '#EF4444',
    fontSize: ms(14),
    fontWeight: '600',
  },
});
