// Scheda «Offerte»: per chi deve ancora firmare, il confronto fra le offerte di banche e finanziarie. Per ogni offerta
// il piano completo, come se partisse il mese prossimo: rata, interessi, costo totale e TAEG, uno accanto all'altro.
// Per il tasso variabile l'indice futuro viene da un modello (previsioni.js, M.proiezioneIndice), in tre scenari, e c'è
// anche il conto con l'indice fermo a oggi, che è quello con cui la banca calcola il suo TAEG.
// Il tasso misto ha il TAN per i primi anni, poi i tre scenari dell'Euribor (M.scenariMisto); il conto con il TAN di
// oggi fino alla fine è quello del TAEG della banca, e c'è anche il TAEG dei soli anni fissi.
// Un'offerta nuova si aggiunge con la guida (configura.js, M.apriGuidaOfferta), una domanda per pagina; dopo si corregge
// nella sua carta.
(function () {
  'use strict';
  const M = window.Mutuo, { stato, $, crea, euro, perc, avvisa } = M;
  const CAMPI_OFFERTA = ['nome', 'tipo_prestito', 'importo_iniziale', 'numero_rate', 'maxirata', 'anticipo', 'tasso_fisso', 'anni_tasso_fisso', 'spread_dopo', 'indice_nome', 'spread',
    'spese_iniziali', 'spese_rata', 'assicurazione_iniziale', 'spese_nel_prestito', 'assicurazione_rata', 'assicurazione_facoltativa', 'arrotonda_rata', 'taeg_dichiarato'];
  // Modelli per l'indice futuro (la media delle variazioni non c'è: sul lungo periodo porta l'indice troppo lontano).
  const MODELLI = [['vasicek', 'Vasicek: torna piano piano verso la media storica'], ['curva', 'Attese del mercato (curva degli Euribor di oggi)'],
    ['garch', 'GARCH: segue la variabilità recente'], ['costante', 'Nessun cambiamento: resta com\'è oggi']];
  const variabile = p => p.tipo_prestito === 'variabile';
  const misto = p => p.tipo_prestito === 'misto';
  // Le offerte che usano la previsione dell'Euribor: il variabile, e il misto dopo gli anni fissi.
  const conPrevisioni = p => variabile(p) || misto(p);
  const conMaxirata = p => p.tipo_prestito === 'maxirata';
  const durata = p => conMaxirata(p) ? `${p.numero_rate} rate + maxirata` : p.numero_rate % 12 === 0 ? `${p.numero_rate / 12} ${p.numero_rate === 12 ? 'anno' : 'anni'} (${p.numero_rate} rate)` : `${p.numero_rate} rate`;
  // Durata in mesi, maxirata compresa: serve a capire se due offerte si possono confrontare.
  const mesi = p => p.numero_rate + (conMaxirata(p) ? 1 : 0);
  const nomeTipo = p => Archivio.categoria(p).breve;
  const modelloScelto = () => { const o = Archivio.offerte().find(x => conPrevisioni(x.parametri)); const m = o && o.parametri.previsione_modello; return MODELLI.some(([c]) => c === m) ? m : 'vasicek'; };

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
    if (conMaxirata(p) && !(p.maxirata > 0 && p.maxirata < p.importo_iniziale)) return { manca: 'Scrivi la maxirata finale: deve essere più bassa dell\'importo prestato.' };
    if (misto(p) && !(p.anni_tasso_fisso > 0 && p.anni_tasso_fisso * 12 < p.numero_rate)) return { manca: 'Scrivi per quanti anni il tasso è fisso: devono essere meno della durata.' };
    const inizio = inizioProssimoMese(), primoAnno = +inizio.slice(0, 4) - 1, festivita = [];
    for (let anno = primoAnno; anno <= primoAnno + Math.ceil(p.numero_rate / 12) + 2; anno++) festivita.push(...Calcolo.festivitaTarget(anno));
    const dati = { parametri: { ...p, data_prima_rata: inizio, rata_obiettivo: 0 }, rate: [], euribor: [], festivita };
    const conti = previsione => {
      const righe = Calcolo.calcolaPiano(dati, { previsione }).righe;
      return { righe, c: Calcolo.costi(dati, righe, true), prima: righe[0].rataCalcolata, massima: Math.max(...righe.map(r => r.rataCalcolata)) };
    };
    if (misto(p)) {
      // «oggi»: il TAN fino alla fine, come il TAEG della banca. Senza previsioni (un indice che non è un Euribor) resta solo quello.
      const oggi = conti(null), dalla = Calcolo.prossimaRevisione(p), s = M.scenariMisto(dati, dalla, modello);
      return s ? { misto: true, fisso: false, dalla, scenari: s, proiezione: s.proiezione, oggi, atteso: s.atteso, alto: s.alto, basso: s.basso }
        : { misto: true, fisso: true, senzaPrevisioni: true, dalla, oggi, atteso: oggi };
    }
    if (!variabile(p)) return { fisso: true, atteso: conti(null) };
    const proiezione = M.proiezioneIndice(p.indice_nome, p.numero_rate + 2, modello);
    if (!proiezione) return { manca: 'Per il tasso variabile serve un Euribor (1, 3, 6 o 12 mesi): degli altri indici il programma non ha lo storico per fare previsioni.' };
    return { fisso: false, proiezione, oggi: conti(() => proiezione.ultimo.valore),
      atteso: conti(proiezione.scenari.atteso), alto: conti(proiezione.scenari.alto80), basso: conti(proiezione.scenari.basso80) };
  }

  // Spese o assicurazione per rata grandi quasi quanto la rata: quasi sempre è la rata scritta nel campo sbagliato
  // (la rata la calcola il programma). Restituisce un avviso per campo: { chiave, testo }.
  function speseSospette(p, e) {
    const rata = e.atteso.prima - (p.spese_rata || 0);
    return [['spese_rata', 'Spese per ogni rata', 'le spese di incasso, di solito pochi euro'], ['assicurazione_rata', 'Assicurazione a ogni rata', 'il premio mensile di un\'assicurazione pagata a parte']]
      .filter(([chiave]) => p[chiave] >= 20 && p[chiave] >= 0.4 * rata)
      .map(([chiave, nome, cosa]) => ({ chiave, testo: `«${nome}» è ${euro(p[chiave])}, quasi quanto la rata (${euro(rata)}): forse lì hai scritto la rata. La rata la calcolo io da importo, durata e tasso; in quel campo vanno solo ${cosa}.` }));
  }
  // Il TAEG scritto nell'offerta coincide con il calcolo? Per il misto vale anche quello dei soli anni fissi: la banca
  // può scrivere l'uno o l'altro. Restituisce { uguale, mio, soloFissi }.
  function taegUguale(e, p) {
    const mio = e.misto || !e.fisso ? e.oggi.c.taeg : e.atteso.c.taeg, vicino = t => t != null && Math.abs(t - p.taeg_dichiarato) <= 0.00015;
    if (vicino(mio)) return { uguale: true, mio };
    const fissi = e.misto && e.oggi.c.periodoFisso ? e.oggi.c.periodoFisso.taeg : null;
    return vicino(fissi) ? { uguale: true, mio: fissi, soloFissi: true } : { uguale: false, mio };
  }
  M.calcolaOfferta = parametri => calcola({ parametri }, modelloScelto());
  M.speseSospette = speseSospette;
  M.taegUguale = taegUguale;

  // ---------- Tabella di confronto ----------
  // Le spese iniziali di un'offerta: il totale, poi una voce per riga (una sola: il suo nome), così le offerte si
  // confrontano voce per voce; in fondo quali restano fuori dal TAEG (notaio, agenzia immobiliare).
  function speseIniziali(e, p) {
    if (!(p.spese_iniziali > 0)) return ['—'];
    const voci = (p.spese_iniziali_voci || []).filter(v => v.euro > 0);
    const fuori = e.atteso.c.speseFuoriTaeg > 0 ? voci.filter(v => Calcolo.fuoriDalTaeg(v.cosa)).map(v => `«${v.cosa}»`) : [];
    return [euro(p.spese_iniziali), ...(voci.length === 1 ? [voci[0].cosa] : voci.map(v => `${v.cosa || 'altro'} ${euro(v.euro)}`)),
      ...(fuori.length ? [`${fuori.join(' e ')} fuori dal TAEG`] : [])].filter(Boolean);
  }
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
    const anni = p => p.anni_tasso_fisso === 1 ? '1 anno' : `${p.anni_tasso_fisso} anni`;
    const tasso = p => variabile(p) ? `${p.indice_nome} + ${perc(p.spread, 3, 1)}`
      : misto(p) ? `TAN ${perc(p.tasso_fisso, 3, 1)} per ${anni(p)}, poi ${p.spread_dopo != null ? `fisso nuovo o ${p.indice_nome || 'Euribor'} + ${perc(p.spread_dopo, 3, 1)}` : 'si rivede'}` : `TAN ${perc(p.tasso_fisso, 3, 1)}`;
    const righe = [
      riga('Tipo', null, (e, p) => [nomeTipo(p), piccolo(tasso(p))]),
      ...(offerte.some(o => o.parametri.anticipo > 0 && !variabile(o.parametri)) ? [riga('Anticipo', 'pagato subito, senza prestito', (e, p) => [p.anticipo > 0 ? euro(p.anticipo) : '—'])] : []),
      riga('Importo e durata', null, (e, p) => [euro(p.importo_iniziale), piccolo(durata(p))]),
      ...(offerte.some(o => conMaxirata(o.parametri)) ? [riga('Maxirata finale', 'l\'ultima rata', (e, p) => [conMaxirata(p) ? euro(e.atteso.righe[e.atteso.righe.length - 1].rataCalcolata) : '—'])] : []),
      riga('Prima rata', 'spese per rata comprese', e => [euro(e.atteso.prima)]),
      // A tasso fisso la rata è sempre quella (solo l'ultima, che chiude il debito, può cambiare di pochi euro).
      riga('Rata più alta prevista', 'per il variabile e il misto: se l\'indice sale (fascia alta dell\'80% dei casi)', (e, p) => e.misto
        ? (e.fisso ? [euro(e.atteso.prima), piccolo(`per ${anni(p)}; dopo non so stimarla`)] : [euro(e.alto.massima), piccolo(`dopo ${anni(p)}; nei primi la rata è ${euro(e.atteso.prima)}`)])
        : e.fisso ? [euro(e.atteso.prima), piccolo('sempre uguale')] : [euro(e.alto.massima)]),
      riga('Interessi', 'su tutto il prestito', e => e.fisso ? [euro(e.atteso.c.interessi)] : [euro(e.atteso.c.interessi), forbice(e, 'interessi')]),
      // Tasso misto: quanto resta da restituire alla fine del TAN, e quanto costano i soli anni fissi (la cifra degli esempi delle banche).
      ...(offerte.some(o => misto(o.parametri)) ? [riga('Alla fine degli anni fissi', 'per il tasso misto: il debito che resta, da pagare con il tasso nuovo', (e, p) => {
        const f = e.misto && e.oggi.c.periodoFisso;
        return f ? [euro(f.debitoDopo), piccolo(`dopo ${anni(p)}; in quegli anni paghi ${euro(f.costo)} di interessi e spese`)] : ['—'];
      })] : []),
      ...(offerte.some(o => o.parametri.spese_iniziali > 0) ? [riga('Spese iniziali', 'pagate una volta, all\'inizio', (e, p) => speseIniziali(e, p).map((t, i) => i ? piccolo(t) : t))] : []),
      riga('Spese e assicurazioni', 'tutte, anche quelle iniziali', e => [euro(e.atteso.c.costoTotale - e.atteso.c.interessi)]),
      riga('Costo totale', 'tutto quello che paghi oltre al capitale', e => e.fisso ? [crea('strong', {}, euro(e.atteso.c.costoTotale))] : [crea('strong', {}, euro(e.atteso.c.costoTotale)), forbice(e, 'costoTotale')]),
      riga('Totale da pagare', 'tutto quello che esce di tasca, spese comprese', e => [euro(e.atteso.c.totaleDaPagare)]),
      ...(offerte.some(o => o.parametri.anticipo > 0 && !variabile(o.parametri)) ? [riga('In tutto, con l\'anticipo', 'quanto paghi per l\'acquisto', (e, p) => [euro((variabile(p) ? 0 : p.anticipo || 0) + e.atteso.c.totaleDaPagare)])] : []),
      riga('TAEG', 'il costo totale in percentuale all\'anno', (e, p) => e.misto
        ? [perc(e.oggi.c.taeg, 2), piccolo(`con il TAN di oggi fino alla fine, come lo calcola la banca`
          + (e.oggi.c.periodoFisso ? `; sui soli ${anni(p)} fissi ${perc(e.oggi.c.periodoFisso.taeg, 2)}` : '') + (e.fisso ? '' : `; con le previsioni ${perc(e.atteso.c.taeg, 2)}`))]
        : e.fisso ? [perc(e.atteso.c.taeg, 2)]
          : [perc(e.oggi.c.taeg, 2), piccolo(`con l'indice di oggi, come lo calcola la banca; con le previsioni ${perc(e.atteso.c.taeg, 2)}`)]),
      ...(offerte.some(o => o.parametri.taeg_dichiarato > 0) ? [riga('TAEG dell\'offerta', 'quello scritto dalla banca', (e, p) => {
        if (!(p.taeg_dichiarato > 0)) return ['—'];
        const confronto = taegUguale(e, p);
        return [perc(p.taeg_dichiarato, 3, 2), piccolo(confronto.uguale ? '✓ coincide con il calcolo' + (confronto.soloFissi ? ` sui soli ${anni(p)} fissi` : '')
          : `diverso dal calcolo (${perc(confronto.mio, 2)}): controlla spese e assicurazioni`)];
      })] : []),
    ];
    const testa = crea('tr', {}, crea('td', {}), ...esiti.map(x => crea('th', { scope: 'col', className: x === migliore ? 'migliore' : '' },
      x.o.parametri.nome || 'Offerta', ...(x === migliore ? [crea('span', { className: 'etichetta-aperto' }, Icone.crea('stella', 'icona icona-mini'), 'costa meno')] : []))));
    const note = [];
    const diverse = calcolate.length > 1 && new Set(calcolate.map(x => `${x.o.parametri.importo_iniziale}|${mesi(x.o.parametri)}`)).size > 1;
    if (diverse) note.push(crea('p', { className: 'nota evidenza' }, 'Le offerte hanno importi o durate diversi: il costo totale non si può confrontare direttamente. Confronta il TAEG, oppure metti lo stesso importo e la stessa durata.'));
    else if (migliore) note.push(crea('p', { className: 'nota' }, `A parità di importo e durata costa meno «${migliore.o.parametri.nome || 'Offerta'}»${migliore.e.fisso ? '' : ' (con le previsioni sull\'indice: è una stima)'}. Guarda anche la rata più alta prevista: è quella che devi poterti permettere.`));
    if (esiti.some(x => !x.e.manca && !x.e.fisso)) {
      const x = esiti.find(y => !y.e.manca && !y.e.fisso);
      note.push(crea('p', { className: 'nota' }, `Per il tasso variabile, e per il misto dopo gli anni fissi, l'indice futuro è una stima, non una previsione sicura: oggi ${x.e.proiezione.nomeSerie} vale ${perc(x.e.proiezione.ultimo.valore, 3)}. `
        + 'Le cifre «fra … e …» sono la fascia in cui cade l\'80% dei casi secondo il modello scelto qui sotto.'));
    }
    // Tasso misto: che cosa vuol dire, come sono fatte le stime, e l'avviso sui conti dei soli anni fissi.
    for (const x of calcolate.filter(y => y.e.misto)) {
      const p = x.o.parametri, e = x.e;
      note.push(crea('p', { className: 'nota' }, `«${p.nome || 'Offerta'}» è a tasso misto: il TAN del ${perc(p.tasso_fisso, 3, 2)} vale solo per i primi ${anni(p)}, poi il tasso si rivede e oggi nessuno sa quanto sarà. `
        + (e.fisso ? `Per ${p.indice_nome || 'questo indice'} non ho lo storico per fare previsioni: i conti tengono il TAN di oggi fino alla fine.`
          : `Dopo, le stime seguono l'Euribor ${e.scenari.stimato ? 'partendo dal TAN di oggi (lo spread del variabile non è scritto: se lo trovi, scrivilo nella carta qui sotto)' : `più lo spread del variabile, ${perc(p.spread_dopo, 3, 2)}`}. `
            + `Se invece il tasso restasse quello di oggi fino alla fine, il costo totale sarebbe ${euro(e.oggi.c.costoTotale)} e la rata ${euro(e.oggi.prima)}.`)));
    }
    if (calcolate.some(x => x.e.misto && x.e.oggi.c.periodoFisso)) note.push(crea('p', { className: 'nota evidenza' },
      'Attenzione agli esempi delle banche sui mutui a tasso misto: il costo totale e il TAEG «illustrativo» spesso contano solo gli anni fissi, come se alla fine restituissi tutto il debito che resta. '
      + 'Per questo sembrano molto più bassi di quelli di un mutuo fisso. In questa tabella il costo totale conta tutta la durata; quello dei soli anni fissi è nella riga «Alla fine degli anni fissi».'));
    for (const x of calcolate) for (const s of speseSospette(x.o.parametri, x.e)) note.push(crea('p', { className: 'nota evidenza' }, `«${x.o.parametri.nome || 'Offerta'}»: ${s.testo} Correggilo nella sua carta, qui sotto.`));
    const mancanti = esiti.filter(x => x.e.manca);
    if (mancanti.length) note.push(...mancanti.map(x => crea('p', { className: 'nota evidenza' }, `«${x.o.parametri.nome || 'Offerta'}»: ${x.e.manca}`)));
    const scelta = crea('label', { className: 'campo-in-linea' }, 'Previsione dell\'indice per il variabile e il misto ',
      crea('select', { id: 'modello-offerte' }, ...MODELLI.map(([codice, nome]) => crea('option', { value: codice, selected: codice === modello }, nome))));
    contenitore.replaceChildren(
      crea('div', { className: 'scorri-offerte' }, crea('table', { className: 'tabella-offerte' }, crea('thead', {}, testa), crea('tbody', {}, ...righe))),
      ...note, ...(offerte.some(o => conPrevisioni(o.parametri)) ? [scelta] : []));
  }

  // ---------- Una carta per offerta, con i suoi dati ----------
  function cartaOfferta(o) {
    const p = o.parametri, campi = crea('div', { className: 'campi due-colonne' }, ...CAMPI_OFFERTA.map(k => M.campi.crea(k, p[k], false, p)));
    // Le spiegazioni lunghe dei campi restano come suggerimento al passaggio del mouse: la carta resta compatta.
    for (const aiuto of campi.querySelectorAll('label > small, .campo-spese > small')) { aiuto.parentElement.title = aiuto.textContent; aiuto.remove(); }
    const modulo = crea('form', { className: 'carta carta-offerta', 'data-offerta': o.id },
      crea('h3', {}, Icone.distintivo(M.iconaTipo(p)), crea('span', { className: 'nome-offerta' }, p.nome || 'Offerta')), campi,
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
        Icone.distintivo('offerte', 'grande'),
        crea('h3', {}, 'Come funziona'),
        crea('ol', { className: 'dopo' },
          crea('li', {}, 'Prima di firmare, la banca o la finanziaria ti deve consegnare un foglio informativo: il PIES per i mutui, il SECCI per i finanziamenti. Lì trovi importo, durata, tasso, spese e TAEG.'),
          crea('li', {}, 'Premi «Aggiungi un\'offerta»: ti chiedo quei numeri uno alla volta, e ti dico dove trovarli. Ripeti per ogni offerta che hai ricevuto.'),
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
      for (const o of Archivio.offerte().filter(x => conPrevisioni(x.parametri))) await Archivio.richiesta('PUT', 'offerte/' + o.id, { previsione_modello: evento.target.value });
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
      await Archivio.richiesta('PUT', 'offerte/' + o.id, { ...letti.valori, ...(conPrevisioni(letti.valori) ? { previsione_modello: modelloScelto() } : {}) });
    } catch (e) {
      errore.textContent = e.message;
      errore.hidden = false;
      return;
    }
    $('.nome-offerta', modulo).textContent = letti.valori.nome || 'Offerta';
    $('h3 .distintivo-icona', modulo).replaceWith(Icone.distintivo(M.iconaTipo({ ...o.parametri, ...letti.valori })));
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
  $('#aggiungi-offerta').addEventListener('click', () => M.apriGuidaOfferta());
  $('#segui-prestito-offerte').addEventListener('click', () => M.apriGuida(false));

  M.viste.push(disegna);
  M.allApertura.offerte = disegna;
})();
