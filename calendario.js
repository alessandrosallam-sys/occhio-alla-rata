// Pagine "Calendario" e "Festività": dove cade il giorno in cui si legge l'indice per ogni rata,
// quali giorni vengono saltati nel conteggio (fine settimana e festività TARGET, con il loro nome).
(function () {
  'use strict';
  const M = window.Mutuo;
  const { stato, $, crea, esegui, MESI, GIORNI, data, meseAnno, giornoSettimana, perc } = M;
  const SETTIMANA = ['lun', 'mar', 'mer', 'gio', 'ven', 'sab', 'dom'];
  const giornoBreve = iso => `${giornoSettimana(iso).slice(0, 3)} ${data(iso).slice(0, 5)}`;
  const iso = (anno, mese, giorno) => `${anno}-${String(mese + 1).padStart(2, '0')}-${String(giorno).padStart(2, '0')}`;

  let annoMostrato = +stato.oggi.slice(0, 4);
  let giornoScelto = stato.oggi;

  // Indici per giorno ricavati dal piano: date di riferimento, date calcolate ma sostituite, giorni contati.
  function indici() {
    const riferimenti = new Map(), sostituite = new Map(), contati = new Map();
    for (const r of stato.piano.righe) {
      if (r.eredita) continue;   // fra una revisione e l'altra il tasso non viene riletto
      riferimenti.set(r.riferimento, r);
      if (r.riferimentoManuale) sostituite.set(r.riferimentoAutomatico, r);
      r.conteggio.forEach((giorno, i) => { if (giorno !== r.riferimentoAutomatico) contati.set(giorno, { rata: r, ordine: i + 1 }); });
    }
    return { riferimenti, sostituite, contati, feste: new Set(stato.dati.festivita), tassi: new Map(stato.dati.euribor.map(t => [t.giorno, t.tasso_360])) };
  }

  // Classi e spiegazioni di un giorno.
  function descrivi(giorno, ix) {
    const classi = [], righe = [];
    const settimana = new Date(giorno + 'T00:00:00Z').getUTCDay();
    const rata = ix.riferimenti.get(giorno);
    if (rata) {
      const media = rata.mediaDi > 0 || (stato.dati.parametri.regola_rilevazione === 'media_mese' && !rata.riferimentoManuale);
      const tasso = media ? (rata.origineEuribor === 'db' ? rata.euribor : null) : ix.tassi.get(giorno);
      const statoTasso = tasso != null ? 'presente' : giorno <= stato.oggi ? 'mancante' : 'futuro';
      classi.push('riferimento', statoTasso);
      righe.push(media ? `Fine del mese di cui si usa la media per la rata di ${meseAnno(rata.inizio)}.` : `Giorno in cui si legge ${M.indice()} per la rata di ${meseAnno(rata.inizio)}${rata.riferimentoManuale ? ' (forzato a mano)' : ''}.`);
      righe.push(tasso != null ? `Valore${media ? ' medio' : ''}: ${perc(tasso, 3)}.`
        : statoTasso === 'mancante' ? 'Il valore non è ancora stato inserito.' : 'Rilevazione futura.');
      if (rata.origineEuribor === 'manuale') righe.push(`Per questa rata il valore dell'indice è inserito a mano: ${perc(rata.euribor, 3)}.`);
    }
    const sostituita = ix.sostituite.get(giorno);
    if (sostituita) {
      classi.push('sostituita');
      righe.push(`Data calcolata per la rata di ${meseAnno(sostituita.inizio)}, sostituita da quella forzata a mano (${data(sostituita.riferimento)}).`);
    }
    const contato = ix.contati.get(giorno);
    if (contato) {
      classi.push('contato');
      righe.push(`${contato.ordine}° giorno lavorativo contato all'indietro per la rata di ${meseAnno(contato.rata.inizio)}.`);
    }
    if (ix.feste.has(giorno)) {
      classi.push('festa');
      const nome = Calcolo.nomeFestivita(giorno);
      righe.push((Calcolo.FESTE_TARGET.includes(nome) ? `Festività TARGET: ${nome}.` : 'Giorno di chiusura aggiunto a mano.')
        + ' Il giorno non conta come lavorativo.');
    }
    if (settimana === 0 || settimana === 6) {
      classi.push('fine-settimana');
      righe.push('Fine settimana: il giorno non conta come lavorativo.');
    }
    if (giorno === stato.oggi) classi.push('oggi');
    if (!righe.length) righe.push('Giorno lavorativo.');
    return { classi, righe, rata, finesettimana: settimana === 0 || settimana === 6 };
  }

  // ---------- Calendario ----------
  function limitiAnni() {
    const righe = stato.piano.righe;
    return [+righe[0].riferimento.slice(0, 4), +righe[righe.length - 1].fine.slice(0, 4)];
  }
  function disegnaCalendario() {
    const [primoAnno, ultimoAnno] = limitiAnni();
    annoMostrato = Math.max(primoAnno, Math.min(ultimoAnno, annoMostrato));
    const ix = indici();
    $('#anno-calendario').textContent = annoMostrato;
    $('#anno-prima').disabled = annoMostrato <= primoAnno;
    $('#anno-dopo').disabled = annoMostrato >= ultimoAnno;

    const mesi = [];
    for (let mese = 0; mese < 12; mese++) {
      const giorni = new Date(Date.UTC(annoMostrato, mese + 1, 0)).getUTCDate();
      const vuoti = (new Date(Date.UTC(annoMostrato, mese, 1)).getUTCDay() + 6) % 7;   // la settimana parte da lunedì
      const celle = SETTIMANA.map(g => crea('span', { className: 'intestazione' }, g[0].toUpperCase()));
      for (let i = 0; i < vuoti; i++) celle.push(crea('span'));
      for (let g = 1; g <= giorni; g++) {
        const giorno = iso(annoMostrato, mese, g), d = descrivi(giorno, ix);
        celle.push(crea('button', { type: 'button', className: ['giorno', ...d.classi, giorno === giornoScelto ? 'scelto' : ''].join(' ').trim(),
          'data-giorno': giorno, title: `${giornoSettimana(giorno)} ${data(giorno)}\n${d.righe.join('\n')}` }, String(g)));
      }
      const corrente = iso(annoMostrato, mese, 1).slice(0, 7) === stato.oggi.slice(0, 7);
      mesi.push(crea('div', { className: 'mese' + (corrente ? ' corrente' : '') }, crea('h3', {}, MESI[mese]), crea('div', { className: 'griglia-giorni' }, ...celle)));
    }
    $('#mesi-calendario').replaceChildren(...mesi);

    // Elenchi dell'anno
    const rate = stato.piano.righe.filter(r => !r.eredita && +r.riferimento.slice(0, 4) === annoMostrato);
    $('#riferimenti-anno').replaceChildren(...rate.map(r => {
      const tasso = r.mediaDi ? r.euribor : ix.tassi.get(r.riferimento);
      const valore = r.origineEuribor === 'manuale' ? `${perc(r.euribor, 3)} a mano` : tasso != null ? perc(tasso, 3) : r.riferimento <= stato.oggi ? '⚠ manca' : 'futura';
      return crea('tr', { 'data-giorno': r.riferimento, className: r.riferimento === giornoScelto ? 'scelta' : '' },
        crea('td', {}, giornoBreve(r.riferimento) + (r.riferimentoManuale ? ' ✎' : '')), crea('td', { className: 'testo' }, meseAnno(r.inizio)), crea('td', {}, valore));
    }));
    $('#titolo-riferimenti').textContent = `Date di rilevazione del ${annoMostrato}`;
    const feste = stato.dati.festivita.filter(g => +g.slice(0, 4) === annoMostrato);
    $('#feste-anno').replaceChildren(...feste.map(g => crea('tr', { 'data-giorno': g, className: g === giornoScelto ? 'scelta' : '' },
      crea('td', {}, giornoBreve(g)), crea('td', { className: 'testo' }, Calcolo.nomeFestivita(g)))));
    $('#titolo-feste').textContent = `Festività TARGET del ${annoMostrato}`;
    disegnaDettaglio(ix);
  }

  function disegnaDettaglio(ix) {
    const contenitore = $('#dettaglio-giorno');
    if (!giornoScelto) { contenitore.replaceChildren(crea('p', { className: 'nota' }, 'Clic su un giorno per vedere i dettagli.')); return; }
    const d = descrivi(giornoScelto, ix);
    const [, mese, giorno] = giornoScelto.split('-').map(Number);
    const azioni = crea('div', { className: 'azioni' });
    if (d.rata && !ix.tassi.has(giornoScelto)) azioni.append(crea('button', { type: 'button', 'data-azione': 'tasso' }, 'Inserisci il valore di questo giorno'));
    if (ix.feste.has(giornoScelto)) azioni.append(crea('button', { type: 'button', className: 'secondario', 'data-azione': 'togli-festa' }, 'Togli la festività'));
    else if (!d.finesettimana) azioni.append(crea('button', { type: 'button', className: 'secondario', 'data-azione': 'festa' }, 'Segna come festività'));
    contenitore.replaceChildren(crea('h3', {}, `${giornoSettimana(giornoScelto)} ${giorno} ${MESI[mese - 1]} ${giornoScelto.slice(0, 4)}`),
      crea('ul', { className: 'righe-dettaglio' }, ...d.righe.map(riga => crea('li', {}, riga))), azioni);
  }

  function scegli(giorno) {
    giornoScelto = giorno;
    annoMostrato = +giorno.slice(0, 4);
    disegnaCalendario();
  }
  $('#mesi-calendario').addEventListener('click', evento => {
    const pulsante = evento.target.closest('button[data-giorno]');
    if (pulsante) scegli(pulsante.dataset.giorno);
  });
  for (const id of ['riferimenti-anno', 'feste-anno']) {
    $('#' + id).addEventListener('click', evento => {
      const riga = evento.target.closest('tr[data-giorno]');
      if (riga) scegli(riga.dataset.giorno);
    });
  }
  $('#anno-prima').addEventListener('click', () => { annoMostrato--; disegnaCalendario(); });
  $('#anno-dopo').addEventListener('click', () => { annoMostrato++; disegnaCalendario(); });
  $('#anno-oggi').addEventListener('click', () => scegli(stato.oggi));
  $('#dettaglio-giorno').addEventListener('click', evento => {
    const azione = (evento.target.closest('button[data-azione]') || { dataset: {} }).dataset.azione;
    if (azione === 'tasso') M.preparaTasso(giornoScelto);
    else if (azione === 'festa') esegui('PUT', `festivita/${giornoScelto}`, {}, `Festività del ${data(giornoScelto)} aggiunta`);
    else if (azione === 'togli-festa') esegui('DELETE', `festivita/${giornoScelto}`, null, `Festività del ${data(giornoScelto)} tolta`);
  });

  // ---------- Festività: una riga per anno, una colonna per festa ----------
  function disegnaFestivita() {
    const nomi = Calcolo.FESTE_TARGET, perAnno = new Map();
    for (const giorno of stato.dati.festivita) {
      const anno = giorno.slice(0, 4);
      if (!perAnno.has(anno)) perAnno.set(anno, new Map());
      const nome = Calcolo.nomeFestivita(giorno), feste = perAnno.get(anno);
      feste.set(nome, (feste.get(nome) || []).concat(giorno));
    }
    const festa = giorno => crea('span', { className: 'festa' }, giornoBreve(giorno),
      crea('button', { type: 'button', 'data-giorno': giorno, 'aria-label': `Elimina la festività del ${data(giorno)}`, title: 'Elimina' }, '×'));
    $('#tabella-festivita thead').replaceChildren(crea('tr', {}, crea('th', {}, 'Anno'), ...nomi.map(n => crea('th', { className: 'testo' }, n)), crea('th', { className: 'testo' }, 'Altre chiusure')));
    $('#tabella-festivita tbody').replaceChildren(...[...perAnno].map(([anno, feste]) =>
      crea('tr', { className: anno === stato.oggi.slice(0, 4) ? 'corrente' : '' }, crea('td', {}, anno),
        ...[...nomi, 'Altra chiusura'].map(nome => crea('td', { className: 'testo' }, ...(feste.get(nome) || []).map(festa))))));
    $('#conteggio-festivita').textContent = `${stato.dati.festivita.length} giorni, dal ${[...perAnno.keys()][0] || '—'} al ${[...perAnno.keys()].pop() || '—'}`;
  }
  $('#tabella-festivita tbody').addEventListener('click', evento => {
    const pulsante = evento.target.closest('button[data-giorno]');
    const giorno = pulsante && pulsante.dataset.giorno;
    if (giorno && confirm(`Eliminare la festività del ${data(giorno)} (${Calcolo.nomeFestivita(giorno)})?`)) {
      esegui('DELETE', `festivita/${giorno}`, null, 'Festività eliminata');
    }
  });
  $('#form-festivita').addEventListener('submit', async evento => {
    evento.preventDefault();
    const giorno = evento.target.giorno.value;
    if (await esegui('PUT', `festivita/${giorno}`, {}, `Festività del ${data(giorno)} aggiunta`)) evento.target.reset();
  });

  M.viste.push(disegnaCalendario, disegnaFestivita);
})();
