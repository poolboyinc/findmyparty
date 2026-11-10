import { FadeOutDown, LinearTransition } from 'react-native-reanimated';
import { springs } from '@/components/afterglow/motion';

const { damping, stiffness, mass } = springs.smooth;

/** Things below a change glide to their new place on the `smooth` spring instead of jumping. */
export const glide = LinearTransition.springify().damping(damping).stiffness(stiffness).mass(mass);

/** A ticket leaving (its booking was cancelled, or its party ended). */
export const leave = FadeOutDown.springify().damping(damping).stiffness(stiffness).mass(mass);
