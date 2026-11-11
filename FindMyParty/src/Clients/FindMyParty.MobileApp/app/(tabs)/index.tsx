/**
 * City: the live map. Each venue is a beam of light; the busier it is at the door, the taller
 * and warmer the beam. This file is only layout; what happens lives in `hooks/city/useCity.ts`,
 * what is drawn in `components/city/`. Target: mock screens S-04 to S-08.
 *
 * The map can be looked at without a phone: `tools/city-preview` draws the same layer list in a
 * browser and saves pictures (see its README). The phone is still the judge. What to check there,
 * most important first; every switch named here is in `SWITCH` in components/city/constants.ts.
 *
 *  1. The city. Mapbox dark-v11 repainted: near-black violet ground, deep navy water with a thin
 *     blue edge, glowing violet streets, no grey anywhere. If it is grey, the repaint did not take
 *     (`restyleBasemap`); if the streets look like neon spaghetti, set `streetGlow` false.
 *  2. Buildings. Dark violet blocks with lit windows, plain dark roofs, a violet haze towards the
 *     top. If the walls look striped, blurry or empty, set `facadePattern` false (plain walls).
 *     If they look too tall or too flat, change `BUILDINGS.verticalScale`.
 *  3. A venue. Its own building has a bright line round the roof and thin lines up its corners;
 *     a ring lies on the roof and a slim beam of light stands in it, bright at the foot, fading
 *     upwards. The beam stays slim when you zoom in: the building grows, the light does not.
 *     Busy venues send a slow ripple out from the roof ring (not with Reduce Motion).
 *  4. The first view. The demo venues in view, tilted 60°, turned 17° (CAMERA in constants).
 *     First open of the day: the camera falls from straight above and tilts in (~0.9 s); not
 *     again that day, and never with Reduce Motion on (`cameraDrop` false turns it off).
 *  5. Names. White, the crowd ("200+") under it in the beam's colour, just above the tip of each
 *     beam, moving with it. Where two would overlap, the busier venue keeps its name. If names
 *     drift away from the tips while zooming, set `beamsScaleWithZoom` false.
 *     The selected venue's name sits on a white block and its building's lines turn white.
 *  6. Zoomed far out (below zoom 15, where Mapbox has few buildings) the map lays itself flat
 *     and shows discs; zoomed back in it tilts up again.
 *  7. Live / My city. My city: venues you were scanned into turn lime, the rest are dashed rings
 *     with a dim name; the line under "Podgorica" says "3 of 7 venues lit".
 *  8. Taps. A beam, its ring, its name, or anywhere on the venue's own building opens the venue
 *     sheet; empty map closes it; the back button closes it; share opens the share sheet.
 *     Standing at a venue, tapping your own dot selects it.
 *  9. 2D / 3D. The camera eases flat and back; in 2D the beams go, the discs show the crowd.
 * 10. The venue sheet. Address and distance under the name, the crowd card with its coloured
 *     edge, the party with its line-up, "Get pass for €5". The beam stays visible above it.
 * 11. The Mapbox wordmark and the "i" button: visible bottom left, just above the tab bar.
 * 12. Location. No system prompt on launch, only after "Use my location". Then a cyan dot;
 *     locate-me flies to it. Denied: locate-me shows the "Open Settings" banner.
 * 13. Walking. Cyan line with a white middle, the banner at the top with the next turn and the
 *     distance to it (moves on as you walk), the card with time, distance, "Show pass" when
 *     you hold one, "Share ETA", "End". Network off: "Could not get a route. Try again."
 */
import { useCallback } from 'react';
import { useIsFocused } from '@react-navigation/native';
import { Share, StyleSheet, useWindowDimensions, View } from 'react-native';
import Mapbox from '@rnmapbox/maps';
import { router } from 'expo-router';
import Animated from 'react-native-reanimated';
import { GLIDE } from '@/components/city/card-motion';
import {
  BOTTOM_FADE_SHARE,
  BottomFade,
  CityHeading,
  MapBanner,
  MapControls,
  MapTop,
  SelectedBar,
  TOP_FADE_SHARE,
  TopFade,
} from '@/components/city/chrome';
import { CityMap } from '@/components/city/city-map';
import { CITY } from '@/components/city/constants';
import { walkingTimeText } from '@/components/city/directions';
import { LocationCard } from '@/components/city/location-card';
import { RouteCard } from '@/components/city/route-card';
import { TurnBanner } from '@/components/city/turn-banner';
import { VenueSheet } from '@/components/city/venue-sheet';
import { EmptyState } from '@/components/ui/empty-state';
import { ApiConstants } from '@/constants/api';
import { useCity } from '@/hooks/city/useCity';
import { crowdText } from '@/services/crowd';
import { errorText } from '@/services/errorText';
import { colors, spacing } from '@/theme';

