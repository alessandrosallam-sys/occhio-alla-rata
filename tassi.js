// Pagina "Tassi": valori dell'indice del contratto. Filtro per periodo, statistiche, grafico,
// riepilogo per anno, tabella e inserimento dei valori.
(function () {
  'use strict';
  const M = window.Mutuo;
  const { stato, $, crea, esegui, avvisa, modificaCella, MESI, data, meseAnno, giornoSettimana, perc, leggiNumero, daPercento } = M;

  // [codice, etichetta, mesi all'indietro dall'ultimo tasso] — null = il periodo del mutuo, 0 = tutto lo storico
  const PERIODI = [['mutuo', 'Il mio mutuo', null], ['1a', '1 anno', 12], ['2a', '2 anni', 24], ['5a', '5 anni', 60], ['10a', '10 anni', 120], ['tutto', 'Tutto', 0]];
  const filtro = { periodo: 'mutuo', da: '', a: '' };
  let scelti = [];        // punti del periodo scelto
  let serieMostrata = { nome: '', valori: [], delContratto: true };   // la serie nel grafico (vedi serieCompleta)

  const inPunti = tassi => tassi.map(t => ({ x: Calcolo.isoInGiorno(t.giorno), y: t.tasso_360, giorno: t.giorno }));
  // Differenze fra tassi in punti percentuali, con il segno.
  const punti = (v, decimali = 3) => (v > 0 ? '+' : v < 0 ? '−' : '')
    + (Math.abs(v) * 100).toLocaleString('it-IT', { minimumFractionDigits: decimali, maximumFractionDigits: decimali }) + ' punti';
  // Stesso giorno di N mesi prima (se non esiste, l'ultimo giorno di quel mese).
  function mesiPrima(iso, mesi) {
    const [anno, mese, giorno] = iso.split('-').map(Number);
    const primo = new Date(Date.UTC(anno, mese - 1 - mesi, 1));
    const ultimoGiorno = new Date(Date.UTC(primo.getUTCFullYear(), primo.getUTCMonth() + 1, 0)).getUTCDate();
    return new Date(Date.UTC(primo.getUTCFullYear(), primo.getUTCMonth(), Math.min(giorno, ultimoGiorno))).toISOString().slice(0, 10);
  }
  // Rate che leggono davvero il tasso dal database, per data di riferimento.
  const usiDeiTassi = () => new Map(stato.piano.righe.filter(r => r.origineEuribor === 'db' && !r.eredita && !r.mediaDi).map(r => [r.riferimento, r]));
  // Rate per data di riferimento, qualunque sia l'origine del tasso.
  const ratePerRiferimento = () => new Map(stato.piano.righe.filter(r => !r.eredita && !r.mediaDi).map(r => [r.riferimento, r]));
  // La serie da mostrare: tutta la storia dell'indice (valori nel programma, scaricati e inseriti), scelta nella sezione
  // delle proiezioni (previsioni.js); se quella sezione non c'è, i soli valori inseriti.
  const serieCompleta = () => (M.serieGrafico ? M.serieGrafico() : { nome: M.indice(), valori: stato.dati.euribor, delContratto: true });

  function intervallo(tutti) {
    if (!tutti.length) return { da: '', a: '' };
    const primo = tutti[0].giorno, ultimo = tutti[tutti.length - 1].giorno;
    if (filtro.periodo === 'personalizzato') return { da: filtro.da || primo, a: filtro.a || ultimo };
    const mesi = PERIODI.find(p => p[0] === filtro.periodo)[2];
    if (mesi === null) return { da: window.TassiInternet ? TassiInternet.inizioScarico(stato.dati.parametri.data_prima_rata) : primo, a: ultimo };
    return { da: mesi ? mesiPrima(ultimo, mesi) : primo, a: ultimo };
  }

  function disegna() {
    serieMostrata = serieCompleta();
    const tutti = inPunti([...serieMostrata.valori].sort((a, b) => a.giorno.localeCompare(b.giorno)));
    const { da, a } = intervallo(tutti);
    scelti = tutti.filter(p => p.giorno >= da && p.giorno <= a);
    disegnaFiltri(da, a, tutti.length);
    disegnaStatistiche(tutti);
    disegnaPerAnno();
    disegnaTabella(da, a);
    disegnaModuli();
    disegnaDisponibili();
    disegnaInternet();
    $('#titolo-grafico').textContent = serieMostrata.nome;
    if (!$('#scheda-tassi').hidden) disegnaGrafico();
  }
  M.ridisegnaTassi = disegna;

  // ---------- Filtro ----------
  $('#periodi-tassi').replaceChildren(...PERIODI.map(([codice, etichetta]) =>
    crea('button', { type: 'button', 'data-periodo': codice }, etichetta)));
  function disegnaFiltri(da, a, totale) {
    for (const pulsante of $('#periodi-tassi').children) pulsante.setAttribute('aria-pressed', pulsante.dataset.periodo === filtro.periodo);
    $('#filtro-da').value = da;
    $('#filtro-a').value = a;
    $('#conteggio-tassi').textContent = (scelti.length === totale ? `${totale} rilevazioni` : `${scelti.length} rilevazioni su ${totale}`) + (serieMostrata.delContratto ? ` (${stato.dati.euribor.length} inserite)` : '');
  }
  $('#periodi-tassi').addEventListener('click', evento => {
    const pulsante = evento.target.closest('button[data-periodo]');
    if (!pulsante) return;
    filtro.periodo = pulsante.dataset.periodo;
    disegna();
  });
  for (const campo of ['da', 'a']) {
    $('#filtro-' + campo).addEventListener('change', evento => {
      const attuale = intervallo(inPunti([...serieMostrata.valori].sort((a, b) => a.giorno.localeCompare(b.giorno))));
      Object.assign(filtro, { periodo: 'personalizzato', da: attuale.da, a: attuale.a, [campo]: evento.target.value });
      disegna();
    });
  }

  // ---------- Statistiche del periodo ----------
  function disegnaStatistiche(tutti) {
    const contenitore = $('#statistiche-tassi');
    const s = Calcolo.statistiche(scelti);
    if (!s) { contenitore.replaceChildren(crea('p', { className: 'nota' }, 'Nessun tasso nel periodo scelto.')); return; }
    // Confronti all'indietro dall'ultimo valore del periodo, cercati in tutto lo storico.
    const rispettoA = mesi => {
      const prima = Calcolo.puntoAl(tutti, Calcolo.isoInGiorno(mesiPrima(s.ultimo.giorno, mesi)));
      return prima ? punti(s.ultimo.y - prima.y) : 'n.d.';
    };
    const mesiDurata = s.durata / 30.4375;
    const voci = [
      ['Ultimo valore', perc(s.ultimo.y, 3), `${giornoSettimana(s.ultimo.giorno)} ${data(s.ultimo.giorno)}`],
      ['Variazione nel periodo', punti(s.variazione), `dal ${perc(s.primo.y, 3)} del ${data(s.primo.giorno)}`],
      ['Variazione a 1 mese', rispettoA(1), `3 mesi ${rispettoA(3)} · 12 mesi ${rispettoA(12)}`],
      ['Minimo', perc(s.minimo.y, 3), `${data(s.minimo.giorno)} · ultimo a ${punti(s.ultimo.y - s.minimo.y)}`],
      ['Massimo', perc(s.massimo.y, 3), `${data(s.massimo.giorno)} · ultimo a ${punti(s.ultimo.y - s.massimo.y)}`],
      ['Escursione', punti(s.massimo.y - s.minimo.y).replace(/^[+−]/, ''), 'fra minimo e massimo del periodo'],
      ['Media del periodo', perc(s.media, 3), `pesata sui giorni · ultimo a ${punti(s.ultimo.y - s.media)}`],
      ['Mediana', perc(s.mediana, 3), 'metà dei giorni del periodo sta sotto'],
      ['Variazione media al mese', mesiDurata >= 1 ? punti(s.variazione / mesiDurata) : 'n.d.', `su ${mesiDurata.toLocaleString('it-IT', { maximumFractionDigits: 1 })} mesi`],
      ['Tendenza', punti(s.pendenza * 365.25, 2) + ' l\'anno', 'pendenza della retta di tendenza'],
    ];
    contenitore.replaceChildren(...voci.map(([etichetta, valore, dettaglio]) =>
      crea('div', { className: 'dato' }, crea('span', { className: 'etichetta' }, etichetta),
        crea('span', { className: 'valore' }, valore), crea('span', { className: 'dettaglio', title: dettaglio }, dettaglio))));
  }

  // ---------- Riepilogo per anno ----------
  function disegnaPerAnno() {
    const perAnno = new Map();
    for (const p of scelti) {
      const anno = p.giorno.slice(0, 4);
      if (!perAnno.has(anno)) perAnno.set(anno, []);
      perAnno.get(anno).push(p);
    }
    const righe = [...perAnno].reverse().map(([anno, serie]) => {
      const s = Calcolo.statistiche(serie);
      return crea('tr', {}, crea('td', {}, anno), crea('td', {}, String(s.n)), crea('td', {}, perc(s.primo.y, 3)), crea('td', {}, perc(s.ultimo.y, 3)),
        crea('td', {}, punti(s.variazione)), crea('td', { title: data(s.minimo.giorno) }, perc(s.minimo.y, 3)),
        crea('td', { title: data(s.massimo.giorno) }, perc(s.massimo.y, 3)), crea('td', {}, perc(s.media, 3)));
    });
    $('#tabella-anni tbody').replaceChildren(...righe);
  }

  // ---------- Tabella dei tassi ----------
  // Solo i valori inseriti nel mutuo (quelli che il calcolo usa e che si possono modificare), nel periodo scelto.
  function disegnaTabella(da, a) {
    const usi = usiDeiTassi();
    const propri = inPunti(stato.dati.euribor).filter(p => p.giorno >= da && p.giorno <= a);
    const righe = [];
    for (let i = propri.length - 1; i >= 0; i--) {
      const t = stato.dati.euribor.find(v => v.giorno === propri[i].giorno), uso = usi.get(t.giorno), prima = propri[i - 1];
      righe.push(crea('tr', { 'data-giorno': t.giorno },
        crea('td', {}, data(t.giorno)),
        crea('td', { className: 'testo' }, giornoSettimana(t.giorno)),
        crea('td', { className: 'modificabile', 'data-campo': 'tasso_360' }, perc(t.tasso_360, 3)),
        crea('td', { className: 'minore' }, prima ? punti(t.tasso_360 - prima.y) : ''),
        crea('td', { className: 'testo' }, uso ? `rata di ${meseAnno(uso.inizio)}` : ''),
        crea('td', { className: 'azione' }, crea('button', { type: 'button', className: 'secondario piccolo', 'data-elimina': '', 'aria-label': `Elimina il tasso del ${data(t.giorno)}` }, 'Elimina'))));
    }
    $('#tabella-tassi tbody').replaceChildren(...righe);
  }
  $('#tabella-tassi tbody').addEventListener('click', evento => {
    const riga = evento.target.closest('tr');
    if (!riga) return;
    const giorno = riga.dataset.giorno;
    const tasso = stato.dati.euribor.find(t => t.giorno === giorno);
    if (evento.target.closest('[data-elimina]')) {
      if (confirm(`Eliminare il tasso del ${data(giorno)}?`)) esegui('DELETE', `euribor/${giorno}`, null, `Tasso del ${data(giorno)} eliminato`);
      return;
    }
    const td = evento.target.closest('td[data-campo]');
    if (!td) return;
    const campo = td.dataset.campo;
    modificaCella(td, {
      valore: tasso[campo], tipo: 'percento', etichetta: `Valore del ${data(giorno)}`,
      salva: v => {
        if (v == null) { avvisa('Il valore non può essere vuoto: per toglierlo usa Elimina', true); return false; }
        return esegui('PUT', `euribor/${giorno}`, { tasso_360: v });
      },
      ripristina: disegnaTabella,
    });
  });

  // ---------- Grafico ----------
  // Linea dell'indice nel periodo scelto (tutta la serie, non solo i valori inseriti), retta di tendenza, minimo e
  // massimo, le rilevazioni usate dalle rate e, a destra dell'ultimo valore, la proiezione scelta nella sezione sotto
  // (previsioni.js): valore atteso tratteggiato, fasce 80% e 95%, e lo scenario usato dal piano se non è quello atteso.
  function disegnaGrafico() {
    const contenitore = $('#grafico');
    if (scelti.length < 2) { contenitore.replaceChildren(crea('p', { className: 'nota' }, 'Servono almeno due tassi nel periodo per disegnare il grafico.')); return; }
    const NS = 'http://www.w3.org/2000/svg';
    const svg = (tag, attributi = {}, testo) => {
      const el = document.createElementNS(NS, tag);
      for (const [k, v] of Object.entries(attributi)) el.setAttribute(k, v);
      if (testo != null) el.textContent = testo;
      return el;
    };
    const serie = scelti, s = Calcolo.statistiche(serie), usi = serieMostrata.delContratto ? usiDeiTassi() : new Map();
    const pro = M.proiezionePerGrafico ? M.proiezionePerGrafico() : null;
    const futuro = pro ? pro.risultato.proiezione.map(p => ({ x: Calcolo.isoInGiorno(p.giorno), ...p })) : [];
    const partenza = pro ? { x: Calcolo.isoInGiorno(pro.risultato.partenza.giorno), y: pro.risultato.partenza.valore } : null;
    const larghezza = Math.max(contenitore.clientWidth, 300), stretto = larghezza < 600, altezza = stretto ? 260 : 360;
    const margine = { sopra: 22, destra: stretto ? 54 : 70, sotto: 28, sinistra: stretto ? 42 : 48 };
    const x0 = s.primo.x, xStorico = s.ultimo.x, x1 = futuro.length ? Math.max(xStorico, futuro[futuro.length - 1].x) : xStorico;

    // Scala verticale con valori tondi
    const estremi = [s.minimo.y, s.massimo.y, s.tendenza(x0), s.tendenza(xStorico), ...futuro.flatMap(p => [p.basso95, p.alto95])];
    const minimo = Math.min(...estremi), massimo = Math.max(...estremi);
    const passo = [0.0005, 0.001, 0.0025, 0.005, 0.01, 0.02, 0.05, 0.1].find(p => (massimo - minimo) / p <= 6) || 0.2;
    // Un po' di margine sopra e sotto, così le etichette di minimo e massimo non toccano gli assi.
    const y0 = Math.floor((minimo - 0.4 * passo) / passo + 1e-9) * passo;
    const y1 = Math.max(Math.ceil((massimo + 0.3 * passo) / passo - 1e-9) * passo, y0 + passo);
    const decimali = passo < 0.001 ? 2 : passo < 0.01 ? (passo === 0.0025 ? 2 : 1) : 0;
    const sx = x => margine.sinistra + (x - x0) / (x1 - x0) * (larghezza - margine.sinistra - margine.destra);
    const sy = y => margine.sopra + (y1 - y) / (y1 - y0) * (altezza - margine.sopra - margine.sotto);

    const descrizioneProiezione = pro ? ` Proiezione ${pro.nome} fino a ${data(futuro[futuro.length - 1].giorno)}: valore atteso ${perc(futuro[futuro.length - 1].valore, 2)}.` : '';
    const radice = svg('svg', { viewBox: `0 0 ${larghezza} ${altezza}`, height: altezza, tabindex: 0, role: 'img',
      'aria-label': `${serieMostrata.nome} dal ${data(s.primo.giorno)} al ${data(s.ultimo.giorno)}: minimo ${perc(s.minimo.y, 3)}, massimo ${perc(s.massimo.y, 3)}, ultimo ${perc(s.ultimo.y, 3)}.${descrizioneProiezione} Frecce sinistra e destra per leggere i valori.` });
    for (let y = y0; y <= y1 + passo / 2; y += passo) {
      radice.append(svg('line', { class: 'griglia', x1: margine.sinistra, x2: larghezza - margine.destra, y1: sy(y), y2: sy(y) }),
        svg('text', { x: margine.sinistra - 8, y: sy(y) + 4, 'text-anchor': 'end' }, perc(y, decimali)));
    }
    // Asse del tempo: una tacca ogni N mesi, in modo che le etichette non si tocchino
    const pixelPerMese = (larghezza - margine.sinistra - margine.destra) / Math.max((x1 - x0) / 30.44, 0.5);
    const ogniMesi = [1, 3, 6, 12, 24, 60, 120].find(n => n * pixelPerMese >= 64) || 240;
    for (let anno = new Date(x0 * 86400000).getUTCFullYear(), mese = 0; ; mese += ogniMesi) {
      const x = Date.UTC(anno, mese, 1) / 86400000;
      if (x > x1) break;
      if (x < x0) continue;
      const d = new Date(x * 86400000);
      const etichetta = d.getUTCMonth() === 0 ? String(d.getUTCFullYear()) : `${MESI[d.getUTCMonth()].slice(0, 3)} ${String(d.getUTCFullYear()).slice(2)}`;
      radice.append(svg('line', { class: 'asse', x1: sx(x), x2: sx(x), y1: altezza - margine.sotto, y2: altezza - margine.sotto + 5 }),
        svg('text', { x: sx(x), y: altezza - 6, 'text-anchor': 'middle' }, etichetta));
    }
    radice.append(svg('line', { class: 'asse', x1: margine.sinistra, x2: larghezza - margine.destra, y1: altezza - margine.sotto, y2: altezza - margine.sotto }));
    // Proiezione: fasce (dal punto di partenza), separatore, linea tratteggiata, scenario usato dal piano.
    if (futuro.length) {
      const inizio = { x: partenza.x, basso80: partenza.y, alto80: partenza.y, basso95: partenza.y, alto95: partenza.y, valore: partenza.y };
      const banda = (basso, alto, classe) => svg('path', { class: classe, d: [inizio, ...futuro].map((p, i) => `${i ? 'L' : 'M'}${sx(p.x).toFixed(1)} ${sy(p[alto]).toFixed(1)}`).join('') + [...futuro].reverse().concat(inizio).map(p => `L${sx(p.x).toFixed(1)} ${sy(p[basso]).toFixed(1)}`).join('') + 'Z' });
      radice.append(banda('basso95', 'alto95', 'banda95'), banda('basso80', 'alto80', 'banda80'));
      radice.append(svg('line', { class: 'separatore', x1: sx(partenza.x), x2: sx(partenza.x), y1: margine.sopra, y2: altezza - margine.sotto }));
    }
    radice.append(svg('line', { class: 'media', x1: margine.sinistra, x2: sx(xStorico), y1: sy(s.media), y2: sy(s.media) }));
    radice.append(svg('line', { class: 'tendenza', x1: sx(x0), y1: sy(s.tendenza(x0)), x2: sx(xStorico), y2: sy(s.tendenza(xStorico)) }));
    radice.append(svg('path', { class: 'linea', d: serie.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x).toFixed(1)} ${sy(p.y).toFixed(1)}`).join('') }));
    if (futuro.length) {
      const inizio = { x: partenza.x, valore: partenza.y, [pro.campo]: partenza.y };
      radice.append(svg('path', { class: 'proiezione', d: [inizio, ...futuro].map((p, i) => `${i ? 'L' : 'M'}${sx(p.x).toFixed(1)} ${sy(p.valore).toFixed(1)}`).join('') }));
      if (pro.campo !== 'valore') radice.append(svg('path', { class: 'scenario', d: [inizio, ...futuro].map((p, i) => `${i ? 'L' : 'M'}${sx(p.x).toFixed(1)} ${sy(p[pro.campo]).toFixed(1)}`).join('') }));
      const fine = futuro[futuro.length - 1];
      radice.append(svg('text', { class: 'finale proiezione-testo', x: sx(fine.x) + 8, y: sy(fine[pro.campo]) + 4 }, perc(fine[pro.campo], 2)));
    }
    // Rilevazioni usate per calcolare una rata
    for (const p of serie) if (usi.has(p.giorno)) radice.append(svg('circle', { class: 'usato', cx: sx(p.x), cy: sy(p.y), r: 3.5 }));
    // Minimo e massimo del periodo (se non coincidono con l'ultimo punto, che ha già la sua etichetta)
    const etichettaEstremo = (p, testo, sopra) => {
      if (p === s.ultimo) return;
      const x = Math.max(margine.sinistra + 34, Math.min(sx(p.x), larghezza - margine.destra - 34));
      radice.append(svg('circle', { class: 'punto', cx: sx(p.x), cy: sy(p.y), r: 3.5 }),
        svg('text', { class: 'estremo', x, y: sy(p.y) + (sopra ? -9 : 17), 'text-anchor': 'middle' }, `${testo} ${perc(p.y, 3)}`));
    };
    etichettaEstremo(s.massimo, 'max', true);
    etichettaEstremo(s.minimo, 'min', false);
    radice.append(svg('circle', { class: 'punto', cx: sx(s.ultimo.x), cy: sy(s.ultimo.y), r: 4 }),
      svg('text', { class: 'finale', x: sx(s.ultimo.x) + (futuro.length ? -9 : 9), y: sy(s.ultimo.y) + (futuro.length ? -8 : 4), 'text-anchor': futuro.length ? 'end' : 'start' }, perc(s.ultimo.y, 3)));

    // Lettura dei valori: mirino verticale che si aggancia alla data più vicina (storico o proiezione)
    const mirino = svg('line', { class: 'mirino', y1: margine.sopra, y2: altezza - margine.sotto, visibility: 'hidden' });
    const segnale = svg('circle', { class: 'punto', r: 4, visibility: 'hidden' });
    const fumetto = crea('div', { className: 'fumetto', hidden: true });
    radice.append(mirino, segnale);
    const tutti = [...serie.map(p => ({ x: p.x, y: p.y, storico: p })), ...futuro.map(f => ({ x: f.x, y: f[pro.campo], futuro: f }))];
    let indice = serie.length - 1;
    const mostra = i => {
      indice = Math.max(0, Math.min(tutti.length - 1, i));
      const t = tutti[indice], px = sx(t.x), py = sy(t.y);
      mirino.setAttribute('x1', px); mirino.setAttribute('x2', px); mirino.setAttribute('visibility', 'visible');
      segnale.setAttribute('cx', px); segnale.setAttribute('cy', py); segnale.setAttribute('visibility', 'visible');
      if (t.storico) {
        const p = t.storico, prima = tutti[indice - 1] && tutti[indice - 1].storico, uso = usi.get(p.giorno);
        fumetto.replaceChildren(crea('strong', {}, perc(p.y, 3)), crea('span', {}, `${giornoSettimana(p.giorno)} ${data(p.giorno)}`),
          ...(prima ? [crea('span', {}, `${punti(p.y - prima.y)} dal ${data(prima.giorno)}`)] : []),
          crea('span', {}, `media ${perc(s.media, 3)} · tendenza ${perc(s.tendenza(p.x), 3)}`),
          ...(uso ? [crea('span', { className: 'in-evidenza' }, `usato per la rata di ${meseAnno(uso.inizio)}`)] : []));
      } else {
        const f = t.futuro;
        fumetto.replaceChildren(crea('strong', {}, perc(f[pro.campo], 2)), crea('span', {}, `${MESI[+f.mese.slice(5, 7) - 1]} ${f.mese.slice(0, 4)} · proiezione ${pro.nome}`),
          ...(pro.campo !== 'valore' ? [crea('span', {}, `valore atteso ${perc(f.valore, 2)}`)] : []),
          crea('span', {}, `80%: ${perc(f.basso80, 2)} – ${perc(f.alto80, 2)}`), crea('span', {}, `95%: ${perc(f.basso95, 2)} – ${perc(f.alto95, 2)}`));
      }
      fumetto.hidden = false;
      const aDestra = px + 14 + fumetto.offsetWidth <= larghezza;
      fumetto.style.left = (aDestra ? px + 14 : px - 14 - fumetto.offsetWidth) + 'px';
      fumetto.style.top = Math.max(0, Math.min(py - fumetto.offsetHeight / 2, altezza - fumetto.offsetHeight)) + 'px';
    };
    const nascondi = () => { mirino.setAttribute('visibility', 'hidden'); segnale.setAttribute('visibility', 'hidden'); fumetto.hidden = true; };
    radice.addEventListener('pointermove', evento => {
      const riquadro = radice.getBoundingClientRect();
      const x = x0 + (evento.clientX - riquadro.left - margine.sinistra) / (larghezza - margine.sinistra - margine.destra) * (x1 - x0);
      let basso = 0, alto = tutti.length - 1;
      while (alto - basso > 1) { const medio = (basso + alto) >> 1; if (tutti[medio].x < x) basso = medio; else alto = medio; }
      mostra(x - tutti[basso].x <= tutti[alto].x - x ? basso : alto);
    });
    radice.addEventListener('pointerleave', nascondi);
    radice.addEventListener('focus', () => mostra(indice));
    radice.addEventListener('blur', nascondi);
    radice.addEventListener('keydown', evento => {
      if (evento.key === 'ArrowLeft') mostra(indice - 1);
      else if (evento.key === 'ArrowRight') mostra(indice + 1);
      else return;
      evento.preventDefault();
    });
    contenitore.replaceChildren(radice, fumetto);
  }

  // ---------- Inserimento di un tasso (il modulo c'è in questa pagina e nel pannello di controllo) ----------
  const moduli = [...document.querySelectorAll('.form-tasso')];
  function avvisoEsistente(modulo) {
    const esistente = stato.dati.euribor.find(t => t.giorno === modulo.giorno.value);
    const nota = $('.tasso-esistente', modulo);
    nota.hidden = !esistente;
    if (esistente) nota.textContent = `Per questa data c'è già il tasso ${perc(esistente.tasso_360, 3)}: salvando verrà sostituito.`;
  }
  function disegnaModuli() {
    const righe = stato.piano.righe;
    const mancanti = righe.filter(M.tassoMancante);
    const prossima = righe.find(r => r.riferimento > stato.oggi);
    for (const modulo of moduli) {
      const blocco = $('.tassi-mancanti', modulo), pannello = modulo.closest('details');
      if (pannello && mancanti.length && !pannello.dataset.aperto) { pannello.open = true; pannello.dataset.aperto = '1'; }
      blocco.replaceChildren();
      if (mancanti.length) {
        blocco.append(crea('p', { className: 'nota' }, 'Date di rilevazione già passate senza un valore inserito (clic per compilare la data):'),
          crea('ul', { className: 'elenco-date' }, ...mancanti.slice(-12).map(r => crea('li', {},
            crea('button', { type: 'button', className: 'secondario piccolo', 'data-giorno': r.riferimento }, `${data(r.riferimento)} · rata di ${meseAnno(r.inizio)}`)))));
      }
      if (prossima) blocco.append(crea('p', { className: 'nota' }, `Prossima data di rilevazione: ${data(prossima.riferimento)} (rata di ${meseAnno(prossima.inizio)}).`));
      avvisoEsistente(modulo);
    }
  }
  // Compila la data nel modulo della pagina dei tassi (usato anche dal calendario).
  M.preparaTasso = giorno => {
    const modulo = $('#scheda-tassi .form-tasso');
    M.mostraScheda('tassi');
    if (modulo.closest('details')) modulo.closest('details').open = true;
    modulo.giorno.value = giorno;
    avvisoEsistente(modulo);
    modulo.scrollIntoView({ block: 'center' });
    modulo.tasso.focus();
  };
  for (const modulo of moduli) {
    modulo.giorno.addEventListener('change', () => avvisoEsistente(modulo));
    $('.tassi-mancanti', modulo).addEventListener('click', evento => {
      const pulsante = evento.target.closest('button[data-giorno]');
      if (!pulsante) return;
      modulo.giorno.value = pulsante.dataset.giorno;
      avvisoEsistente(modulo);
      modulo.tasso.focus();
    });
    modulo.addEventListener('submit', async evento => {
      evento.preventDefault();
      const giorno = modulo.giorno.value;
      const tasso = leggiNumero(modulo.tasso.value);
      if (tasso == null || Number.isNaN(tasso)) return avvisa('Valore non valido', true);
      if (!await esegui('PUT', `euribor/${giorno}`, { tasso_360: daPercento(tasso) })) return;
      const rata = ratePerRiferimento().get(giorno);
      avvisa(`Tasso del ${data(giorno)} salvato: ` + (rata ? `usato per la rata di ${meseAnno(rata.inizio)}.` : 'nessuna rata ha questa data di rilevazione.'));
      modulo.reset();
      avvisoEsistente(modulo);
    });
  }

  // ---------- Valori dell'indice già presenti nel programma ----------
  // Se per l'indice del contratto il programma ha già dei valori che non sono fra quelli inseriti, propone di aggiungerli.
  const disponibili = () => { const presenti = new Set(stato.dati.euribor.map(v => v.giorno)); return Archivio.precaricati(M.indice(), window.TassiInternet.inizioScarico(stato.dati.parametri.data_prima_rata)).filter(v => !presenti.has(v.giorno)); };
  function disegnaDisponibili() {
    const blocco = $('#tassi-disponibili'), mancanti = disponibili();
    if (!mancanti.length) { blocco.replaceChildren(); return; }
    blocco.replaceChildren(crea('p', { className: 'nota' }, `Per ${M.indice()} il programma ha già ${mancanti.length === 1 ? 'un valore' : mancanti.length + ' valori'} che qui manca${mancanti.length === 1 ? `: quello del ${data(mancanti[0].giorno)}` : `no, dal ${data(mancanti[0].giorno)} al ${data(mancanti[mancanti.length - 1].giorno)}`}.`),
      crea('div', { className: 'azioni' }, crea('button', { type: 'button', className: 'secondario', id: 'aggiungi-disponibili' }, mancanti.length === 1 ? 'Aggiungilo' : 'Aggiungili')));
  }
  $('#tassi-disponibili').addEventListener('click', evento => {
    if (evento.target.id !== 'aggiungi-disponibili') return;
    const righe = disponibili();
    esegui('POST', 'euribor', { righe }, righe.length === 1 ? '1 valore aggiunto' : `${righe.length} valori aggiunti`);
  });

  // ---------- Valori scaricati da internet (tassi-internet.js) ----------
  // Per gli Euribor i valori si scaricano dal sito della Bundesbank: si aggiungono i giorni che mancano, dall'inizio
  // del mutuo a oggi, senza toccare quelli già inseriti; se qualcuno già inserito è diverso lo si dice e si può sostituire.
  const Internet = window.TassiInternet;
  const moduloInternet = $('#form-internet');
  let esitoInternet = null;     // l'ultimo scarico, da mostrare anche dopo un ridisegno della pagina
  $('#spiegazione-internet').textContent = Internet.spiegazione + ' Vengono aggiunti i giorni che mancano, dall\'inizio del mutuo a oggi; i valori che hai già inserito non vengono toccati.';
  moduloInternet.serie.replaceChildren(crea('option', { value: '' }, 'Scegli…'), ...Internet.SERIE.map(s => crea('option', { value: s.codice }, s.nome)));
  function disegnaInternet() {
    const serie = Internet.riconosci(M.indice());
    if (serie) moduloInternet.serie.value = serie.codice;
    const avviso = $('#avviso-internet');
    avviso.hidden = !!serie;
    if (!serie) avviso.textContent = `Il tuo indice si chiama «${M.indice()}» e non lo riconosco come uno degli Euribor pubblicati. Se lo è, scegli qui sotto quale (e, se vuoi, correggi il nome nella configurazione); se non lo è, i valori vanno scritti o incollati qui sotto.`;
    disegnaEsitoInternet();
  }
  function disegnaEsitoInternet() {
    const blocco = $('#esito-internet'), e = esitoInternet;
    if (!e) { blocco.replaceChildren(); return; }
    const quanti = (n, cosa) => n === 1 ? `un valore ${cosa}` : `${n} valori ${cosa}`;
    const righe = [];
    if (e.automatico) righe.push(crea('p', { className: 'nota' }, crea('b', {}, 'Aggiornamento automatico all\'apertura della pagina.')));
    if (e.errore) { righe.push(crea('p', { className: 'nota evidenza' }, e.errore)); blocco.replaceChildren(...righe); return; }
    if (!e.valori.length) righe.push(crea('p', { className: 'nota evidenza' }, `La ${Internet.FONTE} non ha valori di ${e.serie.nome} per il periodo del tuo mutuo.`));
    else {
      righe.push(crea('p', { className: 'nota' }, `Scaricati ${e.valori.length} valori di ${e.serie.nome}, dal ${data(e.valori[0].giorno)} al ${data(e.valori[e.valori.length - 1].giorno)}`
        + (e.aggiornato ? ` (dati della ${Internet.FONTE} aggiornati al ${data(e.aggiornato)})` : '') + '.'));
      const parti = [];
      if (e.salvati) parti.push(quanti(e.salvati, e.salvati === 1 ? 'aggiunto' : 'aggiunti'));
      if (e.sostituiti) parti.push(quanti(e.sostituiti, e.sostituiti === 1 ? 'sostituito' : 'sostituiti'));
      if (e.uguali) parti.push(quanti(e.uguali, e.uguali === 1 ? 'era già presente, uguale' : 'erano già presenti, uguali'));
      if (parti.length) { const frase = parti.join('; ') + '.'; righe.push(crea('p', { className: 'nota' }, frase[0].toUpperCase() + frase.slice(1))); }
      if (!e.salvati && !e.sostituiti && !e.diversi.length) righe.push(crea('p', { className: 'nota' }, 'Non c\'è niente di nuovo: hai già tutti i valori pubblicati.'));
    }
    if (e.diversi.length) {
      righe.push(crea('p', { className: 'nota evidenza' }, `${quanti(e.diversi.length, e.diversi.length === 1 ? 'era già presente con una cifra diversa' : 'erano già presenti con cifre diverse')} da quella scaricata: ${e.diversi.length === 1 ? 'non l\'ho toccato' : 'non li ho toccati'}. Di solito ha ragione la ${Internet.FONTE}; controlla e, se vuoi, sostituisci.`),
        crea('ul', { className: 'elenco-date' }, ...e.diversi.slice(0, 8).map(d => crea('li', {}, `${data(d.giorno)}: tuo ${perc(d.presente, 3)}, scaricato ${perc(d.tasso_360, 3)}`)),
          ...(e.diversi.length > 8 ? [crea('li', {}, `… e altri ${e.diversi.length - 8}`)] : [])),
        crea('div', { className: 'azioni' }, crea('button', { type: 'button', className: 'secondario', id: 'sostituisci-internet' }, e.diversi.length === 1 ? 'Sostituisci con il valore scaricato' : `Sostituisci i ${e.diversi.length} valori con quelli scaricati`)));
    }
    blocco.replaceChildren(...righe);
  }
  // All'apertura della pagina, se l'indice è un Euribor e manca qualche giorno lavorativo recente, scarica da solo
  // i valori nuovi (si può spegnere con la casella, ricordata nel browser). Se non c'è la connessione non disturba:
  // l'esito resta scritto sotto il pulsante.
  const CHIAVE_AUTO = 'aggiorna-tassi';
  const automatico = () => M.ricordo.leggi(CHIAVE_AUTO) !== 'no';
  moduloInternet.automatico.checked = automatico();
  moduloInternet.automatico.addEventListener('change', () => M.ricordo.scrivi(CHIAVE_AUTO, moduloInternet.automatico.checked ? 'si' : 'no'));
  // L'ultimo giorno feriale (lunedì-venerdì) prima di oggi: se i valori arrivano fin lì non c'è niente da scaricare.
  function ultimoGiornoAtteso() {
    const d = new Date(stato.oggi + 'T00:00:00Z');
    do d.setUTCDate(d.getUTCDate() - 1); while (d.getUTCDay() === 0 || d.getUTCDay() === 6);
    return d.toISOString().slice(0, 10);
  }
  async function aggiornaAutomatico() {
    if (!automatico() || !stato.dati) return;
    const serie = Internet.riconosci(M.indice());
    if (!serie) return;
    const presenti = stato.dati.euribor, ultimo = presenti.length ? presenti[presenti.length - 1].giorno : '';
    if (ultimo >= ultimoGiornoAtteso()) return;
    try {
      const { valori, aggiornato } = await Internet.scarica(serie, Internet.inizioScarico(stato.dati.parametri.data_prima_rata), stato.oggi);
      const confronto = Internet.confronta(valori, stato.dati.euribor);
      esitoInternet = { serie, valori, aggiornato, ...confronto, salvati: 0, sostituiti: 0, automatico: true };
      if (confronto.nuovi.length && await esegui('POST', 'euribor', { righe: confronto.nuovi }, `${confronto.nuovi.length === 1 ? 'Un valore' : confronto.nuovi.length + ' valori'} di ${serie.nome} ${confronto.nuovi.length === 1 ? 'scaricato' : 'scaricati'} da internet (${Internet.FONTE})`)) esitoInternet.salvati = confronto.nuovi.length;
      disegnaEsitoInternet();
    } catch (errore) {
      esitoInternet = { errore: errore.message, automatico: true };
      disegnaEsitoInternet();
    }
  }
  M.dopoAvvio.push(aggiornaAutomatico);

  moduloInternet.addEventListener('submit', async evento => {
    evento.preventDefault();
    const serie = Internet.perCodice(moduloInternet.serie.value);
    if (!serie) return avvisa('Scegli quale Euribor scaricare', true);
    const pulsante = $('#scarica-internet');
    pulsante.disabled = true;
    pulsante.textContent = 'Scarico…';
    try {
      const { valori, aggiornato } = await Internet.scarica(serie, Internet.inizioScarico(stato.dati.parametri.data_prima_rata), stato.oggi);
      const confronto = Internet.confronta(valori, stato.dati.euribor);
      esitoInternet = { serie, valori, aggiornato, ...confronto, salvati: 0, sostituiti: 0 };
      if (confronto.nuovi.length && await esegui('POST', 'euribor', { righe: confronto.nuovi }, confronto.nuovi.length === 1 ? 'Un valore aggiunto' : `${confronto.nuovi.length} valori aggiunti`)) esitoInternet.salvati = confronto.nuovi.length;
      disegnaEsitoInternet();
    } catch (errore) {
      avvisa(errore.message, true);
    } finally {
      pulsante.disabled = false;
      pulsante.textContent = 'Scarica gli ultimi valori';
    }
  });
  $('#esito-internet').addEventListener('click', async evento => {
    if (evento.target.id !== 'sostituisci-internet' || !esitoInternet) return;
    const righe = esitoInternet.diversi.map(({ giorno, tasso_360 }) => ({ giorno, tasso_360 }));
    const e = esitoInternet;
    if (!await esegui('POST', 'euribor', { righe }, righe.length === 1 ? 'Un valore sostituito' : `${righe.length} valori sostituiti`)) return;
    e.sostituiti += righe.length;
    e.diversi = [];
    disegnaEsitoInternet();
  });

  // ---------- Agganci ----------
  M.viste.push(disegna);
  M.allApertura.tassi = disegnaGrafico;
  let timer;
  window.addEventListener('resize', () => {
    clearTimeout(timer);
    timer = setTimeout(() => { if (stato.dati && !$('#scheda-tassi').hidden) disegnaGrafico(); }, 150);
  });
})();
