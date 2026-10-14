// Genera tassi-precaricati.js dai file CSV di dati-euribor/ (scaricati dalla Bundesbank con dati-euribor/scarica.js).
//   da questa cartella:  node crea-precaricati.js
// Formato compatto: per ogni serie e per ogni anno una stringa "mmgg valore mmgg valore …" (valore in percentuale).
// La decodifica è in archivio.js (Archivio.precaricati).
'use strict';
const fs = require('fs');
const path = require('path');
const ORIGINE = path.join(__dirname, 'dati-euribor');
const DESTINAZIONE = path.join(__dirname, 'tassi-precaricati.js');
const SERIE = [['W01', 'Euribor 1 settimana', 'euribor-1-settimana.csv'], ['M01', 'Euribor 1 mese', 'euribor-1-mese.csv'],
  ['M03', 'Euribor 3 mesi', 'euribor-3-mesi.csv'], ['M06', 'Euribor 6 mesi', 'euribor-6-mesi.csv'], ['M12', 'Euribor 12 mesi', 'euribor-12-mesi.csv']];

let primo = '9999', ultimo = '0000', totale = 0;
const blocchi = [];
for (const [codice, nome, file] of SERIE) {
  const righe = fs.readFileSync(path.join(ORIGINE, file), 'utf8').replace(/^﻿/, '').split(/\r?\n/);
  const perAnno = new Map();
  let quanti = 0;
  for (const riga of righe) {
    const m = /^(\d{2})\/(\d{2})\/(\d{4});(-?\d+(?:,\d+)?)$/.exec(riga.trim());
    if (!m) continue;
    const [, giorno, mese, anno, valore] = m;
    if (!perAnno.has(anno)) perAnno.set(anno, []);
    perAnno.get(anno).push(mese + giorno, valore.replace(',', '.'));
    const iso = `${anno}-${mese}-${giorno}`;
    if (iso < primo) primo = iso;
    if (iso > ultimo) ultimo = iso;
    quanti++;
  }
  if (!quanti) throw new Error(`Nessun valore in ${file}`);
  totale += quanti;
  const anni = [...perAnno.keys()].sort().map(anno => `      ${anno}: '${perAnno.get(anno).join(' ')}'`).join(',\n');
  blocchi.push(`    ${codice}: { nome: '${nome}', valori: ${quanti}, anni: {\n${anni} } }`);
  console.log(`${nome}: ${quanti} valori`);
}
const oggi = new Date().toISOString().slice(0, 10);
const testo = `// Valori giornalieri degli Euribor (base 360), in percentuale, già dentro il programma: con il nome dell'indice
// riconosciuto vengono proposti nella guida e nella pagina «Tassi», così non vanno inseriti a mano e i conti si fanno
// anche senza connessione. Fonte: Deutsche Bundesbank (dati-euribor/*.csv, scaricati con dati-euribor/scarica.js).
// GENERATO da crea-precaricati.js il ${oggi}: non modificare a mano. Per ogni serie e anno: "mmgg valore mmgg valore …".
window.TassiPrecaricati = {
  fonte: 'Bundesbank', dal: '${primo}', al: '${ultimo}', valori: ${totale},
  serie: {
${blocchi.join(',\n')}
  }
};
`;
fs.writeFileSync(DESTINAZIONE, testo);
console.log(`Scritto ${DESTINAZIONE}: ${totale} valori dal ${primo} al ${ultimo}, ${Math.round(testo.length / 1024)} KB`);
