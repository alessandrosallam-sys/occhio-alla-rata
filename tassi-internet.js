// Valori dell'Euribor scaricati da internet.
// Fonte: il servizio dati della Deutsche Bundesbank (banca centrale tedesca), che pubblica i valori giornalieri
// di tutti gli Euribor (1 settimana, 1, 3, 6 e 12 mesi) con un giorno lavorativo di ritardo, e che accetta le
// richieste fatte dal browser anche da una pagina aperta dal disco (intestazione "Access-Control-Allow-Origin: *").
// Gli altri siti consultati (euribor-rates.eu, EMMI, BCE) non lo permettono, oppure danno solo medie mensili.
// Risposta: un CSV con alcune righe di intestazione ("last update,2026-10-14 13:41:39,") e poi una riga per giorno,
// "2026-10-13,2.905," (valore in percentuale; i giorni senza valore hanno un punto). Senza "lang=en" il formato
// dipende dalla lingua del browser (in tedesco: "2026-10-13;2,905;" e "Stand vom;14.10.2026 …"): si accettano entrambi.
// Dagli stessi dati (dati-euribor/*.csv, scaricati con dati-euribor/scarica.js) è generato tassi-precaricati.js.
(function () {
  'use strict';
  const BASE = 'https://api.statistiken.bundesbank.de/rest/data/BBIG1/D.D0.EUR.MMKT.EURIBOR.';
  const FONTE = 'Bundesbank';
  // Le versioni dell'Euribor pubblicate: codice della serie e come riconoscerle dal nome scritto nella configurazione.
  const SERIE = [
    { codice: 'W01', nome: 'Euribor 1 settimana', riconosci: /\b(1|una)\s*(settimana|sett\.?|w)\b/i },
    { codice: 'M01', nome: 'Euribor 1 mese', riconosci: /\b(1|un)\s*(mese|m)\b/i },
    { codice: 'M03', nome: 'Euribor 3 mesi', riconosci: /\b(3|tre)\s*(mesi|m)\b/i },
    { codice: 'M06', nome: 'Euribor 6 mesi', riconosci: /\b(6|sei)\s*(mesi|m)\b/i },
    { codice: 'M12', nome: 'Euribor 12 mesi', riconosci: /\b(12|dodici)\s*(mesi|m)\b|\b(1|un)\s*(anno|a|y)\b/i },
  ];
  const ELENCO = SERIE.map(s => s.nome.replace('Euribor ', '')).join(', ').replace(/, ([^,]+)$/, ' e $1');

  // La serie che corrisponde al nome dell'indice del contratto, oppure null se non è un Euribor riconoscibile.
  function riconosci(nomeIndice) {
    const nome = String(nomeIndice || '').replace(/\s+a\s+/i, ' ');
    if (!/euribor/i.test(nome)) return null;
    return SERIE.find(s => s.riconosci.test(nome)) || null;
  }
  const perCodice = codice => SERIE.find(s => s.codice === codice) || null;

  // Da quale giorno scaricare: due mesi prima del primo periodo del mutuo, così c'è anche la rilevazione della prima rata
  // (e il mese intero per chi usa la media del mese precedente).
  function inizioScarico(dataPrimaRata) {
    const [anno, mese] = String(dataPrimaRata || '').split('-').map(Number);
    if (!anno) return '1999-01-01';
    return new Date(Date.UTC(anno, mese - 1 - 2, 1)).toISOString().slice(0, 10);
  }

  // Scarica i valori della serie fra due giorni (ISO). Restituisce { valori: [{ giorno, tasso_360 }], aggiornato }
  // dove "aggiornato" è il giorno (ISO) in cui la Bundesbank ha pubblicato i dati, se indicato.
  async function scarica(serie, dal, al) {
    const indirizzo = `${BASE}${serie.codice}.BID._Z?format=csv&lang=en&startPeriod=${dal}&endPeriod=${al}`;
    let risposta;
    try {
      risposta = await fetch(indirizzo, { cache: 'no-store' });
    } catch {
      throw new Error(`Non riesco a raggiungere il sito della ${FONTE}: controlla la connessione a internet e riprova.`);
    }
    if (!risposta.ok) throw new Error(`Il sito della ${FONTE} ha risposto con l'errore ${risposta.status}: riprova più tardi.`);
    const testo = await risposta.text();
    const valori = [];
    let aggiornato = null;
    for (const riga of testo.split(/\r?\n/)) {
      const valore = /^(\d{4}-\d{2}-\d{2})[,;](-?\d+(?:[.,]\d+)?)[,;]/.exec(riga);
      if (valore) { valori.push({ giorno: valore[1], tasso_360: Number((parseFloat(valore[2].replace(',', '.')) / 100).toFixed(14)) }); continue; }
      const inglese = /^last update,(\d{4}-\d{2}-\d{2})/i.exec(riga);
      if (inglese) { aggiornato = inglese[1]; continue; }
      const tedesco = /^Stand vom;(\d{2})\.(\d{2})\.(\d{4})/.exec(riga);
      if (tedesco) aggiornato = `${tedesco[3]}-${tedesco[2]}-${tedesco[1]}`;
    }
    if (!valori.length && !testo.includes(serie.codice)) throw new Error(`Non riconosco più il formato dei dati della ${FONTE}: i valori vanno inseriti a mano.`);
    valori.sort((a, b) => a.giorno.localeCompare(b.giorno));
    return { valori, aggiornato };
  }

  // Confronta i valori scaricati con quelli già presenti: quali sono nuovi, quali uguali, quali diversi.
  function confronta(scaricati, presenti) {
    const perGiorno = new Map(presenti.map(t => [t.giorno, t.tasso_360]));
    const esito = { nuovi: [], uguali: 0, diversi: [] };
    for (const v of scaricati) {
      if (!perGiorno.has(v.giorno)) esito.nuovi.push(v);
      else if (Math.abs(perGiorno.get(v.giorno) - v.tasso_360) < 1e-9) esito.uguali++;
      else esito.diversi.push({ ...v, presente: perGiorno.get(v.giorno) });
    }
    return esito;
  }

  // Testo per l'interfaccia: che cosa si scarica e da dove.
  const spiegazione = `I valori di tutti gli Euribor (${ELENCO}) li pubblica ogni giorno lavorativo la Bundesbank, la banca centrale tedesca, con un giorno di ritardo. Il programma li scarica dal suo sito: servono la connessione a internet e qualche secondo.`;

  window.TassiInternet = { FONTE, SERIE, riconosci, perCodice, inizioScarico, scarica, confronta, spiegazione };
})();
