// Le novità all'apertura (27 ottobre 2026; docs/progetto-generale.md, sezione 46). Quando il programma ha imparato
// qualcosa di nuovo, la prima volta che lo si riapre compare una finestra (#novita in index.html) con le novità
// dall'ultima volta. Le regole:
//  - in NOVITA c'è una voce per ogni cosa nuova che si vede nella pagina, la più recente in cima, con il numero «n» che
//    cresce di uno a ogni voce, un'icona (icone.js), un titolo e una o due frasi semplici;
//  - una correzione di un errore è una voce con «correzione» (che cosa si è sistemato: serve a chi legge il codice, la
//    pagina non lo mostra). Nella finestra le correzioni diventano una riga sola, «Correzioni», e da sole non la aprono:
//    restano da dire insieme alla prossima novità;
//  - il browser ricorda il numero più alto già visto (chiave «novita-viste»). Chi apre il programma senza prestiti né
//    offerte, cioè per la prima volta, non vede niente: per lui è tutto nuovo, il numero si segna e basta;
//  - negli esempi non compare e non segna niente: si decide alla prossima apertura con i dati veri.
// Esempio di correzione: { n: 3, data: '2026-10-28', correzione: 'il totale delle spese sul telefono andava a capo male' }
(function () {
  'use strict';
  const { $, crea, ricordo } = window.Mutuo;
  const NOVITA = [
    { n: 10, data: '2026-10-28', icona: 'stella', titolo: 'Un nuovo stile, in prova',
      testo: 'Nelle impostazioni c\'è il tema «Nuovo stile (prova)»: riquadri più ordinati, niente sfumature. Provalo e dicci se ti piace.' },
    { n: 9, data: '2026-10-27', icona: 'lampadina', titolo: '«Che cos\'è?» resta acceso',
      testo: 'Sul telefono, dopo «Che cos\'è?» il robottino ti spiega ogni cosa che tocchi, una dopo l\'altra, finché non premi «Fine».' },
    { n: 8, data: '2026-10-27', icona: 'attenzione', titolo: 'Segnala un problema',
      testo: 'Accanto a «Condividi» c\'è il triangolo: se qualcosa non va, o una rata non torna, da lì ce lo racconti.' },
    { n: 7, data: '2026-10-27', icona: 'documento', titolo: 'Il codice su GitHub',
      testo: 'In fondo al Pannello di controllo c\'è il link a GitHub, il sito dove sta il programma: chiunque può leggere come fa i conti, riga per riga.' },
    { n: 6, data: '2026-10-27', icona: 'offerte', titolo: 'Le offerte come i prestiti',
      testo: 'Sotto il confronto ogni offerta ha la sua carta con un riassunto. Per correggerla premi «Cambia i dati»: si apre solo quella.' },
    { n: 5, data: '2026-10-27', icona: 'calendario', titolo: 'Le spese di ogni anno nelle offerte',
      testo: 'Rendiconto, certificazione degli interessi, polizza incendio: nelle offerte ora le scrivi come le trovi nel foglio, una volta all\'anno, senza dividerle per 12.' },
    { n: 4, data: '2026-10-27', icona: 'percento', titolo: 'Le spese che mancano al TAEG',
      testo: 'Se il TAEG scritto nell\'offerta è più alto del calcolo, il programma ti dice quante spese mancano e dove cercarle. Se non le trovi, le aggiunge lui con un clic.' },
    { n: 3, data: '2026-10-27', icona: 'orologio', titolo: 'Il mutuo a tasso misto',
      testo: 'Fisso per i primi anni, poi il tasso si rivede: ora è un tipo di prestito. Nelle offerte vedi quanto potrebbe diventare la rata dopo gli anni fissi; nei tuoi prestiti, quando finisce il tasso fisso e quanto debito resta.' },
    { n: 2, data: '2026-10-27', icona: 'euro', titolo: 'Le spese iniziali una per una',
      testo: 'Perizia, istruttoria, notaio, consulente…: scrivi ogni spesa nella sua riga, con il nome se vuoi, e il totale lo fa il programma. Vale nella guida, nelle offerte e nei dati del prestito; nel confronto delle offerte le spese si vedono voce per voce.' },
    { n: 1, data: '2026-10-26', icona: 'traguardo', titolo: 'Le rate bastano',
      testo: 'Mentre scrivi le rate già pagate, appena i conti tornano tutti al centesimo il programma te lo dice, e «Avanti» non te ne chiede altre.' },
  ];
  const CHIAVE = 'novita-viste';
  const MASSIMO = 5;      // novità nella finestra: le altre sono nell'elenco delle versioni
  const ATTESA = 400;     // millisecondi: prima sfuma la schermata di caricamento (app.js)

  function controlla() {
    if (Archivio.inProva()) return;
    const ultima = Math.max(0, ...NOVITA.map(v => v.n));
    const vista = Number(ricordo.leggi(CHIAVE)) || 0;
    const nuove = NOVITA.filter(v => v.n > vista), novita = nuove.filter(v => !v.correzione);
    if (!nuove.length) return;
    const giaUsato = Archivio.elenco().length > 0 || Archivio.offerte().length > 0;
    if (giaUsato && !novita.length) return;
    ricordo.scrivi(CHIAVE, String(ultima));
    // Se il browser non ricorda niente (navigazione privata, dati bloccati) la finestra comparirebbe a ogni apertura:
    // meglio mai.
    if (!giaUsato || ricordo.leggi(CHIAVE) !== String(ultima)) return;
    mostra(novita, nuove.some(v => v.correzione));
  }

  function mostra(novita, correzioni) {
    const finestra = $('#novita');
    if (!finestra || typeof finestra.showModal !== 'function') return;
    const voce = (icona, titolo, testo) => crea('li', {}, Icone.distintivo(icona, 'piccolo'), crea('div', {}, crea('strong', {}, titolo), crea('p', {}, testo)));
    const elenco = novita.slice(0, MASSIMO).map(v => voce(v.icona || 'stella', v.titolo, v.testo));
    if (correzioni) elenco.push(voce('spunta', 'Correzioni', 'Sistemato qualche errore.'));
    $('#elenco-novita').replaceChildren(...elenco);
    const altre = novita.length - MASSIMO;
    $('#altre-novita').textContent = altre > 0 ? `E ${altre === 1 ? 'ce n\'è un\'altra' : `ce ne sono altre ${altre}`}. ` : '';
    finestra.showModal();
  }

  const finestra = $('#novita');
  if (finestra) {
    $('#chiudi-novita').addEventListener('click', () => finestra.close());
    // Un clic fuori dal riquadro (sullo sfondo scuro) la chiude, ma non una selezione del testo finita fuori; Esc la
    // chiude da sé.
    let premuto = null;
    finestra.addEventListener('pointerdown', evento => { premuto = evento.target; });
    finestra.addEventListener('click', evento => { if (evento.target === finestra && premuto === finestra) finestra.close(); });
  }
  window.Mutuo.dopoCaricamento.push(() => setTimeout(controlla, ATTESA));
  window.Novita = { NOVITA, controlla };
})();
