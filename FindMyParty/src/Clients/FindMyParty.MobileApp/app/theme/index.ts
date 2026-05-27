import { Platform, StyleSheet, TextStyle } from 'react-native';

// ─────────────────────────────────────────────────────────────────────────────
// FindMyParty Design System
//
// Single source of truth for all visual tokens. Never hardcode colors,
// spacing, fonts, or radii — always import from here.
//
// Usage:
//   import { colors, spacing, radii } from '@/theme';
//   <View style={{ backgroundColor: colors.bg, padding: spacing.lg }} />
// ─────────────────────────────────────────────────────────────────────────────

// Internal palette anchors — exposed only through `colors.brand.*`.
const BRAND_PURPLE_PRIMARY = '#8B5CF6';
const BRAND_PURPLE_LIGHT = '#B58CFF';
const BRAND_PURPLE_DEEP = '#7D08FA';
const BRAND_ORANGE_HEX = '#FF8C48';

// ─────────────────────────────────────────────────────────────────────────────
// Colors — dark-mode-first, semantic tokens modeled on iOS UIKit colors.
// Label and fill tier opacities follow Apple's dark-mode UIColor specs.
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

  /** Active action color — mirrors UIKit's `tintColor`. Alias of `brand.primary`. */
  tint: BRAND_PURPLE_PRIMARY,

  brand: {
    /** Default brand purple for UI — buttons, links, focus rings, accents on dark surfaces. */
    primary: BRAND_PURPLE_PRIMARY,
    /** Lighter variant for hover, secondary emphasis, and softer accent moments. */
    light: BRAND_PURPLE_LIGHT,
    /** True brand purple from the logo. Use ONLY as splash, logo, or gradient anchor. */
    deep: BRAND_PURPLE_DEEP,
    /** Brand orange — gradient anchor and rare accent only. */
    orange: BRAND_ORANGE_HEX,
    /** Low-opacity tint for selection/active backgrounds (active tab bubble, active chip). */
    tintBg: 'rgba(157,107,255,0.15)',
    /** Magenta accent — auth-screen text links (Forgot password, Sign up / Sign in
     *  footers) and the right anchor of `authGradient` below. */
    magenta: '#C040C8',
    /**
     * Full brand gradient (purple → magenta → orange → peach).
     * Reserved for the FindMyParty logo and rare hero moments only.
     * Do NOT use as a screen background or routine button fill.
     */
    gradient: {
      colors: [BRAND_PURPLE_DEEP, '#B03070', '#C84B00', BRAND_ORANGE_HEX] as const,
      locations: [0, 0.38, 0.65, 1] as const,
    },
    /**
     * 2-stop gradient (deep purple → magenta) used ONLY on the Log In and
     * Sign Up CTA buttons. A documented carve-out from the
     * "gradient = logo only" rule, approved per user decision (see commit
     * message / PR description). Do NOT extend to other CTAs without a fresh
     * decision.
     */
    authGradient: {
      colors: ['#7B35E8', '#C040C8'] as const,
      locations: [0, 1] as const,
    },
  },

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
// Semantic aliases (button/field/card/modal) help consumers pick correctly.
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
  /** Same value as `radii.card` today, kept separate for semantic clarity.
   * Flag for consolidation review if they stay identical long-term. */
  field: 16,
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
  /** Deliberate +4 over Figma's 46pt mockup. 46pt clips at AX1+ Dynamic Type;
   * 50pt stays HIG-safe. Do NOT "fix" back to 46. */
  buttonHeight: 50,
  fieldHeight: 50,
  fieldHeightTall: 54,
  hitSlop: { top: 8, right: 8, bottom: 8, left: 8 },
  minTouchTarget: 44,
  /** Width of the grabber handle at the top of a `@gorhom/bottom-sheet` modal. */
  sheetHandleWidth: 36,
  /** Floating tab bar visual height (excluding bottom safe-area inset). */
  floatingTabBarHeight: 64,
  /** Vertical inset between the floating tab bar and the screen edge / home indicator. */
  floatingTabBarBottomOffset: 12,
  /** Promo flyer aspect — wider than 16:9 to honor event poster proportions. */
  cardImageAspect: 333 / 168,
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
} as const;

export type Theme = typeof theme;
export type ThemeColors = typeof colors;
export type ThemeTypography = typeof typography;
export type ThemeSpacing = typeof spacing;
export type ThemeRadii = typeof radii;
export type ThemeLayout = typeof layout;
