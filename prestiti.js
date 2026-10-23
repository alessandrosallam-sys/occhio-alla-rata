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
  // Un'icona per tipo: la casa per i mutui, il portafoglio per i finanziamenti, l'auto per quelli con la maxirata.
  const iconaTipo = p => ({ finanziamento: 'portafoglio', maxirata: 'auto' })[p.tipo_prestito] || 'casa';
  M.iconaTipo = iconaTipo;
  // Che prestito è, in poche parole (a tasso fisso anche il TAEG, che dice quanto costa davvero).
  function descriviTipo(r) {
    const p = r.d.parametri;
    if ((p.tipo_prestito || 'variabile') === 'variabile') return `Mutuo a tasso variabile · ${p.indice_nome || 'indice'} + ${perc(p.spread, 3, 1)}`;
    const taeg = Calcolo.costi(r.d, r.righe, true).taeg;
    const tipo = { fisso: 'Mutuo a tasso fisso', maxirata: `Finanziamento con maxirata di ${M.euro(p.maxirata || 0)}` }[p.tipo_prestito] || 'Finanziamento';
    return `${tipo} · TAN ${perc(p.tasso_fisso || 0, 3, 1)}` + (taeg == null ? '' : ` · TAEG ${perc(taeg, 2)}`);
  }

  function cartaPrestito(r, aperto, principale) {
    const p = r.d.parametri;
    const voce = (etichetta, valore, dettaglio) => crea('div', { className: 'dato' }, crea('span', { className: 'etichetta' }, etichetta),
      crea('span', { className: 'valore' }, valore), ...(dettaglio ? [crea('span', { className: 'dettaglio' }, dettaglio)] : []));
    const fine = r.stato === 'finito' ? 'Finito' : meseAnno(r.ultima.inizio);
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
      crea('div', { className: 'azioni' }, apri, stella, elimina));
  }

  function disegna() {
    if ($('#scheda-prestiti').hidden) return;
    // Nessun prestito (si seguono solo le offerte): come cominciare.
    if (!Archivio.configurato()) return $('#contenuto-prestiti').replaceChildren(crea('div', { className: 'carta prestiti-vuoto' },
      crea('h2', {}, Icone.crea('casa', 'icona icona-titolo'), 'Non segui ancora nessun prestito'),
      crea('p', { className: 'nota' }, 'Hai già un mutuo o un finanziamento? Aggiungilo: ti servono l\'importo, la durata e qualche rata pagata. Il programma rifà il piano e controlla che la banca faccia i conti giusti.'),
      crea('div', { className: 'azioni' }, Icone.decora(crea('button', { type: 'button', id: 'primo-prestito', 'data-icona': 'piu' }, 'Aggiungi il tuo prestito')))));
    const attivo = M.stato.aperto ? Archivio.attivo() : null, principale = Archivio.principale(), tutti = Archivio.elenco().map(riassunto);
    const contenuto = [crea('div', { className: 'elenco-prestiti' }, ...tutti.map(r => cartaPrestito(r, r.d.id === attivo, r.d.id === principale)))];
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
            crea('span', { className: 'dettaglio' }, `di ${euro(somma(r => r.d.parametri.importo_iniziale))} ricevuti`)),
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
      if (!d || !confirm(`Eliminare «${nome}»?\n\nLe rate e i tassi inseriti per questo prestito si perdono. Gli altri prestiti restano. Se vuoi tenerne una copia, prima usa «Salva un backup» nel pannello di controllo.`)) return;
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
  $('#aggiungi-prestito').addEventListener('click', () => M.apriGuida(false, true));

  M.viste.push(disegna);
  M.allApertura.prestiti = disegna;
})();
