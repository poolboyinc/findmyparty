import { Platform, StyleSheet, TextStyle } from 'react-native';

// ─────────────────────────────────────────────────────────────────────────────
// Brand
// Hero-only — these belong on the splash and as accents, never as full-bleed
// chrome on functional screens.
// ─────────────────────────────────────────────────────────────────────────────

export const BRAND_PURPLE = '#7D08FA';
export const BRAND_ORANGE = '#FF8C48';

export const BRAND_GRADIENT = {
  colors: ['#7D08FA', '#B03070', '#C84B00', '#FF8C48'] as const,
  locations: [0, 0.38, 0.65, 1] as const,
};

// Lifted purple — pure #7D08FA reads too dark against #0A0A0C surfaces.
// Use this for buttons, links, focus rings on dark backgrounds.
const BRAND_PURPLE_LIFTED = '#9D4EFF';

// ─────────────────────────────────────────────────────────────────────────────
// Colors — dark-mode-first, semantic tokens modeled on iOS UIKit colors.
// Label tier opacities follow Apple's dark-mode UIColor specs.
// ─────────────────────────────────────────────────────────────────────────────

export const colors = {
  bg: '#0A0A0C',
  surface: '#16161A',
  surfaceElevated: '#1F1F24',
  surfaceHigh: '#2A2A30',

  label: '#FFFFFF',
  labelSecondary: 'rgba(235,235,245,0.60)',
  labelTertiary: 'rgba(235,235,245,0.30)',
  labelQuaternary: 'rgba(235,235,245,0.16)',

  separator: 'rgba(84,84,88,0.65)',
  separatorOpaque: '#38383A',
  hairline: 'rgba(255,255,255,0.08)',

  fill: 'rgba(120,120,128,0.36)',
  fillSecondary: 'rgba(120,120,128,0.32)',
  fillTertiary: 'rgba(118,118,128,0.24)',
  fillQuaternary: 'rgba(118,118,128,0.18)',

  tint: BRAND_PURPLE_LIFTED,
  tintPressed: '#7D2DDB',
  tintDisabled: 'rgba(157,78,255,0.30)',

  brand: BRAND_PURPLE,
  brandLight: BRAND_PURPLE_LIFTED,
  brandOrange: BRAND_ORANGE,

  // iOS dark-mode system colors
  red: '#FF453A',
  orange: '#FF9F0A',
  yellow: '#FFD60A',
  green: '#30D158',
  mint: '#66D4CF',
  teal: '#6AC4DC',
  cyan: '#5AC8F5',
  blue: '#0A84FF',
  indigo: '#5E5CE6',
  purple: '#BF5AF2',
  pink: '#FF375F',
  brown: '#AC8E68',
  gray: '#8E8E93',

  success: '#30D158',
  danger: '#FF453A',
  warning: '#FF9F0A',
  info: '#0A84FF',

  overlay: 'rgba(0,0,0,0.5)',
  scrim: 'rgba(0,0,0,0.7)',
  shadow: '#000000',
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Typography — Apple Dynamic Type scale (iOS 17/18 default sizes).
// Sizes, line heights, and tracking match the official SF Pro spec.
// `headline` is intentionally Semibold; everything else defaults to Regular
// so consumers can opt into Bold/Heavy where the hierarchy calls for it.
// ─────────────────────────────────────────────────────────────────────────────

const fontFamily = Platform.select({
  ios: 'System',
  android: 'sans-serif',
  default: 'System',
}) as string;

type Type = TextStyle;

export const typography = {
  largeTitle: {
    fontFamily,
    fontSize: 34,
    lineHeight: 41,
    fontWeight: '400',
    letterSpacing: 0.37,
  } satisfies Type,
  title1: {
    fontFamily,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '400',
    letterSpacing: 0.36,
  } satisfies Type,
  title2: {
    fontFamily,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '400',
    letterSpacing: 0.35,
  } satisfies Type,
  title3: {
    fontFamily,
    fontSize: 20,
    lineHeight: 25,
    fontWeight: '400',
    letterSpacing: 0.38,
  } satisfies Type,
  headline: {
    fontFamily,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '600',
    letterSpacing: -0.41,
  } satisfies Type,
  body: {
    fontFamily,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '400',
    letterSpacing: -0.41,
  } satisfies Type,
  bodyEmphasized: {
    fontFamily,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '600',
    letterSpacing: -0.41,
  } satisfies Type,
  callout: {
    fontFamily,
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '400',
    letterSpacing: -0.32,
  } satisfies Type,
  subheadline: {
    fontFamily,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '400',
    letterSpacing: -0.24,
  } satisfies Type,
  footnote: {
    fontFamily,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '400',
    letterSpacing: -0.08,
  } satisfies Type,
  caption1: {
    fontFamily,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400',
    letterSpacing: 0,
  } satisfies Type,
  caption2: {
    fontFamily,
    fontSize: 11,
    lineHeight: 13,
    fontWeight: '400',
    letterSpacing: 0.07,
  } satisfies Type,
} as const;

// Pair with any typography style:
//   { ...typography.largeTitle, fontWeight: weights.bold }
export const weights = {
  ultralight: '100',
  thin: '200',
  light: '300',
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  heavy: '800',
  black: '900',
} as const satisfies Record<string, TextStyle['fontWeight']>;

// ─────────────────────────────────────────────────────────────────────────────
// Spacing — 4pt grid. Matches Apple's 4/8/16/20 rhythm.
// Values are in points. Pair with `s()`/`vs()` from constants/responsive.ts
// only when device-relative scaling is needed.
// ─────────────────────────────────────────────────────────────────────────────

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 40,
  huge: 48,
  giant: 64,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Radii — iOS continuous-corner conventions.
// 14 is the iOS sheet/card corner; 10 is the standard control corner.
// ─────────────────────────────────────────────────────────────────────────────

export const radii = {
  none: 0,
  xs: 4,
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  xxl: 28,
  card: 16,
  modal: 14,
  button: 14,
  field: 12,
  pill: 9999,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Layout — common iOS dimensions used across navigation, lists, controls.
// ─────────────────────────────────────────────────────────────────────────────

export const layout = {
  screenMargin: 20,
  screenMarginCompact: 16,
  navBarHeight: 44,
  largeTitleHeight: 96,
  tabBarHeight: 49,
  listItemHeight: 44,
  listItemHeightTall: 56,
  buttonHeight: 50,
  fieldHeight: 50,
  fieldHeightTall: 56,
  hitSlop: { top: 8, right: 8, bottom: 8, left: 8 },
  minTouchTarget: 44,
} as const;

export const hairlineWidth = StyleSheet.hairlineWidth;

// ─────────────────────────────────────────────────────────────────────────────
// Theme bundle — pass to a context/provider, or import named tokens directly.
// ─────────────────────────────────────────────────────────────────────────────

export const theme = {
  colors,
  typography,
  weights,
  spacing,
  radii,
  layout,
  hairlineWidth,
  brand: {
    purple: BRAND_PURPLE,
    orange: BRAND_ORANGE,
    purpleLifted: BRAND_PURPLE_LIFTED,
    gradient: BRAND_GRADIENT,
  },
} as const;

export type Theme = typeof theme;
export type ThemeColors = typeof colors;
export type ThemeTypography = typeof typography;
export type ThemeSpacing = typeof spacing;
export type ThemeRadii = typeof radii;
export type ThemeLayout = typeof layout;

// ─────────────────────────────────────────────────────────────────────────────
// Legacy exports — kept so existing consumers (use-theme-color, collapsible)
// keep working. Prefer the named token exports above for new code.
// ─────────────────────────────────────────────────────────────────────────────

const tintColorLight = '#0a7ea4';
const tintColorDark = '#fff';

export const Colors = {
  light: {
    text: '#11181C',
    background: '#fff',
    tint: tintColorLight,
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: '#ECEDEE',
    background: '#151718',
    tint: tintColorDark,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,
  },
};

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
