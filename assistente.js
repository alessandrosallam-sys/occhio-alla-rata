// L'assistente: un piccolo robot con il fumetto. Nella configurazione guidata dice, a ogni pagina, che cosa serve e
// come stanno andando i conti (configura.js gli passa le frasi); in cima alle schede del programma dà un consiglio
// sulla pagina aperta, e si può richiudere (resta solo la testa, che lo riapre).
// Umori: 'parla' (il testo si scrive e la bocca si muove), 'pensa' (occhi in alto e nuvoletta: sta calcolando),
// 'felice' (occhi a mezzaluna e un saltello), 'dubbio' (testa inclinata).
// Con «riduci movimento» nelle impostazioni del sistema resta fermo e il testo compare tutto insieme.
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

  function nuovo(classe = '') {
    const el = crea('div', { className: 'assistente ' + classe });
    el.innerHTML = `<div class="avatar">${DISEGNO}</div><div class="parole"><p class="scritto" aria-hidden="true"></p><span class="solo-lettori" aria-live="polite"></span></div>`;
    return el;
  }
  // Fa dire un testo all'assistente, lettera per lettera (lo stesso testo di prima non si riscrive: cambia solo l'umore).
  function dici(el, testo, umore = 'parla') {
    for (const u of UMORI) el.classList.toggle(u, u === umore);
    if (el.dataset.testo === testo) return;
    el.dataset.testo = testo;
    $('.solo-lettori', el).textContent = testo;
    const scritto = $('.scritto', el);
    clearInterval(el._scrittura);
    if (fermo()) { scritto.textContent = testo; el.classList.remove('scrive'); return; }
    M.rianima($('.parole', el), 'appena-detto');
    scritto.textContent = '';
    el.classList.add('scrive');
    let i = 0;
    el._scrittura = setInterval(() => {
      i = Math.min(testo.length, i + 2);
      scritto.textContent = testo.slice(0, i);
      if (i >= testo.length) { clearInterval(el._scrittura); el.classList.remove('scrive'); }
    }, 22);
  }
  window.Assistente = { nuovo, dici };

  // ---------- In cima alle schede del programma ----------
  const nelProgramma = nuovo('nel-programma');
  const chiudi = crea('button', { type: 'button', className: 'chiudi-assistente', title: 'Richiudi l\'assistente', 'aria-label': 'Richiudi l\'assistente' }, '×');
  $('.parole', nelProgramma).append(chiudi);
  $('.avatar', nelProgramma).setAttribute('role', 'button');
  $('.avatar', nelProgramma).tabIndex = 0;
  $('#principale').prepend(nelProgramma);
  const chiuso = () => M.ricordo.leggi('assistente') === 'chiuso';
  function richiudi(si) {
    M.ricordo.scrivi('assistente', si ? 'chiuso' : 'aperto');
    nelProgramma.classList.toggle('richiuso', si);
    $('.avatar', nelProgramma).title = si ? 'Apri l\'assistente' : '';
    if (!si) consiglia();
  }
  chiudi.addEventListener('click', () => richiudi(true));
  $('.avatar', nelProgramma).addEventListener('click', () => { if (chiuso()) richiudi(false); });
  $('.avatar', nelProgramma).addEventListener('keydown', evento => { if ((evento.key === 'Enter' || evento.key === ' ') && chiuso()) { evento.preventDefault(); richiudi(false); } });

  const schedaAperta = () => { const b = document.querySelector('.schede button[aria-selected="true"]'); return b ? b.dataset.scheda : null; };
  // Un consiglio per la pagina aperta, con i numeri del prestito dove servono.
  function consiglioPer(nome) {
    const s = M.stato, righe = s.piano ? s.piano.righe : [];
    if (nome === 'prestiti') return [Archivio.elenco().length > 1 ? 'Qui vedi tutti i tuoi prestiti, con il totale delle rate del mese. Premi «Apri» per lavorare su uno di loro.'
      : 'Qui vedi il tuo prestito. Se ne hai un altro, con «Aggiungi un prestito» lo segui insieme a questo.', 'parla'];
    if (nome === 'offerte') return ['Devi ancora firmare? Scrivi le offerte delle banche: ti dico quanto costa davvero ciascuna, e quale costa meno.', 'parla'];
    if (nome === 'piano' && righe.length) {
      const nonTornano = righe.filter(r => r.rataVera != null && Math.abs(r.differenza) >= 0.005).length;
      const r = M.rataDelMese(righe), rata = `La rata di ${meseAnno(r.inizio)} è di ${euro(r.rataEffettiva)}.`;
      if (nonTornano) return [`${rata} Attenzione: ${nonTornano === 1 ? 'una rata non torna' : `${nonTornano} rate non tornano`} con il calcolo (le righe rosse). Clicca la cifra per correggerla, oppure prova la taratura nel «Pannello di controllo».`, 'dubbio'];
      return [`${rata} Quando ti arriva una rata nuova, scrivila nella colonna «Rata vera»: se la riga diventa verde, la banca ha fatto i conti giusti.`, 'felice'];
    }
    if (nome === 'tassi') return ['Qui ci sono i valori dell\'Euribor: si aggiornano da soli quando apri la pagina. Sotto il grafico puoi provare le previsioni per le rate future.', 'parla'];
    if (nome === 'calendario') return ['Il calendario mostra in che giorno la banca legge l\'indice per ogni rata. Clicca un giorno per vedere i dettagli.', 'parla'];
    if (nome === 'festivita') return ['Le festività servono a contare i giorni lavorativi. Di solito non c\'è niente da cambiare.', 'parla'];
    if (nome === 'pannello') return [M.ricordo.leggi('ultimo-backup') ? 'Qui trovi quanto costa davvero il prestito, l\'estinzione anticipata, il backup e le regole del contratto.'
      : 'Qui trovi il costo del prestito, l\'estinzione anticipata e le regole del contratto. Un consiglio: salva ogni tanto un backup dei tuoi dati.', 'parla'];
    return ['', 'parla'];
  }
  function consiglia() {
    const nome = schedaAperta();
    nelProgramma.hidden = !nome || $('#principale').hidden;
    nelProgramma.classList.toggle('richiuso', chiuso());
    if (!nome || chiuso()) return;
    const [testo, umore] = consiglioPer(nome);
    dici(nelProgramma, testo, umore);
  }
  M.alCambioScheda.push(() => consiglia());
  M.viste.push(() => consiglia());
})();
