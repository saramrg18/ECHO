/** React binding for the engine: session state, undo/restart and feedback cues. */
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  canUndo,
  createSession,
  restart as restartSession,
  sessionMove,
  undo as undoSession,
  upcomingEchoes,
  type Direction,
  type GameSession,
  type Level,
} from '../engine';
import { feedback } from '../feedback/feedback';
import type { Settings } from '../settings/settings';

export function useGame(level: Level, settings: Settings, onWin?: (moves: number) => void) {
  const [session, setSession] = useState<GameSession>(() => createSession(level));
  const [version, setVersion] = useState(0);
  const ref = useRef(session);
  const optsRef = useRef({ sound: settings.sound, haptics: settings.haptics });
  const winRef = useRef(onWin);
  useLayoutEffect(() => {
    optsRef.current = { sound: settings.sound, haptics: settings.haptics };
    winRef.current = onWin;
  });

  const commit = (s: GameSession) => {
    ref.current = s;
    setSession(s);
    setVersion((v) => v + 1);
  };

  const move = useCallback((dir: Direction) => {
    const { session: next, result } = sessionMove(ref.current, dir);
    const fb = optsRef.current;
    if (!result.accepted) {
      if (result.reason === 'blocked') feedback('blocked', fb);
      return;
    }
    commit(next);
    const st = result.state;
    if (st.status === 'won') {
      feedback('win', fb);
      winRef.current?.(st.turn);
      return;
    }
    if (st.status === 'lost') {
      feedback('lose', fb);
      return;
    }
    const steps = st.lastSteps;
    const toggled = steps.some((s) => s.effects.some((e) => e.startsWith('toggle')));
    const echoed = steps.some((s) => s.actor === 'echo' && !s.blocked);
    feedback(toggled ? 'toggle' : echoed ? 'echo' : 'move', fb);
  }, []);

  const undo = useCallback(() => {
    if (!canUndo(ref.current)) return;
    commit(undoSession(ref.current));
    feedback('move', optsRef.current);
  }, []);

  const restart = useCallback(() => {
    commit(restartSession(ref.current));
  }, []);

  const state = session.current;
  const upcoming = useMemo(() => upcomingEchoes(state), [state]);
  return {
    state,
    version,
    upcoming,
    canUndo: canUndo(session),
    move,
    undo,
    restart,
  };
}
