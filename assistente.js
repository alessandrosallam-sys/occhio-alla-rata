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
  const DISEGNO = `<svg class="robot" viewBox="0 0 64 64" aria-hidden="true">
    <g class="corpo">
      <line class="antenna" x1="32" y1="14" x2="32" y2="7"/><circle class="antenna-luce" cx="32" cy="5.5" r="3.2"/>
      <rect class="orecchio" x="5" y="27" width="6" height="12" rx="3"/><rect class="orecchio" x="53" y="27" width="6" height="12" rx="3"/>
      <rect class="testa" x="10" y="13" width="44" height="38" rx="15"/>
      <rect class="viso" x="16" y="19" width="32" height="26" rx="10"/>
      <g class="occhi"><ellipse cx="25.5" cy="30" rx="3.6" ry="4.4"/><ellipse cx="38.5" cy="30" rx="3.6" ry="4.4"/></g>
      <path class="occhi-felici" d="M21.5 31q4-5 8 0M34.5 31q4-5 8 0"/>
      <path class="bocca" d="M27 38.5q5 4 10 0"/><ellipse class="bocca-aperta" cx="32" cy="39" rx="4" ry="2.6"/>
      <circle class="guancia" cx="20.5" cy="37.5" r="2.2"/><circle class="guancia" cx="43.5" cy="37.5" r="2.2"/>
    </g>
    <g class="nuvoletta"><circle cx="53" cy="11" r="2"/><circle cx="58.5" cy="5.5" r="2.8"/></g>
  </svg>`;
  const fermo = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const vuole = codice => !window.Temi || Temi.opzione(codice);   // scelte delle impostazioni: 'spiega', 'segue'

  function nuovo(classe = '') {
    const el = crea('div', { className: 'assistente ' + classe });
    el.innerHTML = `<div class="avatar">${DISEGNO}</div><div class="parole"><p class="scritto" aria-hidden="true"></p><span class="solo-lettori" aria-live="polite"></span></div>`;
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

  window.Assistente = { nuovo, dici, spiega, segui };

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
