import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PressableScale } from '@/components/afterglow/motion';
import { Display } from '@/components/afterglow/text';
import { Icon } from '@/components/ui/icon';
import { colors, display, layout, radii, spacing, typography } from '@/theme';
import type { Pulse } from './city-lines';
import type { CityMode } from './geojson';

// Sizes are the mock's (design-proposals/afterglow-concept.html, `.maptop`, `.city`, `.pulse`,
// `.lay`, `.sq`, `.rail`) times 1.35, the ratio between its 286 pt frame and an iPhone.

/** `#RRGGBB` with an alpha. */
function withAlpha(hex: string, alpha: number): string {
  const value = parseInt(hex.slice(1), 16);
  return `rgba(${(value >> 16) & 255},${(value >> 8) & 255},${value & 255},${alpha})`;
}

/**
 * The dark violet fade at the top of the map, as the mock's city has it: near black under the
 * status bar, a violet haze halfway, clear below. Part of the drawn city, so its colours are the
 * mock's own rather than theme tokens.
 */
const TOP_FADE = ['rgba(6,4,14,0.97)', 'rgba(22,9,44,0.55)', 'rgba(22,9,44,0)'] as const;
const TOP_FADE_AT = [0, 0.45, 1] as const;
/** Share of the screen the top fade covers in the mock. */
export const TOP_FADE_SHARE = 0.46;
/** The bottom of the mock's city darkens towards the tab bar. */
const BOTTOM_FADE = [withAlpha(colors.bg, 0), withAlpha(colors.bg, 0.9)] as const;
export const BOTTOM_FADE_SHARE = 0.28;

const SQUARE = 43;
const ROUND = 41;
const TEXT_SHADOW = {
  textShadowColor: withAlpha(colors.bg, 0.9),
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 10,
} as const;

type FadeProps = { height: number };

/** The fade behind the top of the map. Takes no touches. */
export function TopFade({ height }: FadeProps) {
  return (
    <LinearGradient
      pointerEvents="none"
      colors={TOP_FADE}
      locations={TOP_FADE_AT}
      style={[styles.topFade, { height }]}
    />
  );
}

/** The fade at the bottom of the map, under the controls and the tab bar. Takes no touches. */
export function BottomFade({ height }: FadeProps) {
  return <LinearGradient pointerEvents="none" colors={BOTTOM_FADE} style={[styles.bottomFade, { height }]} />;
}

type TopProps = {
  /** What sits at the top: the city heading, the selected venue's buttons, or the next turn. */
  children: ReactNode;
  /** Banners, stacked under it. */
  banners?: ReactNode;
};

/** The top of the map below the status bar. Touches pass through everywhere but the controls. */
export function MapTop({ children, banners }: TopProps) {
  const insets = useSafeAreaInsets();
  return (
    <View pointerEvents="box-none" style={[styles.top, { paddingTop: insets.top + spacing.sm }]}>
      {children}
      {banners ? (
        <View pointerEvents="box-none" style={styles.banners}>
          {banners}
        </View>
      ) : null}
    </View>
  );
}

type HeadingProps = {
  /** The chosen city's name ("Podgorica"). */
  cityName: string;
  /** The line under the name; null while it is not known yet (it is left out). */
  pulse: Pulse | null;
  mode: CityMode;
  onMode: (mode: CityMode) => void;
  /** The name and its chevron open the city sheet. */
  onPickCity: () => void;
  onSearch: () => void;
  onFilter: () => void;
  /** A filter is on: the filter square turns white. */
  filterOn: boolean;
};

/** The colour of the bold part of the pulse line, and of the chosen layer's underline. */
const TONE: Record<Pulse['tone'], string> = { live: colors.label, earned: colors.earned, friends: colors.you };

/**
 * S-04, S-08, S-09: the city's name in Coolvetica with a chevron (the city switch), the city's
 * pulse under it, the search and filter squares on the right, and under them the Live / My city /
 * Friends switch as three words with an underline under the chosen one (white, lime, cyan).
 */
