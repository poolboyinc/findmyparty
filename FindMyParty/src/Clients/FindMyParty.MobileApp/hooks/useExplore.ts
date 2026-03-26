import { useState, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { partyService } from '../services/partyService';
import type { PartyMapItem } from '../types/parties';

const CACHE_KEY = 'parties_cache';

export function useExplore() {
  const [parties, setParties] = useState<PartyMapItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Restore cached parties on mount so markers appear instantly
  useEffect(() => {
    AsyncStorage.getItem(CACHE_KEY).then(raw => {
      if (raw) {
        try { setParties(JSON.parse(raw)); } catch {}
      }
    });
  }, []);

  const loadParties = useCallback(async (lat?: number, lng?: number, date?: string) => {
    setLoading(true);
    try {
      const data = await partyService.getParties(lat, lng, date);
      setParties(data);
      // Persist for next app open (fire-and-forget)
      AsyncStorage.setItem(CACHE_KEY, JSON.stringify(data)).catch(() => {});
    } catch {
      setParties([]);
    } finally {
      setLoading(false);
    }
  }, []);

  return { parties, loading, loadParties };
}
