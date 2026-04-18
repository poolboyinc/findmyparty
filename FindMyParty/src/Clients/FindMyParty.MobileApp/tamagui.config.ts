// ═══════════════════════════════════════════════════════════════════════════
//  ULTRAVIOLET — the FindMyParty design system
//  Neon ultraviolet on violet-tinted obsidian. Liquid glass. Floating chrome.
// ═══════════════════════════════════════════════════════════════════════════

import { createAnimations } from '@tamagui/animations-react-native';
import { createTamagui, createTokens, createFont } from 'tamagui';
import { Platform } from 'react-native';

// ─── Palette ────────────────────────────────────────────────────────────────
const p = {
  // Core ultraviolet ramp
  violet50:  '#F5EBFF',
  violet100: '#E9D5FF',
  violet200: '#D8B4FE',
  violet300: '#C084FC',
  violet400: '#A855F7',
  violet500: '#B026FF', // primary neon
  violet600: '#9333EA',
  violet700: '#7E22CE',
  violet800: '#5B21B6',
  violet900: '#3B0764',
  violet950: '#1F0F2E',

  // Obsidian — violet-tinted blacks, never pure #000
  void:    '#05020A',
  base:    '#0A0612',
  raised:  '#14081F',
  overlay: '#1F0F2E',
  pressed: '#2A1840',
  chrome:  '#3A2550',

  // Counter-punch accents — what keeps it from being "generic purple"
  cyan:    '#00F5D4', // live states, check-ins
  magenta: '#FF2E93', // urgency, sold out
  sodium:  '#FFB800', // XP, rewards — street-light yellow

  // Text ramp — faintly violet whites for brand coherence
  text:        '#F5EBFF',
  textMuted:   'rgba(245,235,255,0.72)',
  textSubtle:  'rgba(245,235,255,0.48)',
  textFaint:   'rgba(245,235,255,0.32)',

  // Scrim / neutrals
  fog:   'rgba(255,255,255,0.72)',
  mist:  'rgba(255,255,255,0.48)',
  smoke: 'rgba(255,255,255,0.24)',
  haze:  'rgba(255,255,255,0.12)',
  glass: 'rgba(255,255,255,0.06)',

  // Liquid-glass asymmetric borders
  glassTop:    'rgba(255,255,255,0.16)',
  glassBottom: 'rgba(176,38,255,0.30)',
  glassFlat:   'rgba(255,255,255,0.10)',

  transparent: 'rgba(0,0,0,0)',
};

// ─── Tokens ─────────────────────────────────────────────────────────────────
// Tamagui tokens: size, space, radius, color, zIndex.
// Named keys become first-class props: <YStack p="$lg" bg="$surfaceRaised" />
const tokens = createTokens({
  color: {
    // Surfaces
    void:           p.void,
    surfaceBase:    p.base,
    surfaceRaised:  p.raised,
    surfaceOverlay: p.overlay,
    surfacePressed: p.pressed,
    chrome:         p.chrome,

    // Brand
    violet50:  p.violet50,
    violet100: p.violet100,
    violet200: p.violet200,
    violet300: p.violet300,
    violet400: p.violet400,
    violet500: p.violet500,
    violet600: p.violet600,
    violet700: p.violet700,
    violet800: p.violet800,
    violet900: p.violet900,
    violet950: p.violet950,

    // Accents
    cyan:    p.cyan,
    magenta: p.magenta,
    sodium:  p.sodium,

    // Text
    text:       p.text,
    textMuted:  p.textMuted,
    textSubtle: p.textSubtle,
    textFaint:  p.textFaint,

    // Utilities
    fog:         p.fog,
    mist:        p.mist,
    smoke:       p.smoke,
    haze:        p.haze,
    glass:       p.glass,
    glassTop:    p.glassTop,
    glassBottom: p.glassBottom,
    glassFlat:   p.glassFlat,
    transparent: p.transparent,

    // Semantic
    success: p.cyan,
    warn:    p.sodium,
    danger:  p.magenta,
  },

  // Spacing — 4pt base, tighter than Material for denser nightlife UI
  space: {
    $0:    0,
    $px:   1,
    $xxs:  2,
    $xs:   4,
    $sm:   8,
    $md:   12,
    $lg:   16,
    $xl:   20,
    '$2xl': 24,
    '$3xl': 32,
    '$4xl': 40,
    '$5xl': 56,
    '$6xl': 72,
    '$7xl': 96,
    true:  12, // default
  },

  size: {
    $0:    0,
    $px:   1,
    $xxs:  2,
    $xs:   4,
    $sm:   8,
    $md:   12,
    $lg:   16,
    $xl:   20,
    '$2xl': 24,
    '$3xl': 32,
    '$4xl': 40,
    '$5xl': 56,
    '$6xl': 72,
    '$7xl': 96,
    // Component-specific sizes
    button:     48,
    buttonLg:   56,
    buttonSm:   38,
    input:      52,
    icon:       22,
    true:       12,
  },

  radius: {
    $0:    0,
    $xs:   4,
    $sm:   8,
    $md:   12,
    $lg:   16,
    $xl:   20,
    '$2xl': 24,
    '$3xl': 32,
    '$4xl': 40,
    $full: 9999,
    true:  16,
  },

  zIndex: {
    base:    0,
    raised:  10,
    overlay: 100,
    modal:   1000,
    toast:   10000,
  },
});

