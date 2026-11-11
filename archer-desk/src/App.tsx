import { useEffect, useState } from 'react';
import { riskBudget } from './lib/calc';
import { DEFAULT_SETTINGS, DEFAULT_TEMPLATE, emptyDraft } from './lib/defaults';
import { fmtMoney, useLocalState } from './lib/storage';
import type { ChecklistSection, LogEntry, Settings, TradeDraft } from './lib/types';
import ChecklistPage from './pages/Checklist';
import CalculatorPage from './pages/Calculator';
import LogPage from './pages/Log';
import SettingsPage from './pages/Settings';

type Page = 'checklist' | 'calculator' | 'log' | 'settings';

const NAV: { id: Page; label: string; hint: string }[] = [
  { id: 'checklist', label: 'Pre-trade checklist', hint: '1' },
  { id: 'calculator', label: 'Positie calculator', hint: '2' },
  { id: 'log', label: 'Logboek', hint: '3' },
  { id: 'settings', label: 'Instellingen', hint: '4' },
];

function initialPage(): Page {
  const h = window.location.hash.slice(1) as Page;
  return NAV.some((n) => n.id === h) ? h : 'checklist';
}

export default function App() {
  const [page, setPage] = useState<Page>(initialPage);
  const [settings, setSettings] = useLocalState<Settings>('archer.settings', DEFAULT_SETTINGS);
  const [template, setTemplate] = useLocalState<ChecklistSection[]>('archer.template', DEFAULT_TEMPLATE);
  const [draft, setDraft] = useLocalState<TradeDraft>('archer.draft', emptyDraft());
  const [log, setLog] = useLocalState<LogEntry[]>('archer.log', []);

  useEffect(() => {
    window.location.hash = page;
  }, [page]);

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
            <span className="mono">{fmtMoney((settings.accountSize * settings.riskPct) / 100, settings.currency)}</span>
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
          <button className="link" onClick={() => setPage('settings')}>P&L vandaag bijwerken →</button>
        </div>
      </aside>

      <main className="content">
        {page === 'checklist' && (
          <ChecklistPage
            settings={settings}
            template={template}
            draft={draft}
            setDraft={setDraft}
            onSave={(entry) => setLog((l) => [entry, ...l])}
          />
        )}
        {page === 'calculator' && <CalculatorPage settings={settings} />}
        {page === 'log' && <LogPage log={log} setLog={setLog} currency={settings.currency} />}
        {page === 'settings' && (
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
