// Scheda «Previsioni»: la serie storica dell'indice dal 1999 e le proiezioni con i modelli di modelli.js
// (media delle variazioni, ARIMA, VAR, GARCH, Vasicek). Da qui si sceglie anche quale proiezione usa il piano
// per stimare l'indice delle rate future (M.perPiano, letto da app.js a ogni ricalcolo).
(function () {
  'use strict';
  const M = window.Mutuo;
  const { stato, $, crea, esegui, avvisa, data, perc, MESI } = M;
  const Mod = window.Modelli, Internet = window.TassiInternet;
  const modulo = $('#form-previsioni');
  const scaricate = new Map();   // codice → valori giornalieri scaricati in questa sessione (serie senza precaricati)
  let ultimo = null;             // l'ultima proiezione calcolata, per il grafico e il pulsante "usa"

  const ORIZZONTI = [['12', '1 anno'], ['24', '2 anni'], ['60', '5 anni'], ['120', '10 anni'], ['fine', 'fino alla fine del mutuo']];
  const punti = (v, decimali = 2) => (v > 0 ? '+' : v < 0 ? '−' : '') + (Math.abs(v) * 100).toLocaleString('it-IT', { minimumFractionDigits: decimali, maximumFractionDigits: decimali }) + ' punti';
  const numero = (v, decimali = 2) => v.toLocaleString('it-IT', { minimumFractionDigits: decimali, maximumFractionDigits: decimali });
  const ampiezza = (v, decimali = 3) => numero(Math.abs(v) * 100, decimali) + ' punti';   // una variabilità, senza segno
  const inGiorni = iso => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / 86400000;

  // ---------- Serie disponibili ----------
  // Valori giornalieri di un Euribor: precaricati + scaricati in sessione + (se è l'indice del contratto) quelli inseriti.
  function valoriSerie(codice, dati) {
    const serie = Internet.perCodice(codice);
    const perGiorno = new Map(Archivio.precaricati(serie.nome).map(t => [t.giorno, t.tasso_360]));
    for (const t of scaricate.get(codice) || []) perGiorno.set(t.giorno, t.tasso_360);
    const propria = Internet.riconosci(dati.parametri.indice_nome);
    if (propria && propria.codice === codice) for (const t of dati.euribor) perGiorno.set(t.giorno, t.tasso_360);
    return [...perGiorno].map(([giorno, tasso_360]) => ({ giorno, tasso_360 }));
  }
  const valoriContratto = dati => dati.euribor.map(t => ({ giorno: t.giorno, tasso_360: t.tasso_360 }));
  const valoriScelti = (codice, dati) => (codice === 'contratto' ? valoriContratto(dati) : valoriSerie(codice, dati));
  const nomeSerie = codice => (codice === 'contratto' ? `${M.indice()} (valori inseriti)` : Internet.perCodice(codice).nome);
  // Mesi dall'ultimo mese noto alla fine del mutuo (più uno di margine).
  function mesiFinoAllaFine(dati, ultimoMese) {
    const p = dati.parametri, [a, m] = p.data_prima_rata.split('-').map(Number), [ua, um] = ultimoMese.split('-').map(Number);
    return Math.max(1, (a * 12 + m - 1 + p.numero_rate) - (ua * 12 + um - 1) + 1);
  }
  // Scarica da internet tutto lo storico di una serie che non è nel programma (una volta per sessione).
  async function assicuraSerie(codice) {
    if (codice === 'contratto' || Mod.mensile(valoriSerie(codice, stato.dati)).length >= 36) return;
    const serie = Internet.perCodice(codice);
    avvisa(`Scarico lo storico di ${serie.nome} dalla ${Internet.FONTE}…`);
    const { valori } = await Internet.scarica(serie, '1999-01-01', stato.oggi);
    scaricate.set(codice, valori);
  }

  // ---------- Calcolo ----------
  // Prepara serie e opzioni e lancia il modello. "dati" sono i dati del mutuo (stato.dati o quelli passati dal piano).
  function calcola(modello, codice, opzioni, dati) {
    const serie = Mod.mensile(valoriScelti(codice, dati));
    if (!serie.length) throw new Error('Non ci sono valori per questa serie.');
    const o = { ...opzioni };
    if (modello === 'var') {
      if (codice === 'contratto') throw new Error('Il VAR mette insieme i cinque Euribor: scegli una delle serie Euribor.');
      o.altre = Internet.SERIE.map(s => Mod.mensile(valoriSerie(s.codice, dati)));
      o.indice = Internet.SERIE.findIndex(s => s.codice === codice);
      const vuote = Internet.SERIE.filter((s, i) => o.altre[i].length < 36).map(s => s.nome);
      if (vuote.length) throw new Error(`Per il VAR servono anche: ${vuote.join(', ')}. Scegli una di queste serie e premi «Calcola»: lo storico viene scaricato.`);
    }
    if (o.h === 'fine') o.h = mesiFinoAllaFine(dati, serie[serie.length - 1].mese);
    return { risultato: Mod.stima(modello, serie, o), serie };
  }

  // Per il piano (app.js): funzione giorno → indice stimato secondo il modello salvato nei parametri, oppure null
  // (media delle variazioni, il metodo del piano). Il risultato resta in memoria finché i dati non cambiano.
  const cachePiano = { chiave: null, funzione: null };
  M.perPiano = function perPiano(dati) {
    const modello = dati.parametri.previsione_modello || 'media';
    if (modello === 'media' || !Mod.MODELLI[modello]) return null;
    let opzioni = {};
    try { opzioni = JSON.parse(dati.parametri.previsione_opzioni || '{}'); } catch { opzioni = {}; }
    const propria = Internet.riconosci(dati.parametri.indice_nome), codice = propria ? propria.codice : 'contratto';
    const serie = Mod.mensile(valoriScelti(codice, dati));
    if (!serie.length) return null;
    const u = serie[serie.length - 1];
    const chiave = JSON.stringify([modello, opzioni, codice, serie.length, u.giorno, u.y, dati.parametri.numero_rate, dati.parametri.data_prima_rata]);
    if (cachePiano.chiave === chiave) return cachePiano.funzione;
    let funzione = null;
    try { funzione = Mod.perGiorno(calcola(modello, codice, { ...opzioni, h: 'fine' }, dati).risultato); }
    catch { funzione = null; }   // dati insufficienti: il piano torna alla media delle variazioni
    Object.assign(cachePiano, { chiave, funzione });
    return funzione;
  };
  M.nomeModelloPiano = dati => {
    const modello = dati.parametri.previsione_modello || 'media';
    return modello !== 'media' && Mod.MODELLI[modello] ? Mod.MODELLI[modello].breve : null;
  };

  // ---------- Modulo ----------
  const DESCRIZIONI = {
    media: 'Il metodo semplice: ogni mese l\'indice cambia della variazione media vista nel passato, e l\'incertezza cresce con il passare del tempo. È quello che il piano usa all\'inizio.',
    arima: 'ARIMA guarda come la serie dipende dai suoi valori passati (parte «AR») e dagli errori passati (parte «MA»), eventualmente sulle variazioni mensili invece che sui livelli («d = 1»). Con «scegli da solo» prova diverse combinazioni e tiene quella che spiega meglio i dati senza troppi parametri.',
    var: 'Il VAR mette insieme i cinque Euribor: ognuno viene spiegato dai valori passati di tutti. Serve lo storico di tutte le serie (è nel programma, o si scarica). La proiezione mostrata è quella della serie scelta.',
    garch: 'GARCH non cerca la direzione ma la variabilità: dice se siamo in un periodo agitato o calmo e quanto a lungo l\'agitazione tende a durare. La linea centrale è quasi piatta; sono le fasce a cambiare.',
    vasicek: 'Vasicek è il modello classico dei tassi: il tasso tende a tornare verso un livello di lungo periodo, con una certa velocità e una certa variabilità. La proiezione parte dal valore di oggi e si avvicina a quel livello.',
  };
  function disegnaSerie() {
    const propria = Internet.riconosci(M.indice());
    const voci = Internet.SERIE.map(s => { const n = Mod.mensile(valoriSerie(s.codice, stato.dati)).length; return crea('option', { value: s.codice }, `${s.nome}${n ? ` (${n} mesi)` : ' (da scaricare)'}`); });
    if (!propria) voci.unshift(crea('option', { value: 'contratto' }, `${M.indice()} (${Mod.mensile(valoriContratto(stato.dati)).length} mesi inseriti)`));
    const attuale = modulo.serie.value;
    modulo.serie.replaceChildren(...voci);
    modulo.serie.value = attuale && [...modulo.serie.options].some(o => o.value === attuale) ? attuale : propria ? propria.codice : 'contratto';
  }
  function disegnaParametri() {
    const modello = modulo.modello.value, blocco = $('#parametri-previsione');
    const scelta = (nome, etichetta, valori, iniziale) => crea('label', {}, etichetta, crea('select', { name: nome }, ...valori.map(v => crea('option', { value: String(v), selected: String(v) === String(iniziale) }, String(v)))));
    if (modello === 'arima') blocco.replaceChildren(
      crea('label', { className: 'spunta' }, crea('input', { type: 'checkbox', name: 'auto', checked: true }), crea('span', {}, 'Scegli da solo p e q (criterio AIC)')),
      scelta('p', 'p (termini AR)', [0, 1, 2, 3], 1), scelta('d', 'd (differenze)', [0, 1], 1), scelta('q', 'q (termini MA)', [0, 1, 2], 0));
    else if (modello === 'var') blocco.replaceChildren(scelta('p', 'p (mesi di ritardo)', [1, 2, 3], 1));
    else blocco.replaceChildren();
    $('#descrizione-modello').textContent = DESCRIZIONI[modello];
  }
  function opzioniScelte() {
    const modello = modulo.modello.value, o = {};
    if (modello === 'arima') { o.auto = modulo.auto.checked; o.p = +modulo.p.value; o.d = +modulo.d.value; o.q = +modulo.q.value; }
    if (modello === 'var') o.p = +modulo.p.value;
    return o;
  }
  function disegnaStatoPiano() {
    const nome = M.nomeModelloPiano(stato.dati), el = $('#stato-previsione');
    el.textContent = nome ? `Il piano stima l'indice delle rate future con il modello ${nome}.` : 'Il piano stima l\'indice delle rate future con la media delle variazioni passate.';
    $('#togli-previsione').hidden = !nome;
    const usa = $('#usa-previsione');
    usa.hidden = !ultimo || ultimo.modello === 'media' || ultimo.codice === 'contratto' && Internet.riconosci(M.indice());
    if (!usa.hidden) usa.textContent = `Usa ${Mod.MODELLI[ultimo.modello].breve} per le rate future del piano`;
  }
  function disegna() {
    if (!stato.dati) return;
    disegnaSerie();
    disegnaStatoPiano();
    if (!ultimo) disegnaGrafico();
  }
  modulo.modello.replaceChildren(...Object.entries(Mod.MODELLI).map(([codice, m]) => crea('option', { value: codice }, m.nome)));
  modulo.modello.value = 'vasicek';
  modulo.orizzonte.replaceChildren(...ORIZZONTI.map(([v, t]) => crea('option', { value: v, selected: v === '24' }, t)));
  disegnaParametri();
  modulo.modello.addEventListener('change', disegnaParametri);
  modulo.addEventListener('submit', async evento => {
    evento.preventDefault();
    const pulsante = $('button[type="submit"]', modulo), codice = modulo.serie.value, modello = modulo.modello.value;
    const avviso = $('#avviso-previsione');
    avviso.hidden = true;
    pulsante.disabled = true;
    try {
      await assicuraSerie(codice);
      if (modello === 'var') for (const s of Internet.SERIE) await assicuraSerie(s.codice);
      const h = modulo.orizzonte.value === 'fine' ? 'fine' : +modulo.orizzonte.value;
      const { risultato, serie } = calcola(modello, codice, { ...opzioniScelte(), h }, stato.dati);
      ultimo = { risultato, serie, codice, modello, opzioni: opzioniScelte() };
      disegnaSerie();
      disegnaGrafico();
      disegnaEsito();
      disegnaStatoPiano();
    } catch (errore) {
      avviso.textContent = errore.message;
      avviso.hidden = false;
    } finally {
      pulsante.disabled = false;
    }
  });
  $('#usa-previsione').addEventListener('click', () => {
    if (!ultimo) return;
    esegui('PUT', 'parametri', { previsione_modello: ultimo.modello, previsione_opzioni: JSON.stringify(ultimo.opzioni) },
      `Da ora il piano stima le rate future con il modello ${Mod.MODELLI[ultimo.modello].breve}`);
  });
  $('#togli-previsione').addEventListener('click', () => esegui('PUT', 'parametri', { previsione_modello: 'media', previsione_opzioni: '' }, 'Il piano torna alla media delle variazioni'));

  // ---------- Esito in parole ----------
  function frasi(r) {
    const p = r.parametri, fine = r.proiezione[r.proiezione.length - 1], anni = r.h / 12;
    const quando = r.h % 12 === 0 ? (anni === 1 ? 'fra un anno' : `fra ${anni} anni`) : `fra ${r.h} mesi`;
    const righe = [`Serie usata: ${r.mesiStorico} mesi, fino al ${data(r.partenza.giorno)} (ultimo valore ${perc(r.partenza.valore, 3)}).`,
      `Valore atteso ${quando}: ${perc(fine.valore, 2)}; nell'80% dei casi fra ${perc(fine.basso80, 2)} e ${perc(fine.alto80, 2)}, nel 95% fra ${perc(fine.basso95, 2)} e ${perc(fine.alto95, 2)}.`];
    if (r.modello === 'media') righe.push(`Variazione media mensile ${punti(p.variazioneMedia, 3)}, con una variabilità tipica di ${ampiezza(p.deviazione)} al mese.`);
    if (r.modello === 'arima') {
      righe.push(`Modello ARIMA(${p.p},${p.d},${p.q})${p.auto ? ', scelto fra 12 combinazioni con il criterio AIC' : ''}; lavora ${p.d ? 'sulle variazioni mensili' : 'sui livelli'}.`);
      if (p.phi.length) righe.push(`Coefficienti AR: ${p.phi.map(v => numero(v, 3)).join(', ')}${p.theta.length ? `; MA: ${p.theta.map(v => numero(v, 3)).join(', ')}` : ''}; costante ${punti(p.c, 4)}.`);
      else if (p.theta.length) righe.push(`Coefficienti MA: ${p.theta.map(v => numero(v, 3)).join(', ')}; costante ${punti(p.c, 4)}.`);
      if (p.mediaLungo != null) righe.push(`Livello di lungo periodo implicito: ${perc(p.mediaLungo, 2)}.`);
      righe.push(`Errore tipico di un mese: ${ampiezza(p.sigma)}.`);
    }
    if (r.modello === 'var') {
      righe.push(`VAR(${p.p}) stimato su ${p.k} serie e ${p.mesi} mesi in comune. A fine orizzonte le altre serie: ${Internet.SERIE.map((s, i) => `${s.nome.replace('Euribor ', '')} ${perc(p.altre[i].fine, 2)}`).join(', ')}.`);
    }
    if (r.modello === 'garch') {
      righe.push(`Variabilità attuale: ${ampiezza(p.volatilitaAttuale)} al mese, contro una media storica di ${ampiezza(p.volatilitaMedia)}${p.volatilitaLungo != null ? ` e un livello di lungo periodo di ${ampiezza(p.volatilitaLungo)}` : ''}.`);
      righe.push(`Persistenza α+β = ${numero(p.persistenza, 3)}: ${p.persistenza >= 0.995 ? 'la variabilità non torna a un livello fisso (modello al limite della stazionarietà): la proiezione usa quella di oggi' : p.persistenza > 0.9 ? 'i periodi agitati e quelli calmi durano a lungo' : 'la variabilità torna in fretta al suo livello normale'}. Variazione media mensile ${punti(p.mu, 4)}.`);
    }
    if (r.modello === 'vasicek') {
      if (p.ritornoMedio) righe.push(`Livello di lungo periodo ${perc(p.b, 2)}; velocità di ritorno ${numero(p.a, 2)} l'anno, cioè metà della distanza si copre in circa ${Math.round(p.semivita)} mesi. Variabilità annua ${ampiezza(p.sigma, 2)}.`);
      else righe.push('Nei dati non c\'è ritorno verso una media (la stima della velocità è nulla o negativa): la proiezione è una semplice tendenza con incertezza crescente.');
    }
    return righe;
  }
  function disegnaEsito() {
    const r = ultimo.risultato, blocco = $('#esito-previsione');
    $('#titolo-previsione').textContent = `${nomeSerie(ultimo.codice)}: proiezione ${Mod.MODELLI[r.modello].breve}`;
    const tabella = crea('table', { className: 'tabella-previsione' }, crea('thead', {}, crea('tr', {}, ...['Mese', 'Atteso', 'Fascia 80%', 'Fascia 95%'].map(t => crea('th', {}, t)))),
      crea('tbody', {}, ...r.proiezione.filter((p, i) => i < 12 || (i + 1) % 12 === 0 || i === r.proiezione.length - 1).map(p => crea('tr', {},
        crea('td', {}, `${MESI[+p.mese.slice(5, 7) - 1]} ${p.mese.slice(0, 4)}`), crea('td', {}, perc(p.valore, 2)),
        crea('td', {}, `${perc(p.basso80, 2)} – ${perc(p.alto80, 2)}`), crea('td', {}, `${perc(p.basso95, 2)} – ${perc(p.alto95, 2)}`)))));
    blocco.replaceChildren(crea('ul', { className: 'frasi' }, ...frasi(r).map(f => crea('li', {}, f))),
      crea('details', {}, crea('summary', {}, 'Tabella della proiezione (primi 12 mesi, poi un valore all\'anno)'), crea('div', { className: 'contenitore-tabella semplice' }, tabella)));
  }

  // ---------- Grafico ----------
  function disegnaGrafico() {
    const contenitore = $('#grafico-previsione');
    if (!ultimo) { contenitore.replaceChildren(crea('p', { className: 'nota' }, 'Scegli serie e modello e premi «Calcola la proiezione».')); return; }
    const NS = 'http://www.w3.org/2000/svg';
    const svg = (tag, attributi = {}, testo) => { const el = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attributi)) el.setAttribute(k, v); if (testo != null) el.textContent = testo; return el; };
    const r = ultimo.risultato, anniStorico = +modulo.storico.value;
    const partenza = inGiorni(r.partenza.giorno);
    const storico = ultimo.serie.map(p => ({ x: inGiorni(p.giorno), y: p.y, mese: p.mese })).filter(p => !anniStorico || p.x >= partenza - anniStorico * 365.25);
    const futuro = r.proiezione.map(p => ({ x: inGiorni(p.giorno), ...p }));
    const larghezza = Math.max(contenitore.clientWidth, 320), altezza = 340;
    const margine = { sopra: 22, destra: 70, sotto: 26, sinistra: 46 };
    const x0 = storico[0].x, x1 = futuro[futuro.length - 1].x;
    const valoriY = [...storico.map(p => p.y), ...futuro.flatMap(p => [p.basso95, p.alto95])];
    const minimo = Math.min(...valoriY), massimo = Math.max(...valoriY);
    const passo = [0.0025, 0.005, 0.01, 0.02, 0.05, 0.1].find(p => (massimo - minimo) / p <= 7) || 0.2;
    const y0 = Math.floor((minimo - 0.3 * passo) / passo + 1e-9) * passo, y1 = Math.max(Math.ceil((massimo + 0.3 * passo) / passo - 1e-9) * passo, y0 + passo);
    const decimali = passo < 0.01 ? (passo === 0.0025 ? 2 : 1) : 0;
    const sx = x => margine.sinistra + (x - x0) / (x1 - x0) * (larghezza - margine.sinistra - margine.destra);
    const sy = y => margine.sopra + (y1 - y) / (y1 - y0) * (altezza - margine.sopra - margine.sotto);
    const radice = svg('svg', { viewBox: `0 0 ${larghezza} ${altezza}`, height: altezza, role: 'img', tabindex: 0,
      'aria-label': `${nomeSerie(ultimo.codice)}: storico e proiezione ${Mod.MODELLI[r.modello].breve} fino a ${data(r.proiezione[r.proiezione.length - 1].giorno)}` });
    for (let y = y0; y <= y1 + passo / 2; y += passo) radice.append(svg('line', { class: 'griglia', x1: margine.sinistra, x2: larghezza - margine.destra, y1: sy(y), y2: sy(y) }), svg('text', { x: margine.sinistra - 8, y: sy(y) + 4, 'text-anchor': 'end' }, perc(y, decimali)));
    const pixelPerMese = (larghezza - margine.sinistra - margine.destra) / Math.max((x1 - x0) / 30.44, 1);
    const ogniMesi = [1, 3, 6, 12, 24, 60, 120].find(n => n * pixelPerMese >= 64) || 240;
    for (let anno = new Date(x0 * 86400000).getUTCFullYear(), mese = 0; ; mese += ogniMesi) {
      const x = Date.UTC(anno, mese, 1) / 86400000;
      if (x > x1) break;
      if (x < x0) continue;
      const d = new Date(x * 86400000);
      radice.append(svg('line', { class: 'asse', x1: sx(x), x2: sx(x), y1: altezza - margine.sotto, y2: altezza - margine.sotto + 5 }),
        svg('text', { x: sx(x), y: altezza - 6, 'text-anchor': 'middle' }, d.getUTCMonth() === 0 ? String(d.getUTCFullYear()) : `${MESI[d.getUTCMonth()].slice(0, 3)} ${String(d.getUTCFullYear()).slice(2)}`));
    }
    radice.append(svg('line', { class: 'asse', x1: margine.sinistra, x2: larghezza - margine.destra, y1: altezza - margine.sotto, y2: altezza - margine.sotto }));
    // Fasce: poligono dal basso all'alto, partendo dal punto di partenza.
    const inizio = { x: partenza, basso80: r.partenza.valore, alto80: r.partenza.valore, basso95: r.partenza.valore, alto95: r.partenza.valore };
    const banda = (basso, alto, classe) => svg('path', { class: classe, d: [inizio, ...futuro].map((p, i) => `${i ? 'L' : 'M'}${sx(p.x).toFixed(1)} ${sy(p[alto]).toFixed(1)}`).join('') + [...futuro].reverse().concat(inizio).map(p => `L${sx(p.x).toFixed(1)} ${sy(p[basso]).toFixed(1)}`).join('') + 'Z' });
    radice.append(banda('basso95', 'alto95', 'banda95'), banda('basso80', 'alto80', 'banda80'));
    radice.append(svg('line', { class: 'separatore', x1: sx(partenza), x2: sx(partenza), y1: margine.sopra, y2: altezza - margine.sotto }));
    radice.append(svg('path', { class: 'linea', d: storico.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x).toFixed(1)} ${sy(p.y).toFixed(1)}`).join('') }));
    radice.append(svg('path', { class: 'proiezione', d: [{ x: partenza, valore: r.partenza.valore }, ...futuro].map((p, i) => `${i ? 'L' : 'M'}${sx(p.x).toFixed(1)} ${sy(p.valore).toFixed(1)}`).join('') }));
    const fine = futuro[futuro.length - 1];
    radice.append(svg('circle', { class: 'punto', cx: sx(partenza), cy: sy(r.partenza.valore), r: 4 }), svg('text', { class: 'finale', x: sx(fine.x) + 8, y: sy(fine.valore) + 4 }, perc(fine.valore, 2)));
    // Lettura dei valori con il puntatore.
    const mirino = svg('line', { class: 'mirino', y1: margine.sopra, y2: altezza - margine.sotto, visibility: 'hidden' });
    const fumetto = crea('div', { className: 'fumetto', hidden: true });
    radice.append(mirino);
    const tutti = [...storico.map(p => ({ x: p.x, testo: [perc(p.y, 3), `${MESI[+p.mese.slice(5, 7) - 1]} ${p.mese.slice(0, 4)} (storico)`] })),
      ...futuro.map(p => ({ x: p.x, testo: [perc(p.valore, 2), `${MESI[+p.mese.slice(5, 7) - 1]} ${p.mese.slice(0, 4)} (proiezione)`, `80%: ${perc(p.basso80, 2)} – ${perc(p.alto80, 2)}`, `95%: ${perc(p.basso95, 2)} – ${perc(p.alto95, 2)}`] }))];
    radice.addEventListener('pointermove', evento => {
      const riquadro = radice.getBoundingClientRect();
      const x = x0 + (evento.clientX - riquadro.left - margine.sinistra) / (larghezza - margine.sinistra - margine.destra) * (x1 - x0);
      let vicino = tutti[0];
      for (const p of tutti) if (Math.abs(p.x - x) < Math.abs(vicino.x - x)) vicino = p;
      mirino.setAttribute('x1', sx(vicino.x)); mirino.setAttribute('x2', sx(vicino.x)); mirino.setAttribute('visibility', 'visible');
      fumetto.replaceChildren(crea('strong', {}, vicino.testo[0]), ...vicino.testo.slice(1).map(t => crea('span', {}, t)));
      fumetto.hidden = false;
      const px = sx(vicino.x), aDestra = px + 14 + fumetto.offsetWidth <= larghezza;
      fumetto.style.left = (aDestra ? px + 14 : px - 14 - fumetto.offsetWidth) + 'px';
      fumetto.style.top = '10px';
    });
    radice.addEventListener('pointerleave', () => { mirino.setAttribute('visibility', 'hidden'); fumetto.hidden = true; });
    contenitore.replaceChildren(radice, fumetto);
  }
  modulo.storico.addEventListener('change', disegnaGrafico);
  let timer;
  window.addEventListener('resize', () => { clearTimeout(timer); timer = setTimeout(() => { if (ultimo && !$('#scheda-previsioni').hidden) disegnaGrafico(); }, 150); });

  // ---------- Agganci ----------
  M.viste.push(disegna);
  M.allApertura.previsioni = () => { disegna(); if (ultimo) disegnaGrafico(); };
})();
