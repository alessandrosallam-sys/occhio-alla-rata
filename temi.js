// Impostazioni della pagina: la versione (semplice o avanzata), l'assistente (e il suo aspetto), il tema dei colori e il logo.
// Tutti i colori, i caratteri, i raggi e gli spessori stanno in stile.css come variabili, un blocco per tema
// ([data-tema="…"]); le parti per esperti hanno la classe «solo-avanzata» e si nascondono con [data-versione="semplice"].
// Questo file:
//  - sceglie tema e versione e li mette su <html> prima che la pagina si disegni (si carica nel <head>, così niente lampi);
//  - calcola i temi che danno solo i colori di base, compreso «Il tuo tema» (chiave «tema-personale»), e applica i
//    caratteri scelti per testo, titoli e cifre (chiave «caratteri»);
//  - li ricorda nel browser (chiavi «tema» e «versione»), con le due scelte dell'assistente («assistente-spiega»,
//    «assistente-segue»: «no» se spente);
//  - costruisce le impostazioni: il pulsante «Impostazioni» nella testata apre un riquadro con versione, assistente
//    e temi, e le stesse scelte stanno nel pannello di controllo. Ogni anteprima dei temi porta il suo data-tema, quindi
//    mostra i colori veri. Cambiando versione o assistente la pagina riceve un evento («cambio-versione»,
//    «cambio-assistente») e si ridisegna.
(function () {
  'use strict';
  const CHIAVE = 'tema', CHIAVE_VERSIONE = 'versione';
  const TEMI = [
    { codice: 'auto', nome: 'Automatico', descrizione: 'Chiaro di giorno, scuro se il computer o il telefono è impostato sullo scuro.' },
    { codice: 'chiaro', nome: 'Chiaro', descrizione: 'Bianco e blu, pulito. Il più leggibile alla luce del giorno.' },
    { codice: 'notte', nome: 'Notte', descrizione: 'Blu profondo e viola. Riposa gli occhi la sera.' },
    { codice: 'carta', nome: 'Carta', descrizione: 'Avorio e inchiostro, titoli con le grazie, come un documento stampato.' },
    { codice: 'salvia', nome: 'Salvia', descrizione: 'Verdi tenui e angoli morbidi. Calmo e riposante.' },
    { codice: 'aurora', nome: 'Aurora', descrizione: 'Viola, rosa e arancio su uno sfondo sfumato. Vivace.' },
    { codice: 'ardesia', nome: 'Ardesia', descrizione: 'Grafite e ambra, cifre da cruscotto. Scuro e caldo.' },
    { codice: 'contrasto', nome: 'Contrasto alto', descrizione: 'Nero su bianco, bordi marcati, testo più grande. Per chi vede poco.' },
    { codice: 'oceano', nome: 'Oceano', descrizione: 'Bianco e verde acqua, fresco e pulito.' },
    { codice: 'tramonto', nome: 'Tramonto', descrizione: 'Pesca e terracotta, titoli con le grazie. Caldo e accogliente.' },
    { codice: 'lavanda', nome: 'Lavanda', descrizione: 'Lilla e viola, pulsanti tondi. Delicato.' },
    { codice: 'bosco', nome: 'Bosco', descrizione: 'Verde scuro come un bosco di sera. Riposante.' },
    { codice: 'brace', nome: 'Brace', descrizione: 'Rosso scuro e arancio su fondo quasi nero. Deciso.' },
    { codice: 'terminale', nome: 'Terminale', descrizione: 'Verde su nero e lettere da computer di una volta, come lo schermo di un hacker.' },
    { codice: 'personale', nome: 'Il tuo tema', descrizione: 'Scegli tu i colori, uno per uno, partendo da un tema che ti piace.' },
  ];
  const radice = document.documentElement;
  const valido = codice => TEMI.some(t => t.codice === codice);
  const leggi = (chiave = CHIAVE) => { if (window.MUTUO_UN_FILE) return null; try { return localStorage.getItem(chiave); } catch { return null; } };
  const scrivi = (valore, chiave = CHIAVE) => { if (window.MUTUO_UN_FILE) return; try { localStorage.setItem(chiave, valore); } catch { /* vale solo per questa volta */ } };
  // ---------- Temi calcolati: i colori di base, il resto lo ricava il programma ----------
  // I temi della prima serie hanno tutti i colori scritti a mano in stile.css. Quelli qui sotto (e «Il tuo tema»)
  // danno solo cinque colori e la forma degli angoli: variabili() ricava le altre voci (superfici, linee, stati,
  // riquadro della rata…), controllando che il testo si legga, e il blocco [data-tema="…"] va in un <style> aggiunto
  // in fondo al <head>, dopo stile.css. Chiaro o scuro si deduce dal colore dei riquadri.
  const CARATTERI = [
    { codice: 'moderno', nome: 'Moderno', pila: 'system-ui, "Segoe UI Variable Text", "Segoe UI", -apple-system, BlinkMacSystemFont, Roboto, "Helvetica Neue", Arial, sans-serif' },
    { codice: 'classico', nome: 'Classico, con le grazie', pila: 'Georgia, Cambria, "Times New Roman", Times, serif' },
    { codice: 'elegante', nome: 'Elegante', pila: '"Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif' },
    { codice: 'gentile', nome: 'Gentile', pila: 'Candara, Optima, Calibri, "Segoe UI", sans-serif' },
    { codice: 'amichevole', nome: 'Amichevole', pila: '"Trebuchet MS", "Lucida Grande", "Segoe UI", sans-serif' },
    { codice: 'leggibile', nome: 'Largo e leggibile', pila: 'Verdana, Tahoma, "DejaVu Sans", sans-serif' },
    { codice: 'tecnico', nome: 'Tecnico, stretto', pila: 'Bahnschrift, "DIN Alternate", "Arial Narrow", "Roboto Condensed", sans-serif' },
    { codice: 'fisso', nome: 'Da computer (spaziatura fissa)', pila: '"Cascadia Mono", Consolas, "SF Mono", Menlo, "DejaVu Sans Mono", monospace' },
  ];
  const pila = codice => (CARATTERI.find(c => c.codice === codice) || {}).pila;
  const ANGOLI = {
    squadrati: { nome: 'Quasi squadrati', r1: '3px', r2: '4px', r3: '6px', pulsante: '3px' },
    normali: { nome: 'Normali', r1: '8px', r2: '12px', r3: '18px', pulsante: '9px' },
    morbidi: { nome: 'Morbidi', r1: '10px', r2: '16px', r3: '24px', pulsante: '12px' },
    tondi: { nome: 'Tondi, pulsanti a pillola', r1: '12px', r2: '20px', r3: '28px', pulsante: '999px' },
  };
  const CALCOLATI = {
    oceano: { pagina: '#edf5f7', superficie: '#ffffff', testo: '#0b2530', accento: '#0e7490', secondo: '#2563eb', angoli: 'normali' },
    tramonto: { pagina: '#faf1ea', superficie: '#fffaf5', testo: '#2b1a12', accento: '#c2410c', secondo: '#db2777', angoli: 'morbidi', titoli: 'classico', numeri: 'classico' },
    lavanda: { pagina: '#f4f2fb', superficie: '#ffffff', testo: '#1e1633', accento: '#7c3aed', secondo: '#c026d3', angoli: 'tondi' },
    bosco: { pagina: '#0b1510', superficie: '#12221a', testo: '#e2efe6', accento: '#15803d', secondo: '#0f766e', angoli: 'normali' },
    brace: { pagina: '#160b0e', superficie: '#211217', testo: '#f4e7ea', accento: '#be123c', secondo: '#ea580c', angoli: 'normali' },
    terminale: { pagina: '#030805', superficie: '#08130b', testo: '#bff5c9', accento: '#15803d', secondo: '#065f46', angoli: 'squadrati', carattere: 'fisso', titoli: 'fisso', numeri: 'fisso' },
  };
  const PERSONALE_INIZIALE = { pagina: '#f4f6fb', superficie: '#ffffff', testo: '#0f172a', accento: '#2952e3', secondo: '#6d3fd0', angoli: 'normali' };
  const COLORI_PERSONALI = [
    { campo: 'pagina', nome: 'Sfondo della pagina' },
    { campo: 'superficie', nome: 'Riquadri e tabelle' },
    { campo: 'testo', nome: 'Testo' },
    { campo: 'accento', nome: 'Colore principale', aiuto: 'pulsanti, voce aperta del menù' },
    { campo: 'secondo', nome: 'Secondo colore', aiuto: 'la sfumatura del riquadro della rata e del logo' },
  ];

  const esa = c => { let h = String(c).trim().replace('#', ''); if (h.length === 3) h = h.split('').map(x => x + x).join(''); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) || 0); };
  const inEsa = rgb => '#' + rgb.map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
  const mescola = (a, b, t) => { const x = esa(a), y = esa(b); return inEsa(x.map((v, i) => v + (y[i] - v) * t)); };
  const velato = (c, alfa) => `rgba(${esa(c).join(', ')}, ${alfa})`;
  const luce = c => { const [r, g, b] = esa(c).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const contrasto = (a, b) => { const x = luce(a), y = luce(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  // Avvicina un colore a «verso» finché si legge sullo sfondo (rapporto di contrasto almeno «minimo»).
  const leggibile = (colore, sfondo, verso, minimo = 4.5) => { let c = colore; for (let t = 0.1; contrasto(c, sfondo) < minimo && t < 1.05; t += 0.1) c = mescola(colore, verso, t); return c; };
  // Bianco o quasi nero, quello che si legge meglio su tutti gli sfondi dati.
  const sopra = (...sfondi) => { const peggio = c => Math.min(...sfondi.map(s => contrasto(c, s))); return peggio('#ffffff') >= Math.min(4.5, peggio('#111318')) ? '#ffffff' : '#111318'; };
  const eColore = c => /^#[0-9a-f]{6}$/i.test(String(c || ''));

  function variabili(b) {
    const sup = b.superficie, ink = b.testo, acc = b.accento, sec = b.secondo || b.accento;
    const s = luce(sup) < 0.18;   // riquadri scuri: tema scuro
    const accTesto = leggibile(acc, sup, s ? '#ffffff' : '#000000');
    const navSfondo = mescola(sup, acc, s ? 0.26 : 0.12);
    const suEroe = sopra(acc, sec), suAcc = sopra(acc);
    const a = ANGOLI[b.angoli] || ANGOLI.normali;
    const v = {
      'color-scheme': s ? 'dark' : 'light',
      '--pagina': b.pagina,
      '--sfondo-pagina': `linear-gradient(180deg, ${mescola(b.pagina, acc, s ? 0.1 : 0.07)} 0, ${b.pagina} 360px) ${b.pagina}`,
      '--superficie': sup, '--superficie-2': mescola(sup, ink, s ? 0.05 : 0.03), '--carta-sfondo': sup,
      '--inchiostro': ink, '--inchiostro-2': leggibile(mescola(ink, sup, 0.28), sup, ink, 7), '--tenue': leggibile(mescola(ink, sup, 0.45), sup, ink),
      '--linea': mescola(sup, ink, s ? 0.13 : 0.09), '--linea-forte': mescola(sup, ink, s ? 0.22 : 0.18), '--bordo': velato(ink, s ? 0.07 : 0.08),
      '--ombra': s ? '0 1px 2px rgba(0, 0, 0, 0.4), 0 8px 24px rgba(0, 0, 0, 0.22)' : `0 1px 2px ${velato(ink, 0.04)}, 0 6px 18px ${velato(ink, 0.05)}`,
      '--ombra-alta': s ? '0 20px 48px rgba(0, 0, 0, 0.6), 0 2px 8px rgba(0, 0, 0, 0.4)' : `0 18px 40px ${velato(ink, 0.18)}, 0 2px 8px ${velato(ink, 0.08)}`,
      '--testata-tabella': mescola(sup, ink, s ? 0.07 : 0.045), '--zebra': mescola(sup, ink, s ? 0.03 : 0.018),
      '--velo-banda': velato(ink, 0.025), '--traccia': velato(ink, s ? 0.16 : 0.12), '--velo': velato(ink, s ? 0.06 : 0.05),
      '--accento': acc, '--accento-forte': mescola(acc, s ? '#ffffff' : '#000000', 0.15), '--accento-testo': accTesto,
      '--accento-tenue': mescola(sup, acc, s ? 0.22 : 0.1), '--su-accento': suAcc,
      '--serie': accTesto, '--parte-capitale': accTesto, '--parte-interessi': s ? '#ff8a5b' : '#f0682c', '--parte-spese': s ? '#34d399' : '#12a17a',
      '--riga-pagata': mescola(sup, '#16a34a', s ? 0.16 : 0.08), '--riga-problema': mescola(sup, '#dc2626', s ? 0.18 : 0.07), '--riga-corso': mescola(sup, '#f59e0b', s ? 0.16 : 0.12),
      '--ok': s ? '#34d399' : '#16a34a', '--ko': s ? '#f87171' : '#dc2626', '--corso': s ? '#fbbf24' : '#d97706', '--corso-testo': s ? '#fcd37a' : '#92400e',
      '--ok-sfondo': s ? '#0f2a20' : '#e5f6eb', '--ok-testo': s ? '#86efac' : '#166534', '--ko-sfondo': s ? '#33171d' : '#fde8e7', '--ko-testo': s ? '#fca5a5' : '#b91c1c',
      '--avviso-sfondo': s ? '#33280f' : '#fff4d6', '--avviso-testo': s ? '#fcd37a' : '#7c4a03',
      '--previsione-sfondo': mescola(sup, '#d4a017', s ? 0.1 : 0.08), '--corrente-sfondo': mescola(sup, acc, s ? 0.22 : 0.1),
      '--testata': velato(sup, 0.88), '--testata-solida': sup,
      '--nav-attiva-sfondo': navSfondo, '--nav-attiva-testo': leggibile(acc, navSfondo, s ? '#ffffff' : '#000000'),
      '--eroe': `linear-gradient(135deg, ${acc} 0%, ${sec} 100%)`, '--su-eroe': suEroe, '--su-eroe-2': velato(suEroe, 0.84),
      '--eroe-traccia': velato(suEroe, 0.25), '--eroe-riempi': suEroe, '--eroe-luce': velato(suEroe, 0.16),
      '--logo': `linear-gradient(135deg, ${acc}, ${sec})`, '--su-logo': suEroe, '--fuoco': accTesto,
      '--r1': a.r1, '--r2': a.r2, '--r3': a.r3, '--r-pulsante': a.pulsante,
    };
    if (pila(b.carattere)) v['--carattere'] = pila(b.carattere);
    if (pila(b.titoli)) v['--carattere-titoli'] = pila(b.titoli);
    if (pila(b.numeri)) v['--carattere-numeri'] = pila(b.numeri);
    return v;
  }
  const blocco = (codice, b) => `[data-tema="${codice}"] {\n${Object.entries(variabili(b)).map(([k, v]) => `  ${k}: ${v};`).join('\n')}\n}`;
  const leggiJson = chiave => { try { return JSON.parse(leggi(chiave) || 'null'); } catch { return null; } };
  function personaleValido(p) {
    const r = { ...PERSONALE_INIZIALE };
    if (p && typeof p === 'object') {
      for (const c of COLORI_PERSONALI) if (eColore(p[c.campo])) r[c.campo] = p[c.campo].toLowerCase();
      if (ANGOLI[p.angoli]) r.angoli = p.angoli;
    }
    return r;
  }
  let personale = personaleValido(leggiJson('tema-personale'));
  const stileCalcolati = document.createElement('style');
  stileCalcolati.id = 'temi-calcolati';
  const stilePersonale = document.createElement('style');
  stilePersonale.id = 'tema-personale';
  stileCalcolati.textContent = Object.entries(CALCOLATI).map(([codice, b]) => blocco(codice, b)).join('\n');
  stilePersonale.textContent = blocco('personale', personale);
  document.head.append(stileCalcolati, stilePersonale);

  // ---------- Caratteri: valgono con qualunque tema ----------
  // Si usano solo i caratteri già installati sul computer (niente caratteri scaricati da internet). Per ognuno dei tre
  // usi (testo, titoli, cifre) si sceglie «quello del tema», uno dell'elenco o un altro scritto per nome; la scelta va
  // come variabile sull'elemento <html>, che vince sui blocchi dei temi.
  const USI = [
    { uso: 'testo', variabile: '--carattere', nome: 'Testo' },
    { uso: 'titoli', variabile: '--carattere-titoli', nome: 'Titoli' },
    { uso: 'numeri', variabile: '--carattere-numeri', nome: 'Cifre' },
  ];
  const nomeSicuro = testo => String(testo || '').replace(/[^\p{L}\p{N} \-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 60);
  function caratteriValidi(c) {
    const r = {};
    for (const { uso } of USI) {
      const v = c && c[uso];
      if (v && typeof v === 'object' && v.altro && nomeSicuro(v.altro)) r[uso] = { altro: nomeSicuro(v.altro) };
      else if (typeof v === 'string' && pila(v)) r[uso] = v;
    }
    return r;
  }
  let caratteri = caratteriValidi(leggiJson('caratteri'));
  const pilaDi = scelta => (scelta && scelta.altro) ? `"${scelta.altro}", ${CARATTERI[0].pila}` : pila(scelta);
  function applicaCaratteri() {
    for (const { uso, variabile } of USI) {
      const p = pilaDi(caratteri[uso]);
      if (p) radice.style.setProperty(variabile, p); else radice.style.removeProperty(variabile);
    }
  }
  // C'è questo carattere sul computer? Si misura una parola con il carattere e con due riserve diverse: se le
  // larghezze cambiano, il carattere c'è (il browser non dice in altro modo quali caratteri sono installati).
  function installato(nome) {
    try {
      const g = document.createElement('canvas').getContext('2d'), prova = 'Rata mensile 0123456789 WMmlli';
      return ['monospace', 'serif'].some(riserva => {
        g.font = `32px ${riserva}`; const senza = g.measureText(prova).width;
        g.font = `32px "${nome}", ${riserva}`; return g.measureText(prova).width !== senza;
      });
    } catch { return true; }
  }
  applicaCaratteri();
  const VERSIONI = [
    { codice: 'semplice', nome: 'Semplice', descrizione: 'Solo quello che serve: le rate e se tornano, quanto costa il prestito, il rimborso anticipato, il backup. Consigliata.' },
    { codice: 'avanzata', nome: 'Avanzata', descrizione: 'Tutto: colonne di approfondimento del piano, calendario delle rilevazioni, festività, previsioni dell\'indice, taratura e regole del contratto.' },
  ];
  const OPZIONI = [
    { codice: 'spiega', nome: 'Spiega le cose quando ti fermi sopra con il mouse' },
    { codice: 'segue', nome: 'Ti segue in un angolo quando scorri la pagina' },
  ];
  let corrente = valido(leggi()) ? leggi() : 'auto';
  let versione = leggi(CHIAVE_VERSIONE) === 'avanzata' ? 'avanzata' : 'semplice';
  const opzione = codice => leggi('assistente-' + codice) !== 'no';

  // Colore della barra del browser sui telefoni: quello della testata del tema.
  function aggiornaBarraBrowser() {
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) { meta = document.createElement('meta'); meta.name = 'theme-color'; document.head.append(meta); }
    const colore = getComputedStyle(radice).getPropertyValue('--testata-solida').trim();
    if (colore) meta.content = colore;
  }
  function applica(codice, ricorda) {
    corrente = valido(codice) ? codice : 'auto';
    radice.setAttribute('data-tema', corrente);
    if (ricorda) scrivi(corrente);
    aggiornaBarraBrowser();
    for (const pulsante of document.querySelectorAll('[data-scelta-tema]')) pulsante.setAttribute('aria-pressed', String(pulsante.dataset.sceltaTema === corrente));
    for (const editor of document.querySelectorAll('[data-editor-tema]')) editor.hidden = corrente !== 'personale';
    // Il grafico dei tassi legge alcuni colori al momento del disegno: lo si ridisegna.
    if (ricorda && window.Mutuo && window.Mutuo.ridisegnaTassi && document.querySelector('#scheda-tassi:not([hidden])')) window.Mutuo.ridisegnaTassi();
  }
  function applicaVersione(codice, ricorda) {
    versione = codice === 'avanzata' ? 'avanzata' : 'semplice';
    radice.setAttribute('data-versione', versione);
    for (const pulsante of document.querySelectorAll('[data-scelta-versione]')) pulsante.setAttribute('aria-pressed', String(pulsante.dataset.sceltaVersione === versione));
    const etichetta = document.querySelector('#scegli-tema .impostazione-attuale');
    if (etichetta) etichetta.textContent = VERSIONI.find(v => v.codice === versione).nome;
    if (ricorda) { scrivi(versione, CHIAVE_VERSIONE); document.dispatchEvent(new CustomEvent('cambio-versione', { detail: versione })); }
  }
  function applicaOpzione(codice, acceso) {
    scrivi(acceso ? 'si' : 'no', 'assistente-' + codice);
    for (const casella of document.querySelectorAll(`[data-opzione-assistente="${codice}"]`)) casella.checked = acceso;
    document.dispatchEvent(new CustomEvent('cambio-assistente', { detail: codice }));
  }
  applica(corrente, false);
  applicaVersione(versione, false);
  // In «Automatico» il tema cambia con il sistema: si aggiorna il colore della barra.
  try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (corrente === 'auto') aggiornaBarraBrowser(); }); } catch { /* browser vecchi */ }

  // ---------- Le scelte ----------
  function elemento(tag, classe, attributi = {}, testo) {
    const el = document.createElement(tag);
    if (classe) el.className = classe;
    for (const [k, v] of Object.entries(attributi)) el.setAttribute(k, v);
    if (testo != null) el.textContent = testo;
    return el;
  }
  // Una piccola pagina finta con i colori del tema: barra laterale, riquadro della rata, due righe, un pulsante.
  function anteprima(codice) {
    const contenitore = elemento('span', 'anteprima-tema', { 'aria-hidden': 'true' });
    for (const c of codice === 'auto' ? ['chiaro', 'notte'] : [codice]) {
      const mini = elemento('span', 'mini', { 'data-tema': c });
      mini.append(elemento('i', 'mini-lato'), elemento('i', 'mini-eroe'), elemento('i', 'mini-riga'), elemento('i', 'mini-riga corta'), elemento('i', 'mini-pillola'));
      contenitore.append(mini);
    }
    return contenitore;
  }
  function griglia() {
    const g = elemento('div', 'griglia-temi', { role: 'group', 'aria-label': 'Temi disponibili' });
    for (const t of TEMI) {
      const pulsante = elemento('button', 'tessera-tema', { type: 'button', 'data-scelta-tema': t.codice, 'aria-pressed': String(t.codice === corrente) });
      pulsante.append(anteprima(t.codice), elemento('span', 'nome-tema', {}, t.nome), elemento('span', 'descrizione-tema', {}, t.descrizione));
      g.append(pulsante);
    }
    return g;
  }
  // I cinque colori di base e gli angoli di un tema qualunque, per «Parti da un tema». Per i temi scritti a mano in
  // stile.css si leggono i colori veri da un elemento nascosto con il loro data-tema.
  function coloriDelTema(codice) {
    if (CALCOLATI[codice]) { const c = CALCOLATI[codice]; return { pagina: c.pagina, superficie: c.superficie, testo: c.testo, accento: c.accento, secondo: c.secondo, angoli: c.angoli }; }
    const prova = elemento('span', '', { 'data-tema': codice, hidden: '' });
    document.body.append(prova);
    const st = getComputedStyle(prova), voce = nome => st.getPropertyValue(nome).trim();
    const g = document.createElement('canvas').getContext('2d');
    const inHex = colore => {   // il browser riscrive qualunque colore come #rrggbb o rgba(…): la trasparenza si ignora
      g.fillStyle = '#000000'; g.fillStyle = colore || '#000000';
      const n = String(g.fillStyle).match(/[\d.]+/g);
      return String(g.fillStyle).startsWith('#') ? g.fillStyle : inEsa(n.slice(0, 3).map(Number));
    };
    const sfumatura = (voce('--logo').match(/#[0-9a-f]{3,6}\b|rgba?\([^)]*\)/gi) || []);
    const raggio = parseFloat(voce('--r2')) || 12;
    const r = {
      pagina: inHex(voce('--pagina')), superficie: inHex(voce('--superficie')), testo: inHex(voce('--inchiostro')), accento: inHex(voce('--accento')),
      secondo: inHex(sfumatura[sfumatura.length - 1] || voce('--accento')),
      angoli: raggio <= 6 ? 'squadrati' : raggio <= 13 ? 'normali' : raggio <= 17 ? 'morbidi' : 'tondi',
    };
    prova.remove();
    return r;
  }
  // «Il tuo tema»: compare sotto i temi quando è scelto.
  function editorTema() {
    const box = elemento('div', 'editor-tema', { 'data-editor-tema': '' });
    box.hidden = corrente !== 'personale';
    const campi = elemento('div', 'campi-tema');
    const parti = elemento('label', 'campo-tema campo-largo');
    const tendina = elemento('select', '', { 'data-personale-parti': '' });
    tendina.append(new Option('Scegli un tema da cui partire…', ''));
    for (const t of TEMI) if (t.codice !== 'auto' && t.codice !== 'personale') tendina.append(new Option(t.nome, t.codice));
    parti.append(elemento('span', 'nome-campo-tema', {}, 'Parti da un tema'), tendina);
    campi.append(parti);
    for (const c of COLORI_PERSONALI) {
      const etichetta = elemento('label', 'campo-tema campo-colore');
      const scelta = elemento('input', '', { type: 'color', 'data-personale': c.campo });
      scelta.value = personale[c.campo];
      const testo = elemento('span', 'nome-campo-tema', {}, c.nome);
      if (c.aiuto) testo.append(elemento('small', '', {}, c.aiuto));
      etichetta.append(scelta, testo);
      campi.append(etichetta);
    }
    const angoli = elemento('label', 'campo-tema');
    const tendinaAngoli = elemento('select', '', { 'data-personale-angoli': '' });
    for (const [codice, a] of Object.entries(ANGOLI)) tendinaAngoli.append(new Option(a.nome, codice));
    tendinaAngoli.value = personale.angoli;
    angoli.append(elemento('span', 'nome-campo-tema', {}, 'Angoli'), tendinaAngoli);
    campi.append(angoli);
    box.append(
      elemento('p', 'nota', {}, 'Scegli i colori: la pagina cambia mentre li provi. Gli altri colori (linee, righe del piano, avvisi) li ricava il programma, e scurisce o schiarisce da solo le scritte colorate perché si leggano sempre.'),
      campi,
      elemento('p', 'nota avviso-contrasto', { 'data-avviso-contrasto': '', hidden: '' }),
      elemento('button', 'secondario piccolo', { type: 'button', 'data-personale-ripristina': '' }, 'Torna ai colori di partenza'));
    return box;
  }
  function avvisoContrasto() {
    const peggiore = Math.min(contrasto(personale.testo, personale.superficie), contrasto(personale.testo, personale.pagina));
    if (peggiore >= 4.5) return '';
    const piuScuro = luce(personale.superficie) > 0.18;
    return `Attenzione: il testo si legge ${peggiore < 3 ? 'molto ' : ''}male su questi sfondi. Scegli un testo più ${piuScuro ? 'scuro' : 'chiaro'}, o sfondi più ${piuScuro ? 'chiari' : 'scuri'}.`;
  }
  function aggiornaEditor() {
    for (const scelta of document.querySelectorAll('[data-personale]')) if (scelta.value !== personale[scelta.dataset.personale]) scelta.value = personale[scelta.dataset.personale];
    for (const t of document.querySelectorAll('[data-personale-angoli]')) t.value = personale.angoli;
    const testo = avvisoContrasto();
    for (const avviso of document.querySelectorAll('[data-avviso-contrasto]')) { avviso.textContent = testo; avviso.hidden = !testo; }
  }
  let ridisegnoInAttesa = 0;
  function impostaPersonale(p, ricorda = true) {
    personale = personaleValido(p);
    stilePersonale.textContent = blocco('personale', personale);
    if (ricorda) scrivi(JSON.stringify(personale), 'tema-personale');
    aggiornaEditor();
    if (corrente === 'personale') {
      aggiornaBarraBrowser();
      clearTimeout(ridisegnoInAttesa);   // il grafico dei tassi legge i colori quando si disegna: lo si rifà, ma non a ogni movimento
      ridisegnoInAttesa = setTimeout(() => { if (window.Mutuo && window.Mutuo.ridisegnaTassi && document.querySelector('#scheda-tassi:not([hidden])')) window.Mutuo.ridisegnaTassi(); }, 250);
    }
  }
  // I caratteri: per testo, titoli e cifre una tendina, la casella per un carattere scritto a mano e un esempio.
  const ESEMPI = { testo: 'La rata di marzo torna al centesimo.', titoli: 'Il piano delle rate', numeri: '0123456789 · 712,35 €' };
  function sceltaCaratteri() {
    const box = elemento('div', 'scelta-caratteri');
    for (const u of USI) {
      const riga = elemento('div', 'riga-carattere');
      const etichetta = elemento('label', 'campo-tema');
      const tendina = elemento('select', '', { 'data-carattere-uso': u.uso });
      tendina.append(new Option('Quello del tema', ''));
      for (const c of CARATTERI) tendina.append(new Option(c.nome, c.codice));
      tendina.append(new Option('Un altro, scritto da me…', 'altro'));
      etichetta.append(elemento('span', 'nome-campo-tema', {}, u.nome), tendina);
      const altro = elemento('input', '', { type: 'text', 'data-carattere-altro': u.uso, maxlength: '60', spellcheck: 'false', autocomplete: 'off',
        placeholder: 'Il nome, per esempio Comic Sans MS', 'aria-label': `Nome del carattere per: ${u.nome.toLowerCase()}` });
      riga.append(etichetta, altro, elemento('span', 'esempio-carattere', { 'data-carattere-esempio': u.uso }, ESEMPI[u.uso]), elemento('span', 'nota piccola', { 'data-carattere-nota': u.uso }));
      box.append(riga);
    }
    return box;
  }
  const scrittoAMano = {};   // l'utente ha scelto «Un altro…» ma non ha ancora scritto un nome
  function aggiornaCaratteri() {
    for (const { uso, variabile } of USI) {
      const scelta = caratteri[uso], aMano = !!(scelta && scelta.altro) || scrittoAMano[uso];
      for (const t of document.querySelectorAll(`[data-carattere-uso="${uso}"]`)) t.value = aMano ? 'altro' : (scelta || '');
      for (const casella of document.querySelectorAll(`[data-carattere-altro="${uso}"]`)) {
        casella.hidden = !aMano;
        if (document.activeElement !== casella && scelta && scelta.altro) casella.value = scelta.altro;
      }
      const famiglia = pilaDi(scelta) || getComputedStyle(radice).getPropertyValue(variabile);
      for (const esempio of document.querySelectorAll(`[data-carattere-esempio="${uso}"]`)) esempio.style.fontFamily = famiglia;
      const nota = scelta && scelta.altro && !installato(scelta.altro) ? `Non trovo «${scelta.altro}» su questo computer: vedi il carattere normale. Controlla il nome, o scegline uno dell'elenco.` : '';
      for (const n of document.querySelectorAll(`[data-carattere-nota="${uso}"]`)) { n.textContent = nota; n.hidden = !nota; }
    }
  }
  function impostaCaratteri(nuovi) {
    caratteri = caratteriValidi(nuovi);
    scrivi(JSON.stringify(caratteri), 'caratteri');
    applicaCaratteri();
    aggiornaCaratteri();
    if (window.Mutuo && window.Mutuo.ridisegnaTassi && document.querySelector('#scheda-tassi:not([hidden])')) window.Mutuo.ridisegnaTassi();
  }
  // Il logo (loghi.js): un'anteprima animata per ognuno; quello scelto va in testata e nella scheda del browser.
  function grigliaLoghi() {
    if (!window.Loghi) return [];
    const g = elemento('div', 'griglia-loghi', { role: 'group', 'aria-label': 'Loghi disponibili' });
    for (const l of window.Loghi.ELENCO) {
      const pulsante = elemento('button', 'tessera-logo', { type: 'button', 'data-scelta-logo': l.codice, 'aria-pressed': String(l.codice === window.Loghi.scelto()), title: l.descrizione });
      const riquadro = elemento('span', 'logo anteprima-logo', { 'aria-hidden': 'true' });
      riquadro.append(window.Loghi.crea(l.codice));
      pulsante.append(riquadro, elemento('span', '', {}, l.nome));
      g.append(pulsante);
    }
    return [elemento('h3', '', {}, 'Logo'), elemento('p', 'nota', {}, 'Il disegno in alto e nella scheda del browser, e l\'animazione della prima pagina. Cambia solo l\'aspetto.'), g];
  }
  // L'aspetto del robottino (assistente.js): un'anteprima per ognuno, con le stesse espressioni dell'assistente vero.
  function grigliaAvatar() {
    if (!window.Assistente || !window.Assistente.AVATAR) return [];
    const g = elemento('div', 'griglia-avatar', { role: 'group', 'aria-label': 'Aspetti del robottino' });
    for (const a of window.Assistente.AVATAR) {
      if (a.nascosto) continue;   // tolti dalla scelta (assistente.js)
      const pulsante = elemento('button', 'tessera-avatar', { type: 'button', 'data-scelta-avatar': a.codice, 'aria-pressed': String(a.codice === window.Assistente.avatarScelto()), title: a.descrizione });
      const riquadro = elemento('span', 'anteprima-avatar', { 'aria-hidden': 'true' });
      riquadro.innerHTML = window.Assistente.disegnoAvatar(a.codice);
      pulsante.append(riquadro, elemento('span', '', {}, a.nome));
      g.append(pulsante);
    }
    return [elemento('p', 'nota', {}, 'Il suo aspetto: scegli quello che ti sta più simpatico. Cambia solo il disegno, non quello che dice.'), g];
  }
  // Versione, assistente, colori e logo: le stesse scelte nel riquadro della testata e nel pannello di controllo.
  function scelte() {
    const blocco = elemento('div', 'scelte-impostazioni');
    const versioni = elemento('div', 'scelta-versione', { role: 'group', 'aria-label': 'Versione della pagina' });
    for (const v of VERSIONI) {
      const pulsante = elemento('button', 'tessera-versione', { type: 'button', 'data-scelta-versione': v.codice, 'aria-pressed': String(v.codice === versione) });
      pulsante.append(elemento('span', 'nome-tema', {}, v.nome), elemento('span', 'descrizione-tema', {}, v.descrizione));
      versioni.append(pulsante);
    }
    const opzioni = elemento('div', 'opzioni-assistente');
    for (const o of OPZIONI) {
      const etichetta = elemento('label', 'opzione-assistente');
      const casella = elemento('input', '', { type: 'checkbox', 'data-opzione-assistente': o.codice });
      casella.checked = opzione(o.codice);
      etichetta.append(casella, document.createTextNode(' ' + o.nome));
      opzioni.append(etichetta);
    }
    blocco.append(
      elemento('h3', '', {}, 'Versione della pagina'),
      elemento('p', 'nota', {}, 'La semplice mostra solo l\'essenziale; l\'avanzata aggiunge gli strumenti per chi conosce bene il contratto. I dati sono gli stessi: puoi cambiare quando vuoi.'),
      versioni,
      elemento('h3', '', {}, 'L\'assistente'),
      opzioni,
      ...grigliaAvatar(),
      elemento('h3', '', {}, 'Colori'),
      griglia(),
      editorTema(),
      elemento('h3', '', {}, 'Caratteri'),
      elemento('p', 'nota', {}, 'Valgono con qualunque tema. Si usano i caratteri già presenti sul computer: «Quello del tema» lascia la scelta del tema.'),
      sceltaCaratteri(),
      ...grigliaLoghi());
    blocco.addEventListener('click', evento => {
      const tema = evento.target.closest('[data-scelta-tema]'), scelta = evento.target.closest('[data-scelta-versione]'), logo = evento.target.closest('[data-scelta-logo]'), avatar = evento.target.closest('[data-scelta-avatar]');
      if (tema) applica(tema.dataset.sceltaTema, true);
      if (scelta) applicaVersione(scelta.dataset.sceltaVersione, true);
      if (logo) window.Loghi.scegli(logo.dataset.sceltaLogo);
      if (avatar) window.Assistente.scegliAvatar(avatar.dataset.sceltaAvatar);
      if (evento.target.closest('[data-personale-ripristina]')) impostaPersonale(PERSONALE_INIZIALE);
    });
    blocco.addEventListener('input', evento => {
      const colore = evento.target.closest('[data-personale]'), altro = evento.target.closest('[data-carattere-altro]');
      if (colore) impostaPersonale({ ...personale, [colore.dataset.personale]: colore.value });
      if (altro) {
        const nome = nomeSicuro(altro.value), nuovi = { ...caratteri };
        if (nome) nuovi[altro.dataset.carattereAltro] = { altro: nome }; else delete nuovi[altro.dataset.carattereAltro];
        impostaCaratteri(nuovi);
      }
    });
    blocco.addEventListener('change', evento => {
      const casella = evento.target.closest('[data-opzione-assistente]');
      if (casella) applicaOpzione(casella.dataset.opzioneAssistente, casella.checked);
      const parti = evento.target.closest('[data-personale-parti]'), angoli = evento.target.closest('[data-personale-angoli]'), uso = evento.target.closest('[data-carattere-uso]');
      if (parti && parti.value) { impostaPersonale(coloriDelTema(parti.value)); applica('personale', true); parti.value = ''; }
      if (angoli) impostaPersonale({ ...personale, angoli: angoli.value });
      if (uso) {
        const nuovi = { ...caratteri }, chi = uso.dataset.carattereUso;
        scrittoAMano[chi] = uso.value === 'altro';
        if (uso.value === 'altro') {
          const casella = uso.closest('.riga-carattere').querySelector('[data-carattere-altro]');
          const nome = nomeSicuro(casella.value);
          if (nome) nuovi[chi] = { altro: nome }; else delete nuovi[chi];
          impostaCaratteri(nuovi);
          casella.focus();
        } else {
          if (uso.value) nuovi[chi] = uso.value; else delete nuovi[chi];
          impostaCaratteri(nuovi);
        }
      }
    });
    return blocco;
  }

  function costruisci() {
    // Riquadro che si apre dal pulsante «Impostazioni»: vicino al pulsante sugli schermi grandi, dal basso sui telefoni.
    const pulsante = document.getElementById('scegli-tema');
    const menu = document.getElementById('menu-temi');
    if (pulsante && menu) {
      const chiudi = elemento('button', 'secondario piccolo', { type: 'button' }, 'Chiudi');
      const testa = elemento('div', 'testa-menu');
      testa.append(elemento('h2', '', { id: 'titolo-menu-temi' }, 'Impostazioni'), chiudi);
      menu.setAttribute('aria-labelledby', 'titolo-menu-temi');
      menu.append(testa, scelte(), elemento('p', 'nota piccola', {}, 'Le scelte restano in questo browser: i dati e i calcoli non cambiano.'));
      const posiziona = () => {
        menu.style.left = menu.style.top = '';
        if (matchMedia('(max-width: 760px)').matches) return;   // sui telefoni il riquadro sale dal basso (stile.css)
        const r = pulsante.getBoundingClientRect(), largo = menu.offsetWidth, alto = menu.offsetHeight, margine = 12;
        const inBarraLaterale = r.left < 320 && r.top > innerHeight / 2;
        let left = inBarraLaterale ? r.right + margine : Math.min(r.right - largo, innerWidth - largo - margine);
        let top = inBarraLaterale ? r.bottom - alto : r.bottom + 8;
        left = Math.max(margine, Math.min(left, innerWidth - largo - margine));
        top = Math.max(margine, Math.min(top, innerHeight - alto - margine));
        menu.style.left = left + 'px';
        menu.style.top = top + 'px';
      };
      const apri = () => { menu.hidden = false; pulsante.setAttribute('aria-expanded', 'true'); posiziona(); const scelto = menu.querySelector('[data-scelta-versione][aria-pressed="true"]'); (scelto || chiudi).focus(); };
      const nascondi = (rimettiFuoco) => { if (menu.hidden) return; menu.hidden = true; pulsante.setAttribute('aria-expanded', 'false'); if (rimettiFuoco) pulsante.focus(); };
      pulsante.addEventListener('click', () => (menu.hidden ? apri() : nascondi(false)));
      chiudi.addEventListener('click', () => nascondi(true));
      document.addEventListener('keydown', evento => { if (evento.key === 'Escape') nascondi(true); });
      document.addEventListener('pointerdown', evento => { if (!menu.hidden && !menu.contains(evento.target) && !pulsante.contains(evento.target)) nascondi(false); });
      window.addEventListener('resize', () => { if (!menu.hidden) posiziona(); });
    }
    // Le stesse scelte nel pannello di controllo.
    const nelPannello = document.getElementById('impostazioni-pannello');
    if (nelPannello) nelPannello.replaceWith(Object.assign(scelte(), { id: 'impostazioni-pannello' }));
    // «Passa alla versione avanzata», dove la semplice nasconde qualcosa.
    document.addEventListener('click', evento => { if (evento.target.closest('[data-passa-versione]')) applicaVersione(evento.target.closest('[data-passa-versione]').dataset.passaVersione, true); });
    applica(corrente, false);
    applicaVersione(versione, false);
    aggiornaEditor();
    aggiornaCaratteri();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', costruisci); else costruisci();

  window.Temi = {
    ELENCO: TEMI, corrente: () => corrente, imposta: codice => applica(codice, true),
    versione: () => versione, impostaVersione: codice => applicaVersione(codice, true), semplice: () => versione === 'semplice',
    opzione, impostaOpzione: applicaOpzione,
    personale: () => ({ ...personale }), impostaPersonale, coloriDelTema, CARATTERI, caratteri: () => JSON.parse(JSON.stringify(caratteri)), impostaCaratteri,
    contrasto, variabili,
  };
})();
