// Configurazione del mutuo: guida iniziale a passi, modulo delle regole nel pannello di controllo,
// taratura automatica delle regole sulle rate vere, backup dei dati su file.
(function () {
  'use strict';
  const M = window.Mutuo;
  const { stato, $, crea, esegui, avvisa, euro, perc, data, leggiNumero, daPercento, perCampo } = M;
  const CAMPI = Archivio.CAMPI;

  // ---------- Campi dei moduli, costruiti dalla descrizione in archivio.js ----------
  // "esteso": le scelte diventano un elenco con la spiegazione di ogni voce (guida); altrimenti un menu a tendina (pannello).
  // "p": i parametri di adesso, per mostrare solo le scelte che hanno senso (ad esempio niente quote fisse a tasso fisso).
  const opzioniPer = (campo, p) => campo.opzioni.filter(o => !o.se || o.se(p) || o.valore === p[campo.chiave]);
  function creaCampo(chiave, valore, esteso, p = {}) {
    const campo = { ...CAMPI[chiave], chiave };
    if (campo.opzioni) campo.opzioni = opzioniPer(campo, p);
    const aiuto = campo.aiuto ? [crea('small', {}, campo.aiuto)] : [];
    if (campo.tipo === 'scelta' && esteso) {
      return crea('fieldset', { className: 'campo scelte', 'data-campo': chiave }, crea('legend', {}, campo.etichetta),
        ...campo.opzioni.map(o => crea('label', { className: 'scelta' },
          crea('input', { type: 'radio', name: chiave, value: String(o.valore), checked: o.valore === valore }),
          crea('span', {}, crea('strong', {}, o.etichetta), ...(o.aiuto ? [crea('small', {}, o.aiuto)] : [])))));
    }
    let controllo;
    if (campo.tipo === 'scelta') {
      controllo = crea('select', { name: chiave }, ...campo.opzioni.map(o => crea('option', { value: String(o.valore), selected: o.valore === valore, title: o.aiuto || '' }, o.etichetta)));
    } else if (campo.tipo === 'data') controllo = crea('input', { type: 'date', name: chiave, value: valore || '' });
    else if (campo.tipo === 'testo') {
      controllo = crea('input', { type: 'text', name: chiave, value: valore || '', maxLength: 80 });
      if (campo.suggerimenti) {
        controllo.setAttribute('list', 'suggerimenti-' + chiave);
        aiuto.push(crea('datalist', { id: 'suggerimenti-' + chiave }, ...campo.suggerimenti.map(s => crea('option', { value: s }))));
      }
    } else controllo = crea('input', { type: 'text', inputMode: 'decimal', name: chiave, value: perCampo(valore, campo.tipo === 'percento') });
    return crea('label', { className: 'campo', 'data-campo': chiave }, campo.etichetta + (campo.obbligatorio ? ' *' : ''), controllo, ...aiuto);
  }
  // Legge i campi presenti in un modulo. Restituisce { valori } oppure { errore }.
  function leggiCampi(modulo, chiavi) {
    const valori = {};
    for (const chiave of chiavi) {
      const campo = CAMPI[chiave], contenitore = $(`[data-campo="${chiave}"]`, modulo);
      if (!contenitore || contenitore.hidden) continue;
      if (campo.tipo === 'scelta') {
        const scelto = contenitore.matches('fieldset') ? ($('input:checked', contenitore) || {}).value : $('select', contenitore).value;
        const opzione = campo.opzioni.find(o => String(o.valore) === scelto);
        if (!opzione) return { errore: `Scegli una voce: ${campo.etichetta}` };
        valori[chiave] = opzione.valore;
        continue;
      }
      const testo = $('input', contenitore).value.trim();
      if (!testo) {
        if (campo.obbligatorio) return { errore: `Manca: ${campo.etichetta}` };
        if (campo.tipo === 'testo' || campo.tipo === 'data') { if (campo.tipo === 'testo') valori[chiave] = ''; continue; }
        valori[chiave] = campo.iniziale != null ? campo.iniziale : 0;
        continue;
      }
      if (campo.tipo === 'testo' || campo.tipo === 'data') { valori[chiave] = testo; continue; }
      const v = leggiNumero(testo, campo.tipo !== 'percento');
      if (v == null || Number.isNaN(v)) return { errore: `Numero non valido: ${campo.etichetta}` };
      valori[chiave] = campo.tipo === 'percento' ? daPercento(v) : v;
    }
    return { valori };
  }
  // Mostra solo i campi che hanno senso con le scelte fatte (ad esempio il tasso del piano solo per le quote fisse).
  function aggiornaVisibili(modulo, chiavi, base) {
    const letti = leggiCampi(modulo, chiavi.filter(c => CAMPI[c].tipo === 'scelta')).valori || {};
    const numeri = {};
    for (const chiave of chiavi) {
      const input = $(`[data-campo="${chiave}"] input[type="text"]`, modulo);
      if (input && CAMPI[chiave].tipo !== 'testo') { const v = leggiNumero(input.value); if (typeof v === 'number' && !Number.isNaN(v)) numeri[chiave] = v; }
    }
    const p = { ...base, ...numeri, ...letti };
    for (const chiave of chiavi) {
      const contenitore = $(`[data-campo="${chiave}"]`, modulo);
      if (contenitore && CAMPI[chiave].se) contenitore.hidden = !CAMPI[chiave].se(p);
    }
  }

  // Descrizione in parole di un insieme di regole.
  const nomeScelta = (chiave, valore) => (CAMPI[chiave].opzioni.find(o => o.valore === valore) || {}).etichetta || String(valore);
  const variabile = p => (p.tipo_prestito || 'variabile') === 'variabile';
  function descriviRegole(p) {
    const rilevazione = p.regola_rilevazione === 'lavorativi_prima' ? `${p.giorni_anticipo_euribor} giorni lavorativi prima dell'inizio del periodo`
      : p.regola_rilevazione === 'giorno_fisso' ? `il giorno ${p.giorno_rilevazione} del mese precedente` : nomeScelta('regola_rilevazione', p.regola_rilevazione).toLowerCase();
    const piano = nomeScelta('tipo_piano', p.tipo_piano) + (variabile(p) && p.tipo_piano === 'quote_fisse' && p.tasso_annuo_piano > 0 ? ` al ${perc(p.tasso_annuo_piano, 3)}` : '');
    return [['Capitale', piano], ...(!variabile(p) && p.arrotonda_rata && p.arrotonda_rata !== 'centesimo' ? [['Rata arrotondata', nomeScelta('arrotonda_rata', p.arrotonda_rata).toLowerCase()]] : []),
      ...(variabile(p) ? [['Indice letto', rilevazione], ['Tasso aggiornato', nomeScelta('mesi_revisione', p.mesi_revisione || 1).toLowerCase()]] : []),
      ['Interessi', nomeScelta('conteggio_giorni', p.conteggio_giorni)], ['Spese per rata', p.spese_rata > 0 ? euro(p.spese_rata) : 'nessuna']];
  }

  // Avviso per quando più combinazioni di regole riproducono le stesse rate (succede se le rate sono poche).
  function testoDubbio(d) {
    const tassi = d.tassoDa != null && d.tassoDa !== d.tassoA ? `, tasso iniziale del piano fra ${perc(d.tassoDa, 3)} e ${perc(d.tassoA, 3)}` : '';
    return `Attenzione: con queste rate sono compatibili ${d.combinazioni} combinazioni diverse (spese per rata fra ${euro(d.speseDa)} e ${euro(d.speseA)}${tassi}). `
      + 'Ho scelto quella con le spese più «tonde», che di solito è quella giusta. Per esserne sicuro: controlla le spese sulla ricevuta di una rata, oppure scrivi la quota capitale della prima rata, oppure inserisci più rate.';
  }

  // ---------- Configurazione guidata ----------
  // È pensata per chi non conosce la materia: un argomento per schermata e, per ogni domanda, che cosa si chiede,
  // dove trovarlo e che cosa fare se non lo si sa. "nonSo": il programma può ricavare la risposta dalle rate già pagate.
  const DOMANDE = {
    tipo_prestito: { domanda: 'Che prestito è?',
      cosa: 'Il programma segue sia i mutui sia i finanziamenti. Cambia soprattutto il tasso: se segue un indice di mercato (variabile) o se è scritto nel contratto e non cambia (fisso).',
      dove: 'Nel contratto, nella parte sul tasso di interesse: «tasso variabile» con un indice come l\'Euribor, oppure «tasso fisso» con il TAN.' },
    nome: { domanda: 'Come vuoi chiamare questo prestito?', cosa: 'Un nome a piacere: serve solo a riconoscerlo, soprattutto se ne segui più di uno.', esempio: 'Casa di via Roma, Auto, Cucina' },
    importo_iniziale: { domanda: 'Quanto ti hanno prestato?',
      cosa: 'La somma prestata dalla banca o dalla finanziaria, detta «capitale». Non è il prezzo della casa o dell\'auto e non è quello che ti resta da pagare oggi.',
      dove: 'Nel contratto cerca «importo del mutuo», «importo totale del credito», «capitale erogato» o «somma mutuata». La trovi anche in cima al piano di ammortamento, come debito iniziale.',
      esempio: '150.000 per un mutuo, 15.000 per un finanziamento' },
    numero_rate: { domanda: 'In quante rate mensili lo restituisci?',
      cosa: 'Il numero totale di rate previste dal contratto, comprese quelle che hai già pagato.',
      dove: 'Nel contratto alla voce «durata» o «numero di rate». Nel piano di ammortamento è il numero dell\'ultima riga.',
      esempio: '20 anni sono 240 rate, 30 anni sono 360; un finanziamento di 5 anni sono 60 rate. Con la maxirata conta solo le rate normali: per «35 rate da 199 € + maxirata» scrivi 35' },
    maxirata: { domanda: 'Quanto vale la maxirata finale?',
      cosa: 'L\'ultima rata, molto più grande delle altre: la paghi il mese dopo l\'ultima rata normale. Si chiama anche «rata finale», «rata residua» o «valore futuro garantito». Le rate normali sono più basse proprio perché una parte del debito la restituisci con la maxirata, ma su quella parte paghi gli interessi per tutta la durata.',
      dove: 'Nel contratto o nel SECCI, vicino al numero di rate: «35 rate da … € e una rata finale di … €». Anche nella pubblicità dell\'offerta.',
      esempio: '10.000' },
    anticipo: { domanda: 'Quanto hai pagato di anticipo? (facoltativo)',
      cosa: 'La somma pagata subito al venditore, senza prestito. Non cambia rate né TAEG: serve a mostrarti quanto paghi in tutto, anticipo compreso.',
      dove: 'Nel contratto di acquisto o nella pubblicità dell\'offerta: «anticipo», «primo versamento» o «acconto».', seNonSai: 'Lascia 0.' },
    spese_iniziali: { domanda: 'Quanto hai pagato all\'inizio, una volta sola?',
      cosa: 'Le spese pagate alla firma o trattenute dalla somma prestata: istruttoria, perizia della casa, imposta sostitutiva (nei mutui) o imposta di bollo (nei finanziamenti). Non cambiano le rate, ma fanno parte del costo del prestito.',
      dove: 'Nel contratto o nel foglio informativo (PIES per i mutui, SECCI per i finanziamenti), alla voce «spese» o «costi». Se la somma accreditata sul conto era più bassa di quella prestata, la differenza sono queste spese.',
      seNonSai: 'Lascia 0: le rate restano giuste, solo il costo totale e il TAEG saranno un po\' più bassi del vero.' },
    assicurazione_iniziale: { domanda: 'Hai pagato un\'assicurazione tutta all\'inizio?',
      cosa: 'Alcuni prestiti hanno un\'assicurazione (sulla vita, sull\'impiego, sulla casa) pagata con un premio unico all\'inizio, a volte aggiunto alla somma prestata.',
      dove: 'Nel contratto o nel modulo dell\'assicurazione, alla voce «premio unico».', seNonSai: 'Lascia 0.' },
    assicurazione_rata: { domanda: 'Paghi un\'assicurazione ogni mese?',
      cosa: 'Il premio mensile di un\'assicurazione legata al prestito, se lo paghi a parte. Se la banca lo addebita dentro la rata, scrivilo invece fra le spese per rata, così la rata calcolata torna con quella addebitata.',
      dove: 'Nell\'estratto conto o nel modulo dell\'assicurazione.', seNonSai: 'Lascia 0.' },
    spese_annue: { domanda: 'Ci sono spese una volta all\'anno?', cosa: 'Ad esempio l\'imposta di bollo sul rendiconto annuale, di solito 2 euro. Lascia 0 se non ci sono.' },
    spese_nel_prestito: { domanda: 'Come hai pagato le spese iniziali e l\'assicurazione?',
      cosa: 'Ci sono due modi. O le paghi a parte, con soldi tuoi, e ricevi tutta la somma prestata; oppure la banca le toglie dalla somma che ti accredita, o le aggiunge al prestito, e le restituisci con le rate. Il TAEG non cambia; cambia quanto paghi in tutto, perché nel secondo caso le spese sono già dentro le rate.',
      dove: 'Confronta la somma che hai ricevuto con l\'importo del contratto: se è più bassa, o se l\'importo è più alto del prezzo di quello che hai comprato, le spese sono dentro il prestito. Nel SECCI l\'«importo totale del credito» è la somma che ricevi davvero.',
      seNonSai: 'Lascia «A parte»: cambia solo il totale da pagare, non le rate.' },
    arrotonda_rata: { domanda: 'La banca arrotonda la rata?',
      cosa: 'A tasso fisso la rata esatta ha tanti decimali. Quasi sempre viene arrotondata al centesimo, ma alcune banche e finanziarie la arrotondano ai 10 centesimi o all\'euro (ad esempio 209,09 diventa 209,10). In quel caso l\'ultima rata è un po\' più bassa e chiude il debito.',
      dove: 'Confronta la rata del contratto con quella che calcola il programma: se differiscono di pochi centesimi è un arrotondamento.',
      nonSo: 'Lo ricava il programma dalle rate che inserirai più avanti.' },
    tasso_fisso: { domanda: 'Qual è il tasso del prestito?',
      cosa: 'Il tasso annuo nominale, cioè il tasso usato per calcolare gli interessi di ogni rata. Non è il TAEG, che è più alto perché conta anche spese e assicurazioni.',
      dove: 'Nel contratto o nel foglio informativo, alla voce «TAN» o «tasso annuo nominale». Nei mutui a tasso fisso è il «tasso di interesse» del contratto.',
      esempio: '3,2 per un mutuo, 7,9 per un finanziamento, 0 per un «tasso zero» (senza il segno %)' },
    taeg_dichiarato: { domanda: 'Qual è il TAEG scritto nel contratto? (facoltativo)',
      cosa: 'Il «tasso annuo effettivo globale»: misura il costo totale del prestito, compresi interessi, spese e assicurazioni obbligatorie, in percentuale all\'anno. Serve a confrontare prestiti diversi. Il programma lo calcola da solo e, se lo scrivi, ti dice se il suo calcolo coincide con quello della banca.',
      dove: 'Nel contratto, nel foglio informativo (SECCI per i finanziamenti, PIES per i mutui) o nella pubblicità del prestito, sempre vicino al TAN.',
      seNonSai: 'Lascia 0. Per un mutuo variabile il TAEG della banca è calcolato con l\'indice del giorno della firma, quindi può essere diverso da quello del programma, che usa le previsioni.' },
    data_prima_rata: { domanda: 'Da che giorno partono gli interessi della prima rata?',
      cosa: 'Ogni rata paga gli interessi di un mese. Qui serve il primo giorno del mese coperto dalla prima rata: non il giorno in cui l\'hai pagata.',
      dove: 'Nel piano di ammortamento, alla riga della rata numero 1: cerca «periodo dal … al …» o «decorrenza». Oppure nella ricevuta della prima rata.',
      esempio: 'se la prima rata copre tutto marzo 2024 scrivi 01/03/2024, anche se l\'addebito è arrivato a fine marzo o ad aprile',
      seNonSai: 'Di solito è il primo giorno del mese a cui si riferisce la prima rata intera che hai pagato.' },
    spese_rata: { domanda: 'La banca aggiunge delle spese a ogni rata?',
      cosa: 'Alcune banche sommano a ogni rata una piccola cifra fissa per l\'incasso, di solito fra 1 e 3 euro.',
      dove: 'Nella ricevuta di una rata, alla voce «spese», «commissioni» o «spese incasso rata». Nel contratto, fra le «condizioni economiche».',
      seNonSai: 'Lascia 0. Se più avanti inserisci qualche rata già pagata, il programma si accorge delle spese e te le propone.' },
    valore_riferimento: { domanda: 'Quanto vale la casa? (facoltativo)',
      cosa: 'Serve solo a mostrarti quanta parte del valore della casa devi ancora pagare. Non cambia nessun calcolo.',
      dove: 'Nell\'atto di acquisto o nella perizia fatta dalla banca.', seNonSai: 'Lascia 0.' },
    indice_nome: { domanda: 'A quale indice è legato il tuo tasso?',
      cosa: 'Nei mutui a tasso variabile il tasso segue un indice di mercato, che sale e scende nel tempo. Il più usato è l\'Euribor, che esiste in più versioni: a 1, 3, 6 o 12 mesi. Se è un Euribor, i valori li scarica il programma da internet.',
      dove: 'Nel contratto, dove si parla del tasso di interesse: cerca «parametro di indicizzazione» o «parametro di riferimento», oppure una frase come «Euribor 3 mesi più 1,50 punti». Lo trovi anche nelle comunicazioni periodiche della banca.' },
    spread: { domanda: 'Quanto vale lo spread?',
      cosa: 'È la percentuale fissa che la banca aggiunge all\'indice: il tuo tasso è sempre indice + spread. Lo spread non cambia per tutta la durata del mutuo.',
      dove: 'Nel contratto, nella stessa frase dell\'indice («Euribor 3 mesi + 1,50»), oppure alla voce «spread» o «maggiorazione». Anche nelle comunicazioni periodiche: «tasso applicato = parametro + spread».',
      esempio: '1,5 (senza il segno %)' },
    mesi_revisione: { domanda: 'Ogni quanto la banca aggiorna il tasso?',
      cosa: 'La banca rilegge l\'indice a intervalli regolari. Se lo fa ogni mese, ogni rata può avere un tasso diverso; se lo fa ogni 3 o 6 mesi, il tasso resta fermo per 3 o 6 rate di fila.',
      dove: 'Nel contratto cerca «periodicità di adeguamento» o «revisione del tasso». Un indizio pratico: guarda le ultime ricevute, se il tasso cambia a ogni rata l\'aggiornamento è mensile.',
      nonSo: 'Lo ricava il programma dalle rate che inserirai più avanti.' },
    regola_rilevazione: { domanda: 'In che giorno la banca legge l\'indice?',
      cosa: 'L\'indice cambia ogni giorno, quindi il contratto stabilisce quale giorno conta per ogni rata.',
      dove: 'Nel contratto, vicino al nome dell\'indice. Frasi tipiche: «rilevato il quarto giorno lavorativo antecedente la fine del mese» (è la prima voce, con 4 giorni), «rilevato l\'ultimo giorno lavorativo del mese precedente», «media mensile del mese precedente».',
      nonSo: 'Lo ricava il programma dalle rate che inserirai più avanti.' },
    giorni_anticipo_euribor: { domanda: 'Quanti giorni lavorativi prima?',
      cosa: 'Il numero scritto nel contratto: «il quarto giorno lavorativo antecedente» vuol dire 4, «due giorni lavorativi prima» vuol dire 2.',
      seNonSai: 'Lascia il numero proposto: se inserisci le rate già pagate, il programma prova tutti i valori da 1 a 6 e sceglie quello giusto.' },
    giorno_rilevazione: { domanda: 'Quale giorno del mese?', cosa: 'Il giorno indicato nel contratto, da 1 a 31. Se quel giorno è festivo, il programma usa il giorno lavorativo precedente.' },
    conteggio_giorni: { domanda: 'Come vengono contati i giorni per calcolare gli interessi?',
      cosa: 'Gli interessi di una rata dipendono da quanti giorni la banca conta nel mese e nell\'anno. Sono dettagli che spostano la rata di qualche euro, ma servono per far tornare i conti al centesimo.',
      dove: 'Nel contratto cerca «anno civile» o «divisore 365» (prime due voci) oppure «anno commerciale» o «divisore 360» (terza voce). Se parla solo di rate mensili, o non dice nulla, di solito è l\'ultima voce.',
      nonSo: 'Lo ricava il programma dalle rate che inserirai più avanti.' },
    arrotonda_indice: { domanda: 'Il contratto arrotonda l\'indice?', cosa: 'Alcuni contratti arrotondano il valore dell\'indice, per esempio «ai 5 centesimi superiori»: in quel caso scrivi 0,05. Se non c\'è scritto niente lascia 0.' },
    arrotonda_indice_modo: { domanda: 'Come arrotonda?', cosa: '«Al valore più vicino» oppure «sempre per eccesso» (cioè verso l\'alto), come dice il contratto.' },
    floor_attivo: { domanda: 'C\'è un valore minimo per l\'indice?', cosa: 'Alcuni contratti prevedono che l\'indice non possa scendere sotto una soglia (spesso zero): si chiama clausola «floor». Conta solo quando l\'indice è molto basso o negativo.' },
    indice_minimo: { domanda: 'Qual è il valore minimo?', cosa: 'La soglia scritta nel contratto, in percentuale. Spesso è 0.' },
    tasso_massimo: { domanda: 'C\'è un tasso massimo?', cosa: 'Alcuni mutui hanno un tetto («cap») che il tasso totale non può superare. Se il tuo ce l\'ha scrivi la percentuale, altrimenti lascia 0.' },
    tipo_piano: { domanda: 'Come viene restituito il capitale?',
      cosa: 'Ogni rata ha due parti: gli interessi e la «quota capitale», cioè la parte che riduce davvero il debito. Le banche calcolano la quota capitale in modi diversi.',
      dove: 'Nel contratto cerca «ammortamento alla francese», «a quote capitali predeterminate» (o «prefissate»), oppure «all\'italiana». Un indizio pratico: se alla firma ti hanno consegnato un piano con le quote capitale già scritte per tutte le rate, è la seconda voce.',
      nonSo: 'Lo ricava il programma dalle rate che inserirai più avanti (meglio se scrivi anche la quota capitale).' },
    tasso_annuo_piano: { domanda: 'Con quale tasso è stato calcolato il piano iniziale?',
      cosa: 'Le quote capitale sono state fissate usando il tasso del giorno della firma, che può essere diverso da quello di oggi.',
      dove: 'In cima al piano di ammortamento («tasso» o «tasso di ingresso») oppure nel contratto («tasso iniziale»).',
      seNonSai: 'Lascialo vuoto e usa la casella qui sotto: basta la quota capitale della prima rata.' },
    rata_piano: { domanda: 'Rata del piano iniziale', cosa: 'La rata (capitale + interessi) scritta nel piano iniziale. Lascia 0: il programma la calcola dal tasso.' },
  };
  // La guida ha due percorsi.
  // Il percorso breve è quello normale per un prestito nuovo, pensato per chi non conosce il contratto: quattro domande,
  // gli importi di alcune rate già pagate, e il resto (tasso, spese, regole) lo ricava il programma dalle rate
  // (deduzione.js, passo «Ci penso io»), che chiede altro solo se le rate non bastano.
  // Il percorso completo fa tutte le domande sul contratto: serve a rivedere un prestito già configurato e a chi
  // preferisce rispondere da sé.
  const PASSI_BREVI = [
    { titolo: 'Prima di iniziare', tipo: 'benvenuto', icona: 'bussola' },
    { titolo: 'Il prestito', tipo: 'essenziali', icona: 'documento',
      testo: 'Quattro domande soltanto. Le risposte le trovi nella prima pagina del contratto o nell\'estratto conto.' },
    { titolo: 'Le rate pagate', tipo: 'rate', icona: 'calendario',
      testo: 'Scrivi quanto ti è stato addebitato per alcune delle rate che hai già pagato: da questi importi capisco da solo il tasso, le spese e le regole del contratto. Bastano tre o quattro rate, meglio se lontane fra loro; più ne scrivi, più sono sicuro. Le caselle vuote vanno bene.' },
    { titolo: 'Ci penso io', tipo: 'analisi', icona: 'bacchetta' },
    { titolo: 'Spese e nome', icona: 'scudo', campi: ['nome', 'spese_iniziali', 'assicurazione_iniziale', 'spese_nel_prestito', 'assicurazione_rata', 'spese_annue', 'taeg_dichiarato', 'valore_riferimento', 'anticipo'],
      testo: 'Ultime domande, tutte facoltative: non cambiano le rate, servono a calcolare quanto costa davvero il prestito (costo totale e TAEG). Se non hai questi dati sotto mano vai avanti: potrai aggiungerli quando vuoi dal «Pannello di controllo».' },
    { titolo: 'Riepilogo', tipo: 'riepilogo', icona: 'spunta', testo: 'Controlla i dati e conferma. Potrai rivedere tutto quando vuoi con il pulsante «Configurazione» in alto.' },
  ];
  // "se": il passo serve solo per alcuni prestiti (ad esempio gli aggiornamenti del tasso solo per il variabile).
  const PASSI_COMPLETI = [
    { titolo: 'Prima di iniziare', tipo: 'benvenuto', icona: 'bussola', campi: [] },
    { titolo: 'Il prestito', icona: 'documento', campi: ['tipo_prestito', 'nome', 'importo_iniziale', 'numero_rate', 'maxirata', 'anticipo', 'data_prima_rata', 'valore_riferimento'],
      testo: 'Cominciamo dai dati di base. Li trovi tutti nella prima pagina del contratto o nel piano di ammortamento.' },
    { titolo: 'Spese e assicurazioni', icona: 'scudo', campi: ['spese_rata', 'spese_iniziali', 'assicurazione_iniziale', 'spese_nel_prestito', 'assicurazione_rata'], avanzati: ['spese_annue'],
      testo: 'Quello che paghi oltre agli interessi. Le spese per rata servono a far tornare le rate al centesimo; le altre servono a calcolare il costo totale e il TAEG. Se non le hai sotto mano lascia 0 e vai avanti.' },
    { titolo: 'Il tasso', se: variabile, icona: 'grafico', campi: ['indice_nome', 'spread', 'taeg_dichiarato'],
      testo: 'In un mutuo a tasso variabile il tasso di ogni rata è la somma di due numeri: un indice di mercato, che cambia nel tempo, e lo spread, che è fisso.' },
    { titolo: 'Il tasso', se: b => !variabile(b), icona: 'percento', campi: ['tasso_fisso', 'taeg_dichiarato'],
      testo: 'A tasso fisso il tasso è scritto nel contratto e non cambia mai. Nel contratto ne trovi due: il TAN, che serve a calcolare le rate, e il TAEG, che misura il costo totale.' },
    { titolo: 'Gli aggiornamenti', se: variabile, icona: 'orologio', campi: ['mesi_revisione', 'regola_rilevazione', 'giorni_anticipo_euribor', 'giorno_rilevazione'],
      testo: 'Ora due dettagli su quando la banca rilegge l\'indice. Se non li trovi nel contratto scegli «Non lo so»: il programma li ricava dalle rate che hai già pagato.' },
    { titolo: 'Gli interessi', icona: 'calcolatrice', campi: ['conteggio_giorni'], avanzati: ['arrotonda_rata', 'arrotonda_indice', 'arrotonda_indice_modo', 'floor_attivo', 'indice_minimo', 'tasso_massimo'],
      testo: 'Un dettaglio tecnico che serve a far tornare i conti al centesimo. Anche qui, se non lo sai, lascia fare al programma.' },
    // Con la maxirata il piano è per forza a rata costante: la domanda non serve.
    { titolo: 'Il capitale', icona: 'colonne', se: b => b.tipo_prestito !== 'maxirata', campi: ['tipo_piano', 'tasso_annuo_piano'], avanzati: ['rata_piano'],
      testo: 'L\'ultima domanda sul contratto riguarda il modo in cui restituisci il capitale.' },
    { titolo: 'Le rate già pagate', tipo: 'rate', icona: 'calendario', campi: [],
      testo: 'Se hai già pagato delle rate, scrivile qui: il programma le usa per controllare le risposte date finora e per ricavare quelle che hai lasciato in sospeso. Bastano le prime tre o quattro; più ne metti, più il controllo è sicuro.' },
    { titolo: 'Riepilogo', tipo: 'riepilogo', icona: 'spunta', campi: [], testo: 'Controlla i dati e conferma. Potrai rifare la configurazione quando vuoi con il pulsante «Configurazione» in alto.' },
  ];
  const NON_SO = '?';
  // percorso: 'breve' o 'completo'; rate: importi scritti, per numero di rata; nonSo: domande lasciate al programma
  // (percorso completo); massimo: ultimo passo raggiunto; nuovo: si aggiunge un prestito accanto a quelli che ci sono già
  // (dalla scheda «Prestiti»). Per il percorso breve: tipoBreve (il tipo scelto, anche «mutuo, non so se fisso o
  // variabile»), dataAddebito e modoData (la data della prima rata, o dell'ultima), conQuota (colonna della quota
  // capitale), noti (dati scritti dall'utente nel passo «Ci penso io»), chiusi (dubbi a cui ha già risposto), saltate
  // (dati del contratto a cui ha risposto «Non lo so»), analisi (l'ultima deduzione), serieScaricate (Euribor scaricati
  // da internet nella guida, per codice).
  const guida = { percorso: 'breve', passo: 0, massimo: 0, bozza: {}, riapertura: false, nuovo: false, rate: {}, righeRate: 12, caricaTassi: true, scaricati: null, nonSo: new Set(), ricavate: null,
    tipoBreve: null, dataAddebito: null, modoData: 'prima', conQuota: false, noti: {}, chiusi: new Set(), saltate: new Set(), analisi: null, serieScaricate: {}, serieProvate: false, serieErrore: null };
  const passi = () => guida.percorso === 'breve' ? PASSI_BREVI : PASSI_COMPLETI;
  const passoAttuale = () => passi()[guida.passo];
  // Valori dell'indice pronti per la conferma: quelli già nel programma (se la casella è spuntata) e quelli scaricati
  // da internet nel passo del tasso, purché siano della stessa versione dell'Euribor scelta.
  function tassiScaricati(b) {
    const serie = TassiInternet.riconosci(b.indice_nome);
    return serie && guida.scaricati && guida.scaricati.codice === serie.codice ? guida.scaricati.valori : [];
  }
  function tassiPronti(b) {
    const tassi = new Map();
    for (const t of [...(guida.caricaTassi ? Archivio.precaricati(b.indice_nome, TassiInternet.inizioScarico(b.data_prima_rata)) : []), ...tassiScaricati(b)]) if (!tassi.has(t.giorno)) tassi.set(t.giorno, t);
    return [...tassi.values()].sort((x, y) => x.giorno.localeCompare(y.giorno));
  }
  const campiDelPasso = passo => [...passo.campi, ...(passo.avanzati || [])];
  // Passi da percorrere con le risposte date finora (il tipo di prestito decide quali servono).
  const passoServe = i => !passi()[i].se || passi()[i].se(guida.bozza);
  const passiUtili = () => passi().map((_, i) => i).filter(passoServe);
  const passoDopo = i => passiUtili().find(j => j > i) ?? i;
  const passoPrima = i => [...passiUtili()].reverse().find(j => j < i) ?? i;
  const mostraErrore = testo => { $('#errore-passo').textContent = testo; $('#errore-passo').hidden = false; $('#errore-passo').scrollIntoView({ block: 'nearest' }); return false; };
  const titoloDomanda = chiave => (DOMANDE[chiave] || {}).domanda || CAMPI[chiave].etichetta;

  // Una risposta in un elenco di scelte; "icona": alcune scelte (il tipo di prestito) hanno un disegno accanto al titolo.
  const voce = (nome, valore, titolo, aiuto, scelta, extra, icona) => crea('label', { className: 'scelta' + (icona ? ' con-icona' : '') },
    crea('input', { type: 'radio', name: nome, value: valore, checked: scelta }), ...(icona ? [Icone.distintivo(icona, 'piccolo')] : []),
    crea('span', {}, crea('strong', {}, titolo), ...(aiuto ? [crea('small', {}, aiuto)] : []), ...(extra ? [extra] : [])));
  // Il riquadro sotto una domanda: che cos'è, dove lo trovi, un esempio, cosa fare se non lo sai.
  function spiegazione(d) {
    const riga = (titolo, testo) => testo ? [crea('p', {}, crea('b', {}, titolo + ' '), testo)] : [];
    return crea('div', { className: 'spiegazione' }, ...riga('Che cos\'è.', d.cosa), ...riga('Perché te lo chiedo.', d.perche), ...riga('Dove lo trovi.', d.dove), ...riga('Esempio:', d.esempio), ...riga('Se non lo sai.', d.seNonSai));
  }
  // Una domanda della guida: titolo, casella o elenco di risposte, e la spiegazione sotto.
  function creaDomanda(chiave) {
    const campo = CAMPI[chiave], d = DOMANDE[chiave] || {}, valore = guida.bozza[chiave], nonSo = guida.nonSo.has(chiave);
    let controllo;
    if (campo.tipo === 'scelta') {
      controllo = crea('div', { className: 'scelte' }, ...campo.opzioni.filter(o => !o.se || o.se(guida.bozza)).map(o => voce(chiave, String(o.valore), o.etichetta, o.aiuto, !nonSo && o.valore === valore, null, o.icona)),
        ...(d.nonSo ? [voce(chiave, NON_SO, 'Non lo so', d.nonSo, nonSo)] : []));
    } else if (campo.suggerimenti) {
      const noto = campo.suggerimenti.includes(valore);
      controllo = crea('div', { className: 'scelte' }, ...campo.suggerimenti.map(s => voce(chiave, s, s, null, s === valore)),
        voce(chiave, 'altro', 'Un altro indice', null, !noto && !!valore, crea('input', { type: 'text', name: chiave + '_altro', value: noto ? '' : (valore || ''), placeholder: 'scrivi il nome', maxLength: 80, 'aria-label': 'Nome dell\'indice' })));
    } else if (campo.tipo === 'data') controllo = crea('input', { type: 'date', name: chiave, id: 'campo-' + chiave, value: valore || '' });
    else if (campo.tipo === 'testo') controllo = crea('input', { type: 'text', name: chiave, id: 'campo-' + chiave, value: valore || '', maxLength: 80 });
    else controllo = crea('input', { type: 'text', inputMode: 'decimal', name: chiave, id: 'campo-' + chiave, value: perCampo(valore, campo.tipo === 'percento') });
    return crea('div', { className: 'domanda', 'data-campo': chiave },
      crea('label', { className: 'titolo-domanda', htmlFor: 'campo-' + chiave }, titoloDomanda(chiave) + (campo.obbligatorio ? ' *' : '')),
      controllo, spiegazione(d));
  }
  // Legge le risposte del passo. Con "severo" si ferma al primo errore; altrimenti salta quello che non è valido.
  // Restituisce { valori, nonSo } oppure { errore }.
  function leggiDomande(chiavi, severo) {
    const valori = {}, nonSo = new Set();
    for (const chiave of chiavi) {
      const campo = CAMPI[chiave], contenitore = $(`#campi-passo [data-campo="${chiave}"]`);
      if (!contenitore || contenitore.hidden) continue;
      const scelta = $('input[type="radio"]:checked', contenitore);
      if (campo.tipo === 'scelta') {
        if (scelta && scelta.value === NON_SO) { nonSo.add(chiave); continue; }
        const opzione = scelta && campo.opzioni.find(o => String(o.valore) === scelta.value);
        if (opzione) valori[chiave] = opzione.valore;
        else if (severo) return { errore: `Scegli una risposta: ${titoloDomanda(chiave)}` };
        continue;
      }
      const testo = (campo.suggerimenti ? (scelta ? (scelta.value === 'altro' ? $(`[name="${chiave}_altro"]`, contenitore).value : scelta.value) : '') : $('input', contenitore).value).trim();
      if (!testo) {
        if (campo.suggerimenti || campo.obbligatorio) { if (severo) return { errore: `Manca la risposta: ${titoloDomanda(chiave)}` }; continue; }
        if (campo.tipo === 'testo') valori[chiave] = '';
        else if (campo.tipo !== 'data') valori[chiave] = campo.iniziale != null ? campo.iniziale : 0;
        continue;
      }
      if (campo.tipo === 'testo' || campo.tipo === 'data') { valori[chiave] = testo; continue; }
      const v = leggiNumero(testo, campo.tipo !== 'percento');
      if (v == null || Number.isNaN(v)) { if (severo) return { errore: `Numero non valido: ${titoloDomanda(chiave)}` }; continue; }
      valori[chiave] = campo.tipo === 'percento' ? daPercento(v) : v;
    }
    return { valori, nonSo };
  }
  // Mostra solo le domande che hanno senso con le risposte date (e nasconde i dettagli di una risposta "Non lo so").
  function aggiornaDomande() {
    const passo = passoAttuale(), chiavi = campiDelPasso(passo), letti = leggiDomande(chiavi, false);
    const p = { ...guida.bozza, ...letti.valori };
    const dipendeDa = { giorni_anticipo_euribor: 'regola_rilevazione', giorno_rilevazione: 'regola_rilevazione', tasso_annuo_piano: 'tipo_piano', rata_piano: 'tipo_piano' };
    for (const chiave of chiavi) {
      const contenitore = $(`#campi-passo [data-campo="${chiave}"]`);
      if (contenitore && (CAMPI[chiave].se || dipendeDa[chiave])) contenitore.hidden = letti.nonSo.has(dipendeDa[chiave]) || (CAMPI[chiave].se ? !CAMPI[chiave].se(p) : false);
    }
    const aiuto = $('#aiuto-quota');
    if (aiuto) aiuto.hidden = $('#campi-passo [data-campo="tasso_annuo_piano"]').hidden;
    // I casi particolari che non riguardano questo prestito (ad esempio quelli sull'indice, a tasso fisso) spariscono del tutto.
    const avanzate = $('#campi-passo details.avanzate');
    if (avanzate) avanzate.hidden = ![...avanzate.querySelectorAll('.domanda')].some(d => !d.hidden);
    // Valori dell'indice già disponibili: casella per caricarli, visibile solo se l'indice scelto è fra quelli noti.
    const riga = $('#riga-precaricati');
    if (riga) {
      const pronti = Archivio.precaricati(p.indice_nome, TassiInternet.inizioScarico(p.data_prima_rata));
      riga.hidden = !pronti.length;
      if (pronti.length) $('span', riga).textContent = `Il programma ha già ${pronti.length} valori di ${TassiInternet.riconosci(p.indice_nome).nome} per il periodo del tuo mutuo (dal ${data(pronti[0].giorno)} al ${data(pronti[pronti.length - 1].giorno)}): caricali, così non devi inserirli a mano.`;
    }
    // Scarico da internet: visibile solo se l'indice scelto è un Euribor riconosciuto.
    const blocco = $('#blocco-internet');
    if (blocco) {
      const serie = TassiInternet.riconosci(p.indice_nome), scaricati = serie ? tassiScaricati(p) : [];
      blocco.hidden = !serie;
      if (serie) {
        const pronti = guida.caricaTassi ? Archivio.precaricati(p.indice_nome, TassiInternet.inizioScarico(p.data_prima_rata)) : [];
        $('#testo-internet', blocco).textContent = (pronti.length ? `I valori più recenti di ${serie.nome}, dopo il ${data(pronti[pronti.length - 1].giorno)}, li posso scaricare adesso da internet. `
          : `I valori di ${serie.nome} dal ${data(TassiInternet.inizioScarico(p.data_prima_rata))} a oggi li posso scaricare adesso da internet. `)
          + TassiInternet.spiegazione + ' Se preferisci, puoi farlo anche dopo: la pagina «Tassi» li scarica da sola a ogni apertura.';
        $('#scarica-guida', blocco).textContent = scaricati.length ? 'Scarica di nuovo' : 'Scarica adesso i valori';
        const esito = $('#esito-internet-guida', blocco);
        esito.hidden = !scaricati.length;
        if (scaricati.length) esito.textContent = `✓ ${scaricati.length} valori scaricati, dal ${data(scaricati[0].giorno)} al ${data(scaricati[scaricati.length - 1].giorno)}: verranno caricati insieme al mutuo.`;
      }
    }
  }

  // ---------- Date del percorso breve ----------
  // Lo stesso giorno, "mesi" mesi dopo (o prima); l'ultimo del mese se quel giorno non c'è.
  function spostaMesi(iso, mesi) {
    const [a, m, g] = iso.split('-').map(Number), ultimo = new Date(Date.UTC(a, m - 1 + mesi + 1, 0)).getUTCDate();
    return new Date(Date.UTC(a, m - 1 + mesi, Math.min(g, ultimo))).toISOString().slice(0, 10);
  }
  // Rate in tutto, maxirata compresa.
  const rateTotali = b => b.numero_rate + (b.tipo_prestito === 'maxirata' && b.maxirata > 0 ? 1 : 0);
  // Giorno in cui è stata addebitata la prima rata: scritto dall'utente, oppure ricavato da quello dell'ultima.
  const primoAddebito = () => !guida.dataAddebito || !(guida.bozza.numero_rate > 0) ? null
    : guida.modoData === 'ultima' ? spostaMesi(guida.dataAddebito, -(rateTotali(guida.bozza) - 1)) : guida.dataAddebito;
  // Inizio possibile del primo periodo (il giorno da cui partono gli interessi): il 1° del mese del primo addebito, se
  // la rata si paga alla fine del mese che copre, oppure il 1° del mese prima, se si paga all'inizio del mese dopo.
  // Prima la più probabile secondo il giorno dell'addebito; la deduzione le prova tutte e due.
  function iniziPossibili() {
    const primo = primoAddebito(), stesso = primo.slice(0, 8) + '01', prima = spostaMesi(stesso, -1);
    return +primo.slice(8) >= 15 ? [stesso, prima] : [prima, stesso];
  }

  // Periodi già iniziati secondo le date della bozza: sono le rate che la banca può avere già addebitato. Nel percorso
  // breve si contano dal primo addebito, e "inizio" è il giorno dell'addebito.
  function periodiIniziati() {
    const b = guida.bozza;
    if (guida.percorso === 'breve') {
      const primo = primoAddebito(), periodi = [];
      for (let n = 1; primo && n <= rateTotali(b); n++) {
        const giorno = spostaMesi(primo, n - 1);
        if (giorno > stato.oggi) break;
        periodi.push({ n, inizio: giorno });
      }
      return periodi;
    }
    if (!b.data_prima_rata || !(b.numero_rate > 0)) return [];
    const [anno, mese, giorno] = b.data_prima_rata.split('-').map(Number), periodi = [];
    for (let n = 1; n <= b.numero_rate; n++) {
      const inizio = new Date(Date.UTC(anno, mese - 1 + n - 1, giorno)).toISOString().slice(0, 10);
      if (inizio > stato.oggi) break;
      periodi.push({ n, inizio });
    }
    return periodi;
  }
  // Rate scritte nella guida, come numeri: [{ n, rata_vera, quota_capitale }]. Con "errori" segnala gli importi non validi.
  function rateInserite(errori) {
    const righe = [];
    for (const [n, voce] of Object.entries(guida.rate)) {
      const rata = leggiNumero(voce.rata || '', true), quota = leggiNumero(voce.quota || '', true);
      if (Number.isNaN(rata) || Number.isNaN(quota) || rata < 0 || quota < 0) { if (errori) errori.push(+n); continue; }
      if (rata != null || quota != null || voce.esisteva) righe.push({ n: +n, rata_vera: rata, quota_capitale: quota });
    }
    return righe.sort((a, b) => a.n - b.n);
  }
  // I dati come sarebbero dopo la conferma: servono a controllare le regole prima di salvare.
  function datiDellaBozza() {
    const b = guida.bozza, esistenti = guida.riapertura ? stato.dati : { rate: [], euribor: [], festivita: [] };
    const festivita = new Set(esistenti.festivita), primoAnno = +b.data_prima_rata.slice(0, 4) - 1;
    for (let anno = primoAnno; anno <= primoAnno + Math.ceil(b.numero_rate / 12) + 2; anno++) for (const g of Calcolo.festivitaTarget(anno)) festivita.add(g);
    const tassi = new Map(esistenti.euribor.map(t => [t.giorno, t]));
    for (const t of variabile(b) ? tassiPronti(b) : []) if (!tassi.has(t.giorno)) tassi.set(t.giorno, t);
    const rate = new Map(esistenti.rate.map(r => [r.n, { ...r }]));
    for (const riga of rateInserite()) {
      const r = rate.get(riga.n) || { n: riga.n, data_riferimento: null, tasso_applicato: null, euribor: null, spread: null };
      rate.set(riga.n, { ...r, rata_vera: riga.rata_vera, quota_capitale: riga.quota_capitale });
    }
    return { parametri: { ...b }, rate: [...rate.values()].sort((x, y) => x.n - y.n),
      euribor: [...tassi.values()].sort((x, y) => x.giorno.localeCompare(y.giorno)), festivita: [...festivita].sort() };
  }
  // Quante delle rate inserite tornano con le regole della bozza; se non tornano tutte, cerca regole migliori.
  function controllaBozza() {
    const dati = datiDellaBozza(), vere = dati.rate.filter(r => r.rata_vera != null);
    if (!vere.length) return null;
    const righe = Calcolo.calcolaPiano(dati, { fino: Math.max(...vere.map(r => r.n)) }).righe;
    let uguali = 0, senzaIndice = 0;
    for (const v of vere) {
      const r = righe[v.n - 1];
      if (r.origineEuribor === 'previsione') senzaIndice++;
      else if (r.rataCalcolata.toFixed(2) === v.rata_vera.toFixed(2)) uguali++;
    }
    // Quote capitale scritte dall'utente: devono coincidere con quelle del piano scelto.
    const quote = dati.rate.filter(r => r.quota_capitale != null && righe[r.n - 1]);
    const quoteUguali = quote.filter(q => Math.abs(righe[q.n - 1].quotaPiano - q.quota_capitale) < 0.005).length;
    let consiglio = null, dubbio = null;
    // Anche le rate "senza indice" contano come non tornate: con un'altra regola sulla data di rilevazione il valore può esserci.
    // La ricerca si rifà anche quando serve sapere se altre combinazioni sono compatibili (dubbio già segnalato).
    if (uguali < vere.length || quoteUguali < quote.length || guida.dubbio) {
      const migliore = Calcolo.tara(dati)[0];
      if (migliore && migliore.punti > uguali + quoteUguali) consiglio = migliore;
      else if (migliore && migliore.dubbio) dubbio = migliore.dubbio;
    }
    return { vere: vere.length, uguali, senzaIndice, quote: quote.length, quoteUguali, consiglio, dubbio };
  }

  function disegnaBenvenuto(contenitore) {
    const documento = (nome, contenuto) => crea('li', {}, crea('strong', {}, nome), ' ' + contenuto);
    const presentazione = 'Questo programma ricostruisce, rata per rata, il tuo mutuo o il tuo finanziamento, a tasso variabile o fisso: ti dice se la banca ti addebita la cifra giusta, quanto costa davvero il prestito, quanto hai pagato finora di interessi e, per il variabile, come potrebbero cambiare le rate future.';
    // Chi deve ancora firmare può confrontare le offerte delle banche, senza seguire ancora nessun prestito.
    const offerte = guida.riapertura || guida.nuovo || guida.daOfferte ? [] : [crea('div', { className: 'consiglio' },
      crea('p', {}, crea('strong', {}, 'Devi ancora firmare? '), 'Puoi confrontare le offerte di banche e finanziarie: rata, interessi, costo totale e TAEG, uno accanto all\'altro. Quando avrai scelto, la seguirai da qui.'),
      crea('button', { type: 'button', className: 'secondario', id: 'apri-offerte' }, 'Confronta delle offerte'))];
    if (guida.percorso === 'breve') {
      contenitore.replaceChildren(
        crea('p', {}, guida.nuovo ? 'Aggiungi un altro prestito. I prestiti che segui già restano come sono, e li ritrovi tutti nella pagina «Prestiti».' : presentazione),
        crea('h3', {}, 'Come funziona'),
        crea('ul', { className: 'documenti' },
          crea('li', {}, 'Ti faccio quattro domande facili sul prestito: che tipo è, quanto ti hanno prestato, in quante rate, quando hai pagato la prima.'),
          crea('li', {}, 'Poi mi scrivi gli importi di alcune rate che hai già pagato, come li vedi sull\'estratto conto.'),
          crea('li', {}, 'Il resto (il tasso, le spese, le regole del contratto) provo a capirlo da solo dalle rate. Se non ci riesco ti chiedo solo il dato che mi manca, e ti dico dove trovarlo.')),
        crea('h3', {}, 'Tieni a portata di mano'),
        crea('ul', { className: 'documenti' },
          documento('L\'estratto conto o le ricevute', 'di alcune rate già pagate: servono gli importi addebitati.'),
          documento('Il contratto,', 'se ce l\'hai: potrei chiederti un dato, come il tasso.')),
        crea('p', { className: 'nota' }, 'Niente è definitivo: puoi tornare indietro, e rivedere tutto quando vuoi con il pulsante «Configurazione» in alto.'),
        ...offerte,
        crea('p', { className: 'nota' }, 'Conosci bene il tuo contratto? ',
          crea('button', { type: 'button', className: 'collegamento', id: 'percorso-completo' }, 'Preferisco rispondere io a tutte le domande')));
      return;
    }
    contenitore.replaceChildren(
      crea('p', {}, guida.riapertura ? `Stai rivedendo la configurazione di «${guida.bozza.nome || 'Il mio mutuo'}». Le risposte già date sono compilate: cambia solo quello che ti serve. Rate e tassi inseriti restano dove sono.`
        : guida.nuovo ? 'Aggiungi un altro prestito: le stesse domande della prima volta. I prestiti che segui già restano come sono, e li ritrovi tutti nella pagina «Prestiti».'
          : presentazione),
      ...(guida.riapertura ? [] : [crea('p', { className: 'nota' }, 'Qui rispondi tu a tutte le domande sul contratto. ',
        crea('button', { type: 'button', className: 'collegamento', id: 'percorso-breve' }, 'Torna al percorso breve'), ': quattro domande e le rate pagate, il resto lo ricava il programma.')]),
      crea('h3', {}, 'Tieni a portata di mano'),
      crea('ul', { className: 'documenti' },
        documento('Il contratto', '(o il foglio informativo che lo accompagna: PIES per i mutui, SECCI per i finanziamenti): servono importo, durata, tasso e spese.'),
        documento('Il piano di ammortamento,', 'se la banca te l\'ha consegnato: è la tabella con tutte le rate previste.'),
        documento('Le ricevute o l\'estratto conto', 'di alcune rate già pagate: servono gli importi addebitati.')),
      crea('h3', {}, 'Come funziona'),
      crea('ul', { className: 'documenti' },
        crea('li', {}, 'Ci vogliono circa dieci minuti. Ogni domanda spiega che cosa ti viene chiesto e dove trovarlo.'),
        crea('li', {}, 'Se una risposta non la sai, spesso puoi scegliere «Non lo so»: il programma la ricava dalle rate che hai già pagato.'),
        crea('li', {}, 'Niente è definitivo: puoi tornare indietro, e rifare tutto quando vuoi con il pulsante «Configurazione» in alto.')),
      ...offerte);
  }

  function disegnaRate(contenitore) {
    const periodi = periodiIniziati();
    const dove = crea('div', { className: 'spiegazione' },
      crea('p', {}, crea('b', {}, 'Dove le trovi. '), 'Nell\'estratto conto (sono gli addebiti del prestito), nelle ricevute o quietanze che la banca ti manda, oppure nell\'area clienti del sito della banca o della finanziaria.'),
      crea('p', {}, crea('b', {}, 'Rata addebitata. '), 'La cifra totale uscita dal conto per quella rata, spese comprese.'),
      crea('p', {}, crea('b', {}, 'Quota capitale (facoltativa). '), 'La parte della rata che riduce il debito: è una voce del dettaglio della ricevuta. Se la scrivi, il programma riconosce con più sicurezza il tipo di piano.'),
      crea('p', {}, crea('b', {}, 'Un trucco. '), 'Puoi incollare una colonna intera copiata da un foglio di calcolo: clic sulla prima casella e incolla.'));
    // Nel percorso breve: le rate più recenti, che sono le più facili da trovare, e la quota capitale solo a richiesta.
    const breve = guida.percorso === 'breve', conQuota = !breve || guida.conQuota;
    if (!periodi.length) {
      contenitore.replaceChildren(crea('p', { className: 'nota' }, breve ? 'Il prestito non è ancora partito: non ci sono rate da scrivere. Vai avanti: ti chiederò il tasso del contratto.'
        : 'Il prestito non è ancora partito: non ci sono rate da inserire. Vai avanti.'));
      return;
    }
    const mostrate = breve ? periodi.slice(-guida.righeRate) : periodi.slice(0, guida.righeRate);
    const casella = (n, tipo, segnaposto) => crea('input', { type: 'text', inputMode: 'decimal', 'data-rata': n, 'data-tipo': tipo, value: (guida.rate[n] || {})[tipo] || '',
      placeholder: segnaposto, 'aria-label': `${tipo === 'rata' ? 'Rata addebitata' : 'Quota capitale'}, rata ${n}` });
    const righe = mostrate.map(({ n, inizio }, i) => crea('tr', {}, crea('td', {}, String(n)), crea('td', { className: 'testo' }, M.meseAnno(inizio)),
      crea('td', {}, casella(n, 'rata', i === 0 ? 'es. 650,00' : '')), ...(conQuota ? [crea('td', {}, casella(n, 'quota', i === 0 ? 'facoltativa' : ''))] : [])));
    const altre = periodi.length - righe.length;
    const piu = altre > 0 ? [crea('button', { type: 'button', className: 'secondario', id: 'altre-rate' }, breve ? `Mostra ${Math.min(12, altre)} rate prima` : `Mostra altre ${Math.min(12, altre)} rate`)] : [];
    const tabella = crea('div', { className: 'contenitore-tabella semplice tabella-rate' }, crea('table', {},
      crea('thead', {}, crea('tr', {}, crea('th', {}, 'Rata'), crea('th', { className: 'testo' }, breve ? 'Addebitata a' : 'Mese'), crea('th', {}, 'Rata addebitata (€)'),
        ...(conQuota ? [crea('th', {}, 'Quota capitale (€)')] : []))),
      crea('tbody', {}, ...righe)));
    if (!breve) { contenitore.replaceChildren(tabella, ...piu, dove); return; }
    contenitore.replaceChildren(...piu, tabella,
      crea('label', { className: 'spunta' }, crea('input', { type: 'checkbox', name: 'con_quota', checked: conQuota }),
        crea('span', {}, 'Nella ricevuta c\'è anche la quota capitale: voglio scriverla (facoltativo, mi aiuta a capire meglio)')), dove);
  }
  const leggiCaselleRate = () => {
    for (const input of document.querySelectorAll('#campi-passo input[data-rata]')) {
      const voce = guida.rate[input.dataset.rata] || (guida.rate[input.dataset.rata] = {});
      voce[input.dataset.tipo] = input.value.trim();
    }
  };

  function disegnaRiepilogo(contenitore) {
    const b = guida.bozza, blocchi = [];
    const inserite = rateInserite().filter(r => r.rata_vera != null).length;
    let esito = controllaBozza();
    // Risposte lasciate al programma: si ricavano dalle rate inserite.
    if (guida.nonSo.size) {
      const lasciate = [...guida.nonSo].map(c => `«${titoloDomanda(c)}»`).join(', ');
      if (!esito) {
        blocchi.push(crea('p', { className: 'nota evidenza' }, `Hai lasciato a me ${guida.nonSo.size === 1 ? 'una risposta' : guida.nonSo.size + ' risposte'} (${lasciate}), ma senza rate già pagate non posso ricavarle: per ora ho messo le scelte più diffuse. `
          + 'Torna al passo «Le rate già pagate» e inseriscine almeno tre; oppure conferma, e quando avrai le rate usa la taratura automatica nel pannello di controllo.'));
      } else {
        if (esito.consiglio) { guida.dubbio = esito.consiglio.dubbio || null; Object.assign(b, esito.consiglio.parametri); esito = controllaBozza(); }
        guida.ricavate = lasciate;
        guida.nonSo.clear();
      }
    }
    if (guida.ricavate && esito) blocchi.push(crea('p', { className: 'nota' }, `Le risposte che avevi lasciato a me (${guida.ricavate}) le ho ricavate dalle rate che hai inserito: le trovi qui sopra.`));
    if (esito && guida.dubbio) guida.dubbio = esito.consiglio ? esito.consiglio.dubbio || null : esito.dubbio;
    if (guida.dubbio && esito && !esito.consiglio) blocchi.push(crea('p', { className: 'nota evidenza' }, testoDubbio(guida.dubbio)));
    if (esito) {
      const tutte = esito.uguali === esito.vere && esito.quoteUguali === esito.quote;
      const sulleQuote = esito.quote ? (esito.quoteUguali === esito.quote ? '' : ` Delle quote capitale che hai scritto, ${esito.quoteUguali} su ${esito.quote} coincidono con quelle del piano scelto.`) : '';
      const senza = esito.senzaIndice ? ` Per ${esito.senzaIndice === 1 ? 'una rata' : esito.senzaIndice + ' rate'} manca il valore dell'indice nel giorno di rilevazione previsto da queste regole.` : '';
      blocchi.push(crea('p', { className: 'nota ' + (tutte ? 'conferma' : 'evidenza') },
        tutte ? `✓ Con queste regole ${esito.vere === 1 ? 'la rata inserita torna' : `le ${esito.vere} rate inserite tornano tutte`} al centesimo.`
          : `Con queste regole ${esito.uguali === 1 ? 'torna 1 rata' : `tornano ${esito.uguali} rate`} su ${esito.vere}.` + senza + sulleQuote));
      if (esito.consiglio) {
        const c = esito.consiglio;
        blocchi.push(crea('div', { className: 'consiglio' },
          crea('p', {}, crea('strong', {}, `Con queste altre regole ${c.rate === 1 ? 'torna 1 rata' : `tornano ${c.rate} rate`} su ${c.suRate}:`)),
          crea('dl', { className: 'riepilogo-guida' }, ...descriviRegole({ ...b, ...c.parametri }).flatMap(([etichetta, valore]) => [crea('dt', {}, etichetta), crea('dd', {}, valore)])),
          ...(c.dubbio ? [crea('p', { className: 'nota' }, testoDubbio(c.dubbio))] : []),
          crea('button', { type: 'button', id: 'usa-consiglio' }, 'Usa queste regole')));
        guida.consiglio = c.parametri;
      } else if (!tutte && esito.uguali + esito.senzaIndice < esito.vere) {
        blocchi.push(crea('p', { className: 'nota' }, 'Nessuna delle combinazioni previste fa meglio: controlla gli importi scritti. Puoi comunque confermare e riprovare dopo con la taratura automatica.'));
      }
      if (esito.vere < 3 && tutte) blocchi.push(crea('p', { className: 'nota' }, 'Con così poche rate il controllo è poco affidabile: quando ne aggiungi altre, verifica che le righe del piano restino verdi.'));
    }
    const conIndice = variabile(b), pronti = conIndice ? tassiPronti(b) : [], scaricati = conIndice ? tassiScaricati(b).length : 0, scaricabile = conIndice && !!TassiInternet.riconosci(b.indice_nome);
    const spese = [[b.spese_iniziali, 'iniziali'], [b.assicurazione_iniziale, 'di assicurazione all\'inizio'], [b.assicurazione_rata, 'di assicurazione al mese'], [b.spese_annue, 'all\'anno']]
      .filter(([v]) => v > 0).map(([v, cosa]) => `${euro(v)} ${cosa}`);
    const conMaxirata = b.tipo_prestito === 'maxirata' && b.maxirata > 0;
    const voci = [[nomeScelta('tipo_prestito', b.tipo_prestito || 'variabile'), `${b.nome || 'Il mio prestito'}: ${euro(b.importo_iniziale)} in ${b.numero_rate} rate${conMaxirata ? ` più una maxirata di ${euro(b.maxirata)}` : ''} dal ${data(b.data_prima_rata)}`],
      ...(b.anticipo > 0 ? [['Anticipo', euro(b.anticipo)]] : []),
      ['Tasso', conIndice ? `${b.indice_nome || 'indice'} + ${perc(b.spread, 3, 1)}` : `fisso al ${perc(b.tasso_fisso || 0, 3, 1)} (TAN)`], ...descriviRegole(b),
      ['Altre spese', spese.length ? spese.join(', ') : 'nessuna'],
      ...(b.taeg_dichiarato > 0 ? [['TAEG del contratto', perc(b.taeg_dichiarato, 3, 1)]] : []),
      ...(conIndice ? [['Valori dell\'indice', pronti.length ? `${pronti.length} pronti${scaricati ? ` (${scaricati} scaricati da internet)` : ''}, dal ${data(pronti[0].giorno)} al ${data(pronti[pronti.length - 1].giorno)}` : scaricabile ? 'da scaricare da internet nella pagina «Tassi»' : 'da inserire nella pagina «Tassi»']] : []),
      ['Rate già pagate', inserite ? `${inserite} inserite` : 'nessuna inserita']];
    const dopo = [];
    if (conIndice && !pronti.length) dopo.push(scaricabile ? 'Nella pagina «Tassi» premi «Scarica gli ultimi valori»: i valori dell\'indice arrivano da internet, senza scriverli a mano.'
      : 'Nella pagina «Tassi» inserisci o incolla i valori dell\'indice: bastano quelli dei giorni di rilevazione, che il programma ti indica.');
    else if (scaricabile) dopo.push('I valori nuovi dell\'indice arrivano da soli: a ogni apertura la pagina «Tassi» scarica quelli che mancano (se c\'è la connessione).');
    if (!conIndice) dopo.push('Nel «Pannello di controllo» trovi quanto costa davvero il prestito: interessi, spese, assicurazioni e TAEG' + (b.taeg_dichiarato > 0 ? ', confrontato con quello del contratto.' : '.'));
    dopo.push(inserite ? 'Nella pagina «Piano» aggiungi le altre rate già addebitate (colonna «Rata vera») e, ogni mese, quella nuova: le righe diventano verdi se i conti tornano.'
      : 'Nella pagina «Piano» scrivi le rate che la banca ti ha già addebitato (colonna «Rata vera»): le righe diventano verdi se i conti tornano.');
    dopo.push('Se una riga diventa rossa, nel «Pannello di controllo» c\'è la taratura automatica, che cerca le regole che riproducono le tue rate.');
    contenitore.replaceChildren(
      crea('dl', { className: 'riepilogo-guida' }, ...voci.flatMap(([etichetta, valore]) => [crea('dt', {}, etichetta), crea('dd', {}, valore)])),
      ...blocchi, crea('h3', {}, 'Cosa fare dopo'), crea('ol', { className: 'dopo' }, ...dopo.map(testo => crea('li', {}, testo))));
  }

  // ---------- Percorso breve: «Il prestito» ----------
  // Il tipo di prestito, con una voce in più per chi ha un mutuo ma non sa se è fisso o variabile: lo si capisce dalle rate.
  const NON_SO_TIPO = 'mutuo';
  function tipiBrevi() {
    const [conIndice, fisso, ...altri] = CAMPI.tipo_prestito.opzioni;
    return [conIndice, fisso, { valore: NON_SO_TIPO, icona: 'info', etichetta: 'Un mutuo, ma non so se il tasso è fisso o variabile', aiuto: 'Lo capisco io dalle rate: se cambiano da un mese all\'altro, è variabile.' }, ...altri];
  }
  const DATA_PRIMA = {
    cosa: 'Il giorno in cui la banca ha preso dal conto la prima rata. Serve a sapere a quale mese si riferisce ogni rata.',
    dove: 'Nell\'estratto conto del mese della prima rata, nel contratto («prima rata il …», «decorrenza dell\'ammortamento») o nel piano di ammortamento, alla riga della rata numero 1.',
    seNonSai: 'Se ricordi solo il mese, scegli un giorno qualsiasi di quel mese. Se non ricordi nemmeno il mese, spunta la casella qui sopra e scrivi la data dell\'ultima rata.' };
  const DATA_ULTIMA = {
    cosa: 'Il giorno dell\'ultima rata del piano, cioè la scadenza del prestito: dal numero di rate ricavo la data della prima.',
    dove: 'Nel contratto («durata», «scadenza», «ultima rata il …») o nell\'ultima riga del piano di ammortamento.' };

  function disegnaEssenziali(contenitore) {
    const ultima = guida.modoData === 'ultima';
    contenitore.replaceChildren(
      crea('div', { className: 'domanda', 'data-campo': 'tipo_breve' },
        crea('p', { className: 'titolo-domanda' }, 'Che prestito è? *'),
        crea('div', { className: 'scelte' }, ...tipiBrevi().map(o => voce('tipo_breve', o.valore, o.etichetta, o.aiuto, o.valore === guida.tipoBreve, null, o.icona))),
        spiegazione(DOMANDE.tipo_prestito)),
      creaDomanda('importo_iniziale'), creaDomanda('numero_rate'), creaDomanda('maxirata'),
      crea('div', { className: 'domanda', 'data-campo': 'data_addebito' },
        crea('label', { className: 'titolo-domanda', htmlFor: 'campo-data-addebito' }, ultima ? 'Quando pagherai l\'ultima rata? *' : 'Quando ti è stata addebitata la prima rata? *'),
        crea('input', { type: 'date', name: 'data_addebito', id: 'campo-data-addebito', value: guida.dataAddebito || '' }),
        crea('label', { className: 'spunta' }, crea('input', { type: 'checkbox', name: 'data_ultima', checked: ultima }),
          crea('span', {}, 'Non ricordo la prima rata: scrivo la data dell\'ultima, cioè la scadenza del prestito')),
        spiegazione(ultima ? DATA_ULTIMA : DATA_PRIMA)));
    $('[data-campo="numero_rate"] input', contenitore).after(crea('p', { className: 'nota', id: 'durata-anni', 'aria-live': 'polite' }));
    aggiornaEssenziali();
  }
  // La maxirata solo per quel tipo; sotto il numero di rate, la durata in anni.
  function aggiornaEssenziali() {
    const tipo = ($('#campi-passo input[name="tipo_breve"]:checked') || {}).value;
    $('#campi-passo [data-campo="maxirata"]').hidden = tipo !== 'maxirata';
    const n = leggiNumero($('#campi-passo [name="numero_rate"]').value), anni = Math.floor(n / 12), mesi = n % 12;
    const parti = [...(anni ? [anni === 1 ? '1 anno' : `${anni} anni`] : []), ...(mesi ? [mesi === 1 ? '1 mese' : `${mesi} mesi`] : [])];
    $('#durata-anni').textContent = Number.isInteger(n) && n > 0 ? `${n} rate mensili: ${parti.join(' e ')}.` : '';
  }
  function raccogliEssenziali(severo) {
    const tipo = ($('#campi-passo input[name="tipo_breve"]:checked') || {}).value || null;
    const letti = leggiDomande(['importo_iniziale', 'numero_rate', 'maxirata'], severo);
    if (letti.errore) return mostraErrore(letti.errore);
    const b = Object.assign(guida.bozza, letti.valori);
    if (tipo) {
      guida.tipoBreve = tipo;
      // Finché non si sa se il mutuo è fisso o variabile, la bozza resta su variabile.
      b.tipo_prestito = tipo !== NON_SO_TIPO ? tipo : b.tipo_prestito === 'fisso' ? 'fisso' : 'variabile';
    }
    guida.dataAddebito = $('#campi-passo [name="data_addebito"]').value || null;
    guida.modoData = $('#campi-passo [name="data_ultima"]').checked ? 'ultima' : 'prima';
    if (!severo) return true;
    if (!tipo) return mostraErrore('Scegli che prestito è.');
    if (!Number.isInteger(b.numero_rate) || b.numero_rate < 1 || b.numero_rate > 600) return mostraErrore('Il numero di rate deve essere un numero intero, ad esempio 240.');
    if (tipo === 'maxirata' && !(b.maxirata < b.importo_iniziale)) return mostraErrore('La maxirata deve essere più bassa dell\'importo prestato.');
    if (!guida.dataAddebito) return mostraErrore(guida.modoData === 'ultima' ? 'Manca la data dell\'ultima rata.' : 'Manca la data della prima rata.');
    return true;
  }
  // Se importo, durata, date o rate cambiano dopo «Ci penso io», i passi successivi vanno rifatti.
  function invalidaDopoAnalisi() {
    if (guida.percorso !== 'breve' || !guida.analisi) return;
    const ingresso = primoAddebito() ? JSON.stringify(ingressoAnalisi()) : null;
    if (ingresso !== guida.analisi.chiave) guida.massimo = Math.min(guida.massimo, PASSI_BREVI.findIndex(p => p.tipo === 'analisi'));
  }

  // ---------- Percorso breve: «Ci penso io» ----------
  // Dalle rate scritte, la deduzione (deduzione.js) ricava tasso, spese e regole. Il passo mostra che cosa ha capito e,
  // se le rate non bastano, chiede all'utente solo il dato che manca, con le risposte possibili già pronte.
  const CODICI_DEDUZIONE = ['M01', 'M03', 'M06', 'M12'];   // le versioni dell'Euribor usate nei mutui
  const tipiDaProvare = () => guida.noti.tipo_prestito ? [guida.noti.tipo_prestito] : guida.tipoBreve === NON_SO_TIPO ? ['fisso', 'variabile'] : [guida.tipoBreve];
  const conIndice = () => tipiDaProvare().includes('variabile');
  function ingressoAnalisi() {
    const b = guida.bozza;
    return { base: { importo_iniziale: b.importo_iniziale, numero_rate: b.numero_rate, maxirata: guida.tipoBreve === 'maxirata' ? b.maxirata : 0 },
      tipi: tipiDaProvare(), date: iniziPossibili(), rate: rateInserite().filter(r => r.rata_vera != null || r.quota_capitale != null), noti: { ...guida.noti } };
  }
  // Gli Euribor che la deduzione può provare: quelli nel programma e quelli scaricati da internet nella guida.
  function serieDisponibili(dal) {
    return CODICI_DEDUZIONE.map(codice => {
      const { nome } = TassiInternet.perCodice(codice), valori = new Map();
      for (const t of Archivio.precaricati(nome, dal)) valori.set(t.giorno, t);
      for (const t of guida.serieScaricate[codice] || []) if (t.giorno >= dal) valori.set(t.giorno, t);
      return { codice, nome, valori: [...valori.values()].sort((a, b) => a.giorno.localeCompare(b.giorno)) };
    }).filter(s => s.valori.length);
  }
  // Una volta per guida, se servono: i valori più recenti di quelli nel programma (o tutti, se il programma non ne ha),
  // così si controllano anche le ultime rate. Senza connessione si va avanti con quelli che ci sono.
  async function scaricaSerie(dal, fino) {
    guida.serieProvate = true;
    const aTempo = promessa => Promise.race([promessa, new Promise((_, no) => setTimeout(() => no(new Error(`Il sito della ${TassiInternet.FONTE} non risponde.`)), 15000))]);
    const esiti = await Promise.allSettled(CODICI_DEDUZIONE.map(async codice => {
      const serie = TassiInternet.perCodice(codice), presenti = Archivio.precaricati(serie.nome, dal);
      const ultimo = presenti.length ? presenti[presenti.length - 1].giorno : null;
      if (ultimo && ultimo >= fino) return;
      guida.serieScaricate[codice] = (await aTempo(TassiInternet.scarica(serie, ultimo || dal, stato.oggi))).valori;
    }));
    const errore = esiti.find(e => e.status === 'rejected');
    guida.serieErrore = errore ? errore.reason.message : null;
  }
  // Fa (o rifà, se gli ingressi sono cambiati) la deduzione, a pezzi, aggiornando il passo.
  async function avviaAnalisi() {
    const ingresso = ingressoAnalisi(), chiave = JSON.stringify(ingresso);
    if (guida.analisi && guida.analisi.chiave === chiave) return disegnaAnalisi();
    const analisi = guida.analisi = { chiave, inCorso: true, fase: 'calcolo', avanzamento: 0, accettata: false };
    guida.chiusi = new Set();
    try {
      const dal = TassiInternet.inizioScarico([...ingresso.date].sort()[0]);
      if (conIndice() && ingresso.rate.length && !guida.serieProvate) {
        analisi.fase = 'scarico';
        disegnaAnalisi();
        // L'indice dell'ultima rata si legge prima dell'inizio del mese in cui viene addebitata: servono i valori fin lì.
        const ultima = periodiIniziati().find(p => p.n === ingresso.rate[ingresso.rate.length - 1].n);
        await scaricaSerie(dal, ultima ? ultima.inizio.slice(0, 8) + '01' : stato.oggi);
        if (guida.analisi !== analisi) return;
      }
      analisi.fase = 'calcolo';
      disegnaAnalisi();
      const risultato = await Deduzione.aPezzi({ ...ingresso, serie: conIndice() ? serieDisponibili(dal) : [], predefiniti: Archivio.predefiniti() }, p => {
        analisi.avanzamento = p.totale ? p.fatto / p.totale : 0;
        const barra = $('#avanzamento-analisi');
        if (barra && guida.analisi === analisi) barra.value = Math.round(analisi.avanzamento * 100);
      });
      if (guida.analisi !== analisi) return;
      Object.assign(analisi, { inCorso: false, risultato, candidati: risultato.candidati });
    } catch (errore) {
      if (guida.analisi !== analisi) return;
      Object.assign(analisi, { inCorso: false, errore: errore.message, risultato: { esito: 'nessuno', candidati: [], differenze: [] }, candidati: [] });
    }
    disegnaAnalisi();
  }

  // Dati da chiedere, in quest'ordine, quando nessuna spiegazione fa tornare le rate.
  const DA_CHIEDERE = {
    variabile: ['indice_nome', 'spread', 'spese_rata', 'mesi_revisione', 'regola_rilevazione', 'conteggio_giorni', 'tipo_piano'],
    fisso: ['tasso_fisso', 'spese_rata', 'conteggio_giorni', 'arrotonda_rata'],
  };
  // Il tipo di prestito già sicuro (scelto all'inizio o detto dopo), oppure null per un mutuo che non si sa se fisso o variabile.
  const tipoSicuro = () => guida.noti.tipo_prestito || (guida.tipoBreve === NON_SO_TIPO ? null : guida.tipoBreve);
  // Un indice scritto dall'utente che non è un Euribor: i suoi valori il programma non li ha.
  const indiceSconosciuto = () => guida.noti.indice_nome && !TassiInternet.riconosci(guida.noti.indice_nome);
  // I parametri scritti dall'utente, quando le rate non ci sono o non bastano.
  const dichiarati = () => ({ tipo_prestito: tipoSicuro() || 'variabile', data_prima_rata: iniziPossibili()[0], ...guida.noti });
  // Che cosa mostrare, dall'esito della deduzione e dalle risposte date.
  function situazione() {
    const a = guida.analisi;
    if (!a || a.inCorso) return { tipo: 'attesa' };
    const r = a.risultato, primo = a.candidati[0];
    // Senza rate (o con un indice di cui non ci sono i valori) il tasso lo scrive l'utente.
    if (r.esito === 'senza-rate' || (conIndice() && tipoSicuro() === 'variabile' && indiceSconosciuto())) {
      return a.accettata ? { tipo: 'pronto', candidato: { parametri: dichiarati() }, dichiarato: true } : { tipo: 'manuale', motivo: r.esito === 'senza-rate' ? 'senza-rate' : 'indice' };
    }
    if (a.accettata) return { tipo: 'pronto', candidato: primo || (r.vicina ? { parametri: r.vicina.parametri } : { parametri: dichiarati() }), accettato: true };
    if (r.esito === 'vicino') return { tipo: 'vicino', candidato: primo };
    if (r.esito === 'nessuno') {
      const tipo = tipoSicuro(), lista = DA_CHIEDERE[tipo === 'variabile' || (!tipo && guida.saltate.has('tipo_prestito')) ? 'variabile' : 'fisso'];
      const chiave = !tipo && !guida.saltate.has('tipo_prestito') ? 'tipo_prestito' : lista.find(k => guida.noti[k] == null && !guida.saltate.has(k));
      return chiave ? { tipo: 'chiedi', chiave } : { tipo: 'arreso' };
    }
    const differenze = Deduzione.differenzeFra(a.candidati).filter(d => !guida.chiusi.has(d.chiave) && guida.noti[d.chiave] == null);
    return differenze.length ? { tipo: 'dubbio', differenza: differenze[0], candidato: primo } : { tipo: 'pronto', candidato: primo };
  }

  const tassoChiave = p => variabile(p) ? 'spread' : 'tasso_fisso';
  function formatoValore(chiave, v) {
    if (chiave === 'spread' || chiave === 'tasso_fisso' || chiave === 'tasso_annuo_piano') return perc(v, 3, 2);
    if (chiave === 'spese_rata') return v > 0 ? euro(v) : 'Nessuna spesa';
    return chiave === 'indice_nome' ? v : nomeScelta(chiave, v);
  }
  const stessoValore = (chiave, a, b) => typeof a === 'number' ? Math.abs(a - b) < (chiave === 'tasso_annuo_piano' ? 5e-5 : 1e-9) : a === b;
  // Che cosa ha capito, in parole: tipo, tasso, regole, e a quale mese si riferisce ogni rata.
  function capito(p) {
    const voci = [['Tipo', nomeScelta('tipo_prestito', p.tipo_prestito)],
      ['Tasso', variabile(p) ? `${p.indice_nome} + ${perc(p.spread, 3, 2)} di spread` : `${perc(p.tasso_fisso, 3, 2)} fisso (TAN)`],
      ...descriviRegole(p)];
    if (variabile(p) && p.floor_attivo > 0) voci.push(['Indice minimo', `${perc(p.indice_minimo || 0, 3, 1)}: quando l'indice era più basso, la banca ha usato questo valore`]);
    const primo = primoAddebito();
    if (primo && p.data_prima_rata) voci.push(['Ogni rata copre', p.data_prima_rata.slice(0, 7) === primo.slice(0, 7) ? 'il mese in cui viene addebitata' : 'il mese prima dell\'addebito']);
    return crea('dl', { className: 'riepilogo-guida' }, ...voci.flatMap(([etichetta, valore]) => [crea('dt', {}, etichetta), crea('dd', {}, valore)]));
  }
  const titoloEsito = (testo, icona, classe) => crea('h3', { className: 'esito-analisi ' + classe }, Icone.crea(icona, 'icona'), testo);
  // Rate che non tornano: quanto ha scritto l'utente e quanto dice il calcolo.
  function tabellaSbagliate(sbagliate) {
    const mesi = new Map(periodiIniziati().map(p => [p.n, p.inizio]));
    return crea('div', { className: 'contenitore-tabella semplice' }, crea('table', {},
      crea('thead', {}, crea('tr', {}, crea('th', {}, 'Rata'), crea('th', { className: 'testo' }, 'Addebitata a'), crea('th', {}, 'Hai scritto'), crea('th', {}, 'Secondo il calcolo'))),
      crea('tbody', {}, ...sbagliate.map(s => crea('tr', {}, crea('td', {}, String(s.n)), crea('td', { className: 'testo' }, mesi.has(s.n) ? M.meseAnno(mesi.get(s.n)) : ''),
        crea('td', {}, euro(s.vera)), crea('td', {}, euro(s.calcolata)))))));
  }
  const campoNumero = (nome, valore, segnaposto, etichetta) => crea('label', {}, etichetta,
    crea('input', { type: 'text', inputMode: 'decimal', name: nome, value: valore, placeholder: segnaposto }));

  // Le domande per i dubbi: che cosa si chiede e perché.
  const TESTI_DUBBIO = {
    tipo_prestito: { domanda: 'Il tuo mutuo è a tasso fisso o variabile?', perche: 'Le rate che hai scritto tornano in tutti e due i casi: con altre rate lo capirei da solo, ma è più semplice chiederlo a te.' },
    indice_nome: { domanda: 'A quale indice è legato il tuo tasso?', perche: 'Le rate che hai scritto tornano con più versioni dell\'Euribor: succede quando nel periodo i loro valori si sono mossi insieme, o quando erano tutti sotto lo zero.' },
    spread: { domanda: 'Quanto vale lo spread?', perche: 'Le rate che hai scritto tornano con più di uno spread.' },
    tasso_fisso: { domanda: 'Qual è il tasso (TAN) del contratto?', perche: 'Le rate che hai scritto tornano con più di un tasso.' },
    spese_rata: { domanda: 'Quanto paghi di spese su ogni rata?', perche: 'Le rate che hai scritto tornano con spese diverse.' },
    tipo_piano: { domanda: 'Come viene restituito il capitale?', perche: 'Le rate che hai scritto tornano in più di un modo.' },
    tasso_annuo_piano: { domanda: 'Mi scrivi la quota capitale di una rata?', perche: 'Le quote capitale del tuo piano sono state fissate alla firma, ma con queste rate non riesco a capire con quale tasso. La quota capitale di una delle prime rate basta a toglierlo.' },
    mesi_revisione: { domanda: 'Ogni quanto la banca aggiorna il tasso?', perche: 'Le rate che hai scritto tornano sia con un aggiornamento mensile sia con uno più lungo.' },
  };
  function domandaDubbio(d) {
    const testi = TESTI_DUBBIO[d.chiave], numero = ['spread', 'tasso_fisso', 'spese_rata'].includes(d.chiave), spese = d.motivo === 'spese';
    const proposto = formatoValore(d.chiave, d.valori[0]);
    const perche = !spese ? testi.perche : d.chiave === 'spread'
      ? `Dalle rate non riesco a distinguere lo spread dalle spese che la banca può aggiungere a ogni rata: i conti tornano con uno spread di ${proposto} senza spese, ma anche con uno spread un po' più basso e qualche euro di spese.`
      : `Dalle rate non riesco a distinguere il tasso dalle spese che la banca può aggiungere a ogni rata: i conti tornano con un tasso del ${proposto} senza spese, ma anche con un tasso un po' più basso e qualche euro di spese.`;
    const scelte = d.chiave === 'tasso_annuo_piano' ? [] : d.valori.map((v, i) => voce('risposta', String(i), formatoValore(d.chiave, v), spese ? 'Senza spese aggiunte alle rate.' : null, false));
    const altro = numero ? [voce('risposta', 'altro', spese ? 'Nel contratto c\'è un altro valore' : 'Un altro valore', null, false,
      crea('input', { type: 'text', inputMode: 'decimal', name: 'risposta_altro', placeholder: d.chiave === 'spese_rata' ? 'es. 1,50' : 'es. 1,25', 'aria-label': testi.domanda }))] : [];
    const quota = d.chiave !== 'tasso_annuo_piano' ? [] : [crea('div', { className: 'campi due-colonne' },
      crea('label', {}, 'Rata numero', crea('select', { name: 'quota_rata' }, ...ingressoAnalisi().rate.map(r => crea('option', { value: String(r.n) }, String(r.n))))),
      campoNumero('quota_valore', '', 'es. 280,00', 'Quota capitale (€)'))];
    const nonSo = voce('risposta', 'nonso', 'Non lo so', d.chiave === 'tasso_annuo_piano' ? 'Scelgo io il più probabile: con altre rate, la taratura nel pannello di controllo lo correggerà.'
      : `Uso ${proposto}, che è il più probabile.`, false);
    return crea('div', { className: 'domanda', 'data-campo': 'risposta' },
      crea('p', { className: 'titolo-domanda' }, testi.domanda), ...quota,
      crea('div', { className: 'scelte' }, ...scelte, ...altro, nonSo),
      spiegazione({ perche, dove: d.chiave === 'tasso_annuo_piano' ? 'Nel dettaglio della ricevuta della rata, alla voce «quota capitale», o nel piano di ammortamento.' : (DOMANDE[d.chiave] || {}).dove }));
  }
  function rispondiDubbio(d) {
    const scelta = $('#campi-passo input[name="risposta"]:checked');
    if (d.chiave === 'tasso_annuo_piano' && (!scelta || scelta.value !== 'nonso')) {
      const testo = $('#campi-passo [name="quota_valore"]').value.trim(), quota = leggiNumero(testo, true);
      if (!(quota > 0)) return mostraErrore('Scrivi la quota capitale in euro, ad esempio 280,00, oppure scegli «Non lo so».');
      const n = $('#campi-passo [name="quota_rata"]').value;
      (guida.rate[n] || (guida.rate[n] = {})).quota = testo;
      guida.conQuota = true;
      return avviaAnalisi();
    }
    if (!scelta) return mostraErrore('Scegli una risposta, oppure «Non lo so».');
    if (scelta.value === 'nonso') { guida.chiusi.add(d.chiave); guida.saltate.add(d.chiave); return disegnaAnalisi(); }
    if (scelta.value === 'altro') {
      const v = leggiNumero($('#campi-passo [name="risposta_altro"]').value, d.chiave === 'spese_rata');
      if (v == null || Number.isNaN(v) || v < (d.chiave === 'spread' ? -5 : 0) || v > (d.chiave === 'spese_rata' ? 1000 : 50)) return mostraErrore('Scrivi il valore del contratto, ad esempio 1,25.');
      guida.noti[d.chiave] = d.chiave === 'spese_rata' ? v : daPercento(v);
      return avviaAnalisi();
    }
    const valore = d.valori[+scelta.value];
    guida.analisi.candidati = guida.analisi.candidati.filter(c => stessoValore(d.chiave, c.parametri[d.chiave], valore));
    guida.chiusi.add(d.chiave);
    disegnaAnalisi();
  }
  // Una domanda sul contratto quando le rate non tornano: le stesse domande del percorso completo, più «Non lo so».
  function domandaMancante(chiave) {
    if (chiave === 'tipo_prestito') {
      const d = DOMANDE.tipo_prestito;
      return crea('div', { className: 'domanda', 'data-campo': 'tipo_prestito' }, crea('p', { className: 'titolo-domanda' }, 'Il tuo mutuo è a tasso fisso o variabile?'),
        crea('div', { className: 'scelte' }, ...CAMPI.tipo_prestito.opzioni.slice(0, 2).map(o => voce('tipo_prestito', o.valore, o.etichetta, o.aiuto, false, null, o.icona)),
          voce('tipo_prestito', NON_SO, 'Non lo so', null, false)), spiegazione({ dove: d.dove }));
    }
    const domande = [creaDomanda(chiave), ...(chiave === 'regola_rilevazione' ? [creaDomanda('giorni_anticipo_euribor')] : [])];
    // Le caselle partono vuote e nessuna scelta è già fatta: un valore iniziale (spese 0) sembrerebbe già una risposta.
    for (const input of domande[0].querySelectorAll('input[type="text"]')) input.value = '';
    for (const scelta of domande[0].querySelectorAll('input[type="radio"]')) scelta.checked = false;
    if (!(DOMANDE[chiave] || {}).nonSo && CAMPI[chiave].tipo !== 'scelta') domande[0].append(crea('label', { className: 'spunta' }, crea('input', { type: 'checkbox', name: 'non_lo_so' }), crea('span', {}, 'Non lo so')));
    return domande;
  }
  function rispondiMancante(chiave) {
    const scelta = $(`#campi-passo input[name="${chiave}"]:checked`);
    if ($('#campi-passo [name="non_lo_so"]:checked') || (scelta && scelta.value === NON_SO)) { guida.saltate.add(chiave); return disegnaAnalisi(); }
    if (chiave === 'tipo_prestito') {
      if (!scelta) return mostraErrore('Scegli una risposta, oppure «Non lo so».');
      guida.noti.tipo_prestito = scelta.value;
      return avviaAnalisi();
    }
    const chiavi = [chiave, ...(chiave === 'regola_rilevazione' ? ['giorni_anticipo_euribor'] : [])];
    const letti = leggiDomande(chiavi, true);
    if (letti.errore) return mostraErrore(letti.errore);
    if (letti.nonSo.has(chiave)) { guida.saltate.add(chiave); return disegnaAnalisi(); }
    Object.assign(guida.noti, letti.valori);
    avviaAnalisi();
  }
  // Senza rate, o con un indice di cui il programma non ha i valori: il tasso lo scrive l'utente.
  function campiManuali(motivo) {
    const tipo = tipoSicuro();
    return !tipo ? [] : tipo !== 'variabile' ? ['tasso_fisso', 'spese_rata'] : motivo === 'indice' ? ['spread', 'spese_rata'] : ['indice_nome', 'spread', 'spese_rata'];
  }
  function rispondiManuale(s) {
    if (!tipoSicuro()) return mostraErrore('Scegli se il mutuo è a tasso fisso o variabile.');
    const letti = leggiDomande(campiManuali(s.motivo), true);
    if (letti.errore) return mostraErrore(letti.errore);
    Object.assign(guida.noti, letti.valori);
    Object.assign(guida.bozza, letti.valori);
    guida.analisi.accettata = true;
    disegnaAnalisi();
  }

  function disegnaAnalisi() {
    if (passoAttuale().tipo !== 'analisi') return;
    const s = guida.situazione = situazione(), a = guida.analisi, contenitore = $('#campi-passo'), avanti = $('#guida-avanti');
    avanti.disabled = s.tipo === 'attesa';
    avanti.textContent = { dubbio: 'Rispondi', chiedi: 'Riprova con questa risposta', vicino: 'Va bene così, avanti', arreso: 'Continua lo stesso' }[s.tipo] || 'Avanti';
    $('#errore-passo').hidden = true;
    const rate = a && !a.inCorso ? ingressoAnalisi().rate.filter(r => r.rata_vera != null).length : rateInserite().filter(r => r.rata_vera != null).length;
    const blocchi = [];
    if (s.tipo === 'attesa') {
      blocchi.push(crea('div', { className: 'attesa', role: 'status' }, crea('span', { className: 'rotella', 'aria-hidden': 'true' }),
        crea('div', {}, crea('p', {}, a && a.fase === 'scarico' ? 'Scarico da internet gli ultimi valori dell\'Euribor…'
          : `Sto confrontando ${rate === 1 ? 'la rata che hai scritto' : `le ${rate} rate che hai scritto`} con migliaia di modi di calcolarle: tassi, spese e regole dei contratti. Ci vuole qualche secondo.`),
        crea('progress', { max: 100, value: a ? Math.round(a.avanzamento * 100) : 0, id: 'avanzamento-analisi' }))));
    } else if (s.tipo === 'pronto') {
      const c = s.candidato, p = { ...guida.bozza, ...c.parametri };
      blocchi.push(titoloEsito(s.dichiarato ? 'Ecco il tuo prestito' : 'Ho capito come funziona il tuo prestito', 'spunta', 'riuscito'), capito(p));
      if (s.dichiarato) blocchi.push(crea('p', { className: 'nota' }, 'Il tasso l\'hai scritto tu; le altre regole del contratto le ho messe come le più diffuse. Quando avrai pagato qualche rata, scrivila nella pagina «Piano»: se i conti non tornano, la taratura automatica nel «Pannello di controllo» corregge le regole.'));
      else {
        const tutte = c.rate != null && c.rate === c.suRate && c.quote === c.suQuote;
        blocchi.push(crea('p', { className: 'nota ' + (tutte ? 'conferma' : 'evidenza') }, tutte ? (c.suRate === 1 ? '✓ La rata che hai scritto torna al centesimo con questo calcolo.' : `✓ Le ${c.suRate} rate che hai scritto tornano tutte al centesimo con questo calcolo.`)
          : c.rate == null ? 'Hai scelto di andare avanti con il calcolo che si avvicina di più, anche se le rate non tornano: controlla il piano, e usa la taratura nel «Pannello di controllo» quando avrai altre rate.'
            : `Con questo calcolo tornano ${c.rate} rate su ${c.suRate}: per le altre hai detto che va bene così.`));
        if (c.senza) blocchi.push(crea('p', { className: 'nota' }, `Per ${c.senza === 1 ? 'una rata' : `${c.senza} rate`} non ho ancora il valore dell'Euribor del giorno in cui la banca l'ha letto${guida.serieErrore ? ` (${guida.serieErrore})` : ''}: ${c.senza === 1 ? 'la controllerò' : 'le controllerò'} quando arriva.`));
        if (c.suRate < 3) blocchi.push(crea('p', { className: 'nota' }, 'Con così poche rate potrei sbagliarmi: quando ne avrai altre, scrivile nella pagina «Piano» e controlla che le righe restino verdi.'));
        if (guida.saltate.size) blocchi.push(crea('p', { className: 'nota' }, 'Dove non lo sapevi ho scelto io la risposta più probabile.'));
        const chiave = tassoChiave(p);
        blocchi.push(crea('details', { className: 'correggi-analisi' }, crea('summary', {}, 'Nel contratto c\'è scritto qualcosa di diverso?'),
          crea('p', { className: 'nota' }, 'Scrivi qui il valore del contratto e rifaccio i conti con quello.'),
          crea('div', { className: 'campi due-colonne' },
            campoNumero('correggi_tasso', perCampo(p[chiave], true), '', chiave === 'spread' ? 'Spread (%)' : 'Tasso TAN (%)'),
            campoNumero('correggi_spese', perCampo(p.spese_rata || 0), '', 'Spese per rata (€)')),
          crea('button', { type: 'button', className: 'secondario', id: 'ricalcola-analisi' }, 'Rifai i conti con questi valori')));
      }
    } else if (s.tipo === 'dubbio') {
      blocchi.push(titoloEsito('Ho capito quasi tutto: mi manca un dato', 'info', 'quasi'), domandaDubbio(s.differenza),
        crea('details', {}, crea('summary', {}, 'Cosa ho capito finora'), capito({ ...guida.bozza, ...s.candidato.parametri })));
    } else if (s.tipo === 'vicino') {
      const c = s.candidato;
      blocchi.push(titoloEsito('Quasi tutto torna, ma non tutto', 'attenzione', 'quasi'),
        crea('p', {}, `Con il calcolo qui sotto tornano ${c.rate} rate su ${c.suRate}. ${c.sbagliate.length === 1 ? 'Questa no' : 'Queste no'}:`),
        tabellaSbagliate(c.sbagliate),
        // Pochi centesimi di differenza: di solito manca un dettaglio, non c'è un errore di battitura.
        ...(c.sbagliate.every(x => Math.abs(x.vera - x.calcolata) <= 0.1)
          ? [crea('p', { className: 'nota' }, 'Le differenze sono di pochi centesimi: di solito vuol dire che mi manca un dettaglio, non che hai sbagliato a scrivere. Aggiungi qualche rata, oppure la quota capitale di una rata (la trovi nel dettaglio della ricevuta), e rifaccio i conti. Se non le hai, vai avanti lo stesso.'),
            crea('p', {}, crea('button', { type: 'button', className: 'secondario', id: 'torna-rate' }, 'Aggiungo rate o la quota capitale'))]
          : [crea('p', { className: 'nota' }, 'Controlla questi importi: forse c\'è un errore di battitura, oppure quel mese la banca ha addebitato qualcosa in più (una mora, una commissione). Se un importo è sbagliato, correggilo; se è giusto, vai avanti lo stesso.'),
            crea('p', {}, crea('button', { type: 'button', className: 'secondario', id: 'torna-rate' }, 'Correggo le rate'))]),
        crea('details', {}, crea('summary', {}, 'Cosa ho capito dalle altre rate'), capito({ ...guida.bozza, ...c.parametri })));
    } else if (s.tipo === 'chiedi') {
      blocchi.push(titoloEsito('Non riesco ancora a far tornare le tue rate', 'attenzione', 'quasi'),
        crea('p', {}, 'Ho provato le combinazioni di tassi, spese e regole più comuni, ma nessuna riproduce gli importi che hai scritto. Aiutami con un dato del contratto: con quello riprovo.'),
        ...[domandaMancante(s.chiave)].flat());
    } else if (s.tipo === 'arreso') {
      const vicina = a.candidati[0] || a.risultato.vicina;
      blocchi.push(titoloEsito('Non riesco a far tornare le tue rate', 'attenzione', 'quasi'),
        crea('p', {}, 'Ho provato anche con i dati che mi hai dato, ma i conti non tornano. Può darsi che un importo sia scritto male, oppure che il tuo contratto usi una regola che il programma non conosce.'),
        ...(vicina && vicina.sbagliate && vicina.sbagliate.length ? [crea('p', {}, 'Con il calcolo che si avvicina di più, ecco le differenze:'), tabellaSbagliate(vicina.sbagliate)] : []),
        crea('p', { className: 'nota' }, 'Puoi controllare le rate, rispondere tu a tutte le domande sul contratto, oppure andare avanti con il calcolo che si avvicina di più e sistemare dopo, con la taratura nel «Pannello di controllo».'),
        crea('div', { className: 'azioni' }, crea('button', { type: 'button', className: 'secondario', id: 'torna-rate' }, 'Controllo le rate'),
          crea('button', { type: 'button', className: 'secondario', id: 'percorso-completo' }, 'Rispondo io a tutte le domande')));
    } else if (s.tipo === 'manuale') {
      const tipo = tipoSicuro();
      blocchi.push(titoloEsito('Mi serve il tasso del contratto', 'documento', 'quasi'),
        crea('p', {}, s.motivo === 'indice' ? `Il programma non ha i valori di «${guida.noti.indice_nome}», quindi non posso ricavare lo spread dalle rate: scrivilo tu. I valori dell'indice li inserirai poi nella pagina «Tassi».`
          : 'Non hai scritto rate già pagate (o il prestito non è ancora partito), quindi non posso ricavare il tasso dalle rate: scrivilo tu, lo trovi nel contratto.'));
      if (!tipo) {
        blocchi.push(crea('div', { className: 'domanda', 'data-campo': 'tipo_manuale' }, crea('p', { className: 'titolo-domanda' }, 'Il tuo mutuo è a tasso fisso o variabile? *'),
          crea('div', { className: 'scelte' }, ...CAMPI.tipo_prestito.opzioni.slice(0, 2).map(o => voce('tipo_manuale', o.valore, o.etichetta, o.aiuto, false, null, o.icona))),
          spiegazione({ dove: DOMANDE.tipo_prestito.dove })));
      } else blocchi.push(...campiManuali(s.motivo).map(creaDomanda));
    }
    if (a && a.errore) blocchi.unshift(crea('p', { className: 'nota evidenza' }, `Qualcosa è andato storto nei calcoli: ${a.errore}`));
    contenitore.replaceChildren(...blocchi);
    if (s.tipo === 'chiedi') aggiornaMancante();
  }
  // Nella domanda sulla regola di rilevazione, i giorni lavorativi solo per la regola che li usa.
  function aggiornaMancante() {
    const regola = $('#campi-passo input[name="regola_rilevazione"]:checked'), giorni = $('#campi-passo [data-campo="giorni_anticipo_euribor"]');
    if (giorni) giorni.hidden = !regola || regola.value !== 'lavorativi_prima';
  }
  // «Avanti» nel passo: risponde alla domanda in corso; vero quando si può passare al passo dopo.
  function avantiAnalisi() {
    const s = guida.situazione || situazione();
    if (s.tipo === 'dubbio') rispondiDubbio(s.differenza);
    else if (s.tipo === 'chiedi') rispondiMancante(s.chiave);
    else if (s.tipo === 'manuale') rispondiManuale(s);
    else if (s.tipo === 'vicino' || s.tipo === 'arreso') { guida.analisi.accettata = true; return concludiAnalisi(situazione().candidato); }
    else if (s.tipo === 'pronto') return concludiAnalisi(s.candidato);
    return false;
  }
  // I numeri trovati (o scritti) vanno nella bozza, con i valori dell'indice scaricati nella guida.
  function concludiAnalisi(c) {
    const b = Object.assign(guida.bozza, c.parametri);
    if (b.nome === Archivio.predefiniti().nome) b.nome = b.tipo_prestito === 'variabile' || b.tipo_prestito === 'fisso' ? 'Il mio mutuo' : 'Il mio finanziamento';
    const serie = variabile(b) ? TassiInternet.riconosci(b.indice_nome) : null;
    guida.scaricati = serie && guida.serieScaricate[serie.codice] ? { codice: serie.codice, valori: guida.serieScaricate[serie.codice] } : null;
    return true;
  }
  // Passa all'altro percorso, con le risposte date finora.
  function cambiaPercorso(percorso) {
    if (percorso === 'completo' && primoAddebito() && !guida.bozza.data_prima_rata) guida.bozza.data_prima_rata = iniziPossibili()[0];
    Object.assign(guida, { percorso, passo: 1, massimo: 1 });
    disegnaPasso();
  }

  function disegnaPasso() {
    const passo = passoAttuale(), ultimo = guida.passo === passi().length - 1, utili = passiUtili();
    guida.massimo = Math.max(guida.massimo, guida.passo);
    $('#passi-guida').replaceChildren(...utili.map(i => crea('li', { className: (i === guida.passo ? 'attivo' : i < guida.passo ? 'fatto' : '') + (i <= guida.massimo ? ' raggiunto' : ''),
      'data-passo': i, title: passi()[i].titolo }, crea('span', {}, passi()[i].titolo))));
    $('#conta-passi').textContent = `Passo ${utili.indexOf(guida.passo) + 1} di ${utili.length}`;
    $('#titolo-passo').replaceChildren(Icone.distintivo(passo.icona || 'info', 'piccolo'), passo.titolo);
    // Il passo nuovo entra dal lato giusto: da destra andando avanti, da sinistra tornando indietro.
    const modulo = $('#form-guida');
    modulo.classList.remove('passo-avanti', 'passo-indietro');
    M.rianima(modulo, guida.passo >= (guida.disegnato ?? 0) ? 'passo-avanti' : 'passo-indietro');
    guida.disegnato = guida.passo;
    $('#testo-passo').textContent = passo.testo || '';
    $('#testo-passo').hidden = !passo.testo;
    $('#errore-passo').hidden = true;
    guida.consiglio = null;
    const contenitore = $('#campi-passo');
    if (passo.tipo === 'benvenuto') disegnaBenvenuto(contenitore);
    else if (passo.tipo === 'riepilogo') disegnaRiepilogo(contenitore);
    else if (passo.tipo === 'rate') disegnaRate(contenitore);
    else if (passo.tipo === 'essenziali') disegnaEssenziali(contenitore);
    else if (passo.tipo === 'analisi') contenitore.replaceChildren();
    else {
      const avanzati = (passo.avanzati || []).map(creaDomanda);
      contenitore.replaceChildren(...passo.campi.map(creaDomanda),
        ...(avanzati.length ? [crea('details', { className: 'avanzate' }, crea('summary', {}, 'Casi particolari: aprili solo se nel contratto trovi queste clausole'), ...avanzati)] : []));
      const indice = $('[data-campo="indice_nome"]', contenitore);
      if (indice) $('.scelte', indice).after(crea('label', { className: 'spunta', id: 'riga-precaricati' }, crea('input', { type: 'checkbox', name: 'carica_tassi', checked: guida.caricaTassi }), crea('span', {})),
        crea('div', { className: 'spiegazione', id: 'blocco-internet', hidden: true }, crea('p', { id: 'testo-internet' }),
          crea('p', {}, crea('button', { type: 'button', className: 'secondario', id: 'scarica-guida' }, 'Scarica adesso i valori')),
          crea('p', { className: 'evidenza-ok', id: 'esito-internet-guida', hidden: true })));
      // Chi non conosce il tasso iniziale del piano può ricavarlo dalla quota capitale della prima rata.
      const tassoPiano = $('[data-campo="tasso_annuo_piano"]', contenitore);
      if (tassoPiano) {
        tassoPiano.after(crea('div', { className: 'domanda', id: 'aiuto-quota' },
          crea('label', { className: 'titolo-domanda', htmlFor: 'campo-quota' }, 'Non conosci il tasso iniziale? Scrivi la quota capitale della prima rata'),
          crea('input', { type: 'text', inputMode: 'decimal', name: 'quota_prima_rata', id: 'campo-quota', placeholder: 'es. 280,00' }),
          crea('div', { className: 'spiegazione' }, crea('p', { id: 'esito-quota' }, 'La trovi nel piano di ammortamento o nella ricevuta della prima rata, alla voce «quota capitale»: da quella cifra il tasso lo ricavo io.'))));
      }
      aggiornaDomande();
    }
    $('#guida-indietro').hidden = guida.passo === 0;
    $('#guida-avanti').disabled = false;
    $('#guida-avanti').textContent = ultimo ? (guida.riapertura ? 'Salva la configurazione' : 'Crea il prestito') : passo.tipo === 'benvenuto' ? 'Cominciamo' : 'Avanti';
    $('#guida-annulla').hidden = !guida.riapertura && !guida.nuovo && !guida.daOfferte;
    $('#guida-carica').hidden = guida.riapertura || guida.nuovo || guida.passo !== 0;
    $('#configurazione').scrollTop = 0;
    window.scrollTo(0, 0);
    const primo = $('#campi-passo input[type="text"], #campi-passo input[type="date"]');
    if (primo && !passo.tipo) primo.focus({ preventScroll: true });
    // «Ci penso io»: la deduzione parte (o riprende il risultato di prima, se niente è cambiato) e ridisegna il passo.
    if (passo.tipo === 'analisi') { disegnaAnalisi(); avviaAnalisi(); }
  }
  // Salva nella bozza le risposte del passo corrente. Restituisce false (mostrando l'errore) se qualcosa non va.
  function raccogliPasso(severo) {
    const passo = passoAttuale();
    if (passo.tipo === 'riepilogo' || passo.tipo === 'benvenuto' || passo.tipo === 'analisi') return true;
    if (passo.tipo === 'essenziali') {
      if (!raccogliEssenziali(severo)) return false;
      if (severo) invalidaDopoAnalisi();
      return true;
    }
    if (passo.tipo === 'rate') {
      leggiCaselleRate();
      const errori = [];
      rateInserite(errori);
      if (severo && errori.length) return mostraErrore(`Importo non valido alla rata ${errori[0]}`);
      if (!errori.length) invalidaDopoAnalisi();
      return true;
    }
    const chiavi = campiDelPasso(passo), letti = leggiDomande(chiavi, severo);
    if (letti.errore) return mostraErrore(letti.errore);
    Object.assign(guida.bozza, letti.valori);
    for (const chiave of chiavi) if (letti.nonSo.has(chiave)) guida.nonSo.add(chiave); else if (chiave in letti.valori) guida.nonSo.delete(chiave);
    const spunta = $('#campi-passo [name="carica_tassi"]');
    if (spunta) guida.caricaTassi = spunta.checked;
    guida.ricavate = guida.dubbio = null;
    if (severo && passo.campi.includes('tipo_piano') && !guida.nonSo.has('tipo_piano') && guida.bozza.tipo_piano === 'quote_fisse' && !(guida.bozza.tasso_annuo_piano > 0)) {
      return mostraErrore('Per le quote fissate all\'inizio serve il tasso iniziale del piano: scrivilo, oppure scrivi nella casella sotto la quota capitale della prima rata e lo ricavo io. Se non hai nessuno dei due, scegli «Non lo so».');
    }
    return true;
  }
  // "riapertura": si rivede il prestito aperto; "nuovo": se ne aggiunge un altro. Senza nessuno dei due è il primo.
  // "partenza": risposte già date, ad esempio quelle di un'offerta che si comincia a seguire.
  M.apriGuida = function apriGuida(riapertura, nuovo = false, partenza = null) {
    const rate = {};
    if (riapertura) for (const r of stato.dati.rate) if (r.rata_vera != null || r.quota_capitale != null) rate[r.n] = { rata: perCampo(r.rata_vera), quota: perCampo(r.quota_capitale), esisteva: true };
    // Senza prestiti si può essere arrivati dalla scheda «Offerte»: «Annulla» ci riporta.
    const daOfferte = !riapertura && !Archivio.configurato() && (stato.soloOfferte || Archivio.offerte().length > 0);
    // Un'offerta che si comincia a seguire: il suo tasso e le sue spese sono già sicuri.
    const noti = !partenza ? {} : (partenza.tipo_prestito || 'variabile') === 'variabile' ? { indice_nome: partenza.indice_nome, spread: partenza.spread, spese_rata: partenza.spese_rata || 0 }
      : { tasso_fisso: partenza.tasso_fisso, spese_rata: partenza.spese_rata || 0 };
    Object.assign(guida, { percorso: riapertura ? 'completo' : 'breve', passo: 0, massimo: riapertura ? PASSI_COMPLETI.length - 1 : 0, riapertura, nuovo: !riapertura && nuovo && Archivio.configurato(), daOfferte, rate,
      righeRate: Math.max(12, ...Object.keys(rate).map(Number)), caricaTassi: true, scaricati: null, nonSo: new Set(), ricavate: null, dubbio: null,
      bozza: { ...Archivio.predefiniti(), ...(riapertura ? stato.dati.parametri : partenza || {}) },
      tipoBreve: partenza ? partenza.tipo_prestito || 'variabile' : null, dataAddebito: null, modoData: 'prima', conQuota: false, noti, chiusi: new Set(), saltate: new Set(), analisi: null,
      serieScaricate: {}, serieProvate: false, serieErrore: null });
    $('#configurazione').hidden = false;
    for (const id of ['#principale', '.schede', '#riepilogo', '#apri-configurazione']) $(id).hidden = true;
    disegnaPasso();
  };
  $('#apri-configurazione').addEventListener('click', () => M.apriGuida(true));
  $('#campi-passo').addEventListener('change', evento => {
    const tipo = passoAttuale().tipo, nome = evento.target.name;
    $('#errore-passo').hidden = true;   // l'avviso riguardava le risposte di prima
    if (!tipo) aggiornaDomande();
    else if (tipo === 'essenziali') {
      // Prima o ultima rata: cambiano la domanda e la spiegazione.
      if (nome === 'data_ultima') { raccogliEssenziali(false); disegnaEssenziali($('#campi-passo')); }
      else aggiornaEssenziali();
    } else if (tipo === 'rate' && nome === 'con_quota') { leggiCaselleRate(); guida.conQuota = evento.target.checked; disegnaRate($('#campi-passo')); }
    else if (tipo === 'analisi') {
      if (nome === 'tipo_manuale') { guida.noti.tipo_prestito = evento.target.value; disegnaAnalisi(); }
      else if (nome === 'regola_rilevazione') aggiornaMancante();
    }
  });
  $('#campi-passo').addEventListener('input', evento => {
    // Scrivendo il nome di un altro indice si seleziona da sola la voce "Un altro indice".
    if (evento.target.name === 'indice_nome_altro') { $('#campi-passo input[name="indice_nome"][value="altro"]').checked = true; return passoAttuale().tipo ? null : aggiornaDomande(); }
    if (evento.target.name === 'numero_rate' && passoAttuale().tipo === 'essenziali') return aggiornaEssenziali();
    // Scrivendo un valore diverso nella risposta a un dubbio si seleziona da sola la voce "Un altro valore".
    if (evento.target.name === 'risposta_altro') { $('#campi-passo input[name="risposta"][value="altro"]').checked = true; return; }
    if (evento.target.name !== 'quota_prima_rata') return;
    const quota = leggiNumero(evento.target.value, true), esito = $('#esito-quota');
    const tasso = typeof quota === 'number' ? Calcolo.tassoPianoDaQuota(guida.bozza.importo_iniziale, guida.bozza.numero_rate, 1, quota) : null;
    if (tasso == null || tasso > 0.15) { esito.textContent = quota == null ? 'La trovi nel piano di ammortamento o nella ricevuta della prima rata, alla voce «quota capitale»: da quella cifra il tasso lo ricavo io.' : 'Con questa cifra non riesco a ricavare un tasso: controlla di aver scritto la quota capitale e non la rata intera.'; return; }
    $('#campi-passo [name="tasso_annuo_piano"]').value = perCampo(tasso, true);
    esito.textContent = `Tasso iniziale del piano ricavato: ${perc(tasso, 3)}. L'ho scritto nella casella qui sopra.`;
  });
  // Rate già pagate: righe in più, e incolla di una colonna (o di due: rata e quota capitale) da un foglio di calcolo.
  $('#campi-passo').addEventListener('click', evento => {
    if (evento.target.id === 'altre-rate') { leggiCaselleRate(); guida.righeRate += 12; disegnaPasso(); }
    if (evento.target.id === 'usa-consiglio' && guida.consiglio) { Object.assign(guida.bozza, guida.consiglio); disegnaPasso(); }
    if (evento.target.id === 'scarica-guida') scaricaNellaGuida(evento.target);
    if (evento.target.id === 'apri-offerte') { stato.soloOfferte = true; M.avvia(); }
    if (evento.target.id === 'percorso-completo') cambiaPercorso('completo');
    if (evento.target.id === 'percorso-breve') cambiaPercorso('breve');
    if (evento.target.id === 'torna-rate') { guida.passo = PASSI_BREVI.findIndex(p => p.tipo === 'rate'); disegnaPasso(); }
    // «Nel contratto c'è scritto altro?»: i valori scritti diventano sicuri e la deduzione riparte.
    if (evento.target.id === 'ricalcola-analisi') {
      const p = { ...guida.bozza, ...guida.situazione.candidato.parametri }, chiave = tassoChiave(p);
      const tasso = leggiNumero($('#campi-passo [name="correggi_tasso"]').value), spese = leggiNumero($('#campi-passo [name="correggi_spese"]').value, true);
      if (typeof tasso !== 'number' || Number.isNaN(tasso) || typeof spese !== 'number' || Number.isNaN(spese) || spese < 0) return mostraErrore('Scrivi il tasso in percentuale (ad esempio 1,25) e le spese in euro (0 se non ci sono).');
      if (Math.abs(daPercento(tasso) - p[chiave]) > 1e-9) guida.noti[chiave] = daPercento(tasso);
      if (Math.abs(spese - (p.spese_rata || 0)) > 0.001) guida.noti.spese_rata = spese;
      avviaAnalisi();
    }
  });
  async function scaricaNellaGuida(pulsante) {
    raccogliPasso(false);
    const b = guida.bozza, serie = TassiInternet.riconosci(b.indice_nome);
    if (!serie) return;
    pulsante.disabled = true; pulsante.setAttribute('aria-busy', 'true');
    pulsante.textContent = 'Scarico…';
    try {
      const { valori } = await TassiInternet.scarica(serie, TassiInternet.inizioScarico(b.data_prima_rata), stato.oggi);
      guida.scaricati = { codice: serie.codice, valori };
      if (!valori.length) mostraErrore(`La ${TassiInternet.FONTE} non ha valori di ${serie.nome} per il periodo del tuo mutuo.`);
      else $('#errore-passo').hidden = true;
    } catch (errore) {
      mostraErrore(errore.message);
    } finally {
      pulsante.disabled = false; pulsante.removeAttribute('aria-busy');
      aggiornaDomande();
    }
  }
  $('#campi-passo').addEventListener('paste', evento => {
    const casella = evento.target.closest('input[data-rata]');
    const righe = casella ? (evento.clipboardData || window.clipboardData).getData('text').split(/\r?\n/).filter(r => r.trim()) : [];
    if (righe.length < 2) return;   // un valore solo: incolla normale
    evento.preventDefault();
    leggiCaselleRate();
    const prima = +casella.dataset.rata, tipi = casella.dataset.tipo === 'rata' ? ['rata', 'quota'] : ['quota'], ultima = periodiIniziati().length;
    righe.forEach((riga, i) => {
      if (prima + i > ultima) return;
      const voce = guida.rate[prima + i] || (guida.rate[prima + i] = {});
      riga.split('\t').slice(0, tipi.length).forEach((valore, colonna) => { if (valore.trim()) voce[tipi[colonna]] = valore.trim(); });
    });
    guida.righeRate = Math.max(guida.righeRate, Math.min(ultima, prima + righe.length - 1));
    disegnaPasso();
  });
  // Clic su un passo già raggiunto: ci si torna direttamente (in avanti solo se le risposte del passo attuale sono a posto).
  $('#passi-guida').addEventListener('click', evento => {
    const voce = evento.target.closest('li[data-passo]');
    const destinazione = voce ? +voce.dataset.passo : guida.passo;
    if (destinazione === guida.passo || destinazione > guida.massimo || !raccogliPasso(destinazione > guida.passo) || !passoServe(destinazione)) return;
    if (destinazione > guida.passo && passoAttuale().tipo === 'analisi') return;
    guida.passo = destinazione;
    disegnaPasso();
  });
  $('#guida-indietro').addEventListener('click', () => { raccogliPasso(false); guida.passo = passoPrima(guida.passo); disegnaPasso(); });
  $('#guida-annulla').addEventListener('click', () => M.avvia());
  $('#form-guida').addEventListener('submit', async evento => {
    evento.preventDefault();
    if (!raccogliPasso(true)) return;
    if (passoAttuale().tipo === 'analisi' && !avantiAnalisi()) return;
    if (guida.passo < passi().length - 1) { guida.passo = passoDopo(guida.passo); return disegnaPasso(); }
    const rate = rateInserite(), tassi = variabile(guida.bozza) ? tassiPronti(guida.bozza) : [];
    try {
      await Archivio.richiesta('POST', 'configura', { parametri: guida.bozza, tassi, rate, nuovo: guida.nuovo });
    } catch (errore) {
      return mostraErrore(errore.message);
    }
    const prima = !guida.riapertura;
    await M.avvia();
    if (!prima) return avvisa('Configurazione salvata');
    if (tassi.length || rate.length || !variabile(guida.bozza)) { M.mostraScheda('piano'); avvisa('Prestito creato. Nel piano le rate verdi tornano con i conti della banca.'); }
    else { M.mostraScheda('tassi'); avvisa(TassiInternet.riconosci(guida.bozza.indice_nome) ? 'Prestito creato. Ora scarica da internet i valori dell\'indice, con il pulsante qui sotto.' : 'Prestito creato. Ora inserisci i valori dell\'indice: le date che servono sono elencate qui.'); }
  });

  // I moduli costruiti dalla descrizione dei campi servono anche alla scheda «Offerte».
  M.campi = { crea: creaCampo, leggi: leggiCampi, aggiornaVisibili };

  // ---------- Regole del contratto nel pannello ----------
  const CHIAVI_REGOLE = Object.keys(CAMPI).filter(c => !CAMPI[c].nascosto);
  function disegnaRegole() {
    const contenitore = $('#campi-regole'), p = stato.dati.parametri;
    if (contenitore.contains(document.activeElement)) return;   // non si riscrive il modulo mentre lo si compila
    contenitore.replaceChildren(...CHIAVI_REGOLE.map(c => creaCampo(c, p[c], false, p)));
    aggiornaVisibili(contenitore, CHIAVI_REGOLE, p);
  }
  $('#campi-regole').addEventListener('change', () => aggiornaVisibili($('#campi-regole'), CHIAVI_REGOLE, stato.dati.parametri));
  $('#form-regole').addEventListener('submit', async evento => {
    evento.preventDefault();
    const letti = leggiCampi($('#campi-regole'), CHIAVI_REGOLE);
    if (letti.errore) return avvisa(letti.errore, true);
    // Si salvano solo i valori cambiati, così gli altri restano identici fino all'ultima cifra.
    const cambiati = Object.fromEntries(Object.entries(letti.valori).filter(([chiave, valore]) => valore !== stato.dati.parametri[chiave]));
    if (!Object.keys(cambiati).length) return avvisa('Nessuna regola modificata');
    if (document.activeElement) document.activeElement.blur();
    await esegui('PUT', 'parametri', cambiati, 'Regole salvate');
  });
  $('#riapri-guida').addEventListener('click', () => M.apriGuida(true));

  // ---------- Taratura automatica ----------
  let esiti = null;
  function disegnaTaratura() {
    const blocco = $('#esito-taratura');
    if (!esiti) { blocco.replaceChildren(); return; }
    const vere = stato.dati.rate.filter(r => r.rata_vera != null).length;
    if (!vere) { blocco.replaceChildren(crea('p', { className: 'nota' }, 'Prima inserisci nel piano almeno tre o quattro rate vere, con i valori dell\'indice di quei mesi.')); return; }
    const righe = esiti.map((e, i) => crea('tr', {},
      crea('td', { className: 'testo' }, ...descriviRegole({ ...stato.dati.parametri, ...e.parametri }).map(([etichetta, valore]) => crea('div', {}, crea('small', {}, etichetta + ': '), valore))),
      crea('td', {}, crea('strong', {}, `${e.rate} su ${e.suRate}`), crea('div', {}, crea('small', {}, 'rate uguali')),
        ...(e.suQuote ? [crea('div', {}, `${e.quote} su ${e.suQuote}`), crea('div', {}, crea('small', {}, 'quote capitale'))] : []),
        ...(e.senzaTasso ? [crea('div', {}, crea('small', {}, `${e.senzaTasso} senza valore dell'indice`))] : [])),
      crea('td', { className: 'azione' }, crea('button', { type: 'button', className: i ? 'secondario piccolo' : 'piccolo', 'data-esito': i }, 'Usa queste'))));
    const migliore = esiti[0];
    const giudizio = migliore.rate === migliore.suRate ? 'La prima combinazione riproduce tutte le tue rate.'
      : migliore.rate === 0 ? 'Nessuna combinazione riproduce le tue rate: controlla i valori dell\'indice inseriti, oppure il tuo contratto usa regole che il programma non prevede.'
        : `La combinazione migliore riproduce ${migliore.rate} rate su ${migliore.suRate}.`;
    blocco.replaceChildren(crea('p', { className: 'nota' }, giudizio + (vere < 3 ? ' Con così poche rate il risultato è poco affidabile: aggiungine altre.' : '')),
      ...(migliore.dubbio ? [crea('p', { className: 'nota evidenza' }, testoDubbio(migliore.dubbio))] : []),
      crea('div', { className: 'contenitore-tabella semplice' }, crea('table', { className: 'tabella-taratura' }, crea('tbody', {}, ...righe))));
  }
  $('#avvia-taratura').addEventListener('click', evento => {
    const pulsante = evento.currentTarget;
    pulsante.disabled = true; pulsante.setAttribute('aria-busy', 'true');
    pulsante.textContent = 'Sto provando le combinazioni…';
    // Il calcolo prova alcune centinaia di combinazioni: parte dopo aver aggiornato la scritta sul pulsante.
    setTimeout(() => {
      esiti = Calcolo.tara(stato.dati);
      if (!esiti.length) esiti = [];
      pulsante.disabled = false; pulsante.removeAttribute('aria-busy');
      pulsante.textContent = 'Trova le regole giuste';
      disegnaTaratura();
    }, 30);
  });
  $('#esito-taratura').addEventListener('click', async evento => {
    const pulsante = evento.target.closest('button[data-esito]');
    if (!pulsante) return;
    const scelto = esiti[+pulsante.dataset.esito];
    if (await esegui('PUT', 'parametri', scelto.parametri, 'Regole applicate')) { esiti = null; disegnaTaratura(); }
  });

  // ---------- Backup: una copia di tutti i dati in un file, da ricaricare qui o su un altro computer ----------
  // I dati stanno nel browser. Il browser ricorda anche la data dell'ultimo backup (salvato o caricato), per il pannello.
  const quando = iso => new Date(iso).toLocaleString('it-IT', { dateStyle: 'long', timeStyle: 'short' });
  const testoRate = n => n === 0 ? 'nessuna rata pagata inserita' : n === 1 ? '1 rata pagata inserita' : `${n} rate pagate inserite`;
  function ricordaBackup(iso) {
    M.ricordo.scrivi('ultimo-backup', iso || '');
    disegnaBackup();
  }
  function disegnaBackup() {
    const ultimo = M.ricordo.leggi('ultimo-backup'), nota = $('#ultimo-backup');
    const valido = ultimo && !isNaN(Date.parse(ultimo));
    nota.classList.toggle('evidenza', !valido);
    if (!valido) return void (nota.textContent = 'Non hai ancora salvato un backup da questo browser.');
    const giorno = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const giorni = Math.round((giorno(new Date()) - giorno(new Date(ultimo))) / 864e5);
    nota.textContent = `Ultimo backup: ${quando(ultimo)}` + (giorni <= 0 ? ' (oggi).' : giorni === 1 ? ' (ieri).' : ` (${giorni} giorni fa).`);
  }
  $('#salva-file').addEventListener('click', () => {
    if (M.salvaSuFile) return M.salvaSuFile();   // versione in un unico file: salva nel file dei dati
    // Il nome dice cosa c'è dentro: il prestito, oppure «prestiti» se sono più di uno (il backup li contiene tutti).
    const prestiti = Archivio.elenco();
    const nome = prestiti.length > 1 ? 'prestiti' : !prestiti.length ? 'offerte'
      : prestiti[0].parametri.nome.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'prestito';
    const nomeFile = `backup-${nome}-${stato.oggi}.json`;
    const collegamento = crea('a', { href: URL.createObjectURL(new Blob([Archivio.esporta()], { type: 'application/json' })), download: nomeFile });
    document.body.append(collegamento);
    collegamento.click();
    collegamento.remove();
    setTimeout(() => URL.revokeObjectURL(collegamento.href), 1000);
    ricordaBackup(new Date().toISOString());
    avvisa(`Backup salvato: «${nomeFile}», di solito nella cartella Download`);
  });
  // Sostituisce i dati con quelli di un backup. Con "conferma" (ci sono dati che verrebbero sostituiti) prima chiede,
  // dicendo di quando è il backup e che cosa contiene.
  M.caricaSalvataggio = async function caricaSalvataggio(testo, conferma) {
    const contenuto = Archivio.descrivi(testo);
    if (!contenuto) { avvisa('Questo file non è un backup del programma, oppure è rovinato: non ho cambiato niente.', true); return false; }
    const { nomi, rate, offerte, salvato } = contenuto;
    const delBackup = salvato ? `il backup del ${quando(salvato)}` : 'il backup';
    const dentro = [...(nomi.length ? [`${nomi.join(', ')}, con ${testoRate(rate)}`] : []),
      ...(offerte ? [offerte === 1 ? '1 offerta da confrontare' : `${offerte} offerte da confrontare`] : [])].join('; ');
    if (conferma && !confirm(`Vuoi caricare ${delBackup}?\nContiene: ${dentro}.\n\nTutti i prestiti e le offerte di adesso verranno sostituiti con quelli del backup.`)) return false;
    try {
      Archivio.importa(testo);
    } catch (errore) {
      avvisa(errore.message, true);
      return false;
    }
    ricordaBackup(salvato);
    await M.avvia();
    avvisa(`Caricato ${delBackup}`);
    return true;
  };
  async function caricaDaFile(input, conferma) {
    const file = input.files[0];
    input.value = '';
    if (file) await M.caricaSalvataggio(await file.text(), conferma);
  }
  $('#carica-file input').addEventListener('change', evento => caricaDaFile(evento.target, true));
  $('#guida-carica input').addEventListener('change', evento => caricaDaFile(evento.target, false));
  $('#cancella-tutto').addEventListener('click', () => {
    if (!confirm('Cancellare tutti i prestiti e le offerte, con le rate e i tassi inseriti? Se non hai salvato un backup non si possono recuperare. Per toglierne uno solo usa «Elimina» nella pagina «Prestiti».')) return;
    Archivio.azzera();
    ricordaBackup(null);
    location.hash = '';
    M.avvia();
  });

  M.viste.push(disegnaRegole, disegnaTaratura, disegnaBackup);
})();
