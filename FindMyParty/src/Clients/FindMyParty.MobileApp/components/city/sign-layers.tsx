import { memo, useCallback, useMemo, type ComponentProps } from 'react';
import { Images, Models, ShapeSource } from '@rnmapbox/maps';
import { ApiConstants } from '@/constants/api';
import { BUILDINGS, SOURCE, TAP_HITBOX } from './constants';
import { signLayers } from './layers';
import { signArtUrl, signFeatures, signImageName, type SignOnMap } from './signs';
import { SpecLayers } from './spec-layer';

type PressEvent = Parameters<NonNullable<ComponentProps<typeof ShapeSource>['onPress']>>[0];

type Props = {
  /** The signs to draw (the caller keeps it to the few in view). */
  signs: readonly SignOnMap[];
  /** Without it the signs cannot be tapped (previews). */
  onSelect?: (signId: string) => void;
};

const LAYERS = signLayers();
/** The server draws holograms at three pixels per point. */
const HOLOGRAM_PIXEL_RATIO = 3;

/**
 * Signs in the city (S-19): a panel on a hand-picked wall, a venue's own sign, a hologram over a
 * roof; paid ones carry the amber "Ad" block. The server draws each sign's picture from its text
 * and colours (`/api/sign-art/…`); the wall panel is a flat 3D object carrying that picture.
 * Under each panel lies a thin slab in the sign's colour, so a sign is still marked, and can still
 * be tapped, on a phone where the 3D panel does not draw.
 */
export const SignLayers = memo(function SignLayers({ signs, onSelect }: Props) {
  const features = useMemo(() => signFeatures(signs, BUILDINGS.stretch), [signs]);

  // Each sign's picture and panel, under the names the features carry.
  const { pictures, models } = useMemo(() => {
    const base = ApiConstants.GatewayBaseUrl;
    // An object with `url`, not a bare address: on iOS the map ignores a plain string here.
    const holograms: Record<string, { url: string; scale: number }> = {};
    const panels: Record<string, string> = {};
    for (const sign of signs) {
      const name = signImageName(sign);
      if (sign.format === 'hologram') holograms[name] = { url: signArtUrl(base, sign, 'hologram'), scale: HOLOGRAM_PIXEL_RATIO };
      else panels[name] = signArtUrl(base, sign, 'panel');
    }
    return { pictures: holograms, models: panels };
  }, [signs]);

  const handlePress = useCallback(
    (event: PressEvent) => {
      const id: unknown = event.features[0]?.properties?.id;
      if (typeof id === 'string') onSelect?.(id);
    },
    [onSelect],
  );
  const press = onSelect ? { onPress: handlePress, hitbox: TAP_HITBOX } : {};

  // Always mounted, even with no signs: a layer the map gets later lands on top of everything.
  return (
    <>
      <Images images={pictures} />
      {/* The map registers 3D models only when this mounts, so a new set of panels remounts it. */}
      <Models key={Object.keys(models).sort().join('|')} models={models} />
      <ShapeSource id={SOURCE.signSlabs} shape={features.slabs} {...press}>
        <SpecLayers specs={LAYERS.slabs} />
      </ShapeSource>
      <ShapeSource id={SOURCE.signPanels} shape={features.panels}>
        <SpecLayers specs={LAYERS.panels} />
      </ShapeSource>
      <ShapeSource id={SOURCE.signMarks} shape={features.marks} {...press}>
        <SpecLayers specs={LAYERS.marks} />
      </ShapeSource>
    </>
  );
});
