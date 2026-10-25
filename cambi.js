// Cambi del contratto dopo la firma (pagina «Dati del prestito»): rinegoziazione con la stessa banca, tasso fisso
// rivisto dopo qualche anno, passaggio da fisso a variabile o al contrario. Dalla rata scelta il piano usa le condizioni
// nuove (Calcolo.tratti). Qui si vede anche se il prestito è stato chiuso da una surroga, e da qui si apre il prestito
// nuovo che nasce dal suo debito residuo (prestiti.js, M.apriSurroga).
(function () {
  'use strict';
  const M = window.Mutuo, { stato, $, crea, euro, perc, meseAnno, esegui, leggiNumero, daPercento, perCampo } = M;
  const INDICI = ['Euribor 1 mese', 'Euribor 3 mesi', 'Euribor 6 mesi', 'Euribor 12 mesi'];
  // Il cambio che si sta scrivendo: null se il modulo è chiuso; «posizione» nell'elenco, -1 per uno nuovo.
  let modulo = null;

  const variabileAllaFirma = p => (p.tipo_prestito || 'variabile') === 'variabile';
  // Inizio del periodo della rata n, anche oltre la fine del piano di adesso.
  function inizioRata(p, n) {
    const [a, m, g] = p.data_prima_rata.split('-').map(Number);
    return new Date(Date.UTC(a, m - 1 + n - 1, g)).toISOString().slice(0, 10);
  }
  function descriviCambio(c, p) {
    const parti = [c.tipo === 'fisso' ? `tasso fisso ${perc(c.tasso_fisso, 3, 2)} (TAN)` : `tasso variabile, ${p.indice_nome || 'indice'} + ${perc(c.spread, 3, 2)} di spread`];
    if (c.rate_residue > 0) parti.push(`${c.rate_residue} rate da lì alla fine`);
    if (c.spese > 0) parti.push(`${euro(c.spese)} di spese per il cambio`);
    return parti.join(' · ');
  }
  // Rata calcolata prima e dopo il cambio, dal piano di adesso.
  function effetto(c, righe) {
    const prima = righe[c.dalla_rata - 2], dopo = righe[c.dalla_rata - 1];
    return prima && dopo ? `La rata passa da ${euro(prima.rataCalcolata)} a ${euro(dopo.rataCalcolata)}.` : '';
  }

  function disegna() {
    const carta = $('#carta-cambi');
    if (!carta || !stato.dati || !stato.piano) return;
    if (modulo && carta.contains(document.activeElement)) return;   // non si riscrive il modulo mentre lo si compila
    const p = stato.dati.parametri, righe = stato.piano.righe, cambi = stato.dati.cambi || [], ultima = righe[righe.length - 1];
    const maxirata = p.tipo_prestito === 'maxirata';
    const contenuto = [crea('h2', {}, Icone.crea('regole', 'icona icona-titolo'), 'Cambi del contratto'),
      crea('p', { className: 'nota' }, 'La banca ha cambiato le condizioni dopo la firma? Succede con una rinegoziazione, con un tasso fisso che si rivede dopo qualche anno, o con il passaggio da fisso a variabile (o al contrario). '
        + 'Scrivilo qui: dalla rata che scegli il piano usa le condizioni nuove. Le trovi nella lettera o nell\'accordo firmato con la banca; se non le hai, guarda l\'estratto conto della prima rata cambiata.')];
    if (ultima.estinto) {
      contenuto.push(crea('p', { className: 'nota evidenza' }, `Questo prestito è stato chiuso dopo la rata ${ultima.n}, di ${meseAnno(ultima.inizio)}: il debito che restava, ${euro(ultima.estinto)}, è passato a un prestito nuovo (surroga o prestito rifatto).`),
        crea('div', { className: 'azioni' }, crea('button', { type: 'button', className: 'secondario', 'data-cambi': 'riapri' }, 'Non è stato chiuso: riaprilo')));
    }
    if (maxirata) contenuto.push(crea('p', { className: 'nota' }, 'Con la maxirata finale i cambi del contratto non sono previsti: se hai rifinanziato la maxirata, aggiungi un prestito nuovo dalla pagina «Prestiti».'));
    if (cambi.length) {
      contenuto.push(crea('ul', { className: 'elenco-cambi' }, ...cambi.map((c, i) => crea('li', {},
        crea('div', {}, crea('strong', {}, `Dalla rata ${c.dalla_rata}, di ${meseAnno(inizioRata(p, c.dalla_rata))}`),
          crea('span', {}, descriviCambio(c, p)), crea('small', {}, righe[c.dalla_rata - 1] ? effetto(c, righe) : 'Questa rata non c\'è più nel piano: il cambio non conta.')),
        crea('div', { className: 'azioni' },
          crea('button', { type: 'button', className: 'secondario piccolo', 'data-cambi': 'modifica', 'data-posizione': i }, 'Modifica'),
          crea('button', { type: 'button', className: 'pericoloso piccolo', 'data-cambi': 'togli', 'data-posizione': i }, 'Togli'))))));
    }
    if (modulo) contenuto.push(creaModulo(p, righe));
    else if (!maxirata && !ultima.estinto && righe.length > 1) {
      contenuto.push(crea('div', { className: 'azioni' },
        crea('button', { type: 'button', 'data-cambi': 'nuovo' }, Icone.crea('piu', 'icona icona-aggiunta'), 'Aggiungi un cambio del contratto'),
        crea('button', { type: 'button', className: 'secondario', 'data-cambi': 'surroga' }, 'Hai cambiato banca? Nuovo prestito dal debito residuo')));
    }
    carta.replaceChildren(...contenuto);
    if (modulo) aggiornaModulo();
  }

  // Il modulo di un cambio. La rata si sceglie dall'elenco (dalla seconda); le rate che restano sono facoltative.
  function creaModulo(p, righe) {
    const c = modulo.valori, ultimaPossibile = Math.max(...righe.map(r => r.n), c.dalla_rata || 0);
    const opzioni = [];
    for (let n = 2; n <= ultimaPossibile; n++) opzioni.push(crea('option', { value: n, selected: n === c.dalla_rata }, `rata ${n}, di ${meseAnno(inizioRata(p, n))}`));
    const radio = (valore, testo, aiuto) => crea('label', { className: 'spunta' }, crea('input', { type: 'radio', name: 'tipo', value: valore, checked: c.tipo === valore }), crea('span', {}, testo, crea('small', {}, aiuto)));
    const campo = (nome, etichetta, valore, aiuto, altro = {}) => crea('label', { 'data-campo': nome }, etichetta,
      crea('input', { type: 'text', inputMode: 'decimal', name: nome, value: valore, ...altro }), crea('small', {}, aiuto));
    const casella = crea('input', { type: 'text', name: 'indice_nome', value: p.indice_nome || 'Euribor 3 mesi' });
    casella.setAttribute('list', 'indici-cambio');   // «list» si può solo scrivere come attributo
    const indice = crea('label', { 'data-campo': 'indice' }, 'Indice del tasso nuovo', casella,
      crea('datalist', { id: 'indici-cambio' }, ...INDICI.map(nome => crea('option', { value: nome }))),
      crea('small', {}, 'Scritto nell\'accordo, ad esempio «Euribor 3 mesi». I valori li scarico io da internet.'));
    const revisione = crea('label', { 'data-campo': 'revisione' }, 'Ogni quanto si aggiorna il tasso',
      crea('select', { name: 'mesi_revisione' }, ...[1, 3, 6, 12].map(n => crea('option', { value: n, selected: n === (p.mesi_revisione || 1) }, n === 1 ? 'Ogni mese' : `Ogni ${n} mesi`))),
      crea('small', {}, 'Di solito ogni mese, o con la durata dell\'Euribor (3 mesi per l\'Euribor 3 mesi).'));
    return crea('form', { id: 'form-cambio', className: 'blocco', novalidate: true },
      crea('h3', {}, modulo.posizione < 0 ? 'Un cambio nuovo' : 'Modifica il cambio'),
      crea('div', { className: 'campi due-colonne' },
        crea('label', {}, 'Prima rata con le condizioni nuove', crea('select', { name: 'dalla_rata' }, ...opzioni),
          crea('small', {}, 'La prima rata calcolata con il tasso nuovo. Nell\'accordo spesso c\'è scritto «a partire dalla rata del…».')),
        crea('fieldset', { className: 'scelte' }, crea('legend', {}, 'Il tasso da quella rata'),
          radio('fisso', 'Fisso', 'Un TAN scritto nell\'accordo, uguale per tutte le rate'), radio('variabile', 'Variabile', 'Un indice, di solito l\'Euribor, più uno spread')),
        campo('tasso_fisso', 'TAN nuovo (%)', perCampo(c.tasso_fisso, true), 'Il tasso annuo nominale scritto nell\'accordo, ad esempio 3,10.', { placeholder: 'es. 3,10' }),
        ...(variabileAllaFirma(p) ? [] : [indice, revisione]),
        campo('spread', 'Spread nuovo (%)', perCampo(c.spread, true), 'La maggiorazione che la banca somma all\'indice, ad esempio 1,20.', { placeholder: 'es. 1,20' }),
        campo('rate_residue', 'Rate che restano, compresa questa', c.rate_residue == null ? '' : String(c.rate_residue), 'Solo se il cambio allunga o accorcia il prestito. Lascia vuoto se la fine resta la stessa.', { inputMode: 'numeric' }),
        campo('spese', 'Spese per il cambio (€)', perCampo(c.spese || null), 'Facoltativo: quello che hai pagato una volta per il cambio (istruttoria, notaio, perizia). Lascia vuoto se niente.')),
      crea('p', { className: 'nota evidenza', id: 'anteprima-cambio' }),
      crea('div', { className: 'azioni' }, crea('button', { type: 'submit' }, 'Salva il cambio'), crea('button', { type: 'button', className: 'secondario', 'data-cambi': 'annulla' }, 'Annulla')));
  }

  // Legge il modulo: { cambio, parametri } oppure { errore }. Senza «severo» i campi vuoti non sono errori (anteprima).
  function leggiModulo(severo) {
    const f = $('#form-cambio'), tipo = f.tipo.value, fisso = tipo === 'fisso';
    const tasso = leggiNumero(f[fisso ? 'tasso_fisso' : 'spread'].value), rate = leggiNumero(f.rate_residue.value), spese = leggiNumero(f.spese.value, true);
    const dalla = +f.dalla_rata.value;
    if (tasso == null) return { errore: severo ? (fisso ? 'Scrivi il TAN nuovo, ad esempio 3,10.' : 'Scrivi lo spread nuovo, ad esempio 1,20.') : null };
    if (Number.isNaN(tasso) || (fisso ? tasso < 0 || tasso > 50 : tasso < -5 || tasso > 20)) return { errore: fisso ? 'Il TAN va scritto in percentuale, fra 0 e 50.' : 'Lo spread va scritto in percentuale, fra -5 e 20.' };
    if (rate != null && !(Number.isInteger(rate) && rate >= 1 && dalla - 1 + rate <= 600)) return { errore: 'Le rate che restano sono un numero intero, da 1 in su (al massimo fino alla rata 600).' };
    if (spese != null && (Number.isNaN(spese) || spese < 0)) return { errore: 'Le spese per il cambio sono una cifra in euro, ad esempio 250.' };
    const cambio = { dalla_rata: dalla, tipo, ...(fisso ? { tasso_fisso: daPercento(tasso) } : { spread: daPercento(tasso) }), rate_residue: rate, spese: spese || 0 };
    const p = stato.dati.parametri, parametri = {};
    if (!fisso && !variabileAllaFirma(p)) {
      const indice = f.indice_nome.value.trim();
      if (!indice) return { errore: 'Scrivi l\'indice del tasso nuovo, ad esempio «Euribor 3 mesi».' };
      Object.assign(parametri, { indice_nome: indice, mesi_revisione: +f.mesi_revisione.value });
    }
    return { cambio, parametri };
  }
  // L'elenco dei cambi con quello del modulo al suo posto.
  function elencoCon(cambio) {
    const cambi = (stato.dati.cambi || []).filter((_, i) => i !== modulo.posizione);
    return [...cambi.filter(c => c.dalla_rata !== cambio.dalla_rata), cambio].sort((a, b) => a.dalla_rata - b.dalla_rata);
  }
  // Campi che servono per il tipo di tasso scelto, e anteprima della rata con le condizioni nuove.
  function aggiornaModulo() {
    const f = $('#form-cambio');
    if (!f) return;
    const fisso = f.tipo.value === 'fisso';
    for (const label of f.querySelectorAll('[data-campo]')) {
      const nome = label.dataset.campo;
      label.hidden = nome === 'tasso_fisso' ? !fisso : ['spread', 'indice', 'revisione'].includes(nome) ? fisso : false;
    }
    const dalla = +f.dalla_rata.value, riga = stato.piano.righe[dalla - 1];
    f.rate_residue.placeholder = riga ? `${riga.rateResidue}, come adesso` : '';
    const nota = $('#anteprima-cambio'), letto = leggiModulo(false);
    if (letto.errore || !letto.cambio) { nota.textContent = letto.errore || 'Scrivi il tasso nuovo: qui vedrai come cambia la rata.'; return; }
    const dati = { ...stato.dati, parametri: { ...stato.dati.parametri, ...letto.parametri }, cambi: elencoCon(letto.cambio) };
    const nuove = Calcolo.calcolaPiano(dati, { previsione: M.perPiano ? M.perPiano(dati) : null }).righe;
    const prima = stato.piano.righe[dalla - 2], dopo = nuove[dalla - 1], fine = nuove[nuove.length - 1];
    if (!prima || !dopo) { nota.textContent = ''; return; }
    nota.textContent = `Con queste condizioni la rata di ${meseAnno(dopo.inizio)} è di ${euro(dopo.rataCalcolata)} (quella prima era di ${euro(prima.rataCalcolata)}); l'ultima rata è a ${meseAnno(fine.inizio)}.`
      + (dopo.origineEuribor === 'previsione' ? ' L\'indice di quel mese non c\'è ancora: la rata è una stima.' : '');
  }

  // Un prestito fisso che diventa variabile: i valori dell'indice, quelli già nel programma e poi da internet.
  async function prendiValori() {
    if (stato.dati.euribor.length || !Calcolo.conVariabile(stato.dati)) return;
    const pronti = Archivio.precaricati(stato.dati.parametri.indice_nome, TassiInternet.inizioScarico(stato.dati.parametri.data_prima_rata));
    if (pronti.length) await esegui('POST', 'euribor', { righe: pronti });
    if (M.aggiornaTassi) M.aggiornaTassi();
  }

  $('#carta-cambi').addEventListener('click', async evento => {
    const pulsante = evento.target.closest('button[data-cambi]');
    if (!pulsante) return;
    const azione = pulsante.dataset.cambi, posizione = +pulsante.dataset.posizione, cambi = stato.dati.cambi || [];
    if (azione === 'nuovo') {
      // Di base la prima rata non ancora addebitata, e il tipo di tasso che c'è in quel momento.
      const riga = stato.piano.righe.find(r => r.n > 1 && r.fine >= stato.oggi) || stato.piano.righe[1];
      const fisso = riga.origineEuribor === 'fisso';
      modulo = { posizione: -1, valori: { dalla_rata: riga.n, tipo: fisso ? 'fisso' : 'variabile', tasso_fisso: fisso ? riga.spread : null, spread: fisso ? null : riga.spread, rate_residue: null, spese: 0 } };
    } else if (azione === 'modifica') modulo = { posizione, valori: { ...cambi[posizione] } };
    else if (azione === 'annulla') modulo = null;
    else if (azione === 'togli') {
      if (!confirm(`Togliere il cambio dalla rata ${cambi[posizione].dalla_rata}?\n\nDa quella rata il piano torna alle condizioni di prima.`)) return;
      modulo = null;
      return void await esegui('PUT', 'cambi', { cambi: cambi.filter((_, i) => i !== posizione) }, 'Cambio tolto: il piano è ricalcolato');
    } else if (azione === 'riapri') return void await esegui('PUT', 'parametri', { estinto_dopo_rata: 0 }, 'Prestito riaperto: il piano arriva di nuovo fino alla fine');
    else if (azione === 'surroga') return M.apriSurroga(stato.dati.id);
    if (document.activeElement) document.activeElement.blur();
    disegna();
    const primo = $('#form-cambio select');
    if (primo) primo.focus();
  });
  $('#carta-cambi').addEventListener('input', aggiornaModulo);
  $('#carta-cambi').addEventListener('change', aggiornaModulo);
  $('#carta-cambi').addEventListener('submit', async evento => {
    evento.preventDefault();
    const letto = leggiModulo(true);
    if (letto.errore) return M.avvisa(letto.errore, true);
    const cambi = elencoCon(letto.cambio), parametri = Object.keys(letto.parametri).length ? letto.parametri : undefined;
    const fatto = modulo;
    modulo = null;
    if (document.activeElement) document.activeElement.blur();
    if (!await esegui('PUT', 'cambi', { cambi, parametri }, 'Cambio salvato: il piano è ricalcolato')) { modulo = fatto; return disegna(); }
    await prendiValori();
  });
  M.cambioPrestito.push(() => { modulo = null; });
  M.viste.push(disegna);
})();
