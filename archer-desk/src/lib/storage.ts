import { useEffect, useState } from 'react';

// Local-only storage for v1. The data shapes are kept flat so they can move to
// Supabase later (journal phase) without reshaping.

export function readStored<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    const parsed = JSON.parse(raw);
    // Merge objects so new settings fields get their defaults.
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && fallback && typeof fallback === 'object' && !Array.isArray(fallback)) {
      return { ...fallback, ...parsed };
    }
    return parsed as T;
  } catch {
    return fallback;
  }
}

export function useLocalState<T>(key: string, fallback: T | (() => T)) {
  const [value, setValue] = useState<T>(() => {
    const fb = typeof fallback === 'function' ? (fallback as () => T)() : fallback;
    return readStored(key, fb);
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* storage unavailable — keep working in memory */
    }
  }, [key, value]);
  return [value, setValue] as const;
}

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

export function num(v: string): number | null {
  if (v.trim() === '') return null;
  const n = Number(v.replace(',', '.'));
  return isFinite(n) ? n : null;
}

export function fmtMoney(v: number | null | undefined, ccy: string): string {
  if (v == null || !isFinite(v)) return '—';
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: ccy, maximumFractionDigits: 2 }).format(v);
}

export function fmt(v: number | null | undefined, digits = 2): string {
  if (v == null || !isFinite(v)) return '—';
  return new Intl.NumberFormat('nl-NL', { maximumFractionDigits: digits }).format(v);
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
