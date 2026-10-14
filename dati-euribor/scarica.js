// Scarica dal servizio dati della Deutsche Bundesbank tutti i valori giornalieri degli Euribor (1 settimana, 1, 3, 6 e
// 12 mesi) dal 1999 a oggi e riscrive i file CSV di questa cartella. Serve la connessione a internet.
//   dalla cartella del programma:  node dati-euribor/scarica.js      (serve Node 22 o più recente)
// Dopo, per portare i valori dentro la pagina:  node crea-precaricati.js
'use strict';
const fs = require('fs');
const path = require('path');
const DEST = __dirname;
const BASE = 'https://api.statistiken.bundesbank.de/rest/data/BBIG1/D.D0.EUR.MMKT.EURIBOR.';
const SERIE = [['W01', '1 settimana', 'euribor-1-settimana'], ['M01', '1 mese', 'euribor-1-mese'], ['M03', '3 mesi', 'euribor-3-mesi'], ['M06', '6 mesi', 'euribor-6-mesi'], ['M12', '12 mesi', 'euribor-12-mesi']];
const oggi = new Date().toISOString().slice(0, 10);
const dal = '1999-01-01';
const it = iso => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
const num = v => v.toFixed(3).replace('.', ',');

(async () => {
  const tutte = new Map();   // giorno -> { W01: valore, ... }
  const descrizioni = [];
  for (const [codice, nome, file] of SERIE) {
    const url = `${BASE}${codice}.BID._Z?format=csv&lang=en&startPeriod=${dal}&endPeriod=${oggi}`;
    const risposta = await fetch(url);
    if (!risposta.ok) throw new Error(`${codice}: la Bundesbank ha risposto con l'errore ${risposta.status}`);
    const testo = await risposta.text();
    const valori = [];
    let aggiornato = '';
    for (const riga of testo.split(/\r?\n/)) {
      const m = /^(\d{4}-\d{2}-\d{2}),(-?\d+(?:\.\d+)?),/.exec(riga);
      if (m) { valori.push([m[1], parseFloat(m[2])]); continue; }
      const u = /^last update,(\d{4}-\d{2}-\d{2})/.exec(riga);
      if (u) aggiornato = u[1];
    }
    if (!valori.length) throw new Error(`${codice}: nessun valore nella risposta (formato cambiato?)`);
    valori.sort((a, b) => a[0].localeCompare(b[0]));
    for (const [g, v] of valori) { if (!tutte.has(g)) tutte.set(g, {}); tutte.get(g)[codice] = v; }
    const righe = ['Data;Euribor ' + nome + ' (%)', ...valori.map(([g, v]) => `${it(g)};${num(v)}`)];
    fs.writeFileSync(path.join(DEST, file + '.csv'), '﻿' + righe.join('\r\n') + '\r\n');
    descrizioni.push(`${file}.csv: Euribor ${nome}, ${valori.length} valori dal ${it(valori[0][0])} al ${it(valori[valori.length - 1][0])} (pubblicazione Bundesbank del ${it(aggiornato)})`);
    console.log(descrizioni[descrizioni.length - 1]);
  }
  const giorni = [...tutte.keys()].sort();
  const insieme = ['Data;' + SERIE.map(s => 'Euribor ' + s[1] + ' (%)').join(';'),
    ...giorni.map(g => it(g) + ';' + SERIE.map(([c]) => tutte.get(g)[c] == null ? '' : num(tutte.get(g)[c])).join(';'))];
  fs.writeFileSync(path.join(DEST, 'euribor-tutti.csv'), '﻿' + insieme.join('\r\n') + '\r\n');
  console.log(`euribor-tutti.csv: ${giorni.length} giorni`);

  const leggimi = `Euribor: valori giornalieri dal 1999, cioè da quando esiste (dal ${it(dal)} al ${it(oggi)})
Scaricati il ${it(oggi)} dal servizio dati della Deutsche Bundesbank (https://api.statistiken.bundesbank.de),
che pubblica i valori calcolati da EMMI con un giorno lavorativo di ritardo. Valori in percentuale, base 360 giorni.
Per riscaricarli aggiornati: node dati-euribor/scarica.js (dalla cartella del programma, con Node 22 o più recente).

File:
${descrizioni.map(r => '  ' + r).join('\n')}
  euribor-tutti.csv: le cinque versioni affiancate, una riga per giorno (${giorni.length} giorni)

Formato: una riga per giorno, "giorno/mese/anno;valore", virgola decimale. Si aprono con Excel (doppio clic)
e si possono incollare direttamente nella pagina «Tassi» del programma, riquadro «Incolla più tassi»
(copiare le righe senza l'intestazione). Il 9 mesi non c'è: EMMI ha smesso di pubblicarlo nel 2018.

Gli stessi valori sono dentro la pagina (tassi-precaricati.js, generato da crea-precaricati.js a partire da
questi file), che all'apertura scarica da sola quelli nuovi.
Uso commerciale dei valori: richiede un accordo con EMMI (https://www.emmi-benchmarks.eu/terms-of-use).
`;
  fs.writeFileSync(path.join(DEST, 'LEGGIMI.txt'), '﻿' + leggimi.replace(/\n/g, '\r\n'));
})().catch(e => { console.error(e.message); process.exit(1); });
