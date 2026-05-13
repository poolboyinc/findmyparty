const RAILWAY_GATEWAY = 'https://findmyparty-gateway-production.up.railway.app';

// TEMP-DIAG: verify the Mapbox env var is being read at app boot.
// Remove this log once the Map placeholder issue is resolved.
console.log('[Mapbox]', {
  tokenPresent: !!process.env.EXPO_PUBLIC_MAPBOX_TOKEN,
  tokenPrefix: process.env.EXPO_PUBLIC_MAPBOX_TOKEN?.slice(0, 4),
});

export const ApiConstants = {
  MapboxPublicToken: process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? '',

  // All traffic goes through the YARP gateway deployed on Railway.
  // EXPO_PUBLIC_API_URL can override (e.g. point at a local gateway during dev).
  GatewayBaseUrl: process.env.EXPO_PUBLIC_API_URL ?? RAILWAY_GATEWAY,
};

/**
 * Returns a media URL the device can reach. The Railway gateway returns
 * absolute URLs so this is a pass-through; kept for API compatibility with
 * call sites that still null-guard their inputs.
 */
export function resolveMediaUrl(url: string | null | undefined): string | null {
  return url ?? null;
}
