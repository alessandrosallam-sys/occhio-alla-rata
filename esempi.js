// Prova con degli esempi (26 ottobre 2026): per vedere come funziona il programma prima di scrivere i propri dati.
// «Prova con degli esempi» (pagina di benvenuto, pagina Prestiti) passa a un archivio a parte (Archivio.entraInProva) e
// lo riempie con un prestito inventato per tipo e tre offerte, con le richieste di sempre. Le rate già pagate vengono
// dal calcolo, come le avrebbe addebitate la banca: il piano è tutto verde, salvo una rata del mutuo fisso con un
// addebito in più, per vedere come appare una rata che non torna. Una striscia in cima dice che sono esempi;
// «Esci dagli esempi» torna ai dati veri. Gli esempi si cambiano come i prestiti veri e spariscono uscendo o chiudendo
// la pagina; intanto backup, caricamento e «Cancella tutto» sono nascosti, perché valgono per i dati veri (stile.css).
(function () {
  'use strict';
  const M = window.Mutuo;
  // Cifre inventate, plausibili per ogni tipo. «extra»: una rata addebitata con qualcosa in più (numero, euro in più).
  // Le spese iniziali scritte una per una fanno da sole il totale (archivio.js).
  const PRESTITI = [
    { nome: 'Casa al mare', categoria: 'variabile', tipo_prestito: 'variabile', importo_iniziale: 180000, numero_rate: 300, data_prima_rata: '2021-07-01',
      valore_riferimento: 250000, indice_nome: 'Euribor 3 mesi', mesi_revisione: 3, spread: 0.011, floor_attivo: 1, indice_minimo: 0, spese_rata: 1.5,
      spese_iniziali_voci: [{ cosa: 'Istruttoria', euro: 500 }, { cosa: 'Perizia', euro: 250 }, { cosa: 'Imposta sostitutiva', euro: 450 }] },
    { nome: 'Appartamento in città', categoria: 'fisso', tipo_prestito: 'fisso', importo_iniziale: 150000, numero_rate: 240, data_prima_rata: '2020-10-01',
      valore_riferimento: 210000, tasso_fisso: 0.0185, spese_rata: 2, spese_iniziali: 900, extra: { n: 38, euro: 5 } },
    { nome: 'Villetta', categoria: 'misto', tipo_prestito: 'misto', importo_iniziale: 160000, numero_rate: 300, data_prima_rata: '2022-05-01',
      valore_riferimento: 220000, tasso_fisso: 0.0215, anni_tasso_fisso: 5, spread_dopo: 0.012, indice_nome: 'Euribor 3 mesi', spese_rata: 1.5, spese_iniziali: 800 },
    { nome: 'Lavori in casa', categoria: 'finanziamento', tipo_prestito: 'finanziamento', importo_iniziale: 12000, numero_rate: 60, data_prima_rata: '2024-04-01',
      tasso_fisso: 0.079, spese_rata: 3, spese_iniziali: 250 },
    { nome: 'Auto nuova', categoria: 'maxirata', tipo_prestito: 'maxirata', importo_iniziale: 20000, anticipo: 6000, numero_rate: 36, maxirata: 11500,
      data_prima_rata: '2025-03-01', tasso_fisso: 0.0599, spese_rata: 3.5, spese_iniziali: 350 },
  ];
  const OFFERTE = [
    { nome: 'Offerta A, tasso fisso', categoria: 'fisso', tipo_prestito: 'fisso', importo_iniziale: 200000, numero_rate: 300, tasso_fisso: 0.031, spese_rata: 2,
      spese_iniziali_voci: [{ cosa: 'Istruttoria', euro: 700 }, { cosa: 'Perizia', euro: 300 }, { cosa: 'Imposta sostitutiva', euro: 500 }] },
    { nome: 'Offerta B, tasso variabile', categoria: 'variabile', tipo_prestito: 'variabile', importo_iniziale: 200000, numero_rate: 300, indice_nome: 'Euribor 3 mesi',
      spread: 0.0095, spese_iniziali: 1000, spese_rata: 2 },
    { nome: 'Offerta C, tasso misto', categoria: 'misto', tipo_prestito: 'misto', importo_iniziale: 200000, numero_rate: 300, tasso_fisso: 0.0285, anni_tasso_fisso: 5,
      spread_dopo: 0.011, indice_nome: 'Euribor 3 mesi', spese_iniziali: 1200, spese_rata: 2 },
  ];
  const ATTESA_STORICO = 20000;   // millisecondi: oltre, si va avanti con i valori dell'Euribor che ci sono

  async function prepara() {
    // Il mutuo variabile ha bisogno dei valori dell'Euribor dal 2021: se lo storico sul dispositivo non è aggiornato si
    // scarica prima. Senza connessione l'esempio variabile resta senza le rate passate di cui manca l'indice.
    if (window.Storico) await Promise.race([Storico.aggiorna().catch(() => null), new Promise(fatto => setTimeout(fatto, ATTESA_STORICO))]);
    Archivio.entraInProva();
    for (const { extra, ...parametri } of PRESTITI) {
      const tassi = parametri.tipo_prestito === 'variabile' ? Archivio.precaricati(parametri.indice_nome, TassiInternet.inizioScarico(parametri.data_prima_rata)) : [];
      const dati = await Archivio.richiesta('POST', 'configura', { nuovo: true, parametri, tassi, rate: [] });
      // Le rate già pagate: quelle dei periodi finiti con l'indice noto, uguali al calcolo (più l'eventuale addebito in più).
      const righe = Calcolo.calcolaPiano(dati).righe.filter(r => r.fine < M.stato.oggi && r.origineEuribor !== 'previsione')
        .map(r => ({ n: r.n, rata_vera: Number((r.rataCalcolata + (extra && extra.n === r.n ? extra.euro : 0)).toFixed(2)) }));
      if (righe.length) await Archivio.richiesta('POST', 'rate', { righe });
    }
    for (const parametri of OFFERTE) await Archivio.richiesta('POST', 'offerte', { parametri });
    // Nessun prestito si apre da solo: si parte dall'elenco e si sceglie quale guardare.
    await Archivio.richiesta('DELETE', 'principale');
  }

  // Dopo l'entrata o l'uscita la pagina si ricarica dall'inizio (senza la pagina scritta nell'indirizzo), così ogni
  // scheda rilegge i dati giusti.
  function ricarica() {
    history.replaceState(null, '', location.pathname + location.search);
    location.reload();
  }

  async function entra(pulsante) {
    if (Archivio.inProva()) return;
    const testo = pulsante.textContent;
    pulsante.disabled = true;
    pulsante.textContent = 'Preparo gli esempi…';
    try {
      await prepara();
    } catch (errore) {
      Archivio.esciDallaProva();
      pulsante.disabled = false;
      pulsante.textContent = testo;
      return M.avvisa(errore.message, true);
    }
    ricarica();
  }
  function esci() {
    Archivio.esciDallaProva();
    ricarica();
  }

  // Con gli esempi: il segno su <html> (stile.css nasconde quello che vale solo per i dati veri) e la striscia in cima.
  if (Archivio.inProva()) {
    document.documentElement.dataset.esempi = 'si';
    document.getElementById('striscia-esempi').hidden = false;
  }
  document.addEventListener('click', evento => {
    const prova = evento.target.closest('[data-prova-esempi]');
    if (prova) entra(prova);
    else if (evento.target.closest('[data-esci-esempi]')) esci();
  });

  window.Esempi = { attivi: () => Archivio.inProva(), entra, esci };
})();
