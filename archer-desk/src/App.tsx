import { useEffect, useState } from 'react';
import { riskBudget } from './lib/calc';
import { DEFAULT_SETTINGS, DEFAULT_TEMPLATE, EXAMPLE_PAIRS, emptyDraft } from './lib/defaults';
import { allowedDirections, biasDirection, type TrackedPair } from './lib/phases';
import { fmt, fmtMoney, readStored, useLocalState } from './lib/storage';
import type { ChecklistSection, LogEntry, Settings, TradeDraft } from './lib/types';
import ChecklistPage from './pages/Checklist';
import CalculatorPage from './pages/Calculator';
import LogPage from './pages/Log';
import PairsPage from './pages/Pairs';
import SettingsPage from './pages/Settings';

type Page = 'pairs' | 'checklist' | 'calculator' | 'log' | 'instellingen';

const NAV: { id: Page; label: string; hint: string }[] = [
  { id: 'pairs', label: 'Pairs & fases', hint: '1' },
  { id: 'checklist', label: 'Pre-trade checklist', hint: '2' },
  { id: 'calculator', label: 'Positie calculator', hint: '3' },
  { id: 'log', label: 'Logboek', hint: '4' },
  { id: 'instellingen', label: 'Instellingen', hint: '5' },
];

function initialPage(): Page {
  const h = window.location.hash.slice(1) as Page;
  return NAV.some((n) => n.id === h) ? h : 'pairs';
}

export default function App() {
  const [page, setPage] = useState<Page>(initialPage);
  // v2 keys: phases became F1–F4 with risk per phase. Account fields carry over from v1.
  const [settings, setSettings] = useLocalState<Settings>('archer.settings.v2', () => {
    const { riskPct: _r, riskByPhase: _p, ...v1 } = readStored<Partial<Settings>>('archer.settings', {});
    return { ...DEFAULT_SETTINGS, ...v1 };
  });
  const [template, setTemplate] = useLocalState<ChecklistSection[]>('archer.template.v2', DEFAULT_TEMPLATE);
  const [draft, setDraft] = useLocalState<TradeDraft>('archer.draft.v2', emptyDraft());
  const [pairs, setPairs] = useLocalState<TrackedPair[]>('archer.pairs', EXAMPLE_PAIRS);

  const openChecklist = (p: TrackedPair) => {
    const allowed = allowedDirections(p);
    setDraft(() => ({
      ...emptyDraft(p.market),
      symbol: p.symbol,
      phase: p.phase,
      direction: allowed.includes(biasDirection(p.bias)) ? biasDirection(p.bias) : allowed[0] ?? 'long',
    }));
    setPage('checklist');
  };
  const [log, setLog] = useLocalState<LogEntry[]>('archer.log', []);

  useEffect(() => {
    try {
      history.replaceState(null, '', `#${page}`);
    } catch {
      /* ignore */
    }
    window.scrollTo(0, 0);
  }, [page]);

  useEffect(() => {
    const onHash = () => setPage(initialPage());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const budget = riskBudget(settings);
  const dailyUsedPct = budget.dailyLimit > 0 ? Math.min(100, Math.max(0, (1 - budget.remainingDaily / budget.dailyLimit) * 100)) : 0;

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">ARCHER</span>
          <span className="brand-sub">Desk · BluePrint</span>
        </div>
        <nav>
          {NAV.map((n) => (
            <button key={n.id} className={`nav-item ${page === n.id ? 'active' : ''}`} onClick={() => setPage(n.id)}>
              <span className="nav-hint">{n.hint}</span>
              {n.label}
            </button>
          ))}
          <div className="nav-item disabled" title="Volgende fase">
            <span className="nav-hint">·</span>
            Journal & analyse <span className="soon">binnenkort</span>
          </div>
        </nav>

        <div className="budget">
          <div className="budget-title">{settings.accountName}</div>
          <div className="budget-row">
            <span>Risico per trade</span>
            <span className="mono">{fmt(settings.riskPct, 2)}% · {fmtMoney((settings.accountSize * settings.riskPct) / 100, settings.currency)}</span>
          </div>
          <div className="budget-row">
            <span>Ruimte vandaag</span>
            <span className={`mono ${budget.remainingDaily <= 0 ? 'bad' : ''}`}>{fmtMoney(budget.remainingDaily, settings.currency)}</span>
          </div>
          <div className="meter" aria-label="Daily loss gebruikt">
            <div className={`meter-fill ${dailyUsedPct > 70 ? 'hot' : ''}`} style={{ width: `${dailyUsedPct}%` }} />
          </div>
          <div className="budget-row">
            <span>Tot max drawdown</span>
            <span className={`mono ${budget.remainingTotal <= 0 ? 'bad' : ''}`}>{fmtMoney(budget.remainingTotal, settings.currency)}</span>
          </div>
          <button className="link" onClick={() => setPage('instellingen')}>P&L vandaag bijwerken →</button>
        </div>
      </aside>

      <main className="content">
        {page === 'pairs' && <PairsPage pairs={pairs} setPairs={setPairs} settings={settings} onOpenChecklist={openChecklist} />}
        {page === 'checklist' && (
          <ChecklistPage
            pairs={pairs}
            onGoPairs={() => setPage('pairs')}
            settings={settings}
            template={template}
            draft={draft}
            setDraft={setDraft}
            onSave={(entry) => setLog((l) => [entry, ...l])}
          />
        )}
        {page === 'calculator' && <CalculatorPage settings={settings} />}
        {page === 'log' && <LogPage log={log} setLog={setLog} currency={settings.currency} />}
        {page === 'instellingen' && (
          <SettingsPage
            settings={settings}
            setSettings={setSettings}
            template={template}
            setTemplate={setTemplate}
            log={log}
            setLog={setLog}
          />
        )}
      </main>
    </div>
  );
}
