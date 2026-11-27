/** Global app state: player progress + settings, persisted locally. */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { LEVEL_ORDER } from '../levels';
import {
  initialProgress,
  normalizeProgress,
  recordCompletion,
  type Progress,
} from '../progress/progress';
import { DEFAULT_SETTINGS, normalizeSettings, type Settings } from '../settings/settings';
import { deviceStore, loadJson, saveJson, type KeyValueStore } from '../storage/storage';

const PROGRESS_KEY = 'echo.progress.v1';
const SETTINGS_KEY = 'echo.settings.v1';

interface AppState {
  ready: boolean;
  progress: Progress;
  settings: Settings;
  completeLevel(id: string, moves: number): void;
  setLastPlayed(id: string): void;
  updateSettings(patch: Partial<Omit<Settings, 'version'>>): void;
  resetProgress(): void;
}

const Ctx = createContext<AppState | null>(null);

export function AppStateProvider({ children, store = deviceStore }: { children: React.ReactNode; store?: KeyValueStore }) {
  const [ready, setReady] = useState(false);
  const [progress, setProgress] = useState<Progress>(() => initialProgress(LEVEL_ORDER));
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const loaded = useRef(false);

  useEffect(() => {
    let alive = true;
    Promise.all([loadJson(store, PROGRESS_KEY), loadJson(store, SETTINGS_KEY)]).then(([p, s]) => {
      if (!alive) return;
      setProgress(normalizeProgress(p, LEVEL_ORDER));
      setSettings(normalizeSettings(s));
      loaded.current = true;
      setReady(true);
    });
    return () => {
      alive = false;
    };
  }, [store]);

  useEffect(() => {
    if (loaded.current) saveJson(store, PROGRESS_KEY, progress);
  }, [progress, store]);
  useEffect(() => {
    if (loaded.current) saveJson(store, SETTINGS_KEY, settings);
  }, [settings, store]);

  const completeLevel = useCallback((id: string, moves: number) => {
    setProgress((p) => recordCompletion(p, LEVEL_ORDER, id, moves));
  }, []);
  const setLastPlayed = useCallback((id: string) => {
    setProgress((p) => (p.lastPlayed === id ? p : { ...p, lastPlayed: id }));
  }, []);
  const updateSettings = useCallback((patch: Partial<Omit<Settings, 'version'>>) => {
    setSettings((s) => ({ ...s, ...patch }));
  }, []);
  const resetProgress = useCallback(() => setProgress(initialProgress(LEVEL_ORDER)), []);

  const value = useMemo(
    () => ({ ready, progress, settings, completeLevel, setLastPlayed, updateSettings, resetProgress }),
    [ready, progress, settings, completeLevel, setLastPlayed, updateSettings, resetProgress],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAppState(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAppState must be used inside AppStateProvider');
  return v;
}
