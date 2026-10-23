// La scena della prima apertura: di notte, nel bosco, il gufo plana dall'alto, agguanta il sacchetto delle monete
// (qualcuna salta fuori e cade nell'erba), lo porta in volo sul ceppo davanti alla luna e ci si posa; poi compare il
// nome. Sta in cima alla prima pagina della guida quando si parte da zero (configura.js), con sotto la presentazione.
// È tutta SVG e CSS (stile.css, «La scena della prima apertura»): il volo sta sotto la classe «in-volo», che c'è solo
// la prima volta che la scena si disegna in questa apertura della pagina; un clic lo fa ripartire. Lucciole, stelle,
// felci, nuvole e raggi di luna si muovono sempre, e i piani del bosco seguono il mouse (parallasse). Senza animazioni
// (o con «riduci movimento» nel sistema) si vede la scena finale, ferma: il gufo posato sul ceppo con il sacchetto.
(() => {
  // Foglie, felci e fili d'erba sono sparsi a caso, ma con un seme fisso: la scena è sempre la stessa.
  let seme = 20261023;
  const caso = () => (seme = (seme * 16807) % 2147483647) / 2147483647;
  const tra = (a, b) => a + (b - a) * caso();
  const scegli = lista => lista[Math.floor(caso() * lista.length)];
  const c = x => Math.round(x * 10) / 10;   // numeri corti nel disegno

  // Una foglia appuntita lunga l e larga w che parte da (x, y), girata di a gradi (0 = verso l'alto); la sfumatura
  // va dalla base scura alla punta chiara (la luna la illumina da sopra), e le foglie grandi hanno la nervatura.
  const foglia = (x, y, l, w, a, sfumatura) =>
    `<g transform="translate(${c(x)} ${c(y)}) rotate(${c(a)})"><path d="M0 0Q${c(w)} ${c(-l / 2)} 0 ${c(-l)}Q${c(-w)} ${c(-l / 2)} 0 0Z" fill="url(#${sfumatura})"/>${l > 11 ? `<path d="M0 -1.5V${c(-l + 2.5)}" stroke="#ffffff" stroke-opacity="0.16" stroke-width="0.7"/>` : ''}</g>`;
  // Una chioma: una massa scura dietro e n foglie sparse intorno a (cx, cy), ognuna rivolta verso l'esterno; s le ingrandisce
  function ciuffo(cx, cy, r, n, sfumature, s = 1, massa = '#0b2f33') {
    let foglie = `<ellipse cx="${cx}" cy="${cy}" rx="${c(r * 0.9)}" ry="${c(r * 0.7)}" fill="${massa}"/>`;
    for (let i = 0; i < n; i++) {
      const a = caso() * Math.PI * 2, d = Math.sqrt(caso()) * r;
      foglie += foglia(cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.75, tra(10, 18) * s, tra(6, 10) * s, a * 180 / Math.PI + 90 + tra(-35, 35), scegli(sfumature));
    }
    return foglie;
  }
  // Una felce: il gambo curvo e le foglioline ai due lati, sempre più piccole verso la punta; ondeggia dalla base
  function felce(x, y, l, angolo, curva, scura, chiara) {
    let s = `<path d="M0 0Q${c(curva)} ${c(-l / 2)} ${c(curva * 0.6)} ${c(-l)}" fill="none" stroke="#1a5a44" stroke-width="1.6"/>`;
    for (let k = 1; k <= 12; k++) {
      const t = k / 13.5, u = 1 - t;
      const px = 2 * u * t * curva + t * t * curva * 0.6, py = -l * t;
      const dir = Math.atan2(-l, 2 * u * curva - 0.8 * t * curva) * 180 / Math.PI + 90;
      const lung = l * 0.26 * (1 - t * 0.8);
      s += foglia(px, py, lung, lung * 0.42, dir - 62, k % 2 ? scura : chiara) + foglia(px, py, lung, lung * 0.42, dir + 62, k % 2 ? chiara : scura);
    }
    return `<g transform="translate(${x} ${y}) rotate(${angolo})"><g class="intro-felce" style="--t:${c(tra(4, 7))}s;--r:${c(tra(1.5, 3))}deg">${s}</g></g>`;
  }
  // Un tronco da (x, 320) alto h e largo w, con il lato verso la luna (a destra) più chiaro e qualche segno di corteccia
  const tronco = (x, h, w, sfumatura, corteccia) => `<path d="M${c(x - w)} 320C${c(x - w + 1)} 250 ${c(x - w * 0.7)} ${c(320 - h * 0.6)} ${c(x - w * 0.45)} ${c(320 - h)}L${c(x + w * 0.5)} ${c(320 - h)}C${c(x + w * 0.75)} ${c(320 - h * 0.6)} ${c(x + w + 1)} 250 ${c(x + w + 2)} 320Z" fill="url(#${sfumatura})"/>`
    + (corteccia ? `<path d="M${c(x - w * 0.3)} ${c(320 - h * 0.85)}q2 18 -1 40M${c(x + w * 0.2)} ${c(320 - h * 0.6)}q-2 22 1 46M${c(x - w * 0.1)} ${c(320 - h * 0.3)}q2 16 -1 34" fill="none" stroke="#000000" stroke-opacity="0.22" stroke-width="${c(w * 0.16)}" stroke-linecap="round"/>` : '');
  // Una stella a quattro punte di raggio s
  const stella4 = (x, y, s) => `<path d="M${x} ${c(y - s)}Q${c(x + s * 0.15)} ${c(y - s * 0.15)} ${c(x + s)} ${y}Q${c(x + s * 0.15)} ${c(y + s * 0.15)} ${x} ${c(y + s)}Q${c(x - s * 0.15)} ${c(y + s * 0.15)} ${c(x - s)} ${y}Q${c(x - s * 0.15)} ${c(y - s * 0.15)} ${x} ${c(y - s)}Z"/>`;
  // Una moneta d'oro distesa nell'erba, con il suo bagliore
  const moneta = (x, y, classe = '', stile = '') => `<g${classe ? ` class="${classe}"` : ''}${stile ? ` style="${stile}"` : ''}>
    <ellipse cx="${x}" cy="${y}" rx="11" ry="6" fill="url(#intro-bagliore)" opacity="0.7"/>
    <ellipse cx="${x}" cy="${y + 1.2}" rx="5.6" ry="3" fill="#8a5a00"/><ellipse cx="${x}" cy="${y}" rx="5.6" ry="3" fill="url(#intro-oro)" stroke="#9a6400" stroke-width="0.7"/><path d="M${x - 2.6} ${y - 0.9}q2 -1.2 4.4 -0.4" stroke="#fff3b0" stroke-width="0.9" fill="none"/></g>`;

  // Una penna lunga l e larga w, attaccata in (x, y) e girata di a gradi (0 = verso il basso), sfumata dalla base
  // chiara alla punta scura, con le barre scure e un filo di luce sul bordo
  function penna(x, y, a, l, w, sfumatura, barra, barre = [0.34, 0.58, 0.8]) {
    const m = w / 2;
    let s = `<path d="M${c(-m)} 0C${c(-m)} ${c(l * 0.55)} ${c(-m * 0.85)} ${c(l * 0.86)} 0 ${c(l)}C${c(m * 0.85)} ${c(l * 0.86)} ${c(m)} ${c(l * 0.55)} ${c(m)} 0Z" fill="url(#${sfumatura})" stroke="#2e1a0b" stroke-width="0.7"/>`;
    for (const f of barre) {
      const mezzo = f < 0.7 ? m - 1.2 : m * 0.6;
      s += `<path d="M${c(-mezzo)} ${c(l * f + 1.2)}Q0 ${c(l * f - 1.6)} ${c(mezzo)} ${c(l * f + 1.2)}" stroke="${barra}" stroke-width="2" fill="none"/>`;
    }
    s += `<path d="M${c(m - 0.6)} 2C${c(m - 0.6)} ${c(l * 0.5)} ${c(m * 0.8)} ${c(l * 0.8)} ${c(m * 0.3)} ${c(l * 0.93)}" stroke="#ffe6b0" stroke-opacity="0.35" stroke-width="0.8" fill="none"/>`;
    return `<g transform="translate(${c(x)} ${c(y)}) rotate(${c(a)})">${s}</g>`;
  }
  // L'ala sinistra aperta: la spalla in (0, 0), la punta verso sinistra, le penne che scendono; la destra è specchiata.
  // Sopra le penne, un velo sfumato che scurisce l'ala vicino al corpo e la schiarisce verso la punta (volume), e il
  // bordo d'attacco con il filo di luce della luna.
  function ala() {
    let s = '';
    for (const [x, y, a, l] of [[-104, -8, 76, 56], [-96, -8, 65, 62], [-87, -7, 54, 63], [-78, -6, 43, 61], [-68, -5, 33, 57], [-59, -4, 24, 53]])
      s += penna(x, y, a, l, 11.5, 'intro-primaria', '#4a2a10');
    for (let i = 6; i >= 0; i--) s += penna(-6 - i * 8, -3, 8 + i * 2.2, 45 + i * 0.8, 11.5, 'intro-secondaria', '#5a3415');
    for (let i = 11; i >= 0; i--) s += penna(-3 - i * 8.6, -6, 6 + i * 4.6, 22, 10, 'intro-copritrice', '#6e4320', [0.45]);
    for (let i = 12; i >= 0; i--) s += penna(-1 - i * 8.4, -10, 4 + i * 4.2, 13, 9, 'intro-copritrice', '#7a4d26', [0.55]);
    return s + `<path d="M8 -8C-20 -24-70 -26-118 -14L-160 6C-150 20-135 34-118 40C-100 46-60 48-12 44C-4 40 4 20 8 6Z" fill="url(#intro-ala-velo)"/>
      <path d="M8 -6C-18 -22-68 -25-117 -12C-100 -5-70 -6-46 -5C-28 -4-10 0 8 6Z" fill="#5a3619"/>
      <path d="M2 -10C-24 -21-66 -22-108 -13" fill="none" stroke="#ffe6b0" stroke-opacity="0.6" stroke-width="2" stroke-linecap="round"/>`;
  }
  // L'ala sinistra chiusa, lungo il fianco
  const ALA_CHIUSA = `<path d="M-31 -74C-45 -58-45 -30-33 -8C-30 -3-25 -5-23 -12C-19 -34-21 -58-31 -74Z" fill="url(#intro-ala-chiusa)" stroke="#2e1a0b" stroke-width="0.8"/>
    <path d="M-40 -54q5 3 13 1M-41 -44q6 3 15 1M-40 -34q6 3 15 1M-37 -24q5 3 12 1" fill="none" stroke="#4f2f14" stroke-width="1.7" stroke-linecap="round"/>
    <path d="M-35 -68q3 3 6 0M-38 -61q3 3 6 0M-32 -61q3 3 6 0M-36 -16l2 7M-31 -15l1 7" fill="none" stroke="#d9a86a" stroke-width="1.4" stroke-linecap="round"/>`;

  // Il gufo, con l'origine fra gli artigli (dove afferra il bordo del sacchetto): corpo e testa alti 124, ali di 250.
  // Gli artigli sono a parte (ARTIGLI), perché stanno davanti al sacchetto. Il corpo è sfumato con la luce che
  // arriva da destra in alto (la luna) e ha un filo di luce sul profilo destro.
  function gufo() {
    let barre = '';
    for (const [y, mezzo] of [[-55, 16], [-47, 20], [-39, 21], [-31, 18], [-24, 11]])
      for (let x = -mezzo + 3; x <= mezzo - 3; x += 6) barre += `M${x - 2.4} ${y}l2.4 1.8 2.4-1.8`;
    const occhio = x => `<circle cx="${x}" cy="-84" r="10.6" fill="#24160a"/><circle cx="${x}" cy="-84" r="9" fill="url(#intro-iride)"/>`;
    const pupilla = x => `<circle cx="${x}" cy="-84" r="4.6" fill="#120c06"/><circle cx="${x - 2.6}" cy="-87.4" r="2" fill="#ffffff"/><circle cx="${x + 2.4}" cy="-81.4" r="0.9" fill="#ffffff" opacity="0.8"/>`;
    return `<g class="intro-gufo" filter="url(#intro-ombra-gufo)">
      <g class="intro-ali-aperte">
        <g transform="translate(-24 -66) rotate(28)"><g class="intro-ala">${ala()}</g></g>
        <g transform="scale(-1 1)"><g transform="translate(-24 -66) rotate(28)"><g class="intro-ala">${ala()}</g></g></g>
      </g>
      <path d="M-22 -102C-26 -112-30 -120-34 -128C-24 -123-17 -115-12 -106ZM22 -102C26 -112 30 -120 34 -128C24 -123 17 -115 12 -106Z" fill="#4a2c14"/>
      <path d="M-24 -106-31 -122M24 -106 31 -122" stroke="#9a6534" stroke-width="1.4"/>
      <path d="M-30 -76C-34 -98-18 -112 0 -112C18 -112 34 -98 30 -76C36 -58 34 -36 20 -24C12 -18-12 -18-20 -24C-34 -36-36 -58-30 -76Z" fill="url(#intro-corpo)" stroke="#2e1a0b" stroke-width="0.9"/>
      <path d="M-8 -109l2 5M0 -111v5M8 -109l-2 5M-29 -70q3 2 6 0M-31 -61q3 2 6 0M23 -70q3 2 6 0M25 -61q3 2 6 0" fill="none" stroke="#d6ad76" stroke-width="1.3" stroke-linecap="round"/>
      <path d="M-22 -62C-28 -44-21 -24 0 -20C21 -24 28 -44 22 -62C12 -56-12 -56-22 -62Z" fill="url(#intro-petto)"/>
      <path d="${barre}" fill="none" stroke="#7a5230" stroke-width="1.3" stroke-linecap="round"/>
      <path d="M22 -100C32 -88 36 -62 24 -32" fill="none" stroke="#ffe6b0" stroke-opacity="0.5" stroke-width="2.2" stroke-linecap="round"/>
      <g class="intro-ali-chiuse">${ALA_CHIUSA}<g transform="scale(-1 1)">${ALA_CHIUSA}</g></g>
      <path d="M0 -66C-10 -60-33 -64-33 -84C-33 -100-14 -104 0 -94C14 -104 33 -100 33 -84C33 -64 10 -60 0 -66Z" fill="url(#intro-viso)" stroke="#3d2614" stroke-width="2.2"/>
      <path d="M-15 -97C-8 -94-3 -90 0 -82C3 -90 8 -94 15 -97C8 -99.5 3 -97 0 -92.5C-3 -97-8 -99.5-15 -97Z" fill="#f3e3c3"/>
      <path d="M-10 -68C-5 -64 5 -64 10 -68C6 -61-6 -61-10 -68Z" fill="#f6ead0"/>
      <g class="intro-palpebra">${occhio(-14)}${occhio(14)}<g class="intro-sguardo">${pupilla(-14)}${pupilla(14)}</g></g>
      <path d="M-28 -99C-20 -97-12 -94-4 -90M28 -99C20 -97 12 -94 4 -90" fill="none" stroke="#2e1a0b" stroke-width="3.4" stroke-linecap="round"/>
      <path d="M-27 -101C-19 -99-12 -96-6 -93M27 -101C19 -99 12 -96 6 -93" fill="none" stroke="#9a6534" stroke-width="1.2" stroke-linecap="round"/>
      <path d="M-4.5 -77C-4 -72-1.5 -67 0 -64.5C1.5 -67 4 -72 4.5 -77C2 -78.5-2 -78.5-4.5 -77Z" fill="#4a4540"/><path d="M-1.6 -75.5-0.4 -69" stroke="#8d8780" stroke-width="1" stroke-linecap="round"/>
      <g class="intro-zampe"><rect x="-14" y="-30" width="9" height="27" rx="4.5" fill="url(#intro-zampa)"/><rect x="5" y="-30" width="9" height="27" rx="4.5" fill="url(#intro-zampa)"/>
        <path d="M-12.5 -24h5M-12.5 -18h5M-12.5 -12h5M7.5 -24h5M7.5 -18h5M7.5 -12h5" stroke="#b39466" stroke-width="1.1"/></g>
    </g>`;
  }
  const ARTIGLI = [-9.5, 9.5].map(x => `<path d="M${x} -5L${x - 5} 2M${x} -5L${x} 4M${x} -5L${x + 5} 2" stroke="#b39b6a" stroke-width="3.2" stroke-linecap="round"/>
    <path d="M${x - 5} 2q-1.5 3 1 5.5M${x} 4q-1 3 1.5 5M${x + 5} 2q0 3 2.5 4.5" stroke="#241c16" stroke-width="1.8" fill="none" stroke-linecap="round"/>`).join('');
  // Il sacchetto di iuta, aperto e pieno di monete, con il bordo dove il gufo lo afferra in (0, 0): le monete fanno
  // luce sul bordo e sul tessuto intorno
  const SACCO = `<circle cx="0" cy="-2" r="40" fill="url(#intro-bagliore)" class="intro-bagliore"/>
    <ellipse cx="0" cy="1" rx="17" ry="5.5" fill="#4a3a24"/>
    <g fill="url(#intro-oro)" stroke="#9a6400" stroke-width="0.8"><ellipse cx="-8" cy="0" rx="5.6" ry="3.2"/><ellipse cx="7.5" cy="-0.5" rx="5.6" ry="3.2"/><ellipse cx="0" cy="-3.2" rx="5.6" ry="3.2"/><ellipse cx="-3" cy="2.6" rx="5.6" ry="3"/><ellipse cx="5" cy="2.8" rx="5.6" ry="3"/></g>
    <path d="M-1.4 -4.4q1.6 -1 3.4 -0.3M-9.6 -1.2q1.6 -1 3.4 -0.3M6 -1.6q1.6 -1 3.4 -0.3" stroke="#fff3b0" stroke-width="0.9" fill="none"/>
    <path d="M-18 1C-25 12-31 30-26 43C-21 52 21 52 26 43C31 30 25 12 18 1C12 7-12 7-18 1Z" fill="url(#intro-iuta)" stroke="#4a3a24" stroke-width="1"/>
    <path d="M-22 18 20 14M-25 28 25 25M-25 38 24 36M-12 8l-4 40M0 8v42M12 8l4 40" stroke="#6b5636" stroke-width="0.7" opacity="0.4"/>
    <path d="M-18 1C-25 12-31 30-26 43C-21 52 21 52 26 43C31 30 25 12 18 1C12 7-12 7-18 1Z" fill="url(#intro-iuta-ombra)"/>
    <path d="M-18 1C-25 12-31 30-26 43C-21 52 21 52 26 43C31 30 25 12 18 1C12 7-12 7-18 1Z" fill="url(#intro-iuta-luce)"/>
    <path d="M-19 0C-12 8 12 8 19 0C17 5 12 9.5 0 9.5C-12 9.5-17 5-19 0Z" fill="#d8c08c" stroke="#4a3a24" stroke-width="0.8"/>
    <path d="M-21 12C-10 17 10 17 21 12" fill="none" stroke="#5a4328" stroke-width="2.6" stroke-linecap="round"/>
    <path d="M12 14.5q3 6 1 12M12 14.5q-2 7-6 11" fill="none" stroke="#5a4328" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="14.5" r="2.4" fill="#4a3620"/>
    <g class="intro-luccichi" fill="#fffbe0">${stella4(-6, -6, 4)}${stella4(9, -3, 3.2)}</g>`;

  function scena() {
    seme = 20261023;
    // il cielo: stelle, e a destra la luna con il suo alone
    const stelle = [[208, 22, 1.2], [262, 44, 1.6], [318, 18, 1.1], [356, 58, 1.4], [402, 26, 1.2], [600, 64, 1.3], [222, 96, 1.1], [300, 88, 1.3],
      [380, 120, 1], [588, 116, 1.2], [250, 140, 1], [174, 70, 1.4], [440, 150, 1.1], [624, 130, 1], [130, 40, 1], [90, 110, 1.1], [540, 160, 0.9]];
    const STELLE = stelle.map(([x, y, r], i) => `<circle cx="${x}" cy="${y}" r="${r}"${i % 3 === 0 ? ` class="brilla" style="animation-delay:${c((i * 0.47) % 3)}s"` : ''}/>`).join('')
      + `<g class="brilla" style="animation-delay:1.1s">${stella4(286, 66, 6)}</g><g class="brilla" style="animation-delay:2.2s">${stella4(612, 92, 5)}</g><g class="brilla">${stella4(196, 120, 4.5)}</g>`;
    // i raggi della luna, che scendono a sinistra fra gli alberi
    let raggi = '';
    for (const [a, w] of [[204, 9], [214, 14], [226, 11], [238, 16], [250, 8]]) {
      const r = a * Math.PI / 180, L = 430, sx = 500, sy = 72;
      raggi += `<path d="M${sx} ${sy}L${c(sx + Math.cos(r - 0.02) * L)} ${c(sy + Math.sin(r - 0.02) * L)}L${c(sx + Math.cos(r + w / 300) * L)} ${c(sy + Math.sin(r + w / 300) * L)}Z"/>`;
    }
    // gli alberi lontani, nella foschia: più chiari e azzurri, sfocati (profondità)
    const LONTANE = ['intro-fo-lontana', 'intro-fo-lontana', 'intro-fo-lontana2'];
    let lontani = '';
    for (const [x, h, w] of [[96, 182, 7], [168, 150, 6], [250, 176, 7], [392, 150, 6], [446, 146, 8], [596, 168, 7], [330, 140, 5], [520, 136, 6]])
      lontani += tronco(x, h, w, 'intro-tronco-lontano') + ciuffo(x, 320 - h, 40, 60, LONTANE, 1.25, '#12404e');
    // gli alberi a metà, davanti alla foschia: tronchi scuri e chiome fitte
    const MEDIE = ['intro-fo-scura', 'intro-fo-media', 'intro-fo-scura', 'intro-fo-media2'];
    const medi = tronco(128, 226, 11, 'intro-tronco', true) + ciuffo(126, 96, 46, 60, MEDIE, 1.35, '#0b2f33') + ciuffo(176, 70, 30, 30, MEDIE, 1.3, '#0b2f33')
      + tronco(588, 232, 9, 'intro-tronco', true) + ciuffo(592, 118, 34, 38, MEDIE, 1.3, '#0b2f33');
    // i cespugli
    const CESPUGLI = ['intro-fo-media', 'intro-fo-media2', 'intro-fo-chiara', 'intro-fo-scura'];
    const cespugli = ciuffo(60, 268, 50, 60, CESPUGLI, 1.3, '#113f3a') + ciuffo(170, 278, 44, 44, CESPUGLI, 1.25, '#113f3a') + ciuffo(420, 278, 40, 40, CESPUGLI, 1.25, '#113f3a') + ciuffo(480, 262, 36, 34, CESPUGLI, 1.2, '#113f3a');
    // i due alberi che fanno da cornice, con le foglie in alto: in primo piano, un po' fuori fuoco
    const VICINE = ['intro-fo-scura', 'intro-fo-media', 'intro-fo-chiara', 'intro-fo-scura', 'intro-fo-media2'];
    const cornice = `<path d="M-14 330C6 262 26 214 20 160C15 112 26 70 56 34L70 44C44 74 36 112 42 158C49 214 42 266 40 330Z" fill="url(#intro-tronco-vicino)"/>
      <path d="M64 40C42 74 34 112 40 158C47 212 40 266 38 330" fill="none" stroke="#2a6a70" stroke-opacity="0.5" stroke-width="2.4"/>
      <path d="M22 120q4 16-2 34M30 200q4 22-2 46M14 262q6 20 0 44" fill="none" stroke="#000000" stroke-opacity="0.3" stroke-width="2.6" stroke-linecap="round"/>
      <path d="M50 44C86 26 130 18 176 20L175 26C132 26 92 34 58 54Z" fill="#071f26"/>
      <path d="M654 330C630 268 618 220 624 168C628 120 618 74 594 34L608 24C634 62 646 110 642 160C640 214 656 268 666 330Z" fill="url(#intro-tronco-vicino2)"/>
      <path d="M598 32C622 66 632 112 628 162C624 214 638 266 648 330" fill="none" stroke="#2a6a70" stroke-opacity="0.5" stroke-width="2.4"/>
      <path d="M628 130q-4 18 2 36M636 210q-4 22 2 44" fill="none" stroke="#000000" stroke-opacity="0.3" stroke-width="2.6" stroke-linecap="round"/>`
      + ciuffo(20, 14, 52, 84, VICINE, 1.45, '#071f26') + ciuffo(98, 8, 42, 58, VICINE, 1.4, '#071f26') + ciuffo(160, 14, 32, 36, VICINE, 1.3, '#071f26') + ciuffo(2, 92, 32, 36, VICINE, 1.35, '#071f26')
      + ciuffo(628, 12, 50, 74, VICINE, 1.45, '#071f26') + ciuffo(568, 2, 36, 42, VICINE, 1.35, '#071f26') + ciuffo(644, 100, 28, 30, VICINE, 1.35, '#071f26');
    // l'erba sul bordo della radura
    const ERBA = ['intro-fo-erba', 'intro-fo-erba2'];
    let erba = '';
    for (let i = 0; i < 54; i++) { const x = tra(150, 500); erba += foglia(x, 289 + Math.abs(x - 330) * 0.04 + tra(0, 4), tra(6, 13), tra(2, 3.2), tra(-25, 25), scegli(ERBA)); }
    // il ceppo: il lato verso la luna è chiaro, gli anelli in cima, le schegge dietro, il muschio
    const ceppo = `<path d="M560 214 566 188 574 206 584 178 592 202 604 192 607 216Z" fill="#3a2b27"/>
      <path d="M486 300C492 286 494 262 492 240C491 228 492 220 492 216H608C607 226 606 238 607 252C609 272 616 290 628 302L612 304C600 296 590 294 580 300L520 302C508 296 498 298 486 300Z" fill="url(#intro-ceppo)"/>
      <path d="M502 226C500 250 503 272 498 294M522 230C520 256 524 280 520 300M548 232C548 258 546 282 550 300M574 230C576 254 572 278 578 298M596 226C596 248 600 270 606 290" fill="none" stroke="#1d1412" stroke-opacity="0.8" stroke-width="2.2" stroke-linecap="round"/>
      <path d="M590 228C592 252 590 276 596 296" fill="none" stroke="#9a7a60" stroke-opacity="0.5" stroke-width="2.4" stroke-linecap="round"/>
      <ellipse cx="550" cy="216" rx="58" ry="11" fill="url(#intro-ceppo-cima)"/>
      <ellipse cx="550" cy="216" rx="45" ry="8.4" fill="none" stroke="#5e4738" stroke-width="1.2"/><ellipse cx="550" cy="216" rx="31" ry="5.8" fill="none" stroke="#5e4738" stroke-width="1.2"/><ellipse cx="550" cy="216" rx="17" ry="3.2" fill="none" stroke="#5e4738" stroke-width="1.2"/>
      <path d="M550 216 572 222" stroke="#4a372c" stroke-width="1.4"/>
      <path d="M492 218q6-8 15-5q6-7 15-3q2 5-6 9q-12 4-24-1ZM596 222q6-5 12-2q2 5-4 8q-6 1-8-6Z" fill="url(#intro-fo-chiara)"/>
      <path d="M486 300q8-10 20-6q8-6 16 0q-4 6-18 8ZM590 298q10-8 22-2q10-2 16 6q-14 4-38-4Z" fill="url(#intro-fo-media)"/>`;
    // tre funghi che brillano ai piedi del ceppo
    const funghi = [[478, 298, 1], [470, 302, 0.75], [488, 303, 0.6]].map(([x, y, s]) => `<g transform="translate(${x} ${y}) scale(${s})">
      <circle cx="0" cy="-10" r="16" fill="url(#intro-fungo)" class="intro-pulsa"/><path d="M-2 0V-8H2V0Z" fill="#efe2c8"/><path d="M-8 -8Q0 -18 8 -8Z" fill="#ffb56b"/><circle cx="-2.5" cy="-11.5" r="1.2" fill="#fff1d6"/><circle cx="3" cy="-10.5" r="0.9" fill="#fff1d6"/></g>`).join('');
    // le lucciole: un alone e un puntino vivo al centro (dietro e davanti al gufo)
    const lucciola = ([x, y, r, dx, dy, t, ritardo]) => `<g class="intro-lucciola" style="--x:${dx}px;--y:${dy}px;--t:${t}s;--d:-${ritardo}s"><circle cx="${x}" cy="${y}" r="${r}" fill="url(#intro-lucciola)"/><circle cx="${x}" cy="${y}" r="${c(r * 0.18)}" fill="#fbffd8"/></g>`;
    const LUCCIOLE_DIETRO = [[90, 180, 8, 14, -10, 7, 1], [210, 150, 7, -12, 8, 9, 3], [300, 120, 7, 10, 12, 8, 5], [380, 170, 8, -16, -6, 10, 2], [460, 140, 7, 12, -12, 7.5, 4],
      [150, 232, 8, 10, 8, 8.5, 6], [26, 238, 7, 12, -8, 9, 2.5], [612, 150, 7, -10, 10, 8, 1.5], [252, 212, 6, 8, -10, 6.5, 3.5], [340, 200, 6, -8, 10, 7.2, 0.8]].map(lucciola).join('');
    const LUCCIOLE_DAVANTI = [[120, 272, 10, -12, -10, 9, 0.5], [410, 250, 9, 14, -8, 8, 4.5], [470, 230, 8, -10, -12, 7, 2], [610, 246, 10, -14, -6, 9.5, 3], [262, 262, 8, 10, -10, 7.5, 6], [560, 290, 9, 12, -8, 8.2, 5.2]].map(lucciola).join('');
    // le felci davanti, ai due angoli
    const felci = felce(14, 324, 104, 42, -14, 'intro-fo-media', 'intro-fo-chiara') + felce(-4, 322, 90, 62, -10, 'intro-fo-scura', 'intro-fo-media') + felce(44, 326, 86, 18, 10, 'intro-fo-media', 'intro-fo-chiara')
      + felce(86, 328, 70, 34, 12, 'intro-fo-scura', 'intro-fo-chiara') + felce(30, 330, 64, -8, -8, 'intro-fo-media', 'intro-fo-media2')
      + felce(626, 324, 92, -40, 14, 'intro-fo-media', 'intro-fo-chiara') + felce(650, 322, 84, -62, 10, 'intro-fo-scura', 'intro-fo-media') + felce(596, 330, 66, -16, -10, 'intro-fo-media', 'intro-fo-chiara');
    // le monete che saltano dal sacchetto: disegnate dove cadono, il volo le porta lì dal bordo del sacchetto (330, 238)
    const cadute = [[280, 299, 30, -92], [360, 303, -6, -96], [398, 297, -26, -88], [298, 309, 18, -102]]
      .map(([x, y, px, py], i) => moneta(x, y, 'intro-moneta', `--x:${330 - x}px;--y:${238 - y}px;--px:${px}px;--py:${py}px;--g:${i % 2 ? -1 : 1}`)).join('');
    // le sfumature delle foglie: base scura, punta chiara (la luna le illumina da sopra)
    const sfFoglia = (id, base, punta) => `<linearGradient id="${id}" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="${base}"/><stop offset="1" stop-color="${punta}"/></linearGradient>`;

    return `<svg class="intro-disegno" viewBox="0 0 640 320" aria-hidden="true" focusable="false">
  <defs>
    <linearGradient id="intro-cielo" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#04101f"/><stop offset="0.5" stop-color="#0b2a4a"/><stop offset="1" stop-color="#1a5a6a"/></linearGradient>
    <linearGradient id="intro-nebbia" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7fc4d0" stop-opacity="0"/><stop offset="0.5" stop-color="#7fc4d0" stop-opacity="0.22"/><stop offset="1" stop-color="#7fc4d0" stop-opacity="0"/></linearGradient>
    <linearGradient id="intro-raggio" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff2b0" stop-opacity="0.26"/><stop offset="0.6" stop-color="#fff2b0" stop-opacity="0.06"/><stop offset="1" stop-color="#fff2b0" stop-opacity="0"/></linearGradient>
    <radialGradient id="intro-alone"><stop offset="0.25" stop-color="#ffe9a0" stop-opacity="0.45"/><stop offset="0.6" stop-color="#ffd66a" stop-opacity="0.12"/><stop offset="1" stop-color="#ffd66a" stop-opacity="0"/></radialGradient>
    <linearGradient id="intro-luna" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fffbe0"/><stop offset="0.5" stop-color="#ffe27a"/><stop offset="1" stop-color="#f0a92a"/></linearGradient>
    <radialGradient id="intro-lucciola"><stop offset="0" stop-color="#fbffc4"/><stop offset="0.2" stop-color="#e8ff7a" stop-opacity="0.9"/><stop offset="1" stop-color="#c8ff5a" stop-opacity="0"/></radialGradient>
    <radialGradient id="intro-fungo"><stop offset="0" stop-color="#ffc27a" stop-opacity="0.6"/><stop offset="1" stop-color="#ffc27a" stop-opacity="0"/></radialGradient>
    <radialGradient id="intro-bagliore"><stop offset="0.1" stop-color="#ffd84a" stop-opacity="0.7"/><stop offset="0.5" stop-color="#ffb52a" stop-opacity="0.2"/><stop offset="1" stop-color="#ffb52a" stop-opacity="0"/></radialGradient>
    <radialGradient id="intro-vignetta" cx="0.5" cy="0.45" r="0.72"><stop offset="0.55" stop-color="#000a18" stop-opacity="0"/><stop offset="1" stop-color="#000a18" stop-opacity="0.62"/></radialGradient>
    <radialGradient id="intro-oro" cx="0.38" cy="0.32" r="0.75"><stop offset="0" stop-color="#fff0a0"/><stop offset="0.55" stop-color="#f7b500"/><stop offset="1" stop-color="#c98200"/></radialGradient>
    <radialGradient id="intro-iride" cx="0.4" cy="0.35" r="0.7"><stop offset="0" stop-color="#fff2a0"/><stop offset="0.6" stop-color="#ffc21a"/><stop offset="1" stop-color="#e07b00"/></radialGradient>
    <radialGradient id="intro-corpo" cx="0.7" cy="0.25" r="0.9"><stop offset="0" stop-color="#b98455"/><stop offset="0.45" stop-color="#7d4f27"/><stop offset="1" stop-color="#3a2110"/></radialGradient>
    <radialGradient id="intro-petto" cx="0.65" cy="0.2" r="0.85"><stop offset="0" stop-color="#f3e1bc"/><stop offset="0.7" stop-color="#d9bd8e"/><stop offset="1" stop-color="#a98a5e"/></radialGradient>
    <radialGradient id="intro-viso" cx="0.6" cy="0.3" r="0.75"><stop offset="0" stop-color="#e0ab74"/><stop offset="0.7" stop-color="#c08750"/><stop offset="1" stop-color="#8e5e32"/></radialGradient>
    <linearGradient id="intro-zampa" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#b8996a"/><stop offset="0.5" stop-color="#e2c899"/><stop offset="1" stop-color="#a88a5c"/></linearGradient>
    <linearGradient id="intro-primaria" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d9b07a"/><stop offset="0.5" stop-color="#b17a45"/><stop offset="1" stop-color="#5c3819"/></linearGradient>
    <linearGradient id="intro-secondaria" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e2bd88"/><stop offset="0.55" stop-color="#bb8650"/><stop offset="1" stop-color="#6a4320"/></linearGradient>
    <linearGradient id="intro-copritrice" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#efd3a4"/><stop offset="1" stop-color="#9c6a3c"/></linearGradient>
    <linearGradient id="intro-ala-velo" x1="1" y1="0" x2="0" y2="0"><stop offset="0" stop-color="#1a0c03" stop-opacity="0.55"/><stop offset="0.35" stop-color="#1a0c03" stop-opacity="0.12"/><stop offset="1" stop-color="#ffe6b8" stop-opacity="0.14"/></linearGradient>
    <linearGradient id="intro-ala-chiusa" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#4e2f14"/><stop offset="1" stop-color="#8a5a2e"/></linearGradient>
    <linearGradient id="intro-iuta" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e6d5aa"/><stop offset="1" stop-color="#b09468"/></linearGradient>
    <linearGradient id="intro-iuta-ombra" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#2a1a08" stop-opacity="0.45"/><stop offset="0.45" stop-color="#2a1a08" stop-opacity="0"/><stop offset="1" stop-color="#2a1a08" stop-opacity="0.3"/></linearGradient>
    <radialGradient id="intro-iuta-luce" cx="0.5" cy="0.08" r="0.6"><stop offset="0" stop-color="#ffd54a" stop-opacity="0.55"/><stop offset="1" stop-color="#ffd54a" stop-opacity="0"/></radialGradient>
    <linearGradient id="intro-tronco-lontano" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#143f50"/><stop offset="1" stop-color="#1f5a6c"/></linearGradient>
    <linearGradient id="intro-tronco" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#061a20"/><stop offset="0.55" stop-color="#0d343c"/><stop offset="1" stop-color="#1a5660"/></linearGradient>
    <linearGradient id="intro-tronco-vicino" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#03141a"/><stop offset="0.6" stop-color="#082a30"/><stop offset="1" stop-color="#1b5a62"/></linearGradient>
    <linearGradient id="intro-tronco-vicino2" x1="1" y1="0" x2="0" y2="0"><stop offset="0" stop-color="#03141a"/><stop offset="0.6" stop-color="#082a30"/><stop offset="1" stop-color="#1b5a62"/></linearGradient>
    <linearGradient id="intro-ceppo" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#1e1512"/><stop offset="0.5" stop-color="#3b2e2b"/><stop offset="1" stop-color="#6a5347"/></linearGradient>
    <linearGradient id="intro-ceppo-cima" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#6b5040"/><stop offset="1" stop-color="#9c7c62"/></linearGradient>
    ${sfFoglia('intro-fo-lontana', '#12404e', '#2a7a86')}${sfFoglia('intro-fo-lontana2', '#164a58', '#3a8e96')}
    ${sfFoglia('intro-fo-scura', '#0b3236', '#1f6b5a')}${sfFoglia('intro-fo-media', '#134a44', '#2f8a66')}${sfFoglia('intro-fo-media2', '#176050', '#3aa072')}${sfFoglia('intro-fo-chiara', '#1e6354', '#5bbf86')}
    ${sfFoglia('intro-fo-erba', '#2a6a3c', '#5fb066')}${sfFoglia('intro-fo-erba2', '#246038', '#4a9a55')}
    <filter id="intro-sfoca-lontano" x="-5%" y="-5%" width="110%" height="110%"><feGaussianBlur stdDeviation="1.8"/></filter>
    <filter id="intro-sfoca-medio" x="-5%" y="-5%" width="110%" height="110%"><feGaussianBlur stdDeviation="0.6"/></filter>
    <filter id="intro-sfoca-vicino" x="-5%" y="-5%" width="110%" height="110%"><feGaussianBlur stdDeviation="0.9"/></filter>
    <filter id="intro-sfoca-raggi" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="6"/></filter>
    <filter id="intro-sfoca-luna" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="9"/></filter>
    <filter id="intro-ombra-gufo" x="-30%" y="-30%" width="160%" height="170%"><feDropShadow dx="-5" dy="9" stdDeviation="5" flood-color="#02101c" flood-opacity="0.55"/></filter>
  </defs>
  <g class="intro-strato intro-strato-cielo">
    <rect x="-20" y="-10" width="680" height="340" fill="url(#intro-cielo)"/>
    <g class="intro-stelle" fill="#d6ecff">${STELLE}</g>
    <circle cx="500" cy="72" r="150" fill="url(#intro-alone)"/>
    <circle cx="500" cy="72" r="60" fill="#ffe27a" opacity="0.55" filter="url(#intro-sfoca-luna)"/>
    <path d="M494.8 18.3A54 54 0 1 0 548.7 95.1A47 47 0 0 1 494.8 18.3Z" fill="url(#intro-luna)"/>
    <g fill="#d99a24" opacity="0.3"><circle cx="468" cy="80" r="6"/><circle cx="484" cy="106" r="4"/><circle cx="462" cy="54" r="3"/><circle cx="476" cy="34" r="2"/></g>
    <g class="intro-nuvole" fill="#2a5e86" opacity="0.55">
      <path d="M410 128c10-14 34-14 42-2c12-8 32-2 32 12c10 2 12 14 0 16h-78c-12-2-10-20 4-26Z"/>
      <path d="M196 158c8-10 26-10 32-1c9-6 24-1 24 9c8 2 9 11 0 12h-59c-9-2-8-15 3-20Z" opacity="0.7"/>
      <path d="M80 100c6-8 20-8 25-1c7-5 19-1 19 7c6 2 7 9 0 10h-46c-7-2-6-12 2-16Z" opacity="0.5"/>
    </g>
  </g>
  <g class="intro-strato intro-strato-lontano" filter="url(#intro-sfoca-lontano)">
    ${lontani}
    <rect x="-20" y="150" width="680" height="160" fill="url(#intro-nebbia)" class="intro-foschia"/>
  </g>
  <g class="intro-raggi" fill="url(#intro-raggio)" filter="url(#intro-sfoca-raggi)">${raggi}</g>
  <g class="intro-strato intro-strato-medio" filter="url(#intro-sfoca-medio)">
    ${medi}
    <path d="M-20 300C90 280 200 282 300 286C400 290 470 276 540 268C590 262 620 268 660 272V330H-20Z" fill="#0d2c28"/>
    ${cespugli}
    ${LUCCIOLE_DIETRO}
  </g>
  <g class="intro-strato intro-strato-terra">
    <path d="M120 330C170 300 240 290 330 290C420 290 470 296 520 308L540 330Z" fill="#1b4a34"/>
    <path d="M150 306C200 294 260 289 330 289C410 289 460 294 505 304" fill="none" stroke="#47995a" stroke-width="2.5" opacity="0.8"/>
    <ellipse cx="330" cy="292" rx="150" ry="22" fill="url(#intro-bagliore)" opacity="0.35" class="intro-ombra-terra"/>
    ${erba}
    <ellipse class="intro-ombra-volo" cx="330" cy="293" rx="46" ry="7" fill="#031410"/>
    <ellipse class="intro-ombra-terra" cx="330" cy="292" rx="26" ry="4.5" fill="#031410" opacity="0.5"/>
    ${moneta(288, 297)}${moneta(374, 300)}
    ${ceppo}
    ${funghi}
    <ellipse class="intro-ombra-ceppo" cx="550" cy="219" rx="28" ry="5" fill="#1e1410" opacity="0.6"/>
    <g transform="translate(550 169)">
      <g class="intro-insieme">
        <g class="intro-volo">${gufo()}</g>
        <g class="intro-sacco">${SACCO}</g>
        <g class="intro-volo"><g class="intro-artigli">${ARTIGLI}</g></g>
      </g>
    </g>
    <g class="intro-monete">${cadute}</g>
  </g>
  <g class="intro-strato intro-strato-vicino" filter="url(#intro-sfoca-vicino)">
    ${cornice}
    ${felci}
    ${LUCCIOLE_DAVANTI}
  </g>
  <rect x="-20" y="-10" width="680" height="340" fill="url(#intro-vignetta)" pointer-events="none"/>
  <g class="intro-scintille" fill="#fff3bf">${stella4(500, 196, 7)}${stella4(604, 178, 6)}${stella4(600, 224, 5)}</g>
</svg>`;
  }

  let disegno = null;   // la scena si costruisce una volta sola
  let vista = false;    // la prima volta in questa apertura della pagina si anima, poi resta ferma alla fine
  const movimento = () => !matchMedia('(prefers-reduced-motion: reduce)').matches;
  function crea() {
    const intro = document.createElement('div');
    intro.className = 'intro' + (vista ? '' : ' in-volo');
    intro.title = 'Clic per rivedere il volo del gufo';
    intro.innerHTML = `<div class="intro-scena">${disegno || (disegno = scena())}</div>
      <div class="intro-testo"><p class="intro-nome">Occhio alla <span>Rata</span></p><p class="intro-motto">Tiene d'occhio le rate del tuo mutuo o finanziamento, al centesimo.</p></div>`;
    intro.addEventListener('click', () => { intro.classList.remove('in-volo'); void intro.offsetWidth; intro.classList.add('in-volo'); });
    // Parallasse: i piani del bosco seguono il mouse (--mx e --my da -1 a 1; stile.css li sposta in misura diversa)
    intro.addEventListener('pointermove', evento => {
      if (!movimento() || evento.pointerType === 'touch') return;
      const r = intro.getBoundingClientRect();
      intro.style.setProperty('--mx', (((evento.clientX - r.left) / r.width) * 2 - 1).toFixed(3));
      intro.style.setProperty('--my', (((evento.clientY - r.top) / r.height) * 2 - 1).toFixed(3));
    });
    intro.addEventListener('pointerleave', () => { intro.style.removeProperty('--mx'); intro.style.removeProperty('--my'); });
    vista = true;
    return intro;
  }
  window.Intro = { crea };
})();
