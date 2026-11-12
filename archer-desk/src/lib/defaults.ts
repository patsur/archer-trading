import type { TrackedPair } from './phases';
import type { ChecklistSection, Settings, TradeDraft } from './types';

// BluePrint weekly phase cycle (see lib/phases.ts).
export const PHASES: { value: string; label: string }[] = [
  { value: 'F1', label: 'Fase 1 — Correctie' },
  { value: 'F2', label: 'Fase 2 — Impuls' },
  { value: 'F3', label: 'Fase 3 — Beslissing' },
  { value: 'F4', label: 'Fase 4 — Verderzetting' },
];
export const phaseLabel = (id: string) =>
  id === 'SOM' ? 'Switch of momentum' : PHASES.find((p) => p.value === id)?.label ?? (id || '—');
/** Which entry types fit each phase (shown as guidance). */
export const PHASE_ENTRY_HINT: Record<string, string> = {
  F1: 'Daily set-ups; reversal (BoS / SoM) op een weekly level',
  F2: 'Continuation met de bias',
  F3: 'Break & Retest van de stippellijn; tegen de bias bij rejection (0,5%)',
  F4: 'Continuation met de bias',
};
export const ZONES = ['Weekly Line Zone', 'Weekly Liquidity Zone', 'Daily S&D Zone'];
export const ENTRY_TYPES = [
  'Reversal — Break of Structure',
  'Reversal — Switch of Momentum',
  'Continuation — Met BoS',
  'Continuation — Zonder BoS',
  'Break & Retest',
  'Pattern in Pattern',
];

export interface InstrumentPreset {
  symbol: string;
  pipSize: number;
  contractSize: number;
}

const fx = (symbol: string): InstrumentPreset => ({
  symbol,
  pipSize: symbol.endsWith('JPY') ? 0.01 : 0.0001,
  contractSize: 100000,
});

export const FOREX_PRESETS: InstrumentPreset[] = [
  ...['EURUSD', 'GBPUSD', 'AUDUSD', 'NZDUSD', 'USDJPY', 'USDCHF', 'USDCAD',
    'EURGBP', 'EURJPY', 'GBPJPY', 'GBPCHF', 'EURCHF', 'AUDJPY', 'CADJPY', 'EURAUD', 'GBPAUD', 'AUDCAD', 'NZDJPY'].map(fx),
  { symbol: 'XAUUSD', pipSize: 0.1, contractSize: 100 },
  { symbol: 'XAGUSD', pipSize: 0.01, contractSize: 5000 },
];

export const CRYPTO_SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XRPUSDT', 'BNBUSDT', 'DOGEUSDT', 'ADAUSDT', 'LINKUSDT', 'AVAXUSDT'];

export const DEFAULT_SETTINGS: Settings = {
  accountName: 'Prop firm challenge',
  currency: 'USD',
  accountSize: 100000,
  balance: 100000,
  riskPct: 1,
  riskByPhase: { F1: 0.5, F2: 1, F3: 0.5, F4: 1 },
  maxDailyLossPct: 5,
  maxTotalDdPct: 10,
  todayPnl: 0,
  openRisk: 0,
  minRR: 2,
  goThreshold: 80,
  bybitFeePct: 0.055,
  bybitMmrPct: 0.5,
  defaultLeverage: 10,
};

// A starting point — edit it in Instellingen to match your exact BluePrint rules.
export const DEFAULT_TEMPLATE: ChecklistSection[] = [
  {
    id: 'ctx',
    title: '1 · Context — Weekly / Daily',
    items: [
      { id: 'ctx-bias', text: 'Weekly bias is duidelijk en de trade gaat mee met de bias', required: true },
      { id: 'ctx-zone', text: 'Prijs reageert op een geldige zone (Weekly Line / Liquidity of Daily S&D)', required: true },
      { id: 'ctx-phase', text: 'Richting is toegelaten in de huidige fase (pair-tracker)', required: true, auto: 'phase' },
      { id: 'ctx-room', text: 'Geen tegengestelde HTF-zone vlak voor mijn target', required: false },
    ],
  },
  {
    id: 'entry',
    title: '2 · Entry — 4H',
    items: [
      { id: 'en-type', text: 'Entry type is bevestigd en past bij de fase', required: true },
      { id: 'en-close', text: 'Bevestiging op candle close — ik anticipeer niet', required: true },
      { id: 'en-sl', text: 'Stop loss staat achter logische structuur, niet op een willekeurig getal', required: true },
      { id: 'en-dir', text: 'Richting klopt met entry en stop loss', required: true, auto: 'direction' },
      { id: 'en-conf', text: 'Extra confluence aanwezig (First Structure, 100%-niveau, Fake Out…)', required: false },
    ],
  },
  {
    id: 'risk',
    title: '3 · Risico & prop firm regels',
    items: [
      { id: 'rk-rr', text: 'Risk/Reward haalt mijn minimum', required: true, auto: 'rr' },
      { id: 'rk-budget', text: 'Risico past binnen daily loss en max drawdown', required: true, auto: 'risk' },
      { id: 'rk-news', text: 'Geen high-impact nieuws op deze valuta in de komende uren', required: true },
      { id: 'rk-corr', text: 'Geen gecorreleerde positie open (dubbel risico op dezelfde valuta)', required: false },
    ],
  },
  {
    id: 'mind',
    title: '4 · Mindset',
    items: [
      { id: 'md-revenge', text: 'Geen revenge-trade of FOMO na een vorige trade', required: true },
      { id: 'md-accept', text: 'Ik accepteer het verlies vooraf als de SL geraakt wordt', required: false },
      { id: 'md-focus', text: 'Ik ben uitgerust en gefocust', required: false },
    ],
  },
];

export function emptyDraft(market: TradeDraft['market'] = 'forex'): TradeDraft {
  return {
    market,
    symbol: '',
    direction: 'long',
    phase: '',
    zone: '',
    entryType: '',
    entry: '',
    sl: '',
    tp: '',
    conversionRate: '',
    checked: {},
    notes: '',
  };
}

/** Example from the TradingView drawing, so the tracker does not open empty. */
export const EXAMPLE_PAIRS: TrackedPair[] = [
  {
    id: 'example-btc',
    symbol: 'BTCUSDT',
    market: 'crypto',
    bias: 'bullish',
    phase: 'F2',
    top: 107431.26,
    fib100: 98958.23,
    swingExtreme: 98075.19,
    firstStructureHit: true,
    reversalLevel: 102175.04,
    price: 104800,
    notes: 'Voorbeeld uit je tekening. Pas aan of verwijder.',
    history: [],
    updatedAt: new Date(0).toISOString(),
  },
];
