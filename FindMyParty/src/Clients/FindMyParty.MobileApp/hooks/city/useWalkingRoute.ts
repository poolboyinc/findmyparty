import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ApiConstants } from '@/constants/api';
import type { LngLat } from '@/components/city/constants';
import { fetchWalkingRoute, type WalkingRoute } from '@/components/city/directions';
import type { VenueSummary } from '@/types/api';

export type RouteState =
  | { status: 'idle' }
  /** Waiting for the user's position, then for the route. */
  | { status: 'finding'; venue: VenueSummary }
  | { status: 'ready'; venue: VenueSummary; route: WalkingRoute };

/** How an attempt ended, so the screen can say what went wrong. */
export type RouteOutcome =
  | { result: 'ready'; route: WalkingRoute }
  /** The user's position could not be found. */
  | { result: 'no-position' }
  /** The Directions request failed or found no way. */
  | { result: 'failed' }
  /** Ended, or replaced by a newer attempt, before it finished. Say nothing. */
  | { result: 'cancelled' };

/**
 * The walking route to one venue: asks for the user's position, then for the way on foot.
 * A failure puts the state back to idle and is reported through the returned outcome.
 */
export function useWalkingRoute() {
  const [state, setState] = useState<RouteState>({ status: 'idle' });
  /** Counts attempts, so an answer that arrives after "End" or after a newer attempt is dropped. */
  const attempt = useRef(0);
  const abort = useRef<AbortController | null>(null);

  const stop = useCallback(() => {
    attempt.current += 1;
    abort.current?.abort();
    abort.current = null;
  }, []);

  useEffect(() => stop, [stop]);

  const start = useCallback(
    async (venue: VenueSummary, getPosition: () => Promise<LngLat | null>): Promise<RouteOutcome> => {
      stop();
      const mine = attempt.current;
      setState({ status: 'finding', venue });

      const from = await getPosition();
      if (mine !== attempt.current) return { result: 'cancelled' };
      if (!from) {
        setState({ status: 'idle' });
        return { result: 'no-position' };
      }

      const controller = new AbortController();
      abort.current = controller;
      try {
        const route = await fetchWalkingRoute(
          from,
          [venue.longitude, venue.latitude],
          ApiConstants.MapboxPublicToken,
          controller.signal,
        );
        if (mine !== attempt.current) return { result: 'cancelled' };
        setState({ status: 'ready', venue, route });
        return { result: 'ready', route };
      } catch {
        if (mine !== attempt.current) return { result: 'cancelled' };
        setState({ status: 'idle' });
        return { result: 'failed' };
      }
    },
    [stop],
  );

  const end = useCallback(() => {
    stop();
    setState({ status: 'idle' });
  }, [stop]);

  return useMemo(() => ({ state, start, end }), [state, start, end]);
}
