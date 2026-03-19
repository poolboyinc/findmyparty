import { Dimensions } from 'react-native';

// Reference device: iPhone 14 (390 × 844 pt)
const BASE_WIDTH = 390;
const BASE_HEIGHT = 844;

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const widthRatio = SCREEN_WIDTH / BASE_WIDTH;
const heightRatio = SCREEN_HEIGHT / BASE_HEIGHT;

/**
 * Scale a value based on screen width.
 * Use for horizontal padding, margins, icon sizes, border radii, etc.
 */
export function s(size: number): number {
  return Math.round(size * widthRatio);
}

/**
 * Scale a value based on screen height.
 * Use for vertical spacing, button/input heights, image heights.
 */
export function vs(size: number): number {
  return Math.round(size * heightRatio);
}

/**
 * Moderately scale a value — grows/shrinks less aggressively than `s()`.
 * Use for font sizes, icon sizes inside text, and anything that should
 * scale but not too dramatically.
 *
 * @param size   The base size (designed at 390pt width)
 * @param factor How much of the scale to apply (0 = no scale, 1 = full scale). Default 0.25.
 */
export function ms(size: number, factor: number = 0.25): number {
  return Math.round(size + (s(size) - size) * factor);
}
