import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  StatusBar,
  ActivityIndicator,
  Linking,
  Alert,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { router, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { partyService } from '@/services/partyService';
import { bookingService } from '@/services/bookingService';
import type { PartyDetail } from '@/types/parties';
import { s, vs, ms } from '@/constants/responsive';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function priceTier(price: number): string {
  if (price === 0) return 'Free';
  if (price <= 10) return '$';
  if (price <= 25) return '$$';
  return '$$$';
}

// ─── Liquid Glass button ───────────────────────────────────────────────────────
function GlassButton({
  size = ms(48),
  tint = 'dark',
  children,
  onPress,
  style,
}: {
  size?: number;
  tint?: 'dark' | 'light';
  children: React.ReactNode;
  onPress?: () => void;
  style?: object;
}) {
  return (
    <TouchableOpacity
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.28)',
        },
        style,
      ]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <BlurView
        intensity={Platform.OS === 'ios' ? 60 : 80}
        tint={tint}
        style={StyleSheet.absoluteFill}
      />
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: 'rgba(255,255,255,0.12)' },
        ]}
      />
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {children}
      </View>
    </TouchableOpacity>
  );
}

// ─── Divider ──────────────────────────────────────────────────────────────────
function Divider() {
  return (
    <View
      style={{
        height: 1,
        backgroundColor: 'rgba(255,255,255,0.12)',
        marginHorizontal: s(18),
      }}
    />
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────
export default function PartyDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { height: H } = useWindowDimensions();
  const HERO_HEIGHT = H * 0.42;   // 354/844
  const [party, setParty] = useState<PartyDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [booking, setBooking] = useState(false);

  useEffect(() => {
    if (!id) return;
    partyService.getPartyById(id).then((data) => {
      setParty(data);
      setLoading(false);
    });
  }, [id]);

  if (loading) {
    return (
      <View style={styles.loadingRoot}>
        <ActivityIndicator size="large" color="#7D08FA" />
      </View>
    );
  }

  if (!party) {
    return (
      <View style={styles.loadingRoot}>
        <Text style={styles.errorText}>Party not found</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backFallback}>
          <Text style={styles.backFallbackText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const mapsUrl = `https://maps.google.com/?q=${party.latitude},${party.longitude}`;

  const handleReserve = async () => {
    if (party.isSoldOut || booking) return;
    setBooking(true);
    try {
      const bookingId = await bookingService.createBooking(party.id, 1);
      if (bookingId) {
        Alert.alert('You\'re in!', 'Your spot has been reserved. Check your bookings for details.');
      } else {
        Alert.alert('Could not reserve', 'Something went wrong. Please try again.');
      }
    } catch {
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setBooking(false);
    }
  };

  const handleImagePress = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your photo library.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      allowsEditing: true,
      aspect: [16, 9],
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (asset.fileSize && asset.fileSize > 10 * 1024 * 1024) {
      Alert.alert('Image too large', 'Please choose an image under 10 MB.');
      return;
    }
    setUploading(true);
    const imageUrl = await partyService.uploadPartyImage(party.id, result.assets[0].uri);
    setUploading(false);
    if (imageUrl) {
      setParty((p) => (p ? { ...p, imageUrl } : p));
    } else {
      Alert.alert('Upload failed', 'Could not upload image. Make sure you are the host of this party.');
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <ScrollView showsVerticalScrollIndicator={false} bounces={false}>

        {/* ── Hero ── */}
        <TouchableOpacity
          style={[styles.heroWrapper, { height: HERO_HEIGHT }]}
          activeOpacity={0.9}
          onPress={handleImagePress}
        >
          {party.imageUrl ? (
            <Image
              source={{ uri: party.imageUrl }}
              style={[styles.heroImage, { height: HERO_HEIGHT }]}
              resizeMode="cover"
            />
          ) : (
            <LinearGradient
              colors={['#1a0030', '#3D0880', '#7D08FA']}
              style={[styles.heroImage, { height: HERO_HEIGHT }]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
          )}

          {/* Upload states */}
          {uploading && (
            <View style={styles.uploadOverlay}>
              <ActivityIndicator size="large" color="#FFF" />
              <Text style={styles.uploadText}>Uploading...</Text>
            </View>
          )}
          {!party.imageUrl && !uploading && (
            <View style={styles.uploadHint}>
              <Ionicons name="camera" size={ms(28)} color="rgba(255,255,255,0.7)" />
              <Text style={styles.uploadHintText}>Tap to add image</Text>
            </View>
          )}

          {/* Gradient fade to black */}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.55)', '#000']}
            style={styles.heroFade}
            pointerEvents="none"
          />

          {/* Back button — liquid glass */}
          <GlassButton
            size={44}
            style={{ position: 'absolute', left: s(16), top: insets.top + vs(12) }}
            onPress={() => router.back()}
          >
            <Ionicons name="chevron-back" size={ms(22)} color="#FFF" />
          </GlassButton>

          {/* Heart + Share — liquid glass */}
          <View style={[styles.actionRow, { top: insets.top + vs(12) }]}>
            <GlassButton size={48}>
              <Ionicons name="heart-outline" size={ms(22)} color="#FFF" />
            </GlassButton>
            <GlassButton size={48}>
              <Ionicons name="share-outline" size={ms(22)} color="#FFF" />
            </GlassButton>
          </View>

          {/* Club name + rating */}
          <View style={styles.heroOverlay} pointerEvents="none">
            <Text style={styles.clubName}>{party.title}</Text>
            <LinearGradient
              colors={['#7D08FA', '#FF6E00']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.ratingBadge}
            >
              <Text style={styles.ratingText}>
                {party.isSoldOut ? 'Sold Out' : `${priceTier(party.price)}`}
              </Text>
            </LinearGradient>
          </View>
        </TouchableOpacity>

        {/* ── Glass info card ── */}
        <View style={styles.infoCard}>
          {/* Date & time */}
          <View style={styles.infoRow}>
            <Ionicons name="calendar-outline" size={ms(26)} color="#FFF" />
            <Text style={styles.infoText}>{formatDate(party.startsAt)}</Text>
            <Text style={styles.infoSep}>{'  |  '}</Text>
            <Text style={styles.infoTextBold}>
              {formatTime(party.startsAt)} – {formatTime(party.endsAt)}
            </Text>
          </View>

          <Divider />

          {/* Location */}
          <View style={styles.infoRow}>
            <Ionicons name="location-outline" size={ms(26)} color="#FFF" />
            <Text style={[styles.infoText, { flex: 1 }]} numberOfLines={1}>
              {party.latitude.toFixed(3)}, {party.longitude.toFixed(3)}
            </Text>
            <TouchableOpacity onPress={() => Linking.openURL(mapsUrl)}>
              <Text style={styles.openMaps}>Open in maps</Text>
            </TouchableOpacity>
          </View>

          <Divider />

          {/* Price */}
          <View style={styles.infoRow}>
            <Ionicons name="cash-outline" size={ms(26)} color="rgba(255,255,255,0.4)" />
            <Text style={styles.priceGray}>{priceTier(party.price)}</Text>
            {party.price > 0 && (
              <Text style={styles.infoText}>
                {' – '}Entrance €{party.price.toFixed(0)}
              </Text>
            )}
          </View>
        </View>

        {/* Description */}
        {!!party.description && (
          <View style={styles.descBlock}>
            <Text style={styles.descText}>{party.description}</Text>
          </View>
        )}

        {/* ── Reserve / Tickets — liquid glass purple ── */}
        <TouchableOpacity
          style={[styles.reserveBtn, (party.isSoldOut || booking) && { opacity: 0.5 }]}
          activeOpacity={0.85}
          onPress={handleReserve}
          disabled={party.isSoldOut || booking}
        >
          <BlurView
            intensity={Platform.OS === 'ios' ? 40 : 60}
            tint="dark"
            style={StyleSheet.absoluteFill}
          />
          <View style={[StyleSheet.absoluteFill, styles.reserveOverlay]} />
          {booking ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.reserveText}>
              {party.isSoldOut ? 'Sold Out' : 'Reserve / Tickets'}
            </Text>
          )}
        </TouchableOpacity>

        {/* ── Other Dates — liquid glass white ── */}
        <TouchableOpacity style={styles.otherDatesBtn} activeOpacity={0.85}>
          <BlurView
            intensity={Platform.OS === 'ios' ? 30 : 50}
            tint="light"
            style={StyleSheet.absoluteFill}
          />
          <View style={[StyleSheet.absoluteFill, styles.otherDatesOverlay]} />
          <Text style={styles.otherDatesText}>Other Dates</Text>
        </TouchableOpacity>

        <View style={{ height: insets.bottom + vs(24) }} />
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
  loadingRoot: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    gap: vs(16),
  },
  errorText: {
    color: '#FFF',
    fontSize: ms(16),
  },
  backFallback: {
    paddingHorizontal: s(24),
    paddingVertical: vs(12),
    backgroundColor: '#7D08FA',
    borderRadius: s(30),
  },
  backFallbackText: {
    color: '#FFF',
    fontWeight: '700',
  },

  // ── Hero ──
  heroWrapper: {
    // height applied inline from useWindowDimensions
    overflow: 'hidden',
    borderBottomLeftRadius: s(6),
    borderBottomRightRadius: s(6),
  },
  heroImage: {
    width: '100%',
    // height applied inline from useWindowDimensions
  },
  uploadOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: vs(12),
  },
  uploadText: {
    color: '#FFF',
    fontSize: ms(16),
    fontWeight: '600',
  },
  uploadHint: {
    position: 'absolute',
    bottom: vs(70),
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: vs(6),
  },
  uploadHintText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: ms(14),
    fontWeight: '500',
  },
  heroFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '45%',  // relative to heroWrapper height
  },
  actionRow: {
    position: 'absolute',
    right: s(16),
    flexDirection: 'row',
    gap: s(8),
  },
  heroOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: vs(32),
    alignItems: 'center',
    gap: vs(10),
  },
  clubName: {
    color: '#FFF',
    fontSize: ms(36),
    fontWeight: '800',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
    paddingHorizontal: s(16),
  },
  ratingBadge: {
    height: vs(28),
    paddingHorizontal: s(16),
    borderRadius: s(30),
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.32)',
  },
  ratingText: {
    color: '#FFF',
    fontSize: ms(14),
    fontWeight: '700',
  },

  // ── Info glass card ──
  infoCard: {
    marginHorizontal: s(10),
    marginTop: vs(14),
    borderRadius: s(34),
    overflow: 'hidden',
    backgroundColor: 'rgba(38,38,38,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(8),
    paddingVertical: vs(16),
    paddingHorizontal: s(18),
    flexWrap: 'wrap',
  },
  infoText: {
    color: '#FFF',
    fontSize: ms(17),
    fontWeight: '400',
  },
  infoTextBold: {
    color: '#FFF',
    fontSize: ms(17),
    fontWeight: '700',
  },
  infoSep: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: ms(17),
  },
  openMaps: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: ms(13),
    textDecorationLine: 'underline',
  },
  priceGray: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: ms(17),
    fontWeight: '500',
  },

  // Description
  descBlock: {
    marginHorizontal: s(14),
    marginTop: vs(16),
  },
  descText: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: ms(15),
    lineHeight: vs(22),
  },

  // ── Reserve / Tickets — liquid glass purple ──
  reserveBtn: {
    marginHorizontal: s(10),
    marginTop: vs(28),
    height: vs(52),
    borderRadius: s(30),
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reserveOverlay: {
    borderRadius: s(30),
    backgroundColor: 'rgba(125,8,250,0.45)',
  },
  reserveText: {
    color: '#FFF',
    fontSize: ms(20),
    fontWeight: '700',
  },

  // ── Other Dates — liquid glass white ──
  otherDatesBtn: {
    marginHorizontal: s(10),
    marginTop: vs(12),
    height: vs(52),
    borderRadius: s(30),
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  otherDatesOverlay: {
    borderRadius: s(30),
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  otherDatesText: {
    color: '#FFF',
    fontSize: ms(20),
    fontWeight: '700',
  },
});
