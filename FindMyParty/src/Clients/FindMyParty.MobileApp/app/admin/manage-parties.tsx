import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ScrollView,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { partyService } from '@/services/partyService';
import type { HostPartyResponse } from '@/types/parties';

function formatDateHeader(isoString: string): string {
  return new Date(isoString).toLocaleDateString('en-GB', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatTimeRange(startsAt: string, endsAt: string): string {
  const fmt = (s: string) =>
    new Date(s).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return `${fmt(startsAt)} – ${fmt(endsAt)}`;
}

function groupByDate(parties: HostPartyResponse[]): { date: string; items: HostPartyResponse[] }[] {
  const map = new Map<string, HostPartyResponse[]>();
  for (const p of parties) {
    const key = new Date(p.startsAt).toDateString();
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(p);
  }
  return Array.from(map.entries()).map(([, items]) => ({
    date: items[0].startsAt,
    items,
  }));
}

function PartyCard({ party }: { party: HostPartyResponse }) {
  const isDraft = party.status?.toLowerCase() === 'draft';
  const { height: H } = useWindowDimensions();
  const imageAreaHeight = H * 0.129;  // 109/844

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => router.push({ pathname: '/admin/party-bookings', params: { partyId: party.id, partyTitle: party.title } })}
    >
    <BlurView intensity={12} tint="dark" style={styles.card}>
      {/* Image area */}
      <View style={[styles.imageArea, { height: imageAreaHeight }]}>
        <LinearGradient
          colors={['#1a0030', '#3D0880', '#7D08FA']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        {isDraft && (
          <View style={styles.draftBadge}>
            <Text style={styles.draftBadgeText}>Draft</Text>
          </View>
        )}
        {/* Edit button */}
        <TouchableOpacity
          style={styles.editBtn}
          activeOpacity={0.8}
          onPress={() => {/* TODO: navigate to edit screen */}}
        >
          <BlurView intensity={30} tint="light" style={styles.editBtnBlur}>
            <Ionicons name="create-outline" size={22} color="#FFF" />
          </BlurView>
        </TouchableOpacity>
      </View>

      {/* Info strip */}
      <View style={styles.infoStrip}>
        <View style={styles.infoLeft}>
          <View style={styles.infoTitleRow}>
            <Text style={styles.infoTitle} numberOfLines={1}>{party.title}</Text>
          </View>
          <Text style={styles.infoTime}>{formatTimeRange(party.startsAt, party.endsAt)}</Text>
        </View>
        <View style={styles.infoRight}>
          <Text style={styles.infoMeta}>Entrance: €{party.price}</Text>
          <Text style={styles.infoMeta}>RSVPs: {party.ticketsSold}</Text>
          <Text style={styles.viewBookings}>View bookings →</Text>
        </View>
      </View>
    </BlurView>
    </TouchableOpacity>
  );
}

export default function ManagePartiesScreen() {
  const insets = useSafeAreaInsets();
  const [parties, setParties] = useState<HostPartyResponse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    partyService.getMyParties().then(data => {
      setParties(data);
      setLoading(false);
    });
  }, []);

  const groups = groupByDate(parties);

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
          <Ionicons name="arrow-back" size={28} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Parties</Text>
      </View>

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color="#7D08FA" />
        </View>
      ) : parties.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="calendar-outline" size={60} color="rgba(255,255,255,0.25)" />
          <Text style={styles.emptyText}>No parties yet</Text>
          <Text style={styles.emptySubtext}>Tap "Create party" to get started</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 30 }]}
          showsVerticalScrollIndicator={false}
        >
          {groups.map((group, gi) => (
            <View key={gi} style={styles.group}>
              <Text style={styles.dateLabel}>{formatDateHeader(group.date)}</Text>
              {group.items.map(party => (
                <PartyCard key={party.id} party={party} />
              ))}
            </View>
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
    paddingHorizontal: 8,
    paddingBottom: 12,
    gap: 8,
  },
  backBtn: { padding: 8 },
  headerTitle: {
    color: '#FFF',
    fontSize: 30,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
    marginRight: 44,
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
    gap: 12,
  },
  emptyText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 22,
    fontWeight: '600',
  },
  emptySubtext: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 15,
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 12,
    gap: 4,
  },
  group: {
    gap: 8,
    marginBottom: 20,
  },
  dateLabel: {
    color: '#FFF',
    fontSize: 19,
    fontWeight: '500',
  },
  card: {
    borderRadius: 15,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(30,20,50,0.5)',
  },
  imageArea: {
    // height applied inline via useWindowDimensions
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  draftBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: '#7D08FA',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  draftBadgeText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '500',
  },
  editBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
  },
  editBtnBlur: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  infoStrip: {
    flexDirection: 'row',
    backgroundColor: '#2B2B2B',
    paddingHorizontal: 10,
    paddingVertical: 10,
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    minHeight: 80,
  },
  infoLeft: {
    flex: 1,
    gap: 4,
  },
  infoTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  infoTitle: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: '600',
  },
  infoTime: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 14,
  },
  infoRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  infoMeta: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 14,
  },
  viewBookings: {
    color: '#9B5EFA',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
});
