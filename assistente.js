// L'assistente: un piccolo robot con il fumetto. Nella configurazione guidata dice, a ogni pagina, che cosa serve e
// come stanno andando i conti (configura.js gli passa le frasi); in cima alle schede del programma dà un consiglio
// sulla pagina aperta, e si può richiudere (resta solo la testa, che lo riapre).
// Umori: 'parla' (il testo si scrive e la bocca si muove), 'pensa' (occhi in alto e nuvoletta: sta calcolando),
// 'felice' (occhi a mezzaluna e un saltello), 'dubbio' (testa inclinata).
// Con «riduci movimento» nelle impostazioni del sistema resta fermo e il testo compare tutto insieme.
// Se la pagina scorre oltre, l'assistente la segue nell'angolo in basso: resta la testa, e il fumetto compare quando
// ha qualcosa da dire. Passando con il mouse (o arrivando con la tastiera) su una cosa importante, la spiega
// (i testi sono in spiegazioni.js); poco dopo torna al suo messaggio. Le due cose si spengono nelle impostazioni
// (temi.js: «Spiega le cose…», «Ti segue…»).
(function () {
  'use strict';
  const M = window.Mutuo, { $, crea, euro, meseAnno } = M;
  const UMORI = ['parla', 'pensa', 'felice', 'dubbio'];
  // Gli aspetti del robottino, da scegliere nelle impostazioni (chiave «avatar» nel browser), ispirati ai robot famosi
  // senza copiarli. Ognuno ha le parti che servono agli umori: .occhi (sbattono; in «pensa» guardano in alto),
  // .occhi-felici, .bocca e .bocca-aperta (mentre scrive), e i colori del tema con le classi testa, viso, orecchio,
  // antenna, antenna-luce, guancia (stile.css) o con style="…var(--accento)…". Occhi e bocca hanno il colore --tratto:
  // quello del testo, ma scuro fisso sui robottini con il viso bianco. La nuvoletta di «pensa» è uguale per tutti.
  const S = 'style', ACC = 'fill:var(--accento)', SUP = 'fill:var(--superficie)', BORDO = 'stroke:var(--accento);stroke-width:1.8';
  const AVATAR = [
    { codice: 'robottino', nome: 'Robottino', descrizione: 'Il robottino di sempre: testa tonda e antenna con la luce.', disegno: `
      <line class="antenna" x1="32" y1="14" x2="32" y2="7"/><circle class="antenna-luce" cx="32" cy="5.5" r="3.2"/>
      <rect class="orecchio" x="5" y="27" width="6" height="12" rx="3"/><rect class="orecchio" x="53" y="27" width="6" height="12" rx="3"/>
      <rect class="testa" x="10" y="13" width="44" height="38" rx="15"/>
      <rect class="viso" x="16" y="19" width="32" height="26" rx="10"/>
      <g class="occhi"><ellipse cx="25.5" cy="30" rx="3.6" ry="4.4"/><ellipse cx="38.5" cy="30" rx="3.6" ry="4.4"/></g>
      <path class="occhi-felici" d="M21.5 31q4-5 8 0M34.5 31q4-5 8 0"/>
      <path class="bocca" d="M27 38.5q5 4 10 0"/><ellipse class="bocca-aperta" cx="32" cy="39" rx="4" ry="2.6"/>
      <circle class="guancia" cx="20.5" cy="37.5" r="2.2"/><circle class="guancia" cx="43.5" cy="37.5" r="2.2"/>` },
    { codice: 'cupolino', nome: 'Cupolino', descrizione: 'Una cupola con un solo grande occhio, come i robottini delle guerre fra le stelle.', disegno: `
      <rect class="orecchio" x="6.5" y="33" width="6" height="21" rx="2"/><rect class="orecchio" x="51.5" y="33" width="6" height="21" rx="2"/>
      <rect x="14.5" y="31" width="35" height="23" rx="3" ${S}="${SUP};${BORDO}"/>
      <path d="M21.5 35v15M42.5 35v15" ${S}="stroke:var(--accento);stroke-width:3.2;stroke-linecap:round"/>
      <path d="M14 31a18 18 0 0 1 36 0Z" ${S}="${SUP};${BORDO}"/>
      <path d="M18 26.5h6v-4.5h-4.3M40 22h4.3l1.7 4.5h-6Z" ${S}="${ACC}"/>
      <circle cx="32" cy="21" r="6" ${S}="fill:none;${BORDO}"/>
      <g class="occhi"><ellipse cx="32" cy="21" rx="4" ry="4"/></g>
      <path class="occhi-felici" d="M28 22.5q4-5 8 0"/>
      <circle cx="41.5" cy="26.5" r="1.5" fill="#e03131"/>
      <path class="bocca" d="M28 42h8"/><ellipse class="bocca-aperta" cx="32" cy="42" rx="4.5" ry="2.2"/>` },
    { codice: 'cingolino', nome: 'Cingolino', descrizione: 'Occhi a binocolo e cingoli: un piccolo robot spazzino, curioso di tutto.', disegno: `
      <rect class="orecchio" x="29.5" y="21" width="5" height="8" rx="1.5"/>
      <rect class="orecchio" x="15" y="10" width="16" height="14" rx="6"/><rect class="orecchio" x="33" y="10" width="16" height="14" rx="6"/>
      <circle cx="23" cy="17" r="5.2" ${S}="${SUP}"/><circle cx="41" cy="17" r="5.2" ${S}="${SUP}"/>
      <g class="occhi"><ellipse cx="23.5" cy="17.5" rx="3.2" ry="3.2"/><ellipse cx="40.5" cy="17.5" rx="3.2" ry="3.2"/></g>
      <path class="occhi-felici" d="M19.5 18.5q3.5-4 7 0M37.5 18.5q3.5-4 7 0"/>
      <rect class="testa" x="13" y="28" width="38" height="20" rx="3"/>
      <rect class="viso" x="18.5" y="31.5" width="27" height="12" rx="2"/>
      <path class="bocca" d="M26 37.5h12"/><ellipse class="bocca-aperta" cx="32" cy="37.5" rx="5" ry="2.4"/>
      <rect x="8" y="46" width="48" height="10" rx="5" ${S}="fill:var(--tratto);opacity:0.85"/>
      <g ${S}="${SUP}"><circle cx="14" cy="51" r="2.6"/><circle cx="25" cy="51" r="2.6"/><circle cx="39" cy="51" r="2.6"/><circle cx="50" cy="51" r="2.6"/></g>` },
    { codice: 'ovetto', nome: 'Ovetto', descrizione: 'Bianco e liscio, con gli occhi di luce: vola leggero.', disegno: `
      <path d="M21.5 42c0-3 4.7-4.5 10.5-4.5s10.5 1.5 10.5 4.5c0 8-4.5 15-10.5 15s-10.5-7-10.5-15Z" ${S}="fill:#ffffff;${BORDO}"/>
      <ellipse cx="19.5" cy="46" rx="3" ry="7.5" transform="rotate(10 19.5 46)" ${S}="fill:#ffffff;${BORDO}"/>
      <ellipse cx="44.5" cy="46" rx="3" ry="7.5" transform="rotate(-10 44.5 46)" ${S}="fill:#ffffff;${BORDO}"/>
      <ellipse cx="32" cy="23" rx="17.5" ry="14" ${S}="fill:#ffffff;${BORDO}"/>
      <ellipse cx="32" cy="24.5" rx="13.5" ry="8.5" fill="#14142b"/>
      <g class="occhi"><ellipse cx="26" cy="24.5" rx="4" ry="2.8" ${S}="fill:#5ec8ff"/><ellipse cx="38" cy="24.5" rx="4" ry="2.8" ${S}="fill:#5ec8ff"/></g>
      <path class="occhi-felici" d="M22.5 26q3.5-4.5 7 0M34.5 26q3.5-4.5 7 0" ${S}="stroke:#5ec8ff"/>
      <path class="bocca" d="M30.5 30h3" ${S}="stroke:#5ec8ff;opacity:0.7"/><ellipse class="bocca-aperta" cx="32" cy="30" rx="2.2" ry="1.1" ${S}="fill:#5ec8ff"/>` },
    { codice: 'sfera', nome: 'Sfera', descrizione: 'Rotola su una palla, con la testa a cupola e l\'antenna sottile.', disegno: `
      <circle cx="32" cy="45.5" r="14" ${S}="fill:#ffffff;${BORDO}"/>
      <circle cx="32" cy="45.5" r="7" ${S}="fill:none;stroke:var(--accento);stroke-width:3.4"/>
      <path d="M18.5 41.9A14 14 0 0 1 24 34M45.5 41.9A14 14 0 0 0 40 34M25 57.6A14 14 0 0 0 39 57.6" ${S}="fill:none;stroke:var(--accento);stroke-width:3.2"/>
      <line class="antenna" x1="39" y1="20" x2="39" y2="12"/><circle class="antenna-luce" cx="39" cy="11" r="1.8"/>
      <path d="M18 30a14 12 0 0 1 28 0Z" ${S}="fill:#ffffff;${BORDO}"/>
      <path d="M23.5 20.5h17" ${S}="stroke:var(--accento);stroke-width:2"/>
      <circle cx="28.5" cy="25.3" r="4.2" ${S}="fill:#ffffff;stroke:var(--tratto);stroke-width:1.4"/>
      <g class="occhi"><ellipse cx="28.5" cy="25.3" rx="2.5" ry="2.5"/></g>
      <path class="occhi-felici" d="M25.5 26.3q3-3.8 6 0"/>
      <circle cx="37" cy="24.8" r="1.5" ${S}="fill:var(--tratto)"/>
      <path class="bocca" d="M35 28.2h3.6"/><ellipse class="bocca-aperta" cx="36.8" cy="28.2" rx="2" ry="1.1"/>` },
    { codice: 'gigante', nome: 'Gigante buono', descrizione: 'Tondo, bianco e gentile: un assistente da abbracciare.', disegno: `
      <path d="M6 64c2-14 13-21 26-21s24 7 26 21Z" ${S}="fill:#ffffff;${BORDO}"/>
      <ellipse cx="32" cy="29" rx="22" ry="16.5" ${S}="fill:#ffffff;${BORDO}"/>
      <path d="M25 29h14" ${S}="stroke:var(--tratto);stroke-width:2.2"/>
      <g class="occhi"><ellipse cx="22" cy="29" rx="3.6" ry="3.6"/><ellipse cx="42" cy="29" rx="3.6" ry="3.6"/></g>
      <path class="occhi-felici" d="M18 30.5q4-5 8 0M38 30.5q4-5 8 0"/>
      <path class="bocca" d="M29.5 37.5q2.5 1.6 5 0"/><ellipse class="bocca-aperta" cx="32" cy="37.8" rx="2.6" ry="1.6"/>
      <circle class="guancia" cx="16.5" cy="35.5" r="2.2"/><circle class="guancia" cx="47.5" cy="35.5" r="2.2"/>` },
    { codice: 'latta', nome: 'Latta', descrizione: 'Il robot di latta dei vecchi giocattoli, con i bulloni e la griglia.', disegno: `
      <line class="antenna" x1="32" y1="14" x2="32" y2="7.5"/><circle class="antenna-luce" cx="32" cy="6" r="3"/>
      <circle class="orecchio" cx="9" cy="31" r="4"/><circle class="orecchio" cx="55" cy="31" r="4"/>
      <rect class="testa" x="11.5" y="13.5" width="41" height="35" rx="5"/>
      <g class="orecchio"><circle cx="15.5" cy="17.5" r="1.4"/><circle cx="48.5" cy="17.5" r="1.4"/><circle cx="15.5" cy="44.5" r="1.4"/><circle cx="48.5" cy="44.5" r="1.4"/></g>
      <rect class="viso" x="17" y="19" width="30" height="24.5" rx="4"/>
      <circle cx="25" cy="27.5" r="5.4" ${S}="fill:none;${BORDO}"/><circle cx="39" cy="27.5" r="5.4" ${S}="fill:none;${BORDO}"/>
      <g class="occhi"><ellipse cx="25" cy="27.5" rx="3.2" ry="3.2"/><ellipse cx="39" cy="27.5" rx="3.2" ry="3.2"/></g>
      <path class="occhi-felici" d="M21.5 28.5q3.5-4 7 0M35.5 28.5q3.5-4 7 0"/>
      <rect x="22.5" y="35" width="19" height="6" rx="1.5" ${S}="fill:none;stroke:var(--tratto);stroke-width:1.6"/>
      <path class="bocca" d="M26.5 35v6M30.5 35v6M34.5 35v6M38.5 35v6"/><ellipse class="bocca-aperta" cx="32" cy="38" rx="7.5" ry="2.4"/>` },
    { codice: 'visiera', nome: 'Visiera', descrizione: 'Testa a cilindro, visiera scura e antenna: un po\' sbruffone, ma di cuore.', disegno: `
      <line class="antenna" x1="32" y1="12" x2="32" y2="5.5"/><circle class="antenna-luce" cx="32" cy="4.5" r="2.6"/>
      <path class="testa" d="M16 56V25a16 13 0 0 1 32 0v31Z"/>
      <rect x="14.5" y="21.5" width="35" height="13" rx="6.5" fill="#1b1b2e"/>
      <g class="occhi"><ellipse cx="25" cy="28" rx="4.4" ry="3.8" ${S}="fill:#ffffff"/><ellipse cx="39" cy="28" rx="4.4" ry="3.8" ${S}="fill:#ffffff"/>
        <ellipse cx="25" cy="28" rx="1.5" ry="1.5" ${S}="fill:#111111"/><ellipse cx="39" cy="28" rx="1.5" ry="1.5" ${S}="fill:#111111"/></g>
      <path class="occhi-felici" d="M21 29.5q4-5 8 0M35 29.5q4-5 8 0" ${S}="stroke:#ffffff"/>
      <rect class="viso" x="21" y="40" width="22" height="9" rx="3"/>
      <path class="bocca" d="M25.5 40v9M29.5 40v9M34.5 40v9M38.5 40v9M21 44.5h22"/><ellipse class="bocca-aperta" cx="32" cy="44.5" rx="8" ry="3"/>` },
    { codice: 'gattobot', nome: 'Gattobot', descrizione: 'Un gatto robot con i baffi, il naso rosso e il campanello.', disegno: `
      <path class="testa" d="M15 25 17.5 9.5l10 8.5ZM49 25 46.5 9.5l-10 8.5Z"/>
      <circle class="testa" cx="32" cy="32" r="20.5"/>
      <ellipse cx="32" cy="36.5" rx="16" ry="14" fill="#ffffff"/>
      <ellipse cx="27.5" cy="24.5" rx="4.8" ry="5.8" ${S}="fill:#ffffff;stroke:var(--tratto);stroke-width:1.2"/>
      <ellipse cx="36.5" cy="24.5" rx="4.8" ry="5.8" ${S}="fill:#ffffff;stroke:var(--tratto);stroke-width:1.2"/>
      <g class="occhi"><ellipse cx="29" cy="25.5" rx="1.7" ry="2.3"/><ellipse cx="35" cy="25.5" rx="1.7" ry="2.3"/></g>
      <path class="occhi-felici" d="M25.5 26.5q2.5-3.5 5 0M33.5 26.5q2.5-3.5 5 0"/>
      <circle cx="32" cy="31.5" r="2.6" fill="#e03131"/>
      <path d="M32 34v5.5M13.5 33.5l9 1.8M13.5 38.5h9M50.5 33.5l-9 1.8M50.5 38.5h-9" ${S}="stroke:var(--tratto);stroke-width:1.3;stroke-linecap:round"/>
      <path class="bocca" d="M24.5 40q7.5 6 15 0"/><ellipse class="bocca-aperta" cx="32" cy="42.5" rx="5" ry="3"/>
      <rect x="17" y="50" width="30" height="4.5" rx="2.2" fill="#e03131"/>
      <circle cx="32" cy="56" r="3.2" fill="#f7b500"/><path d="M29.5 55.5h5" stroke="#8a5a00" stroke-width="1"/>` },
    { codice: 'gufobot', nome: 'Gufobot', descrizione: 'Un gufo meccanico, parente del logo del progetto.', disegno: `
      <path class="testa" d="M14 19 17.5 8l8.5 6.5h12L46.5 8 50 19v25a12 12 0 0 1-12 12H26a12 12 0 0 1-12-12Z"/>
      <circle class="viso" cx="24.5" cy="29" r="8.2"/><circle class="viso" cx="39.5" cy="29" r="8.2"/>
      <circle cx="24.5" cy="29" r="5.6" fill="none" stroke="#f7b500" stroke-width="1.8"/><circle cx="39.5" cy="29" r="5.6" fill="none" stroke="#f7b500" stroke-width="1.8"/>
      <g class="occhi"><ellipse cx="24.5" cy="29" rx="3.4" ry="3.4"/><ellipse cx="39.5" cy="29" rx="3.4" ry="3.4"/></g>
      <path class="occhi-felici" d="M20.5 30q4-5 8 0M35.5 30q4-5 8 0"/>
      <path d="M29.8 36h4.4L32 40.6Z" fill="#f7b500"/>
      <path class="bocca" d="M28.5 45q3.5 2.6 7 0"/><ellipse class="bocca-aperta" cx="32" cy="45.5" rx="3" ry="1.9"/>
      <g class="orecchio"><circle cx="19" cy="47" r="1.6"/><circle cx="45" cy="47" r="1.6"/></g>` },
    { codice: 'pixel', nome: 'Pixel', descrizione: 'Un robot a quadretti, come nei videogiochi di una volta.', disegno: `
      <rect class="antenna-luce" x="29" y="4" width="6" height="5"/><rect class="orecchio" x="30.5" y="9" width="3" height="7"/>
      <rect class="orecchio" x="7" y="26" width="5" height="12"/><rect class="orecchio" x="52" y="26" width="5" height="12"/>
      <rect class="testa" x="12" y="16" width="40" height="32"/>
      <rect class="viso" x="17" y="21" width="30" height="22"/>
      <g class="occhi"><rect x="22" y="26" width="6" height="6"/><rect x="36" y="26" width="6" height="6"/></g>
      <path class="occhi-felici" d="M21.5 31v-3h2v-2h3v2h2v3M35.5 31v-3h2v-2h3v2h2v3" stroke-linecap="square"/>
      <path class="bocca" d="M25 37.5h14" stroke-linecap="square"/><ellipse class="bocca-aperta" cx="32" cy="38" rx="6" ry="2.4"/>
      <g class="orecchio"><rect x="14" y="51" width="8" height="5"/><rect x="42" y="51" width="8" height="5"/></g>` },
  ];
  const NUVOLETTA = '<g class="nuvoletta"><circle cx="53" cy="11" r="2"/><circle cx="58.5" cy="5.5" r="2.8"/></g>';
  const leggiAvatar = () => { try { return localStorage.getItem('avatar'); } catch { return null; } };
  let avatarScelto = AVATAR.some(a => a.codice === leggiAvatar()) ? leggiAvatar() : 'robottino';
  const disegnoAvatar = (codice = avatarScelto) => {
    const a = AVATAR.find(x => x.codice === codice) || AVATAR[0];
    return `<svg class="robot robot-${a.codice}" viewBox="0 0 64 64" aria-hidden="true"><g class="corpo">${a.disegno}</g>${NUVOLETTA}</svg>`;
  };
  // Cambia l'aspetto di tutti gli assistenti della pagina (non delle anteprime nelle impostazioni).
  function scegliAvatar(codice) {
    if (!AVATAR.some(a => a.codice === codice)) return;
    avatarScelto = codice;
    try { localStorage.setItem('avatar', codice); } catch { /* vale solo per questa volta */ }
    for (const avatar of document.querySelectorAll('.assistente .avatar')) avatar.innerHTML = disegnoAvatar();
    for (const pulsante of document.querySelectorAll('[data-scelta-avatar]')) pulsante.setAttribute('aria-pressed', String(pulsante.dataset.sceltaAvatar === codice));
  }
  const fermo = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const vuole = codice => !window.Temi || Temi.opzione(codice);   // scelte delle impostazioni: 'spiega', 'segue'

  function nuovo(classe = '') {
    const el = crea('div', { className: 'assistente ' + classe });
    el.innerHTML = `<div class="avatar">${disegnoAvatar()}</div><div class="parole"><p class="scritto" aria-hidden="true"></p><span class="solo-lettori" aria-live="polite"></span></div>`;
    return el;
  }
  // Scrive un testo nel fumetto, lettera per lettera (tutto insieme con «subito» o con «riduci movimento»).
  // Lo stesso testo di prima non si riscrive (cambia solo l'umore): allora restituisce false.
  function scrivi(el, testo, umore, { veloce = false, subito = false } = {}) {
    for (const u of UMORI) el.classList.toggle(u, u === umore);
    if (el.dataset.testo === testo) return false;
    el.dataset.testo = testo;
    $('.solo-lettori', el).textContent = testo;
    const scritto = $('.scritto', el);
    clearInterval(el._scrittura);
    if (subito || fermo()) { scritto.textContent = testo; el.classList.remove('scrive'); return true; }
    M.rianima($('.parole', el), 'appena-detto');
    scritto.textContent = '';
    el.classList.add('scrive');
    let i = 0;
    el._scrittura = setInterval(() => {
      i = Math.min(testo.length, i + (veloce ? 4 : 2));
      scritto.textContent = testo.slice(0, i);
      if (i >= testo.length) { clearInterval(el._scrittura); el.classList.remove('scrive'); }
    }, 22);
    return true;
  }
  // Il messaggio dell'assistente per la pagina: quello a cui torna dopo aver spiegato una cosa.
  function dici(el, testo, umore = 'parla') {
    const prima = el._detto;
    el._detto = [testo, umore];
    if (el._spiega) {
      if (prima && prima[0] === testo) return;   // sta spiegando e il messaggio non è cambiato: lo dirà dopo
      smettiDiSpiegare(el);
    }
    if (scrivi(el, testo, umore)) mostraParole(el);
  }
  // Una spiegazione al passaggio del mouse: resta finché si è sopra, poi (torna) l'assistente riprende il suo messaggio.
  function spiega(el, testo) {
    clearTimeout(el._torna);
    el._torna = null;
    el._spiega = true;
    el.classList.add('spiega');
    sovrapponi(el, true);
    if (scrivi(el, testo, 'parla', { veloce: true }) || el.classList.contains('zitto')) mostraParole(el);
  }
  function smettiDiSpiegare(el) {
    clearTimeout(el._torna);
    el._torna = null;
    el._spiega = false;
    el._spiegato = null;
    el.classList.remove('spiega');
    sovrapponi(el, false);
  }
  function torna(el, attesa = 2500) {
    if (!el._spiega || el._torna) return;
    el._torna = setTimeout(() => {
      const [testo, umore] = el._detto || ['', 'parla'];
      // Il messaggio è già stato detto: torna tutto insieme, e mentre segue la pagina resta solo la testa.
      if (el.classList.contains('segue')) el.classList.add('zitto');
      scrivi(el, testo, umore, { subito: true });
      smettiDiSpiegare(el);
    }, attesa);
  }
  // Al suo posto in cima alla pagina, la spiegazione si apre sopra il resto invece di spingerlo in giù: così la
  // cosa sotto il mouse non si sposta (e non ne arriva un'altra da spiegare). Il segnaposto tiene l'altezza di prima.
  function sovrapponi(el, si) {
    const posto = el.parentElement;
    if (!posto || !posto.classList.contains('posto-assistente')) return;
    si = si && !el.classList.contains('segue');
    if (si === el.classList.contains('sovrapposto')) return;
    if (si) posto.style.height = posto.offsetHeight + 'px';
    else if (!el.classList.contains('segue')) posto.style.height = '';
    el.classList.toggle('sovrapposto', si);
  }

  // ---------- Segue la pagina ----------
  // Ogni assistente sta in un segnaposto: quando il segnaposto esce dallo schermo in alto (sotto la testata),
  // l'assistente passa nell'angolo in basso (classe «segue») e il segnaposto tiene il suo spazio, così la pagina
  // non salta. Seguendo, il fumetto compare solo quando c'è qualcosa da dire e si richiude da solo («zitto»);
  // un clic sulla testa lo riapre o lo richiude.
  const seguiti = [];
  function segui(el, zona = null) {
    const posto = crea('div', { className: 'posto-assistente' });
    el.before(posto);
    posto.append(el);
    el._zona = zona;   // le spiegazioni dentro questa zona le dà lui (null: tutte le altre)
    seguiti.push(el);
    new IntersectionObserver(([voce]) => {
      const r = voce.boundingClientRect, cima = voce.rootBounds ? voce.rootBounds.top : 0;
      el._sopra = r.height > 0 && !voce.isIntersecting && r.bottom <= cima + 1;
      aggiornaSegue(el);
    }, { rootMargin: '-64px 0px 0px 0px' }).observe(posto);
    $('.avatar', el).addEventListener('click', () => {
      if (!el.classList.contains('segue')) return;
      if (el.classList.contains('zitto')) mostraParole(el); else taci(el, true);
    });
    el.addEventListener('mouseleave', () => {
      if (!el.classList.contains('segue') || el.classList.contains('zitto')) return;
      clearTimeout(el._zitto);
      el._zitto = setTimeout(() => taci(el), 2500);
    });
  }
  function aggiornaSegue(el) {
    const segue = !!el._sopra && !el.classList.contains('richiuso') && vuole('segue');
    if (segue === el.classList.contains('segue')) return;
    const posto = el.parentElement;
    clearTimeout(el._zitto);
    if (segue) {
      posto.style.height = posto.offsetHeight + 'px';
      el.classList.remove('sovrapposto');
      el.classList.add('segue', 'zitto');
      spazioSotto();
    } else {
      el.classList.remove('segue', 'zitto');
      // Se sta spiegando, al suo posto la spiegazione resta sopra la pagina; altrimenti il segnaposto torna libero.
      if (el._spiega) el.classList.add('sovrapposto'); else posto.style.height = '';
    }
  }
  // Seguendo, il fumetto resta aperto il tempo di leggerlo (più a lungo se il testo è lungo, e finché c'è sopra il mouse).
  function mostraParole(el) {
    el.classList.remove('zitto');
    clearTimeout(el._zitto);
    if (el.classList.contains('segue')) el._zitto = setTimeout(() => taci(el), Math.max(7000, (el.dataset.testo || '').length * 65));
  }
  function taci(el, subito = false) {
    clearTimeout(el._zitto);
    if (!subito && (el.matches(':hover') || el._spiega)) { el._zitto = setTimeout(() => taci(el), 2000); return; }
    if (el._spiega) torna(el, 0);
    el.classList.add('zitto');
  }
  // Sui telefoni in basso c'è la barra delle schede (nella guida, quella dei pulsanti): l'assistente le resta sopra.
  function spazioSotto() {
    let sotto = 0;
    for (const barra of document.querySelectorAll('.schede, .azioni-guida')) {
      const r = barra.getBoundingClientRect(), posizione = getComputedStyle(barra).position;
      if (r.height && (posizione === 'fixed' || posizione === 'sticky') && r.bottom >= innerHeight - 2 && r.top < innerHeight) sotto = Math.max(sotto, innerHeight - r.top);
    }
    document.documentElement.style.setProperty('--sotto-assistente', Math.round(sotto) + 'px');
  }
  let rinfresco = 0;
  const allaFine = () => {
    if (rinfresco || !seguiti.some(el => el.classList.contains('segue'))) return;
    rinfresco = requestAnimationFrame(() => { rinfresco = 0; spazioSotto(); });
  };
  addEventListener('scroll', allaFine, { passive: true });
  document.addEventListener('cambio-assistente', () => { for (const el of seguiti) { if (!vuole('spiega')) torna(el, 0); aggiornaSegue(el); } });
  addEventListener('resize', allaFine);

  // ---------- Spiega le cose al passaggio del mouse ----------
  // Si aspetta un attimo (chi muove il mouse di passaggio non fa parlare l'assistente); con la tastiera (Tab) la
  // spiegazione arriva subito. Sopra l'assistente stesso il fumetto resta com'è, così si può leggere con calma.
  const assistentePer = bersaglio => seguiti.find(el => el._zona && el._zona.contains(bersaglio)) || seguiti.find(el => !el._zona);
  const puoParlare = el => el.getClientRects().length > 0 && !el.classList.contains('richiuso');
  function guarda(bersaglio) {
    if (!(bersaglio instanceof Element) || !window.Spiegazioni) return;
    if (bersaglio.closest('.assistente')) { for (const el of seguiti) { clearTimeout(el._torna); el._torna = null; } return; }
    const trovato = !vuole('spiega') || bersaglio.closest('[role="dialog"], dialog') ? null : Spiegazioni.trova(bersaglio);
    const chi = trovato && assistentePer(bersaglio);
    for (const el of seguiti) if (el !== chi) torna(el);
    if (!chi) return;
    if (!puoParlare(chi)) return;
    if (chi._spiega && chi._spiegato === trovato.el && chi.dataset.testo === trovato.testo) { clearTimeout(chi._torna); chi._torna = null; return; }
    spiega(chi, trovato.testo);
    chi._spiegato = trovato.el;
  }
  let attesa = 0, daTastiera = false;
  document.addEventListener('mouseover', evento => {
    clearTimeout(attesa);
    attesa = setTimeout(() => guarda(evento.target), 350);
  });
  document.addEventListener('keydown', evento => { if (evento.key === 'Tab') daTastiera = true; }, true);
  document.addEventListener('pointerdown', () => { daTastiera = false; }, true);
  document.addEventListener('focusin', evento => { if (daTastiera) guarda(evento.target); });

  window.Assistente = { nuovo, dici, spiega, segui, AVATAR, disegnoAvatar, scegliAvatar, avatarScelto: () => avatarScelto };

  // ---------- In cima alle schede del programma ----------
  const nelProgramma = nuovo('nel-programma');
  const chiudi = crea('button', { type: 'button', className: 'chiudi-assistente', title: 'Richiudi l\'assistente', 'aria-label': 'Richiudi l\'assistente' }, '×');
  $('.parole', nelProgramma).append(chiudi);
  $('.avatar', nelProgramma).setAttribute('role', 'button');
  $('.avatar', nelProgramma).tabIndex = 0;
  $('#principale').prepend(nelProgramma);
  segui(nelProgramma);
  const chiuso = () => M.ricordo.leggi('assistente') === 'chiuso';
  function richiudi(si) {
    M.ricordo.scrivi('assistente', si ? 'chiuso' : 'aperto');
    nelProgramma.classList.toggle('richiuso', si);
    $('.avatar', nelProgramma).title = si ? 'Apri l\'assistente' : '';
    smettiDiSpiegare(nelProgramma);
    aggiornaSegue(nelProgramma);
    if (!si) { delete nelProgramma.dataset.testo; consiglia(); }
  }
  // Mentre segue la pagina la × chiude solo il fumetto; in cima alla pagina richiude l'assistente.
  chiudi.addEventListener('click', () => { if (nelProgramma.classList.contains('segue')) taci(nelProgramma, true); else richiudi(true); });
  $('.avatar', nelProgramma).addEventListener('click', () => { if (chiuso()) richiudi(false); });
  $('.avatar', nelProgramma).addEventListener('keydown', evento => { if ((evento.key === 'Enter' || evento.key === ' ') && chiuso()) { evento.preventDefault(); richiudi(false); } });

  const schedaAperta = () => M.stato.scheda || null;
  // Un consiglio per la pagina aperta, con i numeri del prestito dove servono.
  function consiglioPer(nome) {
    const s = M.stato, righe = s.piano ? s.piano.righe : [], quanti = Archivio.elenco().length;
    if (nome === 'prestiti') return [!quanti ? 'Qui compariranno i prestiti che segui. Se ne hai già uno, aggiungilo: bastano pochi numeri.'
      : quanti > 1 && !s.aperto ? 'Qui vedi tutti i tuoi prestiti, con il totale delle rate del mese. Premi «Apri» per entrare in uno: a sinistra compaiono le sue pagine.'
      : quanti > 1 ? 'Qui vedi tutti i tuoi prestiti, con il totale delle rate del mese. Con la stella scegli quello principale, che si apre da solo.'
      : 'Qui vedi il tuo prestito. Se ne hai un altro, con «Aggiungi un prestito» lo segui insieme a questo.', 'parla'];
    if (nome === 'costi') return ['Qui vedi quanto costa davvero il prestito, oltre alla somma ricevuta, e quanto risparmieresti rimborsandolo prima.', 'parla'];
    if (nome === 'dati') return ['Questi sono i dati del tuo prestito, in parole. Se qualcosa non è giusto, premi «Cambia i dati»: il piano si ricalcola subito.', 'parla'];
    if (nome === 'contratto') return ['Le regole del contratto: cambiale solo se sai che cosa dice il contratto. Se le rate non tornano, la taratura le cerca da sola.', 'parla'];
    if (nome === 'offerte') return ['Devi ancora firmare? Scrivi le offerte delle banche: ti dico quanto costa davvero ciascuna, e quale costa meno.', 'parla'];
    if (nome === 'piano' && righe.length) {
      const nonTornano = righe.filter(r => r.rataVera != null && Math.abs(r.differenza) >= 0.005).length;
      const r = M.rataDelMese(righe), rata = `La rata di ${meseAnno(r.inizio)} è di ${euro(r.rataEffettiva)}.`;
      if (nonTornano) return [`${rata} Attenzione: ${nonTornano === 1 ? 'una rata non torna' : `${nonTornano} rate non tornano`} con il calcolo (le righe rosse). Clicca la cifra per correggerla${M.semplice() ? '' : ', oppure prova la taratura nella pagina «Regole del contratto»'}.`, 'dubbio'];
      return [`${rata} Quando ti arriva una rata nuova, scrivila nella colonna «Rata vera»: se la riga diventa verde, la banca ha fatto i conti giusti.`, 'felice'];
    }
    if (nome === 'tassi') return [M.semplice() ? 'Qui ci sono i valori dell\'Euribor: si aggiornano da soli quando apri la pagina. Passa sul grafico per leggere il valore di un giorno.'
      : 'Qui ci sono i valori dell\'Euribor: si aggiornano da soli quando apri la pagina. Sotto il grafico puoi provare le previsioni per le rate future.', 'parla'];
    if (nome === 'calendario') return ['Il calendario mostra in che giorno la banca legge l\'indice per ogni rata. Clicca un giorno per vedere i dettagli.', 'parla'];
    if (nome === 'festivita') return ['Le festività servono a contare i giorni lavorativi. Di solito non c\'è niente da cambiare.', 'parla'];
    if (nome === 'pannello') return [M.ricordo.leggi('ultimo-backup') ? 'Qui salvi o ricarichi il backup di tutti i tuoi dati e scegli le impostazioni: versione semplice o avanzata, assistente, colori.'
      : 'Qui scegli le impostazioni e salvi il backup di tutti i tuoi dati. Un consiglio: salvane uno adesso, i dati del browser si possono perdere.', 'parla'];
    return ['', 'parla'];
  }
  function consiglia() {
    const nome = schedaAperta();
    nelProgramma.hidden = !nome || $('#principale').hidden;
    nelProgramma.classList.toggle('richiuso', chiuso());
    aggiornaSegue(nelProgramma);
    if (!nome || chiuso()) return;
    const [testo, umore] = consiglioPer(nome);
    dici(nelProgramma, testo, umore);
  }
  M.alCambioScheda.push(() => consiglia());
  M.viste.push(() => consiglia());
})();
