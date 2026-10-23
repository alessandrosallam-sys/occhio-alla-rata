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

  // Parametri di un prestito: tipo, limiti, valore iniziale e testi per i moduli. "se" = quando il campo ha senso
  // (anche per una singola scelta di un elenco); un campo obbligatorio lo è solo quando ha senso.
  const variabile = p => (p.tipo_prestito || 'variabile') === 'variabile';
  const maxirata = p => p.tipo_prestito === 'maxirata';
  const CAMPI = {
    tipo_prestito: { tipo: 'scelta', iniziale: 'variabile', etichetta: 'Tipo di prestito', opzioni: [
      { valore: 'variabile', icona: 'grafico', etichetta: 'Mutuo a tasso variabile', aiuto: 'Il tasso segue un indice di mercato (di solito l\'Euribor) più uno spread fisso: la rata cambia nel tempo.' },
      { valore: 'fisso', icona: 'casa', etichetta: 'Mutuo a tasso fisso', aiuto: 'Il tasso è scritto nel contratto e resta lo stesso fino all\'ultima rata.' },
      { valore: 'finanziamento', icona: 'portafoglio', etichetta: 'Finanziamento o prestito personale', aiuto: 'Prestito personale, per l\'auto, per un acquisto a rate, cessione del quinto: quasi sempre a tasso fisso, con TAN e TAEG scritti nel contratto.' },
      { valore: 'maxirata', icona: 'auto', etichetta: 'Finanziamento con maxirata finale', aiuto: 'Tipico delle auto: di solito un anticipo, rate mensili basse e alla fine una rata molto più grande (maxirata, rata finale o «valore futuro garantito»).' }] },
    // La categoria scelta nella guida (vedi CATEGORIE): cambia solo icona, nome e domande, i conti li decide il tipo.
    categoria: { tipo: 'testo', iniziale: '', nascosto: true, lunghezza: 20 },
    nome: { tipo: 'testo', iniziale: 'Il mio prestito', etichetta: 'Nome del prestito', aiuto: 'Serve solo a riconoscerlo, ad esempio «Casa di via Roma» o «Auto».' },
    importo_iniziale: { tipo: 'euro', min: 1, max: 1e9, obbligatorio: true, etichetta: 'Importo del prestito (€)', aiuto: 'Il capitale prestato dalla banca o dalla finanziaria.' },
    data_prima_rata: { tipo: 'data', obbligatorio: true, etichetta: 'Inizio del primo periodo',
      aiuto: 'Il giorno da cui partono gli interessi della prima rata: di solito il 1° del mese a cui la rata si riferisce. Ogni periodo dura un mese a partire da questo giorno.' },
    numero_rate: { tipo: 'intero', min: 1, max: 600, obbligatorio: true, etichetta: 'Numero di rate mensili', aiuto: 'Ad esempio 360 per 30 anni, 240 per 20, 60 per 5. Con la maxirata, solo le rate normali che vengono prima.' },
    // Con la maxirata le rate normali sono "numero_rate"; la maxirata è una rata in più, il mese dopo l'ultima.
    maxirata: { tipo: 'euro', min: 1, max: 1e9, obbligatorio: true, etichetta: 'Maxirata finale (€)', se: maxirata,
      aiuto: 'L\'ultima rata, molto più grande delle altre, da pagare il mese dopo l\'ultima rata normale.' },
    anticipo: { tipo: 'euro', min: 0, max: 1e9, iniziale: 0, etichetta: 'Anticipo (€)', se: p => p.tipo_prestito === 'finanziamento' || maxirata(p),
      aiuto: 'Facoltativo: quello che hai pagato subito al venditore. Non è un prestito, quindi non cambia rate né TAEG: serve a mostrare quanto paghi in tutto.' },
    valore_riferimento: { tipo: 'euro', min: 0, max: 1e9, iniziale: 0, etichetta: 'Valore della casa (€)', se: p => p.tipo_prestito !== 'finanziamento' && !maxirata(p),
      aiuto: 'Facoltativo: serve solo a mostrare quanta parte del valore resta da pagare. Lascia 0 per usare l\'importo del mutuo.' },

    spese_rata: { tipo: 'euro', min: 0, max: 1e4, iniziale: 0, etichetta: 'Spese per ogni rata (€)', aiuto: 'Spese di incasso addebitate insieme alla rata, se ci sono.' },
    spese_iniziali: { tipo: 'euro', min: 0, max: 1e7, iniziale: 0, etichetta: 'Spese iniziali (€)',
      aiuto: 'Pagate una volta sola, all\'inizio: istruttoria, perizia, imposta sostitutiva o di bollo. Non cambiano le rate, ma entrano nel costo totale e nel TAEG.' },
    assicurazione_iniziale: { tipo: 'euro', min: 0, max: 1e7, iniziale: 0, etichetta: 'Assicurazione pagata all\'inizio (€)',
      aiuto: 'Il premio unico di un\'assicurazione legata al prestito, anche se è stato aggiunto all\'importo prestato.' },
    assicurazione_rata: { tipo: 'euro', min: 0, max: 1e5, iniziale: 0, etichetta: 'Assicurazione a ogni rata (€)',
      aiuto: 'Il premio mensile, se lo paghi a parte. Se è già dentro la rata addebitata, scrivilo nelle spese per rata.' },
    spese_annue: { tipo: 'euro', min: 0, max: 1e5, iniziale: 0, avanzato: true, etichetta: 'Spese ogni anno (€)', aiuto: 'Ad esempio l\'imposta di bollo sul rendiconto annuale.' },
    // Spese iniziali pagate di tasca propria, oppure tolte dalla somma ricevuta (o aggiunte al prestito): il TAEG è lo
    // stesso, cambia solo quanto si paga in tutto, perché nel secondo caso le spese sono già dentro le rate.
    spese_nel_prestito: { tipo: 'scelta', iniziale: 0, etichetta: 'Come hai pagato le spese iniziali', se: p => p.spese_iniziali > 0 || p.assicurazione_iniziale > 0,
      opzioni: [{ valore: 0, etichetta: 'A parte, con soldi miei', aiuto: 'Le hai pagate alla firma: hai ricevuto tutto l\'importo del prestito.' },
        { valore: 1, etichetta: 'Dentro il prestito', aiuto: 'Sono state tolte dalla somma che hai ricevuto, oppure aggiunte all\'importo prestato: le restituisci con le rate.' }] },

    tasso_fisso: { tipo: 'percento', min: 0, max: 0.5, obbligatorio: true, etichetta: 'Tasso annuo nominale, TAN (%)', se: p => !variabile(p),
      aiuto: 'Il tasso scritto nel contratto: «TAN» o «tasso annuo nominale». Per un finanziamento «a tasso zero» scrivi 0.' },
    indice_nome: { tipo: 'testo', iniziale: 'Euribor 3 mesi', etichetta: 'Indice del contratto', suggerimenti: ['Euribor 1 mese', 'Euribor 3 mesi', 'Euribor 6 mesi', 'Euribor 12 mesi', 'Tasso BCE'], se: variabile,
      aiuto: 'Il tasso di riferimento scritto nel contratto. I suoi valori li inserirai nella pagina «Tassi».' },
    spread: { tipo: 'percento', min: -0.05, max: 0.2, obbligatorio: true, etichetta: 'Spread (%)', se: variabile, aiuto: 'La maggiorazione fissa che la banca somma all\'indice.' },
    taeg_dichiarato: { tipo: 'percento', min: 0, max: 1, iniziale: 0, etichetta: 'TAEG del contratto (%)',
      aiuto: 'Il «tasso annuo effettivo globale» scritto nel contratto o nel foglio informativo (SECCI per i finanziamenti, PIES per i mutui). Facoltativo: serve a controllare quello che calcola il programma.' },
    mesi_revisione: { tipo: 'scelta', iniziale: 1, etichetta: 'Ogni quanto si aggiorna il tasso', se: variabile,
      opzioni: [1, 3, 6, 12].map(n => ({ valore: n, etichetta: n === 1 ? 'Ogni mese' : `Ogni ${n} mesi`, aiuto: n === 1 ? 'Ogni rata ha il suo valore dell\'indice.' : `Il valore dell'indice resta lo stesso per ${n} rate di fila.` })) },
    regola_rilevazione: { tipo: 'scelta', iniziale: 'lavorativi_prima', etichetta: 'Quando si legge l\'indice', opzioni: scelte('regola_rilevazione'), se: variabile },
    giorni_anticipo_euribor: { tipo: 'intero', min: 1, max: 30, iniziale: 2, etichetta: 'Quanti giorni lavorativi prima', se: p => variabile(p) && p.regola_rilevazione === 'lavorativi_prima' },
    giorno_rilevazione: { tipo: 'intero', min: 1, max: 31, iniziale: 1, etichetta: 'Giorno del mese', se: p => variabile(p) && p.regola_rilevazione === 'giorno_fisso' },
    conteggio_giorni: { tipo: 'scelta', iniziale: 'mese_12', etichetta: 'Come si contano i giorni per gli interessi', opzioni: scelte('conteggio_giorni') },
    arrotonda_indice: { tipo: 'percento', min: 0, max: 0.01, iniziale: 0, avanzato: true, etichetta: 'Arrotondamento dell\'indice (punti %)', se: variabile, aiuto: 'Ad esempio 0,05 se il contratto arrotonda ai 5 centesimi di punto. Lascia 0 se non arrotonda.' },
    arrotonda_indice_modo: { tipo: 'scelta', iniziale: 'vicino', avanzato: true, etichetta: 'Arrotondamento', opzioni: scelte('arrotonda_indice_modo'), se: p => variabile(p) && p.arrotonda_indice > 0 },
    floor_attivo: { tipo: 'scelta', iniziale: 0, avanzato: true, etichetta: 'Indice minimo (clausola «floor»)', se: variabile,
      opzioni: [{ valore: 0, etichetta: 'Non previsto' }, { valore: 1, etichetta: 'Previsto', aiuto: 'L\'indice non può scendere sotto un valore minimo.' }] },
    indice_minimo: { tipo: 'percento', min: -0.05, max: 0.2, iniziale: 0, avanzato: true, etichetta: 'Valore minimo dell\'indice (%)', se: p => variabile(p) && p.floor_attivo > 0 },
    tasso_massimo: { tipo: 'percento', min: 0, max: 1, iniziale: 0, avanzato: true, etichetta: 'Tasso massimo del contratto (%)', se: variabile, aiuto: 'Il «cap», se il contratto lo prevede. Lascia 0 se non c\'è.' },

    // Le quote capitale fissate all'inizio hanno senso solo quando il tasso cambia: a tasso fisso coincidono con la francese.
    arrotonda_rata: { tipo: 'scelta', iniziale: 'centesimo', avanzato: true, etichetta: 'Arrotondamento della rata', opzioni: scelte('arrotonda_rata'), se: p => !variabile(p) },
    tipo_piano: { tipo: 'scelta', iniziale: 'francese', etichetta: 'Come si rimborsa il capitale',
      opzioni: scelte('tipo_piano').map(o => o.valore === 'quote_fisse' ? { ...o, se: variabile } : o.valore === 'italiana' ? { ...o, se: p => !maxirata(p) } : o) },
    tasso_annuo_piano: { tipo: 'percento', min: 0, max: 1, iniziale: 0, etichetta: 'Tasso iniziale del piano (%)', se: p => variabile(p) && p.tipo_piano === 'quote_fisse',
      aiuto: 'Il tasso annuo con cui la banca ha calcolato le quote capitale alla firma. Se non lo conosci, la taratura automatica lo ricava dalle quote vere.' },
    rata_piano: { tipo: 'euro', min: 0, max: 1e7, iniziale: 0, avanzato: true, etichetta: 'Rata del piano (€)', se: p => variabile(p) && p.tipo_piano === 'quote_fisse',
      aiuto: 'La rata capitale + interessi del piano iniziale. Lascia 0 per calcolarla dal tasso.' },

    euribor_massimo: { tipo: 'percento', min: 0, max: 1, iniziale: 0.05, etichetta: 'Tetto alla previsione dell\'indice (%)', se: variabile, aiuto: 'Per i mesi futuri l\'indice stimato non supera questo valore. Lascia 0 per non mettere un tetto.' },
    rata_obiettivo: { tipo: 'euro', min: 0, max: 1e7, iniziale: 0, nascosto: true },
    // Come il piano stima l'indice delle rate future: si sceglie nella scheda «Previsioni» (previsioni.js).
    previsione_modello: { tipo: 'scelta', iniziale: 'media', nascosto: true, opzioni: ['media', 'costante', 'arima', 'var', 'garch', 'vasicek', 'curva'].map(valore => ({ valore })) },
    previsione_opzioni: { tipo: 'testo', iniziale: '', nascosto: true },
    previsione_scenario: { tipo: 'scelta', iniziale: 'atteso', nascosto: true, opzioni: ['atteso', 'alto80', 'basso80'].map(valore => ({ valore })) },
    // Le scelte del modulo della proiezione (serie, modello, parametri, orizzonte, scenario), così lo stesso file
    // mostra la stessa proiezione in qualunque browser.
    previsione_modulo: { tipo: 'testo', iniziale: '', nascosto: true, lunghezza: 400 },
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
      if (campo.tipo === 'testo') { richiedi(typeof valore === 'string' && valore.trim().length <= (campo.lunghezza || 80), `Testo non valido: ${nome}`); puliti[chiave] = valore.trim(); }
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
    if (completi) {
      const tutti = { ...predefiniti(), ...puliti };
      for (const [chiave, campo] of Object.entries(CAMPI)) if (campo.obbligatorio && (!campo.se || campo.se(tutti))) richiedi(puliti[chiave] != null && puliti[chiave] !== '', `Manca: ${campo.etichetta}`);
      controllaInsieme(tutti);
    }
    return puliti;
  }
  // Controlli che riguardano più parametri insieme.
  function controllaInsieme(p) {
    if (maxirata(p) && p.maxirata > 0 && p.importo_iniziale > 0) richiedi(p.maxirata < p.importo_iniziale, 'La maxirata deve essere più bassa dell\'importo prestato');
  }
  const predefiniti = () => Object.fromEntries(Object.entries(CAMPI).filter(([, c]) => c.iniziale !== undefined).map(([chiave, c]) => [chiave, c.iniziale]));

  // ---------- Lettura e scrittura nel browser ----------
  // L'archivio contiene uno o più prestiti, ognuno con parametri, rate, valori dell'indice e festività, e ricorda
  // quale è aperto: le operazioni di "richiesta" lavorano sul prestito aperto ("dati"). Contiene anche le offerte da
  // confrontare prima di firmare (scheda «Offerte»): ognuna ha solo i parametri, con gli stessi campi di un prestito.
  // Le categorie di prestito che l'utente riconosce, nella prima domanda della guida e delle offerte. Ognuna si calcola
  // come uno dei tipi del motore (tipo_prestito); «mutuo» è per chi non sa se il suo mutuo è fisso o variabile (solo
  // per un prestito già firmato: lo si capisce dalle rate). «anni»: le durate pronte nella domanda sulla durata.
  const CATEGORIE = [
    { valore: 'variabile', tipo: 'variabile', icona: 'grafico', etichetta: 'Mutuo per la casa a tasso variabile', breve: 'Mutuo variabile', nome: 'Il mio mutuo', anni: [10, 15, 20, 25, 30],
      aiuto: 'Il tasso segue un indice, di solito l\'Euribor, più uno spread fisso: la rata cambia nel tempo.' },
    { valore: 'fisso', tipo: 'fisso', icona: 'casa', etichetta: 'Mutuo per la casa a tasso fisso', breve: 'Mutuo fisso', nome: 'Il mio mutuo', anni: [10, 15, 20, 25, 30],
      aiuto: 'Il tasso è scritto nel contratto: la rata resta la stessa fino all\'ultima.' },
    { valore: 'mutuo', tipo: 'mutuo', icona: 'info', etichetta: 'Un mutuo, ma non so se il tasso è fisso o variabile', breve: 'Mutuo', nome: 'Il mio mutuo', anni: [10, 15, 20, 25, 30], soloPrestiti: true,
      aiuto: 'Lo capisco io dalle rate: se cambiano da un mese all\'altro, è variabile.' },
    { valore: 'finanziamento', tipo: 'finanziamento', icona: 'portafoglio', etichetta: 'Prestito personale', breve: 'Prestito personale', nome: 'Prestito personale', anni: [2, 3, 4, 5, 7],
      aiuto: 'Una somma da restituire a rate tutte uguali, a tasso fisso: per spese, lavori, studi, liquidità.' },
    { valore: 'auto', tipo: 'finanziamento', icona: 'auto', etichetta: 'Finanziamento per l\'auto o la moto', breve: 'Finanziamento auto', nome: 'Auto', anni: [2, 3, 4, 5, 7],
      aiuto: 'Rate tutte uguali fino alla fine, di solito con un anticipo.' },
    { valore: 'maxirata', tipo: 'maxirata', icona: 'auto', etichetta: 'Auto con maxirata finale', breve: 'Auto con maxirata', nome: 'Auto', anni: [2, 3, 4, 5, 7],
      aiuto: 'Rate basse e alla fine una rata molto più grande, la «maxirata» (formule chiamate anche PCP o «valore futuro garantito»).' },
    { valore: 'acquisto', tipo: 'finanziamento', icona: 'borsa', etichetta: 'Acquisto a rate in un negozio', breve: 'Acquisto a rate', nome: 'Acquisto a rate', anni: [1, 2, 3, 4, 5],
      aiuto: 'Elettrodomestici, mobili, telefono, cure: anche le offerte «a tasso zero».' },
    { valore: 'quinto', tipo: 'finanziamento', icona: 'documento', etichetta: 'Cessione del quinto', breve: 'Cessione del quinto', nome: 'Cessione del quinto', anni: [3, 5, 7, 10],
      aiuto: 'La rata la trattiene il datore di lavoro o l\'ente della pensione: al massimo un quinto dello stipendio. Tasso fisso.' },
  ];
  // La categoria di un prestito: quella scritta, se va d'accordo con il tipo; altrimenti la prima del suo tipo.
  const categoria = p => CATEGORIE.find(c => c.valore === p.categoria && c.tipo === p.tipo_prestito)
    || CATEGORIE.find(c => c.tipo === (p.tipo_prestito || 'variabile') && !c.soloPrestiti) || CATEGORIE[0];

  let archivio = null, dati = null;
  const nuovoId = () => 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const vuoto = () => ({ id: nuovoId(), parametri: {}, rate: [], euribor: [], festivita: [] });
  const configurato = p => p.parametri.importo_iniziale > 0;
  // Apre un prestito; senza prestiti ne prepara uno vuoto, che la guida riempie (e che non viene salvato finché è vuoto).
  function scegli(id) {
    dati = archivio.prestiti.find(p => p.id === id) || archivio.prestiti[0] || null;
    if (!dati) { dati = vuoto(); archivio.prestiti.push(dati); }
    archivio.attivo = dati.id;
  }
  function carica() {
    if (archivio) return dati;
    archivio = { attivo: null, principale: null, prestiti: [], offerte: [] };
    let testo = null;
    if (NEL_BROWSER) try { testo = localStorage.getItem(CHIAVE); } catch { /* archivio del browser non disponibile: si lavora in memoria */ }
    if (testo) {
      try { archivio = pulisciArchivio(JSON.parse(testo)); }
      catch { /* dati illeggibili: si riparte da zero senza toccare quelli salvati */ }
    }
    scegli(archivio.attivo);
    return dati;
  }
  // L'archivio da salvare o da confrontare: solo i prestiti configurati.
  const daSalvare = () => ({ attivo: archivio.attivo, principale: archivio.principale, prestiti: archivio.prestiti.filter(configurato), offerte: archivio.offerte });
  function salva() {
    if (NEL_BROWSER) {
      try { localStorage.setItem(CHIAVE, JSON.stringify({ versione: 2, ...daSalvare() })); }
      catch { throw new ErroreDati('Il browser non permette di salvare i dati (navigazione privata o spazio esaurito). Usa «Salva un backup» per non perderli.'); }
    }
    // La variante in un unico file tiene i dati solo in memoria: a ogni modifica aggiorna il suo file.
    if (window.Archivio.alCambio) window.Archivio.alCambio();
  }
  // Legge un salvataggio (il backup .json, o il file dei dati della variante in un unico file) e lo rende valido.
  // "salvato" = quando è stato salvato, se il file lo dice.
  function leggiSalvataggio(testo) {
    let grezzo;
    try { grezzo = JSON.parse(String(testo).replace(/^\uFEFF?\s*window\.MutuoDatiSalvati\s*=\s*/, '').replace(/;\s*$/, '')); }
    catch { throw new ErroreDati('Il file non è un salvataggio valido'); }
    const nuovo = pulisciArchivio(grezzo);
    richiedi(nuovo.prestiti.length > 0 || nuovo.offerte.length > 0, 'Il file non contiene la configurazione di un mutuo');
    const salvato = typeof grezzo.salvato === 'string' && !isNaN(Date.parse(grezzo.salvato)) ? grezzo.salvato : null;
    return { archivio: nuovo, salvato };
  }
  // Rende valido un archivio letto dal browser o da un file. I salvataggi fino alla versione 1 avevano un solo mutuo,
  // con i dati in cima: diventano un archivio con un prestito. I prestiti lasciati a metà della guida si scartano.
  function pulisciArchivio(grezzo) {
    richiedi(grezzo && typeof grezzo === 'object', 'Il file non contiene i dati di un mutuo');
    const elenco = Array.isArray(grezzo.prestiti) ? grezzo.prestiti : [grezzo];
    const visti = new Set(), prestiti = [];
    for (const voce of elenco) {
      if (!voce || typeof voce !== 'object') continue;
      const pulito = pulisci(voce);
      if (!configurato(pulito)) continue;
      const id = typeof voce.id === 'string' && /^[a-z0-9]{1,40}$/i.test(voce.id) && !visti.has(voce.id) ? voce.id : nuovoId();
      visti.add(id);
      prestiti.push({ id, ...pulito });
    }
    const attivo = prestiti.some(p => p.id === grezzo.attivo) ? grezzo.attivo : prestiti.length ? prestiti[0].id : null;
    // Il prestito principale si apre da solo. I salvataggi di prima non lo avevano: diventa quello aperto per ultimo.
    // Un null scritto vuol dire che l'utente l'ha tolto.
    const principale = 'principale' in grezzo ? (prestiti.some(p => p.id === grezzo.principale) ? grezzo.principale : null) : attivo;
    const offerte = [];
    for (const voce of Array.isArray(grezzo.offerte) ? grezzo.offerte : []) {
      if (!voce || typeof voce !== 'object' || !voce.parametri || typeof voce.parametri !== 'object') continue;
      const id = typeof voce.id === 'string' && /^[a-z0-9]{1,40}$/i.test(voce.id) && !visti.has(voce.id) ? voce.id : nuovoId();
      visti.add(id);
      offerte.push({ id, parametri: controllaParametri(voce.parametri, false) });
    }
    return { attivo, principale, prestiti, offerte };
  }
  // Rende valido un prestito.
  function pulisci(grezzo) {
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
  const copiaDi = p => JSON.parse(JSON.stringify({ ...p, parametri: { ...predefiniti(), ...p.parametri } }));
  const copia = () => copiaDi(dati);

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
  const esiste = id => archivio.prestiti.some(p => p.id === id && configurato(p));
  const offerta = id => { const o = archivio.offerte.find(x => x.id === id); richiedi(o, 'Offerta non trovata'); return o; };

  async function richiesta(metodo, percorso, corpo) {
    carica();
    const [risorsa, chiave] = percorso.split('/');
    const prima = JSON.stringify(archivio);
    try {
      if (metodo === 'GET' && risorsa === 'dati') return copia();
      if (metodo === 'POST' && risorsa === 'configura') {
        // "nuovo": un prestito in più, accanto a quelli che ci sono già.
        if (corpo.nuovo && configurato(dati)) { const p = vuoto(); archivio.prestiti.push(p); scegli(p.id); }
        const parametri = controllaParametri(corpo.parametri || {}, true);
        dati.parametri = { ...dati.parametri, ...parametri };
        generaFestivita(dati.parametri);
        // Valori dell'indice già disponibili: si aggiungono solo i giorni che mancano, senza toccare quelli inseriti.
        const presenti = new Set(dati.euribor.map(t => t.giorno));
        const nuovi = (corpo.tassi || []).filter(t => t && !presenti.has(t.giorno));
        if (nuovi.length) salvaTassi(nuovi);
        // Rate già pagate inserite nella guida.
        for (const r of corpo.rate || []) salvaRata(r.n, { rata_vera: r.rata_vera, quota_capitale: r.quota_capitale });
        // Il primo prestito diventa il principale.
        if (archivio.prestiti.filter(configurato).length === 1) archivio.principale = dati.id;
      }
      else if (metodo === 'PUT' && risorsa === 'attivo') { richiedi(esiste(chiave), 'Prestito non trovato'); scegli(chiave); }
      // Il prestito principale: PUT con il suo id per sceglierlo, DELETE per toglierlo (all'avvio non se ne apre nessuno).
      else if (metodo === 'PUT' && risorsa === 'principale') { richiedi(esiste(chiave), 'Prestito non trovato'); archivio.principale = chiave; }
      else if (metodo === 'DELETE' && risorsa === 'principale') archivio.principale = null;
      else if (metodo === 'DELETE' && risorsa === 'prestiti') {
        richiedi(esiste(chiave), 'Prestito non trovato');
        archivio.prestiti = archivio.prestiti.filter(p => p.id !== chiave);
        scegli(archivio.attivo === chiave ? null : archivio.attivo);
        // Eliminato il principale, lo diventa il primo che resta.
        if (archivio.principale === chiave) archivio.principale = archivio.prestiti.find(configurato) ? archivio.prestiti.find(configurato).id : null;
      }
      // Offerte: { parametri } per aggiungerne una, i parametri cambiati per modificarla.
      else if (metodo === 'POST' && risorsa === 'offerte') archivio.offerte.push({ id: nuovoId(), parametri: controllaParametri(corpo.parametri || {}, false) });
      else if (metodo === 'PUT' && risorsa === 'offerte') { const o = offerta(chiave); o.parametri = { ...o.parametri, ...controllaParametri(corpo, false) }; }
      else if (metodo === 'DELETE' && risorsa === 'offerte') { offerta(chiave); archivio.offerte = archivio.offerte.filter(o => o.id !== chiave); }
      else if (metodo === 'PUT' && risorsa === 'parametri') { dati.parametri = { ...dati.parametri, ...controllaParametri(corpo, false) }; controllaInsieme({ ...predefiniti(), ...dati.parametri }); }
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
      archivio = JSON.parse(prima);   // o si salva tutto o niente
      scegli(archivio.attivo);
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

  // Breve descrizione di un archivio, per riconoscerlo: nomi dei prestiti, rate pagate inserite, numero di offerte.
  function descrivi(a) {
    const rate = a.prestiti.reduce((n, p) => n + p.rate.filter(r => r.rata_vera != null || r.rata_copiata != null).length, 0);
    return { nomi: a.prestiti.map(p => p.parametri.nome || 'Prestito senza nome'), rate, offerte: a.offerte.length };
  }

  window.Archivio = {
    CAMPI, CATEGORIE, categoria, richiesta, predefiniti, precaricati,
    // Il prestito aperto è configurato (se non lo è, non ce n'è nessuno: parte la guida).
    configurato: () => configurato(carica()),
    attivo: () => (carica(), archivio.attivo),
    // Il prestito che si apre da solo all'avvio (null: nessuno).
    principale: () => (carica(), esiste(archivio.principale) ? archivio.principale : null),
    // Tutti i prestiti, come li dà "GET dati" (parametri completi), nell'ordine in cui sono stati creati.
    elenco: () => (carica(), archivio.prestiti.filter(configurato).map(copiaDi)),
    // Le offerte da confrontare, con i parametri completi.
    offerte: () => (carica(), archivio.offerte.map(o => JSON.parse(JSON.stringify({ id: o.id, parametri: { ...predefiniti(), ...o.parametri } })))),
    // Testo del backup da scaricare come file.
    esporta: () => (carica(), JSON.stringify({ programma: 'mutuo-variabile', versione: 2, salvato: new Date().toISOString(), ...daSalvare() }, null, 1)),
    // Lo stesso salvataggio nella forma del file dei dati della versione in un unico file.
    esportaFile() { return PREFISSO_FILE + this.esporta() + ';\n'; },
    // Sostituisce tutti i dati con quelli di un salvataggio (va bene sia il .json sia il file dei dati, di ogni versione).
    importa(testo) {
      archivio = leggiSalvataggio(testo).archivio;
      scegli(archivio.attivo);
      salva();
      return copia();
    },
    // Descrizione di un salvataggio, con la data in cui è stato salvato (null se non è leggibile), o, senza testo,
    // dei dati di adesso.
    descrivi(testo) {
      if (testo === undefined) return (carica(), descrivi(daSalvare()));
      try { const { archivio: a, salvato } = leggiSalvataggio(testo); return { ...descrivi(a), salvato }; } catch { return null; }
    },
    azzera() {
      archivio = { attivo: null, principale: null, prestiti: [], offerte: [] };
      scegli(null);
      if (NEL_BROWSER) try { localStorage.removeItem(CHIAVE); } catch { /* niente da cancellare */ }
    },
  };
})();
