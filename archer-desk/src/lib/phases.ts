// BluePrint phase cycle (Weekly). Pure logic, unit-tested.
//
// Bullish example (bearish is the mirror image):
//   fib 0   = "stippellijn": the top where phase 1 started
//   fib 100 = start of the impulse (close), swing extreme = wick beyond it
//   F1 Correctie    price falls from the stippellijn to a weekly level (0.618 first structure,
//                   shoulder, weekly S&D, down to the swing low). Before first structure: both
//                   directions allowed on daily set-ups, after: only with the bias.
//   F2 Impuls       reversal on a weekly level -> only bias set-ups until the stippellijn.
//   F3 Beslissing   at the stippellijn: break & retest -> F4, rejection -> back to F1.
//                   Counter-bias trades allowed here at reduced risk (0.5%).
//   F4 Verderzetting only bias set-ups; rejection / indicational candle -> new F1.
//   Close beyond the swing extreme = switch of momentum: bias flips and the market is in F4
//   of the new bias (the broken swing level acts as the stippellijn).

import type { Direction } from './types';

export type Bias = 'bullish' | 'bearish';
export type PhaseId = 'F1' | 'F2' | 'F3' | 'F4' | 'SOM';

export const FIB_LEVELS: { r: number; label: string }[] = [
  { r: -0.68, label: 'Target -0.68' },
  { r: -0.27, label: 'Target -0.27' },
  { r: 0, label: 'Stippellijn (0)' },
  { r: 0.5, label: '0.5' },
  { r: 0.618, label: 'First structure (0.618)' },
  { r: 0.786, label: '0.786' },
  { r: 1, label: 'Fib 100%' },
];

export interface PairEvent {
  at: string;
  from: PhaseId;
  to: PhaseId;
  note: string;
}

export interface TrackedPair {
  id: string;
  symbol: string;
  market: 'forex' | 'crypto';
  bias: Bias;
  phase: PhaseId;
  top: number | null; // fib 0 / stippellijn
  fib100: number | null; // start of the impulse
  swingExtreme: number | null; // swing low (bull) / swing high (bear) — a close beyond = SoM
  firstStructureHit: boolean;
  reversalLevel: number | null; // where F1 reversed into F2
  price: number | null; // last price you checked
  notes: string;
  history: PairEvent[];
  updatedAt: string;
}

export const biasDirection = (b: Bias): Direction => (b === 'bullish' ? 'long' : 'short');
export const opposite = (d: Direction): Direction => (d === 'long' ? 'short' : 'long');

/** Which trade directions the BluePrint allows in the current state. */
export function allowedDirections(p: Pick<TrackedPair, 'bias' | 'phase' | 'firstStructureHit'>): Direction[] {
  const withBias = biasDirection(p.bias);
  switch (p.phase) {
    case 'F1':
      return p.firstStructureHit ? [withBias] : [withBias, opposite(withBias)];
    case 'F3':
      return [withBias, opposite(withBias)];
    case 'F2':
    case 'F4':
      return [withBias];
    default:
      return []; // switch of momentum: analyse again first
  }
}

/** Price at a fib ratio. Works for both biases because it is measured from the top towards fib 100. */
export function fibPrice(top: number, fib100: number, r: number): number {
  return top + (fib100 - top) * r;
}

/** Where the price sits as a fib ratio (0 = stippellijn, 1 = fib 100%). */
export function fibRatio(top: number, fib100: number, price: number): number {
  return (top - price) / (top - fib100);
}

export interface PhaseHint {
  tone: 'info' | 'warn' | 'bad';
  text: string;
}

