import { useCallback, useEffect, useMemo, useState } from 'react';
import { partyService } from '@/services/partyService';
import type { HostPartyResponse } from '@/types/parties';
import type { HostPartyStatus } from '@/components/admin/host-party-card';

/** A published or soldout party whose `startsAt` is still in the future. */
function isUpcomingLive(party: HostPartyResponse, now: number): boolean {
  const status = party.status?.toLowerCase();
  const isLive = status === 'published' || status === 'soldout';
  return isLive && new Date(party.startsAt).getTime() > now;
}

/** Maps the backend status string to the card's status union (defaults to published). */
export function toCardStatus(status: string | undefined): HostPartyStatus {
  switch (status?.toLowerCase()) {
    case 'draft':
      return 'draft';
    case 'soldout':
      return 'soldout';
    default:
      return 'published';
  }
}

export type HostDashboard = {
  /** Count of upcoming published/soldout parties. */
  activeCount: number;
  /** Sum of `ticketsSold` across all parties. */
  totalRsvps: number;
  /** Rounded sum of `revenue` across all parties. */
  totalRevenue: number;
  /** Soonest upcoming published/soldout party, or null when none. */
  nextUp: HostPartyResponse | null;
};

export function useHostDashboard() {
  const [parties, setParties] = useState<HostPartyResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const data = await partyService.getMyParties();
    setParties(data);
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  // Single pass over the parties array: the three stats + the next-up pick.
  const dashboard = useMemo<HostDashboard>(() => {
    const now = Date.now();
    let activeCount = 0;
    let totalRsvps = 0;
    let totalRevenue = 0;
    let nextUp: HostPartyResponse | null = null;

    for (const party of parties) {
      totalRsvps += party.ticketsSold ?? 0;
      totalRevenue += party.revenue ?? 0;

      if (isUpcomingLive(party, now)) {
        activeCount += 1;
        if (
          nextUp === null ||
          new Date(party.startsAt).getTime() < new Date(nextUp.startsAt).getTime()
        ) {
          nextUp = party;
        }
      }
    }

    return {
      activeCount,
      totalRsvps,
      totalRevenue: Math.round(totalRevenue),
      nextUp,
    };
  }, [parties]);

  return { loading, refreshing, refresh, dashboard };
}
