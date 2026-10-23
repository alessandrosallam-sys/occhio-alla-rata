// La scena della prima apertura: di notte il gufo, il logo del progetto, plana dall'alto, agguanta il sacchetto
// delle monete, lo porta in volo sulla collina e ci si posa sopra; poi compare il nome. Sta in cima alla prima pagina
// della guida quando si parte da zero (configura.js), con sotto la presentazione del progetto.
// È tutta SVG e CSS (stile.css, «La scena della prima apertura»): l'animazione sta sotto la classe «in-volo», che
// c'è solo la prima volta che la scena si disegna in questa apertura della pagina; un clic la fa ripartire. Senza
// animazioni (o con «riduci movimento» nel sistema) si vede la scena finale: il gufo posato sul sacchetto.
(() => {
  // Il gufo è quello del logo (loghi.js, «gufo»), con il corpo intero e le ali; si disegna con le misure del logo
  // (64×64) e si porta sulla collina con translate e scale. Tutto è disegnato nella posizione finale: il volo sposta
  // i gruppi .intro-insieme (gufo e sacchetto, da terra alla collina) e .intro-volo (il gufo, dal cielo al sacchetto).
  const ORO = '#f7b500', SCURO = '#8a5a00';
  const STELLE = [[36, 128, 1.3], [96, 112, 1], [150, 30, 1.6], [176, 92, 1.1], [214, 20, 1.3], [262, 52, 1.7], [318, 26, 1.1],
    [286, 100, 1.2], [352, 64, 1.4], [460, 98, 1.2], [470, 14, 1.5], [226, 136, 1], [24, 40, 1.2], [118, 66, 1.4], [72, 16, 1]];
  const stella = ([x, y, r], i) => `<circle cx="${x}" cy="${y}" r="${r}"${i % 3 === 0 ? ` class="brilla" style="animation-delay:${(i * 0.37) % 3}s"` : ''}/>`;
  const scintilla = (x, y, s) => `<path d="M${x} ${y - s}l${s * 0.28} ${s * 0.72} ${s * 0.72} ${s * 0.28}-${s * 0.72} ${s * 0.28}-${s * 0.28} ${s * 0.72}-${s * 0.28}-${s * 0.72}-${s * 0.72}-${s * 0.28} ${s * 0.72}-${s * 0.28}Z"/>`;
  const SCENA = `<svg class="intro-disegno" viewBox="0 0 480 200" aria-hidden="true" focusable="false">
  <defs>
    <radialGradient id="intro-oro" cx="0.38" cy="0.32" r="0.75"><stop offset="0" stop-color="#ffe680"/><stop offset="0.55" stop-color="${ORO}"/><stop offset="1" stop-color="#d48a00"/></radialGradient>
    <radialGradient id="intro-alone"><stop offset="0.35" stop-color="#ffffff" stop-opacity="0.22"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></radialGradient>
    <linearGradient id="intro-tela" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f2be4e"/><stop offset="1" stop-color="#c98a1c"/></linearGradient>
  </defs>
  <circle cx="440" cy="40" r="38" fill="url(#intro-alone)"/>
  <path d="M437.4 25.2A15 15 0 1 0 454.2 44.8A13 13 0 0 1 437.4 25.2Z" fill="#fff3bf"/>
  <g class="intro-stelle" fill="#ffffff" opacity="0.85">${STELLE.map(stella).join('')}</g>
  <path d="M0 176C70 160 150 170 220 172S340 160 480 168V200H0Z" fill="#1c1458" opacity="0.3"/>
  <path d="M0 186Q125 176 250 182T480 186V200H0Z" fill="#1c1458" opacity="0.45"/>
  <path d="M326 200C340 170 364 155 392 155C420 155 444 170 458 200Z" fill="#1c1458" opacity="0.55"/>
  <g class="intro-insieme">
    <g class="intro-sacco">
      <path d="M384 118C372 124 366 136 368 146C370 153 380 156.5 392 156.5S414 153 416 146C418 136 412 124 400 118Z" fill="url(#intro-tela)" stroke="${SCURO}" stroke-width="1.5"/>
      <path d="M374 141C374 133 377.5 127 383 123.5" fill="none" stroke="#ffe08a" stroke-width="2" stroke-linecap="round" opacity="0.75"/>
      <path d="M399.5 132.6A7 7 0 1 0 399.5 143.4M385.5 136.5h9M385.5 140h9" fill="none" stroke="#7a4d00" stroke-width="1.8" stroke-linecap="round"/>
      <path d="M383 115.5 378 106l8 3.5 6-6.5 6 6.5 8-3.5-5 9.5Z" fill="#e6ad3c" stroke="${SCURO}" stroke-width="1.2" stroke-linejoin="round"/>
      <rect x="381.5" y="113.5" width="21" height="5.5" rx="2.75" fill="${SCURO}"/>
    </g>
    <g class="intro-volo">
      <g transform="translate(350.4 35.5) scale(1.3)">
        <g class="intro-gufo">
          <g class="intro-ali-aperte" fill="#c3cbff" stroke="#ffffff" stroke-width="1" stroke-linejoin="round">
            <g class="intro-ala intro-ala-sx"><path d="M17 26C8 16-8 9-22 11C-27 12-28 16-24 18C-26 20-25 23-20 23C-21 26-18 28-13 27C-13 30-9 32-5 30C-4 33 0 35 4 33C6 37 11 39 15 40Z"/>
              <path d="M-18 16.5C-8 17.5 4 21.5 14 29M-10 23C-2 24 6 27 13 34" fill="none" stroke="#8f9cf5" stroke-width="1.1" stroke-linecap="round"/></g>
            <g class="intro-ala intro-ala-dx"><path d="M47 26C56 16 72 9 86 11C91 12 92 16 88 18C90 20 89 23 84 23C85 26 82 28 77 27C77 30 73 32 69 30C68 33 64 35 60 33C58 37 53 39 49 40Z"/>
              <path d="M82 16.5C72 17.5 60 21.5 50 29M74 23C66 24 58 27 51 34" fill="none" stroke="#8f9cf5" stroke-width="1.1" stroke-linecap="round"/></g>
          </g>
          <path d="M16.5 22 15 9.5l9.5 6.5ZM47.5 22 49 9.5 39.5 16Z" fill="#c9cffc" stroke="#ffffff" stroke-width="1.6" stroke-linejoin="round"/>
          <path d="M14.5 26c0-8.5 7.7-12.5 17.5-12.5S49.5 17.5 49.5 26v16.5c0 8.5-7.7 12.5-17.5 12.5S14.5 51 14.5 42.5Z" fill="#eef0ff" stroke="#ffffff" stroke-width="1.4"/>
          <ellipse cx="32" cy="46" rx="11" ry="8" fill="#ffffff"/>
          <path d="M25.5 44.5q2.2 2.4 4.4 0M30 47.5q2 2.4 4 0M34.1 44.5q2.2 2.4 4.4 0" fill="none" stroke="#9aa5f5" stroke-width="1.4" stroke-linecap="round"/>
          <g class="intro-ali-chiuse" fill="#c3cbff"><path d="M17 29C11.5 34 11.5 45 17.5 52.5C20.5 46 21 37 17 29Z"/><path d="M47 29C52.5 34 52.5 45 46.5 52.5C43.5 46 43 37 47 29Z"/></g>
          <g class="intro-palpebra">
            <circle cx="24.5" cy="29" r="7.8" fill="#ffffff" stroke="#c9cffc" stroke-width="1"/><circle cx="39.5" cy="29" r="7.8" fill="#ffffff" stroke="#c9cffc" stroke-width="1"/>
            <g class="intro-sguardo">
              <circle cx="24.5" cy="29" r="4.4" fill="url(#intro-oro)"/><circle cx="24.5" cy="29" r="2" fill="#1e1b4b"/><circle cx="23.4" cy="27.8" r="0.9" fill="#ffffff"/>
              <circle cx="39.5" cy="29" r="4.4" fill="url(#intro-oro)"/><circle cx="39.5" cy="29" r="2" fill="#1e1b4b"/><circle cx="38.4" cy="27.8" r="0.9" fill="#ffffff"/>
            </g>
          </g>
          <path d="M29.8 35.5h4.4L32 40.2Z" fill="${ORO}"/>
          <path d="M26.5 54.5v4M29.5 54.5v4M34.5 54.5v4M37.5 54.5v4" stroke="${ORO}" stroke-width="2.2" stroke-linecap="round"/>
        </g>
      </g>
    </g>
    <g class="intro-monete" fill="url(#intro-oro)" stroke="#b07800" stroke-width="1">
      <circle cx="388" cy="112" r="3.8" style="--x:-30px;--y:-24px"/><circle cx="392" cy="110" r="3.8" style="--x:30px;--y:-30px"/><circle cx="396" cy="112" r="3.8" style="--x:40px;--y:-6px"/>
    </g>
  </g>
  <g class="intro-scintille" fill="#fff3bf">${scintilla(356, 128, 7)}${scintilla(432, 116, 6)}${scintilla(424, 148, 5)}</g>
</svg>`;

  let vista = false;   // la prima volta in questa apertura della pagina la scena si anima, poi resta ferma
  function crea() {
    const intro = document.createElement('div');
    intro.className = 'intro' + (vista ? '' : ' in-volo');
    intro.title = 'Clic per rivedere il volo del gufo';
    intro.innerHTML = `<div class="intro-scena">${SCENA}</div>
      <div class="intro-testo"><p class="intro-nome">Occhio alla Rata</p><p class="intro-motto">Tiene d'occhio le rate del tuo mutuo o finanziamento, al centesimo.</p></div>`;
    intro.addEventListener('click', () => { intro.classList.remove('in-volo'); void intro.offsetWidth; intro.classList.add('in-volo'); });
    vista = true;
    return intro;
  }
  window.Intro = { crea };
})();
