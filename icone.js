// Icone della pagina: disegni a tratto su una griglia 24 × 24, nello stile delle icone delle schede (colore del testo,
// tratto 1,8, estremità arrotondate). Icone.crea(nome) restituisce un <svg>; gli elementi con data-icona="nome"
// ricevono l'icona all'apertura della pagina (Icone.decora per quelli creati dopo).
(function () {
  'use strict';
  const DISEGNI = {
    // Tipi di prestito
    casa: '<path d="M3.5 11.2 12 4l8.5 7.2"/><path d="M5.5 9.6V20h13V9.6"/><path d="M10 20v-5.5h4V20"/>',
    auto: '<path d="M5.3 17H4a1 1 0 0 1-1-1v-2.8c0-.6.3-1.1.8-1.3l1.4-.6L7 7.6a2 2 0 0 1 1.8-1.1h6.4a2 2 0 0 1 1.8 1.1l1.8 3.7 1.4.6c.5.2.8.7.8 1.3V16a1 1 0 0 1-1 1h-1.3"/><path d="M9.7 17h4.6"/><path d="M5.7 11.3h12.6"/><circle cx="7.5" cy="17" r="2"/><circle cx="16.5" cy="17" r="2"/>',
    portafoglio: '<path d="M17 5.5H5.8A1.8 1.8 0 0 0 4 7.3v10.4c0 1 .8 1.8 1.8 1.8h12.4c1 0 1.8-.8 1.8-1.8v-7.4c0-1-.8-1.8-1.8-1.8H5.8A1.8 1.8 0 0 1 4 6.7"/><circle cx="16" cy="14" r="1.1"/>',
    // Schede
    prestiti: '<rect x="3.5" y="7.5" width="17" height="12.5" rx="2.5"/><path d="M6.5 4h11M3.5 12.5h17"/>',
    offerte: '<path d="M12 4v16M7 20h10M5 8h14"/><path d="M5 8l-2.5 6a2.5 2.5 0 0 0 5 0z"/><path d="M19 8l-2.5 6a2.5 2.5 0 0 0 5 0z"/>',
    piano: '<rect x="3.5" y="4" width="17" height="16" rx="2.5"/><path d="M3.5 9.5h17M3.5 14.8h17M9.5 9.5V20"/>',
    grafico: '<path d="M3.5 17.5l5-5.5 4 3 7.5-8"/><path d="M15 7h5v5"/>',
    calendario: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    bandiera: '<path d="M5.5 21V4M5.5 4.5h12l-2.5 4 2.5 4h-12"/>',
    pannello: '<path d="M4 7h9M18 7h2M4 17h3M12 17h8"/><circle cx="15.5" cy="7" r="2.3"/><circle cx="9.5" cy="17" r="2.3"/>',
    // Cose e azioni
    percento: '<path d="M18 6 6 18"/><circle cx="7.5" cy="7.5" r="2.2"/><circle cx="16.5" cy="16.5" r="2.2"/>',
    euro: '<circle cx="12" cy="12" r="8.5"/><path d="M15.2 8.9a4 4 0 1 0 0 6.2"/><path d="M7.6 11h5.6M7.6 13.2h5.6"/>',
    calcolatrice: '<rect x="5.5" y="3.5" width="13" height="17" rx="2"/><path d="M8.5 7.5h7"/><path d="M8.5 11.5h.01M12 11.5h.01M15.5 11.5h.01M8.5 15h.01M12 15h.01M15.5 15h.01M8.5 18h.01M12 18h3.5"/>',
    fulmine: '<path d="M13 3 5.5 13.5H12L11 21l7.5-10.5H12z"/>',
    bacchetta: '<path d="m4.5 19.5 10-10"/><path d="m13 8 3 3"/><path d="M17 3.5v3M15.5 5h3M20 9.5v2.5M18.8 10.8h2.5M9.5 3.5v2M8.5 4.5h2"/>',
    copia: '<rect x="8.5" y="8.5" width="11" height="11" rx="2"/><path d="M15.5 8.5V6A1.5 1.5 0 0 0 14 4.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5"/>',
    matita: '<path d="M4.5 19.5 5.5 15 15.8 4.7a1.8 1.8 0 0 1 2.5 0l1 1a1.8 1.8 0 0 1 0 2.5L9 18.5z"/><path d="m13.5 7 3.5 3.5"/>',
    bersaglio: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.4"/>',
    regole: '<path d="M10 6.5h9.5M10 12h9.5M10 17.5h9.5"/><path d="m4 6.5 1.3 1.3L7.5 5.5M4 12l1.3 1.3L7.5 11M4 17.5l1.3 1.3 2.2-2.3"/>',
    dati: '<ellipse cx="12" cy="6" rx="7" ry="2.5"/><path d="M5 6v12c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5V6"/><path d="M5 12c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5"/>',
    scarica: '<path d="M12 4v11"/><path d="m7.5 10.5 4.5 4.5 4.5-4.5"/><path d="M5 19.5h14"/>',
    carica: '<path d="M12 15V4"/><path d="M7.5 8.5 12 4l4.5 4.5"/><path d="M5 19.5h14"/>',
    cestino: '<path d="M4.5 7h15"/><path d="M9.5 7V5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v2"/><path d="m6.5 7 .8 12a1.5 1.5 0 0 0 1.5 1.4h6.4a1.5 1.5 0 0 0 1.5-1.4l.8-12"/><path d="M10 11v6M14 11v6"/>',
    piu: '<path d="M12 5v14M5 12h14"/>',
    freccia: '<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>',
    spunta: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    attenzione: '<path d="M12 4 2.8 19.5h18.4z"/><path d="M12 10v4.5M12 17.3v.1"/>',
    info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.8v.1"/>',
    lampadina: '<path d="M9.5 17.5h5M10.5 20.5h3"/><path d="M12 3.5a5.5 5.5 0 0 0-3.3 9.9c.5.4.8 1 .8 1.6v.5h5V15c0-.6.3-1.2.8-1.6A5.5 5.5 0 0 0 12 3.5z"/>',
    stella: '<path d="m12 3.8 2.5 5.1 5.6.8-4 3.9 1 5.6-5.1-2.7-5.1 2.7 1-5.6-4-3.9 5.6-.8z"/>',
    discesa: '<path d="M3.5 7 9 12.5l4-4 7.5 7.5"/><path d="M20.5 11v5h-5"/>',
    somma: '<path d="M17.5 5h-11l6 7-6 7h11"/>',
    bussola: '<circle cx="12" cy="12" r="8.5"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>',
    orologio: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    nuvola: '<path d="M7 18.5a4.5 4.5 0 0 1-.6-9A6 6 0 0 1 18 11a3.8 3.8 0 0 1-.6 7.5"/><path d="M12 11.5v7M9.5 16l2.5 2.5 2.5-2.5"/>',
    colonne: '<path d="M4 19.5h16"/><rect x="5.5" y="12" width="3" height="5.5"/><rect x="10.5" y="9" width="3" height="8.5"/><rect x="15.5" y="5.5" width="3" height="12"/>',
    scudo: '<path d="M12 3.5 5 6v5.5c0 4.3 3 7.6 7 9 4-1.4 7-4.7 7-9V6z"/><path d="m9 12 2.2 2.2L15.5 10"/>',
    documento: '<path d="M7 3.5h6.5l4.5 4.5v11.5a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-15a1 1 0 0 1 1-1z"/><path d="M13.5 3.5V8H18"/><path d="M9 12.5h6M9 16h4"/>',
    lucchetto: '<rect x="5.5" y="10.5" width="13" height="9.5" rx="2"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/>',
    traguardo: '<path d="M5.5 21V4.5"/><path d="M5.5 4.5h13v8h-13"/><path d="M9.8 4.5v8M14.2 4.5v8M5.5 8.5h13"/>',
    // Il marchio: una casa con il segno di percentuale.
    marchio: '<path d="M3.8 11 12 4.3l8.2 6.7"/><path d="M5.8 9.4V19.5h12.4V9.4"/><path d="m14.6 11.6-5.2 6"/><circle cx="9.9" cy="12.3" r="1"/><circle cx="14.1" cy="16.9" r="1"/>',
  };
  const NS = 'http://www.w3.org/2000/svg';
  function crea(nome, classe = 'icona') {
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('class', classe);
    svg.setAttribute('aria-hidden', 'true');
    svg.innerHTML = DISEGNI[nome] || DISEGNI.info;
    return svg;
  }
  // Mette l'icona in testa all'elemento (una volta sola).
  function decora(el, nome = el.dataset.icona) {
    if (!el || !nome || el.querySelector(':scope > svg.icona-aggiunta')) return el;
    el.prepend(crea(nome, 'icona icona-aggiunta'));
    return el;
  }
  // Icona in un tondo colorato (carte dei prestiti e delle offerte, passi della guida, stati vuoti).
  function distintivo(nome, classe = '') {
    const span = document.createElement('span');
    span.className = 'distintivo-icona ' + classe;
    span.append(crea(nome));
    return span;
  }
  const decoraTutto = (radice = document) => radice.querySelectorAll('[data-icona]').forEach(el => decora(el));
  document.addEventListener('DOMContentLoaded', () => decoraTutto());
  window.Icone = { crea, decora, decoraTutto, distintivo, NOMI: Object.keys(DISEGNI) };
})();
