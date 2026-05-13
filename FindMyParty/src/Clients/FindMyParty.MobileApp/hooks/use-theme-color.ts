/**
 * Dark-mode-first color lookup. Maintained as a thin pass-through for
 * scaffolding components (ThemedText, ThemedView, ParallaxScrollView).
 * The `light` argument is accepted for source-compat but ignored — per
 * CLAUDE.md the app has no light-mode designs.
 */

import { colors } from '@/theme';

const DARK_COLORS = {
  text: colors.label,
  background: colors.bg,
  tint: colors.tint,
  icon: colors.labelSecondary,
  tabIconDefault: colors.labelSecondary,
  tabIconSelected: colors.tint,
} as const;

export function useThemeColor(
  props: { light?: string; dark?: string },
  colorName: keyof typeof DARK_COLORS,
): string {
  return props.dark ?? DARK_COLORS[colorName];
}
