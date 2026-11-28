/** MAREAS progress (shells, pearls, card levels, decks), saved on the device. */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { deviceStore, loadJson, saveJson } from '../../storage/storage';
import {
  applyResult,
  initialSave,
  normalizeSave,
  upgradeCard,
  type CardId,
  type MareasSave,
  type Result,
  type Reward,
} from '../engine';

const KEY = 'mareas.save.v1';

interface MareasState {
  ready: boolean;
  save: MareasSave;
  finishMatch(result: Result, tutorial: boolean): Reward;
  setDeck(slot: number, deck: CardId[]): void;
  setActiveDeck(slot: number): void;
  upgrade(id: CardId): boolean;
  reset(): void;
}

const Ctx = createContext<MareasState | null>(null);

export function MareasProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [save, setSave] = useState<MareasSave>(initialSave);
  const loaded = useRef(false);
  const saveRef = useRef(save);
  useEffect(() => {
    saveRef.current = save;
  }, [save]);

  useEffect(() => {
    loadJson(deviceStore, KEY).then((raw) => {
      setSave(normalizeSave(raw));
      loaded.current = true;
      setReady(true);
    });
  }, []);

  useEffect(() => {
    if (loaded.current) saveJson(deviceStore, KEY, save);
  }, [save]);

  const finishMatch = useCallback((result: Result, tutorial: boolean) => {
    const r = applyResult(saveRef.current, result, tutorial);
    saveRef.current = r.save;
    setSave(r.save);
    return r.reward;
  }, []);

  const upgrade = useCallback((id: CardId) => {
    const next = upgradeCard(saveRef.current, id);
    if (!next) return false;
    saveRef.current = next;
    setSave(next);
    return true;
  }, []);

  const value = useMemo<MareasState>(
    () => ({
      ready,
      save,
      finishMatch,
      upgrade,
      setDeck: (slot, deck) => setSave((s) => ({ ...s, decks: s.decks.map((d, i) => (i === slot ? deck : d)) })),
      setActiveDeck: (slot) => setSave((s) => ({ ...s, activeDeck: slot })),
      reset: () => setSave(initialSave()),
    }),
    [ready, save, finishMatch, upgrade],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useMareas(): MareasState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useMareas outside MareasProvider');
  return v;
}
