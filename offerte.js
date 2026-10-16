// Scheda «Offerte»: per chi deve ancora firmare, il confronto fra le offerte di banche e finanziarie. Per ogni offerta
// il piano completo, come se partisse il mese prossimo: rata, interessi, costo totale e TAEG, uno accanto all'altro.
// Per il tasso variabile l'indice futuro viene da un modello (previsioni.js, M.proiezioneIndice), in tre scenari, e c'è
// anche il conto con l'indice fermo a oggi, che è quello con cui la banca calcola il suo TAEG.
(function () {
  'use strict';
  const M = window.Mutuo, { stato, $, crea, euro, perc, avvisa } = M;
  const CAMPI_OFFERTA = ['nome', 'tipo_prestito', 'importo_iniziale', 'numero_rate', 'tasso_fisso', 'indice_nome', 'spread',
    'spese_iniziali', 'spese_rata', 'assicurazione_iniziale', 'assicurazione_rata', 'taeg_dichiarato'];
  // Modelli per l'indice futuro (la media delle variazioni non c'è: sul lungo periodo porta l'indice troppo lontano).
  const MODELLI = [['vasicek', 'Vasicek: torna piano piano verso la media storica'], ['curva', 'Attese del mercato (curva degli Euribor di oggi)'],
    ['garch', 'GARCH: segue la variabilità recente'], ['costante', 'Nessun cambiamento: resta com\'è oggi']];
  const variabile = p => p.tipo_prestito === 'variabile';
  const durata = n => n % 12 === 0 ? `${n / 12} ${n === 12 ? 'anno' : 'anni'} (${n} rate)` : `${n} rate`;
  const nomeTipo = p => ({ variabile: 'Mutuo variabile', fisso: 'Mutuo fisso', finanziamento: 'Finanziamento' })[p.tipo_prestito] || 'Prestito';
  const modelloScelto = () => { const o = Archivio.offerte().find(x => variabile(x.parametri)); const m = o && o.parametri.previsione_modello; return MODELLI.some(([c]) => c === m) ? m : 'vasicek'; };

  // ---------- Calcolo di un'offerta ----------
  function inizioProssimoMese() {
    const [a, m] = stato.oggi.split('-').map(Number), d = new Date(Date.UTC(a, m, 1));
    return d.toISOString().slice(0, 10);
  }
  function calcola(o, modello) {
    const p = o.parametri;
    if (!(p.importo_iniziale > 0) || !(p.numero_rate > 0)) return { manca: 'Scrivi l\'importo e il numero di rate.' };
    if (!variabile(p) && p.tasso_fisso == null) return { manca: 'Scrivi il tasso (TAN).' };
    if (variabile(p) && p.spread == null) return { manca: 'Scrivi lo spread.' };
    const inizio = inizioProssimoMese(), primoAnno = +inizio.slice(0, 4) - 1, festivita = [];
    for (let anno = primoAnno; anno <= primoAnno + Math.ceil(p.numero_rate / 12) + 2; anno++) festivita.push(...Calcolo.festivitaTarget(anno));
    const dati = { parametri: { ...p, data_prima_rata: inizio, rata_obiettivo: 0 }, rate: [], euribor: [], festivita };
    const conti = previsione => {
      const righe = Calcolo.calcolaPiano(dati, { previsione }).righe;
      return { righe, c: Calcolo.costi(dati, righe, true), prima: righe[0].rataCalcolata, massima: Math.max(...righe.map(r => r.rataCalcolata)) };
    };
    if (!variabile(p)) return { fisso: true, atteso: conti(null) };
    const proiezione = M.proiezioneIndice(p.indice_nome, p.numero_rate + 2, modello);
    if (!proiezione) return { manca: 'Per il tasso variabile serve un Euribor (1, 3, 6 o 12 mesi): degli altri indici il programma non ha lo storico per fare previsioni.' };
    return { fisso: false, proiezione, oggi: conti(() => proiezione.ultimo.valore),
      atteso: conti(proiezione.scenari.atteso), alto: conti(proiezione.scenari.alto80), basso: conti(proiezione.scenari.basso80) };
  }

  // ---------- Tabella di confronto ----------
  function disegnaTabella(contenitore) {
    const offerte = Archivio.offerte(), modello = modelloScelto();
    const esiti = offerte.map(o => ({ o, e: calcola(o, modello) }));
    const calcolate = esiti.filter(x => !x.e.manca);
    const migliore = calcolate.length > 1 ? calcolate.reduce((a, b) => b.e.atteso.c.costoTotale < a.e.atteso.c.costoTotale ? b : a) : null;
    const piccolo = testo => crea('small', {}, testo);
    const cella = (x, contenuto) => crea('td', { className: x === migliore ? 'migliore' : '' }, ...contenuto);
    const riga = (titolo, spiegazione, valore) => crea('tr', {}, crea('th', { scope: 'row' }, titolo, ...(spiegazione ? [piccolo(spiegazione)] : [])),
      ...esiti.map(x => x.e.manca ? crea('td', { className: 'manca' }, '—') : cella(x, valore(x.e, x.o.parametri))));
    const forbice = (e, campo) => piccolo(`fra ${euro(e.basso.c[campo])} e ${euro(e.alto.c[campo])}`);
    const righe = [
      riga('Tipo', null, (e, p) => [nomeTipo(p), piccolo(variabile(p) ? `${p.indice_nome} + ${perc(p.spread, 3, 1)}` : `TAN ${perc(p.tasso_fisso, 3, 1)}`)]),
      riga('Importo e durata', null, (e, p) => [euro(p.importo_iniziale), piccolo(durata(p.numero_rate))]),
      riga('Prima rata', 'spese per rata comprese', e => [euro(e.atteso.prima)]),
      // A tasso fisso la rata è sempre quella (solo l'ultima, che chiude il debito, può cambiare di pochi euro).
      riga('Rata più alta prevista', 'per il variabile: se l\'indice sale (fascia alta dell\'80% dei casi)', e => e.fisso ? [euro(e.atteso.prima), piccolo('sempre uguale')] : [euro(e.alto.massima)]),
      riga('Interessi', 'su tutto il prestito', e => e.fisso ? [euro(e.atteso.c.interessi)] : [euro(e.atteso.c.interessi), forbice(e, 'interessi')]),
      riga('Spese e assicurazioni', null, e => [euro(e.atteso.c.costoTotale - e.atteso.c.interessi)]),
      riga('Costo totale', 'tutto quello che paghi oltre al capitale', e => e.fisso ? [crea('strong', {}, euro(e.atteso.c.costoTotale))] : [crea('strong', {}, euro(e.atteso.c.costoTotale)), forbice(e, 'costoTotale')]),
      riga('Totale da pagare', 'capitale + costo totale', e => [euro(e.atteso.c.totaleDaPagare)]),
      riga('TAEG', 'il costo totale in percentuale all\'anno', e => e.fisso ? [perc(e.atteso.c.taeg, 2)]
        : [perc(e.oggi.c.taeg, 2), piccolo(`con l'indice di oggi, come lo calcola la banca; con le previsioni ${perc(e.atteso.c.taeg, 2)}`)]),
      ...(offerte.some(o => o.parametri.taeg_dichiarato > 0) ? [riga('TAEG dell\'offerta', 'quello scritto dalla banca', (e, p) => {
        if (!(p.taeg_dichiarato > 0)) return ['—'];
        const mio = e.fisso ? e.atteso.c.taeg : e.oggi.c.taeg, uguale = Math.abs(mio - p.taeg_dichiarato) <= 0.00015;
        return [perc(p.taeg_dichiarato, 3, 2), piccolo(uguale ? '✓ coincide con il calcolo' : `diverso dal calcolo (${perc(mio, 2)}): controlla spese e assicurazioni`)];
      })] : []),
    ];
    const testa = crea('tr', {}, crea('td', {}), ...esiti.map(x => crea('th', { scope: 'col', className: x === migliore ? 'migliore' : '' },
      x.o.parametri.nome || 'Offerta', ...(x === migliore ? [crea('span', { className: 'etichetta-aperto' }, 'costa meno')] : []))));
    const note = [];
    const diverse = calcolate.length > 1 && new Set(calcolate.map(x => `${x.o.parametri.importo_iniziale}|${x.o.parametri.numero_rate}`)).size > 1;
    if (diverse) note.push(crea('p', { className: 'nota evidenza' }, 'Le offerte hanno importi o durate diversi: il costo totale non si può confrontare direttamente. Confronta il TAEG, oppure metti lo stesso importo e la stessa durata.'));
    else if (migliore) note.push(crea('p', { className: 'nota' }, `A parità di importo e durata costa meno «${migliore.o.parametri.nome || 'Offerta'}»${migliore.e.fisso ? '' : ' (con le previsioni sull\'indice: è una stima)'}. Guarda anche la rata più alta prevista: è quella che devi poterti permettere.`));
    if (esiti.some(x => !x.e.manca && !x.e.fisso)) {
      const x = esiti.find(y => !y.e.manca && !y.e.fisso);
      note.push(crea('p', { className: 'nota' }, `Per il tasso variabile l'indice futuro è una stima, non una previsione sicura: oggi ${x.e.proiezione.nomeSerie} vale ${perc(x.e.proiezione.ultimo.valore, 3)}. `
        + 'Le cifre «fra … e …» sono la fascia in cui cade l\'80% dei casi secondo il modello scelto qui sotto.'));
    }
    const mancanti = esiti.filter(x => x.e.manca);
    if (mancanti.length) note.push(...mancanti.map(x => crea('p', { className: 'nota evidenza' }, `«${x.o.parametri.nome || 'Offerta'}»: ${x.e.manca}`)));
    const scelta = crea('label', { className: 'campo-in-linea' }, 'Previsione dell\'indice per il variabile ',
      crea('select', { id: 'modello-offerte' }, ...MODELLI.map(([codice, nome]) => crea('option', { value: codice, selected: codice === modello }, nome))));
    contenitore.replaceChildren(
      crea('div', { className: 'scorri-offerte' }, crea('table', { className: 'tabella-offerte' }, crea('thead', {}, testa), crea('tbody', {}, ...righe))),
      ...note, ...(offerte.some(o => variabile(o.parametri)) ? [scelta] : []));
  }

  // ---------- Una carta per offerta, con i suoi dati ----------
  function cartaOfferta(o) {
    const p = o.parametri, campi = crea('div', { className: 'campi due-colonne' }, ...CAMPI_OFFERTA.map(k => M.campi.crea(k, p[k], false, p)));
    // Le spiegazioni lunghe dei campi restano come suggerimento al passaggio del mouse: la carta resta compatta.
    for (const aiuto of campi.querySelectorAll('label > small')) { aiuto.parentElement.title = aiuto.textContent; aiuto.remove(); }
    const modulo = crea('form', { className: 'carta carta-offerta', 'data-offerta': o.id },
      crea('h3', {}, p.nome || 'Offerta'), campi,
      crea('p', { className: 'nota evidenza errore-offerta', hidden: true }),
      crea('div', { className: 'azioni' },
        crea('button', { type: 'button', className: 'secondario', 'data-segui': o.id }, 'Segui questo prestito'),
        crea('button', { type: 'button', className: 'pericoloso piccolo', 'data-elimina-offerta': o.id }, 'Elimina')));
    M.campi.aggiornaVisibili(modulo, CAMPI_OFFERTA, p);
    return modulo;
  }

  function disegna() {
    if ($('#scheda-offerte').hidden) return;
    const offerte = Archivio.offerte(), contenuto = $('#contenuto-offerte');
    $('#segui-prestito-offerte').hidden = Archivio.configurato();
    if (!offerte.length) {
      contenuto.replaceChildren(crea('div', { className: 'carta' },
        crea('h3', {}, 'Come funziona'),
        crea('ol', { className: 'dopo' },
          crea('li', {}, 'Prima di firmare, la banca o la finanziaria ti deve consegnare un foglio informativo: il PIES per i mutui, il SECCI per i finanziamenti. Lì trovi importo, durata, tasso, spese e TAEG.'),
          crea('li', {}, 'Premi «Aggiungi un\'offerta» e scrivi quei numeri. Ripeti per ogni offerta che hai ricevuto.'),
          crea('li', {}, 'Il programma calcola, per ognuna, rata, interessi, costo totale e TAEG, e ti dice quale costa meno. Per il tasso variabile mostra anche quanto potrebbe salire la rata.'),
          crea('li', {}, 'Quando hai firmato, premi «Segui questo prestito» sull\'offerta scelta: i dati passano alla configurazione guidata.'))));
      return;
    }
    // Le carte si ricostruiscono solo se non si sta scrivendo in una di loro, o se le offerte sono cambiate.
    const chiave = offerte.map(o => o.id).join('|'), carte = $('#carte-offerte');
    if (!carte || carte.dataset.chiave !== chiave || !carte.contains(document.activeElement)) {
      const nuove = crea('div', { id: 'carte-offerte', className: 'elenco-prestiti' }, ...offerte.map(cartaOfferta));
      nuove.dataset.chiave = chiave;
      contenuto.replaceChildren(crea('div', { className: 'carta', id: 'confronto-offerte' }), nuove);
    }
    disegnaTabella($('#confronto-offerte'));
  }

  // Un campo cambiato si salva subito; la tabella si ricalcola, le carte restano come sono (il cursore non si perde).
  $('#contenuto-offerte').addEventListener('change', async evento => {
    if (evento.target.id === 'modello-offerte') {
      for (const o of Archivio.offerte().filter(x => variabile(x.parametri))) await Archivio.richiesta('PUT', 'offerte/' + o.id, { previsione_modello: evento.target.value });
      return disegnaTabella($('#confronto-offerte'));
    }
    const modulo = evento.target.closest('form[data-offerta]');
    if (!modulo) return;
    const errore = $('.errore-offerta', modulo), o = Archivio.offerte().find(x => x.id === modulo.dataset.offerta);
    M.campi.aggiornaVisibili(modulo, CAMPI_OFFERTA, o.parametri);
    const letti = M.campi.leggi(modulo, CAMPI_OFFERTA.filter(k => !Archivio.CAMPI[k].obbligatorio || $(`[data-campo="${k}"] input`, modulo).value.trim()));
    errore.hidden = !letti.errore;
    if (letti.errore) { errore.textContent = letti.errore; return; }
    try {
      await Archivio.richiesta('PUT', 'offerte/' + o.id, { ...letti.valori, ...(variabile(letti.valori) ? { previsione_modello: modelloScelto() } : {}) });
    } catch (e) {
      errore.textContent = e.message;
      errore.hidden = false;
      return;
    }
    $('h3', modulo).textContent = letti.valori.nome || 'Offerta';
    disegnaTabella($('#confronto-offerte'));
  });
  $('#contenuto-offerte').addEventListener('click', async evento => {
    const segui = evento.target.closest('button[data-segui]'), elimina = evento.target.closest('button[data-elimina-offerta]');
    const o = Archivio.offerte().find(x => x.id === (segui || elimina || {}).dataset?.[segui ? 'segui' : 'eliminaOfferta']);
    if (!o) return;
    if (segui) {
      // La guida parte con i dati dell'offerta: mancano solo la data della prima rata e le regole di dettaglio.
      const { previsione_modello, ...parametri } = o.parametri;
      return M.apriGuida(false, true, { ...parametri, previsione_modello: 'media' });
    }
    if (!confirm(`Eliminare l'offerta «${o.parametri.nome || 'Offerta'}»?`)) return;
    await Archivio.richiesta('DELETE', 'offerte/' + o.id);
    if (!Archivio.configurato() && !Archivio.offerte().length) stato.soloOfferte = true;
    disegna();
  });
  $('#aggiungi-offerta').addEventListener('click', async () => {
    const offerte = Archivio.offerte(), ultima = offerte[offerte.length - 1];
    // La nuova offerta riprende importo e durata dell'ultima: di solito si confrontano offerte per lo stesso prestito.
    await Archivio.richiesta('POST', 'offerte', { parametri: { nome: `Offerta ${offerte.length + 1}`, tipo_prestito: ultima ? ultima.parametri.tipo_prestito : 'fisso',
      ...(ultima ? { importo_iniziale: ultima.parametri.importo_iniziale, numero_rate: ultima.parametri.numero_rate } : {}) } });
    disegna();
    const carte = document.querySelectorAll('#carte-offerte .carta-offerta'), nuova = carte[carte.length - 1];
    if (nuova) { nuova.scrollIntoView({ block: 'nearest' }); $('input[name="nome"]', nuova).select(); }
  });
  $('#segui-prestito-offerte').addEventListener('click', () => M.apriGuida(false));

  M.viste.push(disegna);
  M.allApertura.offerte = disegna;
})();