// ─── Fonts ──────────────────────────────────────────────────────────────────
// Coolvetica (display) already loaded via expo-font. Body + mono fall back to
// iOS system faces until TTFs are added.
const displayFont = createFont({
  family: 'Coolvetica',
  size: {
    1:  12,
    2:  13,
    3:  14,
    4:  16,
    5:  18,
    6:  20,
    7:  24,
    8:  28,
    9:  32,
    10: 40,
    11: 48,
    12: 56,
    13: 72,
    14: 96,
    true: 20,
  },
  lineHeight: {
    1:  14,
    2:  16,
    3:  18,
    4:  20,
    5:  22,
    6:  24,
    7:  28,
    8:  32,
    9:  36,
    10: 44,
    11: 52,
    12: 60,
    13: 76,
    14: 100,
    true: 24,
  },
  weight: {
    4: '400',
    5: '500',
    6: '600',
    7: '700',
    9: '900',
    true: '500',
  },
  letterSpacing: {
    1:  0.2,
    4:  0,
    7:  -0.4,
    9:  -0.8,
    11: -1.0,
    12: -1.2,
    true: 0,
  },
});

const bodyFont = createFont({
  family: Platform.select({ ios: 'ui-rounded', default: 'System' }),
  size: {
    1:  11,
    2:  12,
    3:  13,
    4:  15,
    5:  17,
    6:  20,
    true: 15,
  },
  lineHeight: {
    1:  14,
    2:  16,
    3:  18,
    4:  22,
    5:  24,
    6:  28,
    true: 22,
  },
  weight: {
    4: '400',
    5: '500',
    6: '600',
    7: '700',
    true: '500',
  },
  letterSpacing: {
    4: 0,
    7: 0.2,
    true: 0,
  },
});

const monoFont = createFont({
  family: Platform.select({ ios: 'ui-monospace', default: 'Menlo' }),
  size: {
    1: 10,
    2: 11,
    3: 12,
    4: 14,
    5: 16,
    true: 12,
  },
  lineHeight: {
    1: 14,
    2: 14,
    3: 16,
    4: 18,
    5: 22,
    true: 16,
  },
  weight: {
    4: '400',
    5: '500',
    6: '600',
    7: '700',
    true: '500',
  },
  letterSpacing: {
    true: 0.2,
  },
});

// ─── Animations ─────────────────────────────────────────────────────────────
const animations = createAnimations({
  // Spring presets — signature feel
  gentle: { type: 'spring', damping: 18, stiffness: 140, mass: 0.9 },
  snappy: { type: 'spring', damping: 20, stiffness: 300, mass: 0.8 },
  bouncy: { type: 'spring', damping: 12, stiffness: 180, mass: 1.0 },
  heavy:  { type: 'spring', damping: 26, stiffness: 220, mass: 1.4 },
  press:  { type: 'spring', damping: 15, stiffness: 400, mass: 0.7 },

  // Timing curves
  fast:    { type: 'timing', duration: 150 },
  base:    { type: 'timing', duration: 220 },
  slow:    { type: 'timing', duration: 320 },
  ambient: { type: 'timing', duration: 800 },
});

// ─── Themes ─────────────────────────────────────────────────────────────────
// Tamagui themes reference tokens via keys. For ULTRAVIOLET we start with
// one dark theme — light mode comes later (nightlife app = dark first).
const darkTheme = {
  // Backgrounds
  background:         tokens.color.void,
  backgroundHover:    tokens.color.surfaceRaised,
  backgroundPress:    tokens.color.surfacePressed,
  backgroundFocus:    tokens.color.surfaceRaised,
  backgroundStrong:   tokens.color.surfaceOverlay,
  backgroundTransparent: tokens.color.transparent,

  // Text / color
  color:              tokens.color.text,
  colorHover:         tokens.color.violet100,
  colorPress:         tokens.color.violet200,
  colorFocus:         tokens.color.violet200,
  colorTransparent:   tokens.color.transparent,

  // Borders
  borderColor:        tokens.color.haze,
  borderColorHover:   tokens.color.smoke,
  borderColorFocus:   tokens.color.violet500,
  borderColorPress:   tokens.color.violet400,

  // Brand shortcuts
  primary:            tokens.color.violet500,
  primaryHover:       tokens.color.violet400,
  primaryPress:       tokens.color.violet600,

  // Shadow (colored — neon glow)
  shadowColor:        tokens.color.violet500,
  shadowColorHover:   tokens.color.violet400,
  shadowColorPress:   tokens.color.violet600,
  shadowColorFocus:   tokens.color.violet500,
};

// ─── Config ─────────────────────────────────────────────────────────────────
export const tamaguiConfig = createTamagui({
  defaultTheme: 'dark',
  shouldAddPrefersColorThemes: false,
  themeClassNameOnRoot: false,
  tokens,
  themes: {
    dark: darkTheme,
  },
  fonts: {
    heading: displayFont,
    body:    bodyFont,
    mono:    monoFont,
    display: displayFont,
  },
  animations,
  // Media queries (for future responsive use)
  media: {
    xs: { maxWidth: 380 },
    sm: { maxWidth: 480 },
    md: { maxWidth: 768 },
    lg: { minWidth: 769 },
    short:  { maxHeight: 820 },
    tall:   { minHeight: 821 },
  },
  settings: {
    allowedStyleValues: 'somewhat-strict',
    autocompleteSpecificTokens: 'except-special',
  },
});

export type AppConfig = typeof tamaguiConfig;

declare module 'tamagui' {
  interface TamaguiCustomConfig extends AppConfig {}
}

export default tamaguiConfig;
