import { useCallback, useRef, useState } from 'react';
import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import type { HostParty } from '@/types/api';
import { checkDraft, draftFromParty, type DraftErrors, type PartyDraft } from './party-input';

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

/** Which error a field's change clears. Times and the line-up share one: the set times depend on the hours. */
const CLEARS: Partial<Record<keyof PartyDraft, keyof DraftErrors>> = {
  title: 'title',
  price: 'price',
  capacity: 'capacity',
  holdMinutes: 'holdMinutes',
  acts: 'acts',
  day: 'acts',
  start: 'acts',
  end: 'acts',
};

/**
 * The create and edit form's state: the draft, its errors, and the cover image. The screen owns the
 * submit; it calls `validate()` and then sends `toPartyInput(form.draft, place)`.
 */
export function usePartyForm(party: HostParty | null, existingImageUrl: string | null = null) {
  const counter = useRef(0);
  const newKey = useCallback(() => `act-${++counter.current}`, []);
  const [draft, setDraft] = useState<PartyDraft>(() => draftFromParty(party, newKey, new Date()));
  const [errors, setErrors] = useState<DraftErrors>({});
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageNotice, setImageNotice] = useState<string | null>(null);

  const set = useCallback(<K extends keyof PartyDraft>(field: K, value: PartyDraft[K]) => {
    setDraft((prev) => ({ ...prev, [field]: value }));
    const cleared = CLEARS[field];
    if (cleared) setErrors((prev) => (prev[cleared] ? { ...prev, [cleared]: undefined } : prev));
  }, []);

  /** Checks everything and shows what is wrong. True when the draft can be sent. */
  const validate = (): boolean => {
    const found = checkDraft(draft);
    setErrors(found);
    return Object.values(found).every((message) => !message);
  };

  /** A 16:9 cover from the photo library, 10 MB at most. */
  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Photos are off', 'Allow FindMyParty to use your photos in Settings to add a cover.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.85,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    if (asset.fileSize && asset.fileSize > MAX_IMAGE_BYTES) {
      setImageNotice('That image is over 10 MB. Choose a smaller one.');
      return;
    }
    setImageNotice(null);
    setImageUri(asset.uri);
  };

  return {
    draft,
    set,
    errors,
    validate,
    newKey,
    /** A new local cover picked this session, to upload after saving. */
    imageUri,
    existingImageUrl,
    imageNotice,
    setImageNotice,
    pickImage,
  };
}

export type PartyForm = ReturnType<typeof usePartyForm>;