// Set once. With no token the screen shows "Map unavailable" instead of a map.
if (ApiConstants.MapboxPublicToken) {
  Mapbox.setAccessToken(ApiConstants.MapboxPublicToken);
}

export default function CityScreen() {
  return ApiConstants.MapboxPublicToken ? <City /> : <MapUnavailable />;
}

function City() {
  const city = useCity();
  // Only the screen in front pulses: a hidden tab should not keep the map busy.
  const focused = useIsFocused();
  const { route, selected, nextTurn } = city;
  const { height } = useWindowDimensions();

  const shareVenue = useCallback(() => {
    if (!selected) return;
    const crowd = crowdText(selected.crowdLevel, selected.crowdSource);
    const message = `${selected.name}, ${CITY.name}${crowd ? `: ${crowd}` : ''}. Seen on FindMyParty.`;
    Share.share({ message }).catch(() => {});
  }, [selected]);

  const shareEta = useCallback(() => {
    if (route.status !== 'ready') return;
    const message = `On my way to ${route.venue.name}, about ${walkingTimeText(route.route.seconds)} on foot.`;
    Share.share({ message }).catch(() => {});
  }, [route]);

  const showPass = useCallback(() => router.push('/(tabs)/pass'), []);

  const banners =
    city.venuesError || city.banner ? (
      <>
        {city.venuesError ? (
          <MapBanner message={errorText(city.venuesError)} action={{ label: 'Try again', onPress: city.retryVenues }} />
        ) : null}
        {city.banner ? <MapBanner message={city.banner.message} action={city.banner.action} /> : null}
      </>
    ) : null;

  return (
    <View style={styles.root}>
      <CityMap
        pulse={focused}
        camera={city.camera}
        venues={city.venues}
        selectedId={selected?.id ?? null}
        mode={city.mode}
        earned={city.earned}
        onSelectVenue={city.select}
        onPressEmpty={city.pressMap}
        routeLine={route.status === 'ready' ? route.route.line : null}
        showUser={city.showUser}
        onPressUser={city.selectNearUser}
        onUserMove={city.onUserMove}
      />
      <TopFade height={height * TOP_FADE_SHARE} />
      {/* Only behind the tab bar, so the Mapbox wordmark above it stays clear (Mapbox's terms). */}
      <BottomFade height={Math.min(height * BOTTOM_FADE_SHARE, city.tabBarClearance)} />

      {/* The top: the next turn while walking, back and share with a venue open, else the city. */}
      <MapTop banners={banners}>
        {route.status !== 'idle' && nextTurn ? (
          <TurnBanner title={nextTurn.title} direction={nextTurn.direction} metres={nextTurn.metres} />
        ) : selected ? (
          <SelectedBar venueName={selected.name} onBack={city.clearSelection} onShare={shareVenue} />
        ) : (
          <CityHeading pulse={city.pulse} mode={city.mode} onMode={city.setMode} />
        )}
      </MapTop>

      {/* Above the tab bar: the two controls, and under them whichever card is up. */}
      <View pointerEvents="box-none" style={[styles.bottom, { bottom: city.tabBarClearance }]}>
        <Animated.View layout={GLIDE} style={styles.controls}>
          <MapControls
            flat={city.camera.flat}
            onToggleFlat={city.camera.toggleFlat}
            onLocate={city.locate}
            locating={city.locating}
          />
        </Animated.View>
        {route.status !== 'idle' ? (
          <RouteCard
            venueName={route.venue.name}
            route={route.status === 'ready' ? route.route : null}
            passReady={city.passReady}
            onEnd={city.endWalk}
            onShowPass={showPass}
            onShareEta={shareEta}
          />
        ) : city.showLocationCard ? (
          <LocationCard onAllow={city.allowLocation} onNotNow={city.notNow} asking={city.asking} />
        ) : null}
      </View>

      <VenueSheet
        venue={selected}
        party={city.selectedParty}
        distance={city.selectedDistance}
        onDismiss={city.clearSelection}
        onWalk={city.walkTo}
        onHeight={city.onSheetHeight}
      />
    </View>
  );
}

/** No Mapbox token in this build: say so, and point at the list, which works without a map. */
function MapUnavailable() {
  return (
    <View style={styles.unavailable}>
      <EmptyState
        sfSymbol="map.fill"
        ionicon="map"
        title="Map unavailable"
        body="We can't show the city right now. The Tonight tab lists everything that is on."
        action={{ label: 'Go to Tonight', onPress: () => router.push('/(tabs)/parties') }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  bottom: {
    position: 'absolute',
    left: spacing.base,
    right: spacing.base,
    gap: spacing.md,
  },
  // Only as wide as the controls, so the map beside them still takes touches.
  controls: {
    alignSelf: 'flex-end',
  },
  unavailable: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
