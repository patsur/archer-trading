import { useState } from 'react';
import { ConfirmButton, Field, Segmented, Select } from '../components/Field';
import { PHASES, PHASE_ENTRY_HINT, phaseLabel } from '../lib/defaults';
import {
  FIB_LEVELS, allowedDirections, applyTransition, fibPrice, fibRatio, phaseHints, transitions,
  type Bias, type PhaseId, type TrackedPair, type Transition,
} from '../lib/phases';
import { riskPctFor } from '../lib/sizing';
import { fmt, num, uid } from '../lib/storage';
import type { Settings } from '../lib/types';

interface Props {
  pairs: TrackedPair[];
  setPairs: (fn: (p: TrackedPair[]) => TrackedPair[]) => void;
  settings: Settings;
  onOpenChecklist: (p: TrackedPair) => void;
}

const digitsFor = (p: TrackedPair) => (p.market === 'crypto' ? 2 : p.symbol.endsWith('JPY') ? 3 : 5);

/** Number input that keeps what you type and saves on blur, so "1." or "0,6" never jumps. */
function NumInput({ value, onCommit, placeholder, id }: { value: number | null; onCommit: (v: number | null) => void; placeholder?: string; id?: string }) {
  return (
    <input
      id={id}
      key={`${id}-${value ?? ''}`}
      inputMode="decimal"
      placeholder={placeholder}
      defaultValue={value == null ? '' : String(value)}
      onBlur={(e) => {
        const v = num(e.target.value);
        if (v !== value) onCommit(v);
      }}
    />
  );
}

function newPair(): TrackedPair {
  return {
    id: uid(), symbol: '', market: 'forex', bias: 'bullish', phase: 'F1',
    top: null, fib100: null, swingExtreme: null, firstStructureHit: false, reversalLevel: null,
    price: null, notes: '', history: [], updatedAt: new Date().toISOString(),
  };
}

export function DirectionPills({ pair }: { pair: TrackedPair }) {
  const allowed = allowedDirections(pair);
  if (allowed.length === 0) return <span className="pill-dir none">Opnieuw analyseren</span>;
  return (
    <span className="pill-row">
      {allowed.map((d) => (
        <span key={d} className={`pill-dir ${d === 'long' ? 'up' : 'down'}`}>{d === 'long' ? '▲ Long' : '▼ Short'}</span>
      ))}
    </span>
  );
}

