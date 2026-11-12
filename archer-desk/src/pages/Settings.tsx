import { useRef, useState } from 'react';
import { ConfirmButton, Field } from '../components/Field';
import { DEFAULT_TEMPLATE, PHASES } from '../lib/defaults';
import { copyText, num, uid } from '../lib/storage';
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
  { key: 'riskPct', label: 'Standaard risico per trade %', hint: 'Als er geen fase gekozen is' },
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
  const [backupText, setBackupText] = useState('');
  const [backupMsg, setBackupMsg] = useState('');

  const editSection = (sid: string, fn: (s: ChecklistSection) => ChecklistSection) =>
    setTemplate((t) => t.map((s) => (s.id === sid ? fn(s) : s)));

  const importText = (text: string) => {
    try {
      const data = JSON.parse(text);
      if (data.settings) setSettings((s) => ({ ...s, ...data.settings }));
      if (Array.isArray(data.template)) setTemplate(() => data.template);
      if (Array.isArray(data.log)) setLog(() => data.log);
      setBackupMsg('Back-up teruggezet.');
    } catch {
      setBackupMsg('Dit is geen geldige back-up. Plak de volledige tekst die je eerder kopieerde.');
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
        <div className="phase-risk">
          <div>
            <h3>Risico per BluePrint-fase</h3>
            <p className="muted small">Leeg laten = standaard risico. De checklist gebruikt het % van de fase die je kiest.</p>
          </div>
          <div className="grid-4">
            {PHASES.map(({ value: ph, label }) => (
              <Field key={ph} label={label}>
                <input
                  inputMode="decimal"
                  placeholder={`${settings.riskPct}`}
                  defaultValue={settings.riskByPhase?.[ph] != null ? String(settings.riskByPhase[ph]) : ''}
                  key={`${ph}-${settings.riskByPhase?.[ph] ?? ''}`}
                  onBlur={(e) => {
                    const v = num(e.target.value);
                    setSettings((s) => {
                      const next = { ...(s.riskByPhase ?? {}) };
                      if (v != null && v > 0) next[ph] = v;
                      else delete next[ph];
                      return { ...s, riskByPhase: next };
                    });
                  }}
                />
              </Field>
            ))}
          </div>
        </div>
        <button className="ghost" onClick={() => setSettings((s) => ({ ...s, todayPnl: 0, openRisk: 0 }))}>Nieuwe handelsdag (reset P&L en open risico)</button>
      </section>

      <section className="card">
        <div className="row-between">
          <h2>Checklist bewerken</h2>
          <ConfirmButton onConfirm={() => setTemplate(() => DEFAULT_TEMPLATE)}>Standaard herstellen</ConfirmButton>
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
              <ConfirmButton className="link danger" onConfirm={() => setTemplate((t) => t.filter((s) => s.id !== section.id))}>Sectie verwijderen</ConfirmButton>
            </div>
          </div>
        ))}
        <button className="ghost" onClick={() => setTemplate((t) => [...t, { id: uid(), title: `${t.length + 1} · Nieuwe sectie`, items: [] }])}>+ Sectie toevoegen</button>
      </section>

      <section className="card">
        <h2>Back-up</h2>
        <p className="muted small">Je data staat alleen in deze browser op dit toestel. Kopieer de back-up en bewaar hem in je notities of mail.</p>
        <div className="row">
          <button
            className="ghost"
            onClick={async () => {
              const text = JSON.stringify({ settings, template, log });
              setBackupText(text);
              setBackupMsg((await copyText(text)) ? 'Back-up gekopieerd.' : 'Selecteer de tekst hieronder en kopieer hem.');
            }}
          >
            Kopieer back-up
          </button>
          <button className="ghost" onClick={() => fileRef.current?.click()}>Bestand importeren</button>
          <input ref={fileRef} type="file" accept="application/json,.json,.txt" hidden onChange={async (e) => e.target.files?.[0] && importText(await e.target.files[0].text())} />
        </div>
        <textarea
          id="backup"
          rows={4}
          className="mono small"
          value={backupText}
          placeholder="Plak hier een back-up om hem terug te zetten"
          onChange={(e) => setBackupText(e.target.value)}
          onFocus={(e) => e.target.select()}
        />
        <div className="row">
          <ConfirmButton disabled={!backupText.trim()} confirmLabel="Huidige data overschrijven?" onConfirm={() => importText(backupText)}>Plak-back-up terugzetten</ConfirmButton>
          {backupMsg && <span className="muted small" role="status">{backupMsg}</span>}
        </div>
      </section>
    </div>
  );
}
