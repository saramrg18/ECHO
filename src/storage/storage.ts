/** Thin key-value persistence layer so progress/settings logic stays testable. */
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface KeyValueStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

export const deviceStore: KeyValueStore = {
  get: (k) => AsyncStorage.getItem(k),
  set: (k, v) => AsyncStorage.setItem(k, v),
  remove: (k) => AsyncStorage.removeItem(k),
};

export async function loadJson<T>(store: KeyValueStore, key: string): Promise<T | null> {
  try {
    const raw = await store.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export async function saveJson(store: KeyValueStore, key: string, value: unknown): Promise<void> {
  try {
    await store.set(key, JSON.stringify(value));
  } catch {
    // Persistence failures must never crash the game.
  }
}
