import React, { useLayoutEffect, useRef, useState } from 'react';
import { PanResponder, View, type ViewProps } from 'react-native';
import type { Direction } from '../../engine';

const MIN_DISTANCE = 18;

function dirOf(dx: number, dy: number): Direction | null {
  if (Math.max(Math.abs(dx), Math.abs(dy)) < MIN_DISTANCE) return null;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'right' : 'left';
  return dy > 0 ? 'down' : 'up';
}

/**
 * Detects swipes anywhere inside it and reports a direction (one move per swipe).
 * While the finger is down, `onPreview` reports the direction that would be played;
 * dragging back to the start cancels the move.
 */
export function SwipeArea({
  onSwipe,
  onPreview,
  enabled = true,
  ...rest
}: ViewProps & { onSwipe: (d: Direction) => void; onPreview?: (d: Direction | null) => void; enabled?: boolean }) {
  const cb = useRef(onSwipe);
  const pv = useRef(onPreview);
  const on = useRef(enabled);
  const last = useRef<Direction | null>(null);
  useLayoutEffect(() => {
    cb.current = onSwipe;
    pv.current = onPreview;
    on.current = enabled;
  });

  // The handlers only read the refs when a gesture happens, never during render.
  /* eslint-disable react-hooks/refs */
  const [responder] = useState(() =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, g) => on.current && Math.hypot(g.dx, g.dy) > 8,
        onPanResponderTerminationRequest: () => false,
        onPanResponderMove: (_, g) => {
          if (!on.current) return;
          const d = dirOf(g.dx, g.dy);
          if (d !== last.current) {
            last.current = d;
            pv.current?.(d);
          }
        },
        onPanResponderRelease: (_, g) => {
          last.current = null;
          pv.current?.(null);
          if (!on.current) return;
          const d = dirOf(g.dx, g.dy);
          if (d) cb.current(d);
        },
        onPanResponderTerminate: () => {
          last.current = null;
          pv.current?.(null);
        },
      }),
  );
  /* eslint-enable react-hooks/refs */
  return <View {...rest} {...responder.panHandlers} />;
}
