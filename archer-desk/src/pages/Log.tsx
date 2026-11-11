import { useState } from 'react';
import { ConfirmButton, Stat } from '../components/Field';
import { fmt, fmtMoney } from '../lib/storage';
import type { LogEntry } from '../lib/types';

export default function LogPage({ log, setLog, currency }: {
  log: LogEntry[];
  setLog: (fn: (l: LogEntry[]) => LogEntry[]) => void;
  currency: string;
}) {
  const [filter, setFilter] = useState<'all' | 'taken' | 'skipped' | 'breaks'>('all');

  const taken = log.filter((e) => e.taken);
  const breaks = taken.filter((e) => e.verdict === 'NO GO');
  const goSkipped = log.filter((e) => !e.taken && e.verdict === 'GO');
  const avgScore = log.length ? log.reduce((a, e) => a + e.score, 0) / log.length : null;
  const discipline = taken.length ? ((taken.length - breaks.length) / taken.length) * 100 : null;

  const rows = log.filter((e) =>
    filter === 'all' ? true : filter === 'taken' ? e.taken : filter === 'skipped' ? !e.taken : e.taken && e.verdict === 'NO GO',
  );

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Logboek</h1>
          <p className="muted">Elke checklist die je opslaat. Dit wordt de basis van je journal.</p>
        </div>
      </header>

      <div className="stats wide">
        <Stat label="Checklists" value={log.length} />
        <Stat label="Trades genomen" value={taken.length} />
        <Stat label="Discipline" value={discipline == null ? '—' : `${fmt(discipline, 0)}%`} tone={discipline == null ? undefined : discipline >= 90 ? 'good' : 'bad'} />
        <Stat label="Genomen ondanks NO GO" value={breaks.length} tone={breaks.length ? 'bad' : undefined} />
        <Stat label="GO maar niet genomen" value={goSkipped.length} tone={goSkipped.length ? 'warn' : undefined} />
        <Stat label="Gem. score" value={avgScore == null ? '—' : `${fmt(avgScore, 0)}%`} />
      </div>

      <div className="filters">
        {([['all', 'Alle'], ['taken', 'Genomen'], ['skipped', 'Niet genomen'], ['breaks', 'Regelbreuken']] as const).map(([id, label]) => (
          <button key={id} className={`chip ${filter === id ? 'on' : ''}`} onClick={() => setFilter(id)}>{label}</button>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="card empty">
          <p>Nog niets hier. Sla een checklist op via <strong>Pre-trade checklist</strong>.</p>
        </div>
      ) : (
        <div className="card table-wrap">
          <table>
            <thead>
              <tr>
                <th>Datum</th><th>Symbool</th><th>Richting</th><th>Setup</th><th>R:R</th><th>Size</th><th>Risico</th><th>Score</th><th>Oordeel</th><th>Genomen</th><th />
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.id} title={e.notes || undefined}>
                  <td className="mono">{new Date(e.createdAt).toLocaleString('nl-NL', { dateStyle: 'short', timeStyle: 'short' })}</td>
                  <td><strong>{e.symbol}</strong></td>
                  <td className={e.direction === 'long' ? 'up' : 'down'}>{e.direction === 'long' ? '▲ Long' : '▼ Short'}</td>
                  <td className="small">{[e.zone, e.entryType].filter(Boolean).join(' · ') || '—'}</td>
                  <td className="mono">{e.rr == null ? '—' : `${fmt(e.rr, 2)}R`}</td>
                  <td className="mono">{fmt(e.size, 3)}</td>
                  <td className="mono">{fmtMoney(e.riskAmount, currency)}</td>
                  <td className="mono">{e.score}%</td>
                  <td><span className={`pill v-${e.verdict.replace(' ', '').toLowerCase()}`}>{e.verdict}</span></td>
                  <td>{e.taken ? 'Ja' : 'Nee'}</td>
                  <td>
                    <ConfirmButton className="icon" ariaLabel="Verwijderen" confirmLabel="Wis?" onConfirm={() => setLog((l) => l.filter((x) => x.id !== e.id))}>✕</ConfirmButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
