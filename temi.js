// Impostazioni della pagina: la versione (semplice o avanzata), l'assistente e il tema dei colori.
// Tutti i colori, i caratteri, i raggi e gli spessori stanno in stile.css come variabili, un blocco per tema
// ([data-tema="…"]); le parti per esperti hanno la classe «solo-avanzata» e si nascondono con [data-versione="semplice"].
// Questo file:
//  - sceglie tema e versione e li mette su <html> prima che la pagina si disegni (si carica nel <head>, così niente lampi);
//  - li ricorda nel browser (chiavi «tema» e «versione»), con le due scelte dell'assistente («assistente-spiega»,
//    «assistente-segue»: «no» se spente);
//  - costruisce le impostazioni: il pulsante «Impostazioni» nella testata apre un riquadro con versione, assistente
//    e temi, e le stesse scelte stanno nel pannello di controllo. Ogni anteprima dei temi porta il suo data-tema, quindi
//    mostra i colori veri. Cambiando versione o assistente la pagina riceve un evento («cambio-versione»,
//    «cambio-assistente») e si ridisegna.
(function () {
  'use strict';
  const CHIAVE = 'tema', CHIAVE_VERSIONE = 'versione';
  const TEMI = [
    { codice: 'auto', nome: 'Automatico', descrizione: 'Chiaro di giorno, scuro se il computer o il telefono è impostato sullo scuro.' },
    { codice: 'chiaro', nome: 'Chiaro', descrizione: 'Bianco e blu, pulito. Il più leggibile alla luce del giorno.' },
    { codice: 'notte', nome: 'Notte', descrizione: 'Blu profondo e viola. Riposa gli occhi la sera.' },
    { codice: 'carta', nome: 'Carta', descrizione: 'Avorio e inchiostro, titoli con le grazie, come un documento stampato.' },
    { codice: 'salvia', nome: 'Salvia', descrizione: 'Verdi tenui e angoli morbidi. Calmo e riposante.' },
    { codice: 'aurora', nome: 'Aurora', descrizione: 'Viola, rosa e arancio su uno sfondo sfumato. Vivace.' },
    { codice: 'ardesia', nome: 'Ardesia', descrizione: 'Grafite e ambra, cifre da cruscotto. Scuro e caldo.' },
    { codice: 'contrasto', nome: 'Contrasto alto', descrizione: 'Nero su bianco, bordi marcati, testo più grande. Per chi vede poco.' },
  ];
  const VERSIONI = [
    { codice: 'semplice', nome: 'Semplice', descrizione: 'Solo quello che serve: le rate e se tornano, quanto costa il prestito, il rimborso anticipato, il backup. Consigliata.' },
    { codice: 'avanzata', nome: 'Avanzata', descrizione: 'Tutto: colonne di approfondimento del piano, calendario delle rilevazioni, festività, previsioni dell\'indice, taratura e regole del contratto.' },
  ];
  const OPZIONI = [
    { codice: 'spiega', nome: 'Spiega le cose quando ti fermi sopra con il mouse' },
    { codice: 'segue', nome: 'Ti segue in un angolo quando scorri la pagina' },
  ];
  const radice = document.documentElement;
  const valido = codice => TEMI.some(t => t.codice === codice);
  const leggi = (chiave = CHIAVE) => { if (window.MUTUO_UN_FILE) return null; try { return localStorage.getItem(chiave); } catch { return null; } };
  const scrivi = (valore, chiave = CHIAVE) => { if (window.MUTUO_UN_FILE) return; try { localStorage.setItem(chiave, valore); } catch { /* vale solo per questa volta */ } };
  let corrente = valido(leggi()) ? leggi() : 'auto';
  let versione = leggi(CHIAVE_VERSIONE) === 'avanzata' ? 'avanzata' : 'semplice';
  const opzione = codice => leggi('assistente-' + codice) !== 'no';

  // Colore della barra del browser sui telefoni: quello della testata del tema.
  function aggiornaBarraBrowser() {
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) { meta = document.createElement('meta'); meta.name = 'theme-color'; document.head.append(meta); }
    const colore = getComputedStyle(radice).getPropertyValue('--testata-solida').trim();
    if (colore) meta.content = colore;
  }
  function applica(codice, ricorda) {
    corrente = valido(codice) ? codice : 'auto';
    radice.setAttribute('data-tema', corrente);
    if (ricorda) scrivi(corrente);
    aggiornaBarraBrowser();
    for (const pulsante of document.querySelectorAll('[data-scelta-tema]')) pulsante.setAttribute('aria-pressed', String(pulsante.dataset.sceltaTema === corrente));
    // Il grafico dei tassi legge alcuni colori al momento del disegno: lo si ridisegna.
    if (ricorda && window.Mutuo && window.Mutuo.ridisegnaTassi && document.querySelector('#scheda-tassi:not([hidden])')) window.Mutuo.ridisegnaTassi();
  }
  function applicaVersione(codice, ricorda) {
    versione = codice === 'avanzata' ? 'avanzata' : 'semplice';
    radice.setAttribute('data-versione', versione);
    for (const pulsante of document.querySelectorAll('[data-scelta-versione]')) pulsante.setAttribute('aria-pressed', String(pulsante.dataset.sceltaVersione === versione));
    const etichetta = document.querySelector('#scegli-tema .impostazione-attuale');
    if (etichetta) etichetta.textContent = VERSIONI.find(v => v.codice === versione).nome;
    if (ricorda) { scrivi(versione, CHIAVE_VERSIONE); document.dispatchEvent(new CustomEvent('cambio-versione', { detail: versione })); }
  }
  function applicaOpzione(codice, acceso) {
    scrivi(acceso ? 'si' : 'no', 'assistente-' + codice);
    for (const casella of document.querySelectorAll(`[data-opzione-assistente="${codice}"]`)) casella.checked = acceso;
    document.dispatchEvent(new CustomEvent('cambio-assistente', { detail: codice }));
  }
  applica(corrente, false);
  applicaVersione(versione, false);
  // In «Automatico» il tema cambia con il sistema: si aggiorna il colore della barra.
  try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (corrente === 'auto') aggiornaBarraBrowser(); }); } catch { /* browser vecchi */ }

  // ---------- Le scelte ----------
  function elemento(tag, classe, attributi = {}, testo) {
    const el = document.createElement(tag);
    if (classe) el.className = classe;
    for (const [k, v] of Object.entries(attributi)) el.setAttribute(k, v);
    if (testo != null) el.textContent = testo;
    return el;
  }
  // Una piccola pagina finta con i colori del tema: barra laterale, riquadro della rata, due righe, un pulsante.
  function anteprima(codice) {
    const contenitore = elemento('span', 'anteprima-tema', { 'aria-hidden': 'true' });
    for (const c of codice === 'auto' ? ['chiaro', 'notte'] : [codice]) {
      const mini = elemento('span', 'mini', { 'data-tema': c });
      mini.append(elemento('i', 'mini-lato'), elemento('i', 'mini-eroe'), elemento('i', 'mini-riga'), elemento('i', 'mini-riga corta'), elemento('i', 'mini-pillola'));
      contenitore.append(mini);
    }
    return contenitore;
  }
  function griglia() {
    const g = elemento('div', 'griglia-temi', { role: 'group', 'aria-label': 'Temi disponibili' });
    for (const t of TEMI) {
      const pulsante = elemento('button', 'tessera-tema', { type: 'button', 'data-scelta-tema': t.codice, 'aria-pressed': String(t.codice === corrente) });
      pulsante.append(anteprima(t.codice), elemento('span', 'nome-tema', {}, t.nome), elemento('span', 'descrizione-tema', {}, t.descrizione));
      g.append(pulsante);
    }
    return g;
  }
  // Versione, assistente e colori: le stesse scelte nel riquadro della testata e nel pannello di controllo.
  function scelte() {
    const blocco = elemento('div', 'scelte-impostazioni');
    const versioni = elemento('div', 'scelta-versione', { role: 'group', 'aria-label': 'Versione della pagina' });
    for (const v of VERSIONI) {
      const pulsante = elemento('button', 'tessera-versione', { type: 'button', 'data-scelta-versione': v.codice, 'aria-pressed': String(v.codice === versione) });
      pulsante.append(elemento('span', 'nome-tema', {}, v.nome), elemento('span', 'descrizione-tema', {}, v.descrizione));
      versioni.append(pulsante);
    }
    const opzioni = elemento('div', 'opzioni-assistente');
    for (const o of OPZIONI) {
      const etichetta = elemento('label', 'opzione-assistente');
      const casella = elemento('input', '', { type: 'checkbox', 'data-opzione-assistente': o.codice });
      casella.checked = opzione(o.codice);
      etichetta.append(casella, document.createTextNode(' ' + o.nome));
      opzioni.append(etichetta);
    }
    blocco.append(
      elemento('h3', '', {}, 'Versione della pagina'),
      elemento('p', 'nota', {}, 'La semplice mostra solo l\'essenziale; l\'avanzata aggiunge gli strumenti per chi conosce bene il contratto. I dati sono gli stessi: puoi cambiare quando vuoi.'),
      versioni,
      elemento('h3', '', {}, 'L\'assistente'),
      opzioni,
      elemento('h3', '', {}, 'Colori'),
      griglia());
    blocco.addEventListener('click', evento => {
      const tema = evento.target.closest('[data-scelta-tema]'), scelta = evento.target.closest('[data-scelta-versione]');
      if (tema) applica(tema.dataset.sceltaTema, true);
      if (scelta) applicaVersione(scelta.dataset.sceltaVersione, true);
    });
    blocco.addEventListener('change', evento => {
      const casella = evento.target.closest('[data-opzione-assistente]');
      if (casella) applicaOpzione(casella.dataset.opzioneAssistente, casella.checked);
    });
    return blocco;
  }

  function costruisci() {
    // Riquadro che si apre dal pulsante «Impostazioni»: vicino al pulsante sugli schermi grandi, dal basso sui telefoni.
    const pulsante = document.getElementById('scegli-tema');
    const menu = document.getElementById('menu-temi');
    if (pulsante && menu) {
      const chiudi = elemento('button', 'secondario piccolo', { type: 'button' }, 'Chiudi');
      const testa = elemento('div', 'testa-menu');
      testa.append(elemento('h2', '', { id: 'titolo-menu-temi' }, 'Impostazioni'), chiudi);
      menu.setAttribute('aria-labelledby', 'titolo-menu-temi');
      menu.append(testa, scelte(), elemento('p', 'nota piccola', {}, 'Le scelte restano in questo browser: i dati e i calcoli non cambiano.'));
      const posiziona = () => {
        menu.style.left = menu.style.top = '';
        if (matchMedia('(max-width: 760px)').matches) return;   // sui telefoni il riquadro sale dal basso (stile.css)
        const r = pulsante.getBoundingClientRect(), largo = menu.offsetWidth, alto = menu.offsetHeight, margine = 12;
        const inBarraLaterale = r.left < 320 && r.top > innerHeight / 2;
        let left = inBarraLaterale ? r.right + margine : Math.min(r.right - largo, innerWidth - largo - margine);
        let top = inBarraLaterale ? r.bottom - alto : r.bottom + 8;
        left = Math.max(margine, Math.min(left, innerWidth - largo - margine));
        top = Math.max(margine, Math.min(top, innerHeight - alto - margine));
        menu.style.left = left + 'px';
        menu.style.top = top + 'px';
      };
      const apri = () => { menu.hidden = false; pulsante.setAttribute('aria-expanded', 'true'); posiziona(); const scelto = menu.querySelector('[data-scelta-versione][aria-pressed="true"]'); (scelto || chiudi).focus(); };
      const nascondi = (rimettiFuoco) => { if (menu.hidden) return; menu.hidden = true; pulsante.setAttribute('aria-expanded', 'false'); if (rimettiFuoco) pulsante.focus(); };
      pulsante.addEventListener('click', () => (menu.hidden ? apri() : nascondi(false)));
      chiudi.addEventListener('click', () => nascondi(true));
      document.addEventListener('keydown', evento => { if (evento.key === 'Escape') nascondi(true); });
      document.addEventListener('pointerdown', evento => { if (!menu.hidden && !menu.contains(evento.target) && !pulsante.contains(evento.target)) nascondi(false); });
      window.addEventListener('resize', () => { if (!menu.hidden) posiziona(); });
    }
    // Le stesse scelte nel pannello di controllo.
    const nelPannello = document.getElementById('impostazioni-pannello');
    if (nelPannello) nelPannello.replaceWith(Object.assign(scelte(), { id: 'impostazioni-pannello' }));
    // «Passa alla versione avanzata», dove la semplice nasconde qualcosa.
    document.addEventListener('click', evento => { if (evento.target.closest('[data-passa-versione]')) applicaVersione(evento.target.closest('[data-passa-versione]').dataset.passaVersione, true); });
    applica(corrente, false);
    applicaVersione(versione, false);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', costruisci); else costruisci();

  window.Temi = {
    ELENCO: TEMI, corrente: () => corrente, imposta: codice => applica(codice, true),
    versione: () => versione, impostaVersione: codice => applicaVersione(codice, true), semplice: () => versione === 'semplice',
    opzione, impostaOpzione: applicaOpzione,
  };
})();
