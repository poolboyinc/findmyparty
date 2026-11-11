import type { City } from '@/types/api';

/** "1200" → "1,200". */
function withCommas(value: number): string {
  return String(Math.floor(value)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * The rose line on the welcome (S-01), from the server's pulse for the chosen city (already rounded down):
 * "1,200+ out tonight in Podgorica". With nobody counted yet but venues lit: "3 venues lit tonight in Budva".
 * With nothing on, or before the city is known, null and the line stays out.
 */
export function outTonightLine(city: Pick<City, 'name' | 'outTonight' | 'venuesLit'> | null | undefined): string | null {
  if (!city) return null;
  if (city.outTonight > 0) return `${withCommas(city.outTonight)}+ out tonight in ${city.name}`;
  if (city.venuesLit === 1) return `1 venue lit tonight in ${city.name}`;
  if (city.venuesLit > 1) return `${withCommas(city.venuesLit)} venues lit tonight in ${city.name}`;
  return null;
}

/** The line under a city's name in the city picker: "14 venues lit", "1 venue lit", or "Nothing on yet". */
export function venuesLitText(city: Pick<City, 'venuesLit'>): string {
  if (city.venuesLit === 1) return '1 venue lit';
  if (city.venuesLit > 1) return `${withCommas(city.venuesLit)} venues lit`;
  return 'Nothing on yet';
}
