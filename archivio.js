// Archivio locale: i dati del mutuo restano nel browser di chi usa la pagina, non c'è nessun server.
// Espone le operazioni sui dati come se fossero richieste a un servizio (leggi, salva rata, salva tasso...), così il
// resto del codice non sa dove stanno i dati.
(function () {
  'use strict';
  const CHIAVE = 'mutuo-variabile:dati';
  // Punto di aggancio per una variante "in un unico file" che non salva niente nel browser (non inclusa qui): con il
  // segnale "MUTUO_UN_FILE" i dati stanno solo in memoria e a ogni modifica viene chiamato Archivio.alCambio.
  const NEL_BROWSER = !window.MUTUO_UN_FILE;
  // Il file dei dati (mutuo-dati.txt) è scritto come uno script, così la pagina aperta dal disco può leggerlo
  // da sola se è nella sua cartella.
  const PREFISSO_FILE = 'window.MutuoDatiSalvati = ';
  const scelte = nome => Calcolo.REGOLE[nome].map(([valore, etichetta, aiuto]) => ({ valore, etichetta, aiuto }));

  // Parametri del mutuo: tipo, limiti, valore iniziale e testi per i moduli. "se" = quando il campo ha senso.
  const CAMPI = {
    nome: { tipo: 'testo', iniziale: 'Il mio mutuo', etichetta: 'Nome del mutuo', aiuto: 'Serve solo a riconoscerlo, ad esempio «Casa di via Roma».' },
    importo_iniziale: { tipo: 'euro', min: 1, max: 1e9, obbligatorio: true, etichetta: 'Importo del mutuo (€)', aiuto: 'Il capitale ricevuto dalla banca.' },
    data_prima_rata: { tipo: 'data', obbligatorio: true, etichetta: 'Inizio del primo periodo',
      aiuto: 'Il giorno da cui partono gli interessi della prima rata: di solito il 1° del mese a cui la rata si riferisce. Ogni periodo dura un mese a partire da questo giorno.' },
    numero_rate: { tipo: 'intero', min: 1, max: 600, obbligatorio: true, etichetta: 'Numero di rate mensili', aiuto: 'Ad esempio 360 per 30 anni, 240 per 20.' },
    spese_rata: { tipo: 'euro', min: 0, max: 1e4, iniziale: 0, etichetta: 'Spese per ogni rata (€)', aiuto: 'Spese di incasso addebitate insieme alla rata, se ci sono.' },
    valore_riferimento: { tipo: 'euro', min: 0, max: 1e9, iniziale: 0, etichetta: 'Valore della casa (€)', aiuto: 'Facoltativo: serve solo a mostrare quanta parte del valore resta da pagare. Lascia 0 per usare l\'importo del mutuo.' },

    indice_nome: { tipo: 'testo', iniziale: 'Euribor 3 mesi', etichetta: 'Indice del contratto', suggerimenti: ['Euribor 1 mese', 'Euribor 3 mesi', 'Euribor 6 mesi', 'Euribor 12 mesi', 'Tasso BCE'],
      aiuto: 'Il tasso di riferimento scritto nel contratto. I suoi valori li inserirai nella pagina «Tassi».' },
    spread: { tipo: 'percento', min: -0.05, max: 0.2, obbligatorio: true, etichetta: 'Spread (%)', aiuto: 'La maggiorazione fissa che la banca somma all\'indice.' },
    mesi_revisione: { tipo: 'scelta', iniziale: 1, etichetta: 'Ogni quanto si aggiorna il tasso',
      opzioni: [1, 3, 6, 12].map(n => ({ valore: n, etichetta: n === 1 ? 'Ogni mese' : `Ogni ${n} mesi`, aiuto: n === 1 ? 'Ogni rata ha il suo valore dell\'indice.' : `Il valore dell'indice resta lo stesso per ${n} rate di fila.` })) },
    regola_rilevazione: { tipo: 'scelta', iniziale: 'lavorativi_prima', etichetta: 'Quando si legge l\'indice', opzioni: scelte('regola_rilevazione') },
    giorni_anticipo_euribor: { tipo: 'intero', min: 1, max: 30, iniziale: 2, etichetta: 'Quanti giorni lavorativi prima', se: p => p.regola_rilevazione === 'lavorativi_prima' },
    giorno_rilevazione: { tipo: 'intero', min: 1, max: 31, iniziale: 1, etichetta: 'Giorno del mese', se: p => p.regola_rilevazione === 'giorno_fisso' },
    conteggio_giorni: { tipo: 'scelta', iniziale: 'mese_12', etichetta: 'Come si contano i giorni per gli interessi', opzioni: scelte('conteggio_giorni') },
    arrotonda_indice: { tipo: 'percento', min: 0, max: 0.01, iniziale: 0, avanzato: true, etichetta: 'Arrotondamento dell\'indice (punti %)', aiuto: 'Ad esempio 0,05 se il contratto arrotonda ai 5 centesimi di punto. Lascia 0 se non arrotonda.' },
    arrotonda_indice_modo: { tipo: 'scelta', iniziale: 'vicino', avanzato: true, etichetta: 'Arrotondamento', opzioni: scelte('arrotonda_indice_modo'), se: p => p.arrotonda_indice > 0 },
    floor_attivo: { tipo: 'scelta', iniziale: 0, avanzato: true, etichetta: 'Indice minimo (clausola «floor»)',
      opzioni: [{ valore: 0, etichetta: 'Non previsto' }, { valore: 1, etichetta: 'Previsto', aiuto: 'L\'indice non può scendere sotto un valore minimo.' }] },
    indice_minimo: { tipo: 'percento', min: -0.05, max: 0.2, iniziale: 0, avanzato: true, etichetta: 'Valore minimo dell\'indice (%)', se: p => p.floor_attivo > 0 },
    tasso_massimo: { tipo: 'percento', min: 0, max: 1, iniziale: 0, avanzato: true, etichetta: 'Tasso massimo del contratto (%)', aiuto: 'Il «cap», se il contratto lo prevede. Lascia 0 se non c\'è.' },

    tipo_piano: { tipo: 'scelta', iniziale: 'francese', etichetta: 'Come si rimborsa il capitale', opzioni: scelte('tipo_piano') },
    tasso_annuo_piano: { tipo: 'percento', min: 0, max: 1, iniziale: 0, etichetta: 'Tasso iniziale del piano (%)', se: p => p.tipo_piano === 'quote_fisse',
      aiuto: 'Il tasso annuo con cui la banca ha calcolato le quote capitale alla firma. Se non lo conosci, la taratura automatica lo ricava dalle quote vere.' },
    rata_piano: { tipo: 'euro', min: 0, max: 1e7, iniziale: 0, avanzato: true, etichetta: 'Rata del piano (€)', se: p => p.tipo_piano === 'quote_fisse',
      aiuto: 'La rata capitale + interessi del piano iniziale. Lascia 0 per calcolarla dal tasso.' },

    euribor_massimo: { tipo: 'percento', min: 0, max: 1, iniziale: 0.05, etichetta: 'Tetto alla previsione dell\'indice (%)', aiuto: 'Per i mesi futuri l\'indice stimato non supera questo valore. Lascia 0 per non mettere un tetto.' },
    rata_obiettivo: { tipo: 'euro', min: 0, max: 1e7, iniziale: 0, nascosto: true },
    // Come il piano stima l'indice delle rate future: si sceglie nella scheda «Previsioni» (previsioni.js).
    previsione_modello: { tipo: 'scelta', iniziale: 'media', nascosto: true, opzioni: ['media', 'arima', 'var', 'garch', 'vasicek'].map(valore => ({ valore })) },
    previsione_opzioni: { tipo: 'testo', iniziale: '', nascosto: true },
    previsione_scenario: { tipo: 'scelta', iniziale: 'atteso', nascosto: true, opzioni: ['atteso', 'alto80', 'basso80'].map(valore => ({ valore })) },
    soglia_differenza: { tipo: 'euro', min: 0, max: 1e6, iniziale: 0.005, nascosto: true },
  };
  // "rata_copiata" è la rata presa dal calcolo con «Compila le rate dal calcolo»: vale come rata vera finché
  // non se ne scrive una a mano, ma resta distinta perché non è stata controllata (taratura e guida la ignorano).
  const CAMPI_RATA = ['rata_vera', 'rata_copiata', 'quota_capitale', 'tasso_applicato', 'euribor', 'spread'];

  class ErroreDati extends Error {}
  const richiedi = (condizione, messaggio) => { if (!condizione) throw new ErroreDati(messaggio); };
  const dataValida = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s + 'T00:00:00Z'))
    && new Date(s + 'T00:00:00Z').toISOString().slice(0, 10) === s;
  const numero = v => typeof v === 'number' && Number.isFinite(v);

  // Controlla i parametri ricevuti e li restituisce puliti. Con "completi" pretende anche quelli obbligatori.
  function controllaParametri(corpo, completi) {
    const puliti = {};
    for (const [chiave, valore] of Object.entries(corpo)) {
      const campo = CAMPI[chiave];
      if (!campo) continue;   // chiavi sconosciute (ad esempio di versioni vecchie) si ignorano
      const nome = campo.etichetta || chiave;
      if (campo.tipo === 'testo') { richiedi(typeof valore === 'string' && valore.trim().length <= 80, `Testo non valido: ${nome}`); puliti[chiave] = valore.trim(); }
      else if (campo.tipo === 'data') {
        richiedi(dataValida(valore), `Data non valida: ${nome}`);
        richiedi(+valore.slice(8) <= 28, `${nome}: scegli un giorno fra 1 e 28, così ogni mese ha il suo periodo`);
        puliti[chiave] = valore;
      } else if (campo.tipo === 'scelta') { richiedi(campo.opzioni.some(o => o.valore === valore), `Scelta non valida: ${nome}`); puliti[chiave] = valore; }
      else {
        richiedi(numero(valore) && valore >= campo.min && valore <= campo.max && (campo.tipo !== 'intero' || Number.isInteger(valore)), `Valore non valido: ${nome}`);
        puliti[chiave] = valore;
      }
    }
    if (completi) for (const [chiave, campo] of Object.entries(CAMPI)) if (campo.obbligatorio) richiedi(puliti[chiave] != null && puliti[chiave] !== '', `Manca: ${campo.etichetta}`);
    return puliti;
  }
  const predefiniti = () => Object.fromEntries(Object.entries(CAMPI).filter(([, c]) => c.iniziale !== undefined).map(([chiave, c]) => [chiave, c.iniziale]));

  // ---------- Lettura e scrittura nel browser ----------
  let dati = null;
  function carica() {
    if (dati) return dati;
    dati = { parametri: {}, rate: [], euribor: [], festivita: [] };
    let testo = null;
    if (NEL_BROWSER) try { testo = localStorage.getItem(CHIAVE); } catch { /* archivio del browser non disponibile: si lavora in memoria */ }
    if (testo) {
      try { dati = pulisci(JSON.parse(testo)); } catch { /* dati illeggibili: si riparte da zero senza toccare quelli salvati */ }
    }
    return dati;
  }
  function salva() {
    // Senza archivio del browser si avvisa soltanto chi tiene il file dei dati.
    if (!NEL_BROWSER) { if (window.Archivio.alCambio) window.Archivio.alCambio(); return; }
    try { localStorage.setItem(CHIAVE, JSON.stringify({ versione: 1, ...dati })); }
    catch { throw new ErroreDati('Il browser non permette di salvare i dati (navigazione privata o spazio esaurito). Usa «Salva su file» per non perderli.'); }
  }
  // Rende valido un insieme di dati letto dal browser o da un file.
  function pulisci(grezzo) {
    richiedi(grezzo && typeof grezzo === 'object', 'Il file non contiene i dati di un mutuo');
    const parametri = grezzo.parametri && typeof grezzo.parametri === 'object' ? controllaParametri(grezzo.parametri, false) : {};
    const rate = (Array.isArray(grezzo.rate) ? grezzo.rate : []).filter(r => r && Number.isInteger(r.n) && r.n >= 1 && r.n <= 600).map(r => {
      const riga = { n: r.n, data_riferimento: dataValida(r.data_riferimento) ? r.data_riferimento : null };
      for (const campo of CAMPI_RATA) riga[campo] = numero(r[campo]) ? r[campo] : null;
      return riga;
    });
    const euribor = (Array.isArray(grezzo.euribor) ? grezzo.euribor : []).filter(t => t && dataValida(t.giorno) && numero(t.tasso_360))
      .map(t => ({ giorno: t.giorno, tasso_360: t.tasso_360 }));
    const festivita = (Array.isArray(grezzo.festivita) ? grezzo.festivita : []).filter(dataValida);
    return ordina({ parametri, rate, euribor, festivita });
  }
  function ordina(d) {
    d.rate = d.rate.filter(r => r.data_riferimento != null || CAMPI_RATA.some(c => r[c] != null)).sort((a, b) => a.n - b.n);
    d.euribor = [...new Map(d.euribor.map(t => [t.giorno, t])).values()].sort((a, b) => a.giorno.localeCompare(b.giorno));
    d.festivita = [...new Set(d.festivita)].sort();
    return d;
  }
  // Copia da consegnare alla pagina: i parametri mancanti prendono il valore iniziale.
  const copia = () => JSON.parse(JSON.stringify({ ...dati, parametri: { ...predefiniti(), ...dati.parametri } }));

  // ---------- Operazioni ----------
  function salvaRata(n, corpo) {
    richiedi(Number.isInteger(n) && n >= 1 && n <= 600, 'Numero di rata non valido');
    let riga = dati.rate.find(r => r.n === n);
    if (!riga) { riga = { n, data_riferimento: null }; for (const campo of CAMPI_RATA) riga[campo] = null; dati.rate.push(riga); }
    for (const [campo, valore] of Object.entries(corpo)) {
      if (campo === 'data_riferimento') richiedi(valore === null || dataValida(valore), 'Data non valida');
      else { richiedi(CAMPI_RATA.includes(campo), `Campo sconosciuto: ${campo}`); richiedi(valore === null || numero(valore), `Valore non valido per ${campo}`); }
      riga[campo] = valore;
    }
    // Una rata vera scritta a mano prende il posto di quella copiata dal calcolo.
    if (riga.rata_vera != null) riga.rata_copiata = null;
  }
  function salvaTassi(righe) {
    richiedi(Array.isArray(righe) && righe.length > 0, 'Nessun tasso da salvare');
    for (const r of righe) {
      richiedi(r && dataValida(r.giorno), `Data non valida: ${r && r.giorno}`);
      richiedi(numero(r.tasso_360) && Math.abs(r.tasso_360) < 1, `Tasso non valido per ${r.giorno}`);
    }
    const perGiorno = new Map(dati.euribor.map(t => [t.giorno, t]));
    for (const r of righe) perGiorno.set(r.giorno, { giorno: r.giorno, tasso_360: r.tasso_360 });
    dati.euribor = [...perGiorno.values()];
  }
  // Festività TARGET degli anni del piano (più uno prima e uno dopo), aggiunte a quelle già presenti.
  function generaFestivita(parametri) {
    const primo = +parametri.data_prima_rata.slice(0, 4) - 1, ultimo = primo + Math.ceil(parametri.numero_rate / 12) + 2;
    for (let anno = primo; anno <= ultimo; anno++) dati.festivita.push(...Calcolo.festivitaTarget(anno));
  }

  async function richiesta(metodo, percorso, corpo) {
    carica();
    const [risorsa, chiave] = percorso.split('/');
    const prima = JSON.stringify(dati);
    try {
      if (metodo === 'GET' && risorsa === 'dati') return copia();
      if (metodo === 'POST' && risorsa === 'configura') {
        const parametri = controllaParametri(corpo.parametri || {}, true);
        dati.parametri = { ...dati.parametri, ...parametri };
        generaFestivita(dati.parametri);
        // Valori dell'indice già disponibili: si aggiungono solo i giorni che mancano, senza toccare quelli inseriti.
        const presenti = new Set(dati.euribor.map(t => t.giorno));
        const nuovi = (corpo.tassi || []).filter(t => t && !presenti.has(t.giorno));
        if (nuovi.length) salvaTassi(nuovi);
        // Rate già pagate inserite nella guida.
        for (const r of corpo.rate || []) salvaRata(r.n, { rata_vera: r.rata_vera, quota_capitale: r.quota_capitale });
      }
      else if (metodo === 'PUT' && risorsa === 'parametri') dati.parametri = { ...dati.parametri, ...controllaParametri(corpo, false) };
      else if (metodo === 'PUT' && risorsa === 'rate') salvaRata(Number(chiave), corpo);
      // Più rate in una volta: righe = [{ n, ...campi }].
      else if (metodo === 'POST' && risorsa === 'rate') {
        richiedi(Array.isArray(corpo.righe) && corpo.righe.length > 0, 'Nessuna rata da salvare');
        for (const { n, ...campi } of corpo.righe) salvaRata(n, campi);
      }
      else if (metodo === 'POST' && risorsa === 'euribor') salvaTassi(corpo.righe);
      else if (metodo === 'PUT' && risorsa === 'euribor') salvaTassi([{ ...corpo, giorno: chiave }]);
      else if (metodo === 'DELETE' && risorsa === 'euribor') dati.euribor = dati.euribor.filter(t => t.giorno !== chiave);
      else if (metodo === 'PUT' && risorsa === 'festivita') { richiedi(dataValida(chiave), 'Data non valida'); dati.festivita.push(chiave); }
      else if (metodo === 'DELETE' && risorsa === 'festivita') dati.festivita = dati.festivita.filter(g => g !== chiave);
      else throw new ErroreDati('Operazione non riconosciuta');
      ordina(dati);
      salva();
      return copia();
    } catch (errore) {
      dati = JSON.parse(prima);   // o si salva tutto o niente
      throw errore;
    }
  }

  // Valori dell'indice già presenti nel programma (tassi-precaricati.js, generato dai CSV della Bundesbank), se il nome
  // dell'indice è un Euribor riconosciuto (TassiInternet.riconosci). Con "dal" (ISO) solo i giorni da quella data in poi:
  // per un mutuo servono quelli dal suo inizio, non dal 1999.
  const decodificati = new Map();
  function precaricati(nomeIndice, dal) {
    const p = window.TassiPrecaricati, serie = window.TassiInternet ? TassiInternet.riconosci(nomeIndice) : null;
    if (!p || !serie || !p.serie[serie.codice]) return [];
    if (!decodificati.has(serie.codice)) {
      const lista = [];
      for (const [anno, testo] of Object.entries(p.serie[serie.codice].anni)) {
        const pezzi = testo.split(' ');
        for (let i = 0; i + 1 < pezzi.length; i += 2) lista.push({ giorno: `${anno}-${pezzi[i].slice(0, 2)}-${pezzi[i].slice(2)}`, tasso_360: Number((parseFloat(pezzi[i + 1]) / 100).toFixed(14)) });
      }
      decodificati.set(serie.codice, lista.sort((a, b) => a.giorno.localeCompare(b.giorno)));
    }
    const tutti = decodificati.get(serie.codice);
    return dal ? tutti.filter(t => t.giorno >= dal) : tutti;
  }

  window.Archivio = {
    CAMPI, richiesta, predefiniti, precaricati,
    configurato: () => carica().parametri.importo_iniziale > 0,
    // Testo del salvataggio da scaricare come file.
    esporta: () => JSON.stringify({ programma: 'mutuo-variabile', versione: 1, salvato: new Date().toISOString(), ...carica() }, null, 1),
    // Lo stesso salvataggio nella forma del file dei dati della versione in un unico file.
    esportaFile() { return PREFISSO_FILE + this.esporta() + ';\n'; },
    // Sostituisce tutti i dati con quelli di un salvataggio (va bene sia il .json sia il file dei dati).
    importa(testo) {
      let grezzo;
      try { grezzo = JSON.parse(String(testo).replace(/^﻿?\s*window\.MutuoDatiSalvati\s*=\s*/, '').replace(/;\s*$/, '')); }
      catch { throw new ErroreDati('Il file non è un salvataggio valido'); }
      const nuovi = pulisci(grezzo);
      richiedi(nuovi.parametri.importo_iniziale > 0, 'Il file non contiene la configurazione di un mutuo');
      dati = nuovi;
      salva();
      return copia();
    },
    azzera() {
      dati = { parametri: {}, rate: [], euribor: [], festivita: [] };
      if (NEL_BROWSER) try { localStorage.removeItem(CHIAVE); } catch { /* niente da cancellare */ }
    },
  };
})();
