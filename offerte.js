// Scheda «Offerte»: per chi deve ancora firmare, il confronto fra le offerte di banche e finanziarie. Per ogni offerta
// il piano completo, come se partisse il mese prossimo: rata, interessi, costo totale e TAEG, uno accanto all'altro.
// Per il tasso variabile l'indice futuro viene da un modello (previsioni.js, M.proiezioneIndice), in tre scenari, e c'è
// anche il conto con l'indice fermo a oggi, che è quello con cui la banca calcola il suo TAEG.
// Il tasso misto ha il TAN per i primi anni, poi i tre scenari dell'Euribor (M.scenariMisto); il conto con il TAN di
// oggi fino alla fine è quello del TAEG della banca, e c'è anche il TAEG dei soli anni fissi.
// Un'offerta nuova si aggiunge con la guida (configura.js, M.apriGuidaOfferta), una domanda per pagina; dopo si corregge
// nella sua carta.
// Le offerte stanno a famiglie (FAMIGLIE: mutui per la casa; prestiti e finanziamenti), perché un mutuo e un prestito
// personale non si confrontano. In ogni famiglia l'utente sceglie quali offerte mettere nel confronto (campo «confronta»
// dell'offerta, 1 o 0): la tabella e «costa meno» contano solo quelle; le carte ci sono tutte.
(function () {
  'use strict';
  const M = window.Mutuo, { stato, $, crea, euro, perc, avvisa } = M;
  const CAMPI_OFFERTA = ['nome', 'tipo_prestito', 'importo_iniziale', 'numero_rate', 'maxirata', 'anticipo', 'tasso_fisso', 'anni_tasso_fisso', 'spread_dopo', 'indice_nome', 'spread',
    'spese_iniziali', 'spese_rata', 'spese_annue', 'assicurazione_iniziale', 'spese_nel_prestito', 'assicurazione_rata', 'assicurazione_facoltativa', 'arrotonda_rata', 'taeg_dichiarato'];
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
  const anni = p => p.anni_tasso_fisso === 1 ? '1 anno' : `${p.anni_tasso_fisso} anni`;
  const tasso = p => variabile(p) ? `${p.indice_nome} + ${perc(p.spread, 3, 1)}`
    : misto(p) ? `TAN ${perc(p.tasso_fisso, 3, 1)} per ${anni(p)}, poi ${p.spread_dopo != null ? `fisso nuovo o ${p.indice_nome || 'Euribor'} + ${perc(p.spread_dopo, 3, 1)}` : 'si rivede'}` : `TAN ${perc(p.tasso_fisso, 3, 1)}`;
  // Le famiglie: si confrontano solo offerte della stessa. I mutui (fisso, variabile, misto) fra loro; i prestiti e i
  // finanziamenti (personale, auto anche con maxirata, acquisto a rate, cessione del quinto) fra loro.
  const FAMIGLIE = [
    { codice: 'mutuo', nome: 'Mutui per la casa', icona: 'casa', testo: 'A tasso fisso, variabile o misto. Per la stessa casa, con lo stesso importo e la stessa durata, si confrontano fra loro.' },
    { codice: 'finanziamento', nome: 'Prestiti e finanziamenti', icona: 'portafoglio', testo: 'Prestito personale, auto (anche con la maxirata), acquisto a rate, cessione del quinto. Importi e durate molto più piccoli di un mutuo: si confrontano fra loro, non con un mutuo.' },
  ];
  const famiglia = p => ['variabile', 'fisso', 'misto', 'mutuo'].includes(p.tipo_prestito) ? 'mutuo' : 'finanziamento';
  const nelConfronto = p => p.confronta !== 0;
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
  // Chiesto dall'autore: se il TAEG scritto nell'offerta è più alto del calcolo, la banca conta delle spese che non sono
  // state scritte, e il programma propone quanto aggiungere. Dal solo TAEG non si sa che spesa è: si dice quanto vale
  // come spesa in più a ogni rata o come spesa all'inizio (Calcolo.speseMancanti), al centesimo. «probabile» è quella da
  // proporre per prima: nei mutui di solito mancano spese di ogni mese o di ogni anno (incasso, gestione della pratica,
  // polizza incendio), nei finanziamenti spese o assicurazioni pagate all'inizio. «troppe»: servirebbe più di un quarto
  // della rata, troppo per qualche spesa dimenticata; più probabilmente è sbagliato il tasso, l'importo o la durata.
  // Null se il TAEG dell'offerta non c'è, coincide o è più basso.
  function speseMancanti(e, p) {
    if (!e || e.manca || !(p.taeg_dichiarato > 0) || taegUguale(e, p).uguale) return null;
    const conti = e.misto || !e.fisso ? e.oggi : e.atteso, m = Calcolo.speseMancanti(conti.c, p.taeg_dichiarato);
    if (!m || Calcolo.centesimi(m.aOgniRata) < 0.01) return null;
    const finanziamento = p.tipo_prestito === 'finanziamento' || conMaxirata(p);
    return { aOgniRata: Calcolo.centesimi(m.aOgniRata), allInizio: Calcolo.centesimi(m.allInizio), probabile: finanziamento ? 'inizio' : 'rata',
      troppe: m.aOgniRata > 0.25 * (conti.prima - (p.spese_rata || 0)) };
  }
  // I campi cambiati dalla stima: «rata» la somma alle spese per rata; «inizio» la aggiunge alle spese iniziali come voce
  // a sé, con un nome che dice che è una stima. Un totale scritto senza voci diventa una voce senza nome.
  const STIMA = 'Spese che mancano (stima)';
  function conStima(p, m, come) {
    if (come === 'rata') return { spese_rata: Calcolo.centesimi((p.spese_rata || 0) + m.aOgniRata) };
    const voci = (p.spese_iniziali_voci || []).length ? p.spese_iniziali_voci.map(v => ({ ...v })) : p.spese_iniziali > 0 ? [{ cosa: '', euro: p.spese_iniziali }] : [];
    const stima = voci.find(v => v.cosa === STIMA);
    if (stima) stima.euro = Calcolo.centesimi(stima.euro + m.allInizio); else voci.push({ cosa: STIMA, euro: m.allInizio });
    return { spese_iniziali: Calcolo.centesimi(voci.reduce((s, v) => s + v.euro, 0)), spese_iniziali_voci: voci };
  }
  // La proposta, per il riepilogo della guida e per il confronto: che cosa manca, dove cercarlo, «dove» scrivere le spese
  // vere, e i pulsanti per aggiungere la stima (data-stima; nel confronto anche data-offerta-stima), la più probabile per prima.
  function propostaSpese(p, e, m, dove, offerta) {
    const mio = taegUguale(e, p).mio, chi = offerta ? `«${p.nome || 'Offerta'}»: il` : 'Il';
    const differenza = `${chi} TAEG scritto nell'offerta è ${perc(p.taeg_dichiarato, 2)}, il mio calcolo dà ${perc(mio, 2)}`;
    if (m.troppe) return [crea('p', { className: 'nota evidenza' }, `${differenza}: per arrivarci mancherebbero circa ${euro(m.aOgniRata)} a ogni rata, troppo per qualche spesa dimenticata. `
      + 'Controlla tasso, importo e durata: la rata che calcolo deve essere uguale a quella dell\'offerta.')];
    const tipiche = p.tipo_prestito === 'finanziamento' || conMaxirata(p)
      ? 'Nei finanziamenti di solito sono l\'istruttoria, l\'imposta di bollo, le spese di incasso e le assicurazioni obbligatorie'
      : 'Nei mutui di solito sono le spese di incasso e di gestione della pratica, quelle di ogni anno (rendiconto, certificazione degli interessi), la polizza incendio e scoppio (obbligatoria per legge) e l\'assicurazione che a volte serve per avere quel tasso';
    const pulsante = come => crea('button', { type: 'button', className: 'secondario piccolo', 'data-stima': come, ...(offerta ? { 'data-offerta-stima': offerta } : {}) },
      come === 'rata' ? `Aggiungi ${euro(m.aOgniRata)} a ogni rata` : `Aggiungi ${euro(m.allInizio)} all'inizio`);
    return [crea('p', { className: 'nota evidenza' }, `${differenza}: la banca conta delle spese che non hai scritto. Se la rata è uguale a quella dell'offerta, importo, durata e tasso sono giusti: mancano solo quelle spese.`),
      crea('p', { className: 'nota' }, `Per arrivare al ${perc(p.taeg_dichiarato, 2)} mancano circa ${euro(m.aOgniRata)} a ogni rata, oppure ${euro(m.allInizio)} pagati all'inizio. `
        + `${tipiche}: cercale nel foglio informativo, fra i costi compresi nel TAEG, e ${dove}. `
        + (variabile(p) ? 'Nel tasso variabile la differenza può venire anche dall\'indice: la banca usa il valore del giorno in cui ha preparato l\'offerta. ' : '')
        + 'Se non le trovi, aggiungi la stima: il confronto con le altre offerte sarà più giusto.'),
      crea('div', { className: 'azioni azioni-stima' }, ...(m.probabile === 'rata' ? ['rata', 'inizio'] : ['inizio', 'rata']).map(pulsante))];
  }
  M.calcolaOfferta = parametri => calcola({ parametri }, modelloScelto());
  M.speseSospette = speseSospette;
  M.taegUguale = taegUguale;
  Object.assign(M, { speseMancanti, conStima, propostaSpese });

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
  // L'offerta che costa meno, se se ne possono confrontare almeno due.
  const piuEconomica = esiti => { const c = esiti.filter(x => !x.e.manca); return c.length > 1 ? c.reduce((a, b) => b.e.atteso.c.costoTotale < a.e.atteso.c.costoTotale ? b : a) : null; };
  // «tutte»: le offerte della famiglia con i loro conti ({ o, e }), «esiti»: quelle nel confronto, «migliore»: quella
  // che costa meno fra queste (piuEconomica). In cima, la scelta di quali confrontare: un pulsante per offerta.
  function disegnaTabella(contenitore, tutte, esiti, migliore) {
    const offerte = esiti.map(x => x.o), modello = modelloScelto(), calcolate = esiti.filter(x => !x.e.manca);
    const scelta = crea('div', { className: 'colonne-extra scelta-confronto', role: 'group', 'aria-label': 'Quali offerte confrontare' },
      crea('span', {}, `Nel confronto: ${esiti.length} su ${tutte.length}`),
      ...tutte.map(x => crea('button', { type: 'button', 'data-confronta': x.o.id, 'aria-pressed': String(nelConfronto(x.o.parametri)),
        title: nelConfronto(x.o.parametri) ? 'Nel confronto: premi per toglierla' : 'Fuori dal confronto: premi per metterla' }, x.o.parametri.nome || 'Offerta')),
      ...(esiti.length < tutte.length ? [crea('button', { type: 'button', className: 'tutte-confronto', 'data-confronta-tutte': tutte[0] ? famiglia(tutte[0].o.parametri) : '' }, 'Tutte')] : []));
    if (!esiti.length) return contenitore.replaceChildren(scelta, crea('p', { className: 'nota' }, 'Nessuna offerta nel confronto: premi il nome di un\'offerta qui sopra per metterla.'));
    const piccolo = testo => crea('small', {}, testo);
    const cella = (x, contenuto) => crea('td', { className: x === migliore ? 'migliore' : '' }, ...contenuto);
    const riga = (titolo, spiegazione, valore) => crea('tr', {}, crea('th', { scope: 'row' }, titolo, ...(spiegazione ? [piccolo(spiegazione)] : [])),
      ...esiti.map(x => x.e.manca ? crea('td', { className: 'manca' }, '—') : cella(x, valore(x.e, x.o.parametri))));
    const forbice = (e, campo) => piccolo(`fra ${euro(e.basso.c[campo])} e ${euro(e.alto.c[campo])}`);
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
        const confronto = taegUguale(e, p), m = speseMancanti(e, p);
        return [perc(p.taeg_dichiarato, 3, 2), piccolo(confronto.uguale ? '✓ coincide con il calcolo' + (confronto.soloFissi ? ` sui soli ${anni(p)} fissi` : '')
          : `diverso dal calcolo (${perc(confronto.mio, 2)}): ` + (!m ? 'controlla spese e assicurazioni' : m.troppe ? 'controlla tasso, importo e durata' : 'mancano delle spese, guarda sotto la tabella'))];
      })] : []),
    ];
    const testa = crea('tr', {}, crea('td', {}), ...esiti.map(x => crea('th', { scope: 'col', className: x === migliore ? 'migliore' : '' },
      x.o.parametri.nome || 'Offerta', ...(x === migliore ? [crea('span', { className: 'etichetta-aperto' }, Icone.crea('stella', 'icona icona-mini'), 'costa meno')] : []))));
    const note = [];
    if (esiti.length === 1) note.push(crea('p', { className: 'nota' }, 'Una sola offerta nel confronto: mettine almeno due (premi i nomi qui sopra) per vedere quale costa meno.'));
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
          : `Dopo, le stime seguono l'Euribor ${e.scenari.stimato ? 'partendo dal TAN di oggi (lo spread del variabile non è scritto: se lo trovi, scrivilo con «Cambia i dati» nella sua carta, qui sotto)' : `più lo spread del variabile, ${perc(p.spread_dopo, 3, 2)}`}. `
            + `Se invece il tasso restasse quello di oggi fino alla fine, il costo totale sarebbe ${euro(e.oggi.c.costoTotale)} e la rata ${euro(e.oggi.prima)}.`)));
    }
    if (calcolate.some(x => x.e.misto && x.e.oggi.c.periodoFisso)) note.push(crea('p', { className: 'nota evidenza' },
      'Attenzione agli esempi delle banche sui mutui a tasso misto: il costo totale e il TAEG «illustrativo» spesso contano solo gli anni fissi, come se alla fine restituissi tutto il debito che resta. '
      + 'Per questo sembrano molto più bassi di quelli di un mutuo fisso. In questa tabella il costo totale conta tutta la durata; quello dei soli anni fissi è nella riga «Alla fine degli anni fissi».'));
    for (const x of calcolate) for (const s of speseSospette(x.o.parametri, x.e)) note.push(crea('p', { className: 'nota evidenza' }, `«${x.o.parametri.nome || 'Offerta'}»: ${s.testo} Correggilo con «Cambia i dati» nella sua carta, qui sotto.`));
    // Le spese che mancano per arrivare al TAEG dell'offerta, con la stima da aggiungere; dopo il clic, che cosa si è aggiunto.
    for (const x of calcolate) {
      const p = x.o.parametri, m = speseMancanti(x.e, p);
      if (m) note.push(...propostaSpese(p, x.e, m, 'scrivile con «Cambia i dati» nella sua carta, qui sotto', x.o.id));
      else if (stimaAggiunta && stimaAggiunta.id === x.o.id && taegUguale(x.e, p).uguale) note.push(crea('p', { className: 'nota conferma' },
        `✓ «${p.nome || 'Offerta'}»: ho aggiunto ${stimaAggiunta.testo}, e ora il TAEG torna con quello dell'offerta. È una stima: se trovi le spese vere nel foglio informativo, correggile con «Cambia i dati» nella sua carta, qui sotto.`));
    }
    const mancanti = esiti.filter(x => x.e.manca);
    if (mancanti.length) note.push(...mancanti.map(x => crea('p', { className: 'nota evidenza' }, `«${x.o.parametri.nome || 'Offerta'}»: ${x.e.manca}`)));
    const modelloTendina = crea('label', { className: 'campo-in-linea' }, 'Previsione dell\'indice per il variabile e il misto ',
      crea('select', { className: 'modello-offerte' }, ...MODELLI.map(([codice, nome]) => crea('option', { value: codice, selected: codice === modello }, nome))));
    contenitore.replaceChildren(scelta,
      crea('div', { className: 'scorri-offerte' }, crea('table', { className: 'tabella-offerte' }, crea('thead', {}, testa), crea('tbody', {}, ...righe))),
      ...note, ...(offerte.some(o => conPrevisioni(o.parametri)) ? [modelloTendina] : []));
  }

  // ---------- Le offerte una per una ----------
  // Chiesto dall'autore: come i prestiti, per ogni offerta un riassunto (che cos'è, rata, importo, costo totale, spese);
  // «Cambia i dati» apre il modulo di quella sola offerta, a tutta larghezza, e «Salva» o «Annulla» lo chiudono.
  // Prima le carte erano tutte moduli aperti, uno accanto all'altro.
  let inModifica = null;   // l'offerta con il modulo aperto
  const taegCalcolato = e => e.misto || !e.fisso ? e.oggi.c.taeg : e.atteso.c.taeg;
  function speseInParole(p) {
    const spese = [[p.spese_iniziali, 'all\'inizio'], [p.spese_rata, 'a ogni rata'], [p.spese_annue, 'ogni anno']].filter(([v]) => v > 0).map(([v, quando]) => `${euro(v)} ${quando}`);
    const assicurazioni = [[p.assicurazione_iniziale, 'all\'inizio'], [p.assicurazione_rata, 'a ogni rata']].filter(([v]) => v > 0).map(([v, quando]) => `${euro(v)} ${quando}`);
    return `Spese: ${spese.length ? spese.join(', ') : 'nessuna scritta'}.`
      + (assicurazioni.length ? ` Assicurazioni: ${assicurazioni.join(', ')}${p.assicurazione_facoltativa ? ' (facoltative)' : ''}.` : '');
  }
  function cartaOfferta({ o, e }, economica) {
    const p = o.parametri, confronto = !e.manca && p.taeg_dichiarato > 0 ? taegUguale(e, p) : null;
    const voce = (etichetta, valore, dettaglio) => crea('div', { className: 'dato' }, crea('span', { className: 'etichetta' }, etichetta),
      crea('span', { className: 'valore' }, valore), ...(dettaglio ? [crea('span', { className: 'dettaglio' }, dettaglio)] : []));
    const dentro = nelConfronto(p);
    return crea('article', { className: 'carta carta-prestito carta-offerta' + (dentro ? '' : ' fuori-confronto'), 'data-offerta': o.id },
      crea('header', {}, Icone.distintivo(M.iconaTipo(p)),
        crea('div', { className: 'testa-prestito' }, crea('h3', {}, p.nome || 'Offerta'), crea('p', { className: 'nota' }, `${nomeTipo(p)} · ${tasso(p)}`)),
        ...(economica ? [crea('span', { className: 'etichetta-aperto' }, Icone.crea('stella', 'icona icona-mini'), 'costa meno')] : [])),
      e.manca ? crea('p', { className: 'nota evidenza' }, e.manca) : crea('div', { className: 'numeri-prestito' },
        voce('Rata', euro(e.atteso.prima), e.misto ? `per ${anni(p)}` : conMaxirata(p) ? 'più la maxirata finale' : e.fisso ? 'sempre uguale' : `fino a ${euro(e.alto.massima)}`),
        voce('Importo', euro(p.importo_iniziale), durata(p)),
        voce('Costo totale', euro(e.atteso.c.costoTotale), `TAEG ${perc(taegCalcolato(e), 2)}`)),
      crea('p', { className: 'nota riga-offerta' }, speseInParole(p)),
      ...(confronto ? [crea('p', { className: 'nota riga-offerta' }, `TAEG dell'offerta ${perc(p.taeg_dichiarato, 2)}: `
        + (confronto.uguale ? '✓ coincide con il calcolo.' : 'diverso dal calcolo, guarda le note sotto la tabella.'))] : []),
      crea('div', { className: 'azioni' },
        crea('button', { type: 'button', 'data-modifica-offerta': o.id }, Icone.crea('matita', 'icona icona-aggiunta'), 'Cambia i dati'),
        crea('button', { type: 'button', className: 'secondario piccolo', 'data-confronta': o.id, 'aria-pressed': String(dentro),
          title: dentro ? 'Questa offerta è nel confronto: premi per toglierla' : 'Questa offerta è fuori dal confronto: premi per metterla' }, dentro ? '✓ Nel confronto' : 'Metti nel confronto'),
        crea('button', { type: 'button', className: 'secondario piccolo', 'data-segui': o.id }, 'Segui questo prestito'),
        crea('button', { type: 'button', className: 'pericoloso piccolo', 'data-elimina-offerta': o.id }, 'Elimina')));
  }
  // Il modulo dell'offerta aperta, con i campi della guida (M.campi, da configura.js).
  function moduloOfferta(o) {
    const p = o.parametri, campi = crea('div', { className: 'campi due-colonne' }, ...CAMPI_OFFERTA.map(k => M.campi.crea(k, p[k], false, p)));
    // Le spiegazioni lunghe dei campi restano come suggerimento al passaggio del mouse: il modulo resta compatto.
    for (const aiuto of campi.querySelectorAll('label > small, .campo-spese > small')) { aiuto.parentElement.title = aiuto.textContent; aiuto.remove(); }
    const modulo = crea('form', { className: 'carta carta-offerta in-modifica', 'data-offerta': o.id, novalidate: true },
      crea('h3', {}, Icone.distintivo(M.iconaTipo(p)), crea('span', { className: 'nome-offerta' }, p.nome || 'Offerta')),
      crea('p', { className: 'nota' }, 'Correggi quello che non è giusto e premi «Salva»: il confronto si ricalcola.'), campi,
      crea('p', { className: 'nota evidenza errore-offerta', hidden: true }),
      crea('div', { className: 'azioni' },
        crea('button', { type: 'submit' }, 'Salva'),
        crea('button', { type: 'button', className: 'secondario', 'data-annulla-offerta': o.id }, 'Annulla')));
    M.campi.aggiornaVisibili(modulo, CAMPI_OFFERTA, p);
    return modulo;
  }
  // Dopo aver chiuso il modulo il fuoco torna su «Cambia i dati» della sua carta.
  const fuocoSullaCarta = id => { const b = $(`#contenuto-offerte [data-modifica-offerta="${id}"]`); if (b) b.focus({ preventScroll: true }); };

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
          crea('li', {}, 'Le offerte stanno a famiglie: i mutui per la casa da una parte, i prestiti e i finanziamenti dall\'altra, perché un mutuo e un prestito personale non si confrontano. In ogni famiglia scegli tu quali offerte mettere nel confronto.'),
          crea('li', {}, 'Quando hai firmato, premi «Segui questo prestito» sull\'offerta scelta: i dati passano alla configurazione guidata.'))));
      return;
    }
    if (!offerte.some(o => o.id === inModifica)) inModifica = null;
    const modello = modelloScelto(), esiti = offerte.map(o => ({ o, e: calcola(o, modello) }));
    // Una sezione per famiglia (solo quelle con almeno un'offerta): titolo e spiegazione, il confronto delle offerte
    // scelte, poi tutte le carte. «Costa meno» si decide fra le scelte della famiglia.
    const gruppi = FAMIGLIE.map(f => ({ f, tutte: esiti.filter(x => famiglia(x.o.parametri) === f.codice) })).filter(g => g.tutte.length)
      .map(g => { g.scelte = g.tutte.filter(x => nelConfronto(x.o.parametri)); g.migliore = piuEconomica(g.scelte); return g; });
    const tabelle = () => { for (const g of gruppi) disegnaTabella($(`#contenuto-offerte [data-confronto="${g.f.codice}"]`), g.tutte, g.scelte, g.migliore); };
    // Il modulo aperto resta quello di prima, con le risposte non ancora salvate; mentre lo si compila si ridisegnano solo i confronti.
    const aperto = inModifica ? $(`#contenuto-offerte form[data-offerta="${inModifica}"]`) : null;
    if (aperto && aperto.contains(document.activeElement)) return tabelle();
    const quante = n => n === 1 ? '1 offerta' : `${n} offerte`;
    contenuto.replaceChildren(...gruppi.map(g => crea('section', { className: 'gruppo-offerte', 'data-famiglia': g.f.codice, 'aria-label': g.f.nome },
      crea('div', { className: 'testa-gruppo-offerte' },
        crea('h3', {}, Icone.crea(g.f.icona, 'icona icona-titolo'), g.f.nome, crea('span', { className: 'conta-offerte' }, quante(g.tutte.length))),
        crea('p', { className: 'nota' }, g.f.testo)),
      crea('div', { className: 'carta confronto-offerte', 'data-confronto': g.f.codice }),
      crea('div', { className: 'elenco-prestiti carte-offerte' }, ...g.tutte.map(x => x.o.id === inModifica ? aperto || moduloOfferta(x.o) : cartaOfferta(x, x === g.migliore))))));
    tabelle();
  }

  // La stima delle spese che mancano, aggiunta con un clic sotto la tabella: si salva, e la carta mostra il valore nuovo.
  let stimaAggiunta = null;
  async function aggiungiStima(id, come) {
    const o = Archivio.offerte().find(x => x.id === id), m = o && speseMancanti(calcola(o, modelloScelto()), o.parametri);
    if (!m) return;
    try {
      await Archivio.richiesta('PUT', 'offerte/' + id, conStima(o.parametri, m, come));
    } catch (errore) {
      return avvisa(errore.message, true);
    }
    stimaAggiunta = { id, testo: come === 'rata' ? `${euro(m.aOgniRata)} alle spese per rata` : `${euro(m.allInizio)} alle spese iniziali` };
    if (inModifica === id) inModifica = null;   // il modulo aperto avrebbe i valori di prima
    disegna();
  }

  // Nel modulo aperto un campo cambiato mostra o nasconde quelli che dipendono da lui; si salva con «Salva».
  $('#contenuto-offerte').addEventListener('change', async evento => {
    if (evento.target.classList.contains('modello-offerte')) {
      stimaAggiunta = null;
      for (const o of Archivio.offerte().filter(x => conPrevisioni(x.parametri))) await Archivio.richiesta('PUT', 'offerte/' + o.id, { previsione_modello: evento.target.value });
      return disegna();
    }
    const modulo = evento.target.closest('form[data-offerta]'), o = modulo && Archivio.offerte().find(x => x.id === modulo.dataset.offerta);
    if (!o) return;
    $('.errore-offerta', modulo).hidden = true;
    M.campi.aggiornaVisibili(modulo, CAMPI_OFFERTA, o.parametri);
  });
  $('#contenuto-offerte').addEventListener('submit', async evento => {
    const modulo = evento.target.closest('form[data-offerta]'), o = modulo && Archivio.offerte().find(x => x.id === modulo.dataset.offerta);
    if (!o) return;
    evento.preventDefault();
    const errore = $('.errore-offerta', modulo);
    const letti = M.campi.leggi(modulo, CAMPI_OFFERTA.filter(k => !Archivio.CAMPI[k].obbligatorio || $(`[data-campo="${k}"] input`, modulo).value.trim()));
    if (letti.errore) { errore.textContent = letti.errore; errore.hidden = false; return; }
    try {
      await Archivio.richiesta('PUT', 'offerte/' + o.id, { ...letti.valori, ...(conPrevisioni(letti.valori) ? { previsione_modello: modelloScelto() } : {}) });
    } catch (e) {
      errore.textContent = e.message;
      errore.hidden = false;
      return;
    }
    if (document.activeElement) document.activeElement.blur();
    inModifica = null;
    stimaAggiunta = null;
    disegna();
    fuocoSullaCarta(o.id);
    avvisa(`Offerta «${letti.valori.nome || 'Offerta'}» salvata: il confronto è ricalcolato.`);
  });
  // Mettere o togliere un'offerta dal confronto: si salva nell'offerta (campo «confronta»), così resta anche nel backup.
  async function confronta(id, dentro) {
    await Archivio.richiesta('PUT', 'offerte/' + id, { confronta: dentro ? 1 : 0 });
  }
  $('#contenuto-offerte').addEventListener('click', async evento => {
    const stima = evento.target.closest('button[data-offerta-stima]');
    if (stima) return aggiungiStima(stima.dataset.offertaStima, stima.dataset.stima);
    const scelta = evento.target.closest('button[data-confronta]'), tutte = evento.target.closest('button[data-confronta-tutte]');
    if (scelta) {
      const o = Archivio.offerte().find(x => x.id === scelta.dataset.confronta);
      if (o) { await confronta(o.id, !nelConfronto(o.parametri)); disegna(); }
      return;
    }
    if (tutte) {
      for (const o of Archivio.offerte().filter(x => famiglia(x.parametri) === tutte.dataset.confrontaTutte && !nelConfronto(x.parametri))) await confronta(o.id, true);
      return disegna();
    }
    const modifica = evento.target.closest('button[data-modifica-offerta]'), annulla = evento.target.closest('button[data-annulla-offerta]');
    if (modifica) {
      inModifica = modifica.dataset.modificaOfferta;
      disegna();
      const modulo = $(`#contenuto-offerte form[data-offerta="${inModifica}"]`);
      modulo.scrollIntoView({ block: 'start' });
      return $('input, select', modulo).focus({ preventScroll: true });
    }
    if (annulla) {
      inModifica = null;
      disegna();
      return fuocoSullaCarta(annulla.dataset.annullaOfferta);
    }
    const segui = evento.target.closest('button[data-segui]'), elimina = evento.target.closest('button[data-elimina-offerta]');
    const o = Archivio.offerte().find(x => x.id === (segui || elimina || {}).dataset?.[segui ? 'segui' : 'eliminaOfferta']);
    if (!o) return;
    if (segui) {
      // La guida parte con i dati dell'offerta: mancano solo la data della prima rata e le regole di dettaglio.
      const { previsione_modello, confronta: _nelConfronto, ...parametri } = o.parametri;   // «confronta» vale solo per le offerte
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
