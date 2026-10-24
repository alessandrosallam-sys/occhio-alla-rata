// Lo storico degli Euribor su questo dispositivo (24 ottobre 2026, per la versione da installare sul telefono).
// I valori dell'Euribor non stanno nel repository né sul sito (licenza EMMI, vedi README): ogni dispositivo li scarica da
// solo dal sito della Bundesbank e ne tiene una copia nel browser, così le previsioni hanno tutta la storia dal 1999
// anche senza connessione. Questo file:
//  - unisce i valori di tassi-precaricati.js (se c'è: è generato, e solo sul computer di chi l'ha creato) con quelli
//    scaricati in passato, e mette il risultato in window.TassiPrecaricati, dove lo legge Archivio.precaricati;
//  - all'apertura (Storico.aggiorna, chiamato da tassi.js) scarica i giorni che mancano a ciascuna delle cinque serie:
//    la prima volta tutta la storia (circa 7.000 valori per serie), poi solo i giorni nuovi;
//  - salva nel browser solo i valori scaricati (chiave «mutuo-variabile:euribor-storico»), nello stesso formato compatto
//    dei precaricati: per ogni serie e anno una stringa "mmgg valore mmgg valore …", valore in percentuale.
(function () {
  'use strict';
  const CHIAVE = 'mutuo-variabile:euribor-storico';
  const Internet = window.TassiInternet;
  const dalFile = window.TassiPrecaricati || null;

  // Da stringhe per anno a una mappa giorno → valore (testo in percentuale, come nei file della Bundesbank) e ritorno.
  function decodifica(anni, mappa = new Map()) {
    for (const [anno, testo] of Object.entries(anni || {})) {
      const pezzi = String(testo).split(' ');
      for (let i = 0; i + 1 < pezzi.length; i += 2) mappa.set(`${anno}-${pezzi[i].slice(0, 2)}-${pezzi[i].slice(2)}`, pezzi[i + 1]);
    }
    return mappa;
  }
  function codifica(mappa) {
    const anni = {};
    for (const giorno of [...mappa.keys()].sort()) {
      const anno = giorno.slice(0, 4);
      anni[anno] = (anni[anno] ? anni[anno] + ' ' : '') + giorno.slice(5, 7) + giorno.slice(8) + ' ' + mappa.get(giorno);
    }
    return anni;
  }
  // Il valore scaricato (decimale, base 360) nella forma del file: percentuale con le cifre che servono.
  const inPercento = v => String(Number((v * 100).toFixed(6)));

  // ---------- Copia nel browser ----------
  function leggiLocale() {
    try {
      const d = JSON.parse(localStorage.getItem(CHIAVE) || 'null');
      if (!d || typeof d !== 'object' || !d.serie) return null;
      return d;
    } catch { return null; }
  }
  const locale = leggiLocale() || { serie: {}, aggiornato: null, pubblicato: null };
  const scaricati = new Map();   // codice della serie → Map giorno → valore: solo i valori presi dalla Bundesbank
  for (const [codice, s] of Object.entries(locale.serie)) scaricati.set(codice, decodifica(s.anni));
  let salvataggio = 'ok';        // 'ok', 'pieno' (il browser non ha spazio: la copia vale solo finché la pagina è aperta)
  function salva() {
    const serie = {};
    for (const [codice, mappa] of scaricati) if (mappa.size) serie[codice] = { valori: mappa.size, anni: codifica(mappa) };
    try {
      localStorage.setItem(CHIAVE, JSON.stringify({ serie, aggiornato: locale.aggiornato, pubblicato: locale.pubblicato }));
      salvataggio = 'ok';
    } catch { salvataggio = 'pieno'; }
  }

  // ---------- Valori uniti: file + scaricati ----------
  let unite = new Map();
  function unisci() {
    unite = new Map();
    for (const s of Internet.SERIE) {
      const mappa = new Map();
      if (dalFile && dalFile.serie[s.codice]) decodifica(dalFile.serie[s.codice].anni, mappa);
      for (const [giorno, valore] of scaricati.get(s.codice) || []) mappa.set(giorno, valore);
      if (mappa.size) unite.set(s.codice, mappa);
    }
    const giorni = [...unite.values()].flatMap(m => [...m.keys()]).sort();
    window.TassiPrecaricati = {
      fonte: 'Bundesbank', dal: giorni[0] || null, al: giorni[giorni.length - 1] || null,
      valori: [...unite.values()].reduce((n, m) => n + m.size, 0), conFile: !!dalFile, scaricati: scaricati.size > 0,
      serie: Object.fromEntries([...unite].map(([codice, mappa]) => [codice, { nome: Internet.perCodice(codice).nome, valori: mappa.size, anni: codifica(mappa) }])),
    };
    if (window.Archivio && window.Archivio.precaricatiCambiati) window.Archivio.precaricatiCambiati();
  }
  unisci();
  const ultimoDi = codice => { const m = unite.get(codice); if (!m || !m.size) return ''; let u = ''; for (const g of m.keys()) if (g > u) u = g; return u; };

  // ---------- Aggiornamento dalla Bundesbank ----------
  const isoOggi = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  // L'ultimo giorno il cui valore è già uscito: la Bundesbank pubblica il valore di un giorno feriale il giorno feriale
  // dopo. Il martedì si aspetta quello di lunedì; il sabato quello di giovedì (il venerdì esce lunedì). Le festività non
  // si contano: in quei giorni, al massimo, si chiede una volta in più e non arriva niente.
  const feriale = d => d.getUTCDay() !== 0 && d.getUTCDay() !== 6;
  const sposta = (d, verso) => { const n = new Date(d); do n.setUTCDate(n.getUTCDate() + verso); while (!feriale(n)); return n; };
  function ultimoAtteso(oggi) {
    const fineOggi = new Date(oggi + 'T00:00:00Z');
    let d = sposta(fineOggi, -1);
    while (sposta(d, 1) > fineOggi) d = sposta(d, -1);
    return d.toISOString().slice(0, 10);
  }
  const giornoDopo = iso => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); };
  let esito = null, inCorso = null;
  // Scarica i giorni che mancano a ogni serie. Restituisce { nuovi, errore, completo }: «completo» se ora tutte le
  // serie arrivano fino all'ultimo giorno pubblicato. Una sola esecuzione alla volta.
  function aggiorna() {
    if (inCorso) return inCorso;
    inCorso = (async () => {
      const oggi = isoOggi(), atteso = ultimoAtteso(oggi);
      let nuovi = 0, errore = null;
      for (const s of Internet.SERIE) {
        const ultimo = ultimoDi(s.codice);
        if (ultimo >= atteso) continue;
        try {
          const { valori, aggiornato } = await Internet.scarica(s, ultimo ? giornoDopo(ultimo) : '1999-01-01', oggi);
          if (!scaricati.has(s.codice)) scaricati.set(s.codice, new Map());
          const mappa = scaricati.get(s.codice);
          for (const v of valori) if (!unite.has(s.codice) || !unite.get(s.codice).has(v.giorno)) { mappa.set(v.giorno, inPercento(v.tasso_360)); nuovi++; }
          if (aggiornato) locale.pubblicato = aggiornato;
        } catch (e) { errore = e.message; break; }
      }
      if (!errore) locale.aggiornato = new Date().toISOString();
      if (nuovi || !errore) salva();
      if (nuovi) unisci();
      esito = { nuovi, errore, quando: new Date().toISOString(), completo: Internet.SERIE.every(s => ultimoDi(s.codice) >= atteso) };
      inCorso = null;
      document.dispatchEvent(new CustomEvent('storico-aggiornato', { detail: esito }));
      return esito;
    })();
    return inCorso;
  }

  // Una frase su che cosa c'è sul dispositivo, per la pagina Tassi.
  function descrizione() {
    const p = window.TassiPrecaricati, data = iso => iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '';
    if (inCorso) return 'Scarico dalla Bundesbank lo storico dell\'Euribor che manca su questo dispositivo…';
    if (!p.valori) return esito && esito.errore
      ? `Su questo dispositivo non c'è ancora lo storico dell'Euribor e ora non riesco a scaricarlo: ${esito.errore}`
      : 'Su questo dispositivo non c\'è ancora lo storico dell\'Euribor: lo scarico alla prossima apertura con la connessione.';
    let frase = `Storico dell'Euribor su questo dispositivo: dal ${data(p.dal)} al ${data(p.al)}.`;
    if (esito && esito.errore) frase += ` Senza connessione uso questi valori; i giorni nuovi arrivano appena torna internet.`;
    else if (locale.aggiornato) {
      const quando = new Date(locale.aggiornato), oggi = new Date().toDateString() === quando.toDateString();
      frase += ` Controllato ${oggi ? 'oggi' : 'il ' + quando.toLocaleDateString('it-IT')} alle ${quando.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}.`;
    }
    if (salvataggio === 'pieno') frase += ' Il browser non ha spazio per tenerlo: vale finché la pagina resta aperta.';
    return frase;
  }

  // Quando torna la connessione, riprova (solo se l'ultimo tentativo era fallito).
  window.addEventListener('online', () => { if (esito && esito.errore) aggiorna(); });

  window.Storico = { aggiorna, descrizione, esito: () => esito, inCorso: () => !!inCorso, ultimo: ultimoDi };
})();
