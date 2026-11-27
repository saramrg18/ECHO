import React, { useLayoutEffect, useMemo, useRef } from 'react';
import { PanResponder, View, type ViewProps } from 'react-native';
import type { Direction } from '../../engine';

const MIN_DISTANCE = 18;

/** Detects swipes anywhere inside it and reports a direction (one move per swipe). */
export function SwipeArea({ onSwipe, enabled = true, ...rest }: ViewProps & { onSwipe: (d: Direction) => void; enabled?: boolean }) {
  const cb = useRef(onSwipe);
  const on = useRef(enabled);
  useLayoutEffect(() => {
    cb.current = onSwipe;
    on.current = enabled;
  });

  // The handlers only read the refs when a gesture happens, never during render.
  /* eslint-disable react-hooks/refs */
  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, g) => on.current && Math.hypot(g.dx, g.dy) > 8,
        onPanResponderTerminationRequest: () => false,
        onPanResponderRelease: (_, g) => {
          if (!on.current) return;
          const { dx, dy } = g;
          if (Math.max(Math.abs(dx), Math.abs(dy)) < MIN_DISTANCE) return;
          if (Math.abs(dx) > Math.abs(dy)) cb.current(dx > 0 ? 'right' : 'left');
          else cb.current(dy > 0 ? 'down' : 'up');
        },
      }),
    [],
  );
  /* eslint-enable react-hooks/refs */
  return <View {...rest} {...responder.panHandlers} />;
}