export function CityHeading({ cityName, pulse, mode, onMode, onPickCity, onSearch, onFilter, filterOn }: HeadingProps) {
  return (
    <View pointerEvents="box-none" style={styles.heading}>
      <View pointerEvents="box-none" style={styles.headingRow}>
        <View pointerEvents="box-none" style={styles.headingText}>
          <Pressable
            onPress={onPickCity}
            hitSlop={layout.hitSlop}
            accessibilityRole="button"
            accessibilityLabel={`${cityName}, change city`}
            style={({ pressed }) => [styles.cityRow, pressed && styles.pressedLink]}
          >
            <Display size="lg" accessibilityRole="header" style={styles.cityName} numberOfLines={1}>
              {cityName}
            </Display>
            <View style={styles.chevron}>
              <Icon sfSymbol="chevron.down" ionicon="chevron-down" size={15} color={colors.label} />
            </View>
          </Pressable>
          {pulse ? (
            <Text style={styles.pulse} pointerEvents="none">
              {pulse.strong ? <Text style={[styles.pulseStrong, { color: TONE[pulse.tone] }]}>{pulse.strong}</Text> : null}
              {pulse.rest}
            </Text>
          ) : null}
        </View>
        <View style={styles.squares}>
          <PressableScale onPress={onSearch} style={styles.square} accessibilityRole="button" accessibilityLabel="Search venues and parties">
            <Icon sfSymbol="magnifyingglass" ionicon="search" size={18} color={colors.label} />
          </PressableScale>
          <PressableScale
            onPress={onFilter}
            style={[styles.square, filterOn && styles.squareOn]}
            accessibilityRole="button"
            accessibilityLabel="Filter the map"
            accessibilityState={{ selected: filterOn }}
          >
            <Icon
              sfSymbol="slider.horizontal.3"
              ionicon="options-outline"
              size={18}
              color={filterOn ? colors.ink : colors.label}
            />
          </PressableScale>
        </View>
      </View>
      <View style={styles.layers} accessibilityRole="tablist">
        <LayerTab label="Live" on={mode === 'live'} tone="live" onPress={() => onMode('live')} />
        <LayerTab label="My city" on={mode === 'mine'} tone="earned" onPress={() => onMode('mine')} />
        <LayerTab label="Friends" on={mode === 'friends'} tone="friends" onPress={() => onMode('friends')} />
      </View>
    </View>
  );
}

type LayerTabProps = { label: string; on: boolean; tone: Pulse['tone']; onPress: () => void };

function LayerTab({ label, on, tone, onPress }: LayerTabProps) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={layout.hitSlop}
      accessibilityRole="tab"
      accessibilityState={{ selected: on }}
      accessibilityLabel={label}
      style={[styles.layer, on && { borderBottomColor: TONE[tone] }]}
    >
      <Text style={[styles.layerLabel, on && styles.layerLabelOn]} allowFontScaling={false}>
        {label}
      </Text>
    </Pressable>
  );
}

type SelectedBarProps = { onBack: () => void; onShare: () => void; venueName: string };

/** S-05: with a venue open, the heading gives way to a back button and a share button. */
export function SelectedBar({ onBack, onShare, venueName }: SelectedBarProps) {
  return (
    <View pointerEvents="box-none" style={styles.selectedBar}>
      <PressableScale onPress={onBack} style={styles.round} accessibilityRole="button" accessibilityLabel="Back to the city">
        <Icon sfSymbol="chevron.left" ionicon="chevron-back" size={20} color={colors.label} />
      </PressableScale>
      <PressableScale
        onPress={onShare}
        style={styles.round}
        accessibilityRole="button"
        accessibilityLabel={`Share ${venueName}`}
      >
        <Icon sfSymbol="square.and.arrow.up" ionicon="share-outline" size={19} color={colors.label} />
      </PressableScale>
    </View>
  );
}

type SignBarProps = {
  /** Where the sign is: "Stara Varoš". */
  area: string;
  flat: boolean;
  onBack: () => void;
  onToggleFlat: () => void;
};

/** S-19: with a sign's card open, back, the area as a block in the middle, and 2D/3D. */
export function SignBar({ area, flat, onBack, onToggleFlat }: SignBarProps) {
  return (
    <View pointerEvents="box-none" style={styles.selectedBar}>
      <PressableScale onPress={onBack} style={styles.round} accessibilityRole="button" accessibilityLabel="Back to the city">
        <Icon sfSymbol="chevron.left" ionicon="chevron-back" size={20} color={colors.label} />
      </PressableScale>
      {area ? (
        <View style={styles.areaBlock} accessibilityRole="text">
          <Text style={styles.areaLabel} numberOfLines={1}>
            {area}
          </Text>
        </View>
      ) : null}
      <PressableScale
        onPress={onToggleFlat}
        style={styles.round}
        accessibilityRole="button"
        accessibilityLabel={flat ? 'Switch to 3D view' : 'Switch to 2D view'}
      >
        <Text style={styles.squareLabel} allowFontScaling={false}>
          {flat ? '3D' : '2D'}
        </Text>
      </PressableScale>
    </View>
  );
}

