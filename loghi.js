// I loghi di Occhio alla Rata: undici disegni animati fra cui scegliere nelle impostazioni (temi.js), su una griglia
// 64 × 64. Lo sfondo è quello del riquadro .logo del tema; il colore principale è quello del suo testo (currentColor),
// le monete sono d'oro. Le animazioni stanno in stile.css (sezione del logo), una famiglia per logo, e si fermano con
// «riduci movimento». Qui: i disegni, la scelta (chiave «logo» nel browser), lo sguardo che segue il puntatore nei loghi
// che hanno occhi (gruppi .sguardo), la reazione a un clic e l'icona della scheda del browser.
(function () {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg', CHIAVE = 'logo';

  // ---------- Pezzi comuni ----------
  const oro = id => `<radialGradient id="${id}" cx="0.38" cy="0.32" r="0.75"><stop offset="0" stop-color="#ffe680"/><stop offset="0.55" stop-color="#f7b500"/><stop offset="1" stop-color="#d48a00"/></radialGradient>`;
  const f = x => +x.toFixed(2);
  // Una moneta d'oro con l'euro (disegnato a tratti, niente caratteri) e il riflesso.
  function moneta(id, cx, cy, r, riflesso = true) {
    const s = r / 11.5;
    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#${id})" stroke="#c27c00" stroke-width="${f(Math.max(0.6, s))}"/>`
      + (r >= 6 ? `<circle cx="${cx}" cy="${cy}" r="${f(8.9 * s)}" fill="none" stroke="#b97800" stroke-width="${f(0.9 * s)}" opacity="0.7"/>` : '')
      + `<path d="M${f(cx + 4.1 * s)} ${f(cy - 4.4 * s)}a${f(6 * s)} ${f(6 * s)} 0 1 0 0 ${f(8.8 * s)}M${f(cx - 6 * s)} ${f(cy - 1.6 * s)}h${f(6.6 * s)}M${f(cx - 6 * s)} ${f(cy + 1.6 * s)}h${f(6.6 * s)}" fill="none" stroke="#6b4300" stroke-width="${f(Math.max(1.1, 2 * s))}" stroke-linecap="round"/>`
      + (riflesso && r >= 4 ? `<circle cx="${f(cx - 6.7 * s)}" cy="${f(cy - 6.6 * s)}" r="${f(1.7 * s)}" fill="#ffffff" opacity="0.85"/>` : '');
  }
  const SCINTILLA = (x, y, s = 1) => `<path class="scintilla" d="M${x} ${y}l${1.3 * s} ${3 * s} ${3 * s} ${1.3 * s}-${3 * s} ${1.3 * s}-${1.3 * s} ${3 * s}-${1.3 * s}-${3 * s}-${3 * s}-${1.3 * s} ${3 * s}-${1.3 * s}Z" fill="#ffe680"/>`;
  const OCCHIO = 'M7 32C15.5 18.5 24.5 14 32 14s16.5 4.5 25 18c-8.5 13.5-17.5 18-25 18S15.5 45.5 7 32Z';

  // ---------- I disegni ----------
  // nome e descrizione per le impostazioni; sguardo: quanto si spostano gli occhi verso il puntatore (di lato, in alto e
  // in basso), se il logo ne ha; disegno(n): il contenuto dell'svg (n rende unici gli id interni).
  const LOGHI = [
    { codice: 'occhio', nome: 'Occhio', descrizione: 'Un occhio con una moneta per iride: sbatte le palpebre e ti segue con lo sguardo.', sguardo: [4.5, 3],
      disegno: n => `<defs>${oro('oro-' + n)}
          <radialGradient id="bianco-${n}" cx="0.5" cy="0.45" r="0.6"><stop offset="0.55" stop-color="#ffffff"/><stop offset="1" stop-color="#e3e7ff"/></radialGradient>
          <clipPath id="taglio-${n}"><path d="${OCCHIO}"/></clipPath></defs>
        <path class="ciglia" d="M20.6 18.4l-2.4-3.9M32 13.2V8.8M43.4 18.4l2.4-3.9" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" opacity="0.92"/>
        <g class="palpebra"><path d="${OCCHIO}" fill="url(#bianco-${n})"/>
          <g clip-path="url(#taglio-${n})"><g class="sguardo"><g class="iride"><g class="moneta-gira">${moneta('oro-' + n, 32, 32, 11.5)}</g></g></g></g>
          <path d="${OCCHIO}" fill="none" stroke="#1e1b4b" stroke-opacity="0.25" stroke-width="1.2"/></g>
        ${SCINTILLA(51, 9.5)}` },
    { codice: 'salvadanaio', nome: 'Salvadanaio', descrizione: 'Un maialino che ingoia monete e ti fa l\'occhiolino.', sguardo: [1.2, 0.8],
      disegno: n => `<defs>${oro('oro-' + n)}<clipPath id="fessura-${n}"><rect x="0" y="0" width="64" height="25.4"/></clipPath></defs>
        <g clip-path="url(#fessura-${n})"><g class="cade">${moneta('oro-' + n, 29.5, 15, 6)}</g></g>
        <g class="maialino">
          <path d="M11.6 36.6c-3.3-.3-4.9-3.4-2.8-5.2 1.7-1.4 4 .2 2.8 2.1" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round"/>
          <rect x="18" y="44" width="6.5" height="9" rx="2.6" fill="currentColor"/><rect x="35" y="44" width="6.5" height="9" rx="2.6" fill="currentColor"/>
          <ellipse cx="30" cy="37" rx="19" ry="13.5" fill="currentColor"/>
          <path d="M35.5 25.8l4.7-6.8 3.4 8.4z" fill="currentColor"/>
          <rect x="44.5" y="31.5" width="10" height="10.5" rx="4.2" fill="currentColor"/>
          <rect x="44.5" y="31.5" width="10" height="10.5" rx="4.2" fill="none" stroke="#1e1b4b" stroke-opacity="0.18" stroke-width="1"/>
          <circle cx="48.3" cy="36.8" r="1.2" fill="#1e1b4b" opacity="0.45"/><circle cx="51.4" cy="36.8" r="1.2" fill="#1e1b4b" opacity="0.45"/>
          <rect x="24.5" y="24.4" width="10" height="2.8" rx="1.4" fill="#1e1b4b" opacity="0.5"/>
          <circle cx="43" cy="40.5" r="2.4" fill="#f28b8b" opacity="0.55"/>
          <g class="palpebra"><g class="sguardo"><circle cx="39.5" cy="31.8" r="2.4" fill="#1e1b4b"/><circle cx="38.8" cy="31" r="0.8" fill="#ffffff"/></g></g>
        </g>` },
    { codice: 'casa', nome: 'Casa', descrizione: 'Una casa con un occhio alla finestra e il camino che fuma.', sguardo: [3, 2],
      disegno: n => `<defs>${oro('oro-' + n)}<clipPath id="taglio-${n}"><path d="M19.5 40c3.6-5.6 7.8-8.2 12.5-8.2s8.9 2.6 12.5 8.2c-3.6 5.6-7.8 8.2-12.5 8.2s-8.9-2.6-12.5-8.2Z"/></clipPath></defs>
        <g class="fumo"><circle cx="43.5" cy="8.5" r="2.4" fill="currentColor"/><circle cx="46" cy="5" r="1.8" fill="currentColor"/><circle cx="43" cy="2.5" r="1.3" fill="currentColor"/></g>
        <rect x="40.5" y="11" width="5.5" height="10" rx="1.2" fill="currentColor"/>
        <path d="M15 27v24a2.5 2.5 0 0 0 2.5 2.5h29A2.5 2.5 0 0 0 49 51V27" fill="currentColor" opacity="0.22"/>
        <path d="M15 27v24a2.5 2.5 0 0 0 2.5 2.5h29A2.5 2.5 0 0 0 49 51V27" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linejoin="round"/>
        <path d="M9 31 32 12l23 19" fill="none" stroke="currentColor" stroke-width="3.8" stroke-linecap="round" stroke-linejoin="round"/>
        <g class="palpebra"><path d="M19.5 40c3.6-5.6 7.8-8.2 12.5-8.2s8.9 2.6 12.5 8.2c-3.6 5.6-7.8 8.2-12.5 8.2s-8.9-2.6-12.5-8.2Z" fill="#ffffff"/>
          <g clip-path="url(#taglio-${n})"><g class="sguardo">${moneta('oro-' + n, 32, 40, 5.6)}</g></g></g>` },
    { codice: 'gufo', nome: 'Gufo', descrizione: 'Un gufo vigile con gli occhi d\'oro, che ti segue con lo sguardo.', sguardo: [2.6, 1.8],
      disegno: n => `<defs>${oro('oro-' + n)}<clipPath id="occhi-${n}"><circle cx="24.5" cy="29" r="7.8"/><circle cx="39.5" cy="29" r="7.8"/></clipPath></defs>
        <g class="testa">
          <path d="M16.5 21 15 9.5l9.5 6.5M47.5 21 49 9.5 39.5 16" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linejoin="round" stroke-linecap="round"/>
          <path d="M14.5 26c0-8.5 7.7-12.5 17.5-12.5S49.5 17.5 49.5 26v16.5c0 8.5-7.7 12.5-17.5 12.5S14.5 51 14.5 42.5Z" fill="currentColor" opacity="0.28"/>
          <path d="M14.5 26c0-8.5 7.7-12.5 17.5-12.5S49.5 17.5 49.5 26v16.5c0 8.5-7.7 12.5-17.5 12.5S14.5 51 14.5 42.5Z" fill="none" stroke="currentColor" stroke-width="3"/>
          <path d="M24.5 45.5q2.2 2.4 4.4 0M30 48q2 2.4 4 0M35.1 45.5q2.2 2.4 4.4 0" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" opacity="0.8"/>
          <g class="palpebra"><circle cx="24.5" cy="29" r="7.8" fill="#ffffff"/><circle cx="39.5" cy="29" r="7.8" fill="#ffffff"/>
            <g clip-path="url(#occhi-${n})"><g class="sguardo">
              <circle cx="24.5" cy="29" r="4.4" fill="url(#oro-${n})"/><circle cx="24.5" cy="29" r="2" fill="#1e1b4b"/><circle cx="23.4" cy="27.8" r="0.9" fill="#ffffff"/>
              <circle cx="39.5" cy="29" r="4.4" fill="url(#oro-${n})"/><circle cx="39.5" cy="29" r="2" fill="#1e1b4b"/><circle cx="38.4" cy="27.8" r="0.9" fill="#ffffff"/>
            </g></g></g>
          <path d="M29.8 35.5h4.4L32 40.2Z" fill="#f7b500"/>
        </g>
        <path d="M26.5 55v3.5M29.5 55v3.5M34.5 55v3.5M37.5 55v3.5" stroke="#f7b500" stroke-width="2.2" stroke-linecap="round"/>` },
    { codice: 'lente', nome: 'Lente', descrizione: 'Una lente d\'ingrandimento che controlla le rate una per una.', sguardo: null,
      disegno: n => `<defs>${oro('oro-' + n)}</defs>
        <g class="barre">${[[10, 38, 15], [19.5, 32, 21], [29, 35, 18], [38.5, 28, 25], [48, 31, 22]].map(([x, y, h], i) =>
          `<rect class="barra b${i + 1}" x="${x}" y="${y}" width="6.5" height="${h}" rx="2" fill="currentColor"/>`).join('')}</g>
        <g class="lente">
          <path d="M27.5 31.5 35 39" stroke="currentColor" stroke-width="5.2" stroke-linecap="round"/>
          <circle cx="20" cy="24" r="10.5" fill="#ffffff" fill-opacity="0.9"/>
          ${moneta('oro-' + n, 20, 24, 6.4)}
          <circle cx="20" cy="24" r="10.5" fill="none" stroke="currentColor" stroke-width="3.6"/>
          <path d="M13.5 20.5a7.5 7.5 0 0 1 4-4" fill="none" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round" opacity="0.9"/>
        </g>` },
    { codice: 'moneta', nome: 'Moneta', descrizione: 'Una moneta che gira: da una parte l\'euro, dall\'altra la spunta dei conti giusti.', sguardo: null,
      disegno: n => `<defs>${oro('oro-' + n)}<clipPath id="faccia-${n}"><circle cx="32" cy="32" r="19"/></clipPath></defs>
        <g class="gira">
          <g class="fronte">${moneta('oro-' + n, 32, 32, 19)}
            <g clip-path="url(#faccia-${n})"><rect class="lampo" x="-12" y="4" width="7" height="56" fill="#ffffff" opacity="0.55" transform="rotate(25 32 32)"/></g></g>
          <g class="retro"><circle cx="32" cy="32" r="19" fill="url(#oro-${n})" stroke="#c27c00" stroke-width="1.6"/>
            <circle cx="32" cy="32" r="14.7" fill="none" stroke="#b97800" stroke-width="1.4" opacity="0.7"/>
            <path d="M23.5 32.5l6 6 11.5-12.5" fill="none" stroke="#1d7a3c" stroke-width="4.2" stroke-linecap="round" stroke-linejoin="round"/></g>
        </g>
        ${SCINTILLA(50, 7)}${SCINTILLA(10, 46, 0.8)}` },
    { codice: 'calendario', nome: 'Calendario', descrizione: 'Un calendario che si riempie di spunte, una rata alla volta.', sguardo: null,
      disegno: n => `<defs>${oro('oro-' + n)}</defs>
        <g class="foglio">
          <rect x="10.5" y="15" width="43" height="40" rx="7" fill="#ffffff"/>
          <path d="M10.5 22a7 7 0 0 1 7-7h29a7 7 0 0 1 7 7v4.5h-43Z" fill="#f7b500"/>
          <rect x="19.5" y="9.5" width="4.4" height="11" rx="2.2" fill="currentColor"/><rect x="40.1" y="9.5" width="4.4" height="11" rx="2.2" fill="currentColor"/>
          ${[[21, 35], [32, 35], [43, 35], [21, 46], [32, 46]].map(([x, y], i) =>
            `<circle cx="${x}" cy="${y}" r="3.6" fill="#dfe3f5"/><path class="visto s${i + 1}" d="M${x - 3.8} ${y + 0.2}l2.6 2.6 5.2-5.6" fill="none" stroke="#2f9e44" stroke-width="2.7" stroke-linecap="round" stroke-linejoin="round" pathLength="1"/>`).join('')}
          <g class="ultima">${moneta('oro-' + n, 43, 46, 4.6)}</g>
        </g>` },
    { codice: 'radar', nome: 'Radar', descrizione: 'Un radar che scova le monete: niente gli sfugge.', sguardo: null,
      disegno: n => `<defs>${oro('oro-' + n)}<linearGradient id="scia-${n}" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#ffe680" stop-opacity="0"/><stop offset="1" stop-color="#ffe680" stop-opacity="0.75"/></linearGradient></defs>
        <circle cx="32" cy="32" r="24" fill="currentColor" opacity="0.14"/>
        <g fill="none" stroke="currentColor" stroke-width="1.7" opacity="0.6"><circle cx="32" cy="32" r="24"/><circle cx="32" cy="32" r="16"/><circle cx="32" cy="32" r="8"/><path d="M32 8v48M8 32h48"/></g>
        <g class="raggio"><path d="M32 32 15 15A24 24 0 0 1 32 8Z" fill="url(#scia-${n})"/><path d="M32 32V8" stroke="#ffe680" stroke-width="2.4" stroke-linecap="round"/></g>
        <g class="punto p1">${moneta('oro-' + n, 44, 21, 4.2, false)}</g>
        <g class="punto p2">${moneta('oro-' + n, 41, 45, 3.4, false)}</g>
        <g class="punto p3">${moneta('oro-' + n, 20, 40, 3.8, false)}</g>
        <circle cx="32" cy="32" r="2.8" fill="#ffffff"/>` },
    { codice: 'binocolo', nome: 'Binocolo', descrizione: 'Un binocolo che scruta l\'orizzonte in cerca di sorprese.', sguardo: [2.2, 1.6],
      disegno: n => `<defs>${oro('oro-' + n)}<clipPath id="lenti-${n}"><circle cx="21" cy="37.5" r="8.4"/><circle cx="43" cy="37.5" r="8.4"/></clipPath></defs>
        <g class="binocolo">
          <rect x="15" y="16.5" width="12" height="11" rx="3" fill="currentColor"/><rect x="37" y="16.5" width="12" height="11" rx="3" fill="currentColor"/>
          <rect x="26.5" y="22.5" width="11" height="10" rx="2.5" fill="currentColor"/>
          <circle cx="21" cy="37.5" r="12.8" fill="currentColor"/><circle cx="43" cy="37.5" r="12.8" fill="currentColor"/>
          <circle cx="21" cy="37.5" r="8.4" fill="#2c2a63"/><circle cx="43" cy="37.5" r="8.4" fill="#2c2a63"/>
          <g clip-path="url(#lenti-${n})"><g class="sguardo"><g class="vista">${moneta('oro-' + n, 21, 37.5, 4.6, false)}${moneta('oro-' + n, 43, 37.5, 4.6, false)}</g></g>
            <path d="M14.5 34a7 7 0 0 1 4.2-4.3M36.5 34a7 7 0 0 1 4.2-4.3" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" opacity="0.9"/></g>
        </g>` },
    { codice: 'grafico', nome: 'Grafico', descrizione: 'Un grafico che si disegna da solo e finisce in una moneta.', sguardo: null,
      disegno: n => `<defs>${oro('oro-' + n)}</defs>
        <path d="M11 10v42h43" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" opacity="0.75"/>
        ${[[17, 38, 14], [27, 32, 20], [37, 36, 16], [47, 27, 25]].map(([x, y, h], i) => `<rect class="pilastro c${i + 1}" x="${x}" y="${y}" width="6.5" height="${h}" rx="1.6" fill="currentColor" opacity="0.38"/>`).join('')}
        <path class="linea" d="M15 40 25 30 35 34 46 21" fill="none" stroke="#ffe680" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" pathLength="1"/>
        <g class="punte"><circle cx="15" cy="40" r="2.1" fill="#ffffff"/><circle cx="25" cy="30" r="2.1" fill="#ffffff"/><circle cx="35" cy="34" r="2.1" fill="#ffffff"/></g>
        <g class="cima">${moneta('oro-' + n, 49.5, 17, 6.2)}</g>` },
    { codice: 'sveglia', nome: 'Sveglia', descrizione: 'Una sveglia che suona: la scadenza della rata non ti scappa.', sguardo: null,
      disegno: n => `<defs>${oro('oro-' + n)}</defs>
        <path class="squillo" d="M7 30H3.5M8 23.5l-3-2M57 30h3.5M56 23.5l3-2" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>
        <g class="sveglia">
          <path d="M12.5 23a9 9 0 0 1 12.2-11.4ZM51.5 23a9 9 0 0 0-12.2-11.4Z" fill="currentColor"/>
          <path d="M32 15.5v-5" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><circle cx="32" cy="8.5" r="2.6" fill="currentColor"/>
          <path d="M20 51.5l-4 5.5M44 51.5l4 5.5" stroke="currentColor" stroke-width="3.4" stroke-linecap="round"/>
          <circle cx="32" cy="35" r="18" fill="#ffffff"/><circle cx="32" cy="35" r="18" fill="none" stroke="currentColor" stroke-width="3.4"/>
          <path d="M32 19.5v3M47.5 35h-3M32 50.5v-3M16.5 35h3" stroke="#1e1b4b" stroke-width="2" stroke-linecap="round" opacity="0.45"/>
          <path class="ore" d="M32 35l-6.5-5" stroke="#1e1b4b" stroke-width="3" stroke-linecap="round"/>
          <path class="minuti" d="M32 35V22.5" stroke="#1e1b4b" stroke-width="2.4" stroke-linecap="round"/>
          ${moneta('oro-' + n, 32, 35, 3.2, false)}
        </g>` },
  ];
  const valido = codice => LOGHI.some(l => l.codice === codice);
  const leggi = () => { if (window.MUTUO_UN_FILE) return null; try { return localStorage.getItem(CHIAVE); } catch { return null; } };
  const scrivi = valore => { if (window.MUTUO_UN_FILE) return; try { localStorage.setItem(CHIAVE, valore); } catch { /* vale solo per questa volta */ } };
  let scelto = valido(leggi()) ? leggi() : 'occhio';

  let fatti = 0;
  // Un logo (svg): quello scelto, o quello indicato (le anteprime delle impostazioni).
  function crea(codice = scelto, classe = '') {
    const logo = LOGHI.find(l => l.codice === codice) || LOGHI[0], svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 64 64');
    svg.setAttribute('class', `logo-disegno logo-${logo.codice} ${classe}`.trim());
    svg.setAttribute('aria-hidden', 'true');
    svg.innerHTML = logo.disegno(++fatti);
    return svg;
  }
  // L'icona della scheda del browser: il logo scelto su un riquadro blu-viola, fermo (testo bianco).
  function aggiornaIcona() {
    const logo = LOGHI.find(l => l.codice === scelto) || LOGHI[0];
    const svg = `<svg xmlns="${NS}" viewBox="0 0 64 64" color="#ffffff"><defs><linearGradient id="sfondo" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4c6ef5"/><stop offset="1" stop-color="#7048e8"/></linearGradient></defs>`
      + `<rect width="64" height="64" rx="16" fill="url(#sfondo)"/>${logo.disegno('icona')}</svg>`;
    let link = document.querySelector('link[rel="icon"]');
    if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.append(link); }
    link.type = 'image/svg+xml';
    link.href = 'data:image/svg+xml,' + encodeURIComponent(svg);
  }
  // Ridisegna tutti i loghi della pagina (non le anteprime delle impostazioni) con quello scelto.
  function ridisegna() {
    for (const posto of document.querySelectorAll('.logo:not(.anteprima-logo)')) posto.replaceChildren(crea());
    for (const pulsante of document.querySelectorAll('[data-scelta-logo]')) pulsante.setAttribute('aria-pressed', String(pulsante.dataset.sceltaLogo === scelto));
    aggiornaIcona();
  }
  function scegli(codice) {
    if (!valido(codice)) return;
    scelto = codice;
    scrivi(codice);
    ridisegna();
  }

  // ---------- Lo sguardo che segue il puntatore ----------
  // Negli occhi dei loghi che li hanno (gruppi .sguardo): al massimo «sguardo» unità di lato e in verticale, meno se il
  // puntatore è vicino. Fermo il mouse per tre secondi, i loghi tornano alle loro animazioni.
  const fermo = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  let puntatore = null, quadro = 0, riposo = 0;
  function seguiPuntatore() {
    quadro = 0;
    for (const svg of document.querySelectorAll('.logo-disegno')) {
      const logo = LOGHI.find(l => svg.classList.contains('logo-' + l.codice));
      if (!logo || !logo.sguardo) continue;
      const r = svg.getBoundingClientRect();
      if (!r.width) continue;
      const dx = puntatore.x - (r.left + r.width / 2), dy = puntatore.y - (r.top + r.height / 2);
      const d = Math.hypot(dx, dy) || 1, vicino = Math.min(1, d / 240);
      for (const sguardo of svg.querySelectorAll('.sguardo')) sguardo.style.transform = `translate(${f(dx / d * logo.sguardo[0] * vicino)}px, ${f(dy / d * logo.sguardo[1] * vicino)}px)`;
      svg.classList.add('segue-puntatore');
    }
  }
  addEventListener('pointermove', evento => {
    if (fermo() || evento.pointerType === 'touch') return;
    puntatore = { x: evento.clientX, y: evento.clientY };
    if (!quadro) quadro = requestAnimationFrame(seguiPuntatore);
    clearTimeout(riposo);
    riposo = setTimeout(() => {
      for (const svg of document.querySelectorAll('.logo-disegno')) {
        svg.classList.remove('segue-puntatore');
        for (const sguardo of svg.querySelectorAll('.sguardo')) sguardo.style.transform = '';
      }
    }, 3000);
  }, { passive: true });
  // Un clic sul logo: ognuno reagisce a modo suo (occhiolino, moneta che gira, sveglia che suona…: stile.css).
  document.addEventListener('click', evento => {
    const posto = evento.target instanceof Element && evento.target.closest('.logo-disegno, .logo');
    const svg = posto && (posto.matches('.logo-disegno') ? posto : posto.querySelector('.logo-disegno'));
    if (!svg || fermo()) return;
    svg.classList.remove('clic');
    void svg.getBoundingClientRect();   // così la reazione riparte anche a clic ripetuti
    svg.classList.add('clic');
    clearTimeout(svg._clic);
    svg._clic = setTimeout(() => svg.classList.remove('clic'), 1200);
  });

  document.addEventListener('DOMContentLoaded', ridisegna);
  window.Loghi = { ELENCO: LOGHI, crea, scegli, scelto: () => scelto };
  // Per chi disegna il logo da sé (la prima pagina della guida): quello scelto.
  if (window.Icone) window.Icone.logo = classe => crea(scelto, classe);
})();
