/** Sound + haptics. All calls are fire-and-forget and never throw. */
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

export type Cue = 'move' | 'echo' | 'blocked' | 'toggle' | 'win' | 'lose';

const SOURCES: Record<Cue, number> = {
  move: require('../../assets/sounds/move.wav'),
  echo: require('../../assets/sounds/echo.wav'),
  blocked: require('../../assets/sounds/blocked.wav'),
  toggle: require('../../assets/sounds/toggle.wav'),
  win: require('../../assets/sounds/win.wav'),
  lose: require('../../assets/sounds/lose.wav'),
};

const players: Partial<Record<Cue, AudioPlayer>> = {};
let modeSet = false;

function player(cue: Cue): AudioPlayer | undefined {
  try {
    if (!modeSet) {
      modeSet = true;
      setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers' }).catch(() => {});
    }
    if (!players[cue]) {
      const p = createAudioPlayer(SOURCES[cue]);
      p.volume = cue === 'win' ? 0.7 : 0.5;
      players[cue] = p;
    }
    return players[cue];
  } catch {
    return undefined;
  }
}

export function playSound(cue: Cue): void {
  const p = player(cue);
  if (!p) return;
  try {
    p.seekTo(0).catch(() => {});
    p.play();
  } catch {
    // ignore
  }
}

export function haptic(cue: Cue): void {
  if (Platform.OS === 'web') return;
  const run = () => {
    switch (cue) {
      case 'move':
        return Haptics.selectionAsync();
      case 'echo':
        return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
      case 'blocked':
        return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid);
      case 'toggle':
        return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      case 'win':
        return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      case 'lose':
        return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };
  run()?.catch(() => {});
}

export function feedback(cue: Cue, opts: { sound: boolean; haptics: boolean }): void {
  if (opts.sound) playSound(cue);
  if (opts.haptics) haptic(cue);
}
