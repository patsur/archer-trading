import { useMemo } from 'react';
import { Field, Segmented, Select, Stat } from '../components/Field';
import { CRYPTO_SYMBOLS, ENTRY_TYPES, FOREX_PRESETS, PHASES, ZONES, emptyDraft } from '../lib/defaults';
import { sizeDraft } from '../lib/sizing';
import { fmt, fmtMoney, uid } from '../lib/storage';
import type { ChecklistItem, ChecklistSection, LogEntry, Settings, TradeDraft, Verdict } from '../lib/types';

interface Props {
  settings: Settings;
  template: ChecklistSection[];
  draft: TradeDraft;
  setDraft: (fn: (d: TradeDraft) => TradeDraft) => void;
  onSave: (e: LogEntry) => void;
}

export default function ChecklistPage({ settings, template, draft, setDraft, onSave }: Props) {
  const sizing = useMemo(() => sizeDraft(draft, settings), [draft, settings]);
  const update = (patch: Partial<TradeDraft>) => setDraft((d) => ({ ...d, ...patch }));

  const autoValue = (item: ChecklistItem): boolean | null => {
    switch (item.auto) {
      case 'rr':
        return sizing.rr == null ? null : sizing.rr >= settings.minRR;
      case 'risk':
        return sizing.withinBudget;
      case 'direction':
        return sizing.directionOk;
      default:
        return null;
    }
  };
  const isChecked = (item: ChecklistItem) => (item.auto ? autoValue(item) === true : !!draft.checked[item.id]);

  const items = template.flatMap((s) => s.items);
  const checkedCount = items.filter(isChecked).length;
  const score = items.length ? Math.round((checkedCount / items.length) * 100) : 0;
  const missingRequired = items.filter((i) => i.required && !isChecked(i));
  const setupComplete = !!(draft.symbol && draft.phase && draft.zone && draft.entryType);

  let verdict: Verdict = 'GO';
  if (missingRequired.length > 0) verdict = 'NO GO';
  else if (score < settings.goThreshold || !setupComplete) verdict = 'TWIJFEL';

  const save = (taken: boolean) => {
    if (!draft.symbol) return;
    if (taken && verdict === 'NO GO' && !window.confirm('Je checklist zegt NO GO. Toch genomen opslaan? Dit telt als regelbreuk in je logboek.')) return;
    onSave({
      id: uid(),
      createdAt: new Date().toISOString(),
      market: draft.market,
      symbol: draft.symbol.toUpperCase(),
      direction: draft.direction,
      phase: draft.phase,
      zone: draft.zone,
      entryType: draft.entryType,
      entry: sizing.entry,
      sl: sizing.sl,
      tp: sizing.tp,
      rr: sizing.rr,
      size: sizing.size,
      riskAmount: sizing.actualRisk,
      score,
      verdict,
      missingRequired: missingRequired.map((i) => i.text),
      taken,
      notes: draft.notes,
    });
    setDraft(() => emptyDraft(draft.market));
  };

  const symbols = draft.market === 'forex' ? FOREX_PRESETS.map((p) => p.symbol) : CRYPTO_SYMBOLS;

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Pre-trade checklist</h1>
          <p className="muted">Pas als alles verplicht groen is, mag je drukken.</p>
        </div>
        <button className="ghost" onClick={() => setDraft(() => emptyDraft(draft.market))}>Leegmaken</button>
      </header>

      <div className="two-col">
        <div className="col-main">
          <section className="card">
            <h2>Setup</h2>
            <div className="grid-3">
              <Field label="Markt">
                <Segmented
                  value={draft.market}
                  onChange={(market) => update({ market, symbol: '', conversionRate: '' })}
                  options={[{ value: 'forex', label: 'Forex · MT5' }, { value: 'crypto', label: 'Crypto · Bybit' }]}
                />
              </Field>
              <Field label="Symbool">
                <input
                  list="symbols"
                  value={draft.symbol}
                  placeholder={draft.market === 'forex' ? 'bijv. GBPCHF' : 'bijv. BTCUSDT'}
                  onChange={(e) => update({ symbol: e.target.value.toUpperCase() })}
                />
                <datalist id="symbols">{symbols.map((s) => <option key={s} value={s} />)}</datalist>
              </Field>
              <Field label="Richting">
                <Segmented
                  value={draft.direction}
                  onChange={(direction) => update({ direction })}
                  options={[{ value: 'long', label: 'Long ▲', tone: 'up' }, { value: 'short', label: 'Short ▼', tone: 'down' }]}
                />
              </Field>
              <Field label="BluePrint fase"><Select value={draft.phase} onChange={(phase) => update({ phase })} options={PHASES} /></Field>
              <Field label="Zone type"><Select value={draft.zone} onChange={(zone) => update({ zone })} options={ZONES} /></Field>
              <Field label="4H entry type"><Select value={draft.entryType} onChange={(entryType) => update({ entryType })} options={ENTRY_TYPES} /></Field>
            </div>
          </section>

          {template.map((section) => (
            <section className="card" key={section.id}>
              <h2>{section.title}</h2>
              <ul className="checklist">
                {section.items.map((item) => {
                  const auto = item.auto ? autoValue(item) : null;
                  const checked = isChecked(item);
                  return (
                    <li key={item.id} className={`check ${checked ? 'done' : ''} ${item.auto ? 'auto' : ''}`}>
                      <label>
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={!!item.auto}
                          onChange={(e) => update({ checked: { ...draft.checked, [item.id]: e.target.checked } })}
                        />
                        <span className="check-text">
                          {item.text}
                          {item.auto === 'rr' && <em> (min {fmt(settings.minRR, 1)}R — nu {sizing.rr == null ? '—' : `${fmt(sizing.rr, 2)}R`})</em>}
                          {item.auto === 'risk' && <em> (budget {fmtMoney(sizing.budgetRemaining, settings.currency)})</em>}
                        </span>
                        {item.required && <span className="tag req">verplicht</span>}
                        {item.auto && <span className={`tag ${auto == null ? '' : auto ? 'ok' : 'no'}`}>{auto == null ? 'vul plan in' : 'auto'}</span>}
                      </label>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}

          <section className="card">
            <h2>Notities</h2>
            <textarea
              rows={3}
              value={draft.notes}
              placeholder="Waarom deze trade? Wat moet er gebeuren voor invalidatie?"
              onChange={(e) => update({ notes: e.target.value })}
            />
          </section>
        </div>

        <aside className="col-side">
          <section className={`card verdict v-${verdict.replace(' ', '').toLowerCase()}`}>
            <div className="verdict-label">{verdict}</div>
            <div className="score-bar"><div style={{ width: `${score}%` }} /></div>
            <div className="muted mono small">{checkedCount}/{items.length} punten · {score}% (GO vanaf {settings.goThreshold}%)</div>
            {missingRequired.length > 0 && (
              <ul className="missing">
                {missingRequired.slice(0, 4).map((i) => <li key={i.id}>{i.text}</li>)}
                {missingRequired.length > 4 && <li>+{missingRequired.length - 4} meer</li>}
              </ul>
            )}
            {verdict !== 'NO GO' && !setupComplete && <p className="small muted">Vul symbool, fase, zone en entry type in.</p>}
          </section>

          <section className="card">
            <h2>Trade plan</h2>
            <div className="grid-3 tight">
              <Field label="Entry"><input inputMode="decimal" value={draft.entry} onChange={(e) => update({ entry: e.target.value })} placeholder="1.08500" /></Field>
              <Field label="Stop loss"><input inputMode="decimal" value={draft.sl} onChange={(e) => update({ sl: e.target.value })} placeholder="1.08200" /></Field>
              <Field label="Take profit"><input inputMode="decimal" value={draft.tp} onChange={(e) => update({ tp: e.target.value })} placeholder="1.09100" /></Field>
            </div>
            {draft.market === 'forex' && sizing.needsConversion && sizing.conversionQuote && (
              <Field label={`Koers 1 ${sizing.conversionQuote} = ? ${settings.currency}`} hint={`Bijv. ${sizing.conversionQuote}${settings.currency} of 1 / ${settings.currency}${sizing.conversionQuote} uit MT5`}>
                <input inputMode="decimal" value={draft.conversionRate} onChange={(e) => update({ conversionRate: e.target.value })} />
              </Field>
            )}
            <div className="stats">
              <Stat label={draft.market === 'forex' ? 'Lotsize' : 'Aantal'} value={sizing.size == null ? '—' : fmt(sizing.size, 3)} />
              <Stat label="Risico" value={fmtMoney(sizing.actualRisk, settings.currency)} tone={sizing.withinBudget === false ? 'bad' : undefined} />
              <Stat label="R:R" value={sizing.rr == null ? '—' : `${fmt(sizing.rr, 2)}R`} tone={sizing.rr == null ? undefined : sizing.rr >= settings.minRR ? 'good' : 'bad'} />
              <Stat label="Potentiële winst" value={fmtMoney(sizing.reward, settings.currency)} />
            </div>
            {sizing.directionOk === false && <p className="warn">Stop loss staat aan de verkeerde kant voor een {draft.direction}.</p>}
            {sizing.budgetRemaining <= 0 && <p className="warn">Geen risicobudget meer — stop met traden vandaag.</p>}
            {sizing.warning && <p className="warn">{sizing.warning}</p>}
          </section>

          <div className="actions">
            <button className="primary" disabled={!draft.symbol} onClick={() => save(true)}>Trade genomen — opslaan</button>
            <button className="ghost" disabled={!draft.symbol} onClick={() => save(false)}>Niet genomen — opslaan</button>
          </div>
        </aside>
      </div>
    </div>
  );
}
