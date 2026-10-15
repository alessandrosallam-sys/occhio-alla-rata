// File collegato: oltre che nel browser, i dati del mutuo vengono scritti da soli in un file scelto dall'utente sul suo
// computer. Così non si perdono cancellando i dati di navigazione, e il file si può copiare, mettere in un backup o
// riaprire su un altro computer. Si può solo in Edge e Chrome (showSaveFilePicker): negli altri browser la pagina resta
// com'era, con i dati nel browser e «Salva su file».
// Il browser si ricorda il file (la "maniglia" sta in IndexedDB), ma di solito a ogni apertura chiede di nuovo il
// permesso di scriverci, e può chiederlo solo dopo un clic: per questo c'è il pulsante «Riprendi il file».
(function () {
  'use strict';
  if (typeof window.showSaveFilePicker !== 'function' || !window.indexedDB || window.MUTUO_UN_FILE) return;
  const M = window.Mutuo, { $, crea, avvisa } = M;
  const TIPO_JSON = { description: 'Dati del mutuo', accept: { 'application/json': ['.json'] } };
  const TIPO_APRI = { description: 'Salvataggi del mutuo', accept: { 'application/json': ['.json'], 'text/plain': ['.txt'], 'text/javascript': ['.js'] } };
  // stato: 'nessuno' = i dati stanno solo nel browser; 'fermo' = c'è un file, ma manca il permesso di scriverci;
  // 'attivo' = ogni modifica viene scritta nel file. "diverso" = file e browser hanno dati diversi: si chiede quali tenere.
  // "tengo" = il prossimo caricamento di un salvataggio lo gestisce questo script, senza scollegare il file.
  const file = { maniglia: null, stato: 'nessuno', salvatoAlle: null, inScrittura: false, ancora: false, importando: false, tengo: false, diverso: null };
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
        const flusso = await file.maniglia.createWritable();
        await flusso.write(Archivio.esporta());
        await flusso.close();
      } while (file.ancora);   // modifiche arrivate mentre si scriveva
      file.salvatoAlle = new Date();
    } finally {
      file.inScrittura = false;
      disegna();
    }
  }
  // A ogni modifica dei dati (archivio.js), se il file è collegato ci si scrive.
  Archivio.alCambio = () => {
    if (file.stato !== 'attivo' || file.importando) return;
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
    Object.assign(file, { maniglia: null, stato: 'nessuno', salvatoAlle: null, diverso: null });
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
    const nome = ((M.stato.dati && M.stato.dati.parametri.nome) || 'mutuo').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'mutuo';
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
  // "conClic": il permesso si può chiedere solo dopo un clic; all'apertura si guarda soltanto se c'è già.
  async function riprendi(conClic) {
    const maniglia = file.maniglia;
    if (!maniglia) return;
    let permesso;
    try {
      permesso = await (conClic ? maniglia.requestPermission({ mode: 'readwrite' }) : maniglia.queryPermission({ mode: 'readwrite' }));
    } catch (errore) {
      permesso = errore.name;
    }
    if (permesso !== 'granted') {
      if (conClic) avvisa('Senza il permesso non posso scrivere nel file: per ora le modifiche restano solo in questo browser.', true);
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
    try { return await M.caricaSalvataggio(testo, false); } finally { file.tengo = false; }
  }
  const contaRate = d => (Array.isArray(d.rate) ? d.rate : []).filter(r => r && (r.rata_vera != null || r.rata_copiata != null)).length;
  const testoRate = n => n === 1 ? '1 rata pagata inserita' : `${n} rate pagate inserite`;
  function descriviFile(testo) {
    let d;
    try { d = JSON.parse(testo); } catch { return null; }
    if (!d || typeof d !== 'object' || !d.parametri || !(d.parametri.importo_iniziale > 0)) return null;
    return { nome: d.parametri.nome || 'Mutuo senza nome', quando: typeof d.salvato === 'string' && !isNaN(Date.parse(d.salvato)) ? d.salvato : null, rate: contaRate(d) };
  }
  async function descriviBrowser() {
    const d = await Archivio.richiesta('GET', 'dati');
    return { nome: d.parametri.nome || 'Mutuo senza nome', quando: Archivio.modificato(), rate: contaRate(d) };
  }
  async function usaFile() {
    const { testo } = file.diverso;
    if (await carica(testo)) attiva(`Dati presi dal file «${file.maniglia.name}»: ogni modifica viene salvata da sola lì.`);
  }
  async function tieniBrowser() {
    attiva();
    try {
      await scrivi();
      avvisa(`File «${file.maniglia.name}» aggiornato con i dati di questo browser: ogni modifica viene salvata da sola lì.`);
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
    Object.assign(file, { maniglia, stato: 'fermo', salvatoAlle: null, diverso: null });
    ricorda(maniglia).catch(() => { /* vale solo finché la pagina resta aperta */ });
    let permesso = 'prompt';
    try { permesso = await maniglia.requestPermission({ mode: 'readwrite' }); } catch { /* serve un clic: lo si chiede con «Riprendi il file» */ }
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

  // ---------- Avviso in alto e carta «I tuoi dati» nel pannello ----------
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

  function disegna() {
    const nome = file.maniglia ? `«${file.maniglia.name}»` : '';
    // Pannello
    pulsanteCollega.hidden = file.stato === 'attivo';
    pulsanteCollega.textContent = file.stato === 'nessuno' ? 'Collega un file' : 'Riprendi il file';
    pulsanteScollega.hidden = file.stato === 'nessuno';
    notaDati.classList.toggle('evidenza', file.stato === 'fermo');
    notaDati.textContent = file.stato === 'attivo'
      ? `Ogni modifica viene salvata da sola nel file ${nome} sul tuo computer${file.salvatoAlle ? ` (l'ultima alle ${ora(file.salvatoAlle)})` : ''}. `
        + 'Tienilo al sicuro: con «Carica da file» lo riapri anche su un altro computer o in un altro browser.'
      : file.stato === 'fermo'
        ? `I dati si salvano nel file ${nome}, ma il browser aspetta il permesso di scriverci, che chiede a ogni apertura della pagina: finché non lo dai, le modifiche restano solo in questo browser.`
        : 'Per ora i dati stanno solo in questo browser: se cancelli i dati di navigazione si perdono. Collega un file sul tuo computer '
          + '(ad esempio nella cartella Documenti, o in una cartella di OneDrive o Google Drive): ogni modifica verrà scritta lì da sola. '
          + 'Se il file ce l\'hai già, aprilo con «Carica da file».';
    // Avviso in alto
    barra.hidden = !(file.stato === 'fermo' || file.diverso);
    if (barra.hidden) return barra.replaceChildren();
    if (!file.diverso) {
      return barra.replaceChildren(crea('div', { className: 'carta carta-file' },
        crea('p', { className: 'nota' }, crea('strong', {}, `I dati di questo mutuo si salvano nel file ${nome}. `),
          'Per sicurezza il browser chiede il permesso di scriverci a ogni apertura della pagina: finché non lo dai, le modifiche restano solo nel browser.'),
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
        'Succede se hai usato il file su un altro computer, o se hai fatto modifiche senza riprendere il file. Quali dati vuoi tenere? Gli altri vengono sostituiti.'),
      crea('div', { className: 'confronto' }, riquadro('Nel file', delFile, 'file'), riquadro('In questo browser', delBrowser, 'browser')),
      crea('div', { className: 'azioni' },
        ...(delFile ? [pulsante('Usa i dati del file', usaFile)] : []),
        pulsante('Tieni quelli del browser', tieniBrowser, delFile ? 'secondario' : ''),
        pulsante('Decido dopo', () => { file.diverso = null; disegna(); }, 'secondario'))));
  }
  disegna();

  // All'apertura: se il browser ricorda un file, lo si riprende da soli quando il permesso c'è già («consenti sempre»).
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
