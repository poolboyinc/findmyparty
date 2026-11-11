import { useCallback, useEffect, useRef, type RefObject } from 'react';
import { LinearTransition, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { springs } from '@/components/afterglow/motion';

const { damping, stiffness, mass } = springs.smooth;

// Cards over the map (the location card, the friends card) come up from the bottom edge on
// `springs.smooth` and leave the same way. With Reduce Motion on, Reanimated skips these and the
// card simply appears and disappears.

/** A card arriving. */
export const CARD_ENTER = SlideInDown.springify().damping(damping).stiffness(stiffness).mass(mass);
/** A card leaving. */
export const CARD_EXIT = SlideOutDown.springify().damping(damping).stiffness(stiffness).mass(mass);
/** Whatever sits above a card glides to its new place when the card comes or goes. */
export const GLIDE = LinearTransition.springify().damping(damping).stiffness(stiffness).mass(mass);

/** How long a just-presented sheet gets to mount before it may be dismissed. */
const PRESENT_SETTLE_MS = 150;

/**
 * Presents a bottom sheet modal while `open` is true and dismisses it when it turns false.
 *
 * @gorhom/bottom-sheet: a dismiss() on a modal that was never presented (or is still mounting)
 * marks it as closing for good, and present() then does nothing. That is why the venue sheet once
 * never opened on the device. So only what is open is dismissed, and a fresh present gets a moment
 * to mount first.
 *
 * Returns `closed`: call it from the sheet's own `onDismiss` (a swipe down), and `closeNow` for a
 * dismiss the screen starts itself (before leaving for another screen).
 */
export function useSheetPresence(sheet: RefObject<BottomSheetModal | null>, open: boolean) {
  const presented = useRef(false);
  const presentedAt = useRef(0);

  useEffect(() => {
    if (open) {
      if (presented.current) return;
      presented.current = true;
      presentedAt.current = Date.now();
      sheet.current?.present();
      return;
    }
    if (!presented.current) return;
    const wait = Math.max(0, PRESENT_SETTLE_MS - (Date.now() - presentedAt.current));
    const timer = setTimeout(() => {
      presented.current = false;
      sheet.current?.dismiss();
    }, wait);
    return () => clearTimeout(timer);
  }, [open, sheet]);

  const closed = useCallback(() => {
    presented.current = false;
  }, []);

  const closeNow = useCallback(() => {
    presented.current = false;
    sheet.current?.dismiss();
  }, [sheet]);

  return { closed, closeNow };
}
