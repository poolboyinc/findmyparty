import { useState, useCallback } from 'react';
import { partyService } from '../services/partyService';
import type { PartyMapItem } from '../types/parties';

export function useExplore() {
  const [parties, setParties] = useState<PartyMapItem[]>([]);
  const [loading, setLoading] = useState(false);

  const loadParties = useCallback(async (lat: number, lng: number) => {
    setLoading(true);
    try {
      const data = await partyService.getParties(lat, lng);
      setParties(data);
    } catch {
      setParties([]);
    } finally {
      setLoading(false);
    }
  }, []);

  return { parties, loading, loadParties };
}
