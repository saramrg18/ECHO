export interface Settings {
  readonly version: 1;
  readonly sound: boolean;
  readonly haptics: boolean;
  /** Show the on-screen directional pad (swipes always work). */
  readonly showDpad: boolean;
}

export const DEFAULT_SETTINGS: Settings = { version: 1, sound: true, haptics: true, showDpad: true };

export function normalizeSettings(raw: unknown): Settings {
  if (!raw || typeof raw !== 'object') return DEFAULT_SETTINGS;
  const r = raw as Partial<Settings>;
  const bool = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d);
  return {
    version: 1,
    sound: bool(r.sound, DEFAULT_SETTINGS.sound),
    haptics: bool(r.haptics, DEFAULT_SETTINGS.haptics),
    showDpad: bool(r.showDpad, DEFAULT_SETTINGS.showDpad),
  };
}
