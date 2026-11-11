import { useState } from 'react';
import { Field, Segmented, Stat } from '../components/Field';
import { cryptoPosition, forexPosition, quoteToAccountRate, riskBudget } from '../lib/calc';
import { CRYPTO_SYMBOLS, FOREX_PRESETS } from '../lib/defaults';
import { presetFor } from '../lib/sizing';
import { fmt, fmtMoney, num, useLocalState } from '../lib/storage';
import type { Market, Settings } from '../lib/types';

interface CalcState {
  market: Market;
  riskMode: 'pct' | 'amount';
  riskPct: string;
  riskAmount: string;
  symbol: string;
  pipSize: string;
  contractSize: string;
  conversionRate: string;
  lotStep: string;
  entry: string;
  sl: string;
  tp: string;
  leverage: string;
  qtyStep: string;
  includeFees: boolean;
  partialPct: string;
  partialAtR: string;
}

export default function CalculatorPage({ settings }: { settings: Settings }) {
  const [c, setC] = useLocalState<CalcState>('archer.calc', {
    market: 'forex', riskMode: 'pct', riskPct: String(settings.riskPct), riskAmount: '',
    symbol: 'EURUSD', pipSize: '0.0001', contractSize: '100000', conversionRate: '', lotStep: '0.01',
    entry: '', sl: '', tp: '', leverage: String(settings.defaultLeverage), qtyStep: '0.001', includeFees: true,
    partialPct: '50', partialAtR: '1',
  });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const set = (patch: Partial<CalcState>) => setC((s) => ({ ...s, ...patch }));

  const ccy = settings.currency;
  const budget = riskBudget(settings);
  const riskAmount = c.riskMode === 'pct' ? (settings.accountSize * (num(c.riskPct) ?? 0)) / 100 : num(c.riskAmount) ?? 0;
  const entry = num(c.entry);
  const sl = num(c.sl);
  const tp = num(c.tp);

  const chooseSymbol = (symbol: string) => {
    const p = presetFor(symbol);
    set({ symbol, ...(p ? { pipSize: String(p.pipSize), contractSize: String(p.contractSize) } : {}) });
  };

  const conv = quoteToAccountRate(c.symbol, ccy, entry ?? 0, num(c.conversionRate));
  // Metals like XAUUSD split as XAU/USD, so the same logic applies.

  const fx = c.market === 'forex' && entry != null && sl != null && conv.rate != null
    ? forexPosition({
        entry, sl, tp, pipSize: num(c.pipSize) ?? 0, contractSize: num(c.contractSize) ?? 0,
        quoteToAccount: conv.rate, riskAmount, lotStep: num(c.lotStep) ?? 0.01, minLot: num(c.lotStep) ?? 0.01,
      })
    : null;
  const cr = c.market === 'crypto' && entry != null && sl != null
    ? cryptoPosition({
        entry, sl, tp, riskAmount, leverage: num(c.leverage) ?? 1, qtyStep: num(c.qtyStep) ?? 0.001,
        feePct: settings.bybitFeePct, includeFees: c.includeFees, mmrPct: settings.bybitMmrPct,
      })
    : null;

  const result = fx ?? cr;
  const actualRisk = result?.actualRisk ?? null;
  const overBudget = actualRisk != null && actualRisk > budget.remaining;

  // Partial close plan: close X% at N R, move SL to break-even, rest runs to TP.
  const partialPct = (num(c.partialPct) ?? 0) / 100;
  const partialR = num(c.partialAtR) ?? 0;
  const rr = result?.rr ?? null;
  const partialOutcome = actualRisk != null && rr != null && partialPct > 0 && partialR > 0 && partialR < rr
    ? { atTp: actualRisk * (partialPct * partialR + (1 - partialPct) * rr), atBe: actualRisk * partialPct * partialR }
    : null;

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Positie calculator</h1>
          <p className="muted">Lotsize voor MT5 en hoeveelheid voor Bybit, op basis van je risico.</p>
        </div>
        <Segmented
          value={c.market}
          onChange={(market) => set({ market, symbol: market === 'forex' ? 'EURUSD' : 'BTCUSDT' })}
          options={[{ value: 'forex', label: 'Forex · MT5' }, { value: 'crypto', label: 'Crypto · Bybit' }]}
        />
      </header>

      <div className="two-col">
        <div className="col-main">
          <section className="card">
            <h2>Risico</h2>
            <div className="grid-3">
              <Field label="Modus">
                <Segmented value={c.riskMode} onChange={(riskMode) => set({ riskMode })}
                  options={[{ value: 'pct', label: '% account' }, { value: 'amount', label: `Vast ${ccy}` }]} />
              </Field>
              {c.riskMode === 'pct' ? (
                <Field label="Risico %" hint={`van ${fmtMoney(settings.accountSize, ccy)} = ${fmtMoney(riskAmount, ccy)}`}>
                  <input inputMode="decimal" value={c.riskPct} onChange={(e) => set({ riskPct: e.target.value })} />
                </Field>
              ) : (
                <Field label={`Risico ${ccy}`}>
                  <input inputMode="decimal" value={c.riskAmount} onChange={(e) => set({ riskAmount: e.target.value })} />
                </Field>
              )}
              <Field label="Budget vandaag" hint="Daily loss / max DD, de krapste">
                <div className={`readout mono ${budget.remaining <= 0 ? 'bad' : ''}`}>{fmtMoney(budget.remaining, ccy)}</div>
              </Field>
            </div>
          </section>

          <section className="card">
            <h2>Instrument & niveaus</h2>
            <div className="grid-3">
              <Field label="Symbool">
                <input list="calc-symbols" value={c.symbol} onChange={(e) => chooseSymbol(e.target.value.toUpperCase())} />
                <datalist id="calc-symbols">
                  {(c.market === 'forex' ? FOREX_PRESETS.map((p) => p.symbol) : CRYPTO_SYMBOLS).map((s) => <option key={s} value={s} />)}
                </datalist>
              </Field>
              {c.market === 'forex' ? (
                <Field label={`Koers 1 ${conv.quote ?? 'quote'} = ? ${ccy}`} hint={conv.needsManual ? 'Nodig voor crosses' : 'Automatisch'}>
                  <input inputMode="decimal" disabled={!conv.needsManual} value={conv.needsManual ? c.conversionRate : fmt(conv.rate, 6)}
                    onChange={(e) => set({ conversionRate: e.target.value })} />
                </Field>
              ) : (
                <Field label="Leverage" hint="Isolated margin">
                  <input inputMode="decimal" value={c.leverage} onChange={(e) => set({ leverage: e.target.value })} />
                </Field>
              )}
              <div className="field">
                <span className="field-label">&nbsp;</span>
                <button className="ghost" onClick={() => setShowAdvanced((v) => !v)}>{showAdvanced ? 'Verberg' : 'Toon'} specificaties</button>
              </div>
              <Field label="Entry"><input inputMode="decimal" value={c.entry} onChange={(e) => set({ entry: e.target.value })} /></Field>
              <Field label="Stop loss"><input inputMode="decimal" value={c.sl} onChange={(e) => set({ sl: e.target.value })} /></Field>
              <Field label="Take profit (optioneel)"><input inputMode="decimal" value={c.tp} onChange={(e) => set({ tp: e.target.value })} /></Field>
            </div>
            {showAdvanced && (
              <div className="grid-3 advanced">
                {c.market === 'forex' ? (
                  <>
                    <Field label="Pip grootte"><input value={c.pipSize} onChange={(e) => set({ pipSize: e.target.value })} /></Field>
                    <Field label="Contract grootte" hint="Check in MT5: rechtsklik symbool → Specificatie">
                      <input value={c.contractSize} onChange={(e) => set({ contractSize: e.target.value })} />
                    </Field>
                    <Field label="Lot stap"><input value={c.lotStep} onChange={(e) => set({ lotStep: e.target.value })} /></Field>
                  </>
                ) : (
                  <>
                    <Field label="Qty stap" hint="BTC 0.001, ETH 0.01, SOL 0.1"><input value={c.qtyStep} onChange={(e) => set({ qtyStep: e.target.value })} /></Field>
                    <Field label="Taker fee %"><div className="readout mono">{settings.bybitFeePct}% / kant</div></Field>
                    <Field label="Fees meerekenen">
                      <Segmented value={c.includeFees ? 'y' : 'n'} onChange={(v) => set({ includeFees: v === 'y' })}
                        options={[{ value: 'y', label: 'Ja' }, { value: 'n', label: 'Nee' }]} />
                    </Field>
                  </>
                )}
              </div>
            )}
          </section>

          <section className="card">
            <h2>Positiebeheer — partial close</h2>
            <div className="grid-3">
              <Field label="Sluit % van positie"><input inputMode="decimal" value={c.partialPct} onChange={(e) => set({ partialPct: e.target.value })} /></Field>
              <Field label="Bij (R)"><input inputMode="decimal" value={c.partialAtR} onChange={(e) => set({ partialAtR: e.target.value })} /></Field>
              <Field label="Daarna">
                <div className="readout">SL naar break-even</div>
              </Field>
            </div>
            {partialOutcome ? (
              <div className="stats">
                <Stat label="Resultaat als TP geraakt" value={fmtMoney(partialOutcome.atTp, ccy)} tone="good" />
                <Stat label="Resultaat als BE geraakt" value={fmtMoney(partialOutcome.atBe, ccy)} />
                <Stat label="Sluit aantal" value={fmt(((fx?.lots ?? cr?.qty ?? 0) * partialPct), 3)} />
              </div>
            ) : (
              <p className="muted small">Vul een TP in die verder ligt dan je partial om het plan te zien.</p>
            )}
          </section>
        </div>

        <aside className="col-side">
          <section className="card result">
            <h2>Resultaat</h2>
            {!result ? (
              <p className="muted">
                {c.market === 'forex' && conv.rate == null ? `Vul de koers ${conv.quote ?? ''} → ${ccy} in.` : 'Vul entry en stop loss in.'}
              </p>
            ) : (
              <>
                <div className="big-number">
                  {fx ? `${fmt(fx.lots, 2)} lots` : `${fmt(cr!.qty, 4)} ${c.symbol.replace('USDT', '')}`}
                </div>
                <div className={`direction ${result.long ? 'up' : 'down'}`}>{result.long ? 'LONG ▲' : 'SHORT ▼'}</div>
                <div className="stats">
                  <Stat label="Werkelijk risico" value={fmtMoney(result.actualRisk, ccy)} tone={overBudget ? 'bad' : undefined} />
                  <Stat label="R:R" value={result.rr == null ? '—' : `${fmt(result.rr, 2)}R`} tone={result.rr != null && result.rr >= settings.minRR ? 'good' : undefined} />
                  <Stat label="Winst bij TP" value={fmtMoney(result.reward, ccy)} />
                  {fx && <Stat label="SL afstand" value={`${fmt(fx.slPips, 1)} pips`} />}
                  {fx && <Stat label="Pip waarde / lot" value={fmtMoney(fx.pipValuePerLot, ccy)} />}
                  {cr && <Stat label="Positiewaarde" value={fmtMoney(cr.notional, ccy)} />}
                  {cr && <Stat label="Margin" value={fmtMoney(cr.margin, ccy)} />}
                  {cr && <Stat label="Liq. prijs (≈)" value={fmt(cr.liqPrice, 2)} tone={cr.slBeyondLiq ? 'bad' : undefined} />}
                  {cr && c.includeFees && <Stat label="Fees bij SL" value={fmtMoney(cr.feesAtSl, ccy)} />}
                </div>
                {fx?.belowMinLot && <p className="warn">Onder minimum lot — SL te ruim voor dit risico.</p>}
                {cr?.slBeyondLiq && <p className="warn">Liquidatie ligt vóór je SL. Verlaag leverage.</p>}
                {overBudget && <p className="warn">Dit risico overschrijdt je prop firm budget van vandaag.</p>}
              </>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
