import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ScrollView,
  Switch,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { partyService } from '@/services/partyService';
import type { CreatePartyRequest } from '@/types/parties';

// ─── Venue placeholder — replace with actual profile data later ───────────────
const VENUE_LAT = 44.8046;
const VENUE_LNG = 20.4651;

function combineDateTime(date: Date, time: Date): string {
  const combined = new Date(date);
  combined.setHours(time.getHours(), time.getMinutes(), 0, 0);
  return combined.toISOString();
}

function getEndsAt(date: Date, startTime: Date, endTime: Date): string {
  const end = new Date(date);
  end.setHours(endTime.getHours(), endTime.getMinutes(), 0, 0);
  const start = new Date(date);
  start.setHours(startTime.getHours(), startTime.getMinutes(), 0, 0);
  if (end <= start) end.setDate(end.getDate() + 1);
  return end.toISOString();
}

export default function CreatePartyScreen() {
  const insets = useSafeAreaInsets();

  // ─── Basic info
  const [partyName, setPartyName] = useState('');
  const [performerName, setPerformerName] = useState('');
  const [description, setDescription] = useState('');
  const [genre, setGenre] = useState('');
  const [performerType, setPerformerType] = useState('');
  const [price, setPrice] = useState('');
  const [capacity, setCapacity] = useState('');

  // ─── Date & Time
  const [partyDate, setPartyDate] = useState(new Date());
  const [startTime, setStartTime] = useState(() => {
    const d = new Date(); d.setHours(22, 0, 0, 0); return d;
  });
  const [endTime, setEndTime] = useState(() => {
    const d = new Date(); d.setHours(3, 0, 0, 0); return d;
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  // ─── Images
  const [images, setImages] = useState<(string | null)[]>([null, null]);

  // ─── Featured
  const [featured, setFeatured] = useState(false);

  // ─── Submission
  const [loading, setLoading] = useState(false);

  const formatDate = (d: Date) =>
    d.toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const formatTime = (d: Date) =>
    d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

  const pickImage = async (index: number) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Photo library access is required to upload images.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]) {
      setImages(prev => {
        const next = [...prev];
        next[index] = result.assets[0].uri;
        return next;
      });
    }
  };

  const handleSubmit = async (publish: boolean) => {
    if (!partyName.trim()) {
      Alert.alert('Missing info', 'Party name is required.');
      return;
    }
    if (!price.trim() || isNaN(parseFloat(price))) {
      Alert.alert('Missing info', 'Please enter a valid price.');
      return;
    }
    if (!capacity.trim() || isNaN(parseInt(capacity))) {
      Alert.alert('Missing info', 'Please enter a valid capacity.');
      return;
    }

    setLoading(true);
    try {
      const title = performerName.trim()
        ? `${partyName.trim()} – ${performerName.trim()}`
        : partyName.trim();

      const desc = [
        description.trim(),
        genre.trim() ? `Genre: ${genre.trim()}` : '',
        performerType.trim() ? `Performer: ${performerType.trim()}` : '',
      ].filter(Boolean).join('\n');

      const request: CreatePartyRequest = {
        title,
        description: desc,
        price: parseFloat(price),
        capacity: parseInt(capacity),
        startsAt: combineDateTime(partyDate, startTime),
        endsAt: getEndsAt(partyDate, startTime, endTime),
        latitude: VENUE_LAT,
        longitude: VENUE_LNG,
      };

      const partyId = await partyService.createParty(request);
      if (!partyId) {
        Alert.alert('Error', 'Failed to create party. Please try again.');
        return;
      }

      // Upload any selected images
      const selectedImages = images.filter(Boolean) as string[];
      await Promise.all(
        selectedImages.map(uri => partyService.uploadPartyImage(partyId, uri))
      );

      if (publish) {
        await partyService.publishParty(partyId);
        Alert.alert('Posted!', 'Your party is now live on the map.', [
          { text: 'OK', onPress: () => router.back() },
        ]);
      } else {
        Alert.alert('Saved', 'Party saved to drafts.', [
          { text: 'OK', onPress: () => router.back() },
        ]);
      }
    } catch {
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

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
        <Text style={styles.headerTitle}>Create party</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ─── Section 1: Basic Information ─── */}
        <Text style={styles.sectionTitle}>Basic information</Text>

        <BlurView intensity={10} tint="dark" style={styles.inputBox}>
          <TextInput
            style={styles.inputText}
            placeholder="Party Name"
            placeholderTextColor="rgba(255,255,255,0.5)"
            value={partyName}
            onChangeText={setPartyName}
          />
        </BlurView>

        <BlurView intensity={10} tint="dark" style={styles.inputBox}>
          <TextInput
            style={styles.inputText}
            placeholder="Performer Name"
            placeholderTextColor="rgba(255,255,255,0.5)"
            value={performerName}
            onChangeText={setPerformerName}
          />
        </BlurView>

        <BlurView intensity={10} tint="dark" style={[styles.inputBox, styles.textareaBox]}>
          <TextInput
            style={[styles.inputText, styles.textareaText]}
            placeholder="Description"
            placeholderTextColor="rgba(255,255,255,0.5)"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </BlurView>

        <View style={styles.row}>
          <BlurView intensity={10} tint="dark" style={[styles.inputBox, styles.halfBox]}>
            <TextInput
              style={styles.inputText}
              placeholder="Price (€)"
              placeholderTextColor="rgba(255,255,255,0.5)"
              value={price}
              onChangeText={setPrice}
              keyboardType="decimal-pad"
            />
          </BlurView>
          <BlurView intensity={10} tint="dark" style={[styles.inputBox, styles.halfBox]}>
            <TextInput
              style={styles.inputText}
              placeholder="Capacity"
              placeholderTextColor="rgba(255,255,255,0.5)"
              value={capacity}
              onChangeText={setCapacity}
              keyboardType="number-pad"
            />
          </BlurView>
        </View>

        <View style={styles.row}>
          <BlurView intensity={10} tint="dark" style={[styles.inputBox, styles.halfBox]}>
            <TextInput
              style={styles.inputText}
              placeholder="Music Genre"
              placeholderTextColor="rgba(255,255,255,0.5)"
              value={genre}
              onChangeText={setGenre}
            />
          </BlurView>
          <BlurView intensity={10} tint="dark" style={[styles.inputBox, styles.halfBox]}>
            <TextInput
              style={styles.inputText}
              placeholder="Performer Type"
              placeholderTextColor="rgba(255,255,255,0.5)"
              value={performerType}
              onChangeText={setPerformerType}
            />
          </BlurView>
        </View>

        {/* ─── Section 2: Date & Time ─── */}
        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Date &amp; Time</Text>

        <Text style={styles.fieldLabel}>Party Date</Text>
        <TouchableOpacity onPress={() => setShowDatePicker(true)} activeOpacity={0.85}>
          <BlurView intensity={10} tint="dark" style={styles.inputBox}>
            <View style={styles.rowSpaced}>
              <Text style={styles.inputText}>{formatDate(partyDate)}</Text>
              <Ionicons name="calendar-outline" size={26} color="rgba(255,255,255,0.7)" />
            </View>
          </BlurView>
        </TouchableOpacity>
        {showDatePicker && (
          <DateTimePicker
            value={partyDate}
            mode="date"
            display={Platform.OS === 'ios' ? 'inline' : 'default'}
            minimumDate={new Date()}
            onChange={(_, date) => {
              setShowDatePicker(false);
              if (date) setPartyDate(date);
            }}
            themeVariant="dark"
            accentColor="#7D08FA"
          />
        )}

        <View style={styles.row}>
          <View style={styles.halfCol}>
            <Text style={styles.fieldLabel}>Start Time</Text>
            <TouchableOpacity onPress={() => setShowStartPicker(true)} activeOpacity={0.85}>
              <BlurView intensity={10} tint="dark" style={styles.inputBox}>
                <View style={styles.rowSpaced}>
                  <Text style={styles.inputText}>{formatTime(startTime)}</Text>
                  <Ionicons name="time-outline" size={26} color="rgba(255,255,255,0.7)" />
                </View>
              </BlurView>
            </TouchableOpacity>
          </View>
          <View style={styles.halfCol}>
            <Text style={styles.fieldLabel}>End Time</Text>
            <TouchableOpacity onPress={() => setShowEndPicker(true)} activeOpacity={0.85}>
              <BlurView intensity={10} tint="dark" style={styles.inputBox}>
                <View style={styles.rowSpaced}>
                  <Text style={styles.inputText}>{formatTime(endTime)}</Text>
                  <Ionicons name="time-outline" size={26} color="rgba(255,255,255,0.7)" />
                </View>
              </BlurView>
            </TouchableOpacity>
          </View>
        </View>
        {showStartPicker && (
          <DateTimePicker
            value={startTime}
            mode="time"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={(_, t) => {
              setShowStartPicker(false);
              if (t) setStartTime(t);
            }}
            themeVariant="dark"
            accentColor="#7D08FA"
          />
        )}
        {showEndPicker && (
          <DateTimePicker
            value={endTime}
            mode="time"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={(_, t) => {
              setShowEndPicker(false);
              if (t) setEndTime(t);
            }}
            themeVariant="dark"
            accentColor="#7D08FA"
          />
        )}

        {/* ─── Section 3: Party Images ─── */}
        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Party Images</Text>
        <View style={styles.row}>
          {[0, 1].map(i => (
            <TouchableOpacity key={i} onPress={() => pickImage(i)} activeOpacity={0.8} style={styles.halfCol}>
              <BlurView intensity={10} tint="dark" style={styles.imageBox}>
                {images[i] ? (
                  // eslint-disable-next-line @typescript-eslint/no-require-imports
                  <View style={styles.imagePreview}>
                    <Ionicons name="checkmark-circle" size={36} color="#7D08FA" />
                    <Text style={styles.imagePreviewText}>Image {i + 1}</Text>
                  </View>
                ) : (
                  <Ionicons name="image-outline" size={40} color="rgba(255,255,255,0.5)" />
                )}
              </BlurView>
            </TouchableOpacity>
          ))}
        </View>

        {/* ─── Section 4: Featured Party ─── */}
        <View style={[styles.featuredRow, { marginTop: 24 }]}>
          <View style={styles.featuredLeft}>
            <View style={styles.featuredTitleRow}>
              <Text style={styles.sectionTitle}>Featured Party</Text>
              <Ionicons name="information-circle-outline" size={22} color="rgba(255,255,255,0.7)" style={{ marginLeft: 8 }} />
            </View>
            <Text style={styles.featuredDesc}>
              Featured parties appear at the top of search results
            </Text>
          </View>
          <Switch
            value={featured}
            onValueChange={setFeatured}
            trackColor={{ false: '#3e3e3e', true: '#7E0AFA' }}
            thumbColor="#FFF"
            ios_backgroundColor="#3e3e3e"
          />
        </View>

        {/* ─── Buttons ─── */}
        <View style={styles.buttonsArea}>
          {/* Save to Drafts */}
          <TouchableOpacity
            activeOpacity={0.82}
            onPress={() => handleSubmit(false)}
            disabled={loading}
            style={styles.actionBtnWrapper}
          >
            <BlurView intensity={14} tint="light" style={styles.btnBlur}>
              <LinearGradient
                colors={['#7E0AFA', '#390075']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.actionBtnGradient}
              >
                {loading ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.actionBtnText}>Save To Drafts</Text>
                )}
              </LinearGradient>
            </BlurView>
          </TouchableOpacity>

          {/* Post */}
          <TouchableOpacity
            activeOpacity={0.82}
            onPress={() => handleSubmit(true)}
            disabled={loading}
            style={styles.actionBtnWrapper}
          >
            <BlurView intensity={14} tint="light" style={styles.btnBlur}>
              <LinearGradient
                colors={['#7E0AFA', '#FF6E00']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.actionBtnGradient}
              >
                {loading ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.actionBtnText}>Post</Text>
                )}
              </LinearGradient>
            </BlurView>
          </TouchableOpacity>
        </View>
      </ScrollView>
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
    marginRight: 44, // balance back button
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  sectionTitle: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 4,
    marginTop: 8,
  },
  fieldLabel: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 13,
    fontWeight: '400',
    marginBottom: 4,
    marginLeft: 4,
  },
  inputBox: {
    borderRadius: 15,
    overflow: 'hidden',
    backgroundColor: 'rgba(43,43,43,0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    height: 55,
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  inputText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '400',
  },
  textareaBox: {
    height: 92,
    justifyContent: 'flex-start',
    paddingVertical: 12,
  },
  textareaText: {
    height: 68,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  halfBox: {
    flex: 1,
  },
  halfCol: {
    flex: 1,
    gap: 4,
  },
  rowSpaced: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  imageBox: {
    height: 122,
    borderRadius: 15,
    overflow: 'hidden',
    backgroundColor: 'rgba(43,43,43,0.85)',
    borderWidth: 1,
    borderColor: 'rgba(177,177,177,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imagePreview: {
    alignItems: 'center',
    gap: 6,
  },
  imagePreviewText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '500',
  },
  featuredRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  featuredLeft: {
    flex: 1,
    gap: 4,
  },
  featuredTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  featuredDesc: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
  },
  buttonsArea: {
    gap: 12,
    marginTop: 24,
    alignItems: 'center',
  },
  actionBtnWrapper: {
    width: 331,
    height: 50,
    borderRadius: 48,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  btnBlur: { flex: 1 },
  actionBtnGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnText: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: '700',
  },
});
