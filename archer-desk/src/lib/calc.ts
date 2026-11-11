// Pure calculation functions. No React here so they can be unit-tested.

/** Round down to the nearest step (e.g. 0.01 lots) so risk never exceeds the plan. */
export function floorStep(value: number, step: number): number {
  if (!(step > 0) || !isFinite(value)) return 0;
  const decimals = Math.max(0, Math.ceil(-Math.log10(step)));
  const floored = Math.floor(value / step + 1e-9) * step;
  return Number(floored.toFixed(decimals));
}

export function isLong(entry: number, sl: number): boolean {
  return sl < entry;
}

/** Reward/risk ratio; null when TP is missing or on the wrong side. */
export function riskReward(entry: number, sl: number, tp?: number | null): number | null {
  const risk = Math.abs(entry - sl);
  if (!(risk > 0) || tp == null || !isFinite(tp)) return null;
  const long = isLong(entry, sl);
  const reward = long ? tp - entry : entry - tp;
  if (!(reward > 0)) return null;
  return reward / risk;
}

export function splitSymbol(symbol: string): { base: string; quote: string } | null {
  const clean = symbol.toUpperCase().replace(/[^A-Z]/g, '');
  if (clean.length !== 6) return null;
  return { base: clean.slice(0, 3), quote: clean.slice(3) };
}

/**
 * How much 1 unit of the quote currency is worth in the account currency.
 * - quote == account (EURUSD on a USD account) → 1
 * - base == account (USDJPY on a USD account) → 1 / price
 * - otherwise (EURGBP on a USD account) the user must provide the rate.
 */
export function quoteToAccountRate(
  symbol: string,
  accountCcy: string,
  price: number,
  manualRate: number | null,
): { rate: number | null; needsManual: boolean; quote: string | null } {
  const parts = splitSymbol(symbol);
  const acc = accountCcy.toUpperCase();
  if (!parts) return { rate: manualRate, needsManual: true, quote: null };
  if (parts.quote === acc) return { rate: 1, needsManual: false, quote: parts.quote };
  if (parts.base === acc && price > 0) return { rate: 1 / price, needsManual: false, quote: parts.quote };
  return { rate: manualRate && manualRate > 0 ? manualRate : null, needsManual: true, quote: parts.quote };
}

export interface ForexInput {
  entry: number;
  sl: number;
  tp?: number | null;
  pipSize: number; // 0.0001, 0.01 for JPY, 0.1 for gold
  contractSize: number; // 100000 for FX, 100 for XAUUSD
  quoteToAccount: number;
  riskAmount: number;
  lotStep: number;
  minLot: number;
}

export interface ForexResult {
  long: boolean;
  slPips: number;
  tpPips: number | null;
  pipValuePerLot: number;
  rawLots: number;
  lots: number;
  belowMinLot: boolean;
  actualRisk: number;
  reward: number | null;
  rr: number | null;
}

export function forexPosition(i: ForexInput): ForexResult | null {
  const dist = Math.abs(i.entry - i.sl);
  if (!(dist > 0) || !(i.pipSize > 0) || !(i.contractSize > 0) || !(i.quoteToAccount > 0) || !(i.riskAmount > 0)) {
    return null;
  }
  const lossPerLot = dist * i.contractSize * i.quoteToAccount;
  const rawLots = i.riskAmount / lossPerLot;
  const lots = floorStep(rawLots, i.lotStep);
  const rr = riskReward(i.entry, i.sl, i.tp);
  const tpDist = rr != null && i.tp != null ? Math.abs(i.tp - i.entry) : null;
  return {
    long: isLong(i.entry, i.sl),
    slPips: dist / i.pipSize,
    tpPips: tpDist != null ? tpDist / i.pipSize : null,
    pipValuePerLot: i.pipSize * i.contractSize * i.quoteToAccount,
    rawLots,
    lots,
    belowMinLot: lots < i.minLot,
    actualRisk: lots * lossPerLot,
    reward: tpDist != null ? tpDist * lots * i.contractSize * i.quoteToAccount : null,
    rr,
  };
}

export interface CryptoInput {
  entry: number;
  sl: number;
  tp?: number | null;
  riskAmount: number;
  leverage: number;
  qtyStep: number;
  feePct: number; // taker fee per side, Bybit default 0.055
  includeFees: boolean;
  mmrPct: number; // maintenance margin rate, ~0.5 for majors
}

export interface CryptoResult {
  long: boolean;
  rawQty: number;
  qty: number;
  notional: number;
  margin: number;
  feesAtSl: number;
  actualRisk: number;
  reward: number | null;
  rr: number | null;
  liqPrice: number;
  slBeyondLiq: boolean;
}

/** Bybit USDT linear perpetual sizing (isolated margin). */
export function cryptoPosition(i: CryptoInput): CryptoResult | null {
  const dist = Math.abs(i.entry - i.sl);
  if (!(dist > 0) || !(i.riskAmount > 0) || !(i.leverage > 0)) return null;
  const fee = i.includeFees ? i.feePct / 100 : 0;
  const feePerUnitAtSl = (i.entry + i.sl) * fee;
  const rawQty = i.riskAmount / (dist + feePerUnitAtSl);
  const qty = floorStep(rawQty, i.qtyStep);
  const long = isLong(i.entry, i.sl);
  const notional = qty * i.entry;
  const mmr = i.mmrPct / 100;
  const liqPrice = long ? i.entry * (1 - 1 / i.leverage + mmr) : i.entry * (1 + 1 / i.leverage - mmr);
  const rr = riskReward(i.entry, i.sl, i.tp);
  const reward =
    rr != null && i.tp != null ? qty * (Math.abs(i.tp - i.entry) - (i.entry + i.tp) * fee) : null;
  return {
    long,
    rawQty,
    qty,
    notional,
    margin: notional / i.leverage,
    feesAtSl: qty * feePerUnitAtSl,
    actualRisk: qty * (dist + feePerUnitAtSl),
    reward,
    rr,
    liqPrice,
    slBeyondLiq: long ? i.sl <= liqPrice : i.sl >= liqPrice,
  };
}

export interface BudgetInput {
  accountSize: number;
  balance: number;
  maxDailyLossPct: number;
  maxTotalDdPct: number;
  todayPnl: number; // realised + floating today, negative = loss
  openRisk: number; // risk still open on running trades
}

export interface BudgetResult {
  dailyLimit: number;
  remainingDaily: number;
  ddFloor: number;
  remainingTotal: number;
  remaining: number; // the tighter of the two
}

/** Prop-firm risk budget: how much can still be lost before a rule breaks. */
export function riskBudget(b: BudgetInput): BudgetResult {
  const dailyLimit = (b.accountSize * b.maxDailyLossPct) / 100;
  const remainingDaily = dailyLimit + Math.min(0, b.todayPnl) - b.openRisk;
  const ddFloor = b.accountSize * (1 - b.maxTotalDdPct / 100);
  const remainingTotal = b.balance - ddFloor - b.openRisk;
  return {
    dailyLimit,
    remainingDaily,
    ddFloor,
    remainingTotal,
    remaining: Math.max(0, Math.min(remainingDaily, remainingTotal)),
  };
}
