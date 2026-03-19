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
import { partyService } from '@/services/partyService';
import type { HostPartyResponse } from '@/types/parties';
import { s, vs, ms } from '@/constants/responsive';

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

function PartyCard({ party, onPublish, onDelete, onCancel }: {
  party: HostPartyResponse;
  onPublish: (id: string) => void;
  onDelete: (id: string) => void;
  onCancel: (id: string) => void;
}) {
  const isDraft = party.status?.toLowerCase() === 'draft';
  const isPublished = party.status?.toLowerCase() === 'published' || party.status?.toLowerCase() === 'soldout';
  const { height: H } = useWindowDimensions();

  const handleEditPress = () => {
    const options: { text: string; style?: 'destructive' | 'cancel' | 'default'; onPress?: () => void }[] = [];

    if (isDraft) {
      options.push({ text: 'Delete Draft', style: 'destructive', onPress: () => onDelete(party.id) });
    }
    if (isPublished) {
      options.push({ text: 'Cancel Party', style: 'destructive', onPress: () => onCancel(party.id) });
    }
    options.push({ text: 'Dismiss', style: 'cancel' });

    Alert.alert(party.title, undefined, options);
  };
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
          onPress={handleEditPress}
        >
          <BlurView intensity={30} tint="light" style={styles.editBtnBlur}>
            <Ionicons name="create-outline" size={ms(22)} color="#FFF" />
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
          {isDraft && (
            <TouchableOpacity
              style={styles.publishBtn}
              activeOpacity={0.8}
              onPress={() => onPublish(party.id)}
            >
              <Text style={styles.publishBtnText}>Publish →</Text>
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.infoRight}>
          <Text style={styles.infoMeta}>Entrance: €{party.price}</Text>
          <Text style={styles.infoMeta}>RSVPs: {party.ticketsSold}</Text>
          {!isDraft && <Text style={styles.viewBookings}>View bookings →</Text>}
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
  const [refreshing, setRefreshing] = useState(false);

  const loadParties = () => partyService.getMyParties().then(setParties);

  useEffect(() => {
    loadParties().finally(() => setLoading(false));
  }, []);

  const handlePublish = useCallback(async (partyId: string) => {
    const success = await partyService.publishParty(partyId);
    if (success) {
      await loadParties();
    } else {
      Alert.alert('Failed', 'Could not publish the party. Please try again.');
    }
  }, []);

  const handleDelete = useCallback((partyId: string) => {
    Alert.alert('Delete Draft', 'This will permanently delete the draft. Continue?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          const success = await partyService.deleteParty(partyId);
          if (success) {
            await loadParties();
          } else {
            Alert.alert('Failed', 'Could not delete the party. Please try again.');
          }
        },
      },
    ]);
  }, []);

  const handleCancel = useCallback((partyId: string) => {
    Alert.alert('Cancel Party', 'This will cancel the party and notify all attendees. Continue?', [
      { text: 'Go back', style: 'cancel' },
      {
        text: 'Cancel Party', style: 'destructive', onPress: async () => {
          const success = await partyService.cancelParty(partyId);
          if (success) {
            await loadParties();
          } else {
            Alert.alert('Failed', 'Could not cancel the party. Please try again.');
          }
        },
      },
    ]);
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadParties();
    setRefreshing(false);
  };

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
          <Ionicons name="arrow-back" size={ms(28)} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Parties</Text>
      </View>

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color="#7D08FA" />
        </View>
      ) : parties.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="calendar-outline" size={ms(60)} color="rgba(255,255,255,0.25)" />
          <Text style={styles.emptyText}>No parties yet</Text>
          <Text style={styles.emptySubtext}>Tap "Create party" to get started</Text>
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
          {groups.map((group, gi) => (
            <View key={gi} style={styles.group}>
              <Text style={styles.dateLabel}>{formatDateHeader(group.date)}</Text>
              {group.items.map(party => (
                <PartyCard key={party.id} party={party} onPublish={handlePublish} onDelete={handleDelete} onCancel={handleCancel} />
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
  emptySubtext: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: ms(15),
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: s(12),
    gap: vs(4),
  },
  group: {
    gap: vs(8),
    marginBottom: vs(20),
  },
  dateLabel: {
    color: '#FFF',
    fontSize: ms(19),
    fontWeight: '500',
  },
  card: {
    borderRadius: s(15),
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
    top: vs(10),
    left: s(10),
    backgroundColor: '#7D08FA',
    borderRadius: s(10),
    paddingHorizontal: s(10),
    paddingVertical: vs(3),
  },
  draftBadgeText: {
    color: '#FFF',
    fontSize: ms(13),
    fontWeight: '500',
  },
  editBtn: {
    position: 'absolute',
    top: vs(8),
    right: s(8),
    width: s(40),
    height: vs(40),
    borderRadius: s(20),
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
    paddingHorizontal: s(10),
    paddingVertical: vs(10),
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    minHeight: vs(80),
  },
  infoLeft: {
    flex: 1,
    gap: vs(4),
  },
  infoTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(8),
    flexWrap: 'wrap',
  },
  infoTitle: {
    color: '#FFF',
    fontSize: ms(22),
    fontWeight: '600',
  },
  infoTime: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: ms(14),
  },
  infoRight: {
    alignItems: 'flex-end',
    gap: vs(4),
  },
  infoMeta: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: ms(14),
  },
  viewBookings: {
    color: '#9B5EFA',
    fontSize: ms(12),
    fontWeight: '500',
    marginTop: vs(2),
  },
  publishBtn: {
    marginTop: vs(6),
    backgroundColor: '#7D08FA',
    borderRadius: s(8),
    paddingHorizontal: s(10),
    paddingVertical: vs(4),
    alignSelf: 'flex-start',
  },
  publishBtnText: {
    color: '#FFF',
    fontSize: ms(13),
    fontWeight: '600',
  },
});
