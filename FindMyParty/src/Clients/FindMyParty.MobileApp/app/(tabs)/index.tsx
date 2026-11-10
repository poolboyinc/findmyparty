/**
 * City: the live map. Each venue is a beam of light; the busier it is at the door, the taller
 * and warmer the beam. This file is only layout; what happens lives in `hooks/city/useCity.ts`,
 * what is drawn in `components/city/`.
 *
 * WRITTEN WITHOUT A SIMULATOR. Check these on a phone, most important first:
 *
 *  1. Night. The city should be dark (Mapbox Standard, `lightPreset: 'night'`). If it loads in
 *     daylight, set `USE_STANDARD_STYLE = false` in components/city/constants.ts: that switches
 *     to dark-v11 with the app's own dark-violet buildings.
 *  2. Beams. They should glow violet to rose, not look like dark grey rods (that is what
 *     `fillExtrusionEmissiveStrength` is for), and stand taller than the buildings around them.
 *     The thin beam should show inside its faint wider one; if only a faint fat beam shows,
 *     the layer order in components/city/venue-layers.tsx is being ignored.
 *  3. Layer order. Beams, discs, route and names above Mapbox's 3D buildings; names above
 *     beams; the route line under the beams.
 *  4. Names. White with a dark edge, readable over a lit beam and over buildings, floating at
 *     the top of each beam and moving with it as the map tilts. If they sit on the ground, hide
 *     behind buildings or jump about, set `LABEL.atBeamTop = false` (names beside the foot).
 *     Zoomed out past about 14 only busy venues and the selected one should be named.
 *  5. Taps. A beam, its disc and its name should each open the venue sheet; tapping empty map
 *     closes it. Standing at a venue, tapping your own dot should select that venue.
 *  6. Shop and bus-stop labels should be gone, street and place names still there.
 *  7. 2D / 3D. The camera should ease flat and back; in 2D the beams go and the discs grow with
 *     the crowd. Tilting by hand with two fingers should flip the control's label too.
 *  8. The venue sheet. The selected beam should end up visible above it, the buttons inside it
 *     should respond on first touch, and swiping it down should hand the map its space back.
 *  9. The Mapbox wordmark and the "i" button: visible bottom left, just above the tab bar,
 *     not behind it and not floating far above it.
 * 10. Location. No system prompt on launch, only after "Use my location". Then a cyan dot;
 *     locate-me flies to it. With location denied, locate-me shows the "Open Settings" banner.
 * 11. Walking. The cyan line with its glow, the card with time and distance, "End" clearing
 *     both; with the network off, "Could not get a route. Try again."
 */
import { StyleSheet, View } from 'react-native';
import Mapbox from '@rnmapbox/maps';
import { router } from 'expo-router';
import Animated from 'react-native-reanimated';
import { GLIDE } from '@/components/city/card-motion';
import { CityTop, MapBanner, MapControls } from '@/components/city/chrome';
import { CityMap } from '@/components/city/city-map';
import { LocationCard } from '@/components/city/location-card';
import { RouteCard } from '@/components/city/route-card';
import { VenueSheet } from '@/components/city/venue-sheet';
import { EmptyState } from '@/components/ui/empty-state';
import { ApiConstants } from '@/constants/api';
import { useCity } from '@/hooks/city/useCity';
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
  const { route } = city;

  return (
    <View style={styles.root}>
      <CityMap
        camera={city.camera}
        venues={city.venues}
        selectedId={city.selected?.id ?? null}
        onSelectVenue={city.select}
        onPressEmpty={city.clearSelection}
        routeLine={route.status === 'ready' ? route.route.line : null}
        showUser={city.showUser}
        onPressUser={city.selectNearUser}
      />

      <CityTop litCount={city.litCount}>
        {city.venuesError ? (
          <MapBanner
            message={errorText(city.venuesError)}
            action={{ label: 'Try again', onPress: city.retryVenues }}
          />
        ) : null}
        {city.banner ? <MapBanner message={city.banner.message} action={city.banner.action} /> : null}
      </CityTop>

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
            onEnd={city.endWalk}
          />
        ) : city.showLocationCard ? (
          <LocationCard onAllow={city.allowLocation} onNotNow={city.notNow} asking={city.asking} />
        ) : null}
      </View>

      <VenueSheet
        venue={city.selected}
        party={city.selectedParty}
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
