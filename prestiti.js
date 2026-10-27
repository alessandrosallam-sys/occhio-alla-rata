// Scheda «Prestiti»: tutti i prestiti seguiti, ognuno con i suoi numeri del mese, e i totali. Da qui si entra in uno
// (compare il suo sottomenu: le sue pagine lavorano sul prestito aperto), si sceglie il principale (si apre da solo
// all'avvio), se ne aggiunge uno nuovo con la configurazione guidata o lo si elimina.
(function () {
  'use strict';
  const M = window.Mutuo, { stato, $, crea, euro, perc, meseAnno, avvisa } = M;

  // Numeri di un prestito, calcolati sul suo piano come fa la scheda Piano (stessa previsione dell'indice).
  function riassunto(d) {
    const righe = Calcolo.calcolaPiano(d, { previsione: M.perPiano ? M.perPiano(d) : null }).righe;
    const oggi = stato.oggi, prima = righe[0], ultima = righe[righe.length - 1], p = d.parametri;
    const corrente = Calcolo.rataPerData(righe, oggi);
    const rata = r => r.rataVera != null ? r.rataVera : r.rataCalcolata;
    // Da oggi alla fine: la rata del mese in corso e tutte le successive.
    const restanti = righe.filter(r => r.fine >= oggi);
    return {
      d, righe, corrente, prima, ultima,
      stato: oggi > ultima.fine ? 'finito' : oggi < prima.inizio ? 'futuro' : 'corso',
      rata: corrente ? rata(corrente) : restanti.length ? rata(restanti[0]) : 0,
      meseRata: corrente ? corrente.inizio : restanti.length ? restanti[0].inizio : null,
      debito: restanti.length ? restanti[0].debito : 0,
      rimborsato: restanti.length ? 1 - restanti[0].debito / p.importo_iniziale : 1,
      interessiRestanti: restanti.reduce((s, r) => s + r.rataCalcolata - r.quotaCapitale - p.spese_rata, 0),
      rateRestanti: restanti.length,
    };
  }
  // Un'icona per categoria (archivio.js): la casa per i mutui, l'auto, la borsa degli acquisti, il portafoglio…
  const iconaTipo = p => { const c = Archivio.categoria(p); return ['variabile', 'fisso', 'misto'].includes(c.tipo) ? 'casa' : c.icona; };
  M.iconaTipo = iconaTipo;
  // Che prestito è, in poche parole (a tasso fisso anche il TAEG, che dice quanto costa davvero). Se il contratto è
  // cambiato, il tasso è quello del tratto in corso (Calcolo.tratti) e il TAEG, che vale per il contratto firmato, non c'è.
  // Nel tasso misto si dice fino a quando vale il TAN, se il cambio di quella rata non è ancora scritto.
  function descriviTipo(r) {
    const p = r.d.parametri, elenco = Calcolo.tratti(r.d);
    const riga = r.corrente || (r.stato === 'futuro' ? r.prima : r.ultima), tratto = elenco[riga.tratto] || elenco[0];
    const tipo = (p.tipo_prestito || 'variabile') === 'variabile' ? 'Mutuo a tasso variabile' : p.tipo_prestito === 'fisso' ? 'Mutuo a tasso fisso'
      : p.tipo_prestito === 'misto' ? 'Mutuo a tasso misto' : p.tipo_prestito === 'maxirata' ? `Auto con maxirata di ${M.euro(p.maxirata || 0)}` : Archivio.categoria(p).breve;
    const ora = elenco.length > 1 ? (tratto.variabile ? ' · ora variabile, ' : ' · ora ') : ' · ';
    if (tratto.variabile) return `${tipo}${ora}${p.indice_nome || 'indice'} + ${perc(tratto.tasso, 3, 1)}`;
    const revisione = Calcolo.revisioneMisto(r.d, riga.n), quando = revisione && r.righe[revisione.rata - 1] ? r.righe[revisione.rata - (revisione.passata ? 1 : 2)] : null;
    const misto = !quando ? '' : revisione.passata ? ` · da rivedere da ${meseAnno(quando.inizio)}` : ` fino a ${meseAnno(quando.inizio)}`;
    const taeg = elenco.length > 1 ? null : Calcolo.costi(r.d, r.righe, true).taeg;
    return `${tipo}${ora}TAN ${perc(tratto.tasso || 0, 3, 1)}${misto}` + (taeg == null ? '' : ` · TAEG ${perc(taeg, 2)}`);
  }
  // Da dove viene e come è finito: surroga, prestito nuovo nato dal debito di un altro, cambi del contratto.
  function storia(r, tutti) {
    const p = r.d.parametri, frasi = [], nome = id => { const x = tutti.find(t => t.d.id === id); return x ? `«${x.d.parametri.nome || 'Prestito senza nome'}»` : null; };
    if (r.ultima.estinto) {
      const nuovo = tutti.find(t => t.d.parametri.origine_prestito === r.d.id && t.d.parametri.origine_rata === r.ultima.n);
      frasi.push(`Chiuso dopo la rata di ${meseAnno(r.ultima.inizio)}: il debito che restava, ${euro(r.ultima.estinto)}, è passato ${nuovo ? 'a ' + nome(nuovo.d.id) : 'a un prestito nuovo'}.`);
    }
    if (p.origine_prestito && nome(p.origine_prestito)) frasi.push(`Nato dal debito che restava di ${nome(p.origine_prestito)}.`);
    const cambi = (r.d.cambi || []).length;
    if (cambi) frasi.push(cambi === 1 ? 'Il contratto è cambiato una volta dopo la firma.' : `Il contratto è cambiato ${cambi} volte dopo la firma.`);
    return frasi;
  }

  // Un prestito nato dal debito di un altro dell'elenco: i suoi soldi hanno pagato quel debito, non sono soldi ricevuti in più.
  const nuovoDaAltro = (r, tutti) => tutti.some(t => t.d.id === r.d.parametri.origine_prestito && t.ultima.estinto && t.ultima.n === r.d.parametri.origine_rata);

  // Il prestito per cui è aperto il riquadro «Nuovo prestito dal debito residuo», e la rata scelta.
  const surroga = { id: null, dopo: null };
  // Dopo quali rate si può passare a un prestito nuovo: dalla prima alla penultima. Di base l'ultima già finita.
  function pannelloSurroga(r) {
    const righe = r.righe.slice(0, -1);
    if (surroga.dopo == null || !righe[surroga.dopo - 1]) {
      const finite = righe.filter(x => x.fine < stato.oggi);
      surroga.dopo = finite.length ? finite[finite.length - 1].n : 1;
    }
    const scelta = r.righe[surroga.dopo - 1], debito = Calcolo.centesimi(scelta.debito - scelta.quotaCapitale), restano = r.righe.length - surroga.dopo;
    return crea('div', { className: 'blocco surroga' },
      crea('h4', {}, 'Nuovo prestito dal debito residuo'),
      crea('p', { className: 'nota' }, 'Hai portato il mutuo in un\'altra banca (surroga), o hai rifatto il prestito per il debito che restava? Scegli l\'ultima rata pagata con questo prestito: il debito che restava dopo quella rata diventa l\'importo del prestito nuovo, e questo si chiude lì. La data la trovi nel contratto nuovo o nell\'estratto conto, dove smettono gli addebiti della vecchia rata.'),
      crea('label', {}, 'Ultima rata pagata con questo prestito',
        crea('select', { name: 'surroga-dopo', 'data-surroga-scelta': r.d.id }, ...righe.map(x => crea('option', { value: x.n, selected: x.n === surroga.dopo }, `rata ${x.n}, di ${meseAnno(x.inizio)}`)))),
      crea('p', { className: 'nota evidenza' }, `Debito che passa al prestito nuovo: ${euro(debito)}. Rate che restavano: ${restano}. Le condizioni nuove (tasso, durata, spese) le scrivi tu nella configurazione che si apre.`),
      crea('div', { className: 'azioni' },
        crea('button', { type: 'button', 'data-surroga-vai': r.d.id }, 'Continua con il prestito nuovo'),
        crea('button', { type: 'button', className: 'secondario', 'data-surroga-annulla': '' }, 'Annulla')));
  }
  // La guida per il prestito nuovo, con importo, durata e tipo già scritti: il tasso e il resto li dà l'utente.
  function apriPrestitoNuovo(r) {
    const p = r.d.parametri, scelta = r.righe[surroga.dopo - 1];
    const tipo = p.tipo_prestito === 'maxirata' ? 'finanziamento' : p.tipo_prestito || 'variabile';
    const partenza = { tipo_prestito: tipo, categoria: p.categoria, nome: `${p.nome || 'Prestito'} (nuovo)`.slice(0, 80),
      importo_iniziale: Calcolo.centesimi(scelta.debito - scelta.quotaCapitale), numero_rate: r.righe.length - surroga.dopo,
      ...(tipo === 'variabile' ? { indice_nome: p.indice_nome } : {}), origine_prestito: r.d.id, origine_rata: surroga.dopo };
    surroga.id = null;
    M.apriGuida(false, true, partenza);
  }
  M.apriSurroga = id => { Object.assign(surroga, { id, dopo: null }); M.mostraScheda('prestiti'); disegna(); };

  function cartaPrestito(r, aperto, principale, tutti) {
    const p = r.d.parametri;
    const voce = (etichetta, valore, dettaglio) => crea('div', { className: 'dato' }, crea('span', { className: 'etichetta' }, etichetta),
      crea('span', { className: 'valore' }, valore), ...(dettaglio ? [crea('span', { className: 'dettaglio' }, dettaglio)] : []));
    const fine = r.stato === 'finito' ? (r.ultima.estinto ? 'Chiuso' : 'Finito') : meseAnno(r.ultima.inizio);
    // Il prestito nuovo dal debito residuo: non per uno già chiuso, né per uno che ha una rata sola.
    const puoNuovo = !r.ultima.estinto && r.righe.length > 1;
    const nuovo = puoNuovo && surroga.id !== r.d.id ? [crea('button', { type: 'button', className: 'secondario piccolo', 'data-surroga': r.d.id }, 'Nuovo prestito dal debito residuo')] : [];
    const barra = crea('span');
    barra.style.width = (Math.max(0, Math.min(1, r.rimborsato)) * 100).toFixed(1) + '%';
    const apri = crea('button', { type: 'button', className: aperto ? 'secondario' : '', 'data-apri': r.d.id }, aperto ? 'Vai al piano' : 'Apri');
    const stella = crea('button', { type: 'button', className: 'secondario piccolo scelta-principale', 'data-principale': r.d.id, 'aria-pressed': String(principale) },
      principale ? '★ Principale' : '☆ Rendi principale');
    const elimina = crea('button', { type: 'button', className: 'pericoloso piccolo', 'data-elimina': r.d.id }, 'Elimina');
    return crea('article', { className: 'carta carta-prestito' + (aperto ? ' aperto' : '') },
      crea('header', {}, Icone.distintivo(iconaTipo(p)), crea('div', { className: 'testa-prestito' }, crea('h3', {}, p.nome || 'Prestito senza nome'), crea('p', { className: 'nota' }, descriviTipo(r))),
        ...(aperto ? [crea('span', { className: 'etichetta-aperto' }, 'Aperto ora')] : [])),
      crea('div', { className: 'numeri-prestito' },
        voce(r.meseRata ? `Rata di ${meseAnno(r.meseRata)}` : 'Rata', r.stato === 'finito' ? '—' : euro(r.rata), r.stato === 'futuro' ? 'la prima' : null),
        voce('Debito residuo', euro(r.debito), `di ${euro(p.importo_iniziale)}`),
        voce('Ultima rata', fine, r.stato === 'finito' ? null : `${r.rateRestanti} rate da pagare`)),
      crea('div', { className: 'avanzamento', title: `Rimborsato il ${perc(r.rimborsato, 1)}` }, barra),
      ...storia(r, tutti).map(frase => crea('p', { className: 'nota storia-prestito' }, frase)),
      ...(puoNuovo && surroga.id === r.d.id ? [pannelloSurroga(r)] : []),
      crea('div', { className: 'azioni' }, apri, stella, ...nuovo, elimina));
  }

  function disegna() {
    if ($('#scheda-prestiti').hidden) return;
    // Nessun prestito (si seguono solo le offerte): come cominciare.
    if (!Archivio.configurato()) return $('#contenuto-prestiti').replaceChildren(crea('div', { className: 'carta prestiti-vuoto' },
      crea('h2', {}, Icone.crea('casa', 'icona icona-titolo'), 'Non segui ancora nessun prestito'),
      crea('p', { className: 'nota' }, 'Hai già un mutuo o un finanziamento? Aggiungilo: ti servono l\'importo, la durata e qualche rata pagata. Il programma rifà il piano e controlla che la banca faccia i conti giusti.'),
      crea('div', { className: 'azioni' }, Icone.decora(crea('button', { type: 'button', id: 'primo-prestito', 'data-icona': 'piu' }, 'Aggiungi il tuo prestito')))));
    const attivo = M.stato.aperto ? Archivio.attivo() : null, principale = Archivio.principale(), tutti = Archivio.elenco().map(riassunto);
    const contenuto = [crea('div', { className: 'elenco-prestiti' }, ...tutti.map(r => cartaPrestito(r, r.d.id === attivo, r.d.id === principale, tutti)))];
    // Più prestiti: quale si apre da solo.
    if (tutti.length > 1) contenuto.unshift(crea('p', { className: 'nota guida-principale' }, principale
      ? `«${tutti.find(r => r.d.id === principale).d.parametri.nome || 'Prestito senza nome'}» è il prestito principale: si apre da solo quando apri la pagina. Con la stella ne scegli un altro.`
      : 'Scegli il prestito principale con la stella: si aprirà da solo quando apri la pagina. Per entrare in un prestito premi «Apri».'));
    if (tutti.length > 1) {
      const somma = valore => tutti.reduce((s, r) => s + valore(r), 0);
      const inCorso = tutti.filter(r => r.stato !== 'finito');
      contenuto.unshift(crea('div', { className: 'carta totali-prestiti' },
        crea('h2', {}, Icone.crea('somma', 'icona icona-titolo'), 'Tutti i prestiti'),
        crea('div', { className: 'numeri-prestito' },
          crea('div', { className: 'dato' }, crea('span', { className: 'etichetta' }, 'Rate di questo mese'), crea('span', { className: 'valore' }, euro(somma(r => r.stato === 'corso' ? r.rata : 0))),
            crea('span', { className: 'dettaglio' }, `${inCorso.length === 1 ? '1 prestito in corso' : inCorso.length + ' prestiti in corso'}`)),
          crea('div', { className: 'dato' }, crea('span', { className: 'etichetta' }, 'Debito residuo'), crea('span', { className: 'valore' }, euro(somma(r => r.debito))),
            crea('span', { className: 'dettaglio' }, `di ${euro(somma(r => nuovoDaAltro(r, tutti) ? 0 : r.d.parametri.importo_iniziale))} ricevuti`)),
          crea('div', { className: 'dato' }, crea('span', { className: 'etichetta' }, 'Interessi ancora da pagare'), crea('span', { className: 'valore' }, euro(somma(r => r.interessiRestanti))),
            crea('span', { className: 'dettaglio' }, 'secondo le previsioni')))));
    }
    $('#contenuto-prestiti').replaceChildren(...contenuto);
  }

  $('#contenuto-prestiti').addEventListener('click', async evento => {
    const apri = evento.target.closest('button[data-apri]'), elimina = evento.target.closest('button[data-elimina]');
    const stella = evento.target.closest('button[data-principale]');
    if (evento.target.closest('#primo-prestito')) return M.apriGuida(false);
    if (apri) return M.entra(apri.dataset.apri);
    const vai = evento.target.closest('button[data-surroga-vai]'), apriSurroga = evento.target.closest('button[data-surroga]');
    if (apriSurroga) { Object.assign(surroga, { id: apriSurroga.dataset.surroga, dopo: null }); return disegna(); }
    if (evento.target.closest('button[data-surroga-annulla]')) { surroga.id = null; return disegna(); }
    if (vai) { const d = Archivio.elenco().find(x => x.id === vai.dataset.surrogaVai); return d && apriPrestitoNuovo(riassunto(d)); }
    if (stella) {
      // Di nuovo sulla stella del principale: non ce n'è più nessuno, e all'avvio si vede l'elenco.
      const togli = stella.dataset.principale === Archivio.principale();
      await Archivio.richiesta(togli ? 'DELETE' : 'PUT', 'principale/' + (togli ? '' : stella.dataset.principale));
      M.disegnaMenu();
      disegna();
      return avvisa(togli ? 'Nessun prestito principale: all\'avvio vedrai l\'elenco dei prestiti.' : 'Prestito principale scelto: si aprirà da solo.');
    }
    if (elimina) {
      const d = Archivio.elenco().find(x => x.id === elimina.dataset.elimina), nome = d ? d.parametri.nome || 'Prestito senza nome' : '';
      const vecchio = d && d.parametri.origine_prestito ? Archivio.elenco().find(x => x.id === d.parametri.origine_prestito && x.parametri.estinto_dopo_rata === d.parametri.origine_rata) : null;
      const riaperto = vecchio ? `\n\n«${vecchio.parametri.nome || 'Prestito senza nome'}», da cui era nato, torna aperto fino alla fine del suo piano.` : '';
      if (!d || !confirm(`Eliminare «${nome}»?\n\nLe rate e i tassi inseriti per questo prestito si perdono. Gli altri prestiti restano.${riaperto} Se vuoi tenerne una copia, prima usa «Salva un backup» nel pannello di controllo.`)) return;
      const eraAperto = d.id === Archivio.attivo();
      try {
        await Archivio.richiesta('DELETE', 'prestiti/' + d.id);
      } catch (errore) {
        return avvisa(errore.message, true);
      }
      if (eraAperto) M.stato.aperto = null;   // eliminato quello aperto: si apre il principale (o l'unico che resta), come all'avvio
      await M.avvia('prestiti');
      avvisa(`«${nome}» eliminato`);
    }
  });
  // Un'altra rata per il prestito nuovo: si aggiornano debito e rate che restano.
  $('#contenuto-prestiti').addEventListener('change', evento => {
    if (!evento.target.matches('select[data-surroga-scelta]')) return;
    surroga.dopo = +evento.target.value;
    disegna();
    const select = $('#contenuto-prestiti select[data-surroga-scelta]');
    if (select) select.focus();
  });
  $('#aggiungi-prestito').addEventListener('click', () => M.apriGuida(false, true));

  M.viste.push(disegna);
  M.allApertura.prestiti = disegna;
})();
