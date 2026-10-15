// Temi della pagina. Tutti i colori, i caratteri, i raggi e gli spessori stanno in stile.css come variabili, un blocco
// per tema ([data-tema="…"]). Questo file:
//  - sceglie il tema e lo mette su <html> prima che la pagina si disegni (si carica nel <head>, così niente lampi);
//  - lo ricorda nel browser (chiave «tema»);
//  - costruisce il selettore: il pulsante «Aspetto» nella testata apre un riquadro con le anteprime, e la stessa
//    griglia sta nel pannello di controllo. Ogni anteprima porta il suo data-tema, quindi mostra i colori veri.
(function () {
  'use strict';
  const CHIAVE = 'tema';
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
  const radice = document.documentElement;
  const valido = codice => TEMI.some(t => t.codice === codice);
  const leggi = () => { if (window.MUTUO_UN_FILE) return null; try { return localStorage.getItem(CHIAVE); } catch { return null; } };
  const scrivi = valore => { if (window.MUTUO_UN_FILE) return; try { localStorage.setItem(CHIAVE, valore); } catch { /* vale solo per questa volta */ } };
  let corrente = valido(leggi()) ? leggi() : 'auto';

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
    const etichetta = document.querySelector('#scegli-tema .tema-attuale');
    if (etichetta) etichetta.textContent = TEMI.find(t => t.codice === corrente).nome;
    // Il grafico dei tassi legge alcuni colori al momento del disegno: lo si ridisegna.
    if (ricorda && window.Mutuo && window.Mutuo.ridisegnaTassi && document.querySelector('#scheda-tassi:not([hidden])')) window.Mutuo.ridisegnaTassi();
  }
  applica(corrente, false);
  // In «Automatico» il tema cambia con il sistema: si aggiorna il colore della barra.
  try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (corrente === 'auto') aggiornaBarraBrowser(); }); } catch { /* browser vecchi */ }

  // ---------- Selettore ----------
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
    g.addEventListener('click', evento => {
      const pulsante = evento.target.closest('[data-scelta-tema]');
      if (pulsante) applica(pulsante.dataset.sceltaTema, true);
    });
    return g;
  }

  function costruisci() {
    // Riquadro che si apre dal pulsante «Aspetto»: vicino al pulsante sugli schermi grandi, dal basso sui telefoni.
    const pulsante = document.getElementById('scegli-tema');
    const menu = document.getElementById('menu-temi');
    if (pulsante && menu) {
      const chiudi = elemento('button', 'secondario piccolo', { type: 'button' }, 'Chiudi');
      const testa = elemento('div', 'testa-menu');
      testa.append(elemento('h2', '', { id: 'titolo-menu-temi' }, 'Aspetto della pagina'), chiudi);
      menu.setAttribute('aria-labelledby', 'titolo-menu-temi');
      menu.append(testa, griglia(), elemento('p', 'nota piccola', {}, 'Cambia solo l\'aspetto: i dati e i calcoli restano uguali. La scelta resta in questo browser.'));
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
      const apri = () => { menu.hidden = false; pulsante.setAttribute('aria-expanded', 'true'); posiziona(); const scelto = menu.querySelector('[aria-pressed="true"]'); (scelto || chiudi).focus(); };
      const nascondi = (rimettiFuoco) => { if (menu.hidden) return; menu.hidden = true; pulsante.setAttribute('aria-expanded', 'false'); if (rimettiFuoco) pulsante.focus(); };
      pulsante.addEventListener('click', () => (menu.hidden ? apri() : nascondi(false)));
      chiudi.addEventListener('click', () => nascondi(true));
      document.addEventListener('keydown', evento => { if (evento.key === 'Escape') nascondi(true); });
      document.addEventListener('pointerdown', evento => { if (!menu.hidden && !menu.contains(evento.target) && !pulsante.contains(evento.target)) nascondi(false); });
      window.addEventListener('resize', () => { if (!menu.hidden) posiziona(); });
    }
    // La stessa griglia nel pannello di controllo.
    const nelPannello = document.getElementById('griglia-temi-pannello');
    if (nelPannello) nelPannello.replaceWith(Object.assign(griglia(), { id: 'griglia-temi-pannello' }));
    applica(corrente, false);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', costruisci); else costruisci();

  window.Temi = { ELENCO: TEMI, corrente: () => corrente, imposta: codice => applica(codice, true) };
})();
