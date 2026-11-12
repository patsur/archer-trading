export type Market = 'forex' | 'crypto';
export type Direction = 'long' | 'short';
export type AutoCheck = 'rr' | 'risk' | 'direction' | 'phase';

export interface ChecklistItem {
  id: string;
  text: string;
  required: boolean;
  auto?: AutoCheck; // checked automatically from the trade plan
}

export interface ChecklistSection {
  id: string;
  title: string;
  items: ChecklistItem[];
}

export interface Settings {
  accountName: string;
  currency: string;
  accountSize: number;
  balance: number;
  riskPct: number;
  riskByPhase: Record<string, number>; // empty = use riskPct
  maxDailyLossPct: number;
  maxTotalDdPct: number;
  todayPnl: number;
  openRisk: number;
  minRR: number;
  goThreshold: number; // % of items checked for GO
  bybitFeePct: number;
  bybitMmrPct: number;
  defaultLeverage: number;
}

export interface TradeDraft {
  market: Market;
  symbol: string;
  direction: Direction;
  phase: string;
  zone: string;
  entryType: string;
  entry: string;
  sl: string;
  tp: string;
  conversionRate: string;
  checked: Record<string, boolean>;
  notes: string;
}

export type Verdict = 'GO' | 'TWIJFEL' | 'NO GO';

export interface LogEntry {
  id: string;
  createdAt: string;
  market: Market;
  symbol: string;
  direction: Direction;
  phase: string;
  zone: string;
  entryType: string;
  entry: number | null;
  sl: number | null;
  tp: number | null;
  rr: number | null;
  size: number | null; // lots (forex) or qty (crypto)
  riskAmount: number | null;
  score: number;
  verdict: Verdict;
  missingRequired: string[];
  taken: boolean;
  notes: string;
}
