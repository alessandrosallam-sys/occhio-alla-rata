// Le spiegazioni del robottino: che cosa dice quando si passa con il mouse (o si arriva con la tastiera, o si tocca)
// su una cosa importante, in tutte le pagine. Ogni voce è [selettore, testo] oppure [selettore, funzione(elemento)
// che restituisce il testo, o niente se non c'è da dire]. Si parte dall'elemento indicato e si sale verso i
// contenitori: vale la prima voce che corrisponde, quindi la cosa più vicina al puntatore. Un elemento può anche
// avere la sua spiegazione nell'attributo data-spiega.
(function () {
  'use strict';
  const M = window.Mutuo, { euro, meseAnno } = M;
  // Prima parte del testo di un'intestazione (senza le icone e senza la spiegazione piccola sotto).
  function etichetta(el) {
    const t = el && el.querySelector(':scope > th, :scope > dt, :scope > .etichetta, :scope > h3') || el;
    for (const n of t ? t.childNodes : []) {
      const testo = n.nodeType === Node.TEXT_NODE ? n.textContent.trim() : n.nodeType !== Node.ELEMENT_NODE || n.matches('svg, .icona') ? '' : n.textContent.trim();
      if (testo) return testo;
    }
    return '';
  }
  const perEtichetta = (tabella, testo) => { for (const [inizio, spiega] of tabella) if (testo.startsWith(inizio)) return spiega; return ''; };

  // Le righe del piano: lo stato della rata, con le cifre.
  function spiegaRata(tr) {
    const r = M.stato.piano && M.stato.piano.righe[+tr.dataset.n - 1];
    if (!r) return '';
    const quando = `Rata ${r.n}, ${meseAnno(r.inizio)}: `, oggi = M.stato.oggi;
    const parti = `${euro(r.quotaCapitale)} di capitale e ${euro(r.rataCalcolata - r.quotaCapitale - (M.stato.dati.parametri.spese_rata || 0))} di interessi`;
    const scarto = r.rataVera != null ? Math.round((r.rataVera - r.rataCalcolata) * 100) / 100 : 0;
    if (r.rataVera != null && scarto !== 0) return `${quando}non torna. La rata scritta è ${euro(r.rataVera)}, il calcolo dice ${euro(r.rataCalcolata)}: ${euro(Math.abs(scarto))} ${scarto > 0 ? 'in più' : 'in meno'}. Controlla l'importo sull'estratto conto, oppure, nella versione avanzata, prova la taratura nella pagina «Regole del contratto».`;
    if (r.rataCopiata) return `${quando}presa dal calcolo (${euro(r.rataVera)}), non ancora controllata sull'estratto conto. Clic sulla cifra per confermarla o correggerla.`;
    if (r.rataVera != null) return `${quando}torna al centesimo: la banca ha addebitato ${euro(r.rataVera)}, come dice il calcolo (${parti}).`;
    if (r.fine < oggi) return `${quando}è già passata ma manca l'importo addebitato: scrivilo nella colonna «Rata vera» (secondo il calcolo, ${euro(r.rataCalcolata)}).`;
    if (r.inizio <= oggi) return `${quando}è la rata di questo mese: ${euro(r.rataCalcolata)} secondo il calcolo, ${parti}.`;
    if (r.origineEuribor === 'previsione') return `${quando}rata futura, stimata: ${euro(r.rataCalcolata)}. L'indice di quel mese non si conosce ancora, quindi è una previsione.`;
    return `${quando}rata futura: ${euro(r.rataCalcolata)} (${parti}).`;
  }

  const RIEPILOGO = [
    ['Rata di', 'La rata di questo mese: quella addebitata, se l\'hai scritta, altrimenti quella calcolata. Sotto vedi quanto è cambiata dal mese prima.'],
    ['Prima rata', 'La prima rata del prestito, che non è ancora partito.'],
    ['Debito residuo', 'Quanto devi ancora restituire alla banca, senza gli interessi futuri. La barra mostra quanto hai già rimborsato.'],
    ['Tasso totale', 'Il tasso della rata di questo mese: l\'indice più lo spread. È quello che paghi davvero in questo periodo.'],
    ['Tasso fisso', 'Il tasso del contratto (TAN), uguale per tutte le rate: serve a calcolare gli interessi.'],
    ['TAEG', 'Il costo vero del prestito in percentuale all\'anno: interessi, spese e assicurazioni insieme. Serve a confrontare prestiti diversi.'],
    ['Totale rate', 'Tutto quello che avrai pagato con le rate alla fine del prestito; sotto, la parte di interessi e spese.'],
  ];
  const COSTI = [
    ['Importo prestato', 'La somma che ti ha prestato la banca.'],
    ['Soldi ricevuti davvero', 'L\'importo meno le spese pagate all\'inizio: è quello che ti è arrivato davvero, ed è la base del TAEG.'],
    ['Interessi che non paghi più', 'Gli interessi delle rate che non pagherai più, grazie al rimborso.'],
    ['Interessi', 'Quanto paghi alla banca per il prestito, oltre a restituire la somma prestata.'],
    ['Spese per rata', 'Le spese aggiunte a ogni rata, per tutta la durata.'],
    ['Spese iniziali', 'Le spese pagate una volta, all\'inizio: istruttoria, perizia, imposte.'],
    ['Spese e assicurazioni che non paghi più', 'Le spese e le assicurazioni delle rate che non pagherai più.'],
    ['Spese e assicurazioni', 'Spese e assicurazioni di tutta la durata, oltre agli interessi.'],
    ['Assicurazione restituita', 'La parte del premio dell\'assicurazione per il periodo che non userai.'],
    ['Assicurazioni', 'Il costo delle assicurazioni legate al prestito.'],
    ['Spese annuali', 'Le spese pagate ogni anno, come il bollo sul rendiconto.'],
    ['Costo totale', 'Tutto quello che paghi oltre alla somma prestata: interessi, spese e assicurazioni.'],
    ['Totale da pagare', 'Tutto quello che esce dalle tue tasche: la somma prestata più il costo totale.'],
    ['In tutto, con l', 'Quanto paghi in tutto, anticipo compreso.'],
    ['TAN', 'Il tasso annuo nominale: serve solo a calcolare gli interessi, non conta le spese.'],
    ['TAEG', 'Il costo vero in percentuale all\'anno, con spese e assicurazioni: è il numero giusto per confrontare prestiti diversi.'],
    ['Maxirata', 'L\'ultima rata, molto più grande delle altre.'],
    ['Anticipo', 'Quello che hai pagato subito al venditore: non fa parte del prestito.'],
    ['Debito residuo in quel momento', 'Quanto devi ancora alla banca subito dopo la rata scelta.'],
    ['Costi iniziali restituiti', 'La parte delle spese iniziali che la legge ti fa restituire, per il periodo che non usi.'],
    ['Da pagare il giorno', 'La somma da versare alla banca il giorno del rimborso.'],
    ['Risparmio', 'Quanto risparmi in tutto rimborsando prima.'],
    ['Penale', 'Quello che la banca può chiedere per il rimborso anticipato: per i mutui sulla casa di solito niente.'],
    ['Indennizzo', 'Per i finanziamenti la legge permette alla banca un piccolo indennizzo: al massimo l\'1% della somma rimborsata.'],
    ['Prima rata', 'La rata del primo mese.'],
    ['Rata più alta', 'La rata più alta che potresti pagare, secondo la previsione dell\'indice.'],
    ['Importo e durata', 'Quanto ti prestano e in quanto tempo.'],
    ['Tipo', 'Tasso fisso o variabile.'],
  ];
  const STATISTICHE = [
    ['Quanto hai pagato', 'Quanto hai versato finora con le rate, e quanta parte è capitale e quanta interessi.'],
    ['Le tue rate', 'La rata media, la più bassa e la più alta che hai pagato.'],
    ['Andamento', 'Come è cambiata la rata da un mese all\'altro.'],
    ['Tassi applicati', 'Il tasso medio, il più basso e il più alto delle rate pagate.'],
    ['Da qui alla fine', 'Quanto manca: interessi ancora da pagare e rate che restano.'],
  ];
  const CAPITO = [
    ['Tipo', 'Il tipo di prestito: decide se il tasso segue un indice o resta fisso.'],
    ['Tasso aggiornato', 'Ogni quanto cambia il tasso: ogni mese, oppure ogni 3 o 6 mesi con l\'Euribor della stessa durata.'],
    ['Tasso', 'Il tasso delle rate. Nel variabile è l\'indice di quel momento più lo spread, che resta sempre uguale; nel fisso è il TAN.'],
    ['Capitale', 'Come si restituisce il debito: alla francese la quota capitale si ricalcola ogni mese; con le quote fissate all\'inizio è scritta nel piano della firma; all\'italiana è sempre uguale.'],
    ['Indice letto', 'Il giorno in cui la banca legge l\'Euribor per una rata: di solito pochi giorni lavorativi prima che inizi il mese della rata.'],
    ['Interessi', 'Come si contano i giorni per gli interessi: un dodicesimo del tasso annuo ogni mese, oppure i giorni veri del mese.'],
    ['Spese per rata', 'Le spese che la banca aggiunge a ogni rata, già comprese nell\'importo addebitato.'],
    ['Ogni rata copre', 'Il mese a cui si riferiscono gli interessi di una rata, rispetto al giorno in cui viene addebitata.'],
    ['Indice minimo', 'Il «floor»: sotto questo valore la banca non fa scendere l\'indice, nemmeno quando è negativo.'],
    ['Rata arrotondata', 'Come la banca arrotonda la rata: al centesimo, ai 10 centesimi o all\'euro.'],
    ['Valori dell', 'I valori dell\'Euribor che il programma ha già per il periodo del prestito.'],
    ['Rate già pagate', 'Le rate che hai scritto: servono a controllare i conti della banca.'],
    ['Altre spese', 'Spese iniziali, assicurazioni e spese annuali: servono al costo totale e al TAEG.'],
    ['TAEG calcolato', 'Il costo vero in percentuale all\'anno, calcolato da me con le regole della legge: se scrivi quello dell\'offerta, ti dico se coincide.'],
    ['TAEG', 'Il costo vero in percentuale all\'anno, come lo scrive il contratto.'],
    ['Importo prestato', 'La somma che ti ha prestato la banca: la trovi nella prima pagina del contratto.'],
    ['Durata', 'Quante rate in tutto, e il mese della prima e dell\'ultima.'],
    ['Maxirata', 'L\'ultima rata, molto più grande delle altre.'],
    ['Anticipo', 'Quello che hai pagato subito al venditore: non fa parte del prestito.'],
    ['Spese iniziali', 'Le spese pagate una volta, all\'inizio: servono al costo totale e al TAEG.'],
    ['Assicurazioni', 'Le assicurazioni legate al prestito: servono al costo totale e al TAEG.'],
    ['Rate scritte', 'Le rate che hai scritto nel piano: quelle controllate sull\'estratto conto e quelle prese dal calcolo (segnate con «=»).'],
    ['Rate future', 'Come stimo l\'indice delle rate che verranno: il metodo e per quanti anni. Si cambia con «Cambia i dati».'],
    ['Si apre da solo', 'Il prestito principale si apre da solo quando apri la pagina. Lo scegli con la stella nella pagina «Prestiti».'],
    // Il riepilogo di un'offerta nella guida
    ['Che cosa', 'Il tipo di finanziamento: decide come faccio i conti.'],
    ['Offerta di', 'Chi ti ha fatto l\'offerta: serve a riconoscerla nel confronto.'],
    ['Importo', 'La somma che ti prestano, non il prezzo di quello che compri.'],
    ['Rata', 'La rata che pagherai ogni mese, calcolata da importo, durata e tasso, spese per rata comprese.'],
    ['Costo totale', 'Tutto quello che paghi oltre alla somma prestata: interessi, spese e assicurazioni.'],
    ['Totale da pagare', 'Tutto quello che esce dalle tue tasche: la somma prestata più il costo totale.'],
  ];
  const SCHEDE = {
    prestiti: 'Tutti i prestiti che segui, con il totale delle rate del mese e del debito. Da qui entri in uno e scegli il principale.',
    offerte: 'Devi ancora firmare? Qui confronti le offerte delle banche: ti dico quale costa meno.',
    pannello: 'Per tutti i prestiti: il backup dei dati e le impostazioni (versione semplice o avanzata, assistente, colori).',
    piano: 'Il piano rata per rata: scrivi le rate addebitate e vedi se tornano con i conti.',
    costi: 'Quanto costa davvero questo prestito, e quanto risparmi rimborsandolo prima.',
    tassi: 'I valori dell\'Euribor, con il grafico e le previsioni per le rate future.',
    calendario: 'In che giorno la banca legge l\'indice per ogni rata.',
    festivita: 'I giorni di chiusura delle banche, che non contano come lavorativi.',
    contratto: 'Le regole del contratto di questo prestito: taratura automatica, regole a mano, ritocchi, rata ideale.',
    dati: 'I dati di questo prestito, in parole: importo, durata, tasso, spese. Da lì li cambi se non sono giusti.',
  };

  const VOCI = [
    ['[data-spiega]', el => el.dataset.spiega],
    // Navigazione e testata
    ['.schede button[data-scheda], .sottomenu button[data-scheda]', el => SCHEDE[el.dataset.scheda]],
    ['.etichetta-ramo', 'Qui sotto c\'è il prestito su cui stai lavorando, con le sue pagine.'],
    ['[data-dati="cambia"]', 'Apre il modulo con importo, durata, tasso e spese: correggi e salva, il piano si ricalcola subito. Le rate scritte restano.'],
    ['[data-dati="guida"]', 'Ripete le domande della configurazione guidata, una alla volta, con le risposte già date. Le rate scritte restano.'],
    ['[data-dati="regole"]', 'Tutte le regole di dettaglio del contratto, con la taratura automatica.'],
    ['[data-dati="principale"]', 'Rendilo il prestito principale: si aprirà da solo quando apri la pagina.'],
    ['[data-azione="chiudi"]', 'Chiude il prestito: resta il menù generale, con l\'elenco di tutti i prestiti.'],
    ['.nome-prestito', el => `Il prestito aperto, «${el.textContent.replace('★', '').trim()}». Clic per i suoi dati: importo, durata, tasso, spese.`],
    ['[data-apri-prestito]', el => `Apri «${el.textContent.replace('★', '').trim()}»: le sue pagine prendono il posto di quelle di adesso.`],
    ['.stella', 'Il prestito principale: si apre da solo quando apri la pagina.'],
    ['[data-principale]', el => el.getAttribute('aria-pressed') === 'true' ? 'Questo è il prestito principale: si apre da solo quando apri la pagina. Clic per toglierlo.' : 'Rendilo il prestito principale: si aprirà da solo quando apri la pagina.'],
    ['#primo-prestito', 'Comincia a seguire il tuo prestito: ti chiedo l\'importo, la durata e qualche rata pagata.'],
    ['#scegli-tema', 'Le impostazioni: versione semplice o avanzata, che cosa fa l\'assistente, i colori della pagina.'],
    // Impostazioni (riquadro e pannello)
    ['[data-scelta-versione="semplice"]', 'La versione semplice mostra solo l\'essenziale: le rate e se tornano, quanto costa il prestito, il rimborso anticipato, il backup.'],
    ['[data-scelta-versione="avanzata"]', 'La versione avanzata aggiunge gli strumenti per chi conosce bene il contratto: colonne del piano, calendario, festività, previsioni, taratura, regole.'],
    ['label:has([data-opzione-assistente="spiega"])', 'Se lo spegni non spiego più le cose quando ci passi sopra con il mouse.'],
    ['label:has([data-opzione-assistente="segue"])', 'Se lo spegni resto in cima alla pagina e non ti seguo quando scorri.'],
    ['[data-scelta-logo]', el => el.title + ' Clic per usarlo come logo.'],
    ['[data-scelta-avatar]', el => el.title + ' Clic e divento così: è solo il disegno, quello che dico resta uguale.'],
    ['.intro', 'È il gufo di Occhio alla Rata: tiene d\'occhio le tue rate e i tuoi soldi. Clic e rifà il volo.'],
    ['#passa-avanzata', 'Mostra anche gli strumenti per esperti. Si torna alla semplice dalle «Impostazioni».'],
    // Riepilogo in testa
    ['#riepilogo .dato', el => perEtichetta(RIEPILOGO, etichetta(el)) || (/euribor|indice/i.test(etichetta(el)) ? 'Il valore dell\'indice per la rata di questo mese, e il giorno in cui la banca l\'ha letto.' : '')],
    // Piano
    ['#tabella-piano tbody tr[data-n]', spiegaRata],
    ['#tabella-piano thead th[data-gruppo]', el => `Il gruppo di colonne «${el.textContent.trim()}». Clic per mostrare o nascondere le colonne di approfondimento.`],
    ['#tabella-piano thead th[title]', el => el.title.replace(/^([^:]+): /, '«$1»: ')],
    ['#esito-conti', 'Il riassunto del piano: quante rate tornano con i conti della banca e quante sono da controllare.'],
    ['#compila-rate, #compila-rate-pannello', 'Riempie le rate passate senza importo con quelle calcolate. Restano segnate con «=» finché non le controlli sull\'estratto conto.'],
    ['#togli-copiate', 'Toglie le rate prese dal calcolo; quelle scritte da te restano.'],
    ['#vai-oggi', 'Porta la tabella alla rata di questo mese.'],
    ['#mostra-statistiche', 'Mostra o nasconde i riassunti: quanto hai pagato, interessi, rate medie, quanto manca.'],
    ['#colonne-extra button', el => el.title || 'Mostra o nasconde altre colonne di approfondimento.'],
    ['#legenda-piano', 'I colori delle righe: verde la rata torna, rosso è da controllare, il pallino è il mese in corso.'],
    ['.riquadro-statistica', el => perEtichetta(STATISTICHE, etichetta(el))],
    // Prestiti e offerte
    ['#aggiungi-prestito', 'Segui un altro prestito accanto a questo: un mutuo, un finanziamento, un\'auto.'],
    ['.totali-prestiti', 'I totali di tutti i tuoi prestiti: rate del mese, debito residuo e interessi ancora da pagare.'],
    ['.carta-prestito', el => `«${etichetta(el)}»: rata del mese, debito residuo e quanto manca. «Apri» per lavorarci.`],
    ['#aggiungi-offerta', 'Aggiungi un\'altra offerta da confrontare.'],
    ['#segui-prestito-offerte', 'Hai già un prestito? Comincia a seguirlo con la configurazione guidata.'],
    ['[data-segui]', 'Hai scelto? Comincia a seguire questo prestito, con i dati dell\'offerta già scritti.'],
    ['.tabella-offerte tbody tr', el => perEtichetta(COSTI, etichetta(el))],
    ['.carta-offerta', 'I dati di un\'offerta: li trovi nel foglio informativo della banca (PIES per i mutui, SECCI per i finanziamenti).'],
    // Tassi
    ['#periodi-tassi', 'Scegli il periodo del grafico: quello del tuo mutuo, gli ultimi anni o tutto dal 1999.'],
    ['#grafico', 'Il grafico dell\'indice: la linea è il valore giorno per giorno; a destra la previsione, con le fasce di incertezza. Passa sulla linea per leggere i valori.'],
    ['#dettagli-proiezione > summary', 'La previsione dell\'indice: il modello del grafico e quello usato per stimare le rate future. «Cambia» per sceglierne un altro.'],
    ['#usa-previsione', 'Usa questa previsione per stimare le rate future del piano.'],
    ['#togli-previsione', 'Torna al metodo semplice: la media delle variazioni passate.'],
    ['#scelta-scenario', 'Quale scenario usare per le rate future: quello atteso, uno prudente (rate più alte) o uno ottimista.'],
    ['#form-confronto', 'Controlla quale modello di previsione ha sbagliato di meno negli anni passati.'],
    ['#scarica-internet', 'Scarica dalla Bundesbank gli ultimi valori dell\'Euribor che mancano. Lo fa anche da solo quando apri la pagina.'],
    ['#sezione-aggiungi', 'Per scrivere a mano il valore dell\'indice di un giorno, se il tuo indice non è un Euribor o un valore manca.'],
    ['#form-incolla', 'Per incollare tanti valori insieme, copiati da un foglio di calcolo.'],
    ['#tabella-anni', 'L\'indice anno per anno: minimo, massimo e media.'],
    ['#tabella-tassi', 'I valori dell\'indice salvati per questo prestito: si possono correggere o togliere.'],
    // Calendario e festività
    ['.giorno.riferimento', 'Un giorno di rilevazione: qui la banca legge l\'indice per una rata. Clic per i dettagli.'],
    ['.giorno.contato', 'Uno dei giorni lavorativi contati all\'indietro per trovare il giorno di rilevazione.'],
    ['.giorno.festa', 'Una festività delle banche (calendario TARGET): non conta come giorno lavorativo.'],
    ['.giorno.oggi', 'Oggi.'],
    ['#riferimenti-anno tr', 'Una rilevazione dell\'anno: il giorno, la rata a cui serve e il valore dell\'indice. Clic per vederla nel calendario.'],
    ['#feste-anno tr', 'Una festività dell\'anno: clic per vederla nel calendario.'],
    ['#anno-prima, #anno-dopo, #anno-oggi', 'Cambia l\'anno del calendario.'],
    ['#form-festivita', 'Aggiungi un giorno di chiusura che non è nel calendario standard.'],
    ['#tabella-festivita', 'Le festività di ogni anno: contano per sapere i giorni lavorativi.'],
    // Pannello
    ['#salva-file', 'Scarica una copia di tutti i dati in un file: tienila al sicuro, ti serve se il browser li perde.'],
    ['#carica-file', 'Riapre un backup salvato prima: sostituisce i dati di adesso.'],
    ['#cancella-tutto', 'Cancella tutti i prestiti e le offerte da questo browser. Prima salva un backup!'],
    ['.tabella-costi tr', el => perEtichetta(COSTI, etichetta(el))],
    ['#estinzione', 'Simula il rimborso anticipato: scegli quando e quanto, e vedi quanto risparmi.'],
    ['#costo-prestito', 'Quanto costa davvero il prestito: interessi, spese, assicurazioni e TAEG.'],
    ['#avvia-taratura', 'Prova le combinazioni di regole del contratto e trova quella che riproduce le tue rate al centesimo.'],
    ['#allinea', 'Le rate passate che non hai scritto: puoi prenderle dal calcolo, o toglierle.'],
    ['#riapri-guida', 'Riapre la configurazione guidata, con le risposte già date.'],
    ['#form-regole', 'Le regole del contratto tutte insieme: cambiale solo se sai che cosa c\'è scritto nel contratto.'],
    ['#form-applicato', 'Per correggere a mano i valori di una sola rata (tasso, indice, data), come li ha applicati la banca.'],
    ['#form-obiettivo', 'Una rata ideale: il piano ti dice quando la rata la supera o ci rientra.'],
    ['#griglia-temi-pannello', 'I colori della pagina.'],
    // Guida
    ['.riepilogo-guida dd', el => { const dt = el.previousElementSibling; return dt ? perEtichetta(CAPITO, dt.textContent.trim()) : ''; }],
    ['.riepilogo-guida dt', el => perEtichetta(CAPITO, el.textContent.trim())],
    ['#calcolo-rate', 'Quanto sono sicuro di aver capito il tuo prestito: sale con le rate che scrivi. Al 100% le rate tornano tutte al centesimo e non ho dubbi.'],
    ['.data-rata', 'Il mese e il giorno in cui la banca ha preso questa rata dal conto.'],
    ['#rata-manca', 'Salta questa rata se non ce l\'hai: va bene anche non scriverle di fila.'],
    ['#rate-finite', 'Basta così: passo ai conti. Ne servono almeno tre o quattro.'],
    ['[data-vai-rata]', 'Una rata che hai già scritto: clic per riaprirla.'],
    ['[data-correggi-rata]', 'Riapre questa rata per correggere l\'importo.'],
    ['[data-togli-rata]', 'Toglie questa rata dai conti: se quel mese la banca ha addebitato qualcosa in più, le altre bastano.'],
    ['[data-anni]', el => `${el.dataset.anni} anni sono ${el.dataset.anni * 12} rate mensili.`],
    ['[data-durata-in="anni"]', 'Scrivi la durata in anni: le rate le conto io.'],
    ['[data-durata-in="rate"]', 'Scrivi il numero di rate, se il contratto lo dice così.'],
    ['#guida-carica', 'Riapre un backup salvato prima.'],
    ['#percorso-completo', 'Il percorso con tutte le domande sul contratto, per chi lo conosce bene.'],
    ['#ricalcola-analisi', 'Rifà i conti con i valori del contratto che hai scritto.'],
    ['#usa-probabile', 'Usa il valore più probabile: le rate che hai scritto tornano comunque.'],
  ];

  // La spiegazione dell'elemento indicato (o del suo contenitore più vicino che ne ha una): { el, testo } o null.
  function trova(bersaglio) {
    for (let x = bersaglio instanceof Element ? bersaglio : null; x && x !== document.body; x = x.parentElement) {
      for (const [selettore, voce] of VOCI) {
        if (!x.matches(selettore)) continue;
        const testo = typeof voce === 'function' ? voce(x) : voce;
        if (testo) return { el: x, testo };
      }
    }
    return null;
  }
  window.Spiegazioni = { trova };
})();
