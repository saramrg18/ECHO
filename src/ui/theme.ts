import { Platform } from 'react-native';

export const colors = {
  bg: '#090C13',
  bgElevated: '#0F141E',
  surface: '#131A26',
  surfaceHigh: '#1A2231',
  border: '#232C3D',
  board: '#0E131C',
  tile: '#141B28',
  tileAlt: '#131926',
  wall: '#283142',
  wallTop: '#37425A',
  text: '#E9EEF6',
  textDim: '#8A95A8',
  textFaint: '#566176',
  player: '#FF8A3D',
  playerGlow: 'rgba(255,138,61,0.35)',
  echo: '#2DE2FF',
  echoGlow: 'rgba(45,226,255,0.28)',
  exit: '#5CFFB0',
  exitGlow: 'rgba(92,255,176,0.28)',
  danger: '#FF5D6C',
  groups: {
    a: '#B08CFF',
    b: '#FFD166',
    c: '#FF6FA3',
    d: '#E9EEF6',
  } as Record<string, string>,
};

export const font = {
  family: Platform.select({ ios: 'System', android: 'sans-serif', default: 'System' }),
  mono: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
};

export const radius = { sm: 8, md: 14, lg: 20, pill: 999 };
export const space = (n: number) => n * 4;

export const motion = {
  step: 130,
  echoStep: 170,
  bump: 90,
};
