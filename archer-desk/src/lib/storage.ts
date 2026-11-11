import { useEffect, useState } from 'react';

// Local-only storage for v1. The data shapes are kept flat so they can move to
// Supabase later (journal phase) without reshaping.

function read<T>(key: string, fallback: T): T {
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

export function useLocalState<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(() => read(key, fallback));
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

export function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
