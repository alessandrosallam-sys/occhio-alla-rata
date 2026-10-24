// Deduzione: dalle rate pagate e da pochi dati del prestito (importo, numero di rate, data della prima rata) ricava da
// sola il resto: il tasso fisso (TAN) oppure indice e spread, le spese per rata, il tipo di piano, le regole con cui si
// legge e si aggiorna l'indice, il conteggio dei giorni. La usa la configurazione guidata: chi non conosce il contratto
// scrive solo quello che vede sull'estratto conto, e la pagina chiede altro solo se le rate non bastano.
// Come funziona. Per ogni combinazione di regole (giorno di partenza del primo periodo, versione dell'Euribor, giorno di
// rilevazione, ogni quanto si aggiorna il tasso, valore minimo dell'indice, conteggio dei giorni, tipo di piano) un
// calcolo veloce, che rifà i conti del motore senza i suoi dettagli, stima i numeri che riproducono meglio le rate:
// spread o TAN, spese per rata, tasso del piano. Poi si arrotondano come li scrivono le banche (spread e TAN al centesimo
// di punto, spese al centesimo di euro) e si contano le rate che tornano al centesimo; le spiegazioni migliori passano
// dal motore vero (calcolo.js), che ha l'ultima parola. Fra quelle che fanno tornare tutte le rate si preferiscono i
// numeri tondi e le regole più diffuse; se ne restano di diverse su un dato che conta (tasso, indice, spese…), lo dice
// in "differenze", e la pagina chiede all'utente proprio quel dato.
// Solo calcoli, senza pagina: gira anche in Node (per le prove).
(function (radice, crea) {
  if (typeof module === 'object' && module.exports) module.exports = crea(require('./calcolo.js'));
  else radice.Deduzione = crea(radice.Calcolo);
})(typeof self !== 'undefined' ? self : this, function (Calcolo) {
  'use strict';
  const MS_GIORNO = 86400000;
  const { centesimi } = Calcolo;
  const SPESE_MASSIME = 20;   // spese per rata più alte non si cercano
  // Spese per rata che le banche usano davvero (incasso rata, gestione pratica): multipli di 0,25 € fino a 5 €, di 0,50 €
  // fino a 10 €, poi euro interi. Servono quando le rate non separano le spese dal tasso (25 ottobre 2026, sezione 33).
  const SPESE_TONDE = [...Array.from({ length: 20 }, (_, i) => (i + 1) * 0.25), ...Array.from({ length: 10 }, (_, i) => 5.5 + i * 0.5),
    ...Array.from({ length: 10 }, (_, i) => 11 + i)];

  // Regole per leggere l'indice (le stesse della taratura) e quanto sono diffuse (0 = la più comune): a parità di rate
  // che tornano vince la più diffusa. Due giorni lavorativi prima è il giorno in cui l'Euribor viene fissato.
  const RILEVAZIONI = [
    [{ regola_rilevazione: 'lavorativi_prima', giorni_anticipo_euribor: 2 }, 0],
    [{ regola_rilevazione: 'ultimo_lavorativo' }, 1],
    [{ regola_rilevazione: 'media_mese' }, 1],
    ...[1, 3, 4].map(n => [{ regola_rilevazione: 'lavorativi_prima', giorni_anticipo_euribor: n }, 2]),
    [{ regola_rilevazione: 'primo_lavorativo' }, 2],
    ...[5, 6].map(n => [{ regola_rilevazione: 'lavorativi_prima', giorni_anticipo_euribor: n }, 3]),
  ];
  const CONTEGGI = { mese_12: 0, eff_365_366: 1, eff_360: 2, eff_365: 3 };
  const ARROTONDAMENTI = { centesimo: 0, dieci_su: 1, dieci: 1, euro_su: 1 };
  const PIANI = { francese: 0, quote_fisse: 1, italiana: 2 };
  // Versioni dell'Euribor usate nei mutui, con la loro durata in mesi: di solito il tasso si aggiorna con la stessa cadenza.
  const SERIE_MUTUI = { M01: 1, M03: 3, M06: 6, M12: 12 };
  // Ogni quanto si aggiorna il tasso: ogni mese, oppure con la durata dell'indice (Euribor 3 mesi ogni 3 mesi…).
  const revisioni = codice => SERIE_MUTUI[codice] === 1 ? [1] : [1, SERIE_MUTUI[codice]];
  // I dati su cui due spiegazioni delle stesse rate possono essere diverse in modo che conti: se succede, la pagina li
  // chiede all'utente, in quest'ordine. Le altre regole (giorno di rilevazione, conteggio dei giorni, arrotondamento
  // della rata…) si scelgono da sole: se cambiassero il tasso, se ne accorgerebbe già la domanda sul tasso.
  const DATI_CHIAVE = ['tipo_prestito', 'indice_nome', 'spread', 'tasso_fisso', 'spese_rata', 'tipo_piano', 'tasso_annuo_piano', 'mesi_revisione'];

  const variabile = tipo => tipo === 'variabile';
  // Decimali di un tasso scritto in percentuale (0,012 → 1,2% → 1): le banche ne usano due, a volte tre.
  function decimali(v) {
    const p = Math.round(v * 1e9) / 1e7;
    for (let d = 0; d <= 5; d++) if (Math.abs(p * 10 ** d - Math.round(p * 10 ** d)) < 1e-6) return d;
    return 6;
  }
  // Quanto è «tonda» una cifra di spese: 0 o multipli di 0,50 (3), di 0,25 (2), di 0,05 (1), altro (0).
  const tondo = v => { const c = Math.round(v * 100); return c % 50 === 0 ? 3 : c % 25 === 0 ? 2 : c % 5 === 0 ? 1 : 0; };
  const pulito = v => Math.round(v * 1e9) / 1e9;
  // Le banche scrivono spread e TAN con due decimali (1,20%), a volte tre: il valore al centesimo di punto, i due vicini
  // e il valore al millesimo.
  function arrotondati(v) {
    const c = Math.round(v * 1e4) / 1e4;
    return [...new Set([c, c - 1e-4, c + 1e-4, Math.round(v * 1e5) / 1e5].map(pulito))];
  }

  // Giorni di ogni periodo e dell'anno in cui finisce, come nel motore, a partire dal primo giorno "data" (ISO).
  function periodi(data, quanti) {
    const [a, m, g] = data.split('-').map(Number), giorno = n => Date.UTC(a, m - 1 + n - 1, g) / MS_GIORNO;
    return Array.from({ length: quanti }, (_, i) => {
      const inizio = giorno(i + 1), fine = giorno(i + 2) - 1;
      return { giorni: fine - inizio + 1, anno: 365 + (new Date(fine * MS_GIORNO).getUTCFullYear() % 4 ? 0 : 1) };
    });
  }
  // Parte d'anno su cui si pagano gli interessi di ogni periodo, secondo il conteggio dei giorni.
  const frazioni = (lista, conteggio) => Float64Array.from(lista, p => conteggio === 'mese_12' ? 1 / 12
    : p.giorni / (conteggio === 'eff_365_366' ? p.anno : conteggio === 'eff_365' ? 365 : 360));

  // ---------- Il calcolo veloce ----------
  // "c" = il prestito ridotto all'osso: importo P, rate totali N (maxirata compresa) e normali Nn, maxirata M, quante
  // righe servono (fino), posizione (k) e importo (r) delle rate vere, quote capitale scritte (quote, manuali), e per la
  // combinazione in prova l'indice applicato (x) e la parte d'anno (f) di ogni periodo.
  // Rate calcolate (interessi + quota capitale, senza spese e senza arrotondare) per le rate vere, e quota capitale
  // del piano dove l'utente l'ha scritta. "piano": 'francese' (ricalcolata ogni mese), 'italiana', 'fissato' (quote
  // fissate all'inizio al tasso tp, con rata costante "rataPiano": le quote fisse del variabile e il tasso fisso).
  function simula(c, piano, theta, tp, rataPiano) {
    const m = c.k.length, rate = new Float64Array(m), quote = new Float64Array(c.quote.length);
    const italiana = centesimi(c.P / c.N);
    let D = c.P, dp = c.P, j = 0, h = 0;
    for (let i = 0; i < c.fino; i++) {
      const res = c.N - i, tasso = c.x[i] + theta;
      let qp;
      if (piano === 'fissato') {
        qp = res === 1 ? dp : c.M && res === 2 ? Math.max(0, centesimi(dp - centesimi(c.M / (1 + tp / 12)))) : Math.min(dp, centesimi(rataPiano - centesimi(dp * tp / 12)));
        dp = centesimi(dp - qp);
      } else if (piano === 'italiana') qp = italiana;
      else { const t = tasso / 12; qp = centesimi(t > 1e-12 ? D * t / (Math.pow(1 + t, res) - 1) : D / res); }
      // Una quota capitale scritta a mano il motore la usa per il debito: qui lo stesso.
      const qc = c.manuali[i] != null ? c.manuali[i] : res === 1 ? D : Math.min(D, qp);
      if (h < c.quote.length && c.quote[h].i === i) quote[h++] = qp;
      if (j < m && c.k[j] === i) rate[j++] = tasso * D * c.f[i] + qc;
      D -= qc;
    }
    return { rate, quote };
  }
  // Debito e quota capitale di ogni rata vera quando non dipendono dal tasso (piano fissato o all'italiana).
  function percorso(c, piano, tp, rataPiano) {
    const salva = c.x, f = c.f;
    c.x = new Float64Array(c.fino); c.f = new Float64Array(c.fino).fill(1);   // con tasso 1 e indice 0 la "rata" è debito + quota
    const conDebito = simula(c, piano, 1, tp, rataPiano).rate, senza = simula(c, piano, 0, tp, rataPiano).rate;
    c.x = salva; c.f = f;
    return { D: conDebito.map((v, j) => v - senza[j]), qc: senza };
  }

  // Le stime sono «robuste»: una rata scritta male (o con un addebito in più quel mese) non deve spostare i numeri e
  // nascondere la combinazione giusta. Per questo si usano la mediana al posto della media, nelle ricerche la somma
  // dei quadrati degli scarti senza il quarto peggiore e, nei minimi quadrati, una seconda passata senza le rate che
  // si discostano troppo.
  function senzaPeggiori(quadrati) {
    const o = Float64Array.from(quadrati).sort(), tenuti = Math.max(1, Math.ceil(o.length * 0.75));
    let s = 0;
    for (let i = 0; i < tenuti; i++) s += o[i];
    return s;
  }
  function mediana(valori) {
    const o = Float64Array.from(valori).sort(), h = o.length >> 1;
    return o.length % 2 ? o[h] : (o[h - 1] + o[h]) / 2;
  }
  // Errore medio fra rate stimate e vere senza il quarto peggiore, e somma dei quadrati di tutti gli scarti.
  function errori(scarti) {
    const quadrati = Float64Array.from(scarti, e => e * e).sort();
    const tenuti = Math.max(1, Math.ceil(quadrati.length * 0.75));
    let somma = 0, tutti = 0;
    quadrati.forEach((v, i) => { tutti += v; if (i < tenuti) somma += v; });
    return { errore: Math.sqrt(somma / tenuti), rss: tutti };
  }
  // Rate vere utilizzabili con questa combinazione: quelle con il valore dell'indice.
  const usabili = c => c.k.map((i, j) => j).filter(j => c.valide[j]);

  // Piano ricalcolato alla francese, o piano fissato del tasso fisso: le rate crescono con theta (spread o TAN), ma non
  // in modo lineare. Con le spese note si cerca theta per dimezzamento, finché la rata stimata «di mezzo» (mediana) è
  // uguale a quella vera. Con le spese da trovare si cerca il theta per cui lo scarto fra rate vere e stimate è lo
  // stesso su tutte: quello scarto costante sono le spese. Se le rate non bastano a separare spese e theta (rata
  // sempre uguale, oppure poche rate) si suppongono spese zero, e "separate" lo dice.
  function adatta(stima, c, spese, basso, alto) {
    const js = usabili(c);
    if (!js.length) return null;
    const scarti = th => { const v = stima(th); return js.map(j => c.r[j] - v[j]); };   // vere − stimate
    const trova = s => {
      let a = basso, b = alto;
      if (mediana(scarti(a)) < s || mediana(scarti(b)) > s) return null;
      for (let i = 0; i < 32; i++) { const medio = (a + b) / 2; if (mediana(scarti(medio)) < s) b = medio; else a = medio; }
      return (a + b) / 2;
    };
    // Dispersione degli scarti attorno alla loro mediana (che sarebbero le spese).
    const dispersione = th => { const d = scarti(th), m = mediana(d); return { q: senzaPeggiori(d.map(x => (x - m) ** 2)), m }; };
    const chiudi = (th, s, separate) => ({ theta: th, spese: s, separate, ...errori(scarti(th).map(x => s - x)) });
    if (spese != null) { const th = trova(spese); return th == null ? null : chiudi(th, spese, true); }
    const senzaSpese = trova(0);
    if (senzaSpese == null) return null;
    // Inseparabili: oltre alla stima con spese zero, «perSpese» dà il theta che va con certe spese (registra prova le tonde).
    const inseparabili = () => ({ ...chiudi(senzaSpese, 0, false), perSpese: trova });
    if (js.length < 3) return inseparabili();
    // Dove sarebbe theta con le spese più alte: le rate stimate crescono con theta in modo quasi lineare.
    const v0 = stima(senzaSpese), v1 = stima(senzaSpese + 1e-4);
    const pendenza = js.reduce((t, j) => t + v1[j] - v0[j], 0) / js.length / 1e-4;
    if (!(pendenza > 0)) return inseparabili();
    const conSpese = Math.max(basso, senzaSpese - SPESE_MASSIME / pendenza);
    const d0 = dispersione(senzaSpese), dMezzo = dispersione((senzaSpese + conSpese) / 2), dSpese = dispersione(conSpese);
    const soglia = js.length * 2.5e-5;   // mezzo centesimo di scarto medio: sotto, sono gli arrotondamenti
    // La dispersione cresce come il quadrato della distanza dal theta giusto: dalla sua curvatura si vede di quanto
    // cambierebbero le rate, l'una rispetto all'altra, spostando theta di un centesimo di punto. Se meno di un centesimo
    // di euro, spese e theta non si distinguono (rata sempre uguale, o rate troppo vicine fra loro).
    const h = (senzaSpese - conSpese) / 2, curvatura = (dSpese.q - 2 * dMezzo.q + d0.q) / (2 * h * h);
    if (!(curvatura * 1e-8 >= js.length * 1e-4)) return inseparabili();
    // Senza spese i conti tornano già: spese zero.
    if (d0.q < soglia) return chiudi(senzaSpese, 0, true);
    // Sezione aurea sulla dispersione degli scarti.
    const oro = (Math.sqrt(5) - 1) / 2;
    let a = conSpese, b = senzaSpese, x1 = b - oro * (b - a), x2 = a + oro * (b - a), f1 = dispersione(x1).q, f2 = dispersione(x2).q;
    for (let i = 0; i < 28; i++) {
      if (f1 < f2) { b = x2; x2 = x1; f2 = f1; x1 = b - oro * (b - a); f1 = dispersione(x1).q; }
      else { a = x1; x1 = x2; f1 = f2; x2 = a + oro * (b - a); f2 = dispersione(x2).q; }
    }
    const th = (a + b) / 2, minimo = dispersione(th);
    return minimo.m < 0 ? chiudi(senzaSpese, 0, true) : chiudi(th, minimo.m, true);
  }
  // Theta già noto (scritto dall'utente): restano solo le spese, che sono lo scarto «di mezzo» fra rate vere e stimate.
  function conTheta(stima, c, theta, spese) {
    const js = usabili(c);
    if (!js.length) return null;
    const v = stima(theta), s = spese ?? Math.max(0, mediana(js.map(j => c.r[j] - v[j])));
    return { theta, spese: s, separate: true, ...errori(js.map(j => v[j] + s - c.r[j])) };
  }
  // Piano fissato o all'italiana: debito e quota capitale non dipendono da theta, quindi gli interessi sono lineari:
  // rata − quota − debito × indice × frazione = theta × debito × frazione + spese. Minimi quadrati, rifatti una volta
  // senza le rate che si discostano troppo dalle altre. "rapido": solo la somma dei quadrati degli scarti (limitati),
  // per la ricerca del tasso del piano.
  function lineare(c, via, spese, thetaNoto, rapido = false) {
    const js = usabili(c);
    if (!js.length) return null;
    const n = js.length, a = new Float64Array(n), y = new Float64Array(n);
    js.forEach((j, h) => { const i = c.k[j]; a[h] = via.D[j] * c.f[i]; y[h] = c.r[j] - via.qc[j] - a[h] * c.x[i]; });
    // Le spese si separano da theta solo se il peso degli interessi cambia abbastanza fra una rata e l'altra: spostando
    // theta di un centesimo di punto le rate devono cambiare, l'una rispetto all'altra, di almeno un centesimo di euro.
    let sa = 0, saa = 0;
    for (let h = 0; h < n; h++) { sa += a[h]; saa += a[h] * a[h]; }
    const separabili = spese == null && thetaNoto == null && n >= 3 && (saa - sa * sa / n) * 1e-8 >= n * 1e-4;
    const stima = tenute => {
      let sa = 0, sy = 0, k = 0;
      for (let h = 0; h < n; h++) if (tenute[h]) { sa += a[h]; sy += y[h]; k++; }
      const ma = sa / k, my = sy / k;
      let theta = thetaNoto, s, separate = !separabili ? spese != null || thetaNoto != null : true;
      if (thetaNoto != null) s = spese ?? Math.max(0, my - thetaNoto * ma);
      else if (separabili) {
        let sxy = 0, sxx = 0;
        for (let h = 0; h < n; h++) if (tenute[h]) { sxy += (a[h] - ma) * (y[h] - my); sxx += (a[h] - ma) ** 2; }
        theta = sxy / sxx; s = my - theta * ma;
        if (s < 0) s = 0;   // spese negative: le rate dicono che non ce ne sono
      }
      if (theta == null) {
        s = spese ?? 0; separate = spese != null;
        let sxy = 0, sxx = 0;
        for (let h = 0; h < n; h++) if (tenute[h]) { sxy += a[h] * (y[h] - s); sxx += a[h] * a[h]; }
        theta = sxy / sxx;
      }
      return { theta, s: Math.max(0, s), separate };
    };
    let tenute = new Uint8Array(n).fill(1), e = stima(tenute);
    const scarti = () => Float64Array.from(a, (v, h) => e.theta * v + e.s - y[h]);
    // Seconda passata senza le rate lontane (al massimo un quarto): una rata scritta male non sposta più i numeri.
    // La somma dei quadrati per la ricerca del tasso del piano conta solo le rate tenute.
    if (n >= 4) {
      const assoluti = scarti().map(Math.abs), tolleranza = Math.max(0.05, 4 * mediana(assoluti));
      const fuori = [...assoluti.keys()].filter(h => assoluti[h] > tolleranza).sort((p, q) => assoluti[q] - assoluti[p]).slice(0, Math.floor(n / 4));
      if (fuori.length) { for (const h of fuori) tenute[h] = 0; e = stima(tenute); }
    }
    const risultato = { theta: e.theta, spese: e.s, separate: e.separate };
    // Inseparabili: theta per spese date, con i minimi quadrati sulle rate tenute (rata − spese = theta × peso).
    if (!e.separate && spese == null && thetaNoto == null) risultato.perSpese = sp => {
      let sxy = 0, sxx = 0;
      for (let h = 0; h < n; h++) if (tenute[h]) { sxy += a[h] * (y[h] - sp); sxx += a[h] * a[h]; }
      return sxx > 0 ? sxy / sxx : null;
    };
    if (rapido) { let rss = 0; scarti().forEach((x, h) => { if (tenute[h]) rss += x * x; }); return { ...risultato, rss }; }
    return { ...risultato, ...errori(scarti()) };
  }
  // Quote fissate all'inizio al tasso del piano, che non si conosce: si prova una griglia di tassi e si affina il
  // migliore. Quote e debito dipendono solo dal tasso del piano: "cache" li tiene per tutte le combinazioni di regole.
  // Con poche rate il tasso del piano non si ricava: si suppone quello del primo periodo (indice + spread), che è di
  // solito quello del giorno della firma.
  function quoteFisse(c, spese, cache, tpNoti, thetaNoto) {
    const prova = (tp, rapido = true) => { const l = lineare(c, cache(tp), spese, thetaNoto, rapido); return l && { ...l, tp }; };
    if (tpNoti.length) return tpNoti.map(tp => prova(tp, false)).filter(Boolean).sort((a, b) => a.rss - b.rss)[0] || null;
    const js = usabili(c);
    if (js.length < (spese == null && thetaNoto == null ? 4 : 3)) {
      let l = prova(Math.max(0.0005, c.x[0] + (thetaNoto ?? 0.012)), false);
      for (let i = 0; l && thetaNoto == null && i < 4; i++) l = prova(Math.max(0.0005, c.x[0] + l.theta), false);
      return l && { ...l, tpDalPrimo: true };
    }
    // Griglia a due passi (un quarto di punto, poi mezzo decimo attorno al migliore) e sezione aurea per finire.
    let migliore = null;
    const griglia = (da, a, passo) => { for (let tp = da; tp <= a + 1e-9; tp += passo) { const l = prova(tp); if (l && (!migliore || l.rss < migliore.rss)) migliore = l; } };
    griglia(0.0025, 0.12, 0.0025);
    if (!migliore) return null;
    griglia(Math.max(0.0005, migliore.tp - 0.0025), migliore.tp + 0.0025, 0.0005);
    const oro = (Math.sqrt(5) - 1) / 2;
    let a = Math.max(1e-5, migliore.tp - 0.0005), b = migliore.tp + 0.0005, x1 = b - oro * (b - a), x2 = a + oro * (b - a), f1 = prova(x1).rss, f2 = prova(x2).rss;
    for (let i = 0; i < 30; i++) {
      if (f1 < f2) { b = x2; x2 = x1; f2 = f1; x1 = b - oro * (b - a); f1 = prova(x1).rss; }
      else { a = x1; x1 = x2; f1 = f2; x2 = a + oro * (b - a); f2 = prova(x2).rss; }
    }
    return prova((a + b) / 2, false);
  }

  // Quante rate (e quote capitale) tornano al centesimo con i numeri arrotondati. Con le spese da trovare, le spese
  // sono lo scarto più frequente fra rata vera e calcolata (come nella taratura); se non si possono separare dal tasso,
  // zero.
  function conta(c, piano, theta, tp, rataPiano, spese) {
    const { rate, quote } = simula(c, piano, theta, tp, rataPiano), js = usabili(c);
    let scelte = spese;
    if (scelte == null) {
      const scarti = new Map();
      for (const j of js) { const d = Math.round((c.r[j] - centesimi(rate[j])) * 100); scarti.set(d, (scarti.get(d) || 0) + 1); }
      const [scarto] = [...scarti].sort((a, b) => b[1] - a[1] || Math.abs(a[0]) - Math.abs(b[0]))[0] || [0];
      scelte = scarto >= 0 && scarto <= SPESE_MASSIME * 100 ? scarto / 100 : 0;
    }
    let giuste = 0;
    for (const j of js) if (Math.round((c.r[j] - centesimi(rate[j] + scelte)) * 100) === 0) giuste++;
    let quoteGiuste = 0;
    c.quote.forEach((q, h) => { if (Math.abs(quote[h] - q.valore) < 0.005) quoteGiuste++; });
    return { spese: scelte, rate: giuste, quote: quoteGiuste, senza: c.k.length - js.length };
  }

  // ---------- La ricerca ----------
  // ingresso = { base: { importo_iniziale, numero_rate, maxirata }, tipi: tipi di prestito da provare,
  //   date: giorni possibili di inizio del primo periodo (ISO), dal più probabile, rate: [{ n, rata_vera, quota_capitale }],
  //   serie: [{ codice, nome, valori: [{ giorno, tasso_360 }] }] (Euribor disponibili), noti: dati già sicuri
  //   (scritti dall'utente: tasso_fisso, indice_nome, spread, spese_rata, regole…), predefiniti: parametri iniziali }.
  // Generatore: restituisce l'avanzamento a ogni pezzo di lavoro e, alla fine, il risultato (vedi "risultato").
  function* analizza(ingresso) {
    const { base, noti = {} } = ingresso;
    const vere = ingresso.rate.filter(r => r.rata_vera > 0).sort((a, b) => a.n - b.n);
    const scritte = ingresso.rate.filter(r => r.quota_capitale > 0).sort((a, b) => a.n - b.n);
    if (!vere.length) return { esito: 'senza-rate', candidati: [], differenze: [], totale: 0 };
    const fino = Math.max(...vere.map(r => r.n), ...scritte.map(r => r.n));
    const tipi = noti.tipo_prestito ? [noti.tipo_prestito] : ingresso.tipi;
    const fissi = tipi.filter(t => !variabile(t));
    const serie = (ingresso.serie || []).filter(s => SERIE_MUTUI[s.codice] && (!noti.indice_nome || s.nome === noti.indice_nome));
    // Le scelte da provare per una regola: tutte, oppure solo quella che l'utente ha indicato.
    const ammessi = (chiave, valori) => noti[chiave] != null ? [noti[chiave]] : valori;
    const conRegola = ([regola]) => (noti.regola_rilevazione == null || regola.regola_rilevazione === noti.regola_rilevazione)
      && (noti.regola_rilevazione !== 'lavorativi_prima' || noti.giorni_anticipo_euribor == null || regola.giorni_anticipo_euribor === noti.giorni_anticipo_euribor);
    const rilevazioni = RILEVAZIONI.filter(conRegola);
    const date = [...new Set(ingresso.date)];
    const totale = date.length * (fissi.length + (tipi.includes('variabile') && serie.length ? rilevazioni.length : 0));
    let fatto = 0;
    const trovati = [];
    const migliore = { errore: Infinity };   // la combinazione più vicina, anche se non torna niente (per dire cosa non va)

    // Il prestito ridotto all'osso, uguale per tutte le combinazioni (cambiano solo x e f).
    const contesto = (M, n) => {
      const k = vere.map(r => r.n - 1), manuali = new Array(fino).fill(null);
      for (const q of scritte) manuali[q.n - 1] = q.quota_capitale;
      return { P: base.importo_iniziale, N: n, Nn: base.numero_rate, M, fino, k, r: vere.map(r => r.rata_vera), quote: scritte.map(q => ({ i: q.n - 1, valore: q.quota_capitale })),
        manuali, valide: k.map(() => true), x: new Float64Array(fino), f: null };
    };
    // Una combinazione stimata: si ricorda se è la più vicina finora e, se l'errore è abbastanza piccolo da poter
    // tornare, si contano le rate giuste con i numeri arrotondati. "theta" è lo spread (variabile) o il TAN (fisso).
    // Quando le rate non separano theta dalle spese, una quota capitale scritta lo fa: la quota dipende da theta e non
    // dalle spese. Allora si provano anche gli spread (o i TAN) più bassi, fino a 25 centesimi di punto, ciascuno con le
    // sue spese, e decidono le quote.
    const conQuote = scritte.length > 0 && noti.spese_rata == null;
    const registra = (t, prova, thetaNoto, contaCon, tpDi) => {
      if (prova.errore < migliore.errore) Object.assign(migliore, t, { errore: prova.errore, theta: prova.theta, spese: prova.spese, tp: prova.tp || 0 });
      if (prova.errore > 2) return;
      const allargati = !prova.separate && conQuote && thetaNoto == null;
      const candidati = thetaNoto != null ? [thetaNoto] : allargati
        ? Array.from({ length: 27 }, (_, i) => pulito(Math.round(prova.theta * 1e4) / 1e4 + (1 - i) * 1e-4)) : arrotondati(prova.theta);
      for (const theta of candidati) {
        for (const tp of tpDi ? tpDi(theta, prova) : [0]) {
          const esito = contaCon(theta, tp, prova.separate || allargati ? noti.spese_rata : (noti.spese_rata ?? 0));
          if (esito.rate + esito.quote > 0) trovati.push({ ...t, theta, tp, ...esito, separate: prova.separate || (allargati && esito.quote === scritte.length) });
        }
      }
      // Rate che non separano il tasso dalle spese: con spese zero il tasso arrotondato di solito non fa tornare le rate,
      // e prima la guida si arrendeva (un mutuo fisso con le spese di incasso: rate tutte uguali). Si provano allora le
      // spese tonde, ciascuna con il suo tasso arrotondato, e si tengono quelle che fanno tornare tutte le rate. Restano
      // «non separate»: la pagina chiede comunque il tasso, ma propone quello giusto. Non per le quote fisse (tpDi), dove
      // ogni prova costa troppo.
      // Nel variabile le combinazioni sono centinaia: solo quelle che con spese zero quasi tornano (scarto medio sotto i 2
      // centesimi); le altre (un'altra versione dell'Euribor, un altro giorno di rilevazione) non tornerebbero nemmeno con
      // le spese giuste. A tasso fisso le combinazioni sono poche, e nel piano all'italiana con spese lo scarto con spese
      // zero resta alto anche con le regole giuste: lì si provano sempre.
      if (!prova.separate && !allargati && prova.perSpese && (prova.errore < 0.02 || !variabile(t.tipo)) && thetaNoto == null && noti.spese_rata == null && !tpDi) {
        for (const sp of SPESE_TONDE) {
          const th = prova.perSpese(sp);
          if (th == null || !Number.isFinite(th)) continue;
          for (const theta of arrotondati(th)) {
            const esito = contaCon(theta, 0, sp);
            if (esito.rate + esito.senza === vere.length && esito.quote === scritte.length) trovati.push({ ...t, theta, tp: 0, ...esito, separate: false });
          }
        }
      }
    };

    for (const [d, data] of date.entries()) {
      const lista = periodi(data, fino);
      const frazioniDi = {};
      for (const conteggio of Object.keys(CONTEGGI)) frazioniDi[conteggio] = frazioni(lista, conteggio);

      // --- Tasso fisso: mutuo fisso, finanziamento, maxirata ---
      for (const tipo of fissi) {
        const M = tipo === 'maxirata' && base.maxirata > 0 && base.maxirata < base.importo_iniziale ? base.maxirata : 0;
        const c = contesto(M, base.numero_rate + (M ? 1 : 0)), viaItaliana = percorso(c, 'italiana', 0, 0);
        for (const conteggio of ammessi('conteggio_giorni', Object.keys(CONTEGGI))) {
          c.f = frazioniDi[conteggio];
          for (const piano of ammessi('tipo_piano', M ? ['francese'] : ['francese', 'italiana'])) {
            for (const arrotonda of piano === 'italiana' ? ['centesimo'] : ammessi('arrotonda_rata', Object.keys(ARROTONDAMENTI))) {
              const rataDi = tan => Calcolo.arrotondaRata(Calcolo.rataConMaxirata(c.P, tan / 12, c.Nn, M), arrotonda);
              const stima = th => simula(c, 'fissato', th, th, rataDi(th)).rate;
              const prova = piano === 'italiana' ? lineare(c, viaItaliana, noti.spese_rata, noti.tasso_fisso)
                : noti.tasso_fisso != null ? conTheta(stima, c, noti.tasso_fisso, noti.spese_rata) : adatta(stima, c, noti.spese_rata, 0, 0.4);
              if (!prova) continue;
              const contaCon = piano === 'italiana' ? (theta, tp, spese) => conta(c, 'italiana', theta, 0, 0, spese)
                : (theta, tp, spese) => conta(c, 'fissato', theta, theta, rataDi(theta), spese);
              registra({ tipo, data, d, conteggio, piano: piano === 'italiana' ? 'italiana' : 'francese', arrotonda }, prova, noti.tasso_fisso, contaCon);
            }
          }
        }
        // L'avanzamento dice anche che cosa si è appena provato (la pagina lo racconta mentre aspetta).
        yield { fatto: ++fatto, totale, tipo, data };
      }

      // --- Tasso variabile: indice + spread ---
      if (!tipi.includes('variabile') || !serie.length) continue;
      const pronti = { festivita: new Set(festivitaPer(data, base.numero_rate).map(Calcolo.isoInGiorno)), tassi: new Map(), fino };
      const c = contesto(0, base.numero_rate), viaItaliana = percorso(c, 'italiana', 0, 0);
      const valori = serie.map(valoriDi);
      // Quote e debito del piano fissato all'inizio dipendono solo dal suo tasso: si tengono per tutte le combinazioni.
      const cacheQuote = new Map();
      const quoteAl = tp => {
        const chiave = Math.round(tp * 1e9);
        if (!cacheQuote.has(chiave)) cacheQuote.set(chiave, percorso(c, 'fissato', tp, tp > 0 ? centesimi(Calcolo.rataFrancese(c.P, tp / 12, c.N)) : 0));
        return cacheQuote.get(chiave);
      };
      const rataPianoAl = tp => tp > 0 ? centesimi(Calcolo.rataFrancese(c.P, tp / 12, c.N)) : 0;
      // Tassi del piano già sicuri: scritti dall'utente, o ricavati da una quota capitale scritta nelle prime rate.
      const tpNoti = noti.tasso_annuo_piano > 0 ? [noti.tasso_annuo_piano]
        : [...new Set(scritte.map(q => Calcolo.tassoPianoDaQuota(c.P, c.N, q.n, q.quota_capitale)).filter(t => t != null))];
      // Tassi del piano da provare per uno spread arrotondato: quello stimato e i vicini; con poche rate quello del
      // primo periodo (indice + spread).
      // Con lo spread arrotondato il tasso del piano si ricava molto meglio: si rifà la ricerca con lo spread fisso.
      const tpDi = (theta, prova) => {
        if (tpNoti.length) return tpNoti;
        if (prova.tpDalPrimo) return [Math.max(1e-5, Math.round((c.x[0] + theta) * 1e5) / 1e5)];
        // Con poche rate resta un margine: si provano i tassi vicini, più lontano quando le rate sono meno di otto.
        const conTheta = quoteFisse(c, noti.spese_rata, quoteAl, [], theta), centro = Math.round((conTheta ? conTheta.tp : prova.tp) * 1e5);
        const margine = usabili(c).length < 8 ? 12 : 3;
        return Array.from({ length: 2 * margine + 1 }, (_, i) => (centro + i - margine) / 1e5).filter(v => v > 0);
      };
      for (const [regola, rango] of rilevazioni) {
        const giorni = Calcolo.calcolaPiano({ parametri: { ...ingresso.predefiniti, ...base, tipo_prestito: 'variabile', data_prima_rata: data, ...regola, mesi_revisione: 1 },
          rate: [], euribor: [], festivita: [] }, pronti).righe.map(r => r.riferimento);
        valori.forEach((v, h) => {
          const s = serie[h];
          const grezzi = giorni.map(g => (regola.regola_rilevazione === 'media_mese' ? v.mese.get(g.slice(0, 7)) : v.giorno.get(g)) ?? null);
          for (const revisione of ammessi('mesi_revisione', revisioni(s.codice))) {
            const perRata = grezzi.map((_, i) => grezzi[i - (i % revisione)]);
            for (const floor of ammessi('floor_attivo', perRata.some(x => x < 0) ? [0, 1] : [0])) {
              // Indice applicato; dove manca il valore si tiene l'ultimo noto, ma quella rata non si confronta.
              let ultimo = perRata.find(x => x != null) ?? 0;
              c.x = Float64Array.from(perRata, x => { if (x != null) ultimo = floor ? Math.max(x, noti.indice_minimo || 0) : x; return ultimo; });
              c.valide = c.k.map(i => perRata[i] != null);
              for (const conteggio of ammessi('conteggio_giorni', Object.keys(CONTEGGI))) {
                c.f = frazioniDi[conteggio];
                const comune = { tipo: 'variabile', data, d, codice: s.codice, nomeSerie: s.nome, regola, rango, revisione, floor, conteggio };
                for (const piano of ammessi('tipo_piano', Object.keys(PIANI))) {
                  let prova, contaCon;
                  if (piano === 'francese') {
                    const stima = th => simula(c, 'francese', th).rate;
                    prova = noti.spread != null ? conTheta(stima, c, noti.spread, noti.spese_rata) : adatta(stima, c, noti.spese_rata, -0.05, 0.15);
                    contaCon = (theta, tp, spese) => conta(c, 'francese', theta, 0, 0, spese);
                  } else if (piano === 'italiana') {
                    prova = lineare(c, viaItaliana, noti.spese_rata, noti.spread);
                    contaCon = (theta, tp, spese) => conta(c, 'italiana', theta, 0, 0, spese);
                  } else {
                    prova = quoteFisse(c, noti.spese_rata, quoteAl, tpNoti, noti.spread);
                    contaCon = (theta, tp, spese) => conta(c, 'fissato', theta, tp, rataPianoAl(tp), spese);
                  }
                  if (prova) registra({ ...comune, piano }, prova, noti.spread, contaCon, piano === 'quote_fisse' ? tpDi : null);
                }
              }
            }
          }
        });
        yield { fatto: ++fatto, totale, tipo: 'variabile', data, regola, serie: serie.length };
      }
    }
    return risultato(ingresso, trovati, migliore, vere, scritte, fino);
  }

  // Festività TARGET degli anni del prestito (come in archivio.js), per il motore.
  function festivitaPer(data, rate) {
    const primo = +data.slice(0, 4) - 1, ultimo = primo + Math.ceil(rate / 12) + 2, lista = [];
    for (let anno = primo; anno <= ultimo; anno++) lista.push(...Calcolo.festivitaTarget(anno));
    return lista;
  }
  // Valori di una serie per giorno e media di ogni mese (per chi usa la media del mese precedente).
  const memoriaValori = new WeakMap();
  function valoriDi(serie) {
    if (memoriaValori.has(serie)) return memoriaValori.get(serie);
    const giorno = new Map(), somme = new Map();
    for (const t of serie.valori) {
      giorno.set(t.giorno, t.tasso_360);
      const mese = t.giorno.slice(0, 7), s = somme.get(mese) || [0, 0];
      s[0] += t.tasso_360; s[1]++; somme.set(mese, s);
    }
    const esito = { giorno, mese: new Map([...somme].map(([m, [s, n]]) => [m, s / n])) };
    memoriaValori.set(serie, esito);
    return esito;
  }

  // Parametri del prestito per una spiegazione trovata.
  function parametri(t) {
    const p = { tipo_prestito: t.tipo, data_prima_rata: t.data, conteggio_giorni: t.conteggio, tipo_piano: t.piano, spese_rata: t.spese };
    if (variabile(t.tipo)) {
      Object.assign(p, { indice_nome: t.nomeSerie, spread: t.theta, ...t.regola, mesi_revisione: t.revisione, floor_attivo: t.floor, indice_minimo: 0,
        tasso_annuo_piano: t.piano === 'quote_fisse' ? t.tp : 0, rata_piano: 0 });
    } else Object.assign(p, { tasso_fisso: t.theta, arrotonda_rata: t.arrotonda });
    return p;
  }
  // Quanto una spiegazione è insolita (0 = la più comune): serve a scegliere fra spiegazioni che fanno tornare le
  // stesse rate. Contano i numeri tondi (spread e TAN con due decimali, spese tonde) e le regole più diffuse.
  function insolito(t) {
    let n = Math.max(0, decimali(t.theta) - 2) * 2 + (3 - tondo(t.spese)) + CONTEGGI[t.conteggio] + t.d + PIANI[t.piano];
    if (variabile(t.tipo)) n += t.rango + (t.revisione === SERIE_MUTUI[t.codice] ? 0 : t.revisione === 1 ? 1 : 2) + t.floor + 1;
    else n += ARROTONDAMENTI[t.arrotonda];
    return n;
  }

  // Il motore vero ricontrolla le spiegazioni migliori: rate che tornano, che non tornano (con l'importo calcolato) e
  // senza valore dell'indice.
  function controlla(ingresso, t, vere, scritte, fino) {
    const s = variabile(t.tipo) ? ingresso.serie.find(x => x.codice === t.codice) : null;
    const dati = { parametri: { ...ingresso.predefiniti, ...ingresso.base, ...parametri(t) },
      rate: ingresso.rate.map(r => ({ n: r.n, rata_vera: r.rata_vera > 0 ? r.rata_vera : null, quota_capitale: r.quota_capitale > 0 ? r.quota_capitale : null,
        rata_copiata: null, tasso_applicato: null, euribor: null, spread: null, data_riferimento: null })),
      euribor: s ? s.valori : [], festivita: festivitaPer(t.data, ingresso.base.numero_rate + 1) };
    if (!variabile(t.tipo)) dati.parametri.maxirata = t.tipo === 'maxirata' ? ingresso.base.maxirata : 0;
    const righe = Calcolo.calcolaPiano(dati, { fino, tassi: s ? valoriDi(s).giorno : new Map() }).righe;
    const esito = { rate: 0, quote: 0, senza: 0, sbagliate: [] };
    for (const v of vere) {
      const r = righe[v.n - 1];
      if (r.origineEuribor === 'previsione') esito.senza++;
      else if (Math.round((v.rata_vera - r.rataCalcolata) * 100) === 0) esito.rate++;
      else esito.sbagliate.push({ n: v.n, vera: v.rata_vera, calcolata: r.rataCalcolata });
    }
    for (const q of scritte) if (Math.abs(righe[q.n - 1].quotaPiano - q.quota_capitale) < 0.005) esito.quote++;
    return esito;
  }

  // Da tutte le spiegazioni trovate: le migliori, l'esito e i dati su cui restano diverse.
  function risultato(ingresso, trovati, migliore, vere, scritte, fino) {
    const ordine = (a, b) => b.punti - a.punti || a.senza - b.senza || a.insolito - b.insolito;
    const visti = new Set(), unici = [];
    for (const t of trovati) {
      t.parametri = parametri(t);
      const chiave = JSON.stringify(t.parametri);
      if (visti.has(chiave)) continue;
      visti.add(chiave);
      t.punti = t.rate + t.quote; t.insolito = insolito(t);
      unici.push(t);
    }
    unici.sort(ordine);
    // Al motore vero: le migliori, comprese tutte quelle a pari merito con la prima (servono per i dubbi).
    const primi = unici.filter((t, i) => i < 30 || (t.punti === unici[0].punti && i < 300));
    const candidati = primi.map(t => {
      const e = controlla(ingresso, t, vere, scritte, fino);
      return { parametri: t.parametri, rate: e.rate, quote: e.quote, punti: e.rate + e.quote, senza: e.senza, suRate: vere.length - e.senza, suQuote: scritte.length,
        sbagliate: e.sbagliate, separate: t.separate, insolito: t.insolito };
    }).sort(ordine);
    const esito = { candidati, totale: vere.length + scritte.length };
    if (!candidati.length) {
      // Nessuna rata torna: si tiene la combinazione più vicina, per mostrare quanto sono lontani i conti.
      if (migliore.tipo) esito.vicina = { parametri: parametri(migliore), sbagliate: controlla(ingresso, migliore, vere, scritte, fino).sbagliate };
      return { ...esito, esito: 'nessuno', differenze: [] };
    }
    const primo = candidati[0];
    if (primo.rate < primo.suRate || primo.quote < primo.suQuote) {
      return { ...esito, esito: primo.rate >= 2 && primo.rate >= 0.6 * primo.suRate ? 'vicino' : 'nessuno', differenze: [] };
    }
    const differenze = differenzeFra(candidati);
    return { ...esito, esito: differenze.length ? 'dubbio' : 'trovato', differenze };
  }

  // Fra le spiegazioni che fanno tornare tutte le rate (quante la prima), i dati su cui restano diverse, nell'ordine in
  // cui chiederli. Prima si scartano quelle meno tonde: fra uno spread di 1,20% e uno di 1,203% che tornano entrambi,
  // la banca ha scritto il primo. Se le rate non bastano a separare spese e tasso, anche il tasso va chiesto.
  function differenzeFra(candidati) {
    const primo = candidati[0];
    let pari = candidati.filter(c => c.punti === primo.punti && c.senza === primo.senza);
    const tasso = c => c.parametri.tipo_prestito === 'variabile' ? c.parametri.spread : c.parametri.tasso_fisso;
    const minimiDecimali = Math.min(...pari.map(c => decimali(tasso(c))));
    pari = pari.filter(c => decimali(tasso(c)) <= Math.max(2, minimiDecimali));
    const massimoTondo = Math.max(...pari.map(c => tondo(c.parametri.spese_rata)));
    pari = pari.filter(c => tondo(c.parametri.spese_rata) === massimoTondo);
    const differenze = [];
    for (const chiave of DATI_CHIAVE) {
      const valori = [];
      for (const c of pari) {
        let v = c.parametri[chiave];
        if (v === undefined) continue;
        if (chiave === 'tasso_annuo_piano') v = Math.round(v * 1e4) / 1e4;
        if (!valori.includes(v)) valori.push(v);
      }
      if (valori.length > 1) differenze.push({ chiave, valori });
    }
    // Al suo posto nell'ordine delle domande: prima si chiede se il mutuo è fisso o variabile, e con quale indice.
    const chiaveTasso = primo.parametri.tipo_prestito === 'variabile' ? 'spread' : 'tasso_fisso';
    // Rate che non separano il tasso dalle spese: la domanda sul tasso lo dice («motivo»), anche quando i tassi possibili
    // sono più d'uno, e per ogni tasso porta le spese con cui le rate tornano (la pagina le scrive sotto la risposta).
    if (!primo.separate) {
      let d = differenze.find(x => x.chiave === chiaveTasso);
      if (!d) differenze.push(d = { chiave: chiaveTasso, valori: [tasso(primo)] });
      d.motivo = 'spese';
      d.spese = d.valori.map(v => (pari.find(c => Math.abs(tasso(c) - v) < 1e-9) || primo).parametri.spese_rata || 0);
    }
    return differenze.sort((a, b) => DATI_CHIAVE.indexOf(a.chiave) - DATI_CHIAVE.indexOf(b.chiave));
  }

  // Per la pagina: lo stesso calcolo a pezzi, così la pagina resta viva e può mostrare l'avanzamento (ogni passo).
  function aPezzi(ingresso, avanzamento) {
    return new Promise((risolvi, rifiuta) => {
      const passi = analizza(ingresso);
      const avanti = () => {
        try {
          const fine = Date.now() + 40;
          let passo;
          do {
            passo = passi.next();
            if (passo.done) return risolvi(passo.value);
            if (avanzamento) avanzamento(passo.value);
          } while (Date.now() < fine);
          setTimeout(avanti, 0);
        } catch (errore) { rifiuta(errore); }
      };
      setTimeout(avanti, 0);
    });
  }
  // Tutto di fila (per le prove in Node).
  function esegui(ingresso) {
    const passi = analizza(ingresso);
    let passo;
    do passo = passi.next(); while (!passo.done);
    return passo.value;
  }

  return { analizza, aPezzi, esegui, differenzeFra, DATI_CHIAVE, SERIE_MUTUI };
});
