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
    const ultima = stato.piano.righe[stato.piano.righe.length - 1], conMaxirata = !!ultima.maxirata;
    const righe = [
      ...(p.anticipo > 0 ? [riga('Anticipo', euro(p.anticipo), 'pagato subito al venditore: non è un prestito')] : []),
      riga('Importo prestato', euro(p.importo_iniziale)),
      ...(conMaxirata ? [riga('Maxirata finale', euro(ultima.rataCalcolata), `l'ultima rata, a ${M.meseAnno(ultima.inizio)}`)] : []),
      ...(c.ricevuto !== p.importo_iniziale ? [riga('Soldi ricevuti davvero', euro(c.ricevuto), 'il prestito meno quello che hai pagato all\'inizio')] : []),
      riga('Interessi', euro(c.interessi), variabile ? 'su tutte le rate: quelle future sono una stima' : 'su tutte le rate'),
      ...(c.speseRate > 0 ? [riga('Spese per rata', euro(c.speseRate), `${euro(p.spese_rata)} × ${stato.piano.righe.length} rate`)] : []),
      ...(c.speseIniziali > 0 ? [riga('Spese iniziali', euro(c.speseIniziali))] : []),
      ...(c.assicurazioni > 0 ? [riga('Assicurazioni', euro(c.assicurazioni))] : []),
      ...(c.speseAnnue > 0 ? [riga('Spese annuali', euro(c.speseAnnue))] : []),
      riga('Costo totale del prestito', euro(c.costoTotale), 'tutto quello che paghi oltre al capitale', 'totale'),
      riga('Totale da pagare', euro(c.totaleDaPagare), p.spese_nel_prestito && c.ricevuto !== p.importo_iniziale
        ? 'soldi ricevuti + costo totale: le spese iniziali sono già dentro le rate' : 'capitale + costo totale', 'totale'),
      ...(p.anticipo > 0 ? [riga('In tutto, con l\'anticipo', euro(p.anticipo + c.totaleDaPagare), 'quanto paghi per l\'acquisto, dal primo all\'ultimo euro', 'totale')] : []),
    ];
    const tassi = [
      ...(variabile ? [] : [riga('TAN', perc(p.tasso_fisso, 3, 1), 'il tasso usato per gli interessi')]),
      riga(variabile ? 'TAEG stimato' : 'TAEG calcolato', c.taeg == null ? '—' : perc(c.taeg, 2), 'il costo totale in percentuale all\'anno: serve a confrontare prestiti diversi'),
      ...(p.taeg_dichiarato > 0 ? [riga('TAEG del contratto', perc(p.taeg_dichiarato, 3, 2))] : []),
    ];
    const contenuto = [crea('h3', {}, Icone.crea('calcolatrice', 'icona icona-titolo'), 'Quanto costa questo prestito'),
      crea('table', { className: 'tabella-costi' }, crea('tbody', {}, ...righe, ...tassi))];
    contenuto.push(...giudizio(c, p, variabile));
    if (conMaxirata) contenuto.push(...spiegaMaxirata(c, p));
    carta.replaceChildren(...contenuto);
  }

  // Con la maxirata: il confronto con un finanziamento normale della stessa durata, e le strade alla fine.
  function spiegaMaxirata(c, p) {
    const nota = testo => crea('p', { className: 'nota' }, testo);
    const durata = p.numero_rate + 1;
    const dati = { ...stato.dati, parametri: { ...p, tipo_prestito: 'finanziamento', numero_rate: durata }, rate: [] };
    const righe = Calcolo.calcolaPiano(dati).righe, normale = Calcolo.costi(dati, righe, true);
    const rata = stato.piano.righe[0].rataCalcolata, inPiu = c.interessi - normale.interessi;
    return [
      nota(`Senza maxirata, con un finanziamento normale della stessa durata (${durata} rate) e allo stesso tasso, la rata sarebbe di ${euro(righe[0].rataCalcolata)} invece di ${euro(rata)}, `
        + `ma gli interessi sarebbero ${euro(normale.interessi)} invece di ${euro(c.interessi)}: ${euro(inPiu)} in meno. `
        + 'Con la maxirata la rata è più bassa perché una parte del debito la restituisci alla fine, ma su quella parte paghi gli interessi per tutta la durata.'),
      nota('Alla fine di solito le strade sono tre: pagare la maxirata; chiedere di rifinanziarla, cioè un nuovo prestito con nuovi interessi; '
        + 'oppure, se il contratto prevede il «valore futuro garantito», restituire l\'auto al venditore al posto della maxirata, rispettando i chilometri massimi e le condizioni dell\'auto scritte nel contratto. '
        + 'Conviene sapere prima di firmare quale strada è realistica per te.'),
    ];
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
    if (differenza > 0 && (p.tipo_prestito === 'finanziamento' || p.tipo_prestito === 'maxirata')) frasi.push(nota('Nei finanziamenti ai consumatori la legge (articolo 125-bis del Testo unico bancario) considera nulle le clausole sui costi che non sono stati inclusi, o sono stati inclusi male, nel TAEG indicato. '
      + 'Se la differenza resta anche con i dati giusti, può valere la pena di chiedere un parere a un\'associazione dei consumatori.'));
    return frasi;
  }

  // ---------- Estinzione anticipata: quanto si risparmia rimborsando tutto o una parte ----------
  // Si rimborsa subito dopo aver pagato una rata (niente interessi di pochi giorni da aggiungere). Le regole di legge:
  // - mutui per la casa o per un'attività di persone fisiche: nessuna penale (art. 120-ter TUB, contratti dal 2007);
  // - finanziamenti ai consumatori (art. 125-sexies TUB): indennizzo fino all'1% della somma rimborsata se mancano più
  //   di 12 mesi, fino allo 0,5% altrimenti, mai oltre gli interessi che restavano da pagare; non è dovuto se si
  //   rimborsa tutto il debito e non supera 10.000 €. Si ha diritto alla riduzione di tutti i costi in proporzione alla
  //   durata residua, imposte escluse: qui si stima in proporzione ai mesi che restano e alla parte di debito rimborsata;
  // - assicurazione pagata all'inizio: la parte di premio del periodo che resta va restituita (stima, stesso criterio).
  const scelta = { dopo: null, tutto: true, importo: '', modo: 'rata', penale: '', prestito: null };
  const somma = (lista, valore) => lista.reduce((s, x) => s + valore(x), 0);

  function simula(dati, righe) {
    const p = dati.parametri, dopo = scelta.dopo, futuri = righe.slice(dopo);
    if (!futuri.length) return null;
    const debito = futuri[0].debito;
    const letto = M.leggiNumero(scelta.importo, true);
    const importo = scelta.tutto ? debito : Math.min(typeof letto === 'number' && letto > 0 ? letto : 0, debito);
    if (!(importo > 0)) return { debito, importo: 0 };
    const tutto = importo >= debito - 0.005, parte = importo / debito, rimaste = futuri.length;
    const interessiDi = r => r.rataCalcolata - r.quotaCapitale - p.spese_rata;
    const interessiPrima = somma(futuri, interessiDi);
    let interessiDopo = 0, rateDopo = 0, rataNuova = null;
    if (tutto) rateDopo = 0;
    else if (scelta.modo === 'rata') {
      // Stessa fine, rata più bassa: quote e interessi scendono nella stessa proporzione del debito.
      interessiDopo = interessiPrima * (1 - parte);
      rateDopo = rimaste;
      rataNuova = (futuri[0].rataCalcolata - p.spese_rata) * (1 - parte) + p.spese_rata;
    } else {
      // Stessa rata, fine prima: ogni mese si paga la stessa cifra di prima su un debito più basso.
      let resto = debito - importo;
      for (const r of futuri) {
        if (resto <= 0.005) break;
        const interesse = resto * interessiDi(r) / r.debito;
        interessiDopo += interesse;
        rateDopo++;
        resto += interesse - (r.rataCalcolata - p.spese_rata);
      }
    }
    // Penale o indennizzo.
    const finanziamento = p.tipo_prestito === 'finanziamento' || p.tipo_prestito === 'maxirata';
    let percentuale, motivo;
    if (!finanziamento) { percentuale = 0; motivo = 'Per i mutui per la casa o per un\'attività di una persona fisica la legge vieta la penale (art. 120-ter del Testo unico bancario, contratti dal 2007). Se il tuo mutuo è di altro tipo, scrivi la penale del contratto.'; }
    else if (tutto && importo <= 10000) { percentuale = 0; motivo = 'Nessun indennizzo: rimborsi tutto il debito e non supera 10.000 € (art. 125-sexies del Testo unico bancario).'; }
    else {
      percentuale = rimaste > 12 ? 0.01 : 0.005;
      motivo = `Indennizzo massimo previsto dalla legge (art. 125-sexies del Testo unico bancario): ${rimaste > 12 ? 'l\'1%, perché mancano più di 12 mesi alla fine' : 'lo 0,5%, perché manca un anno o meno alla fine'}, e mai più degli interessi che restavano da pagare. La banca può chiedere meno, o niente.`;
    }
    const scritta = M.leggiNumero(scelta.penale);
    const aMano = typeof scritta === 'number' && !Number.isNaN(scritta) && scritta >= 0;
    const penale = aMano ? importo * scritta / 100 : Math.min(importo * percentuale, interessiPrima);
    // Costi restituiti (stima) e spese che non si pagano più.
    const residuo = rimaste / righe.length;
    const costiRestituiti = (finanziamento ? (p.spese_iniziali || 0) * residuo * parte : 0);
    const assicurazioneRestituita = (p.assicurazione_iniziale || 0) * residuo * parte;
    const rateTolte = rimaste - rateDopo;
    const annueTolte = futuri.slice(rateDopo).filter(r => r.n % 12 === 0).length;
    const speseTolte = rateTolte * ((p.spese_rata || 0) + (p.assicurazione_rata || 0)) + annueTolte * (p.spese_annue || 0);
    const interessiTolti = interessiPrima - interessiDopo;
    return {
      debito, importo, tutto, penale, percentuale, motivo, aMano, interessiTolti, speseTolte, costiRestituiti, assicurazioneRestituita,
      risparmio: interessiTolti + speseTolte + costiRestituiti + assicurazioneRestituita - penale,
      daPagare: importo + penale - costiRestituiti - assicurazioneRestituita,
      rataNuova, rateDopo, rateTolte, fineNuova: rateDopo ? futuri[rateDopo - 1].inizio : null, primaRata: futuri[0],
    };
  }

  function disegnaEstinzione() {
    const carta = $('#estinzione');
    if (!carta || !stato.piano) return;
    const righe = stato.piano.righe, p = stato.dati.parametri;
    // Rate dopo le quali si può rimborsare: dall'ultima già passata (o in corso) fino alla penultima.
    const prima = Math.max(1, righe.findIndex(r => r.fine >= stato.oggi) + 1);
    // Un altro prestito: si riparte da capo. Una rata non più valida (il mese è passato): si passa alla prima possibile.
    if (scelta.prestito !== stato.dati.id) Object.assign(scelta, { dopo: null, tutto: true, importo: '', modo: 'rata', penale: '', prestito: stato.dati.id });
    if (scelta.dopo == null || scelta.dopo < prima || scelta.dopo >= righe.length) scelta.dopo = Math.min(prima, righe.length - 1);
    if (righe.length < 2 || prima >= righe.length) { carta.replaceChildren(crea('h3', {}, 'Estinzione anticipata'), crea('p', { className: 'nota' }, 'Il prestito è alla fine: non c\'è più niente da estinguere in anticipo.')); return; }
    const esito = simula(stato.dati, righe);
    // Il modulo si ridisegna solo se non lo si sta compilando (altrimenti cambiano soltanto i risultati), oppure se
    // sono cambiati il prestito o le rate fra cui scegliere.
    const chiave = `${stato.dati.id}|${prima}|${righe.length}`;
    if (!carta.contains(document.activeElement) || !$('#form-estinzione', carta) || carta.dataset.chiave !== chiave) {
      carta.dataset.chiave = chiave;
      const opzioni = righe.slice(prima - 1, -1).map(r => crea('option', { value: r.n, selected: r.n === scelta.dopo }, `dopo la rata ${r.n}, di ${M.meseAnno(r.inizio)}`));
      const radio = (nome, valore, testo, attivo) => crea('label', { className: 'spunta' }, crea('input', { type: 'radio', name: nome, value: valore, checked: attivo }), crea('span', {}, testo));
      carta.replaceChildren(
        crea('h3', {}, Icone.crea('fulmine', 'icona icona-titolo'), 'Estinzione anticipata: quanto risparmi'),
        crea('p', { className: 'nota' }, 'Se ti avanza una somma, puoi restituire alla banca tutto il debito o una parte, prima della fine. Risparmi gli interessi che avresti pagato su quella somma, e se è un finanziamento ti restituiscono una parte dei costi. Qui vedi i conti prima di chiederlo alla banca.'),
        crea('form', { id: 'form-estinzione', className: 'campi' },
          crea('label', {}, 'Quando', crea('select', { name: 'dopo' }, ...opzioni), crea('small', {}, 'Si rimborsa subito dopo aver pagato quella rata.')),
          crea('fieldset', { className: 'scelte-in-linea' }, crea('legend', {}, 'Quanto'),
            radio('quanto', 'tutto', 'Tutto il debito', scelta.tutto), radio('quanto', 'parte', 'Una parte', !scelta.tutto),
            crea('input', { type: 'text', inputMode: 'decimal', name: 'importo', value: scelta.importo, placeholder: 'es. 10.000', 'aria-label': 'Somma da rimborsare (€)', hidden: scelta.tutto })),
          crea('fieldset', { className: 'scelte-in-linea', id: 'modo-estinzione', hidden: scelta.tutto }, crea('legend', {}, 'Dopo il rimborso'),
            radio('modo', 'rata', 'Rata più bassa, stessa fine', scelta.modo === 'rata'), radio('modo', 'durata', 'Stessa rata, finisci prima', scelta.modo === 'durata')),
          crea('label', {}, 'Penale o indennizzo del contratto (%)', crea('input', { type: 'text', inputMode: 'decimal', name: 'penale', value: scelta.penale, placeholder: 'quella di legge' }),
            crea('small', {}, 'Lascia vuoto per usare la regola di legge, spiegata sotto.'))),
        crea('div', { id: 'esito-estinzione', className: 'blocco' }));
    }
    disegnaEsitoEstinzione(esito, p);
  }

  function disegnaEsitoEstinzione(e, p) {
    const blocco = $('#esito-estinzione');
    if (!e || !e.importo) { blocco.replaceChildren(crea('p', { className: 'nota' }, `Debito residuo in quel momento: ${euro(e ? e.debito : 0)}. Scrivi quanto vuoi rimborsare.`)); return; }
    const riga = (etichetta, valore, spiegazione, classe = '') => crea('tr', { className: classe },
      crea('th', { scope: 'row' }, etichetta, ...(spiegazione ? [crea('small', {}, spiegazione)] : [])), crea('td', {}, valore));
    const variabile = M.variabile(), stima = variabile ? ' (stima: dipende dall\'indice)' : '';
    const righe = [
      riga('Debito residuo in quel momento', euro(e.debito)),
      riga(e.tutto ? 'Rimborsi tutto' : 'Rimborsi', euro(e.importo)),
      riga(e.aMano ? 'Penale del contratto' : 'Penale o indennizzo', euro(e.penale), e.aMano ? null : e.percentuale ? `fino al ${perc(e.percentuale, 1)} della somma rimborsata` : 'non dovuta'),
      ...(e.costiRestituiti > 0.004 ? [riga('Costi iniziali restituiti', '− ' + euro(e.costiRestituiti), 'stima, in proporzione ai mesi che restano e alla parte rimborsata')] : []),
      ...(e.assicurazioneRestituita > 0.004 ? [riga('Assicurazione restituita', '− ' + euro(e.assicurazioneRestituita), 'la parte di premio del periodo che resta (stima)')] : []),
      riga('Da pagare il giorno del rimborso', euro(e.daPagare), null, 'totale'),
      riga('Interessi che non paghi più', euro(e.interessiTolti), 'rispetto al piano di adesso' + stima),
      ...(e.speseTolte > 0.004 ? [riga('Spese e assicurazioni che non paghi più', euro(e.speseTolte))] : []),
      riga('Risparmio', euro(e.risparmio), 'interessi e spese che non paghi, più i costi restituiti, meno la penale', 'totale'),
    ];
    const dopo = e.tutto ? 'Il prestito è chiuso: non paghi più nessuna rata' + (p.tipo_prestito === 'maxirata' ? ', né la maxirata.' : '.')
      : p.tipo_prestito === 'maxirata' && e.rataNuova != null ? `Dopo il rimborso la rata passa da ${euro(e.primaRata.rataCalcolata)} a circa ${euro(e.rataNuova)}, e anche la maxirata scende nella stessa proporzione.`
      : e.rataNuova != null ? `Dopo il rimborso la rata passa da ${euro(e.primaRata.rataCalcolata)} a circa ${euro(e.rataNuova)}, fino alla stessa ultima rata.`
        : `Dopo il rimborso la rata resta di circa ${euro(e.primaRata.rataCalcolata)}, ma finisci ${e.rateTolte === 1 ? 'una rata' : e.rateTolte + ' rate'} prima: l'ultima è a ${M.meseAnno(e.fineNuova)}.`;
    blocco.replaceChildren(crea('table', { className: 'tabella-costi' }, crea('tbody', {}, ...righe)),
      crea('p', { className: 'nota' }, dopo),
      ...(e.aMano ? [] : [crea('p', { className: 'nota' }, e.motivo)]),
      crea('p', { className: 'nota piccola' }, 'Sono stime: la banca fa i conti alla data esatta del rimborso (con gli interessi dei giorni dopo l\'ultima rata) e con i criteri del contratto. '
        + (variabile ? 'Per il variabile gli interessi futuri dipendono dall\'indice, come nel piano. ' : '')
        + 'Prima di decidere chiedi alla banca il conteggio di estinzione.'));
  }

  // Ogni cambiamento del modulo aggiorna subito i conti.
  document.addEventListener('input', aggiornaScelta);
  document.addEventListener('change', aggiornaScelta);
  function aggiornaScelta(evento) {
    const modulo = evento.target.closest && evento.target.closest('#form-estinzione');
    if (!modulo) return;
    scelta.dopo = +modulo.dopo.value;
    scelta.tutto = modulo.quanto.value === 'tutto';
    scelta.importo = modulo.importo.value;
    scelta.modo = modulo.modo.value;
    scelta.penale = modulo.penale.value;
    modulo.importo.hidden = scelta.tutto;
    $('#modo-estinzione').hidden = scelta.tutto;
    if (evento.type === 'change' && evento.target.name === 'quanto' && !scelta.tutto) modulo.importo.focus();
    disegnaEsitoEstinzione(simula(stato.dati, stato.piano.righe), stato.dati.parametri);
  }

  M.viste.push(disegna, disegnaEstinzione);
})();
