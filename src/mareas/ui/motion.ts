/**
 * Motion and haptics for MAREAS, following the expo-animation skill:
 * Reanimated on the UI thread, transform/opacity only, strong ease-out, short durations,
 * and one haptic per player action, fired in the same frame as its visual.
 */
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import { Easing, FadeIn, FadeInDown, FadeInUp, FadeOut, cubicBezier } from 'react-native-reanimated';

export const CSS_EASE_OUT = cubicBezier(0.23, 1, 0.32, 1);
export const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);

/** Press feedback: 120 ms scale transition. */
export const pressTransition = {
  transitionProperty: 'transform',
  transitionDuration: 120,
  transitionTimingFunction: CSS_EASE_OUT,
} as const;

/** Card lift when selected: 160 ms. */
export const liftTransition = { ...pressTransition, transitionDuration: 160 } as const;

// Layout animations. Reanimated honours the system "reduce motion" setting by default.
export const bannerIn = FadeInDown.duration(220).easing(EASE_OUT);
export const bannerOut = FadeOut.duration(160);
export const panelIn = FadeInUp.duration(260).easing(EASE_OUT);
export const overlayIn = FadeIn.duration(200);

const on = Platform.OS !== 'web';
export const haptic = {
  /** Picking a card. */
  select: () => on && Haptics.selectionAsync().catch(() => {}),
  /** A card lands on the sea. */
  play: () => on && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}),
  /** The tide turns: a heavy, rare moment. */
  tide: () => on && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}),
  win: () => on && Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}),
  fail: () => on && Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {}),
};