type BannerProps = {
  message: string;
  /** What the user can do about it, as a text link: "Try again", "Open Settings". */
  action?: { label: string; onPress: () => void };
};

/** A small solid banner for something that went wrong. The map under it stays usable. */
export function MapBanner({ message, action }: BannerProps) {
  return (
    <View style={styles.banner} accessibilityRole="alert">
      <Text style={styles.bannerMessage}>{message}</Text>
      {action ? (
        <Pressable
          onPress={action.onPress}
          hitSlop={layout.hitSlop}
          accessibilityRole="button"
          accessibilityLabel={action.label}
          style={({ pressed }) => pressed && styles.pressedLink}
        >
          <Text style={styles.bannerAction}>{action.label}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

type ControlsProps = {
  /** True when the map is flat (2D); the control then offers 3D. */
  flat: boolean;
  onToggleFlat: () => void;
  onLocate: () => void;
  /** A position fix is being fetched. */
  locating: boolean;
};

/** The two squares on the right edge (S-04 `.rail`): 2D/3D and locate-me. */
export function MapControls({ flat, onToggleFlat, onLocate, locating }: ControlsProps) {
  return (
    <View style={styles.controls}>
      <PressableScale
        onPress={onToggleFlat}
        style={styles.square}
        accessibilityRole="button"
        accessibilityLabel={flat ? 'Switch to 3D view' : 'Switch to 2D view'}
      >
        <Text style={styles.squareLabel} allowFontScaling={false}>
          {flat ? '3D' : '2D'}
        </Text>
      </PressableScale>
      <PressableScale
        onPress={onLocate}
        disabled={locating}
        style={styles.square}
        accessibilityRole="button"
        accessibilityLabel="Show my location"
        accessibilityState={{ busy: locating }}
      >
        {locating ? (
          <ActivityIndicator color={colors.you} />
        ) : (
          <Icon sfSymbol="scope" ionicon="locate-outline" size={20} color={colors.label} />
        )}
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  topFade: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  bottomFade: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  top: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.base,
    gap: spacing.md,
  },
  heading: {
    gap: spacing.md,
  },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  headingText: {
    flex: 1,
    alignItems: 'flex-start',
  },
  squares: {
    flexDirection: 'row',
    gap: 8,
  },
  cityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  cityName: {
    fontSize: 34,
    lineHeight: 36,
    ...TEXT_SHADOW,
  },
  chevron: {
    opacity: 0.7,
    marginTop: 4,
  },
  pulse: {
    ...typography.footnote,
    fontWeight: '500',
    lineHeight: 17,
    color: colors.labelSecondary,
    marginTop: 7,
    fontVariant: ['tabular-nums'],
    ...TEXT_SHADOW,
    textShadowRadius: 6,
  },
  pulseStrong: {
    fontWeight: '600',
  },
  layers: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    gap: 22,
  },
  layer: {
    paddingBottom: 7,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  layerLabel: {
    fontFamily: display.xs.fontFamily,
    fontSize: 19,
    lineHeight: 21,
    color: colors.labelSecondary,
    ...TEXT_SHADOW,
    textShadowRadius: 8,
  },
  layerLabelOn: {
    color: colors.label,
  },
  selectedBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  round: {
    width: ROUND,
    height: ROUND,
    borderRadius: 12,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  banners: {
    gap: spacing.sm,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
  },
  bannerMessage: {
    ...typography.subheadline,
    color: colors.label,
    flex: 1,
  },
  bannerAction: {
    ...typography.subheadline,
    fontWeight: '600',
    color: colors.tint,
  },
  pressedLink: {
    opacity: 0.6,
  },
  controls: {
    alignSelf: 'flex-end',
    gap: 11,
  },
  square: {
    width: SQUARE,
    height: SQUARE,
    borderRadius: 12,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  squareOn: {
    backgroundColor: colors.label,
  },
  areaBlock: {
    height: ROUND,
    borderRadius: 12,
    backgroundColor: colors.surface,
    paddingHorizontal: 15,
    justifyContent: 'center',
    flexShrink: 1,
  },
  areaLabel: {
    ...typography.footnote,
    fontWeight: '600',
    color: colors.label,
  },
  squareLabel: {
    ...typography.footnote,
    fontWeight: '600',
    color: colors.label,
  },
});
