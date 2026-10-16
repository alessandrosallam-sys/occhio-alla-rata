// Quanto costa il prestito aperto (pannello di controllo): interessi, spese, assicurazioni, costo totale e TAEG,
// con il confronto fra il TAEG calcolato e quello scritto nel contratto.
(function () {
  'use strict';
  const M = window.Mutuo, { stato, $, crea, euro, perc } = M;
  // Sotto questa differenza (in punti percentuali) i due TAEG si considerano uguali: i contratti li scrivono con due decimali.
  const TOLLERANZA_TAEG = 0.0001;

  function disegna() {
    const carta = $('#costo-prestito');
    if (!carta || !stato.piano) return;
    const p = stato.dati.parametri, variabile = M.variabile();
    // A tasso fisso il costo è quello del piano firmato; per il variabile si usano le rate vere dove ci sono e, per le
    // altre, la stima del piano (proiezione dell'indice scelta nella pagina «Tassi»).
    const c = Calcolo.costi(stato.dati, stato.piano.righe, !variabile);
    const riga = (etichetta, valore, spiegazione, classe = '') => crea('tr', { className: classe },
      crea('th', { scope: 'row' }, etichetta, ...(spiegazione ? [crea('small', {}, spiegazione)] : [])), crea('td', {}, valore));
    const righe = [
      riga('Importo prestato', euro(p.importo_iniziale)),
      ...(c.ricevuto !== p.importo_iniziale ? [riga('Soldi ricevuti davvero', euro(c.ricevuto), 'il prestito meno quello che hai pagato all\'inizio')] : []),
      riga('Interessi', euro(c.interessi), variabile ? 'su tutte le rate: quelle future sono una stima' : 'su tutte le rate'),
      ...(c.speseRate > 0 ? [riga('Spese per rata', euro(c.speseRate), `${euro(p.spese_rata)} × ${stato.piano.righe.length} rate`)] : []),
      ...(c.speseIniziali > 0 ? [riga('Spese iniziali', euro(c.speseIniziali))] : []),
      ...(c.assicurazioni > 0 ? [riga('Assicurazioni', euro(c.assicurazioni))] : []),
      ...(c.speseAnnue > 0 ? [riga('Spese annuali', euro(c.speseAnnue))] : []),
      riga('Costo totale del prestito', euro(c.costoTotale), 'tutto quello che paghi oltre al capitale', 'totale'),
      riga('Totale da pagare', euro(c.totaleDaPagare), 'capitale + costo totale', 'totale'),
    ];
    const tassi = [
      ...(variabile ? [] : [riga('TAN', perc(p.tasso_fisso, 3, 1), 'il tasso usato per gli interessi')]),
      riga(variabile ? 'TAEG stimato' : 'TAEG calcolato', c.taeg == null ? '—' : perc(c.taeg, 2), 'il costo totale in percentuale all\'anno: serve a confrontare prestiti diversi'),
      ...(p.taeg_dichiarato > 0 ? [riga('TAEG del contratto', perc(p.taeg_dichiarato, 3, 2))] : []),
    ];
    const contenuto = [crea('h3', {}, 'Quanto costa questo prestito'),
      crea('table', { className: 'tabella-costi' }, crea('tbody', {}, ...righe, ...tassi))];
    contenuto.push(...giudizio(c, p, variabile));
    carta.replaceChildren(...contenuto);
  }

  // Che cosa dice il confronto fra il TAEG calcolato e quello del contratto, e cosa fare se non tornano.
  function giudizio(c, p, variabile) {
    const nota = (testo, classe = '') => crea('p', { className: 'nota ' + classe }, testo);
    if (variabile) return [nota('Per un mutuo variabile le rate future dipendono dall\'indice: costo totale e TAEG sono una stima, fatta con la proiezione scelta nella pagina «Tassi». '
      + 'Il TAEG scritto dalla banca invece è calcolato con l\'indice del giorno della firma, quindi i due possono essere diversi.')];
    if (c.taeg == null) return [];
    if (!(p.taeg_dichiarato > 0)) return [nota('Se nel contratto c\'è il TAEG, scrivilo nelle regole del contratto qui sotto: controllo se coincide con quello che calcolo io.')];
    const differenza = c.taeg - p.taeg_dichiarato;
    if (Math.abs(differenza) <= TOLLERANZA_TAEG + 0.00005) return [nota(`✓ Il TAEG calcolato coincide con quello del contratto (${perc(p.taeg_dichiarato, 3, 2)}).`, 'conferma')];
    const frasi = [nota(`Il TAEG che calcolo è ${perc(c.taeg, 2)}, quello del contratto ${perc(p.taeg_dichiarato, 3, 2)}: ${differenza > 0 ? 'il mio è più alto' : 'il mio è più basso'} di ${perc(Math.abs(differenza), 2)} punti.`, 'evidenza')];
    frasi.push(nota(differenza < 0
      ? 'Di solito vuol dire che mancano dei costi: spese di istruttoria o di incasso, imposta di bollo, un\'assicurazione obbligatoria. Controlla il foglio informativo e aggiungili nelle regole del contratto.'
      : 'Forse hai inserito un costo che la banca non conta nel TAEG, come un\'assicurazione facoltativa, oppure le date o la durata non sono quelle del contratto. Se i dati sono giusti, il TAEG del contratto è più basso del vero: chiedi spiegazioni alla banca.'));
    if (differenza > 0 && p.tipo_prestito === 'finanziamento') frasi.push(nota('Nei finanziamenti ai consumatori la legge (articolo 125-bis del Testo unico bancario) considera nulle le clausole sui costi che non sono stati inclusi, o sono stati inclusi male, nel TAEG indicato. '
      + 'Se la differenza resta anche con i dati giusti, può valere la pena di chiedere un parere a un\'associazione dei consumatori.'));
    return frasi;
  }

  M.viste.push(disegna);
})();
