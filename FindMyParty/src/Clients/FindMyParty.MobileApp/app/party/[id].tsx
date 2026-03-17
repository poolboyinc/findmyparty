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
  Dimensions,
  Linking,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { partyService } from '@/services/partyService';
import type { PartyDetail } from '@/types/parties';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const HERO_HEIGHT = 354;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
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

function formatPrice(price: number): string {
  if (price === 0) return 'Free entry';
  if (price <= 10) return `€  ·  Entrance €${price.toFixed(0)}`;
  if (price <= 25) return `€€  ·  Entrance €${price.toFixed(0)}`;
  return `€€€  ·  Entrance €${price.toFixed(0)}`;
}

// ─── Glass info row ────────────────────────────────────────────────────────────
function InfoRow({
  icon,
  children,
  showDivider = true,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  showDivider?: boolean;
}) {
  return (
    <>
      <View style={infoStyles.row}>
        {icon}
        <View style={infoStyles.rowContent}>{children}</View>
      </View>
      {showDivider && <View style={infoStyles.divider} />}
    </>
  );
}

const infoStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 18,
  },
  rowContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginHorizontal: 18,
  },
});

// ─── Main Screen ─────────────────────────────────────────────────────────────
export default function PartyDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const [party, setParty] = useState<PartyDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

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

    setUploading(true);
    const imageUrl = await partyService.uploadPartyImage(party.id, result.assets[0].uri);
    setUploading(false);

    if (imageUrl) {
      setParty((p) => p ? { ...p, imageUrl } : p);
    } else {
      Alert.alert('Upload failed', 'Could not upload image. Make sure you are the host of this party.');
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
        {/* ── Hero image ── */}
        <TouchableOpacity style={styles.heroWrapper} activeOpacity={0.9} onPress={handleImagePress}>
          {party.imageUrl ? (
            <Image
              source={{ uri: party.imageUrl }}
              style={styles.heroImage}
              resizeMode="cover"
            />
          ) : (
            <LinearGradient
              colors={['#1a0030', '#3D0880', '#7D08FA']}
              style={styles.heroImage}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
          )}
          {/* Upload overlay */}
          {uploading && (
            <View style={styles.uploadOverlay}>
              <ActivityIndicator size="large" color="#FFF" />
              <Text style={styles.uploadText}>Uploading...</Text>
            </View>
          )}
          {!party.imageUrl && !uploading && (
            <View style={styles.uploadHint}>
              <Ionicons name="camera" size={28} color="rgba(255,255,255,0.7)" />
              <Text style={styles.uploadHintText}>Tap to add image</Text>
            </View>
          )}
          {/* Fade to black at bottom */}
          <LinearGradient
            colors={['transparent', '#000']}
            style={styles.heroFade}
            pointerEvents="none"
          />

          {/* Back button top-left */}
          <TouchableOpacity
            style={[styles.backBtn, { top: insets.top + 12 }]}
            onPress={() => router.back()}
            activeOpacity={0.8}
          >
            <Ionicons name="chevron-back" size={22} color="#FFF" />
          </TouchableOpacity>

          {/* Heart + Share top-right */}
          <View style={[styles.actionBtns, { top: insets.top + 12 }]}>
            <TouchableOpacity style={styles.glassBtn} activeOpacity={0.8}>
              <Ionicons name="heart-outline" size={22} color="#FFF" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.glassBtn} activeOpacity={0.8}>
              <Ionicons name="share-outline" size={22} color="#FFF" />
            </TouchableOpacity>
          </View>

          {/* Club name + rating over image */}
          <View style={styles.heroOverlay} pointerEvents="none">
            <Text style={styles.clubName}>{party.title}</Text>
            <LinearGradient
              colors={['#7D08FA', '#FF6E00']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.ratingBadge}
            >
              <Text style={styles.ratingText}>
                {party.isSoldOut ? 'Sold Out' : `€${party.price.toFixed(0)}`}
              </Text>
            </LinearGradient>
          </View>
        </TouchableOpacity>

        {/* ── Info glass card ── */}
        <View style={styles.infoCard}>
          {/* Date & time */}
          <InfoRow
            icon={<Ionicons name="calendar-outline" size={24} color="#FFF" />}
          >
            <Text style={styles.infoText}>
              {formatDate(party.startsAt)}
            </Text>
            <Text style={styles.infoSep}>|</Text>
            <Text style={styles.infoTextBold}>
              {formatTime(party.startsAt)} – {formatTime(party.endsAt)}
            </Text>
          </InfoRow>

          {/* Location */}
          <InfoRow
            icon={<Ionicons name="location-outline" size={24} color="#FFF" />}
          >
            <Text style={styles.infoText} numberOfLines={1}>
              {party.latitude.toFixed(4)}, {party.longitude.toFixed(4)}
            </Text>
            <TouchableOpacity onPress={() => Linking.openURL(mapsUrl)}>
              <Text style={styles.openMaps}>Open in maps</Text>
            </TouchableOpacity>
          </InfoRow>

          {/* Price */}
          <InfoRow
            icon={<Ionicons name="cash-outline" size={24} color="rgba(255,255,255,0.4)" />}
            showDivider={false}
          >
            <Text style={styles.priceText}>{formatPrice(party.price)}</Text>
          </InfoRow>
        </View>

        {/* Description */}
        {party.description ? (
          <View style={styles.descBlock}>
            <Text style={styles.descText}>{party.description}</Text>
          </View>
        ) : null}

        {/* ── Reserve button ── */}
        <TouchableOpacity style={styles.reserveBtn} activeOpacity={0.85}>
          <LinearGradient
            colors={['rgba(125,8,250,0.6)', 'rgba(125,8,250,0.3)']}
            style={styles.reserveGradient}
          >
            <Text style={styles.reserveText}>Reserve / Tickets</Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* ── Other dates button ── */}
        <TouchableOpacity style={styles.otherDatesBtn} activeOpacity={0.85}>
          <Text style={styles.otherDatesText}>Other Dates</Text>
        </TouchableOpacity>

        <View style={{ height: insets.bottom + 24 }} />
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
    gap: 16,
  },
  errorText: {
    color: '#FFF',
    fontSize: 16,
  },
  backFallback: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#7D08FA',
    borderRadius: 30,
  },
  backFallbackText: {
    color: '#FFF',
    fontWeight: '700',
  },
  // Hero
  heroWrapper: {
    height: HERO_HEIGHT,
    position: 'relative',
    overflow: 'hidden',
  },
  uploadOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  uploadText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  uploadHint: {
    position: 'absolute',
    bottom: 60,
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: 6,
  },
  uploadHintText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    fontWeight: '500',
  },
  heroImage: {
    width: SCREEN_WIDTH,
    height: HERO_HEIGHT,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
  },
  heroFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 130,
  },
  backBtn: {
    position: 'absolute',
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtns: {
    position: 'absolute',
    right: 16,
    flexDirection: 'row',
    gap: 8,
  },
  glassBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 28,
    alignItems: 'center',
    gap: 10,
  },
  clubName: {
    color: '#FFF',
    fontSize: 34,
    fontWeight: '800',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  ratingBadge: {
    height: 28,
    paddingHorizontal: 16,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.32)',
  },
  ratingText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  // Info card
  infoCard: {
    marginHorizontal: 10,
    marginTop: 12,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
  },
  infoText: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '400',
  },
  infoTextBold: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '700',
  },
  infoSep: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 17,
  },
  openMaps: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 13,
    textDecorationLine: 'underline',
  },
  priceText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 17,
  },
  // Description
  descBlock: {
    marginHorizontal: 14,
    marginTop: 16,
  },
  descText: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 15,
    lineHeight: 22,
  },
  // Buttons
  reserveBtn: {
    marginHorizontal: 10,
    marginTop: 24,
    height: 52,
    borderRadius: 30,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  reserveGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reserveText: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '700',
  },
  otherDatesBtn: {
    marginHorizontal: 10,
    marginTop: 12,
    height: 52,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  otherDatesText: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '700',
  },
});
