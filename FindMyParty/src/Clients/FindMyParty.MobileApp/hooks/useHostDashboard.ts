import { useCallback, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { keys, useHostParties } from '@/hooks/queries';
import type { HostParty } from '@/types/api';
import type { HostPartyStatus } from '@/components/admin/host-party-card';

/** Maps the server's status to the card's status. An unknown value reads as published. */
export function toCardStatus(status: string | undefined): HostPartyStatus {
  switch (status?.toLowerCase()) {
    case 'draft':
      return 'draft';
    case 'soldout':
      return 'soldout';
    case 'cancelled':
      return 'cancelled';
    default:
      return 'published';
  }
}

/**
 * The host's parties for the Parties tab. Reads the same cached list as the Live tab and the
 * scanner (`useHostParties`), so a party published or removed here shows there at once.
 *
 * `error` is set only when there is nothing to show: a failed first load, never an empty list.
 */
export function useHostDashboard() {
  const client = useQueryClient();
  const { data, error, isPending, refetch } = useHostParties();
  const [refreshing, setRefreshing] = useState(false);

  // A missing ticketsSold/revenue would surface as "NaN" in the cards.
  const parties = useMemo<HostParty[]>(
    () => (data ?? []).map((p) => ({ ...p, ticketsSold: Number(p.ticketsSold) || 0, revenue: Number(p.revenue) || 0 })),
    [data],
  );

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  // Local removal after delete/cancel, so the card goes at once without waiting for a refetch.
  const removeParty = useCallback(
    (partyId: string) => {
      client.setQueryData<HostParty[]>(keys.hostParties, (prev) => prev?.filter((p) => p.id !== partyId));
    },
    [client],
  );

  return { loading: isPending, error: data ? null : error, refreshing, refresh, parties, removeParty };
}
