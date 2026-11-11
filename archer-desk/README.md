# Archer Desk

Desktop trading-tool rond de Archer BluePrint. Fase 1 van 3:

1. **Pre-trade checklist**: GO / TWIJFEL / NO GO op basis van je BluePrint-regels. RR, risicobudget en richting worden automatisch gecontroleerd vanuit je trade plan.
2. **Positie calculator**: lotsize voor MT5 (forex, goud, zilver, custom contract) en hoeveelheid voor Bybit USDT-perps (met fees, margin en een liquidatiewaarschuwing). Inclusief een plan voor partial close.
3. **Logboek**: elke opgeslagen checklist, met disciplinestatistieken (trades genomen ondanks NO GO).

Je prop firm-regels (daily loss, max drawdown, risico per trade) staan in **Instellingen**. Daar kun je ook de checklist volledig aanpassen.

Data staat voorlopig lokaal in de browser (localStorage). Exporteer regelmatig via Instellingen → Back-up. In de journal-fase gaat de data naar Supabase.

## Starten

```bash
cd archer-desk
npm install
npm run dev      # http://localhost:5173
npm test         # unit tests voor de berekeningen
npm run build    # productiebuild in dist/
```