/** Suggestions from the last price. The trader confirms transitions, the app only points them out. */
export function phaseHints(p: TrackedPair): PhaseHint[] {
  const hints: PhaseHint[] = [];
  if (p.top == null || p.fib100 == null || p.price == null) return hints;
  const bull = p.bias === 'bullish';
  const r = fibRatio(p.top, p.fib100, p.price);
  const beyondTop = r < 0; // above the stippellijn for bull, below for bear

  if (p.swingExtreme != null && (bull ? p.price < p.swingExtreme : p.price > p.swingExtreme)) {
    hints.push({ tone: 'bad', text: `Prijs voorbij de swing ${bull ? 'low' : 'high'}. Een weekly close hier is een switch of momentum.` });
  }
  if (p.phase === 'F1') {
    if (!p.firstStructureHit && r >= 0.6) hints.push({ tone: 'info', text: 'Prijs zit in de first structure-zone (0.618). Vink "first structure geraakt" aan als het level geraakt is.' });
    if (r >= 0.95 && r <= 1.05) hints.push({ tone: 'warn', text: 'Prijs rond fib 100%: laatste kans op een reversal vóór de switch of momentum. Beste RR, hoogste risico.' });
    if (beyondTop) hints.push({ tone: 'warn', text: 'Prijs voorbij de stippellijn terwijl je in fase 1 staat. Klopt de fase nog?' });
  }
  if (p.phase === 'F2' && r <= 0.02) hints.push({ tone: 'info', text: 'Prijs bereikt de stippellijn. Dat is het begin van fase 3.' });
  if (p.phase === 'F3' && beyondTop) hints.push({ tone: 'info', text: 'Prijs door de stippellijn. Wacht op de retest voor fase 4.' });
  if (p.phase === 'F3' && r > 0.15) hints.push({ tone: 'warn', text: 'Prijs zakt weg van de stippellijn. Rejection? Dan terug naar fase 1.' });
  if (p.phase === 'F4' && r > 0) hints.push({ tone: 'warn', text: 'Prijs terug onder de stippellijn in fase 4. Rejection of indicational candle?' });
  return hints;
}

export interface Transition {
  label: string;
  to: PhaseId;
  /** Extra price the trader enters for this transition. */
  ask?: 'reversalLevel' | 'newTop' | 'som';
}

export function transitions(p: TrackedPair): Transition[] {
  const sw = p.bias === 'bullish' ? 'swing low' : 'swing high';
  switch (p.phase) {
    case 'F1':
      return [
        { label: 'Reversal op weekly level → Fase 2', to: 'F2', ask: 'reversalLevel' },
        { label: `Close voorbij ${sw} → switch of momentum (fase 4 tegengestelde bias)`, to: 'F4', ask: 'som' as const },
      ];
    case 'F2':
      return [{ label: 'Stippellijn bereikt → Fase 3', to: 'F3' }];
    case 'F3':
      return [
        { label: 'Break & retest → Fase 4', to: 'F4' },
        { label: 'Rejection → terug naar Fase 1', to: 'F1' },
      ];
    case 'F4':
      return [{ label: 'Rejection / indicational candle → nieuwe Fase 1', to: 'F1', ask: 'newTop' }];
    default:
      return [];
  }
}

/** Apply a confirmed transition. `value` is the price asked for by the transition, if any. */
export function applyTransition(p: TrackedPair, t: Transition, value: number | null, now = new Date()): TrackedPair {
  const next: TrackedPair = { ...p, phase: t.to, updatedAt: now.toISOString() };
  let note = t.label;
  if (t.ask === 'reversalLevel' && value != null) {
    next.reversalLevel = value;
    note += ` @ ${value}`;
  }
  if (t.to === 'F1') next.firstStructureHit = false;
  if (t.ask === 'newTop' && value != null) {
    // New cycle: the new top becomes the stippellijn, the last reversal low becomes fib 100%.
    if (p.reversalLevel != null) {
      next.fib100 = p.reversalLevel;
      next.swingExtreme = p.reversalLevel;
    }
    next.top = value;
    next.reversalLevel = null;
    note += ` · nieuwe stippellijn ${value}`;
  }
  if (t.ask === 'som') {
    // Mirror the fib: the old top starts the new move (fib 100%), the broken swing level is the new stippellijn.
    next.bias = p.bias === 'bullish' ? 'bearish' : 'bullish';
    next.top = p.swingExtreme;
    next.fib100 = p.top;
    next.swingExtreme = p.top;
    next.reversalLevel = p.top;
    note = `Switch of momentum · bias nu ${next.bias} · fase 4`;
  }
  next.history = [{ at: now.toISOString(), from: p.phase, to: t.to, note }, ...p.history];
  return next;
}
