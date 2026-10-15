// Modelli statistici per proiettare una serie storica di tassi: media delle variazioni, ARIMA, VAR, GARCH e Vasicek.
// Solo matematica, senza pagina: lo usa previsioni.js (scheda «Previsioni») e, attraverso di essa, il piano per le
// rate future. Lavora su serie MENSILI (ultimo valore di ogni mese) in forma decimale (0,03 = 3%). Le proiezioni
// restituiscono, per ogni mese futuro, il valore atteso e le fasce in cui il modello si aspetta il valore con
// probabilità 80% e 95% (ipotesi di errori normali).
// Funziona anche in Node (per le prove): si aggancia a "window" se c'è, altrimenti a "module.exports".
(function (radice) {
  'use strict';
  const Z80 = 1.2816, Z95 = 1.96;
  const somma = v => v.reduce((s, x) => s + x, 0);
  const media = v => somma(v) / v.length;
  const varianza = (v, gradi = 1) => { const m = media(v); return somma(v.map(x => (x - m) ** 2)) / Math.max(1, v.length - gradi); };
  const differenze = v => v.slice(1).map((x, i) => x - v[i]);

  // ---------- Algebra ----------
  // Risolve A x = b con eliminazione di Gauss e scelta del perno.
  function risolvi(A, b) {
    const n = b.length, M = A.map((riga, i) => [...riga, b[i]]);
    for (let c = 0; c < n; c++) {
      let perno = c;
      for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[perno][c])) perno = r;
      if (Math.abs(M[perno][c]) < 1e-14) throw new Error('I dati non bastano per stimare il modello (sistema singolare).');
      [M[c], M[perno]] = [M[perno], M[c]];
      for (let r = 0; r < n; r++) {
        if (r === c) continue;
        const f = M[r][c] / M[c][c];
        if (f) for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
      }
    }
    return M.map((riga, i) => riga[n] / riga[i]);
  }
  // Minimi quadrati: y ≈ X β. Restituisce coefficienti e residui.
  function ols(X, y) {
    const k = X[0].length, XtX = Array.from({ length: k }, () => new Array(k).fill(0)), Xty = new Array(k).fill(0);
    for (let t = 0; t < y.length; t++) {
      for (let i = 0; i < k; i++) {
        Xty[i] += X[t][i] * y[t];
        for (let j = i; j < k; j++) XtX[i][j] += X[t][i] * X[t][j];
      }
    }
    for (let i = 0; i < k; i++) for (let j = 0; j < i; j++) XtX[i][j] = XtX[j][i];
    const beta = risolvi(XtX, Xty);
    const residui = y.map((v, t) => v - somma(beta.map((b, i) => b * X[t][i])));
    return { beta, residui };
  }
  // Minimizzazione senza derivate (Nelder-Mead).
  function minimizza(f, x0, { passo = 0.1, iterazioni = 3000, tolleranza = 1e-12 } = {}) {
    const n = x0.length;
    let simplesso = [x0.slice()];
    for (let i = 0; i < n; i++) { const x = x0.slice(); x[i] += (x[i] !== 0 ? Math.abs(x[i]) : 1) * passo; simplesso.push(x); }
    let valori = simplesso.map(f);
    for (let it = 0; it < iterazioni; it++) {
      const ordine = valori.map((v, i) => i).sort((a, b) => valori[a] - valori[b]);
      simplesso = ordine.map(i => simplesso[i]); valori = ordine.map(i => valori[i]);
      if (Math.abs(valori[n] - valori[0]) <= tolleranza * (Math.abs(valori[0]) + 1e-20)) break;
      const centro = Array.from({ length: n }, (_, j) => media(simplesso.slice(0, n).map(x => x[j])));
      const peggiore = simplesso[n];
      const punto = c => centro.map((m, j) => m + c * (m - peggiore[j]));
      const r = punto(1), fr = f(r);
      if (fr < valori[0]) {
        const e = punto(2), fe = f(e);
        if (fe < fr) { simplesso[n] = e; valori[n] = fe; } else { simplesso[n] = r; valori[n] = fr; }
      } else if (fr < valori[n - 1]) { simplesso[n] = r; valori[n] = fr; }
      else {
        const c = punto(fr < valori[n] ? 0.5 : -0.5), fc = f(c);
        if (fc < Math.min(fr, valori[n])) { simplesso[n] = c; valori[n] = fc; }
        else for (let i = 1; i <= n; i++) { simplesso[i] = simplesso[i].map((x, j) => simplesso[0][j] + 0.5 * (x - simplesso[0][j])); valori[i] = f(simplesso[i]); }
      }
    }
    return simplesso[0];
  }

  // ---------- Serie mensile ----------
  // Da valori giornalieri [{ giorno: 'AAAA-MM-GG', tasso_360 }] (anche non ordinati) all'ultimo valore di ogni mese.
  function mensile(valori) {
    const perMese = new Map();
    for (const v of [...valori].sort((a, b) => a.giorno.localeCompare(b.giorno))) perMese.set(v.giorno.slice(0, 7), { mese: v.giorno.slice(0, 7), giorno: v.giorno, y: v.tasso_360 });
    return [...perMese.values()];
  }
  // Il mese 'AAAA-MM' spostato di k mesi, e l'ultimo giorno di un mese.
  function meseDopo(mese, k) {
    const [a, m] = mese.split('-').map(Number);
    const d = new Date(Date.UTC(a, m - 1 + k, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  }
  const fineMese = mese => { const [a, m] = mese.split('-').map(Number); return new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10); };
  // Allinea più serie mensili sugli stessi mesi (quelli presenti in tutte).
  function allinea(liste) {
    const comuni = liste.map(l => new Set(l.map(p => p.mese))).reduce((a, b) => new Set([...a].filter(m => b.has(m))));
    return liste.map(l => l.filter(p => comuni.has(p.mese)));
  }

  // Fasce di confidenza da valore atteso e varianza.
  const fascia = (valore, var_) => { const s = Math.sqrt(Math.max(var_, 0)); return { valore, basso80: valore - Z80 * s, alto80: valore + Z80 * s, basso95: valore - Z95 * s, alto95: valore + Z95 * s }; };
  // Costruisce l'esito: una voce per mese futuro.
  function esito(serie, valori, varianze, extra) {
    const ultimo = serie[serie.length - 1];
    return { partenza: { mese: ultimo.mese, giorno: ultimo.giorno, valore: ultimo.y }, mesiStorico: serie.length,
      proiezione: valori.map((v, i) => { const mese = meseDopo(ultimo.mese, i + 1); return { mese, giorno: fineMese(mese), ...fascia(v, varianze[i]) }; }), ...extra };
  }
  const controlla = (serie, minimo) => { if (!serie || serie.length < minimo) throw new Error(`Servono almeno ${minimo} mesi di storico (ce ne sono ${serie ? serie.length : 0}).`); };

  // ---------- Media delle variazioni ----------
  // Il metodo semplice usato dal piano all'inizio: ogni mese l'indice cambia della variazione media del passato.
  function modelloMedia(serie, { h }) {
    controlla(serie, 3);
    const d = differenze(serie.map(p => p.y)), m = media(d), v = varianza(d);
    const ultimo = serie[serie.length - 1].y;
    return esito(serie, Array.from({ length: h }, (_, i) => ultimo + m * (i + 1)), Array.from({ length: h }, (_, i) => v * (i + 1)),
      { parametri: { variazioneMedia: m, deviazione: Math.sqrt(v) } });
  }

  // ---------- Nessun cambiamento ----------
  // L'indice resta dov'è; l'incertezza è quella delle variazioni mensili passate. È il confronto minimo per ogni
  // altro modello: se un modello non fa meglio di questo, non serve.
  function modelloCostante(serie, { h }) {
    controlla(serie, 3);
    const d = differenze(serie.map(p => p.y)), v = varianza(d);
    const ultimo = serie[serie.length - 1].y;
    return esito(serie, new Array(h).fill(ultimo), Array.from({ length: h }, (_, i) => v * (i + 1)), { parametri: { deviazione: Math.sqrt(v) } });
  }

  // ---------- ARIMA(p, d, q) ----------
  // Stima per somma dei quadrati condizionata (CSS) con Nelder-Mead; stime iniziali dai minimi quadrati sull'AR.
  // "psi" = i pesi della rappresentazione a media mobile, usati per la varianza delle previsioni e per il controllo
  // di stabilità (se esplodono il modello non è stazionario o non è invertibile).
  function pesiPsi(phi, theta, quanti) {
    const psi = [1];
    for (let j = 1; j <= quanti; j++) {
      let s = j <= theta.length ? theta[j - 1] : 0;
      for (let i = 1; i <= Math.min(phi.length, j); i++) s += phi[i - 1] * psi[j - i];
      psi.push(s);
    }
    return psi;
  }
  const stabile = coeff => !coeff.length || Math.max(...pesiPsi(coeff, [], 80).map(Math.abs)) < 30;
  function arima(serie, { p = 1, d = 1, q = 0, h, auto = false }) {
    controlla(serie, 36);
    const y = serie.map(v => v.y);
    if (auto) {
      let migliore = null;
      for (let pp = 0; pp <= 3; pp++) for (let qq = 0; qq <= 2; qq++) {
        try {
          const r = arima(serie, { p: pp, d, q: qq, h });
          if (!migliore || r.parametri.aic < migliore.parametri.aic) migliore = r;
        } catch { /* combinazione non stimabile */ }
      }
      if (!migliore) throw new Error('Nessun modello ARIMA stimabile su questa serie.');
      migliore.parametri.auto = true;
      return migliore;
    }
    const w = d ? differenze(y) : y.slice(), n = w.length;
    const spacchetta = x => ({ c: x[0], phi: x.slice(1, 1 + p), theta: x.slice(1 + p, 1 + p + q) });
    const residui = x => {
      const { c, phi, theta } = spacchetta(x), e = new Array(n).fill(0);
      let sse = 0;
      for (let t = p; t < n; t++) {
        let atteso = c;
        for (let i = 0; i < p; i++) atteso += phi[i] * w[t - 1 - i];
        for (let j = 0; j < q; j++) atteso += theta[j] * (t - 1 - j >= p ? e[t - 1 - j] : 0);
        e[t] = w[t] - atteso;
        sse += e[t] * e[t];
      }
      return { e, sse };
    };
    // Stime iniziali: minimi quadrati dell'AR(p) con costante.
    let x0;
    if (p) {
      const X = [], yy = [];
      for (let t = p; t < n; t++) { X.push([1, ...Array.from({ length: p }, (_, i) => w[t - 1 - i])]); yy.push(w[t]); }
      x0 = [...ols(X, yy).beta, ...new Array(q).fill(0)];
    } else x0 = [media(w), ...new Array(q).fill(0)];
    const sse0 = residui(x0).sse || 1e-12;
    const obiettivo = x => { const { phi, theta } = spacchetta(x); const { sse } = residui(x); return stabile(phi) && stabile(theta.map(t => -t)) ? sse : sse * 100 + sse0 * 100; };
    const x = (p + q) ? minimizza(obiettivo, x0, { passo: 0.05 }) : x0;
    const { c, phi, theta } = spacchetta(x), { e, sse } = residui(x);
    if (!stabile(phi) || !stabile(theta.map(t => -t))) throw new Error('Il modello ARIMA stimato non è stabile: prova con meno termini.');
    const nEff = n - p, k = 1 + p + q, sigma2 = sse / Math.max(1, nEff - k);
    const aic = nEff * Math.log(sse / nEff) + 2 * k;
    // Previsioni di w (e dei livelli se d = 1).
    const wf = [];
    const wTot = i => (i < n ? w[i] : wf[i - n]), eTot = i => (i < n ? e[i] : 0);
    for (let s = 0; s < h; s++) {
      const t = n + s;
      let v = c;
      for (let i = 0; i < p; i++) v += phi[i] * wTot(t - 1 - i);
      for (let j = 0; j < q; j++) v += theta[j] * eTot(t - 1 - j);
      wf.push(v);
    }
    const psi = pesiPsi(phi, theta, h);
    const valori = [], varianze = [];
    let livello = y[y.length - 1], sommaPsi = 0, sommaQuad = 0, sommaCum = 0;
    for (let s = 0; s < h; s++) {
      if (d) { livello += wf[s]; sommaPsi += psi[s]; sommaCum += sommaPsi * sommaPsi; valori.push(livello); varianze.push(sigma2 * sommaCum); }
      else { sommaQuad += psi[s] * psi[s]; valori.push(wf[s]); varianze.push(sigma2 * sommaQuad); }
    }
    const mediaLungo = !d && p && Math.abs(1 - somma(phi)) > 1e-6 ? c / (1 - somma(phi)) : null;
    return esito(serie, valori, varianze, { parametri: { p, d, q, c, phi, theta, sigma: Math.sqrt(sigma2), aic, mediaLungo } });
  }

  // ---------- VAR(p) ----------
  // Più serie insieme (ad esempio i cinque Euribor): ogni serie dipende dai valori passati di tutte. La proiezione
  // restituita è quella della serie "indice"; per le altre c'è parametri.altre (ultimo valore e valore a fine orizzonte).
  function var_(serieTutte, { p = 1, indice = 0, h }) {
    if (!Array.isArray(serieTutte) || serieTutte.length < 2) throw new Error('Il VAR ha bisogno di almeno due serie.');
    const liste = allinea(serieTutte);
    for (const l of liste) controlla(l, 36);
    const k = liste.length, n = liste[0].length, Y = liste.map(l => l.map(v => v.y));
    const X = [], righe = [];
    for (let t = p; t < n; t++) { X.push([1, ...Y.flatMap(serie => Array.from({ length: p }, (_, l) => serie[t - 1 - l]))]); righe.push(t); }
    const stime = Y.map(serie => ols(X, righe.map(t => serie[t])));
    const B = stime.map(s => s.beta), U = stime.map(s => s.residui);
    const nEff = n - p, gradi = Math.max(1, nEff - (1 + k * p));
    const Sigma = Array.from({ length: k }, (_, i) => Array.from({ length: k }, (_, j) => somma(U[i].map((u, t) => u * U[j][t])) / gradi));
    const As = Array.from({ length: p }, (_, l) => Array.from({ length: k }, (_, i) => Array.from({ length: k }, (_, j) => B[i][1 + j * p + l])));
    // Previsioni.
    const storia = Y.map(serie => serie.slice());
    const previste = Array.from({ length: k }, () => []);
    for (let s = 0; s < h; s++) {
      const t = n + s;
      for (let i = 0; i < k; i++) {
        let v = B[i][0];
        for (let j = 0; j < k; j++) for (let l = 0; l < p; l++) v += B[i][1 + j * p + l] * storia[j][t - 1 - l];
        previste[i].push(v);
      }
      for (let i = 0; i < k; i++) storia[i].push(previste[i][s]);
    }
    // Varianza della serie scelta: Ψ_s = Σ_l A_l Ψ_{s−l}, Var_h = Σ_{s<h} Ψ_s Σ Ψ_s'.
    const I = Array.from({ length: k }, (_, i) => Array.from({ length: k }, (_, j) => (i === j ? 1 : 0)));
    const moltiplica = (P, Q) => P.map(riga => Q[0].map((_, j) => somma(riga.map((v, m) => v * Q[m][j]))));
    const Psi = [I];
    for (let s = 1; s < h; s++) {
      let acc = Array.from({ length: k }, () => new Array(k).fill(0));
      for (let l = 1; l <= Math.min(p, s); l++) { const prod = moltiplica(As[l - 1], Psi[s - l]); acc = acc.map((riga, i) => riga.map((v, j) => v + prod[i][j])); }
      Psi.push(acc);
    }
    const varianze = [];
    let cum = 0;
    for (let s = 0; s < h; s++) {
      const riga = Psi[s][indice];
      let v = 0;
      for (let a = 0; a < k; a++) for (let b = 0; b < k; b++) v += riga[a] * Sigma[a][b] * riga[b];
      cum += v;
      varianze.push(cum);
    }
    const altre = liste.map((l, i) => ({ ultimo: l[l.length - 1].y, fine: previste[i][h - 1] }));
    return esito(liste[indice], previste[indice], varianze, { parametri: { p, k, sigma: Math.sqrt(Sigma[indice][indice]), altre, mesi: n } });
  }

  // ---------- GARCH(1,1) ----------
  // Sulle variazioni mensili (in punti percentuali): media costante μ e varianza che cambia nel tempo,
  // σ²_t = ω + α ε²_{t−1} + β σ²_{t−1}. Stima di massima verosimiglianza (errori normali).
  function garch(serie, { h }) {
    controlla(serie, 36);
    const r = differenze(serie.map(v => v.y)).map(x => x * 100), n = r.length;
    const mu0 = media(r), v0 = varianza(r);
    const spacchetta = x => { const eb = Math.exp(x[2]), ec = Math.exp(x[3]), s = 1 + eb + ec; return { mu: x[0], omega: Math.exp(x[1]), alpha: eb / s, beta: ec / s }; };
    const filtro = x => {
      const { mu, omega, alpha, beta } = spacchetta(x);
      let s2 = v0, nll = 0;
      const s2t = [];
      for (let t = 0; t < n; t++) {
        s2t.push(s2);
        const e = r[t] - mu;
        nll += Math.log(s2) + e * e / s2;
        s2 = omega + alpha * e * e + beta * s2;
      }
      return { nll, s2Prossima: s2, s2t };
    };
    const x = minimizza(x => filtro(x).nll, [mu0, Math.log(Math.max(v0 * 0.1, 1e-8)), 0, Math.log(8)], { passo: 0.3 });
    const { mu, omega, alpha, beta } = spacchetta(x), { s2Prossima, s2t } = filtro(x);
    // Con persistenza vicina a 1 il livello di lungo periodo ω/(1−α−β) non ha senso (tende all'infinito).
    const persistenza = alpha + beta, lungo = persistenza < 0.995 ? omega / (1 - persistenza) : null;
    const ultimo = serie[serie.length - 1].y;
    const valori = [], varianze = [];
    let cum = 0;
    for (let s = 0; s < h; s++) {
      const attesa = lungo != null ? lungo + Math.pow(persistenza, s) * (s2Prossima - lungo) : s2Prossima;
      cum += attesa;
      valori.push(ultimo + mu * (s + 1) / 100);
      varianze.push(cum / 10000);
    }
    return esito(serie, valori, varianze, { parametri: { mu: mu / 100, omega, alpha, beta, persistenza,
      volatilitaAttuale: Math.sqrt(s2Prossima) / 100, volatilitaLungo: lungo != null ? Math.sqrt(lungo) / 100 : null, volatilitaMedia: Math.sqrt(media(s2t)) / 100 } });
  }

  // ---------- Vasicek ----------
  // dr = a (b − r) dt + σ dW: il tasso torna verso un livello di lungo periodo b con velocità a. Stimato con i
  // minimi quadrati sul passo mensile (dt = 1/12): r_{t+1} = α + β r_t.
  function vasicek(serie, { h }) {
    controlla(serie, 36);
    const y = serie.map(v => v.y), dt = 1 / 12;
    const { beta, residui } = ols(y.slice(0, -1).map(v => [1, v]), y.slice(1));
    const [alpha, b1] = beta;
    const sigma = Math.sqrt(varianza(residui, 2) / dt);
    const ultimo = y[y.length - 1];
    const a = (1 - b1) / dt, b = b1 < 1 ? alpha / (1 - b1) : null;
    const valori = [], varianze = [];
    for (let s = 1; s <= h; s++) {
      const T = s * dt;
      if (a > 1e-6) { valori.push(b + (ultimo - b) * Math.exp(-a * T)); varianze.push(sigma * sigma / (2 * a) * (1 - Math.exp(-2 * a * T))); }
      else { valori.push(ultimo + alpha * s); varianze.push(sigma * sigma * T); }
    }
    return esito(serie, valori, varianze, { parametri: { a, b, sigma, semivita: a > 1e-6 ? Math.log(2) / a * 12 : null, ritornoMedio: a > 1e-6 } });
  }

  // ---------- Attese del mercato: tassi a termine impliciti nella curva Euribor di oggi ----------
  // I cinque Euribor di oggi (1 settimana, 1, 3, 6, 12 mesi) formano una curva: dai fattori di sconto 1/(1 + r·T),
  // interpolati in modo log-lineare, si ricava il tasso a termine F(t, τ) = (DF(t)/DF(t+τ) − 1)/τ, cioè il valore
  // dell'Euribor a τ che il mercato "prezza" fra t. Vale finché t + τ ≤ 1 anno: oltre, la curva non dice niente e
  // la proiezione resta ferma. Le fasce sono quelle dell'incertezza storica (come il modello costante), non del
  // mercato. I tassi a termine contengono anche un premio per il rischio, quindi tendono a sovrastimare un po'.
  function curva(serieTutte, { indice = 0, tau, h }) {
    if (!Array.isArray(serieTutte) || !Array.isArray(tau) || serieTutte.length !== tau.length || serieTutte.length < 2) throw new Error('Per le attese del mercato servono i valori di oggi di tutti gli Euribor.');
    const liste = allinea(serieTutte), n = liste[0].length;
    if (!n) throw new Error('Le serie non hanno mesi in comune.');
    const oggi = liste.map(l => l[n - 1].y);
    const nodi = [[0, 0], ...tau.map((t, i) => [t, Math.log(1 / (1 + oggi[i] * t))])].sort((a, b) => a[0] - b[0]);
    const lnDF = T => {
      if (T <= 0) return 0;
      let i = 1;
      while (i < nodi.length - 1 && nodi[i][0] < T) i++;
      const [a, b] = [nodi[i - 1], nodi[i]];
      return a[1] + (b[1] - a[1]) * (T - a[0]) / (b[0] - a[0]);
    };
    const t_ = tau[indice], serie = liste[indice], limite = Math.max(...tau) - t_;
    const forward = t => (Math.exp(lnDF(t) - lnDF(t + t_)) - 1) / t_;
    const v = varianza(differenze(serie.map(p => p.y)));
    const valori = [], varianze = [];
    for (let s = 1; s <= h; s++) { valori.push(forward(Math.min(s / 12, Math.max(0, limite)))); varianze.push(v * s); }
    const termine = Math.round(limite * 12);
    return esito(serie, valori, varianze, { parametri: { oggi, tau, mesiCoperti: termine, aTermine: termine > 0 ? forward(limite) : null, deviazione: Math.sqrt(v) } });
  }

  // ---------- Ingresso unico ----------
  // "serie" è la serie mensile scelta; per il VAR "altre" sono tutte le serie e "indice" la posizione di quella scelta.
  const MODELLI = {
    media: { nome: 'Media delle variazioni', breve: 'Media', calcola: (serie, o) => modelloMedia(serie, o) },
    costante: { nome: 'Nessun cambiamento (resta com\'è)', breve: 'Costante', calcola: (serie, o) => modelloCostante(serie, o) },
    arima: { nome: 'ARIMA', breve: 'ARIMA', calcola: (serie, o) => arima(serie, o) },
    var: { nome: 'VAR (tutti gli Euribor insieme)', breve: 'VAR', calcola: (serie, o) => var_(o.altre, o) },
    garch: { nome: 'GARCH (volatilità)', breve: 'GARCH', calcola: (serie, o) => garch(serie, o) },
    vasicek: { nome: 'Vasicek (ritorno verso la media)', breve: 'Vasicek', calcola: (serie, o) => vasicek(serie, o) },
    curva: { nome: 'Attese del mercato (curva Euribor di oggi)', breve: 'Curva', calcola: (serie, o) => curva(o.altre, o) },
  };
  function stima(modello, serie, opzioni) {
    const m = MODELLI[modello];
    if (!m) throw new Error(`Modello sconosciuto: ${modello}`);
    const h = Math.max(1, Math.min(600, Math.round(opzioni.h || 24)));
    const r = m.calcola(serie, { ...opzioni, h });
    r.modello = modello;
    r.h = h;
    return r;
  }
  // ---------- Confronto all'indietro ----------
  // Si finge di essere nel passato: per ogni data di taglio (una ogni "passo" mesi, negli ultimi "anni" anni) si
  // stima il modello sui dati fino a lì e si confronta la proiezione con quello che è successo nei mesi dopo.
  // Restituisce, per ogni orizzonte, errore medio assoluto, errore quadratico medio e quante volte il valore vero
  // è caduto nelle fasce 80% e 95% (se il modello è onesto, circa l'80% e il 95% delle volte).
  function confronta(modello, serie, opzioni, { anni = 10, passo = 6, orizzonti = [12, 24] } = {}) {
    const n = serie.length, hMax = Math.max(...orizzonti);
    const tagli = [];
    for (let fine = n - hMax; fine >= Math.max(36, n - anni * 12 - hMax); fine -= passo) tagli.push(fine);
    if (!tagli.length) throw new Error('Lo storico è troppo corto per un confronto all\'indietro.');
    const conti = orizzonti.map(() => ({ abs: 0, quad: 0, dentro80: 0, dentro95: 0, quanti: 0 }));
    let falliti = 0;
    for (const fine of tagli) {
      const parte = serie.slice(0, fine), ultimoMese = parte[parte.length - 1].mese;
      let r;
      try {
        r = stima(modello, parte, { ...opzioni, h: hMax, altre: opzioni.altre ? opzioni.altre.map(l => l.filter(p => p.mese <= ultimoMese)) : undefined });
      } catch { falliti++; continue; }
      orizzonti.forEach((h, i) => {
        const vero = serie[fine + h - 1].y, p = r.proiezione[h - 1], e = p.valore - vero, c = conti[i];
        c.abs += Math.abs(e); c.quad += e * e; c.dentro80 += vero >= p.basso80 && vero <= p.alto80 ? 1 : 0; c.dentro95 += vero >= p.basso95 && vero <= p.alto95 ? 1 : 0; c.quanti++;
      });
    }
    return { modello, tagli: tagli.length, falliti, dal: serie[tagli[tagli.length - 1] - 1].mese, al: serie[tagli[0] - 1].mese,
      perOrizzonte: orizzonti.map((h, i) => { const c = conti[i]; return c.quanti ? { h, mae: c.abs / c.quanti, rmse: Math.sqrt(c.quad / c.quanti), copertura80: c.dentro80 / c.quanti, copertura95: c.dentro95 / c.quanti, quanti: c.quanti } : { h, quanti: 0 }; }) };
  }

  // Funzione giorno → valore atteso, per il piano: interpola fra i mesi della proiezione; fino al giorno di partenza
  // restituisce null (il piano usa i valori veri o il suo metodo), oltre l'orizzonte tiene l'ultimo valore.
  const inGiorni = iso => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / 86400000;
  // "campo" sceglie lo scenario: 'valore' (atteso), 'alto80', 'basso80', 'alto95', 'basso95'.
  function perGiorno(risultato, campo = 'valore') {
    const punti = [{ x: inGiorni(risultato.partenza.giorno), y: risultato.partenza.valore }, ...risultato.proiezione.map(p => ({ x: inGiorni(p.giorno), y: p[campo] }))];
    return giorno => {
      if (!giorno || giorno <= risultato.partenza.giorno) return null;
      const x = inGiorni(giorno);
      if (x >= punti[punti.length - 1].x) return punti[punti.length - 1].y;
      let i = 1;
      while (punti[i].x < x) i++;
      const a = punti[i - 1], b = punti[i];
      return a.y + (b.y - a.y) * (x - a.x) / (b.x - a.x);
    };
  }

  const Modelli = { MODELLI, stima, confronta, mensile, allinea, meseDopo, fineMese, perGiorno, strumenti: { ols, minimizza, risolvi, media, varianza } };
  if (radice.window) radice.window.Modelli = Modelli; else radice.module.exports = Modelli;
})(typeof window !== 'undefined' ? { window } : { module });
