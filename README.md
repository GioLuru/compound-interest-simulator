# Compound Interest Simulator

Applicativo web statico per simulare la crescita di un investimento con interesse composto e fiscalita configurabile.

## Avvio

Apri `index.html` nel browser.

Non sono richiesti installazione, build step o dipendenze esterne.

## Funzioni principali

- Simulazione capitale lordo e netto per interesse composto e interesse semplice.
- Convenzione del tasso selezionabile tra nominale con calcolo mensile ed effettivo annuo.
- Versamenti configurabili a inizio, meta o fine mese.
- TER / costo annuo dello strumento separato dalle imposte.
- Capitale investito, plusvalenza lorda, plusvalenza netta e plusvalenza imponibile evidenziati nei risultati.
- Modalita semplice e avanzata.
- Sezione "Fiscalita personalizzata" visibile in modalita avanzata.
- Preset fiscale Italia modificabile manualmente.
- Oggetto fiscale separato usato dal motore di calcolo.
- Bollo, IVAFE, minusvalenze, quote agevolate e timing fiscale configurabili.
- Salvataggio e caricamento scenario fiscale da `localStorage`.
- Lista scenari fiscali salvata in `localStorage`, con caricamento, eliminazione e confronto ricalcolato sui parametri investimento correnti.
