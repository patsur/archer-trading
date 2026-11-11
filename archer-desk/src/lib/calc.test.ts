import { describe, expect, it } from 'vitest';
import { cryptoPosition, floorStep, forexPosition, quoteToAccountRate, riskBudget, riskReward } from './calc';

describe('floorStep', () => {
  it('rounds down to lot step', () => {
    expect(floorStep(1.239, 0.01)).toBe(1.23);
    expect(floorStep(0.3, 0.1)).toBe(0.3);
    expect(floorStep(12.9, 1)).toBe(12);
  });
});

describe('riskReward', () => {
  it('works for long and short', () => {
    expect(riskReward(1.085, 1.082, 1.091)).toBeCloseTo(2);
    expect(riskReward(1.085, 1.088, 1.079)).toBeCloseTo(2);
  });
  it('returns null for TP on wrong side', () => {
    expect(riskReward(1.085, 1.082, 1.08)).toBeNull();
  });
});

describe('quoteToAccountRate', () => {
  it('handles quote = account, base = account, cross', () => {
    expect(quoteToAccountRate('EURUSD', 'USD', 1.08, null).rate).toBe(1);
    expect(quoteToAccountRate('USDJPY', 'USD', 150, null).rate).toBeCloseTo(1 / 150);
    const cross = quoteToAccountRate('EURGBP', 'USD', 0.85, null);
    expect(cross.needsManual).toBe(true);
    expect(cross.rate).toBeNull();
    expect(quoteToAccountRate('EURGBP', 'USD', 0.85, 1.27).rate).toBe(1.27);
  });
});

describe('forexPosition', () => {
  it('EURUSD: 30 pip SL, $1000 risk → 3.33 lots', () => {
    const r = forexPosition({
      entry: 1.085, sl: 1.082, tp: 1.091, pipSize: 0.0001, contractSize: 100000,
      quoteToAccount: 1, riskAmount: 1000, lotStep: 0.01, minLot: 0.01,
    })!;
    expect(r.slPips).toBeCloseTo(30);
    expect(r.pipValuePerLot).toBeCloseTo(10);
    expect(r.lots).toBe(3.33);
    expect(r.actualRisk).toBeCloseTo(999);
    expect(r.rr).toBeCloseTo(2);
    expect(r.long).toBe(true);
  });
  it('XAUUSD: $5 SL, $500 risk → 1 lot', () => {
    const r = forexPosition({
      entry: 2400, sl: 2405, pipSize: 0.1, contractSize: 100,
      quoteToAccount: 1, riskAmount: 500, lotStep: 0.01, minLot: 0.01,
    })!;
    expect(r.lots).toBe(1);
    expect(r.long).toBe(false);
  });
});

describe('cryptoPosition', () => {
  it('sizes BTC with fees and flags liquidation risk', () => {
    const r = cryptoPosition({
      entry: 60000, sl: 59000, tp: 63000, riskAmount: 100, leverage: 10,
      qtyStep: 0.001, feePct: 0.055, includeFees: true, mmrPct: 0.5,
    })!;
    // dist 1000 + fees (119000 * 0.00055 = 65.45) → 0.0938…
    expect(r.qty).toBe(0.093);
    expect(r.actualRisk).toBeLessThanOrEqual(100);
    expect(r.liqPrice).toBeCloseTo(54300);
    expect(r.slBeyondLiq).toBe(false);
    const high = cryptoPosition({ entry: 60000, sl: 59000, riskAmount: 100, leverage: 100, qtyStep: 0.001, feePct: 0, includeFees: false, mmrPct: 0.5 })!;
    expect(high.slBeyondLiq).toBe(true);
  });
});

describe('riskBudget', () => {
  it('takes the tighter of daily and total drawdown', () => {
    const b = riskBudget({ accountSize: 100000, balance: 95000, maxDailyLossPct: 5, maxTotalDdPct: 10, todayPnl: -1000, openRisk: 500 });
    expect(b.remainingDaily).toBe(3500);
    expect(b.remainingTotal).toBe(4500);
    expect(b.remaining).toBe(3500);
  });
  it('profit today does not enlarge the daily limit', () => {
    const b = riskBudget({ accountSize: 100000, balance: 100000, maxDailyLossPct: 5, maxTotalDdPct: 10, todayPnl: 2000, openRisk: 0 });
    expect(b.remainingDaily).toBe(5000);
  });
});
