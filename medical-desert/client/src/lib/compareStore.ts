import { useSyncExternalStore } from 'react';

// Tiny cross-page store for the compare tray (max 4 districts), persisted to sessionStorage.
const KEY = 'md-compare';
type Item = { district_name: string; state_ut: string };

function read(): string[] {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

let state: string[] = read();
const listeners = new Set<() => void>();

function emit() {
  try { sessionStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignore */ }
  listeners.forEach((l) => l());
}

const keyOf = (d: Item) => `${d.district_name}|${d.state_ut}`;

export const compareStore = {
  subscribe(cb: () => void) { listeners.add(cb); return () => listeners.delete(cb); },
  getSnapshot() { return state; },
  toggle(d: Item) {
    const k = keyOf(d);
    state = state.includes(k) ? state.filter((x) => x !== k) : (state.length >= 4 ? state : [...state, k]);
    emit();
  },
  remove(k: string) { state = state.filter((x) => x !== k); emit(); },
  clear() { state = []; emit(); },
  has(d: Item) { return state.includes(keyOf(d)); },
};

export function useCompare() {
  const keys = useSyncExternalStore(compareStore.subscribe, compareStore.getSnapshot);
  return {
    keys,
    toggle: compareStore.toggle,
    remove: compareStore.remove,
    clear: compareStore.clear,
    has: (d: Item) => keys.includes(keyOf(d)),
  };
}
