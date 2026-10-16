// File collegato: oltre che nel browser, i dati del mutuo vengono scritti da soli in un file scelto dall'utente sul suo
// computer. Così non si perdono cancellando i dati di navigazione, e il file si può copiare, mettere in un backup o
// riaprire su un altro computer. Si può solo in Edge e Chrome (showSaveFilePicker): negli altri browser la pagina resta
// com'era, con i dati nel browser e «Salva su file».
// Il browser si ricorda il file (la "maniglia" sta in IndexedDB), ma di solito a ogni apertura chiede di nuovo il
// permesso di scriverci, e può chiederlo solo dopo un clic: lo si chiede alla prima modifica, oppure con «Riprendi il file».
(function () {
  'use strict';
  if (typeof window.showSaveFilePicker !== 'function' || !window.indexedDB || window.MUTUO_UN_FILE) return;
  const M = window.Mutuo, { $, crea, avvisa } = M;
  const TIPO_JSON = { description: 'Dati del mutuo', accept: { 'application/json': ['.json'] } };
  const TIPO_APRI = { description: 'Salvataggi del mutuo', accept: { 'application/json': ['.json'], 'text/plain': ['.txt'], 'text/javascript': ['.js'] } };
  // stato: 'nessuno' = i dati stanno solo nel browser; 'fermo' = c'è un file, ma manca il permesso di scriverci;
  // 'attivo' = ogni modifica viene scritta nel file. "diverso" = file e browser hanno dati diversi: si chiede quali tenere.
  // "tengo" = il prossimo caricamento di un salvataggio lo gestisce questo script, senza scollegare il file.
  // "riferimento" = i dati che il file dovrebbe contenere: quelli scritti l'ultima volta, oppure quelli del browser
  // all'apertura della pagina. Se il file è ancora così, le differenze sono solo modifiche fatte da allora.
  // "chiesto" = il permesso è già stato chiesto da solo una volta, a una modifica: non lo si richiede a ogni modifica.
  const file = { maniglia: null, stato: 'nessuno', salvatoAlle: null, inScrittura: false, ancora: false, importando: false, tengo: false, diverso: null,
    riferimento: Archivio.configurato() ? Archivio.esporta() : null, chiesto: false };
  const ora = d => d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  const quando = iso => new Date(iso).toLocaleString('it-IT', { dateStyle: 'long', timeStyle: 'short' });
  const pulsante = (testo, azione, classe = '') => { const b = crea('button', { type: 'button', className: classe }, testo); b.addEventListener('click', azione); return b; };

  // ---------- Il file ricordato dal browser (IndexedDB) ----------
  function memoria(modo, operazione) {
    return new Promise((risolvi, rifiuta) => {
      const apertura = indexedDB.open('mutuo-variabile', 1);
      apertura.onupgradeneeded = () => apertura.result.createObjectStore('file');
      apertura.onerror = () => rifiuta(apertura.error);
      apertura.onsuccess = () => {
        const db = apertura.result, t = db.transaction('file', modo), richiesta = operazione(t.objectStore('file'));
        t.oncomplete = () => { db.close(); risolvi(richiesta.result); };
        t.onerror = t.onabort = () => { db.close(); rifiuta(t.error); };
      };
    });
  }
  const ricordato = () => memoria('readonly', negozio => negozio.get('collegato'));
  const ricorda = maniglia => memoria('readwrite', negozio => negozio.put(maniglia, 'collegato'));
  const dimentica = () => memoria('readwrite', negozio => negozio.delete('collegato')).catch(() => { /* niente da dimenticare */ });

  // ---------- Scrittura ----------
  async function scrivi() {
    if (file.inScrittura) { file.ancora = true; return; }
    file.inScrittura = true;
    try {
      do {
        file.ancora = false;
        const testo = Archivio.esporta();
        const flusso = await file.maniglia.createWritable();
        await flusso.write(testo);
        await flusso.close();
        file.riferimento = testo;
      } while (file.ancora);   // modifiche arrivate mentre si scriveva
      file.salvatoAlle = new Date();
    } finally {
      file.inScrittura = false;
      disegna();
    }
  }
  // A ogni modifica dei dati (archivio.js), se il file è collegato ci si scrive. Se manca il permesso e la modifica
  // viene da un clic o da un tasto, è il momento di chiederlo: il browser lo permette solo subito dopo un gesto.
  Archivio.alCambio = () => {
    if (file.importando) return;
    if (file.stato === 'fermo') {
      const gesto = navigator.userActivation ? navigator.userActivation.isActive : false;
      if (gesto && !file.chiesto && !file.diverso) { file.chiesto = true; riprendi(true, true); }
      return disegna();
    }
    if (file.stato !== 'attivo') return;
    scrivi().catch(errore => {
      file.stato = 'fermo';
      disegna();
      avvisa(`Non riesco a scrivere nel file «${file.maniglia.name}» (${errore.message}). Le modifiche restano in questo browser: premi «Riprendi il file» per riprovare.`, true);
    });
  };
  // Un salvataggio caricato da fuori sostituisce i dati: non va scritto nel file collegato, che altrimenti verrebbe
  // sovrascritto con un altro mutuo. Se il caricamento non passa da qui, il file di prima si scollega.
  const importaBase = Archivio.importa.bind(Archivio), azzeraBase = Archivio.azzera.bind(Archivio);
  Archivio.importa = testo => {
    const tengo = file.tengo;
    file.importando = true;
    try {
      const esito = importaBase(testo);
      if (!tengo) scollega();
      return esito;
    } finally {
      file.importando = false;
    }
  };
  // «Cancella tutto» cancella i dati del browser, non il file: lo si scollega soltanto.
  Archivio.azzera = () => { azzeraBase(); scollega(); };

  function scollega() {
    if (file.stato !== 'nessuno') dimentica();
    Object.assign(file, { maniglia: null, stato: 'nessuno', salvatoAlle: null, diverso: null, riferimento: null });
    disegna();
  }
  function attiva(messaggio) {
    Object.assign(file, { stato: 'attivo', diverso: null });
    disegna();
    if (messaggio) avvisa(messaggio);
  }

  // ---------- Collegare un file nuovo ----------
  async function collega() {
    let maniglia;
    // Con più prestiti il file li contiene tutti: il nome non è quello di uno solo.
    const nome = Archivio.elenco().length > 1 ? 'i-miei-prestiti'
      : ((M.stato.dati && M.stato.dati.parametri.nome) || 'mutuo').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'mutuo';
    try {
      maniglia = await window.showSaveFilePicker({ suggestedName: nome + '.json', types: [TIPO_JSON] });
    } catch (errore) {
      if (errore.name !== 'AbortError') avvisa('Non riesco ad aprire la finestra per scegliere il file: ' + errore.message, true);
      return;   // AbortError = finestra chiusa senza scegliere
    }
    const prima = { ...file };
    Object.assign(file, { maniglia, stato: 'attivo', diverso: null });
    try {
      await scrivi();
    } catch (errore) {
      Object.assign(file, { maniglia: prima.maniglia, stato: prima.stato });
      disegna();
      return avvisa('Non riesco a scrivere nel file: ' + errore.message, true);
    }
    const ricordo = await ricorda(maniglia).then(() => true, () => false);
    avvisa(`Fatto: ogni modifica viene salvata da sola nel file «${maniglia.name}».`
      + (ricordo ? '' : ' Il browser però non riesce a ricordarselo: alla prossima apertura riaprilo con «Carica da file».'));
  }

  // ---------- Riprendere il file ricordato ----------
  // "conClic": il permesso si può chiedere solo dopo un gesto; all'apertura si guarda soltanto se c'è già.
  // "allaModifica": la richiesta parte da sola a una modifica, non da «Riprendi il file».
  async function riprendi(conClic, allaModifica = false) {
    const maniglia = file.maniglia;
    if (!maniglia) return;
    let permesso;
    try {
      permesso = await (conClic ? maniglia.requestPermission({ mode: 'readwrite' }) : maniglia.queryPermission({ mode: 'readwrite' }));
    } catch (errore) {
      permesso = errore.name;
    }
    if (permesso !== 'granted') {
      if (conClic) avvisa(allaModifica ? 'Senza il permesso questa modifica resta solo nel browser. Quando vuoi, premi «Riprendi il file».'
        : 'Senza il permesso non posso scrivere nel file: per ora le modifiche restano solo in questo browser.', true);
      return;
    }
    let testo;
    try {
      testo = await (await maniglia.getFile()).text();
    } catch (errore) {
      if (errore.name !== 'NotFoundError') return avvisa(`Non riesco a leggere il file «${maniglia.name}»: ${errore.message}`, true);
      scollega();
      return avvisa(`Non trovo più il file «${maniglia.name}»: forse è stato spostato, rinominato o cancellato. Se l'hai spostato, riaprilo con «Carica da file»; altrimenti collega un file nuovo dal Pannello di controllo.`, true);
    }
    if (Archivio.uguale(testo)) return attiva(conClic ? `File ripreso: ogni modifica viene salvata da sola in «${maniglia.name}».` : null);
    // Il file è come lo si conosceva: le differenze sono solo le modifiche fatte da allora, e vanno nel file.
    if (file.riferimento && Archivio.uguale(testo, file.riferimento)) return tieniBrowser(`Salvato in «${maniglia.name}»: da adesso ogni modifica viene salvata da sola lì.`);
    // Browser vuoto (ad esempio dopo aver cancellato i dati di navigazione): si prendono i dati del file.
    if (!Archivio.configurato()) {
      if (await carica(testo)) return attiva(`Dati presi dal file «${maniglia.name}»: ogni modifica viene salvata da sola lì.`);
      scollega();
      return avvisa(`Il file «${maniglia.name}» non contiene i dati di un mutuo: l'ho scollegato.`, true);
    }
    file.diverso = { testo, delFile: descriviFile(testo), delBrowser: await descriviBrowser() };
    disegna();
    window.scrollTo(0, 0);
  }
  async function carica(testo) {
    file.tengo = true;
    try {
      const fatto = await M.caricaSalvataggio(testo, false);
      if (fatto) file.riferimento = Archivio.esporta();
      return fatto;
    } finally {
      file.tengo = false;
    }
  }
  const testoRate = n => n === 1 ? '1 rata pagata inserita' : `${n} rate pagate inserite`;
  // Nomi dei prestiti e rate inserite (in tutti i prestiti), per riconoscere i due insiemi di dati.
  function descriviFile(testo) {
    const d = Archivio.descrivi(testo);
    if (!d) return null;
    let quando = null;
    try { const s = JSON.parse(testo).salvato; if (typeof s === 'string' && !isNaN(Date.parse(s))) quando = s; } catch { /* nessuna data */ }
    return { nome: d.nomi.join(', '), quando, rate: d.rate };
  }
  async function descriviBrowser() {
    const d = Archivio.descrivi();
    return { nome: d.nomi.join(', ') || 'Nessun prestito', quando: Archivio.modificato(), rate: d.rate };
  }
  async function usaFile() {
    const { testo } = file.diverso;
    if (await carica(testo)) attiva(`Dati presi dal file «${file.maniglia.name}»: ogni modifica viene salvata da sola lì.`);
  }
  async function tieniBrowser(messaggio) {
    attiva();
    try {
      await scrivi();
      avvisa(typeof messaggio === 'string' ? messaggio : `File «${file.maniglia.name}» aggiornato con i dati di questo browser: ogni modifica viene salvata da sola lì.`);
    } catch (errore) {
      file.stato = 'fermo';
      disegna();
      avvisa('Non riesco a scrivere nel file: ' + errore.message, true);
    }
  }

  // ---------- «Carica da file»: il file scelto diventa quello collegato ----------
  async function apriFile(conferma) {
    let maniglia, testo;
    try {
      [maniglia] = await window.showOpenFilePicker({ types: [TIPO_APRI] });
      testo = await (await maniglia.getFile()).text();
    } catch (errore) {
      if (errore.name !== 'AbortError') avvisa('Non riesco ad aprire il file: ' + errore.message, true);
      return;
    }
    // Solo un salvataggio .json si continua ad aggiornare; gli altri formati si leggono soltanto.
    const collegabile = /\.json$/i.test(maniglia.name);
    file.tengo = collegabile;
    let caricato;
    try { caricato = await M.caricaSalvataggio(testo, conferma); } finally { file.tengo = false; }
    if (!caricato || !collegabile) return;
    Object.assign(file, { maniglia, stato: 'fermo', salvatoAlle: null, diverso: null, riferimento: Archivio.esporta(), chiesto: false });
    ricorda(maniglia).catch(() => { /* vale solo finché la pagina resta aperta */ });
    let permesso = 'prompt';
    try { permesso = await maniglia.requestPermission({ mode: 'readwrite' }); } catch { /* serve un clic: lo si chiede alla prima modifica o con «Riprendi il file» */ }
    if (permesso === 'granted') attiva(`Dati caricati da «${maniglia.name}»: d'ora in poi ogni modifica viene salvata da sola in questo file.`);
    else { disegna(); avvisa(`Dati caricati da «${maniglia.name}». Per salvare le modifiche in questo file premi «Riprendi il file».`); }
  }
  for (const [id, conferma] of [['#carica-file', true], ['#guida-carica', false]]) {
    $(id).addEventListener('click', evento => {
      if (evento.target.tagName === 'INPUT') return;
      evento.preventDefault();   // al posto della scelta del file normale, che non permette di riscrivere il file
      apriFile(conferma);
    });
  }

  // ---------- Indicatore in testata, avviso in alto e carta «I tuoi dati» nel pannello ----------
  // L'indicatore dice sempre dove finiscono le modifiche: nel file (con l'ora dell'ultimo salvataggio) o solo nel browser.
  const ICONA_FILE = '<path d="M7 3.5h6.5l4.5 4.5v12a.5.5 0 0 1-.5.5h-10.5a.5.5 0 0 1-.5-.5V4a.5.5 0 0 1 .5-.5z"/><path d="M13.5 3.5V8H18"/>';
  const SEGNI = { attivo: '<path d="M9.3 14.2l1.9 1.9 3.6-4"/>', fermo: '<path d="M12 11v3.2M12 17.1v.1"/>', nessuno: '<path d="M9.5 14.5h5"/>' };
  const indicatore = crea('button', { type: 'button', className: 'secondario pulsante-icona', id: 'stato-salvataggio', hidden: true });
  indicatore.innerHTML = '<svg class="icona" viewBox="0 0 24 24" aria-hidden="true"></svg><span class="testo-pulsante"></span><span class="dettaglio-salvataggio"></span>';
  $('#scegli-tema').before(indicatore);
  indicatore.addEventListener('click', () => {
    if (file.stato === 'fermo') return riprendi(true);
    M.mostraScheda('pannello');
    $('#salva-file').closest('.carta').scrollIntoView({ block: 'center' });
  });

  const barra = crea('div', { className: 'barra-file', id: 'barra-file', hidden: true });
  $('#riepilogo').before(barra);
  const notaDati = $('#salva-file').closest('.carta').querySelector('.nota');
  const pulsanteCollega = pulsante('', () => file.stato === 'nessuno' ? collega() : riprendi(true));
  pulsanteCollega.id = 'collega-file';
  const pulsanteScollega = pulsante('Scollega il file', () => {
    const nome = file.maniglia && file.maniglia.name;
    scollega();
    avvisa(`File «${nome}» scollegato (non è stato cancellato): da adesso le modifiche restano solo in questo browser.`);
  }, 'secondario');
  pulsanteScollega.id = 'scollega-file';
  $('#salva-file').before(pulsanteCollega);
  $('#salva-file').after(pulsanteScollega);
  $('#salva-file').textContent = 'Salva una copia';
  $('#salva-file').classList.add('secondario');

  function disegnaIndicatore() {
    const nome = file.maniglia ? `«${file.maniglia.name}»` : '';
    indicatore.hidden = !Archivio.configurato();
    indicatore.classList.toggle('da-riprendere', file.stato === 'fermo');
    indicatore.querySelector('svg').innerHTML = ICONA_FILE + SEGNI[file.stato];
    indicatore.querySelector('.testo-pulsante').textContent = { attivo: 'Salvato nel file', fermo: 'Riprendi il file', nessuno: 'Solo nel browser' }[file.stato];
    indicatore.querySelector('.dettaglio-salvataggio').textContent = file.stato === 'attivo' && file.salvatoAlle ? ora(file.salvatoAlle) : '';
    indicatore.title = file.stato === 'attivo' ? `Ogni modifica viene salvata da sola nel file ${nome}` + (file.salvatoAlle ? ` (l'ultima alle ${ora(file.salvatoAlle)})` : '')
      : file.stato === 'fermo' ? `Le modifiche restano solo nel browser finché non riprendi il file ${nome}: premi qui`
        : 'I dati stanno solo in questo browser: premi qui per collegare un file sul tuo computer';
  }
  function disegna() {
    const nome = file.maniglia ? `«${file.maniglia.name}»` : '';
    disegnaIndicatore();
    // Pannello
    pulsanteCollega.hidden = file.stato === 'attivo';
    pulsanteCollega.textContent = file.stato === 'nessuno' ? 'Collega un file' : 'Riprendi il file';
    pulsanteScollega.hidden = file.stato === 'nessuno';
    notaDati.classList.toggle('evidenza', file.stato === 'fermo');
    notaDati.textContent = file.stato === 'attivo'
      ? `Ogni modifica viene salvata da sola nel file ${nome} sul tuo computer${file.salvatoAlle ? ` (l'ultima alle ${ora(file.salvatoAlle)})` : ''}: non serve salvare a mano. `
        + 'Tienilo al sicuro: con «Carica da file» lo riapri anche su un altro computer o in un altro browser.'
      : file.stato === 'fermo'
        ? `I dati si salvano nel file ${nome}, ma il browser aspetta il permesso di scriverci, che chiede a ogni apertura della pagina: finché non lo dai, le modifiche restano solo in questo browser.`
        : 'Per ora i dati stanno solo in questo browser: se cancelli i dati di navigazione si perdono. Collega un file sul tuo computer '
          + '(ad esempio nella cartella Documenti, o in una cartella di OneDrive o Google Drive): ogni modifica verrà scritta lì da sola, senza salvare a mano. '
          + 'Se il file ce l\'hai già, aprilo con «Carica da file».';
    // Avviso in alto
    barra.hidden = !(file.stato === 'fermo' || file.diverso);
    if (barra.hidden) return barra.replaceChildren();
    if (!file.diverso) {
      return barra.replaceChildren(crea('div', { className: 'carta carta-file' },
        crea('p', { className: 'nota' }, crea('strong', {}, `I dati di questo mutuo si salvano da soli nel file ${nome}, ma il browser vuole di nuovo il permesso. `),
          'Lo chiede a ogni apertura della pagina: premi «Riprendi il file», oppure fai una modifica e te lo chiedo in quel momento. '
          + 'Se il browser propone «Consenti a ogni visita», sceglila: così dalla prossima volta non serve più.'),
        crea('div', { className: 'azioni' }, pulsante('Riprendi il file', () => riprendi(true)))));
    }
    const { delFile, delBrowser } = file.diverso;
    const piuRecente = delFile && delFile.quando && delBrowser.quando ? (delFile.quando > delBrowser.quando ? 'file' : 'browser') : null;
    const riquadro = (titolo, d, chi) => crea('div', { className: 'file-trovato' },
      crea('strong', {}, titolo + (piuRecente === chi ? ' (più recente)' : '')),
      ...(d ? [crea('span', {}, d.nome), ...(d.quando ? [crea('span', {}, (chi === 'file' ? 'salvato il ' : 'modificato il ') + quando(d.quando))] : []), crea('span', {}, testoRate(d.rate))]
        : [crea('span', {}, 'Il file è vuoto o non contiene i dati di un mutuo.')]));
    barra.replaceChildren(crea('div', { className: 'carta carta-file' },
      crea('p', { className: 'nota' }, crea('strong', {}, `Il file ${nome} e questo browser hanno dati diversi. `),
        'Succede se hai usato il file su un altro computer, o se l\'ultima volta hai fatto modifiche senza riprendere il file. Quali dati vuoi tenere? Gli altri vengono sostituiti.'),
      crea('div', { className: 'confronto' }, riquadro('Nel file', delFile, 'file'), riquadro('In questo browser', delBrowser, 'browser')),
      crea('div', { className: 'azioni' },
        ...(delFile ? [pulsante('Usa i dati del file', usaFile)] : []),
        pulsante('Tieni quelli del browser', tieniBrowser, delFile ? 'secondario' : ''),
        pulsante('Decido dopo', () => { file.diverso = null; disegna(); }, 'secondario'))));
  }
  disegna();
  // La guida e il programma si alternano (M.avvia): l'indicatore si vede solo con un mutuo configurato.
  const avviaBase = M.avvia;
  M.avvia = async (...argomenti) => { const esito = await avviaBase(...argomenti); disegnaIndicatore(); return esito; };

  // All'apertura: se il browser ricorda un file, lo si riprende da soli quando il permesso c'è già («consenti a ogni visita»).
  window.addEventListener('DOMContentLoaded', async () => {
    let maniglia;
    try { maniglia = await ricordato(); } catch { return; }
    if (!maniglia || file.maniglia) return;
    Object.assign(file, { maniglia, stato: 'fermo' });
    disegna();
    riprendi(false);
  });
  window.addEventListener('beforeunload', evento => {
    if (file.inScrittura) { evento.preventDefault(); evento.returnValue = ''; }
  });
})();
