// Motore di calcolo del piano di un prestito (mutuo a tasso variabile o fisso, finanziamento), con le regole del
// contratto scelte nei parametri; costo totale e TAEG.
// Usato sia dalla pagina (browser) sia dalle prove (Node).
(function (radice, crea) {
  if (typeof module === 'object' && module.exports) module.exports = crea();
  else radice.Calcolo = crea();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const MS_GIORNO = 86400000;

  // Le date viaggiano come stringhe ISO (aaaa-mm-gg); i conti si fanno sul numero di giorni.
  const isoInGiorno = iso => { const [a, m, g] = iso.split('-').map(Number); return Date.UTC(a, m - 1, g) / MS_GIORNO; };
  // Arrotondamento al centesimo (il piccolo margine evita che 0,125 diventi 0,12 per colpa dei decimali binari).
  const centesimi = v => Math.round((v + 1e-9) * 100) / 100;
  const giornoInIso = n => new Date(n * MS_GIORNO).toISOString().slice(0, 10);
  // Rata costante di un piano alla francese (capitale + interessi) al tasso di periodo t.
  const rataFrancese = (debito, t, rate) => t > 1e-12 ? debito * t / (1 - Math.pow(1 + t, -rate)) : debito / rate;
  // Arrotondamento della rata a tasso fisso secondo il contratto (REGOLE.arrotonda_rata).
  function arrotondaRata(v, modo) {
    if (modo === 'dieci_su') return Math.round(Math.ceil(v * 10 - 1e-6) * 10) / 100;
    if (modo === 'dieci') return Math.round(Math.round(v * 10 + 1e-9) * 10) / 100;
    if (modo === 'euro_su') return Math.ceil(v - 1e-6);
    return centesimi(v);
  }
  // Rata costante di "rate" rate normali seguite, il mese dopo, da una maxirata: il debito è uguale al valore attuale
  // delle rate normali più quello della maxirata. Senza maxirata è la rata alla francese.
  const rataConMaxirata = (debito, t, rate, maxirata) => t > 1e-12
    ? (debito - maxirata * Math.pow(1 + t, -(rate + 1))) * t / (1 - Math.pow(1 + t, -rate)) : (debito - maxirata) / rate;

  // Giorni lavorativi contati spostandosi di n giorni da "partenza" (escluso), saltando weekend e festività.
  function giorniLavorativiContati(partenza, n, festivita) {
    const contati = [];
    const passo = n < 0 ? -1 : 1;
    for (let giorno = partenza + passo; contati.length < Math.abs(n); giorno += passo) {
      const settimana = new Date(giorno * MS_GIORNO).getUTCDay();
      if (settimana !== 0 && settimana !== 6 && !festivita.has(giorno)) contati.push(giorno);
    }
    return contati;
  }
  function giornoLavorativo(partenza, n, festivita) {
    const contati = giorniLavorativiContati(partenza, n, festivita);
    return contati.length ? contati[contati.length - 1] : partenza;
  }

  // Domenica di Pasqua (algoritmo di Meeus/Jones/Butcher), come numero di giorno.
  function pasqua(anno) {
    const a = anno % 19, b = Math.floor(anno / 100), c = anno % 100, d = Math.floor(b / 4), e = b % 4;
    const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
    const mese = Math.floor((h + l - 7 * m + 114) / 31), giorno = ((h + l - 7 * m + 114) % 31) + 1;
    return Date.UTC(anno, mese - 1, giorno) / MS_GIORNO;
  }
  // Festività del calendario TARGET (quello che ferma la rilevazione dell'Euribor).
  const FESTE_FISSE = { '01-01': 'Capodanno', '05-01': 'Festa del lavoro', '12-25': 'Natale', '12-26': 'Santo Stefano' };
  const FESTE_TARGET = ['Capodanno', 'Venerdì Santo', 'Lunedì dell\'Angelo', 'Festa del lavoro', 'Natale', 'Santo Stefano'];
  function nomeFestivita(iso) {
    if (FESTE_FISSE[iso.slice(5)]) return FESTE_FISSE[iso.slice(5)];
    const distanza = isoInGiorno(iso) - pasqua(+iso.slice(0, 4));
    return distanza === -2 ? 'Venerdì Santo' : distanza === 1 ? 'Lunedì dell\'Angelo' : 'Altra chiusura';
  }
  // Le sei festività TARGET di un anno, in ordine di data.
  function festivitaTarget(anno) {
    const p = pasqua(anno);
    return [`${anno}-01-01`, giornoInIso(p - 2), giornoInIso(p + 1), `${anno}-05-01`, `${anno}-12-25`, `${anno}-12-26`].sort();
  }

  // Statistiche di una serie di punti { x: giorno, y: valore } in ordine di data.
  // Media e mediana sono pesate sui giorni, così non dipendono da quanto sono fitte le rilevazioni.
  function statistiche(punti) {
    const n = punti.length;
    if (!n) return null;
    const ordinati = [];
    for (let i = 1; i < n; i++) {
      const a = punti[i - 1], b = punti[i];
      for (let x = a.x; x < b.x; x++) ordinati.push(a.y + (b.y - a.y) * (x - a.x) / (b.x - a.x));
    }
    ordinati.push(punti[n - 1].y);
    ordinati.sort((a, b) => a - b);
    const meta = ordinati.length >> 1;
    const mediana = ordinati.length % 2 ? ordinati[meta] : (ordinati[meta - 1] + ordinati[meta]) / 2;
    let minimo = punti[0], massimo = punti[0], area = 0, sommaX = 0, sommaY = 0;
    punti.forEach((p, i) => {
      if (p.y < minimo.y) minimo = p;
      if (p.y > massimo.y) massimo = p;
      if (i) area += (p.y + punti[i - 1].y) / 2 * (p.x - punti[i - 1].x);
      sommaX += p.x; sommaY += p.y;
    });
    const primo = punti[0], ultimo = punti[n - 1], durata = ultimo.x - primo.x;
    const mediaX = sommaX / n, mediaY = sommaY / n;
    let sopra = 0, sotto = 0;
    for (const p of punti) { sopra += (p.x - mediaX) * (p.y - mediaY); sotto += (p.x - mediaX) ** 2; }
    const pendenza = sotto ? sopra / sotto : 0;   // variazione al giorno della retta di tendenza
    return {
      n, primo, ultimo, minimo, massimo, variazione: ultimo.y - primo.y,
      media: durata > 0 ? area / durata : primo.y, mediana, durata,
      pendenza, tendenza: x => mediaY + pendenza * (x - mediaX),
    };
  }
  // Ultimo punto con data non successiva a x (null se non ce ne sono).
  function puntoAl(punti, x) {
    let basso = 0, alto = punti.length - 1, trovato = null;
    while (basso <= alto) {
      const medio = (basso + alto) >> 1;
      if (punti[medio].x <= x) { trovato = punti[medio]; basso = medio + 1; } else alto = medio - 1;
    }
    return trovato;
  }

  // Le scelte possibili per le regole del contratto: [valore, nome breve, spiegazione].
  const REGOLE = {
    regola_rilevazione: [
      ['lavorativi_prima', 'Alcuni giorni lavorativi prima dell\'inizio del periodo', 'Il tasso si legge N giorni lavorativi prima dell\'ultimo giorno del periodo precedente (weekend e festività TARGET non contano).'],
      ['ultimo_lavorativo', 'Ultimo giorno lavorativo del periodo precedente', 'Il tasso si legge l\'ultimo giorno lavorativo prima che inizi il periodo.'],
      ['primo_lavorativo', 'Primo giorno lavorativo del periodo', 'Il tasso si legge il primo giorno lavorativo del periodo.'],
      ['giorno_fisso', 'Un giorno fisso del mese precedente', 'Il tasso si legge sempre lo stesso giorno del mese prima (se cade di festa, il lavorativo precedente).'],
      ['media_mese', 'Media del mese precedente', 'Si usa la media di tutte le rilevazioni del mese solare precedente.'],
    ],
    conteggio_giorni: [
      ['eff_365_366', 'Giorni effettivi / 365 (366 negli anni bisestili)', 'Interessi = debito × tasso × giorni del periodo / giorni dell\'anno.'],
      ['eff_365', 'Giorni effettivi / 365', 'Come sopra, ma sempre diviso 365.'],
      ['eff_360', 'Giorni effettivi / 360', 'Interessi = debito × tasso × giorni del periodo / 360 (anno commerciale).'],
      ['mese_12', 'Un dodicesimo del tasso annuo', 'Ogni mese pesa uguale: interessi = debito × tasso / 12.'],
    ],
    tipo_piano: [
      ['francese', 'Alla francese con rata ricalcolata', 'A ogni rata la quota capitale viene ricalcolata sul debito residuo, le rate mancanti e il tasso del momento. Lo riconosci perché nel contratto non c\'è un elenco di quote capitale già fissate.'],
      ['quote_fisse', 'Quote capitale fissate all\'inizio', 'Le quote capitale sono già scritte, rata per rata, nel piano di ammortamento consegnato alla firma: crescono un po\' ogni mese e non cambiano con il tasso. Variano solo gli interessi.'],
      ['italiana', 'All\'italiana (quota capitale costante)', 'Ogni rata rimborsa la stessa quota di capitale: importo diviso per il numero di rate.'],
    ],
    arrotonda_indice_modo: [['vicino', 'al valore più vicino'], ['eccesso', 'sempre per eccesso']],
    // A tasso fisso alcune banche arrotondano la rata (ad esempio 209,09 → 209,10): l'ultima rata chiude il debito.
    arrotonda_rata: [
      ['centesimo', 'Al centesimo', 'La rata è quella esatta, arrotondata al centesimo: il caso più comune.'],
      ['dieci_su', 'Ai 10 centesimi, per eccesso', 'Ad esempio 209,03 diventa 209,10.'],
      ['dieci', 'Ai 10 centesimi, al più vicino', 'Ad esempio 209,03 diventa 209,00 e 209,06 diventa 209,10.'],
      ['euro_su', 'All\'euro, per eccesso', 'Ad esempio 209,03 diventa 210,00.'],
    ],
  };

  // Cambi del contratto dopo la firma (dati.cambi: rinegoziazione, tasso fisso rivisto dopo qualche anno, passaggio da
  // fisso a variabile o al contrario): dalla rata «dalla_rata» valgono le condizioni nuove. Il piano si divide in tratti,
  // ognuno con il suo tipo di tasso, il suo «tasso» (il TAN a tasso fisso, lo spread nel variabile) e «fine», l'ultima
  // rata del piano secondo quel tratto (un cambio può allungare o accorciare la durata). Il primo tratto ha le condizioni
  // della firma. Un cambio che non cade dentro il tratto precedente si ignora; con la maxirata non ci sono cambi.
  function tratti(dati) {
    const p = dati.parametri, variabile = (p.tipo_prestito || 'variabile') === 'variabile';
    const maxi = !variabile && p.tipo_prestito === 'maxirata' && p.maxirata > 0 && p.maxirata < p.importo_iniziale;
    const elenco = [{ da: 1, variabile, tasso: variabile ? p.spread : (p.tasso_fisso || 0), fine: p.numero_rate + (maxi ? 1 : 0), cambio: null }];
    if (maxi) return elenco;
    for (const c of [...(dati.cambi || [])].sort((a, b) => a.dalla_rata - b.dalla_rata)) {
      const prima = elenco[elenco.length - 1];
      if (!(c.dalla_rata > prima.da && c.dalla_rata <= prima.fine)) continue;
      const v = c.tipo === 'variabile';
      elenco.push({ da: c.dalla_rata, variabile: v, tasso: v ? c.spread : c.tasso_fisso, fine: c.rate_residue > 0 ? c.dalla_rata - 1 + c.rate_residue : prima.fine, cambio: c });
    }
    return elenco;
  }
  // Il prestito ha almeno un tratto a tasso variabile (servono l'indice e i suoi valori).
  const conVariabile = dati => tratti(dati).some(t => t.variabile);

  // dati = { parametri, rate, euribor, festivita, cambi } così come escono dall'archivio.
  // opzioni.fino: calcola solo le prime rate (serve alla taratura, che guarda solo quelle già addebitate);
  // opzioni.festivita e opzioni.tassi: gli stessi dati già trasformati, per non rifarlo a ogni prova.
  function calcolaPiano(dati, opzioni = {}) {
    const p = dati.parametri;
    // A tasso fisso (mutuo o finanziamento) non c'è un indice: il tasso è il TAN, uguale per tutte le rate (o per tutte
    // quelle di un tratto, se il contratto è cambiato). "variabile" è il tipo alla firma.
    const variabile = (p.tipo_prestito || 'variabile') === 'variabile';
    const festivita = opzioni.festivita || new Set(dati.festivita.map(isoInGiorno));
    const lavorativo = g => { const s = new Date(g * MS_GIORNO).getUTCDay(); return s !== 0 && s !== 6 && !festivita.has(g); };
    const tassi = opzioni.tassi || new Map(dati.euribor.map(t => [t.giorno, t.tasso_360]));
    const manuali = new Map(dati.rate.map(r => [r.n, r]));
    const [anno0, mese0, giorno0] = p.data_prima_rata.split('-').map(Number);
    // Finanziamento con maxirata: dopo le rate normali c'è una rata in più, molto più grande, che chiude il debito.
    const maxirata = !variabile && p.tipo_prestito === 'maxirata' && p.maxirata > 0 && p.maxirata < p.importo_iniziale ? p.maxirata : 0;
    const elencoTratti = tratti(dati), rateFirmate = elencoTratti[0].fine, numeroRate = elencoTratti[elencoTratti.length - 1].fine;
    // Prestito chiuso dopo una certa rata (surroga, o rifatto con un prestito nuovo): il piano si ferma lì e il debito che
    // restava lo paga il prestito nuovo.
    const estinto = p.estinto_dopo_rata > 0 && p.estinto_dopo_rata < numeroRate ? p.estinto_dopo_rata : 0;
    const ogniMesi = Math.max(1, Math.round(p.mesi_revisione || 1));
    const inizioPeriodo = n => Date.UTC(anno0, mese0 - 1 + (n - 1), giorno0) / MS_GIORNO;   // n = numeroRate + 1: fine piano
    // Preammortamento (25 ottobre 2026): se il prestito è stato accreditato prima dell'inizio del primo periodo, gli
    // interessi di quei giorni, sul capitale intero e al tasso della prima rata, si pagano con la prima rata oppure a
    // parte (p.preammortamento === 'a_parte'). Succede spesso nei finanziamenti: la prima rata arriva dopo 30-60 giorni.
    const erogazione = p.data_erogazione ? isoInGiorno(p.data_erogazione) : null;
    const giorniPre = erogazione != null ? Math.min(366, Math.max(0, inizioPeriodo(1) - erogazione)) : 0;

    // Media delle rilevazioni per mese solare (serve solo alla regola "media del mese precedente").
    const perMese = new Map();
    if (p.regola_rilevazione === 'media_mese') {
      for (const t of dati.euribor) {
        const mese = t.giorno.slice(0, 7), voce = perMese.get(mese) || { somma: 0, quanti: 0 };
        voce.somma += t.tasso_360; voce.quanti++;
        perMese.set(mese, voce);
      }
    }
    // Giorno in cui si legge l'indice per un periodo che inizia il giorno "inizio".
    function rilevazione(inizio) {
      switch (p.regola_rilevazione) {
        case 'ultimo_lavorativo': { let g = inizio - 1; while (!lavorativo(g)) g--; return { giorno: g, contati: [] }; }
        case 'primo_lavorativo': { let g = inizio; while (!lavorativo(g)) g++; return { giorno: g, contati: [] }; }
        case 'giorno_fisso': {
          const prima = new Date((inizio - 1) * MS_GIORNO), giorniDelMese = new Date(Date.UTC(prima.getUTCFullYear(), prima.getUTCMonth() + 1, 0)).getUTCDate();
          let g = Date.UTC(prima.getUTCFullYear(), prima.getUTCMonth(), Math.min(p.giorno_rilevazione || 1, giorniDelMese)) / MS_GIORNO;
          while (!lavorativo(g)) g--;
          return { giorno: g, contati: [] };
        }
        case 'media_mese': return { giorno: inizio - 1, contati: [], media: true };
        default: {
          const contati = giorniLavorativiContati(inizio - 1, -(p.giorni_anticipo_euribor || 0), festivita);
          return { giorno: contati.length ? contati[contati.length - 1] : inizio - 1, contati };
        }
      }
    }
    // Arrotondamento e tasso minimo dell'indice previsti dal contratto.
    const passo = p.arrotonda_indice > 0 ? p.arrotonda_indice : 0;
    function indiceApplicato(valore) {
      let v = valore;
      if (passo) v = (p.arrotonda_indice_modo === 'eccesso' ? Math.ceil(v / passo - 1e-9) : Math.round(v / passo)) * passo;
      if (p.floor_attivo > 0) v = Math.max(v, p.indice_minimo || 0);
      return v;
    }

    // Primo passaggio: date del periodo e indice reale (manuale o dal database) nelle rate in cui il tasso si rivede.
    // Ogni riga sa in che tratto cade ("tratto": la posizione in elencoTratti); le rate che restano sono quelle del suo tratto.
    const righe = [], ultimaDaCalcolare = Math.min(numeroRate, opzioni.fino || numeroRate, estinto || numeroRate);
    for (let n = 1, t = 0; n <= ultimaDaCalcolare; n++) {
      while (t + 1 < elencoTratti.length && elencoTratti[t + 1].da <= n) t++;
      const tratto = elencoTratti[t];
      const inizio = inizioPeriodo(n), fine = inizioPeriodo(n + 1) - 1;
      const m = manuali.get(n) || {};
      const date = { inizio: giornoInIso(inizio), fine: giornoInIso(fine), giorniMese: fine - inizio + 1,
        giorniAnno: 365 + (new Date(fine * MS_GIORNO).getUTCFullYear() % 4 ? 0 : 1), rateResidue: tratto.fine - n + 1, tratto: t };
      if (!tratto.variabile) {
        righe.push({ n, riferimento: date.inizio, riferimentoAutomatico: date.inizio, riferimentoManuale: false, conteggio: [], rataRevisione: n, revisione: true,
          eredita: false, mediaDi: 0, ...date, euribor: 0, origineEuribor: 'fisso', manuale: m });
        continue;
      }
      // Rata in cui il tasso è stato rivisto l'ultima volta: le revisioni si contano dall'inizio del tratto.
      const rataRevisione = n - ((n - tratto.da) % ogniMesi);
      const ril = rilevazione(inizioPeriodo(rataRevisione));
      const riferimentoAutomatico = giornoInIso(ril.giorno);
      const riferimentoIso = m.data_riferimento || riferimentoAutomatico;
      // Fra una revisione e l'altra la rata eredita il tasso, a meno che non abbia valori propri inseriti a mano.
      const eredita = n !== rataRevisione && m.euribor == null && !m.data_riferimento;
      let euribor = null, origineEuribor = 'previsione', mediaDi = 0;
      if (m.euribor != null) { euribor = m.euribor; origineEuribor = 'manuale'; }
      else if (!eredita && ril.media && !m.data_riferimento) {
        const voce = perMese.get(riferimentoIso.slice(0, 7));
        if (voce) { euribor = indiceApplicato(voce.somma / voce.quanti); origineEuribor = 'db'; mediaDi = voce.quanti; }
      } else if (!eredita && tassi.has(riferimentoIso)) { euribor = indiceApplicato(tassi.get(riferimentoIso)); origineEuribor = 'db'; }
      righe.push({
        n, riferimento: riferimentoIso, riferimentoAutomatico, riferimentoManuale: !!m.data_riferimento,
        conteggio: ril.contati.map(giornoInIso),   // giorni lavorativi contati all'indietro: l'ultimo è la data calcolata
        rataRevisione, revisione: n === rataRevisione, eredita, mediaDi, ...date,
        euribor, origineEuribor, manuale: m,
      });
    }

    // Variazione media dell'indice fra una revisione e la successiva, sui valori reali consecutivi.
    const punti = righe.filter(r => !r.eredita);
    let somma = 0, coppie = 0;
    for (let i = 1; i < punti.length; i++) {
      if (punti[i].euribor != null && punti[i - 1].euribor != null) { somma += punti[i].euribor - punti[i - 1].euribor; coppie++; }
    }
    const mediaVariazioni = coppie ? somma / coppie : 0;
    const tetto = p.euribor_massimo > 0 ? p.euribor_massimo : null;
    const rataIdeale = p.rata_obiettivo > 0 ? p.rata_obiettivo : null;
    const primaDelPiano = Number.isFinite(p.euribor_mese_precedente) ? p.euribor_mese_precedente : null;
    // Piano fissato all'inizio: le quote fisse del variabile, oppure la francese a tasso fisso, che ha la rata costante
    // (la quota capitale è la rata meno gli interessi, come nel piano consegnato dalla banca).
    // A ogni cambio del contratto il piano riparte dal debito di quel momento (vedi sotto).
    let pianoFissato = p.tipo_piano === 'quote_fisse' && variabile || (p.tipo_piano !== 'italiana' || maxirata > 0) && !variabile;
    let tassoPiano = variabile ? p.tasso_annuo_piano : (p.tasso_fisso || 0);
    let rataPiano = variabile && p.rata_piano > 0 ? p.rata_piano
      : !variabile ? arrotondaRata(rataConMaxirata(p.importo_iniziale, tassoPiano / 12, p.numero_rate, maxirata), p.arrotonda_rata)
        : tassoPiano > 0 ? centesimi(rataFrancese(p.importo_iniziale, tassoPiano / 12, rateFirmate)) : 0;
    let quotaItaliana = centesimi(p.importo_iniziale / rateFirmate);
    let debitoPiano = p.importo_iniziale;
    // Valore dell'indice da cui partire se un tratto variabile comincia dopo un tratto fisso e non ha valori veri: l'ultimo noto.
    const ultimoNoto = dati.euribor.length ? indiceApplicato(dati.euribor[dati.euribor.length - 1].tasso_360) : 0;

    // Orizzonte della stima: oltre «previsione_anni» anni dall'ultimo valore vero l'indice resta fermo (0: fermo da
    // subito, 99: fino alla fine). Nessuno sa dove sarà l'indice fra molti anni: una stima lunga è solo un'ipotesi.
    const anniStima = Number.isFinite(p.previsione_anni) ? p.previsione_anni : 3;
    let limiteStima = null;
    // Secondo passaggio: previsione dei tassi futuri e tutte le colonne calcolate.
    let cumulato = 0, ultimoPunto = null;
    for (let i = 0; i < righe.length; i++) {
      const r = righe[i], prec = righe[i - 1], m = r.manuale, tratto = elencoTratti[r.tratto];
      if (!tratto.variabile) r.variazione = 0;
      else if (r.eredita) {
        const base = righe[r.rataRevisione - 1];
        r.euribor = base.euribor; r.origineEuribor = base.origineEuribor; r.alTetto = base.alTetto; r.mediaDi = base.mediaDi;
        r.variazione = 0;
      } else {
        if (r.origineEuribor !== 'previsione') r.variazione = ultimoPunto ? r.euribor - ultimoPunto.euribor : primaDelPiano != null ? r.euribor - primaDelPiano : 0;
        else {
          // Previsione: con opzioni.previsione (una funzione giorno → indice, dalla scheda «Previsioni») si usa il valore
          // del modello; altrimenti ultimo valore più l'ultima variazione. Raggiunto il tetto impostato, non sale più.
          // Oltre l'orizzonte della stima resta il valore che aveva all'orizzonte.
          if (limiteStima == null) {
            const base = ultimoPunto ? ultimoPunto.riferimento : r.riferimento;
            limiteStima = anniStima >= 99 ? '9999-12-31' : `${+base.slice(0, 4) + anniStima}${base.slice(4)}`;
          }
          const oltre = r.riferimento > limiteStima;
          const stimata = opzioni.previsione ? opzioni.previsione(oltre ? limiteStima : r.riferimento) : null;
          r.euribor = stimata != null ? stimata : oltre && ultimoPunto ? ultimoPunto.euribor
            : ultimoPunto ? ultimoPunto.euribor + ultimoPunto.variazione : primaDelPiano != null ? primaDelPiano : tratto.da > 1 ? ultimoNoto : 0;
          if (p.floor_attivo > 0) r.euribor = Math.max(r.euribor, p.indice_minimo || 0);
          r.alTetto = tetto != null && r.euribor >= tetto;
          if (r.alTetto) r.euribor = tetto;
          r.variazione = r.alTetto || oltre ? (oltre && ultimoPunto ? r.euribor - ultimoPunto.euribor : 0) : stimata != null ? (ultimoPunto ? r.euribor - ultimoPunto.euribor : 0) : mediaVariazioni;
          r.daModello = stimata != null;
          r.stimaFerma = oltre;
        }
        ultimoPunto = r;
      }
      const reale = r.origineEuribor !== 'previsione';

      // A tasso fisso il TAN prende il posto dello spread (e l'indice vale zero): una rata può averne uno suo, scritto a mano.
      r.spread = m.spread != null ? m.spread : tratto.tasso;
      r.spreadManuale = m.spread != null;
      r.tassoTotale = r.spread + r.euribor;
      if (p.tasso_massimo > 0 && r.tassoTotale > p.tasso_massimo) { r.tassoTotale = p.tasso_massimo; r.tassoLimitato = true; }

      r.debito = prec ? prec.debito - prec.quotaCapitale : p.importo_iniziale;
      r.percRimanente = r.debito / (p.valore_riferimento > 0 ? p.valore_riferimento : p.importo_iniziale);

      // Prima rata di un cambio del contratto: il piano riparte dal debito di adesso, con le rate che restano. A tasso fisso
      // la rata torna costante (ricalcolata con il TAN nuovo); all'italiana la quota resta costante sul debito che resta;
      // nel variabile le quote fissate all'inizio proseguono solo se la durata non cambia, altrimenti si passa alla
      // francese ricalcolata. Le spese del cambio (una volta sola) si contano con questa rata.
      if (r.tratto > 0 && r.n === tratto.da) {
        const prima = elencoTratti[r.tratto - 1];
        if (p.tipo_piano === 'italiana') { pianoFissato = false; quotaItaliana = centesimi(r.debito / r.rateResidue); }
        else if (!tratto.variabile) {
          pianoFissato = true; tassoPiano = tratto.tasso; debitoPiano = r.debito;
          rataPiano = arrotondaRata(rataFrancese(r.debito, tassoPiano / 12, r.rateResidue), p.arrotonda_rata);
        } else if (!(pianoFissato && prima.variabile && tratto.fine === prima.fine)) pianoFissato = false;
        if (tratto.cambio.spese > 0) r.speseCambio = tratto.cambio.spese;
      }

      // Quota capitale secondo il tipo di piano (l'ultima rata chiude il debito).
      if (pianoFissato) {
        // Il piano è fissato all'inizio: segue la propria catena del debito, non le quote inserite a mano.
        // Con la maxirata l'ultima rata normale assorbe i centesimi degli arrotondamenti: la maxirata resta quella del contratto.
        r.quotaPiano = r.rateResidue === 1 ? debitoPiano
          : maxirata && r.rateResidue === 2 ? Math.max(0, centesimi(debitoPiano - centesimi(maxirata / (1 + tassoPiano / 12))))
            : Math.min(debitoPiano, centesimi(rataPiano - centesimi(debitoPiano * tassoPiano / 12)));
        debitoPiano = centesimi(debitoPiano - r.quotaPiano);
      } else if (p.tipo_piano === 'italiana') r.quotaPiano = quotaItaliana;
      else {
        const t = r.tassoTotale / 12;
        r.quotaPiano = centesimi(t > 1e-12 ? r.debito * t / (Math.pow(1 + t, r.rateResidue) - 1) : r.debito / r.rateResidue);
      }
      if (maxirata > 0 && r.rateResidue === 1) r.maxirata = true;   // l'ultima rata è la maxirata
      r.quotaCapitaleManuale = m.quota_capitale != null;
      r.quotaCapitale = r.quotaCapitaleManuale ? m.quota_capitale : r.rateResidue === 1 ? r.debito : Math.min(r.debito, r.quotaPiano);
      r.percQuota = r.quotaCapitale / r.debito;
      if (r.n === estinto) r.estinto = centesimi(r.debito - r.quotaCapitale);   // il debito che passa al prestito nuovo

      // Interessi del periodo secondo il conteggio dei giorni del contratto; la rata è al centesimo.
      const base = p.conteggio_giorni === 'eff_365' ? 365 : p.conteggio_giorni === 'eff_360' ? 360 : r.giorniAnno;
      r.interessi = p.conteggio_giorni === 'mese_12' ? r.tassoTotale * r.debito / 12 : ((r.tassoTotale * r.debito) / base) * r.giorniMese;
      if (i === 0 && giorniPre > 0) {
        // Base dei giorni come per gli interessi: anno civile con i giorni effettivi, 360 con il dodicesimo (anno commerciale).
        const basePre = p.conteggio_giorni === 'eff_365_366' ? r.giorniAnno : p.conteggio_giorni === 'eff_365' ? 365 : 360;
        r.giorniPreammortamento = giorniPre;
        r.interessiPreammortamento = r.tassoTotale * p.importo_iniziale * giorniPre / basePre;
        if (p.preammortamento !== 'a_parte') r.interessi += r.interessiPreammortamento;
      }
      r.rataCalcolata = centesimi(r.interessi + r.quotaCapitale + p.spese_rata);
      cumulato += r.rataCalcolata;
      r.cumulato = cumulato;

      // Rata vera: quella scritta a mano oppure, in mancanza, quella presa dal calcolo (non controllata).
      r.rataCopiata = m.rata_vera == null && m.rata_copiata != null;
      r.rataVera = m.rata_vera != null ? m.rata_vera : r.rataCopiata ? m.rata_copiata : null;
      r.tassoApplicatoManuale = m.tasso_applicato != null;
      r.tassoApplicato = r.tassoApplicatoManuale ? m.tasso_applicato : (reale ? r.tassoTotale : null);
      r.euriborApplicato = r.tassoApplicato != null ? r.tassoApplicato - r.spread : null;
      r.quotaInteressi = r.rataVera != null ? r.rataVera - r.quotaCapitale - p.spese_rata : null;
      r.differenza = r.rataVera != null ? r.rataCalcolata - r.rataVera : null;
      // Rata del mese (vera se inserita, altrimenti calcolata), variazione sul mese prima e distanza dalla rata ideale.
      r.rataEffettiva = r.rataVera != null ? r.rataVera : r.rataCalcolata;
      // Variazione sul mese prima: si confronta il costo al giorno (rata / giorni del mese), in percentuale,
      // altrimenti un mese da 31 giorni sembrerebbe sempre più caro di uno da 30.
      r.rataAlGiorno = r.rataEffettiva / r.giorniMese;
      r.variazioneRataReale = prec ? r.rataEffettiva - prec.rataEffettiva : null;
      r.variazioneRata = prec ? r.rataAlGiorno / prec.rataAlGiorno - 1 : null;
      r.distanzaObiettivo = rataIdeale != null ? r.rataEffettiva - rataIdeale : null;
      delete r.manuale;
    }
    return { righe, mediaVariazioni };
  }

  // Tasso annuo del piano a quote fisse ricavato da una quota capitale vera: è il tasso per cui la quota
  // della rata k di un piano alla francese vale proprio quella cifra. Null se non si può ricavare.
  function tassoPianoDaQuota(importo, rate, k, quota) {
    if (!(quota > 0) || !(importo > 0) || k < 1 || k > rate / 3) return null;   // nelle prime rate la quota scende al crescere del tasso
    const quotaAl = t => importo * t * Math.pow(1 + t, k - 1) / (Math.pow(1 + t, rate) - 1);
    let basso = 1e-7, alto = 0.03;
    if (quota >= quotaAl(basso) || quota <= quotaAl(alto)) return null;
    for (let i = 0; i < 80; i++) { const medio = (basso + alto) / 2; if (quotaAl(medio) > quota) basso = medio; else alto = medio; }
    return Math.round((basso + alto) / 2 * 12 * 1e5) / 1e5;
  }

  // TAEG: il tasso annuo che rende uguali i soldi ricevuti e il valore attuale di tutto quello che si paga dopo
  // (direttiva 2008/48/CE, allegato I). I pagamenti sono uno al mese, alla fine di ogni periodo, e un mese conta come
  // un dodicesimo di anno. Null se non si può calcolare.
  // Con il preammortamento il primo periodo comincia «inizio» anni dopo l'accredito: i pagamenti si spostano di tanto, e
  // gli interessi di preammortamento pagati a parte («aParte») cadono all'inizio del primo periodo.
  function taeg(ricevuto, pagamenti, inizio = 0, aParte = 0) {
    if (!(ricevuto > 0) || !pagamenti.length) return null;
    const differenza = x => pagamenti.reduce((s, c, i) => s + c * Math.pow(1 + x, -(inizio + (i + 1) / 12)), 0) + aParte * Math.pow(1 + x, -inizio) - ricevuto;
    let basso = -0.99, alto = 10;
    if (differenza(basso) < 0 || differenza(alto) > 0) return null;
    for (let i = 0; i < 100; i++) { const medio = (basso + alto) / 2; if (differenza(medio) > 0) basso = medio; else alto = medio; }
    return (basso + alto) / 2;
  }
  // Spese iniziali che non entrano nel TAEG, riconosciute dal nome scritto dall'utente: il notaio, che la legge lascia
  // fuori dal costo totale del credito (art. 120-quinquies e 121 TUB), e l'agenzia immobiliare, che è un costo della casa
  // e non del prestito. Si pagano lo stesso, quindi restano nel costo totale calcolato dal programma.
  const FUORI_TAEG = /notai|notar|rogit|immobiliar/i;
  const fuoriDalTaeg = cosa => FUORI_TAEG.test(cosa || '');
  const speseFuoriTaeg = p => Math.min(p.spese_iniziali || 0,
    centesimi((p.spese_iniziali_voci || []).filter(v => fuoriDalTaeg(v.cosa)).reduce((s, v) => s + v.euro, 0)));
  // Quanto costa un prestito, dalle righe del piano: rate (vere dove ci sono, altrimenti calcolate; con "comeFirmato"
  // solo calcolate), spese iniziali, assicurazioni e spese annue. "costoTotale" è il costo totale del credito: tutto
  // quello che si paga oltre al capitale. "ricevuto" è il capitale meno quello che si paga all'inizio.
  // "totaleDaPagare" è tutto quello che esce di tasca: se le spese iniziali sono tolte dalla somma ricevuta o aggiunte
  // al prestito (spese_nel_prestito), le rate le comprendono già e non si contano una seconda volta.
  // Un'assicurazione facoltativa (assicurazione_facoltativa) resta nel costo totale ma non nel TAEG: per la direttiva
  // 2008/48/CE il TAEG conta solo i servizi accessori obbligatori. Se il premio è dentro il prestito, quella parte è
  // credito ricevuto (paga l'assicurazione per conto del cliente).
  // Le spese dei cambi del contratto si pagano con la prima rata di ogni cambio. Se il prestito è stato chiuso da un
  // prestito nuovo (surroga), il debito che restava («estinto» sull'ultima riga) è capitale restituito con l'ultima rata.
  // Delle spese iniziali scritte una per una, il notaio e l'agenzia immobiliare restano nel costo totale ma non nel TAEG
  // (speseFuoriTaeg).
  function costi(dati, righe, comeFirmato = false) {
    const p = dati.parametri, quante = righe.length;
    const rata = r => comeFirmato || r.rataVera == null ? r.rataCalcolata : r.rataVera;
    let totaleRate = 0, speseCambi = 0;
    const nelTaeg = !p.assicurazione_facoltativa, estinto = quante ? righe[quante - 1].estinto || 0 : 0;
    const pagamenti = righe.map((r, i) => {
      totaleRate += rata(r);
      speseCambi += r.speseCambio || 0;
      return rata(r) + (nelTaeg ? p.assicurazione_rata || 0 : 0) + ((i + 1) % 12 === 0 ? p.spese_annue || 0 : 0) + (r.speseCambio || 0) + (i === quante - 1 ? estinto : 0);
    });
    const speseRate = quante * (p.spese_rata || 0), speseIniziali = p.spese_iniziali || 0, speseAnnue = Math.floor(quante / 12) * (p.spese_annue || 0);
    const fuoriTaeg = speseFuoriTaeg(p);
    const assicurazioni = (p.assicurazione_iniziale || 0) + quante * (p.assicurazione_rata || 0);
    const prima = righe[0] || {}, giorniPre = prima.giorniPreammortamento || 0;
    const preAParte = giorniPre > 0 && p.preammortamento === 'a_parte' ? centesimi(prima.interessiPreammortamento) : 0;
    const interessi = totaleRate + estinto - p.importo_iniziale - speseRate + preAParte;
    const costoTotale = interessi + speseRate + speseIniziali + assicurazioni + speseAnnue + speseCambi;
    const ricevuto = p.importo_iniziale - speseIniziali - (p.assicurazione_iniziale || 0);
    return { totaleRate, interessi, speseRate, speseIniziali, speseFuoriTaeg: fuoriTaeg, assicurazioni, speseAnnue, speseCambi, estinto, costoTotale, ricevuto,
      totaleDaPagare: (p.spese_nel_prestito ? ricevuto : p.importo_iniziale) + costoTotale,
      taeg: taeg((nelTaeg ? ricevuto : p.importo_iniziale - speseIniziali) + fuoriTaeg, pagamenti, giorniPre / 365, preAParte), assicurazioneNelTaeg: nelTaeg,
      giorniPreammortamento: giorniPre, preammortamento: giorniPre > 0 ? centesimi(prima.interessiPreammortamento) : 0, preammortamentoAParte: preAParte > 0 };
  }

  // Taratura: prova le combinazioni di regole più comuni e conta quante rate vere (e quote capitale vere)
  // ciascuna riproduce al centesimo. Restituisce le migliori, dalla più aderente.
  // A tasso fisso non ci sono regole sull'indice: si provano solo il conteggio dei giorni, il piano e le spese.
  function tara(dati) {
    const base = dati.parametri;
    const variabile = (base.tipo_prestito || 'variabile') === 'variabile';
    const vere = dati.rate.filter(r => r.rata_vera != null);
    const quote = dati.rate.filter(r => r.quota_capitale != null).sort((a, b) => a.n - b.n);
    if (!vere.length) return [];
    // Tassi candidati per il piano a quote fisse: quello già impostato e quello che si ricava dalla crescita delle quote vere.
    const tassiPiano = new Set();
    if (base.tasso_annuo_piano > 0) tassiPiano.add(Math.round(base.tasso_annuo_piano * 1e5));
    if (quote.length >= 2 && quote[quote.length - 1].n > quote[0].n) {
      const mesi = quote[quote.length - 1].n - quote[0].n;
      const stima = Math.round((Math.pow(quote[quote.length - 1].quota_capitale / quote[0].quota_capitale, 1 / mesi) - 1) * 12 * 1e5);
      for (let d = -5; d <= 5; d++) if (stima + d > 0) tassiPiano.add(stima + d);
    }
    // Anche una sola quota capitale vera, nelle prime rate, basta a ricavare il tasso del piano con precisione.
    for (const q of quote) {
      const tasso = tassoPianoDaQuota(base.importo_iniziale, base.numero_rate, q.n, q.quota_capitale);
      if (tasso != null) for (const scarto of [0, -1, 1]) if (Math.round(tasso * 1e5) + scarto > 0) tassiPiano.add(Math.round(tasso * 1e5) + scarto);
    }
    // A tasso fisso la francese si prova con tutti gli arrotondamenti della rata.
    const piani = [...(variabile ? [{ tipo_piano: 'francese' }] : REGOLE.arrotonda_rata.map(([arrotonda_rata]) => ({ tipo_piano: 'francese', arrotonda_rata }))),
      ...(base.tipo_prestito === 'maxirata' ? [] : [{ tipo_piano: 'italiana' }]),
      ...(variabile ? [...tassiPiano].map(t => ({ tipo_piano: 'quote_fisse', tasso_annuo_piano: t / 1e5, rata_piano: 0 })) : [])];
    const rilevazioni = !variabile ? [{}] : [{ regola_rilevazione: 'ultimo_lavorativo' }, { regola_rilevazione: 'primo_lavorativo' }, { regola_rilevazione: 'media_mese' },
      ...[1, 2, 3, 4, 5, 6].map(n => ({ regola_rilevazione: 'lavorativi_prima', giorni_anticipo_euribor: n }))];
    const risultati = [], fino = Math.max(...vere.map(r => r.n), ...quote.map(r => r.n));
    const pronti = { fino, festivita: new Set(dati.festivita.map(isoInGiorno)), tassi: new Map(dati.euribor.map(t => [t.giorno, t.tasso_360])) };
    const primaRata = vere.find(r => r.n === 1);
    function prova(parametri) {
      const righe = calcolaPiano({ ...dati, parametri: { ...base, ...parametri } }, pronti).righe;
      const esito = { parametri, rate: 0, suRate: vere.length, quote: 0, suQuote: quote.length, senzaTasso: 0 };
      const scarti = new Map();   // scarto in centesimi fra rata vera e calcolata -> quante rate lo hanno
      for (const v of vere) {
        const r = righe[v.n - 1];
        if (!r) continue;
        if (r.origineEuribor === 'previsione') { esito.senzaTasso++; continue; }
        const scarto = Math.round((v.rata_vera - r.rataCalcolata) * 100);
        if (scarto === 0) esito.rate++; else scarti.set(scarto, (scarti.get(scarto) || 0) + 1);
      }
      for (const q of quote) if (righe[q.n - 1] && Math.abs(righe[q.n - 1].quotaPiano - q.quota_capitale) < 0.005) esito.quote++;
      esito.punti = esito.rate + esito.quote;
      // A parità di punti viene prima la combinazione più vicina alle regole già impostate.
      esito.giaImpostati = Object.entries(parametri).filter(([chiave, valore]) => base[chiave] === valore).length;
      risultati.push(esito);
      // Se più rate sbagliano tutte della stessa cifra, quella cifra sono spese per rata non (o mal) indicate:
      // si propone la stessa combinazione con le spese corrette.
      const [scarto, quante] = [...scarti].sort((a, b) => b[1] - a[1])[0] || [0, 0];
      const spese = centesimi((base.spese_rata || 0) + scarto / 100);
      if (parametri.spese_rata === undefined && quante >= 2 && quante > esito.rate && spese >= 0 && spese <= 50) {
        risultati.push({ ...esito, parametri: { ...parametri, spese_rata: spese }, rate: quante, punti: quante + esito.quote, giaImpostati: esito.giaImpostati - 1 });
      }
      return righe;
    }
    for (const rilevazione of rilevazioni) for (const mesi_revisione of variabile ? [1, 3, 6] : [base.mesi_revisione || 1]) for (const [conteggio_giorni] of REGOLE.conteggio_giorni) {
      const regole = { ...rilevazione, ...(variabile ? { mesi_revisione } : {}), conteggio_giorni };
      const provati = new Set();
      let prima = null, primaFrancese = null;
      for (const piano of piani) {
        const righe = prova({ ...piano, ...regole });
        if (piano.tipo_piano === 'quote_fisse') provati.add(Math.round(piano.tasso_annuo_piano * 1e5));
        else if (piano.tipo_piano === 'francese') { prima = righe[0]; primaFrancese = righe; }
      }
      // Dalla prima rata vera si ricava la quota capitale (rata − interessi − spese) e da quella il tasso
      // di un eventuale piano a quote fisse: così la taratura lo trova anche senza conoscerlo.
      const quoteFisse = candidato => { provati.add(candidato); return prova({ tipo_piano: 'quote_fisse', tasso_annuo_piano: candidato / 1e5, rata_piano: 0, ...regole }); };
      let righePiano = null;   // righe di un piano a quote fisse vicino a quello vero: danno gli interessi di ogni rata
      if (!variabile) continue;   // a tasso fisso le quote fissate all'inizio coincidono con la francese
      if (primaRata && prima && prima.origineEuribor !== 'previsione') {
        const tasso = tassoPianoDaQuota(base.importo_iniziale, base.numero_rate, 1, primaRata.rata_vera - centesimi(prima.interessi) - base.spese_rata);
        if (tasso != null) {
          for (const scarto of [0, -1, 1]) {
            const candidato = Math.round(tasso * 1e5) + scarto;
            if (candidato > 0 && !provati.has(candidato)) { const righe = quoteFisse(candidato); if (!scarto) righePiano = righe; }
          }
        }
      }
      // Né tasso del piano né spese sicuri: la crescita della quota capitale fra la prima e l'ultima rata vera non dipende
      // dalle spese e dà il tasso; poi si provano i tassi vicini, e le spese escono dallo scarto costante (vedi "prova").
      // Con il tasso giusto lo scarto fra rata vera e calcolata è lo stesso su tutte le rate (sono le spese); con un tasso
      // troppo basso lo scarto cresce di rata in rata, con uno troppo alto cala. Si cerca per dimezzamento il tasso
      // per cui la prima e l'ultima rata vera hanno lo stesso scarto.
      const conIndice = vere.filter(v => primaFrancese[v.n - 1] && primaFrancese[v.n - 1].origineEuribor !== 'previsione' && v.n <= base.numero_rate / 3);
      if (conIndice.length >= 2) {
        const a = conIndice[0], b = conIndice[conIndice.length - 1], rate = base.numero_rate;
        const deriva = annuo => {
          const righe = calcolaPiano({ ...dati, parametri: { ...base, ...regole, tipo_piano: 'quote_fisse', tasso_annuo_piano: annuo, rata_piano: 0 } }, pronti).righe;
          return (b.rata_vera - righe[b.n - 1].rataCalcolata) - (a.rata_vera - righe[a.n - 1].rataCalcolata);
        };
        // Limite alto della ricerca: oltre un certo tasso la crescita delle quote capitale torna a diminuire.
        const crescita = t => t * (Math.pow(1 + t, b.n - 1) - Math.pow(1 + t, a.n - 1)) / (Math.pow(1 + t, rate) - 1);
        let alto = 1e-6;
        while (alto < 0.02 && crescita(alto + 1e-5) > crescita(alto)) alto += 1e-5;
        let basso = 0.0005 / 12;
        if (deriva(basso * 12) > 0 && deriva(alto * 12) < 0) {
          for (let i = 0; i < 22; i++) { const medio = (basso + alto) / 2; if (deriva(medio * 12) > 0) basso = medio; else alto = medio; }
          // Gli arrotondamenti al centesimo lasciano un margine sul tasso, più largo se le rate sono vicine fra loro.
          const centro = Math.round((basso + alto) / 2 * 12 * 1e5);
          const margine = Math.min(40, Math.ceil(0.5 * 0.03 / (base.importo_iniziale * crescita(centro / 12e5)) * centro) + 2);
          for (let candidato = centro - margine; candidato <= centro + margine; candidato++) if (candidato > 0 && !provati.has(candidato)) quoteFisse(candidato);
        }
      }
    }
    // A parità di rate riprodotte si preferiscono spese "tonde" (le banche usano cifre come 1,50 o 2,50) e poi le regole già impostate.
    const speseDi = e => e.parametri.spese_rata !== undefined ? e.parametri.spese_rata : (base.spese_rata || 0);
    const tondo = e => { const c = Math.round(speseDi(e) * 100); return c % 50 === 0 ? 3 : c % 25 === 0 ? 2 : c % 5 === 0 ? 1 : 0; };
    risultati.sort((a, b) => b.punti - a.punti || a.senzaTasso - b.senzaTasso || tondo(b) - tondo(a) || b.giaImpostati - a.giaImpostati);
    // Con poche rate più combinazioni possono riprodurle tutte: si dice quante sono e in che intervallo cadono spese e tasso del piano,
    // perché scegliere fra loro richiede un dato in più (le spese, una quota capitale, o altre rate).
    const migliore = risultati[0];
    if (migliore && migliore.punti > 0) {
      const pari = risultati.filter(e => e.punti === migliore.punti && e.senzaTasso === migliore.senzaTasso);
      const spese = pari.map(speseDi), tassi = pari.filter(e => e.parametri.tipo_piano === 'quote_fisse').map(e => e.parametri.tasso_annuo_piano);
      const diverse = new Set(pari.map(e => [e.parametri.tipo_piano, e.parametri.tasso_annuo_piano || 0, speseDi(e)].join('|')));
      if (diverse.size > 1) migliore.dubbio = { combinazioni: diverse.size, speseDa: Math.min(...spese), speseA: Math.max(...spese),
        tassoDa: tassi.length ? Math.min(...tassi) : null, tassoA: tassi.length ? Math.max(...tassi) : null };
    }
    return risultati.slice(0, 8);
  }

  // Rata il cui periodo contiene la data indicata (null se fuori dal piano).
  const rataPerData = (righe, iso) => righe.find(r => r.inizio <= iso && iso <= r.fine) || null;

  return {
    calcolaPiano, tratti, conVariabile, tara, costi, taeg, fuoriDalTaeg, speseFuoriTaeg, tassoPianoDaQuota, REGOLE, rataPerData, rataFrancese, rataConMaxirata, arrotondaRata, centesimi, giornoLavorativo, giorniLavorativiContati, isoInGiorno, giornoInIso,
    pasqua, nomeFestivita, festivitaTarget, FESTE_TARGET, statistiche, puntoAl,
  };
});
