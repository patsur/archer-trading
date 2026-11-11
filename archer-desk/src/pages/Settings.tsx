import { useRef } from 'react';
import { Field } from '../components/Field';
import { DEFAULT_TEMPLATE } from '../lib/defaults';
import { downloadJson, num, uid } from '../lib/storage';
import type { ChecklistSection, LogEntry, Settings } from '../lib/types';

interface Props {
  settings: Settings;
  setSettings: (fn: (s: Settings) => Settings) => void;
  template: ChecklistSection[];
  setTemplate: (fn: (t: ChecklistSection[]) => ChecklistSection[]) => void;
  log: LogEntry[];
  setLog: (fn: (l: LogEntry[]) => LogEntry[]) => void;
}

const NUMBER_FIELDS: { key: keyof Settings; label: string; hint?: string }[] = [
  { key: 'accountSize', label: 'Accountgrootte (start)', hint: 'Basis voor daily loss en drawdown' },
  { key: 'balance', label: 'Huidige balans' },
  { key: 'todayPnl', label: 'P&L vandaag', hint: 'Negatief bij verlies, incl. floating' },
  { key: 'openRisk', label: 'Open risico', hint: 'Som van risico op lopende trades' },
  { key: 'riskPct', label: 'Risico per trade %' },
  { key: 'maxDailyLossPct', label: 'Max daily loss %' },
  { key: 'maxTotalDdPct', label: 'Max drawdown %' },
  { key: 'minRR', label: 'Minimum R:R' },
  { key: 'goThreshold', label: 'GO vanaf score %' },
  { key: 'defaultLeverage', label: 'Bybit leverage' },
  { key: 'bybitFeePct', label: 'Bybit taker fee %' },
  { key: 'bybitMmrPct', label: 'Bybit maintenance margin %' },
];

export default function SettingsPage({ settings, setSettings, template, setTemplate, log, setLog }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);

  const editSection = (sid: string, fn: (s: ChecklistSection) => ChecklistSection) =>
    setTemplate((t) => t.map((s) => (s.id === sid ? fn(s) : s)));

  const importFile = async (file: File) => {
    try {
      const data = JSON.parse(await file.text());
      if (data.settings) setSettings((s) => ({ ...s, ...data.settings }));
      if (Array.isArray(data.template)) setTemplate(() => data.template);
      if (Array.isArray(data.log)) setLog(() => data.log);
      window.alert('Import gelukt.');
    } catch {
      window.alert('Kon dit bestand niet lezen.');
    }
  };

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Instellingen</h1>
          <p className="muted">Je prop firm regels en je checklist. Alles wordt lokaal in deze browser bewaard.</p>
        </div>
      </header>

      <section className="card">
        <h2>Prop firm account</h2>
        <div className="grid-3">
          <Field label="Naam account">
            <input value={settings.accountName} onChange={(e) => setSettings((s) => ({ ...s, accountName: e.target.value }))} />
          </Field>
          <Field label="Valuta account">
            <select value={settings.currency} onChange={(e) => setSettings((s) => ({ ...s, currency: e.target.value }))}>
              {['USD', 'EUR', 'GBP', 'CHF'].map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
          {NUMBER_FIELDS.map((f) => (
            <Field key={f.key} label={f.label} hint={f.hint}>
              <input
                inputMode="decimal"
                defaultValue={String(settings[f.key])}
                key={`${f.key}-${settings[f.key]}`}
                onBlur={(e) => {
                  const v = num(e.target.value);
                  if (v != null) setSettings((s) => ({ ...s, [f.key]: v }));
                }}
              />
            </Field>
          ))}
        </div>
        <button className="ghost" onClick={() => setSettings((s) => ({ ...s, todayPnl: 0, openRisk: 0 }))}>Nieuwe handelsdag (reset P&L en open risico)</button>
      </section>

      <section className="card">
        <div className="row-between">
          <h2>Checklist bewerken</h2>
          <button className="ghost" onClick={() => window.confirm('Terug naar de standaard checklist?') && setTemplate(() => DEFAULT_TEMPLATE)}>Standaard herstellen</button>
        </div>
        <p className="muted small">Items met <span className="tag">auto</span> worden door de app zelf gecontroleerd vanuit je trade plan.</p>
        {template.map((section) => (
          <div className="tpl-section" key={section.id}>
            <input className="tpl-title" value={section.title} onChange={(e) => editSection(section.id, (s) => ({ ...s, title: e.target.value }))} />
            {section.items.map((item) => (
              <div className="tpl-item" key={item.id}>
                <input
                  value={item.text}
                  onChange={(e) => editSection(section.id, (s) => ({ ...s, items: s.items.map((i) => (i.id === item.id ? { ...i, text: e.target.value } : i)) }))}
                />
                <label className="inline">
                  <input
                    type="checkbox"
                    checked={item.required}
                    onChange={(e) => editSection(section.id, (s) => ({ ...s, items: s.items.map((i) => (i.id === item.id ? { ...i, required: e.target.checked } : i)) }))}
                  />
                  verplicht
                </label>
                {item.auto ? <span className="tag">auto</span> : <span />}
                <button className="icon" aria-label="Item verwijderen" onClick={() => editSection(section.id, (s) => ({ ...s, items: s.items.filter((i) => i.id !== item.id) }))}>✕</button>
              </div>
            ))}
            <div className="tpl-actions">
              <button className="link" onClick={() => editSection(section.id, (s) => ({ ...s, items: [...s.items, { id: uid(), text: 'Nieuwe regel', required: false }] }))}>+ Regel toevoegen</button>
              <button className="link danger" onClick={() => window.confirm(`Sectie "${section.title}" verwijderen?`) && setTemplate((t) => t.filter((s) => s.id !== section.id))}>Sectie verwijderen</button>
            </div>
          </div>
        ))}
        <button className="ghost" onClick={() => setTemplate((t) => [...t, { id: uid(), title: `${t.length + 1} · Nieuwe sectie`, items: [] }])}>+ Sectie toevoegen</button>
      </section>

      <section className="card">
        <h2>Back-up</h2>
        <p className="muted small">Data staat alleen in deze browser. Exporteer regelmatig.</p>
        <div className="row">
          <button className="ghost" onClick={() => downloadJson(`archer-desk-${new Date().toISOString().slice(0, 10)}.json`, { settings, template, log })}>Exporteer JSON</button>
          <button className="ghost" onClick={() => fileRef.current?.click()}>Importeer JSON</button>
          <input ref={fileRef} type="file" accept="application/json" hidden onChange={(e) => e.target.files?.[0] && importFile(e.target.files[0])} />
        </div>
      </section>
    </div>
  );
}
