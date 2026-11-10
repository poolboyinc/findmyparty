import { LinearTransition, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { springs } from '@/components/afterglow/motion';

const { damping, stiffness, mass } = springs.smooth;

// Cards over the map (the location card, the route card) come up from the bottom edge on
// `springs.smooth` and leave the same way. With Reduce Motion on, Reanimated skips these and the
// card simply appears and disappears.

/** A card arriving. */
export const CARD_ENTER = SlideInDown.springify().damping(damping).stiffness(stiffness).mass(mass);
/** A card leaving. */
export const CARD_EXIT = SlideOutDown.springify().damping(damping).stiffness(stiffness).mass(mass);
/** Whatever sits above a card glides to its new place when the card comes or goes. */
export const GLIDE = LinearTransition.springify().damping(damping).stiffness(stiffness).mass(mass);
