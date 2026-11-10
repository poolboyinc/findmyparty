import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PressableScale } from '@/components/afterglow/motion';
import { Display } from '@/components/afterglow/text';
import { Icon } from '@/components/ui/icon';
import { colors, layout, radii, spacing, typography } from '@/theme';
import { CITY } from './constants';

/** `#RRGGBB` with an alpha, for the scrim's two ends. */
function withAlpha(hex: string, alpha: number): string {
  const value = parseInt(hex.slice(1), 16);
  return `rgba(${(value >> 16) & 255},${(value >> 8) & 255},${value & 255},${alpha})`;
}

const SCRIM = [withAlpha(colors.bg, 0.88), withAlpha(colors.bg, 0)] as const;
/** How far the fade reaches below the status bar. */
const SCRIM_BELOW_SAFE_AREA = 150;
const CONTROL_SIZE = 48;

function litText(count: number): string {
  if (count === 0) return 'No venues lit yet';
  return count === 1 ? '1 venue lit tonight' : `${count} venues lit tonight`;
}

type TopProps = {
  /** Venues with a live crowd; null while the first load is running (the line is left out). */
  litCount: number | null;
  /** Banners, stacked under the title. */
  children?: ReactNode;
};

/**
 * The top of the map: the city's name, how many venues are lit, and any banners.
 * The dark fade behind it is there so the title reads over a bright map; touches pass through
 * everything except the banners.
 */
export function CityTop({ litCount, children }: TopProps) {
  const insets = useSafeAreaInsets();

  return (
    <View pointerEvents="box-none" style={styles.top}>
      <LinearGradient
        pointerEvents="none"
        colors={SCRIM}
        style={[styles.scrim, { height: insets.top + SCRIM_BELOW_SAFE_AREA }]}
      />
      <View pointerEvents="none" style={[styles.title, { paddingTop: insets.top + spacing.sm }]}>
        <Display size="md" accessibilityRole="header">
          {CITY.name}
        </Display>
        {litCount !== null ? <Text style={styles.lit}>{litText(litCount)}</Text> : null}
      </View>
      <View pointerEvents="box-none" style={styles.banners}>
        {children}
      </View>
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

/** The two square controls on the right edge: 2D/3D and locate-me. */
export function MapControls({ flat, onToggleFlat, onLocate, locating }: ControlsProps) {
  return (
    <View style={styles.controls}>
      <PressableScale
        onPress={onToggleFlat}
        style={styles.control}
        accessibilityRole="button"
        accessibilityLabel={flat ? 'Switch to 3D view' : 'Switch to 2D view'}
      >
        <Text style={styles.controlLabel} allowFontScaling={false}>
          {flat ? '3D' : '2D'}
        </Text>
      </PressableScale>
      <PressableScale
        onPress={onLocate}
        disabled={locating}
        style={styles.control}
        accessibilityRole="button"
        accessibilityLabel="Show my location"
        accessibilityState={{ busy: locating }}
      >
        {locating ? (
          <ActivityIndicator color={colors.you} />
        ) : (
          <Icon sfSymbol="location" ionicon="locate-outline" size={22} color={colors.label} />
        )}
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  top: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  scrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  title: {
    paddingHorizontal: layout.screenMargin,
    gap: spacing.xxs,
  },
  lit: {
    ...typography.subheadline,
    color: colors.labelSecondary,
    fontVariant: ['tabular-nums'],
  },
  banners: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.md,
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
    gap: spacing.sm,
  },
  control: {
    width: CONTROL_SIZE,
    height: CONTROL_SIZE,
    borderRadius: radii.card,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlLabel: {
    ...typography.headline,
    color: colors.label,
  },
});
