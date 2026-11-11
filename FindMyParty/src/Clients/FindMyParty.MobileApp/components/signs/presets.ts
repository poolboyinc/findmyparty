// The six colour looks a host can give a sign (S-20, "Your sign"). A sign is drawn art, so its colours
// are written out here rather than taken from the theme. Every colour is six hex digits: the map's
// sign-art addresses accept nothing else.

export type SignPreset = {
  id: string;
  /** Read out by VoiceOver. */
  name: string;
  colorTop: string;
  colorBottom: string;
  /** The letters. */
  ink: string;
};

export const SIGN_PRESETS: readonly SignPreset[] = [
  // The mock's VOLT panel.
  { id: 'sunrise', name: 'Yellow into orange', colorTop: '#ffd23c', colorBottom: '#ff7a18', ink: '#1a0a00' },
  // The mock's KULA panel.
  { id: 'violet', name: 'Violet into rose', colorTop: '#3a1bd6', colorBottom: '#ec5b93', ink: '#ffffff' },
  { id: 'ocean', name: 'Blue into indigo', colorTop: '#22a8ff', colorBottom: '#5a2bff', ink: '#ffffff' },
  { id: 'ember', name: 'Red into crimson', colorTop: '#ff5a3c', colorBottom: '#c2185b', ink: '#ffffff' },
  { id: 'lagoon', name: 'Teal into violet', colorTop: '#19c7a0', colorBottom: '#7d08fa', ink: '#ffffff' },
  { id: 'paper', name: 'White on grey', colorTop: '#f5f3ff', colorBottom: '#b9b4cc', ink: '#0b0a10' },
];

export const DEFAULT_PRESET = SIGN_PRESETS[0];

export function presetById(id: string | null | undefined): SignPreset {
  return SIGN_PRESETS.find((p) => p.id === id) ?? DEFAULT_PRESET;
}