export default function PairsPage({ pairs, setPairs, settings, onOpenChecklist }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(pairs[0]?.id ?? null);
  const [pending, setPending] = useState<{ t: Transition; value: string } | null>(null);
  const selected = pairs.find((p) => p.id === selectedId) ?? null;

  const update = (patch: Partial<TrackedPair>) =>
    selected && setPairs((ps) => ps.map((p) => (p.id === selected.id ? { ...p, ...patch, updatedAt: new Date().toISOString() } : p)));

  const add = () => {
    const p = newPair();
    setPairs((ps) => [p, ...ps]);
    setSelectedId(p.id);
  };

  const runTransition = (t: Transition, value: number | null) => {
    if (!selected) return;
    setPairs((ps) => ps.map((p) => (p.id === selected.id ? applyTransition(p, t, value) : p)));
    setPending(null);
  };

  const order: PhaseId[] = ['F3', 'F1', 'F2', 'F4', 'SOM'];
  const sorted = [...pairs].sort((a, b) => order.indexOf(a.phase) - order.indexOf(b.phase) || a.symbol.localeCompare(b.symbol));

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Pairs & fases</h1>
          <p className="muted">Weekly bias en BluePrint-fase per pair. Dit bepaalt welke trades je checklist toelaat.</p>
        </div>
        <button className="primary" onClick={add}>+ Pair toevoegen</button>
      </header>

      <div className="pairs-layout">
        <div className="pair-list">
          {sorted.length === 0 && <div className="card empty"><p>Nog geen pairs. Voeg je eerste pair toe na je weekly analyse.</p></div>}
          {sorted.map((p) => (
            <button key={p.id} className={`pair-card ${p.id === selectedId ? 'on' : ''}`} onClick={() => { setSelectedId(p.id); setPending(null); }}>
              <div className="pair-top">
                <strong>{p.symbol || 'Nieuw pair'}</strong>
                <span className={`bias ${p.bias}`}>{p.bias === 'bullish' ? 'Bullish' : 'Bearish'}</span>
              </div>
              <div className={`phase-badge ph-${p.phase}`}>{phaseLabel(p.phase)}</div>
              <div className="pair-bottom">
                <DirectionPills pair={p} />
                <span className="mono small muted">{p.phase === 'SOM' ? '—' : `${fmt(riskPctFor(settings, p.phase), 2)}%`}</span>
              </div>
            </button>
          ))}
        </div>

        {selected && (
          <div className="col-main">
            <section className="card">
              <div className="row-between">
                <h2>Pair</h2>
                <ConfirmButton className="link danger" onConfirm={() => { setPairs((ps) => ps.filter((p) => p.id !== selected.id)); setSelectedId(null); }}>
                  Pair verwijderen
                </ConfirmButton>
              </div>
              <div className="grid-3">
                <Field label="Symbool">
                  <input id="pair-symbol" value={selected.symbol} placeholder="bijv. GBPCHF" onChange={(e) => update({ symbol: e.target.value.toUpperCase().replace(/\s/g, '') })} />
                </Field>
                <Field label="Markt">
                  <Segmented value={selected.market} onChange={(market) => update({ market })}
                    options={[{ value: 'forex', label: 'Forex' }, { value: 'crypto', label: 'Crypto' }]} />
                </Field>
                <Field label="Weekly bias">
                  <Segmented<Bias> value={selected.bias} onChange={(bias) => update({ bias })}
                    options={[{ value: 'bullish', label: 'Bullish', tone: 'up' }, { value: 'bearish', label: 'Bearish', tone: 'down' }]} />
                </Field>
              </div>
            </section>

            <section className="card status-card">
              <div className="status-main">
                <div>
                  <div className="field-label">Huidige fase</div>
                  <div className={`status-phase ph-${selected.phase}`}>{phaseLabel(selected.phase)}</div>
                </div>
                <div>
                  <div className="field-label">Toegelaten</div>
                  <DirectionPills pair={selected} />
                </div>
                <div>
                  <div className="field-label">Risico</div>
                  <div className="mono status-risk">{selected.phase === 'SOM' ? '—' : `${fmt(riskPctFor(settings, selected.phase), 2)}%`}</div>
                </div>
              </div>
              {PHASE_ENTRY_HINT[selected.phase] && <p className="small muted">Entry: {PHASE_ENTRY_HINT[selected.phase]}</p>}
              {selected.phase === 'SOM' && (
                <p className="small warn">Switch of momentum: bias is omgedraaid naar {selected.bias}. Teken de nieuwe fib en kies de fase opnieuw.</p>
              )}
              {selected.phase === 'F1' && (
                <label className="inline-check">
                  <input type="checkbox" checked={selected.firstStructureHit} onChange={(e) => update({ firstStructureHit: e.target.checked })} />
                  First structure (0.618) geraakt: alleen nog {selected.bias === 'bullish' ? 'bullish' : 'bearish'} daily set-ups
                </label>
              )}
              {phaseHints(selected).map((h, i) => <p key={i} className={`hint ${h.tone}`}>{h.text}</p>)}

              <div className="transitions">
                {transitions(selected).map((t) =>
                  pending?.t.label === t.label ? (
                    <div className="pending" key={t.label}>
                      {t.ask && (
                        <Field label={t.ask === 'reversalLevel' ? 'Prijs van de reversal (nieuwe low/high)' : 'Top van fase 4 (nieuwe stippellijn)'}>
                          <input inputMode="decimal" autoFocus value={pending.value} onChange={(e) => setPending({ t, value: e.target.value })} />
                        </Field>
                      )}
                      <div className="row">
                        <button className="primary" disabled={!!t.ask && num(pending.value) == null} onClick={() => runTransition(t, num(pending.value))}>Bevestig</button>
                        <button className="ghost" onClick={() => setPending(null)}>Annuleer</button>
                      </div>
                    </div>
                  ) : (
                    <button key={t.label} className={`ghost transition ${t.to === 'SOM' ? 'danger' : ''}`} onClick={() => setPending({ t, value: '' })}>{t.label}</button>
                  ),
                )}
              </div>
              <div className="row-between">
                <Field label="Fase handmatig zetten">
                  <Select value={selected.phase} placeholder="—" options={[...PHASES, { value: 'SOM', label: 'Switch of momentum' }]} onChange={(v) => v && update({ phase: v as PhaseId })} />
                </Field>
                <button className="ghost" disabled={!selected.symbol || selected.phase === 'SOM'} onClick={() => onOpenChecklist(selected)}>Checklist openen →</button>
              </div>
            </section>

            <section className="card">
              <h2>Weekly fib</h2>
              <div className="grid-4">
                <Field label="Stippellijn (fib 0)" hint={selected.bias === 'bullish' ? 'Top waar fase 1 begon' : 'Bodem waar fase 1 begon'}>
                  <NumInput id="pair-top" value={selected.top} onCommit={(top) => update({ top })} />
                </Field>
                <Field label="Fib 100%" hint="Start van de impuls (close)">
                  <NumInput id="pair-fib100" value={selected.fib100} onCommit={(fib100) => update({ fib100 })} />
                </Field>
                <Field label={selected.bias === 'bullish' ? 'Swing low' : 'Swing high'} hint="Close voorbij = switch of momentum">
                  <NumInput id="pair-swing" value={selected.swingExtreme} onCommit={(swingExtreme) => update({ swingExtreme })} />
                </Field>
                <Field label="Huidige prijs" hint="Voor de fase-hints">
                  <NumInput id="pair-price" value={selected.price} onCommit={(price) => update({ price })} />
                </Field>
              </div>
              <FibLadder pair={selected} />
            </section>

            <section className="card">
              <h2>Notities</h2>
              <textarea id="pair-notes" rows={3} value={selected.notes} placeholder="Zones (schouder, weekly S&D), nieuws, plan voor deze week…" onChange={(e) => update({ notes: e.target.value })} />
            </section>

            {selected.history.length > 0 && (
              <section className="card">
                <h2>Fase-historie</h2>
                <ul className="history">
                  {selected.history.map((h, i) => (
                    <li key={i}>
                      <span className="mono small muted">{new Date(h.at).toLocaleDateString('nl-NL', { day: '2-digit', month: 'short', year: '2-digit' })}</span>
                      <span>{h.note}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function FibLadder({ pair }: { pair: TrackedPair }) {
  if (pair.top == null || pair.fib100 == null || pair.top === pair.fib100) {
    return <p className="muted small">Vul stippellijn en fib 100% in om de niveaus te zien.</p>;
  }
  const { top, fib100 } = pair;
  const d = digitsFor(pair);
  type Row = { key: string; price: number; label: string; kind: 'level' | 'swing' | 'price' | 'rev' };
  const rows: Row[] = FIB_LEVELS.map((l) => ({ key: `f${l.r}`, price: fibPrice(top, fib100, l.r), label: l.label, kind: 'level' as const }));
  if (pair.swingExtreme != null) rows.push({ key: 'sw', price: pair.swingExtreme, label: pair.bias === 'bullish' ? 'Swing low (SoM)' : 'Swing high (SoM)', kind: 'swing' });
  if (pair.reversalLevel != null) rows.push({ key: 'rev', price: pair.reversalLevel, label: 'Reversal fase 1 → 2', kind: 'rev' });
  if (pair.price != null) rows.push({ key: 'px', price: pair.price, label: `Prijs nu (${fmt(fibRatio(top, fib100, pair.price), 3)})`, kind: 'price' });
  rows.sort((a, b) => b.price - a.price);
  return (
    <ol className="ladder">
      {rows.map((r) => (
        <li key={r.key} className={`lad-${r.kind} ${r.key === 'f0.618' ? 'lad-fs' : ''} ${r.key === 'f0' ? 'lad-top' : ''}`}>
          <span className="lad-label">{r.label}</span>
          <span className="mono">{r.price.toLocaleString('nl-NL', { minimumFractionDigits: d, maximumFractionDigits: d })}</span>
        </li>
      ))}
    </ol>
  );
}
