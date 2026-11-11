import { cryptoPosition, forexPosition, quoteToAccountRate, riskBudget } from './calc';
import { FOREX_PRESETS } from './defaults';
import { num } from './storage';
import type { Settings, TradeDraft } from './types';

export interface DraftSizing {
  entry: number | null;
  sl: number | null;
  tp: number | null;
  rr: number | null;
  directionOk: boolean | null;
  riskPct: number;
  riskAmount: number;
  budgetRemaining: number;
  withinBudget: boolean | null;
  size: number | null;
  sizeLabel: string;
  actualRisk: number | null;
  reward: number | null;
  needsConversion: boolean;
  conversionQuote: string | null;
  warning: string | null;
}

export function riskPctFor(s: Settings, phase: string): number {
  const v = s.riskByPhase?.[phase];
  return typeof v === 'number' && v > 0 ? v : s.riskPct;
}

export function presetFor(symbol: string) {
  const s = symbol.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return FOREX_PRESETS.find((p) => p.symbol === s) ?? null;
}

/** Everything the checklist needs to know about the plan in one place. */
export function sizeDraft(d: TradeDraft, s: Settings): DraftSizing {
  const entry = num(d.entry);
  const sl = num(d.sl);
  const tp = num(d.tp);
  const budget = riskBudget(s);
  const riskPct = riskPctFor(s, d.phase);
  const riskAmount = Math.min((s.accountSize * riskPct) / 100, budget.remaining);
  const base: DraftSizing = {
    entry, sl, tp, rr: null, directionOk: null,
    riskPct, riskAmount, budgetRemaining: budget.remaining, withinBudget: null,
    size: null, sizeLabel: d.market === 'forex' ? 'lots' : 'qty',
    actualRisk: null, reward: null, needsConversion: false, conversionQuote: null, warning: null,
  };
  if (entry == null || sl == null || entry === sl) return base;

  base.directionOk = d.direction === 'long' ? sl < entry : sl > entry;

  if (d.market === 'forex') {
    const preset = presetFor(d.symbol);
    const conv = quoteToAccountRate(d.symbol, s.currency, entry, num(d.conversionRate));
    base.needsConversion = conv.needsManual;
    base.conversionQuote = conv.quote;
    if (!preset) {
      base.warning = 'Onbekend symbool — gebruik de calculator voor custom pip- en contractgrootte.';
      return base;
    }
    if (conv.rate == null) {
      base.warning = `Vul de koers ${conv.quote ?? 'quote'} → ${s.currency} in om de lotsize te berekenen.`;
      return base;
    }
    const r = forexPosition({
      entry, sl, tp, pipSize: preset.pipSize, contractSize: preset.contractSize,
      quoteToAccount: conv.rate, riskAmount, lotStep: 0.01, minLot: 0.01,
    });
    if (!r) return base;
    Object.assign(base, { rr: r.rr, size: r.lots, actualRisk: r.actualRisk, reward: r.reward });
    if (r.belowMinLot) base.warning = 'Stop loss te groot voor minimaal 0,01 lot binnen je risico.';
  } else {
    const r = cryptoPosition({
      entry, sl, tp, riskAmount, leverage: s.defaultLeverage, qtyStep: 0.001,
      feePct: s.bybitFeePct, includeFees: true, mmrPct: s.bybitMmrPct,
    });
    if (!r) return base;
    Object.assign(base, { rr: r.rr, size: r.qty, actualRisk: r.actualRisk, reward: r.reward });
    if (r.slBeyondLiq) base.warning = `Let op: liquidatie (~${r.liqPrice.toFixed(2)}) ligt vóór je stop loss bij ${s.defaultLeverage}x.`;
  }
  base.withinBudget = base.actualRisk != null && base.actualRisk > 0 && base.actualRisk <= budget.remaining;
  return base;
}
