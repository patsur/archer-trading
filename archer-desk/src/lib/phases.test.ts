import { describe, expect, it } from 'vitest';
import { allowedDirections, applyTransition, fibPrice, fibRatio, phaseHints, transitions, type TrackedPair } from './phases';

const btc: TrackedPair = {
  id: 'x', symbol: 'BTCUSDT', market: 'crypto', bias: 'bullish', phase: 'F1',
  top: 107431.26, fib100: 98958.23, swingExtreme: 98075.19,
  firstStructureHit: false, reversalLevel: null, price: null, notes: '', history: [], updatedAt: '',
};

describe('fib', () => {
  it('matches the levels from the TradingView drawing', () => {
    expect(fibPrice(btc.top!, btc.fib100!, 0.618)).toBeCloseTo(102194.93, 1);
    expect(fibPrice(btc.top!, btc.fib100!, 0.5)).toBeCloseTo(103194.75, 1);
    expect(fibPrice(btc.top!, btc.fib100!, -0.27)).toBeCloseTo(109718.98, 1);
    expect(fibRatio(btc.top!, btc.fib100!, 102194.93)).toBeCloseTo(0.618, 3);
  });
  it('mirrors for bearish', () => {
    expect(fibPrice(1.05, 1.15, 0.618)).toBeCloseTo(1.1118, 4);
  });
});

describe('allowedDirections', () => {
  it('phase 1 before first structure allows both, after only the bias', () => {
    expect(allowedDirections(btc)).toEqual(['long', 'short']);
    expect(allowedDirections({ ...btc, firstStructureHit: true })).toEqual(['long']);
  });
  it('phase 2-4 only with the bias, SoM none', () => {
    expect(allowedDirections({ ...btc, phase: 'F2' })).toEqual(['long']);
    expect(allowedDirections({ ...btc, bias: 'bearish', phase: 'F4' })).toEqual(['short']);
    expect(allowedDirections({ ...btc, phase: 'SOM' })).toEqual([]);
  });
});

describe('transitions', () => {
  it('runs a full cycle and starts a new one from the reversal low', () => {
    let p = applyTransition({ ...btc, firstStructureHit: true }, transitions(btc)[0], 102175.04);
    expect(p.phase).toBe('F2');
    expect(p.reversalLevel).toBe(102175.04);
    p = applyTransition(p, transitions(p)[0], null);
    expect(p.phase).toBe('F3');
    p = applyTransition(p, transitions(p).find((t) => t.to === 'F4')!, null);
    expect(p.phase).toBe('F4');
    p = applyTransition(p, transitions(p)[0], 110000);
    expect(p.phase).toBe('F1');
    expect(p.top).toBe(110000);
    expect(p.fib100).toBe(102175.04);
    expect(p.firstStructureHit).toBe(false);
    expect(p.history).toHaveLength(4);
  });
  it('switch of momentum flips the bias', () => {
    const p = applyTransition(btc, transitions(btc)[1], null);
    expect(p.phase).toBe('SOM');
    expect(p.bias).toBe('bearish');
  });
});

describe('phaseHints', () => {
  it('flags swing low break and first structure zone', () => {
    expect(phaseHints({ ...btc, price: 97000 }).some((h) => h.tone === 'bad')).toBe(true);
    expect(phaseHints({ ...btc, price: 102200 }).some((h) => h.text.includes('first structure'))).toBe(true);
    expect(phaseHints({ ...btc, phase: 'F2', price: 107400 }).some((h) => h.text.includes('fase 3'))).toBe(true);
  });
});
