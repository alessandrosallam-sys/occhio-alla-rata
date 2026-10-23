// Icone della pagina: disegni a tratto su una griglia 24 × 24, nello stile delle icone delle schede (colore del testo,
// tratto 1,8, estremità arrotondate). Icone.crea(nome) restituisce un <svg>; gli elementi con data-icona="nome"
// ricevono l'icona all'apertura della pagina (Icone.decora per quelli creati dopo). In fondo il logo (Icone.logo).
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

  // ---------- Il logo ----------
  // Un occhio che ha per iride una moneta con l'euro: «occhio alla rata». È lo stesso disegno di logo.svg, ma con i
  // colori del tema: lo sfondo è quello del riquadro .logo, le ciglia hanno il colore del suo testo. In stile.css le
  // animazioni: si apre e la moneta entra girando, poi sbatte le palpebre e ogni tanto si guarda intorno, con una
  // scintilla. Qui lo sguardo che segue il puntatore e l'occhiolino a un clic. Con «riduci movimento» resta fermo.
  const OCCHIO = 'M7 32C15.5 18.5 24.5 14 32 14s16.5 4.5 25 18c-8.5 13.5-17.5 18-25 18S15.5 45.5 7 32Z';
  let loghi = 0;
  function logo(classe = '') {
    const n = ++loghi, svg = document.createElementNS(NS, 'svg');   // n: gli id interni non si ripetono se i loghi sono più di uno
    svg.setAttribute('viewBox', '0 0 64 64');
    svg.setAttribute('class', ('logo-occhio ' + classe).trim());
    svg.setAttribute('aria-hidden', 'true');
    svg.innerHTML = `<defs>
        <radialGradient id="oro-logo-${n}" cx="0.38" cy="0.32" r="0.75"><stop offset="0" stop-color="#ffe680"/><stop offset="0.55" stop-color="#f7b500"/><stop offset="1" stop-color="#d48a00"/></radialGradient>
        <radialGradient id="bianco-logo-${n}" cx="0.5" cy="0.45" r="0.6"><stop offset="0.55" stop-color="#ffffff"/><stop offset="1" stop-color="#e3e7ff"/></radialGradient>
        <clipPath id="taglio-logo-${n}"><path d="${OCCHIO}"/></clipPath>
      </defs>
      <path class="ciglia" d="M20.6 18.4l-2.4-3.9M32 13.2V8.8M43.4 18.4l2.4-3.9"/>
      <g class="palpebra">
        <path class="bianco" d="${OCCHIO}" fill="url(#bianco-logo-${n})"/>
        <g clip-path="url(#taglio-logo-${n})"><g class="sguardo"><g class="iride"><g class="moneta-gira">
          <circle class="moneta" cx="32" cy="32" r="11.5" fill="url(#oro-logo-${n})"/>
          <circle class="anello" cx="32" cy="32" r="8.9"/>
          <path class="euro" d="M36.4 27.6a6 6 0 1 0 0 8.8M26 30.4h6.6M26 33.6h6.6"/>
          <circle class="riflesso" cx="25.3" cy="25.4" r="1.7"/>
        </g></g></g></g>
        <path class="contorno" d="${OCCHIO}"/>
      </g>
      <path class="scintilla" d="M51 9.5l1.3 3 3 1.3-3 1.3-1.3 3-1.3-3-3-1.3 3-1.3Z"/>`;
    return svg;
  }
  // Lo sguardo segue il puntatore: al massimo 4,5 unità di lato e 3 in alto o in basso (meno se il puntatore è vicino).
  // Fermo il mouse per tre secondi, l'occhio torna a guardarsi intorno da solo.
  const fermo = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  let puntatore = null, quadro = 0, riposo = 0;
  function seguiPuntatore() {
    quadro = 0;
    for (const svg of document.querySelectorAll('.logo-occhio')) {
      const r = svg.getBoundingClientRect(), sguardo = svg.querySelector('.sguardo');
      if (!r.width || !sguardo) continue;
      const dx = puntatore.x - (r.left + r.width / 2), dy = puntatore.y - (r.top + r.height / 2);
      const d = Math.hypot(dx, dy) || 1, vicino = Math.min(1, d / 240);
      sguardo.style.transform = `translate(${(dx / d * 4.5 * vicino).toFixed(2)}px, ${(dy / d * 3 * vicino).toFixed(2)}px)`;
      svg.classList.add('segue-puntatore');
    }
  }
  addEventListener('pointermove', evento => {
    if (fermo() || evento.pointerType === 'touch') return;
    puntatore = { x: evento.clientX, y: evento.clientY };
    if (!quadro) quadro = requestAnimationFrame(seguiPuntatore);
    clearTimeout(riposo);
    riposo = setTimeout(() => {
      for (const svg of document.querySelectorAll('.logo-occhio')) {
        svg.classList.remove('segue-puntatore');
        const sguardo = svg.querySelector('.sguardo');
        if (sguardo) sguardo.style.transform = '';
      }
    }, 3000);
  }, { passive: true });
  // Un clic sul logo: un occhiolino.
  document.addEventListener('click', evento => {
    const svg = evento.target instanceof Element && evento.target.closest('.logo-occhio, .logo');
    const occhio = svg && (svg.matches('.logo-occhio') ? svg : svg.querySelector('.logo-occhio'));
    if (!occhio || fermo()) return;
    occhio.classList.remove('occhiolino');
    void occhio.getBoundingClientRect();   // così l'animazione riparte anche a clic ripetuti
    occhio.classList.add('occhiolino');
  });
  document.addEventListener('animationend', evento => {
    if (evento.animationName === 'logo-occhiolino') evento.target.closest('.logo-occhio').classList.remove('occhiolino');
  });

  document.addEventListener('DOMContentLoaded', () => {
    decoraTutto();
    for (const posto of document.querySelectorAll('.logo')) posto.replaceChildren(logo());
  });
  window.Icone = { crea, decora, decoraTutto, distintivo, logo, NOMI: Object.keys(DISEGNI) };
})();
