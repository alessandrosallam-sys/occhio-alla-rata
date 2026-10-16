// Logica della pagina: legge i dati del prestito aperto dall'archivio del browser, ricalcola il piano e gestisce le modifiche.
(function () {
  'use strict';
  const $ = (selettore, dentro = document) => dentro.querySelector(selettore);
  const stato = { dati: null, piano: null, oggi: isoOggi(), schedaVista: {} };

  // ---------- Date, numeri e formati ----------
  const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
  const GIORNI = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];
  const formatoEuro = new Intl.NumberFormat('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: 'always' });

  function isoOggi() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  const data = iso => iso ? `${iso.slice(8)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '';
  const meseAnno = iso => `${MESI[+iso.slice(5, 7) - 1]} ${iso.slice(0, 4)}`;
  const giornoSettimana = iso => GIORNI[new Date(iso + 'T00:00:00Z').getUTCDay()];
  const dataValida = iso => /^\d{4}-\d{2}-\d{2}$/.test(iso) && !isNaN(Date.parse(iso + 'T00:00:00Z'))
    && new Date(iso + 'T00:00:00Z').toISOString().slice(0, 10) === iso;
  // Sotto il mezzo centesimo si mostra 0,00 (mai "-0,00").
  const euro = v => v == null ? '' : formatoEuro.format(Math.abs(v) < 0.005 ? 0 : v) + ' €';
  const perc = (v, decimali = 4, minimi = decimali) => v == null ? ''
    : (v * 100).toLocaleString('it-IT', { minimumFractionDigits: minimi, maximumFractionDigits: decimali }) + '%';

  // Legge un numero scritto all'italiana ("1.234,56") o con il punto decimale. Vuoto = null, non valido = NaN.
  function leggiNumero(testo, migliaia = false) {
    let t = String(testo).replace(/[€%\s]/g, '');
    if (!t) return null;
    if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
    // Per gli importi, "150.000" è centocinquantamila: i punti sono separatori delle migliaia.
    else if (migliaia && /^-?\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '');
    const n = Number(t);
    return Number.isFinite(n) ? n : NaN;
  }
  const daPercento = v => Number((v / 100).toFixed(14));
  const perCampo = (v, percento) => v == null ? '' : String(percento ? Number((v * 100).toFixed(12)) : Number(v.toFixed(6))).replace('.', ',');

  // Piccole preferenze di visualizzazione ricordate nel browser (colonne aperte, statistiche chiuse).
  // La versione in un unico file non salva niente nel browser, quindi non le ricorda.
  const ricordo = {
    leggi(chiave) { if (window.MUTUO_UN_FILE) return null; try { return localStorage.getItem(chiave); } catch { return null; } },
    scrivi(chiave, valore) { if (window.MUTUO_UN_FILE) return; try { localStorage.setItem(chiave, valore); } catch { /* la scelta vale solo per questa volta */ } },
  };

  // ---------- Archivio dei dati (vedi archivio.js) ----------
  const api = (metodo, percorso, corpo) => Archivio.richiesta(metodo, percorso, corpo);
  // Nome dell'indice del contratto (Euribor 3 mesi, tasso BCE...), per i testi.
  const indice = () => (stato.dati && stato.dati.parametri.indice_nome) || 'indice';

  // Esegue una modifica: l'archivio risponde con tutti i dati aggiornati.
  async function esegui(metodo, percorso, corpo, messaggio) {
    try {
      aggiorna(await api(metodo, percorso, corpo));
      if (messaggio) avvisa(messaggio);
      return true;
    } catch (errore) {
      avvisa(errore.message, true);
      return false;
    }
  }

  function aggiorna(dati) {
    const altroPrestito = !stato.dati || stato.dati.id !== dati.id;
    stato.dati = dati;
    // Aperto un altro prestito: le pagine dimenticano quello che avevano calcolato per il precedente.
    if (altroPrestito) for (const f of M.cambioPrestito) f();
    // L'indice delle rate future viene dal modello scelto nella scheda «Previsioni», se c'è (previsioni.js).
    stato.piano = Calcolo.calcolaPiano(dati, { previsione: M.perPiano ? M.perPiano(dati) : null });
    if (M.ORIGINI) M.ORIGINI.previsione = M.nomeModelloPiano && M.nomeModelloPiano(dati) ? `previsione (modello ${M.nomeModelloPiano(dati)})` : 'previsione';
    $('#titolo-mutuo').textContent = document.title = dati.parametri.nome || 'Mutuo variabile';
    disegnaRiepilogo();
    disegnaPiano();
    for (const disegna of M.viste) disegna();
    disegnaPannello();
  }

  let timerAvviso;
  function avvisa(testo, errore = false) {
    const el = $('#avviso');
    el.textContent = testo;
    el.classList.toggle('errore', errore);
    el.hidden = false;
    clearTimeout(timerAvviso);
    timerAvviso = setTimeout(() => { el.hidden = true; }, errore ? 7000 : 4000);
  }

  // Piccolo aiuto per creare elementi senza passare da innerHTML.
  function crea(tag, proprieta = {}, ...figli) {
    const el = document.createElement(tag);
    for (const [chiave, valore] of Object.entries(proprieta)) {
      if (chiave === 'class') el.className = valore;
      else if (chiave in el) el[chiave] = valore;
      else el.setAttribute(chiave, valore);
    }
    el.append(...figli);
    return el;
  }

  // Trasforma una cella in un campo di modifica. Invio o uscita salvano, Esc annulla, vuoto = nessun valore.
  // tipo: 'numero', 'percento' oppure 'data' (in questo caso "valore" è la data mostrata, in formato ISO).
  // Con "invioConferma" premere Invio salva anche se il valore non è cambiato.
  function modificaCella(td, { valore, tipo = 'numero', etichetta, salva, ripristina, invioConferma = false }) {
    if (td.querySelector('input')) return;
    const eData = tipo === 'data', percento = tipo === 'percento';
    const partenza = eData ? (valore || '') : perCampo(valore, percento);
    const input = eData ? crea('input', { className: 'editor', type: 'date', value: partenza })
      : crea('input', { className: 'editor', type: 'text', inputMode: 'decimal', value: partenza, placeholder: td.textContent.trim() });
    input.setAttribute('aria-label', etichetta);
    td.classList.add('in-modifica');
    td.replaceChildren(input);
    input.focus();
    input.select();
    let chiuso = false;
    const chiudi = async (conferma, daInvio) => {
      if (chiuso) return;
      if (!conferma) { chiuso = true; return ripristina(); }
      let v = eData ? (input.value || null) : leggiNumero(input.value, !percento);
      if (Number.isNaN(v)) {
        avvisa('Numero non valido', true);
        if (daInvio) return;
        chiuso = true;
        return ripristina();
      }
      if (v != null && percento) v = daPercento(v);
      chiuso = true;
      const invariato = eData ? input.value === partenza : v === (valore == null ? null : valore);
      if ((invariato && !(invioConferma && daInvio)) || !(await salva(v))) ripristina();
    };
    input.addEventListener('keydown', evento => {
      if (evento.key === 'Enter') chiudi(true, true);
      else if (evento.key === 'Escape') chiudi(false);
    });
    input.addEventListener('blur', () => chiudi(true, false));
  }

  // Le altre pagine (tassi.js, calendario.js) usano questi strumenti e si agganciano qui:
  // "viste" = funzioni da richiamare a ogni aggiornamento dei dati, "allApertura" = funzioni per scheda.
  const M = window.Mutuo = {
    stato, $, crea, api, esegui, avvisa, modificaCella, mostraScheda, MESI, GIORNI,
    data, meseAnno, giornoSettimana, dataValida, euro, perc, leggiNumero, daPercento, perCampo, aggiorna, indice,
    viste: [], allApertura: {}, dopoAvvio: [], cambioPrestito: [], ricordo,
  };

  // ---------- Riepilogo in testata ----------
  function disegnaRiepilogo() {
    const righe = stato.piano.righe, p = stato.dati.parametri;
    const corrente = Calcolo.rataPerData(righe, stato.oggi) || righe[righe.length - 1];
    const precedente = righe[corrente.n - 2], ultima = righe[righe.length - 1];
    const rata = r => r.rataVera != null ? r.rataVera : r.rataCalcolata;
    const rimborsato = Math.max(0, Math.min(1, 1 - corrente.debito / p.importo_iniziale));
    let dettaglioRata = corrente.rataVera != null ? 'addebitata' : 'calcolata';
    if (precedente) {
      const variazione = rata(corrente) - rata(precedente);
      dettaglioRata += ` · ${variazione < 0 ? '−' : '+'}${euro(Math.abs(variazione))} su ${MESI[+precedente.inizio.slice(5, 7) - 1]}`;
    }
    const dettaglioEuribor = corrente.origineEuribor === 'db' ? `rilevato il ${data(corrente.riferimento)}`
      : corrente.origineEuribor === 'manuale' ? 'inserito a mano' : `previsione: manca il valore del ${data(corrente.riferimento)}`;
    // La rata del mese è la tessera principale (classe "principale": più grande e in testa, vedi stile.css).
    const voci = [
      ['Debito residuo', euro(corrente.debito), `rimborsato il ${perc(rimborsato, 1)} di ${euro(p.importo_iniziale)}`, rimborsato],
      [`Rata di ${meseAnno(corrente.inizio)}`, euro(rata(corrente)), dettaglioRata, null, 'principale'],
      [indice(), perc(corrente.euribor, 3), dettaglioEuribor],
      ['Tasso totale', perc(corrente.tassoTotale, 3), `indice + spread ${perc(corrente.spread, 3, 1)}`],
      ['Totale rate a fine piano', euro(ultima.cumulato), `interessi e spese ${euro(ultima.cumulato - p.importo_iniziale)}`],
    ];
    $('#riepilogo').replaceChildren(...voci.map(([etichetta, valore, dettaglio, quota, classe]) => {
      const tessera = crea('div', { className: 'dato' + (classe ? ' ' + classe : '') }, crea('span', { className: 'etichetta' }, etichetta),
        crea('span', { className: 'valore' }, valore), crea('span', { className: 'dettaglio', title: dettaglio }, dettaglio));
      if (quota != null) {
        const riempimento = crea('span');
        riempimento.style.width = (quota * 100).toFixed(1) + '%';
        tessera.append(crea('div', { className: 'avanzamento' }, riempimento));
      }
      return tessera;
    }));
  }

  // ---------- Piano ----------
  const previsione = r => r.origineEuribor === 'previsione' ? 'previsione' : '';
  const rataUguale = r => r.rataCalcolata.toFixed(2) === r.rataVera.toFixed(2);
  // Data di riferimento già passata ma tasso assente dal database: il valore mostrato è una stima.
  const tassoMancante = M.tassoMancante = r => r.origineEuribor === 'previsione' && r.riferimento <= stato.oggi;
  const obiettivo = M.obiettivo = () => stato.dati.parametri.rata_obiettivo > 0 ? stato.dati.parametri.rata_obiettivo : null;

  // Nelle celle l'unità di misura è più chiara del numero, così le cifre risaltano.
  const conUnita = (testo, simbolo) => testo && `${testo.slice(0, -simbolo.length)}<span class="unita">${simbolo}</span>`;
  const euroT = v => conUnita(euro(v), ' €');
  const percT = (v, decimali, minimi) => conUnita(perc(v, decimali, minimi), '%');
  const euroConSegno = M.euroConSegno = v => (v > 0.004 ? '+' : v < -0.004 ? '−' : '') + euro(Math.abs(v));
  const esito = contenuto => `<span class="esito">${contenuto}</span>`;
  const freccia = (simbolo, verso) => `<span class="freccia ${verso}">${simbolo}</span>`;
  const barretta = quota => `<span class="barretta"><i style="width:${(Math.max(0, Math.min(1, quota)) * 100).toFixed(1)}%"></i></span>`;
  const etichettaRata = (r, s) => `<span class="segno">${s.segno}</span><span class="numero">${r.n}</span>${MESI[+r.inizio.slice(5, 7) - 1].slice(0, 3)} ${r.inizio.slice(0, 4)}`;
  const minore = () => 'minore';

  // Stato di una riga, che ne decide il colore: pagata senza problemi (verde), da controllare perché
  // mancano dati o non tornano (rosso), mese in corso (arancione). I mesi futuri non hanno stato.
  function statoRiga(r) {
    const motivi = [];
    if (r.rataVera != null && !rataUguale(r)) motivi.push(r.rataCopiata
      ? `la rata presa dal calcolo non coincide più (${euroConSegno(r.rataVera - r.rataCalcolata)}): regole o tassi sono cambiati dopo`
      : `la rata vera è diversa da quella calcolata (${euroConSegno(r.rataVera - r.rataCalcolata)})`);
    if (r.rataVera == null && r.fine < stato.oggi) motivi.push('manca la rata vera');
    if (tassoMancante(r)) motivi.push(`manca il valore dell'indice del ${data(r.riferimento)}`);
    if (motivi.length) return { stato: 'problema', segno: '!', titolo: 'Da controllare: ' + motivi.join('; ') };
    if (r.rataCopiata) return { stato: 'pagata', segno: '✓', titolo: 'Pagata: rata presa dal calcolo, non controllata sull\'estratto conto' };
    if (r.rataVera != null) return { stato: 'pagata', segno: '✓', titolo: 'Pagata: la rata vera coincide con quella calcolata' };
    if (r.inizio <= stato.oggi && stato.oggi <= r.fine) return { stato: 'corso', segno: '●', titolo: 'Mese in corso: rata non ancora addebitata' };
    return { stato: '', segno: '', titolo: '' };
  }

  // Variazione sul mese prima: confronto in percentuale del costo al giorno (rata / giorni del mese). ▲ aumento, ▼ calo.
  const percConSegno = M.percConSegno = (v, decimali = 2) => (v > 0 ? '+' : v < 0 ? '−' : '') + perc(Math.abs(v), decimali);
  function cellaVariazione(r) {
    if (r.variazioneRata == null) return '';
    const v = r.variazioneRata;
    const segno = Math.abs(v) < 0.00005 ? freccia('=', 'pari') : v > 0 ? freccia('▲', 'su') : freccia('▼', 'giu');
    return segno + conUnita(percConSegno(v), '%');
  }
  function titoloVariazione(r) {
    if (r.variazioneRata == null) return '';
    const prima = stato.piano.righe[r.n - 2], mese = x => MESI[+x.inizio.slice(5, 7) - 1];
    const alGiorno = x => `${euro(x.rataAlGiorno)} al giorno a ${mese(x)} (${euro(x.rataEffettiva)} / ${x.giorniMese} giorni)`;
    return `${alGiorno(r)} contro ${alGiorno(prima)}: ${percConSegno(r.variazioneRata)}. Differenza fra le due rate: ${euroConSegno(r.variazioneRataReale)}`;
  }
  // Distanza dalla rata ideale, in tre fasce: fino al target, fino al 10% in più, oltre.
  const SOGLIA_TARGET = 0.10;
  const fasciaObiettivo = M.fasciaObiettivo = r => r.distanzaObiettivo <= 0.005 ? 'entro'
    : r.distanzaObiettivo <= obiettivo() * SOGLIA_TARGET + 0.005 ? 'vicina' : 'oltre';
  const FRECCE_OBIETTIVO = { entro: ['↓', 'giu grande'], vicina: ['→', 'medio grande'], oltre: ['↑', 'su grande'] };
  function cellaObiettivo(r) {
    if (r.distanzaObiettivo == null) return '';
    return freccia(...FRECCE_OBIETTIVO[fasciaObiettivo(r)]) + conUnita(euroConSegno(r.distanzaObiettivo), ' €');
  }
  function titoloObiettivo(r) {
    if (r.distanzaObiettivo == null) return '';
    const target = obiettivo(), distanza = r.distanzaObiettivo;
    const dove = Math.abs(distanza) < 0.005 ? 'uguale al' : `${euro(Math.abs(distanza))} ${distanza > 0 ? 'sopra il' : 'sotto il'}`;
    const fascia = { entro: 'entro il target', vicina: 'sopra il target ma entro il 10%', oltre: 'oltre il 10% sopra il target' }[fasciaObiettivo(r)];
    return `Rata ${euro(r.rataEffettiva)}: ${dove} target di ${euro(target)} (${perc(r.rataEffettiva / target, 1)} del target): ${fascia}`;
  }
  const titoloQuota = r => r.quotaCapitaleManuale && r.quotaPiano != null && Math.abs(r.quotaCapitale - r.quotaPiano) > 0.005
    ? `Inserita a mano: il piano prevede ${euro(r.quotaPiano)}. Svuota la cella per usare il piano` : '';

  const GRUPPI = ['Periodo', 'Debito', 'Rata', 'Applicato dalla banca', 'Indice e tasso'];
  // Dopo l'etichetta della rata, le colonne del foglio TABELLA nello stesso ordine, più variazione e target.
  // "g" = gruppo, "x" = nome completo della colonna (se diverso), "campo" = colonna modificabile (nome nel database).
  const COLONNE = [
    { g: 0, t: 'Rata', aiuto: 'Numero della rata e mese di competenza', v: etichettaRata, titolo: (r, s) => s.titolo },
    { g: 0, t: 'Data di rilevazione', x: 'Data di rilevazione dell\'indice', campo: 'data_riferimento', tipo: 'data',
      aiuto: 'Il giorno in cui si legge l\'indice secondo le regole del contratto; oppure forzata a mano',
      v: r => data(r.riferimento), manuale: r => r.riferimentoManuale,
      titolo: r => r.riferimentoManuale ? `Forzata a mano (calcolata: ${data(r.riferimentoAutomatico)}): svuota la cella per tornare alla data calcolata` : '' },
    { extra: true, g: 0, t: 'Inizio', x: 'Data inizio', v: r => data(r.inizio) },
    { extra: true, g: 0, t: 'Fine', x: 'Data fine', v: r => data(r.fine) },
    { extra: true, g: 0, t: 'Giorni mese', v: r => r.giorniMese, classe: minore },
    { extra: true, g: 0, t: 'Giorni anno', v: r => r.giorniAnno, classe: minore },
    { extra: true, g: 0, t: 'Rate residue', x: 'Rate', v: r => r.rateResidue, classe: minore },
    { g: 1, t: 'Importo', aiuto: 'Debito residuo = importo precedente − quota fissa precedente', v: r => euroT(r.debito) },
    { extra: true, g: 1, t: 'Rimanente', x: 'Rimanente %', aiuto: 'Debito residuo rispetto al valore della casa (o all\'importo del mutuo)', v: r => barretta(r.percRimanente) + percT(r.percRimanente, 2) },
    { g: 2, t: 'Rata calcolata', x: 'Rata calcolata con le regole del contratto', aiuto: 'Interessi del periodo + quota capitale + spese, al centesimo',
      v: r => euroT(r.rataCalcolata), classe: r => 'forte ' + previsione(r) },
    { extra: true, g: 2, t: 'Totale versato', x: 'Rate totali versate', aiuto: 'Somma delle rate calcolate fino a questa riga', v: r => euroT(r.cumulato), classe: previsione },
    { g: 2, t: 'Rata vera', campo: 'rata_vera', aiuto: 'Rata addebitata dalla banca (da inserire). Il segno = indica una rata presa dal calcolo, non controllata',
      v: r => r.rataVera == null ? '' : esito((!rataUguale(r) ? '≠ ' : r.rataCopiata ? '= ' : '✓ ') + euroT(r.rataVera)),
      classe: r => r.rataVera == null ? '' : !rataUguale(r) ? 'ko' : r.rataCopiata ? 'copiata' : 'ok',
      titolo: r => r.rataCopiata ? 'Presa dal calcolo, non controllata. Clic: Invio la conferma come controllata, un\'altra cifra la sostituisce, vuota la toglie' : '' },
    { g: 2, t: 'Variazione sul mese prima', aiuto: 'Confronto in percentuale del costo al giorno: rata divisa per i giorni del mese, rispetto al mese precedente',
      v: cellaVariazione, classe: r => r.rataVera == null ? previsione(r) : '', titolo: titoloVariazione },
    { g: 2, t: 'Distanza dal target', visibile: () => obiettivo() != null, aiuto: 'Rata del mese − rata ideale impostata nel pannello di controllo',
      v: cellaObiettivo, classe: r => r.rataVera == null ? previsione(r) : '', titolo: titoloObiettivo },
    { g: 2, t: 'Quota capitale', campo: 'quota_capitale', aiuto: 'Dal piano di rimborso scelto nelle regole del contratto, oppure inserita a mano',
      v: r => euroT(r.quotaCapitale), manuale: r => r.quotaCapitaleManuale, titolo: titoloQuota },
    { extra: true, g: 2, t: '% quota capitale', aiuto: 'Quota capitale / debito residuo', v: r => percT(r.percQuota), classe: minore },
    { g: 2, t: 'Quota interessi', aiuto: 'Rata vera − quota capitale − spese', v: r => euroT(r.quotaInteressi) },
    { extra: true, g: 3, t: 'Indice', x: 'Indice applicato dalla banca', aiuto: 'Tasso totale applicato − spread', v: r => percT(r.euriborApplicato, 3) },
    { extra: true, g: 3, t: 'Tasso totale', x: 'Tasso totale applicato', campo: 'tasso_applicato', percento: true, aiuto: 'Uguale al tasso totale, oppure inserito a mano',
      v: r => percT(r.tassoApplicato, 3), manuale: r => r.tassoApplicatoManuale },
    { extra: true, g: 3, t: 'Differenza rata', aiuto: 'Rata calcolata − rata vera',
      v: r => r.differenza > stato.dati.parametri.soglia_differenza ? esito(euroT(r.differenza)) : euroT(r.differenza),
      classe: r => r.differenza > stato.dati.parametri.soglia_differenza ? 'avviso' : '' },
    { g: 4, t: 'Indice', x: 'Valore dell\'indice', campo: 'euribor', percento: true,
      aiuto: 'Il valore inserito nella pagina dei tassi per la data di rilevazione, oppure inserito a mano; per il futuro è una stima',
      v: r => (tassoMancante(r) ? '⚠ ' : '') + (r.alTetto ? '<span class="tetto">max</span>' : '') + percT(r.euribor, 3),
      classe: previsione, manuale: r => r.origineEuribor === 'manuale',
      titolo: r => tassoMancante(r) ? `Manca il valore dell'indice del ${data(r.riferimento)}: quello mostrato è una stima`
        : r.alTetto ? 'Previsione ferma al tetto massimo impostato nel pannello di controllo' : '' },
    { extra: true, g: 4, t: 'Aumento mensile', x: 'Variazione dell\'indice', aiuto: 'Differenza con la rilevazione precedente; per il futuro: secondo la proiezione scelta nella pagina «Previsioni» (all\'inizio: media delle variazioni passate)',
      v: r => percT(r.variazione), classe: r => 'minore ' + previsione(r) },
    { extra: true, g: 4, t: 'Spread', campo: 'spread', percento: true, v: r => percT(r.spread, 3, 1), manuale: r => r.spreadManuale },
    { g: 4, t: 'Tasso totale', aiuto: 'Indice + spread', v: r => percT(r.tassoTotale, 3), classe: r => 'forte ' + previsione(r) },
  ];

  // Colonne di approfondimento ("extra"): restano nascoste finché non si apre il loro gruppo, così la tabella
  // di base entra nello schermo. I gruppi aperti vengono ricordati.
  const gruppiAperti = new Set();
  try { for (const g of JSON.parse(ricordo.leggi('colonne') || '[]')) if (GRUPPI[g]) gruppiAperti.add(g); } catch { /* si parte con tutto chiuso */ }
  const extraDelGruppo = g => COLONNE.filter(c => c.g === g && c.extra).length;
  const GRUPPI_CON_EXTRA = GRUPPI.map((_, g) => g).filter(extraDelGruppo);
  function apriGruppi(gruppi, aperti) {
    for (const g of gruppi) if (aperti) gruppiAperti.add(g); else gruppiAperti.delete(g);
    ricordo.scrivi('colonne', JSON.stringify([...gruppiAperti]));
    disegnaPiano();
  }
  function disegnaSceltaColonne() {
    const tutti = GRUPPI_CON_EXTRA.every(g => gruppiAperti.has(g));
    $('#colonne-extra').replaceChildren(crea('span', {}, 'Approfondisci:'),
      ...GRUPPI_CON_EXTRA.map(g => crea('button', { type: 'button', 'data-gruppo': g, 'aria-pressed': String(gruppiAperti.has(g)),
        title: (gruppiAperti.has(g) ? 'Nascondi' : 'Mostra') + ' le colonne: ' + COLONNE.filter(c => c.g === g && c.extra).map(c => c.t).join(', ') }, `${GRUPPI[g]} +${extraDelGruppo(g)}`)),
      crea('button', { type: 'button', 'data-gruppo': 'tutti', 'aria-pressed': String(tutti) }, 'Tutte'));
  }
  $('#colonne-extra').addEventListener('click', evento => {
    const pulsante = evento.target.closest('button[data-gruppo]');
    if (!pulsante) return;
    const aperto = pulsante.getAttribute('aria-pressed') === 'true';
    apriGruppi(pulsante.dataset.gruppo === 'tutti' ? GRUPPI_CON_EXTRA : [+pulsante.dataset.gruppo], !aperto);
  });
  // Anche un clic sul titolo di un gruppo, in testa alla tabella, apre o chiude le sue colonne.
  $('#tabella-piano thead').addEventListener('click', evento => {
    const th = evento.target.closest('th[data-gruppo]');
    if (th) apriGruppi([+th.dataset.gruppo], !gruppiAperti.has(+th.dataset.gruppo));
  });

  function disegnaPiano() {
    const tabella = $('#tabella-piano');
    disegnaSceltaColonne();
    // Colonne da mostrare, con l'indice nell'elenco completo: il target c'è solo se impostato,
    // quelle di approfondimento solo se il loro gruppo è aperto.
    const visibili = COLONNE.map((c, i) => ({ c, i })).filter(({ c }) => (!c.visibile || c.visibile()) && (!c.extra || gruppiAperti.has(c.g)));
    const classiColonna = visibili.map(({ c }, k) => (k && visibili[k - 1].c.g !== c.g ? ' inizio-gruppo' : '') + (c.g % 2 ? ' banda' : ''));
    $('thead', tabella).replaceChildren(
      crea('tr', { className: 'gruppi' }, ...GRUPPI.map((titolo, g) => ({ titolo, g, colonne: visibili.filter(({ c }) => c.g === g).length }))
        .filter(gruppo => gruppo.colonne).map(({ titolo, g, colonne }, k) => {
          const extra = extraDelGruppo(g), aperto = gruppiAperti.has(g);
          const th = crea('th', { scope: 'colgroup', colSpan: colonne, className: (k ? 'inizio-gruppo' : '') + (g % 2 ? ' banda' : '') + (extra ? ' apribile' : '') }, titolo);
          if (extra) {
            th.dataset.gruppo = g;
            th.title = aperto ? 'Clic per nascondere le colonne di approfondimento' : `Clic per mostrare altre ${extra} colonne`;
            th.append(crea('span', { className: 'apri' }, aperto ? '−' : `+${extra}`));
          }
          return th;
        })),
      crea('tr', { className: 'colonne' }, ...visibili.map(({ c }, k) =>
        crea('th', { scope: 'col', title: (c.x || c.t) + (c.aiuto ? ': ' + c.aiuto : ''), className: classiColonna[k].trim() }, c.t))));
    const html = [], quante = { pagata: 0, problema: 0, corso: 0 };
    for (const r of stato.piano.righe) {
      const corrente = r.inizio <= stato.oggi && stato.oggi <= r.fine, s = statoRiga(r);
      if (s.stato) quante[s.stato]++;
      const classiRiga = [s.stato ? 'stato-' + s.stato : '', corrente ? 'corrente' : '', r.inizio > stato.oggi ? 'futura' : '',
        r.n > 1 && r.inizio.slice(5, 7) === '01' ? 'gennaio' : ''].filter(Boolean).join(' ');
      html.push(`<tr data-n="${r.n}"${classiRiga ? ` class="${classiRiga}"` : ''}>`);
      visibili.forEach(({ c, i }, k) => {
        const manuale = c.manuale && c.manuale(r);
        const classi = ((c.classe ? c.classe(r) : '') + (manuale ? ' manuale' : '') + (c.campo ? ' modificabile' : '') + classiColonna[k]).trim();
        const titolo = (c.titolo && c.titolo(r, s)) || (manuale ? 'Inserito a mano: svuota la cella per tornare al valore calcolato' : '');
        html.push(`<td${classi ? ` class="${classi}"` : ''}${c.campo ? ` data-col="${i}"` : ''}${titolo ? ` title="${titolo}"` : ''}>${c.v(r, s)}</td>`);
      });
      html.push('</tr>');
    }
    $('tbody', tabella).innerHTML = html.join('');
    for (const [nome, numero] of Object.entries(quante)) $('#conta-' + nome).textContent = numero;
    $('#legenda-target').hidden = obiettivo() == null;
    disegnaEsitoConti(quante);
  }

  // In testa al piano, in una frase: i conti tornano, ci sono rate da controllare, o non c'è ancora niente da confrontare.
  function disegnaEsitoConti(quante) {
    const daControllare = quante.problema, pagate = quante.pagata;
    const [classe, simbolo, titolo, spiegazione] = daControllare
      ? ['ko', '!', `${daControllare === 1 ? '1 rata' : daControllare + ' rate'} da controllare`, 'Manca la rata vera o il valore dell\'indice, oppure la rata non coincide con il calcolo: sono le righe rosse.']
      : pagate ? ['ok', '✓', 'I conti tornano', pagate === 1 ? 'La rata che hai inserito coincide con il calcolo.' : `Tutte le ${pagate} rate inserite coincidono con il calcolo.`]
        : ['neutro', 'i', 'Nessuna rata da confrontare', 'Scrivi nella colonna «Rata vera» la cifra che la banca ti ha addebitato: la riga diventa verde se i conti tornano.'];
    const esito = $('#esito-conti');
    esito.className = 'esito-conti ' + classe;
    esito.replaceChildren(crea('span', { className: 'simbolo-esito', 'aria-hidden': 'true' }, simbolo),
      crea('span', { className: 'testo-esito' }, crea('strong', {}, titolo), crea('span', {}, spiegazione)),
      ...(daControllare ? [crea('button', { type: 'button', className: 'secondario piccolo', 'data-stato': 'problema' }, 'Vai all\'ultima')] : []));
  }

  // Porta una riga al centro della tabella, che scorre nel suo riquadro. Con "mostra" porta in vista anche la tabella.
  function centraRiga(riga, mostra) {
    const riquadro = $('#contenitore-piano'), testa = $('#tabella-piano thead').offsetHeight;
    const r = riga.getBoundingClientRect(), c = riquadro.getBoundingClientRect();
    riquadro.scrollTop += r.top + r.height / 2 - (c.top + testa + (riquadro.clientHeight - testa) / 2);
    if (mostra) riquadro.scrollIntoView({ block: 'nearest' });
  }
  function vaiAlMeseCorrente(mostra) {
    const riga = $('#tabella-piano tr.corrente');
    if (riga) centraRiga(riga, mostra === true);
  }

  $('#tabella-piano tbody').addEventListener('click', evento => {
    const td = evento.target.closest('td[data-col]');
    if (!td) return;
    const colonna = COLONNE[+td.dataset.col], n = +td.parentElement.dataset.n;
    const manuale = stato.dati.rate.find(x => x.n === n) || {}, riga = stato.piano.righe[n - 1];
    const etichetta = `${colonna.x || colonna.t}, rata ${n}`;
    if (colonna.tipo === 'data') {
      // Rimettere la data calcolata equivale a togliere la forzatura.
      modificaCella(td, {
        valore: riga.riferimento, tipo: 'data', etichetta, ripristina: disegnaPiano,
        salva: v => esegui('PUT', `rate/${n}`, { [colonna.campo]: v === riga.riferimentoAutomatico ? null : v }),
      });
      return;
    }
    // Rata presa dal calcolo: la cella parte da quella cifra. Invio la conferma come rata vera, vuota la toglie.
    const copiata = colonna.campo === 'rata_vera' && riga.rataCopiata;
    modificaCella(td, {
      valore: copiata ? manuale.rata_copiata : manuale[colonna.campo], tipo: colonna.percento ? 'percento' : 'numero', etichetta, ripristina: disegnaPiano,
      invioConferma: copiata,
      salva: v => esegui('PUT', `rate/${n}`, copiata ? { rata_vera: v, rata_copiata: null } : { [colonna.campo]: v }),
    });
  });

  // ---------- Rate vere prese dal calcolo ----------
  // Chi ha controllato alcune rate e vede che i conti tornano può segnare come pagate le altre rate passate con la
  // cifra calcolata, senza copiarle a mano. Restano distinte da quelle scritte a mano (campo "rata_copiata").
  const passataSenzaRata = r => r.rataVera == null && r.fine < stato.oggi;
  // Dove manca il valore dell'indice la rata calcolata è una stima: quelle non si compilano.
  const rateDaCompilare = () => stato.piano.righe.filter(r => passataSenzaRata(r) && r.origineEuribor !== 'previsione');
  const rateSenzaIndice = () => stato.piano.righe.filter(r => passataSenzaRata(r) && r.origineEuribor === 'previsione');
  const rateCopiate = () => stato.piano.righe.filter(r => r.rataCopiata);
  const quanteRate = n => n === 1 ? '1 rata' : `${n} rate`;
  const intervallo = righe => righe.length === 1 ? meseAnno(righe[0].inizio) : `da ${meseAnno(righe[0].inizio)} a ${meseAnno(righe[righe.length - 1].inizio)}`;

  async function compilaRate() {
    const righe = rateDaCompilare();
    if (!righe.length) return avvisa('Non ci sono rate passate da compilare');
    const controllate = stato.piano.righe.filter(r => r.rataVera != null && !r.rataCopiata), diverse = controllate.filter(r => !rataUguale(r)).length;
    const avvertenza = diverse ? `ATTENZIONE: ${quanteRate(diverse)} che hai scritto tu non coincid${diverse === 1 ? 'e' : 'ono'} con il calcolo. Forse le regole non sono ancora giuste: conviene sistemarle prima.\n\n`
      : !controllate.length ? 'ATTENZIONE: non hai ancora scritto nessuna rata vera, quindi non c\'è modo di sapere se il calcolo è giusto. Conviene controllarne prima almeno due o tre.\n\n' : '';
    if (!confirm(`${avvertenza}Segno come pagat${righe.length === 1 ? 'a' : 'e'} ${quanteRate(righe.length)} (${intervallo(righe)}) con la cifra calcolata dal programma?\n\n`
      + 'Resteranno riconoscibili dal segno «=» perché non sono state controllate sull\'estratto conto. Potrai correggerle una per una, oppure toglierle tutte dal pannello di controllo.')) return;
    await esegui('POST', 'rate', { righe: righe.map(r => ({ n: r.n, rata_copiata: Number(r.rataCalcolata.toFixed(2)) })) },
      `${quanteRate(righe.length)} compilat${righe.length === 1 ? 'a' : 'e'} dal calcolo`);
  }
  async function togliCopiate() {
    const righe = rateCopiate();
    if (!righe.length || !confirm(`Tolgo ${quanteRate(righe.length)} pres${righe.length === 1 ? 'a' : 'e'} dal calcolo (${intervallo(righe)})?\n\nLe rate che hai scritto tu restano.`)) return;
    await esegui('POST', 'rate', { righe: righe.map(r => ({ n: r.n, rata_copiata: null })) }, `${quanteRate(righe.length)} tolt${righe.length === 1 ? 'a' : 'e'}`);
  }
  function disegnaAllinea() {
    const daCompilare = rateDaCompilare(), senzaIndice = rateSenzaIndice(), copiate = rateCopiate();
    const cambiate = copiate.filter(r => !rataUguale(r)).length;
    const frasi = [daCompilare.length ? `Rate passate senza cifra: ${daCompilare.length} (${intervallo(daCompilare)}).` : 'Non ci sono rate passate da compilare.'];
    if (senzaIndice.length) frasi.push(`${quanteRate(senzaIndice.length)} non si ${senzaIndice.length === 1 ? 'può' : 'possono'} compilare perché manca il valore dell'indice (${intervallo(senzaIndice)}): aggiungilo nella pagina «Tassi».`);
    if (copiate.length) frasi.push(`Rate prese dal calcolo finora: ${copiate.length} (${intervallo(copiate)}).`);
    $('#stato-allinea').replaceChildren(...frasi.map(frase => crea('p', { className: 'nota' }, frase)),
      ...(cambiate ? [crea('p', { className: 'nota evidenza' }, `${quanteRate(cambiate)} pres${cambiate === 1 ? 'a' : 'e'} dal calcolo non coincid${cambiate === 1 ? 'e' : 'ono'} più, perché regole o tassi sono cambiati dopo: toglile e compila di nuovo.`)] : []));
    for (const id of ['#compila-rate', '#compila-rate-pannello']) $(id).textContent = `Compila ${quanteRate(daCompilare.length)} dal calcolo`;
    $('#compila-rate').hidden = $('#compila-rate-pannello').hidden = !daCompilare.length;
    $('#togli-copiate').hidden = $('#legenda-copiata').hidden = !copiate.length;
    $('#togli-copiate').textContent = `Togli ${quanteRate(copiate.length)} pres${copiate.length === 1 ? 'a' : 'e'} dal calcolo`;
  }
  $('#compila-rate').addEventListener('click', compilaRate);
  $('#compila-rate-pannello').addEventListener('click', compilaRate);
  $('#togli-copiate').addEventListener('click', togliCopiate);
  $('#vai-oggi').addEventListener('click', () => vaiAlMeseCorrente(true));
  // Clic su uno stato della legenda (o su «Vai all'ultima» nel riquadro in testa): porta all'ultima riga con quello stato.
  const vaiAlloStato = evento => {
    const voce = evento.target.closest('button[data-stato]');
    const righe = voce ? document.querySelectorAll('#tabella-piano tr.stato-' + voce.dataset.stato) : [];
    if (righe.length) centraRiga(righe[righe.length - 1], true);
  };
  $('#legenda-piano').addEventListener('click', vaiAlloStato);
  $('#esito-conti').addEventListener('click', vaiAlloStato);

  // ---------- Pannello di controllo ----------
  const formApplicato = $('#form-applicato');

  function disegnaPannello() {
    disegnaInfoRata();
    anteprimaRata();
    disegnaObiettivo();
    disegnaAllinea();
    disegnaStatisticheMutuo();
  }

  // Rata ideale (target)
  const formObiettivo = $('#form-obiettivo');
  function disegnaObiettivo() {
    const target = obiettivo(), righe = stato.piano.righe, blocco = $('#stato-obiettivo');
    if (document.activeElement !== formObiettivo.rata) formObiettivo.rata.value = perCampo(target);
    $('#togli-obiettivo').hidden = target == null;
    if (target == null) { blocco.replaceChildren(); return; }
    const corrente = Calcolo.rataPerData(righe, stato.oggi) || righe[righe.length - 1];
    const pagate = righe.filter(r => r.rataVera != null);
    const entro = r => r.distanzaObiettivo <= 0.005;
    const distanza = corrente.distanzaObiettivo;
    const frasi = [`Rata di ${meseAnno(corrente.inizio)}: ${euro(corrente.rataEffettiva)}, `
      + (Math.abs(distanza) < 0.005 ? 'esattamente in target.' : `${euro(Math.abs(distanza))} ${distanza > 0 ? 'sopra' : 'sotto'} il target (${perc(corrente.rataEffettiva / target, 1)}).`)];
    if (pagate.length) frasi.push(`Rate già addebitate entro il target: ${pagate.filter(entro).length} su ${pagate.length}.`);
    if (!entro(corrente)) {
      const rientro = righe.find(r => r.n > corrente.n && entro(r));
      frasi.push(rientro ? `Secondo le previsioni la rata torna entro il target da ${meseAnno(rientro.inizio)}.` : 'Secondo le previsioni la rata non torna entro il target.');
    } else {
      const uscita = righe.find(r => r.n > corrente.n && !entro(r));
      frasi.push(uscita ? `Secondo le previsioni la rata supera il target da ${meseAnno(uscita.inizio)}.` : 'Secondo le previsioni la rata resta entro il target fino alla fine.');
    }
    blocco.replaceChildren(...frasi.map(frase => crea('p', { className: 'nota' }, frase)));
  }
  const salvaObiettivo = valore => esegui('PUT', 'parametri', { rata_obiettivo: valore }, valore ? `Target impostato a ${euro(valore)}` : 'Target tolto');
  formObiettivo.addEventListener('submit', evento => {
    evento.preventDefault();
    const v = leggiNumero(formObiettivo.rata.value, true);
    if (Number.isNaN(v) || v < 0) return avvisa('Importo non valido', true);
    formObiettivo.rata.blur();
    salvaObiettivo(v || 0);
  });
  $('#togli-obiettivo').addEventListener('click', () => salvaObiettivo(0));

  // Statistiche del mutuo, nella pagina del piano: un riquadro per argomento, calcolate sulle rate già addebitate.
  function disegnaStatisticheMutuo() {
    const p = stato.dati.parametri, righe = stato.piano.righe, contenitore = $('#statistiche-mutuo');
    const pagate = righe.filter(r => r.rataVera != null);
    if (!pagate.length) { contenitore.replaceChildren(crea('p', { className: 'nota' }, 'Le statistiche compaiono dopo aver inserito la prima rata vera.')); return; }
    const somma = (lista, valore) => lista.reduce((totale, r) => totale + valore(r), 0);
    const estremo = (lista, valore, verso) => lista.reduce((a, r) => (valore(r) - valore(a)) * verso > 0 ? r : a);
    const mese = r => `${MESI[+r.inizio.slice(5, 7) - 1].slice(0, 3)} ${r.inizio.slice(0, 4)}`;
    // Una voce è [etichetta, valore, dettaglio in piccolo, classe del pallino colorato].
    const voce = ([etichetta, valore, dettaglio, pallino]) => crea('div', {},
      crea('dt', {}, ...(pallino ? [crea('i', { className: 'pallino ' + pallino })] : []), etichetta),
      crea('dd', {}, valore, ...(dettaglio ? [crea('small', {}, dettaglio)] : [])));
    const riquadro = (titolo, cifra, didascalia, voci, extra) => crea('section', { className: 'riquadro-statistica' },
      crea('h3', {}, titolo), crea('p', { className: 'cifra' }, cifra), crea('p', { className: 'didascalia' }, didascalia),
      ...(extra ? [extra] : []), crea('dl', {}, ...voci.map(voce)));

    // Quanto hai pagato: totale e composizione
    const versato = somma(pagate, r => r.rataVera), capitale = somma(pagate, r => r.quotaCapitale), spese = pagate.length * p.spese_rata;
    const interessi = versato - capitale - spese;
    const parti = [['Capitale', capitale, 'capitale'], ['Interessi', interessi, 'interessi'], ['Spese', spese, 'spese']];
    const barra = crea('div', { className: 'composizione', role: 'img', 'aria-label': parti.map(([nome, v]) => `${nome} ${perc(v / versato, 1)}`).join(', ') },
      ...parti.map(([nome, v, classe]) => { const pezzo = crea('span', { className: classe, title: `${nome}: ${euro(v)}` }); pezzo.style.flexGrow = Math.max(v, 0); return pezzo; }));
    const dalCalcolo = pagate.filter(r => r.rataCopiata).length;
    const pagato = riquadro('Quanto hai pagato', euro(versato), `in ${pagate.length} rate su ${righe.length}` + (dalCalcolo ? `, ${dalCalcolo} prese dal calcolo` : ''),
      parti.map(([nome, v, classe]) => [nome, euro(v), perc(v / versato, 1), classe]), barra);

    // Le tue rate
    const bassa = estremo(pagate, r => r.rataVera, -1), alta = estremo(pagate, r => r.rataVera, 1), ultima = pagate[pagate.length - 1];
    const rate = riquadro('Le tue rate', euro(versato / pagate.length), 'rata media',
      [['Più bassa', euro(bassa.rataVera), mese(bassa)], ['Più alta', euro(alta.rataVera), mese(alta)], ['Ultima addebitata', euro(ultima.rataVera), mese(ultima)]]);

    // Andamento mese per mese, a parità di giorni
    const variazioni = pagate.filter(r => r.variazioneRata != null && righe[r.n - 2].rataVera != null);
    let andamento = null;
    if (variazioni.length) {
      const aumento = estremo(variazioni, r => r.variazioneRata, 1), calo = estremo(variazioni, r => r.variazioneRata, -1);
      const su = variazioni.filter(r => r.variazioneRata > 0.00005).length, giu = variazioni.filter(r => r.variazioneRata < -0.00005).length;
      andamento = riquadro('Andamento mese per mese', percConSegno(somma(variazioni, r => r.variazioneRata) / variazioni.length), 'variazione media al mese del costo al giorno',
        [['▲ Mesi in aumento', String(su), `${giu} in calo ▼`], ['Maggior aumento', percConSegno(aumento.variazioneRata), mese(aumento)], ['Maggior calo', percConSegno(calo.variazioneRata), mese(calo)]]);
    }

    // Tassi applicati
    const tassoBasso = estremo(pagate, r => r.tassoTotale, -1), tassoAlto = estremo(pagate, r => r.tassoTotale, 1);
    const corrente = Calcolo.rataPerData(righe, stato.oggi) || ultima;
    const tassi = riquadro('Tassi applicati', perc(somma(pagate, r => r.tassoTotale) / pagate.length, 3), 'tasso totale medio (indice + spread)',
      [['Più basso', perc(tassoBasso.tassoTotale, 3), mese(tassoBasso)], ['Più alto', perc(tassoAlto.tassoTotale, 3), mese(tassoAlto)], ['Di questo mese', perc(corrente.tassoTotale, 3), mese(corrente)]]);

    // Da qui alla fine (previsione)
    const future = righe.filter(r => r.rataVera == null);
    let futuro = null;
    if (future.length) {
      const massima = estremo(future, r => r.rataCalcolata, 1), fine = righe[righe.length - 1];
      futuro = riquadro('Da qui alla fine', euro(somma(future, r => r.rataCalcolata - r.quotaCapitale - p.spese_rata)), `interessi ancora da pagare (previsione)`,
        [['Rate mancanti', String(future.length), `fino a ${mese(fine)}`], ['Capitale da rimborsare', euro(future[0].debito)], ['Rata prevista più alta', euro(massima.rataCalcolata), mese(massima)]]);
    }
    contenitore.replaceChildren(...[pagato, rate, andamento, tassi, futuro].filter(Boolean));
  }
  // Le statistiche si possono chiudere per lasciare più spazio alla tabella (la scelta viene ricordata).
  function mostraStatistiche(aperte, ricorda) {
    $('#statistiche-mutuo').hidden = !aperte;
    $('#mostra-statistiche').setAttribute('aria-expanded', aperte);
    $('#mostra-statistiche').textContent = aperte ? 'Nascondi statistiche' : 'Mostra statistiche';
    if (ricorda) ricordo.scrivi('statistiche', aperte ? 'aperte' : 'chiuse');
  }
  $('#mostra-statistiche').addEventListener('click', () => mostraStatistiche($('#statistiche-mutuo').hidden, true));
  {
    const scelta = ricordo.leggi('statistiche');
    // All'inizio sono chiuse, così in primo piano ci sono il riquadro dei conti e la tabella.
    mostraStatistiche(scelta ? scelta === 'aperte' : false, false);
  }

  // Tasso applicato a mano
  const rataScelta = () => formApplicato.giorno.value ? Calcolo.rataPerData(stato.piano.righe, formApplicato.giorno.value) : null;
  const manualiRata = n => stato.dati.rate.find(x => x.n === n) || {};
  const ORIGINI = M.ORIGINI = { db: 'dai tassi inseriti', manuale: 'inserito a mano', previsione: 'previsione' };

  function disegnaInfoRata() {
    const info = $('#info-rata'), r = rataScelta();
    const fuori = formApplicato.giorno.value && !r;
    for (const nome of ['data_riferimento', 'euribor', 'tasso_applicato']) formApplicato[nome].disabled = !r;
    if (!r) { info.replaceChildren(fuori ? 'La data è fuori dal piano di ammortamento.' : ''); return; }
    const voci = [
      ['Periodo', `${data(r.inizio)} – ${data(r.fine)}`],
      ['Data di rilevazione', data(r.riferimento) + (r.riferimentoManuale ? ` (forzata a mano; calcolata: ${data(r.riferimentoAutomatico)})` : ' (calcolata)')],
      [indice(), `${perc(r.euribor, 3)} (${ORIGINI[r.origineEuribor]})`],
      ['Tasso totale', perc(r.tassoTotale, 3)],
      ['Tasso totale applicato', r.tassoApplicato == null ? '—' : perc(r.tassoApplicato, 3) + (r.tassoApplicatoManuale ? ' (inserito a mano)' : '')],
      ['Rata calcolata', euro(r.rataCalcolata)],
    ];
    info.replaceChildren(crea('strong', {}, `Rata n. ${r.n} · ${meseAnno(r.inizio)}`),
      crea('dl', {}, ...voci.flatMap(([etichetta, valore]) => [crea('dt', {}, etichetta), crea('dd', {}, valore)])));
  }
  function caricaValoriRata() {
    const r = rataScelta(), manuali = r ? manualiRata(r.n) : {};
    formApplicato.data_riferimento.value = manuali.data_riferimento || '';
    formApplicato.euribor.value = perCampo(manuali.euribor, true);
    formApplicato.tasso_applicato.value = perCampo(manuali.tasso_applicato, true);
    formApplicato.euribor.placeholder = formApplicato.tasso_applicato.placeholder = r ? 'automatico' : '';
    disegnaInfoRata();
    anteprimaRata();
  }
  // Data forzata scritta nel modulo: vuota o uguale a quella calcolata = nessuna forzatura.
  function dataForzata(r) {
    const scritta = formApplicato.data_riferimento.value;
    return !scritta || scritta === r.riferimentoAutomatico ? null : scritta;
  }
  // Mostra come cambierebbe la rata prima di salvare.
  function anteprimaRata() {
    const nota = $('#anteprima-rata'), r = rataScelta();
    nota.hidden = true;
    if (!r) return;
    const v = leggiNumero(formApplicato.euribor.value);
    if (Number.isNaN(v)) return;
    const manuali = manualiRata(r.n);
    const nuovi = { euribor: v == null ? null : daPercento(v), data_riferimento: dataForzata(r) };
    if (nuovi.euribor === (manuali.euribor == null ? null : manuali.euribor)
      && nuovi.data_riferimento === (manuali.data_riferimento || null)) return;
    const rate = stato.dati.rate.filter(x => x.n !== r.n).concat({ ...manuali, n: r.n, ...nuovi });
    const dopo = Calcolo.calcolaPiano({ ...stato.dati, rate }).righe[r.n - 1];
    const origine = ORIGINI[dopo.origineEuribor] + (dopo.origineEuribor === 'db' ? ` al ${data(dopo.riferimento)}` : '');
    nota.textContent = `Con questi valori: ${indice()} ${perc(dopo.euribor, 3)} (${origine}), rata calcolata ${euro(r.rataCalcolata)} → ${euro(dopo.rataCalcolata)}.`
      + (dopo.origineEuribor === 'previsione' ? ` Non c'è un valore inserito per il ${data(dopo.riferimento)}.` : '');
    nota.hidden = false;
  }
  formApplicato.giorno.addEventListener('change', caricaValoriRata);
  formApplicato.euribor.addEventListener('input', anteprimaRata);
  formApplicato.data_riferimento.addEventListener('input', anteprimaRata);
  formApplicato.addEventListener('submit', async evento => {
    evento.preventDefault();
    const r = rataScelta();
    if (!r) return avvisa('Scegli una data dentro il piano', true);
    const euribor = leggiNumero(formApplicato.euribor.value), applicato = leggiNumero(formApplicato.tasso_applicato.value);
    if (Number.isNaN(euribor) || Number.isNaN(applicato)) return avvisa('Tasso non valido', true);
    const corpo = {
      data_riferimento: dataForzata(r),
      euribor: euribor == null ? null : daPercento(euribor),
      tasso_applicato: applicato == null ? null : daPercento(applicato),
    };
    if (await esegui('PUT', `rate/${r.n}`, corpo, `Rata di ${meseAnno(r.inizio)} aggiornata`)) caricaValoriRata();
  });
  $('#ripristina-rata').addEventListener('click', async () => {
    const r = rataScelta();
    if (!r) return;
    if (await esegui('PUT', `rate/${r.n}`, { data_riferimento: null, euribor: null, tasso_applicato: null }, `Rata di ${meseAnno(r.inizio)}: tornata ai valori automatici`)) caricaValoriRata();
  });

  // Incolla più tassi
  function leggiRigheTassi(testo) {
    const righe = [];
    let scartate = 0;
    for (const linea of testo.split(/\r?\n/)) {
      if (!linea.trim()) continue;
      const d = /(\d{4})-(\d{2})-(\d{2})|(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})/.exec(linea);
      const giorno = d && (d[1] ? `${d[1]}-${d[2]}-${d[3]}` : `${d[6]}-${d[5].padStart(2, '0')}-${d[4].padStart(2, '0')}`);
      if (!giorno || !dataValida(giorno)) { scartate++; continue; }
      const resto = linea.slice(d.index + d[0].length);
      let pezzi = resto.split(/[;\t]+|\s+/).filter(Boolean);
      if (pezzi.length && pezzi[0].startsWith(',')) pezzi = resto.split(',');   // CSV con la virgola come separatore
      const numeri = pezzi.map(leggiNumero).filter(n => typeof n === 'number' && !Number.isNaN(n));
      if (!numeri.length) { scartate++; continue; }
      righe.push({ giorno, tasso_360: daPercento(numeri[0]) });
    }
    return { righe, scartate };
  }
  $('#form-incolla').addEventListener('submit', async evento => {
    evento.preventDefault();
    const { righe, scartate } = leggiRigheTassi(evento.target.testo.value);
    if (!righe.length) return avvisa('Non ho trovato righe con data e valore', true);
    const salvati = righe.length === 1 ? '1 tasso salvato' : `${righe.length} tassi salvati`;
    const ignorate = !scartate ? '' : scartate === 1 ? ', 1 riga ignorata' : `, ${scartate} righe ignorate`;
    if (await esegui('POST', 'euribor', { righe }, salvati + ignorate)) evento.target.reset();
  });

  // ---------- Schede ----------
  function mostraScheda(nome) {
    const nuova = $('#scheda-' + nome);
    if (nuova && nuova.hidden) window.scrollTo(0, 0);   // la pagina scorre tutta insieme: una scheda nuova parte dall'alto
    for (const pulsante of document.querySelectorAll('.schede button')) {
      const attiva = pulsante.dataset.scheda === nome;
      pulsante.setAttribute('aria-selected', attiva);
      $('#scheda-' + pulsante.dataset.scheda).hidden = !attiva;
    }
    // I numeri del mese in testa riguardano il prestito aperto: nella scheda con tutti i prestiti non servono.
    $('#riepilogo').hidden = nome === 'prestiti';
    history.replaceState(null, '', '#' + nome);   // ricaricando la pagina si resta sulla stessa scheda
    if (M.allApertura[nome]) M.allApertura[nome]();
    if (nome === 'piano' && !stato.schedaVista.piano) vaiAlMeseCorrente();
    stato.schedaVista[nome] = true;
  }
  // ---------- Avvio ----------
  // Senza una configurazione parte la guida (configura.js); altrimenti si mostra il programma.
  M.avvia = async function avvia() {
    const pronto = Archivio.configurato();
    $('#configurazione').hidden = pronto;
    for (const id of ['#principale', '.schede', '#riepilogo', '#apri-configurazione']) $(id).hidden = !pronto;
    if (!pronto) return M.apriGuida(false);
    try {
      aggiorna(await api('GET', 'dati'));
    } catch (errore) {
      return avvisa(errore.message, true);
    }
    formApplicato.giorno.value = stato.oggi;
    caricaValoriRata();
    const scheda = location.hash.slice(1);
    mostraScheda(/^[a-z]+$/.test(scheda) && $('#scheda-' + scheda) ? scheda : 'piano');
    for (const f of M.dopoAvvio) f();   // ad esempio lo scarico automatico dei tassi (tassi.js)
  };
  // Una variante della pagina può sostituire l'avvio con M.allAvvio (ad esempio per chiedere prima quali dati caricare).
  window.addEventListener('DOMContentLoaded', () => (M.allAvvio || M.avvia)());

  $('.schede').addEventListener('click', evento => {
    const pulsante = evento.target.closest('button[data-scheda]');
    if (pulsante) mostraScheda(pulsante.dataset.scheda);
  });
})();
