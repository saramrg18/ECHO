/** HEXFORT campaign progress, collection and deck, persisted on the device. */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { deviceStore, loadJson, saveJson } from '../../storage/storage';
import { initialSave, normalizeSave, recordWin, type CardId, type HexSave, type MapDef } from '../engine';

const KEY = 'hexfort.save.v1';

interface HexState {
  ready: boolean;
  save: HexSave;
  winMap(map: MapDef): CardId[];
  setDeck(deck: CardId[]): void;
  seenTutorial: boolean;
  markTutorial(): void;
  reset(): void;
}

const Ctx = createContext<HexState | null>(null);

export function HexProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [save, setSave] = useState<HexSave>(initialSave);
  const [seenTutorial, setSeen] = useState(false);
  const loaded = useRef(false);
  const saveRef = useRef(save);
  useEffect(() => {
    saveRef.current = save;
  }, [save]);

  useEffect(() => {
    Promise.all([loadJson(deviceStore, KEY), loadJson<boolean>(deviceStore, `${KEY}.tutorial`)]).then(([raw, tut]) => {
      setSave(normalizeSave(raw));
      setSeen(tut === true);
      loaded.current = true;
      setReady(true);
    });
  }, []);

  useEffect(() => {
    if (loaded.current) saveJson(deviceStore, KEY, save);
  }, [save]);

  const winMap = useCallback((map: MapDef) => {
    const res = recordWin(saveRef.current, map);
    setSave(res.save);
    return res.unlocked;
  }, []);

  const value = useMemo<HexState>(
    () => ({
      ready,
      save,
      winMap,
      setDeck: (deck) => setSave((s) => ({ ...s, deck })),
      seenTutorial,
      markTutorial: () => {
        setSeen(true);
        saveJson(deviceStore, `${KEY}.tutorial`, true);
      },
      reset: () => setSave(initialSave()),
    }),
    [ready, save, winMap, seenTutorial],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useHex(): HexState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useHex outside HexProvider');
  return v;
}
