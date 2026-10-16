# Mutuo variabile

Una pagina web che ricostruisce, rata per rata, un mutuo (a tasso variabile o fisso) o un finanziamento e lo confronta con quello che la banca addebita. Dice se ogni rata è giusta al centesimo, quanto costa davvero il prestito (con spese, assicurazioni e TAEG), quanto si è pagato finora di interessi e, per il variabile, come potrebbero andare le rate future.

È pensata per chi non sa niente di mutui: una configurazione guidata spiega ogni domanda, dove trovare la risposta nei documenti e cosa fare se non la si conosce. Dove può, il programma ricava le regole del contratto da solo, a partire dalle rate già pagate.

Non serve installare niente: si scarica la cartella e si apre `index.html` con il browser. I dati restano sul computer di chi la usa: nel browser e, con Edge o Chrome, in un file che si aggiorna da solo. L'unica cosa che passa da internet è lo scarico dei valori dell'Euribor dal sito della Bundesbank.

## Come si usa

1. Scarica il progetto (pulsante **Code → Download ZIP** su GitHub, oppure `git clone`) e apri `index.html` con un doppio clic. Provato con Microsoft Edge; dovrebbe funzionare con qualunque browser recente.
2. Alla prima apertura parte la **configurazione guidata**: nove passi, con le spiegazioni. Tieni a portata di mano il contratto di mutuo e qualche ricevuta delle rate. Alle domande tecniche puoi rispondere «Non lo so»: se inserisci tre o quattro rate già pagate, il programma prova le combinazioni di regole e sceglie quella che le riproduce.
3. Nella pagina **Piano** scrivi, mese per mese, la rata che la banca ti ha addebitato (colonna «Rata vera»): la riga diventa verde se i conti tornano, rossa se no.
4. Nella pagina **Tassi** ci sono i valori dell'indice. Se il tuo indice è un Euribor, il programma li scarica da solo a ogni apertura (vedi sotto); altrimenti li scrivi o li incolli a mano. Il grafico mostra tutta la storia dell'Euribor dal 1999 (all'inizio solo il periodo del tuo mutuo) e, a destra, la proiezione in avanti con diversi modelli statistici (media delle variazioni, nessun cambiamento, ARIMA, VAR, GARCH, Vasicek) o con le attese del mercato lette dalla curva degli Euribor di oggi, con le fasce di incertezza. Un confronto all'indietro dice quale modello ha sbagliato di meno negli anni passati. Ogni proiezione mostra anche cosa vorrebbe dire per le tue rate in tre scenari (fascia bassa, atteso, fascia alta), e puoi scegliere quale di questi usa il piano per stimare le rate future.
5. Dal **Pannello di controllo** puoi collegare un file in cui salvare tutto, ricaricarlo su un altro computer, rivedere le regole del contratto o lanciare la taratura automatica.
6. Nel **Pannello di controllo** trovi anche **quanto costa il prestito**: interessi, spese, assicurazioni, costo totale e TAEG. Se scrivi il TAEG del contratto, il programma ti dice se il suo calcolo coincide. Sotto c'è l'**estinzione anticipata**: scegli quando e quanto rimborsare (tutto o una parte) e vedi interessi risparmiati, penale o indennizzo secondo la legge, costi restituiti e, per un rimborso parziale, la nuova rata o la nuova fine.
7. **Devi ancora firmare?** Nella pagina **Offerte** (o dalla prima schermata, con «Confronta delle offerte») scrivi le offerte delle banche, prese dal foglio informativo (PIES per i mutui, SECCI per i finanziamenti): rata, interessi, costo totale e TAEG compaiono uno accanto all'altro, e l'offerta che costa meno è evidenziata. Per il tasso variabile vedi anche quanto potrebbe salire la rata, secondo un modello di previsione dell'indice. Quando hai scelto, «Segui questo prestito» passa i dati alla configurazione guidata.
8. Hai più di un prestito? Nella pagina **Prestiti** li vedi tutti, con il totale delle rate del mese e del debito residuo, e con «Aggiungi un prestito» ne segui un altro. Le altre pagine riguardano il prestito aperto: per passare a un altro premi «Apri».

Nella pagina Tassi il modulo della proiezione sta richiuso in una riga sotto il grafico («Cambia» lo apre). Sul telefono le pagine si scelgono dalla barra in basso e la tabella del piano scorre in orizzontale tenendo ferma la colonna delle rate. Il tema chiaro o scuro segue quello del sistema.

**Aspetto**: dal pulsante «Aspetto» (o dal pannello di controllo) si sceglie fra otto temi: Automatico, Chiaro, Notte, Carta, Salvia, Aurora, Ardesia e Contrasto alto. Cambia solo l'aspetto; la scelta resta nel browser.

**Dove stanno i dati.** I dati stanno nel browser (`localStorage`): se cancelli i dati di navigazione li perdi. Per non perderli:

- **con Edge o Chrome** premi **«Collega un file»** nel pannello di controllo e scegli dove tenerlo (ad esempio in Documenti, o in una cartella di OneDrive o Google Drive). Da quel momento ogni modifica viene scritta da sola nel file, un normale `.json` che puoi copiare o mettere in un backup. Il browser si ricorda il file, ma per sicurezza a ogni apertura chiede di nuovo il permesso di scriverci: basta premere «Riprendi il file» in alto (oppure fai una modifica: il permesso viene chiesto in quel momento; se il browser propone «Consenti a ogni visita», dopo non lo chiede più). Un indicatore in fondo alla barra laterale dice sempre se le modifiche finiscono nel file. Nel file stanno anche le scelte della proiezione (modello, orizzonte, scenario), così lo stesso file mostra la stessa proiezione in ogni browser. Se il file e il browser hanno dati diversi, perché hai usato il file su un altro computer o hai fatto modifiche senza riprenderlo, la pagina li mostra tutti e due e ti chiede quali tenere. Su un altro computer, o dopo aver cancellato i dati di navigazione, apri il file con «Carica da file»: torna collegato;
- **con gli altri browser** usa «Salva su file» ogni tanto: scarica una copia da ricaricare con «Carica da file».

## Cosa sa calcolare

Il tipo di prestito: **mutuo a tasso variabile** (indice + spread), **mutuo a tasso fisso** o **finanziamento** (prestito personale, auto, acquisti a rate). A tasso fisso le pagine dell'indice (Tassi, Calendario, Festività) non compaiono. Per ogni prestito: spese per rata, spese iniziali, assicurazioni (all'inizio o a ogni rata), spese annuali, e il **TAEG** calcolato come prevede la direttiva europea sul credito ai consumatori (2008/48/CE), da confrontare con quello del contratto.

Le regole del contratto si scelgono nella configurazione (o le trova la taratura):

| Regola | Scelte possibili |
|---|---|
| Aggiornamento del tasso | ogni 1, 3, 6 o 12 rate |
| Quando si legge l'indice | N giorni lavorativi prima della fine del periodo precedente; ultimo o primo giorno lavorativo; un giorno fisso del mese; media del mese precedente |
| Indice applicato | arrotondamento facoltativo, valore minimo (floor) facoltativo |
| Tasso totale | indice + spread, con tetto (cap) facoltativo |
| Conteggio dei giorni | giorni effettivi su 365/366, su 365, su 360; oppure un dodicesimo del tasso annuo |
| Quota capitale | piano francese ricalcolato a ogni rata; quote fissate all'inizio; quote costanti (piano italiano) |

Le festività considerate sono quelle del calendario TARGET (quello su cui si pubblica l'Euribor), modificabili.

**Le rate future** sono stime: l'indice dei mesi a venire non lo conosce nessuno. All'inizio il programma lo proietta con la variazione media del passato; nella pagina Tassi si può scegliere un modello statistico al suo posto. Le fasce di incertezza dicono quanto l'indice è stato variabile finora, non cosa farà la BCE.

**Non sono coperti**: preammortamento, rate non mensili; le estinzioni parziali si possono simulare nel pannello, ma non registrare nel piano; spread che cambia nel tempo (si può solo scrivere a mano, rata per rata, il tasso applicato).

**Attenzione**: il programma riproduce al centesimo un solo contratto vero, quello su cui è nato (Euribor 6 mesi, rilevazione quattro giorni lavorativi prima della fine del periodo, giorni effettivi su 365/366, quote fissate all'inizio). Le altre combinazioni, compresi tasso fisso e finanziamenti, hanno superato solo controlli di coerenza (per esempio: a tasso fisso la rata è costante; senza costi il TAEG è il TAN composto mese per mese). Se il tuo contratto torna, o non torna, apri una segnalazione: è il modo per migliorarlo.

## Dati dell'Euribor e licenza

I valori giornalieri dell'Euribor (1 settimana, 1, 3, 6 e 12 mesi) vengono scaricati dal [servizio dati della Deutsche Bundesbank](https://api.statistiken.bundesbank.de), che ripubblica i valori calcolati da EMMI con un giorno lavorativo di ritardo. È l'unica fonte istituzionale con i valori giornalieri che accetta le richieste di una pagina aperta dal disco. A ogni apertura la pagina scarica i giorni che mancano, dall'inizio del mutuo a oggi; la casella nella pagina Tassi spegne l'automatismo.

I valori **non sono nel repository**: l'Euribor è un indice di proprietà di EMMI, e la Bundesbank avverte che l'uso commerciale richiede un accordo con EMMI. Chi vuole averli dentro la pagina (per lavorare anche senza connessione) può generarli in locale con Node 22 o più recente:

```
node dati-euribor/scarica.js      scarica lo storico dal 1999 in file CSV (dati-euribor/*.csv)
node crea-precaricati.js          lo porta nel file tassi-precaricati.js, letto dalla pagina
```

Senza questi file la pagina funziona lo stesso: all'apertura scarica i valori che le servono.

## Avvertenza

Questo è uno strumento di controllo fatto da privati, senza alcuna garanzia. Non è una consulenza finanziaria né legale, e non sostituisce i conteggi della banca o di un professionista. Se trovi una differenza fra le rate calcolate e quelle addebitate, prima di contestarla alla banca verifica le regole del contratto: molte differenze dipendono da una regola scelta male, non da un errore della banca.

## Per chi vuole modificare il codice

Tutto è HTML, CSS e JavaScript scritti a mano, senza librerie né passaggi di compilazione: si modifica un file e si ricarica la pagina. Node serve solo per i due script dei dati.

```
index.html            pagina unica: guida iniziale + cinque schede (Piano, Tassi, Calendario, Festività, Pannello)
stile.css             stile: un blocco di variabili per ogni tema, poi i componenti
temi.js               scelta del tema (prima del disegno) e selettore «Aspetto»
calcolo.js            motore di calcolo con le regole sceglibili, e taratura automatica
archivio.js           dati nel browser: lettura, scrittura, controlli, salvataggio e caricamento su file
app.js                nucleo della pagina: formati, piano, statistiche, pannello di controllo
tassi.js              scheda Tassi, scarico da internet
calendario.js         schede Calendario e Festività
previsioni.js         proiezioni dell'indice nella pagina Tassi: modelli, scenari, confronto, scelta per le rate future
modelli.js            i modelli (media, ARIMA, VAR, GARCH, Vasicek): solo matematica, gira anche in Node
configura.js          configurazione guidata, regole nel pannello, taratura
prestiti.js           pagina Prestiti: tutti i prestiti seguiti, con i totali
costi.js              quanto costa il prestito aperto: costo totale e TAEG, estinzione anticipata (pannello di controllo)
offerte.js            pagina Offerte: confronto di offerte prima di firmare
file-collegato.js     il file collegato: i dati scritti da soli in un file scelto dall'utente (Edge e Chrome)
tassi-internet.js     lettura dei valori dell'Euribor dal sito della Bundesbank
tassi-precaricati.js  (generato, non nel repository) valori dell'Euribor dentro la pagina
crea-precaricati.js   genera tassi-precaricati.js dai CSV
dati-euribor/         scarica.js e i CSV che produce (non nel repository)
```

Gli script si caricano in quest'ordine: `calcolo.js`, `tassi-precaricati.js`, `tassi-internet.js`, `archivio.js`, `modelli.js`, `app.js`, `tassi.js`, `calendario.js`, `previsioni.js`, `configura.js`, `prestiti.js`, `costi.js`, `offerte.js`, `file-collegato.js`.

**Dati.** Un unico oggetto JSON in `localStorage` (chiave `mutuo-variabile:dati`), lo stesso formato del salvataggio su file: `{ versione: 2, attivo, prestiti: [...], offerte: [...] }` (un'offerta ha solo `id` e `parametri`), e per ogni prestito `id`, `parametri` (importo, rate, date, regole), `rate` (solo i valori scritti a mano: rata vera, quota capitale, tasso applicato…), `euribor` (i valori dell'indice, `{ giorno, tasso_360 }`), `festivita`. I salvataggi della versione 1 (un solo mutuo, con i campi in cima) si leggono ancora. `Archivio.richiesta(metodo, percorso, corpo)` espone le operazioni sul prestito aperto (`GET dati`, `PUT attivo/<id>`, `DELETE prestiti/<id>`, `POST configura`, `PUT rate/<n>`, `POST euribor`, …): ogni operazione è tutto-o-niente e restituisce i dati aggiornati. Dopo ogni modifica l'archivio chiama `Archivio.alCambio`: `file-collegato.js` lo usa per riscrivere il file collegato (File System Access API, `showSaveFilePicker`; la maniglia del file è ricordata in IndexedDB, database `mutuo-variabile`).

**Modelli.** `Modelli.stima(modello, serieMensile, opzioni)` (in `modelli.js`) restituisce la proiezione con le fasce; `Modelli.perGiorno` la trasforma nella funzione giorno → valore che il piano riceve come `opzioni.previsione`. Il file non tocca la pagina: `node -e "const M = require('./modelli.js'); …"` per provarlo.

**Motore.** `Calcolo.calcolaPiano(dati, opzioni)` restituisce le righe del piano con, per ogni rata, periodo, data di rilevazione, indice, tasso, interessi, quota capitale, rata calcolata e confronto con la rata vera. `Calcolo.tara(dati)` prova le combinazioni di regole sulle rate vere e restituisce le migliori. Le scelte possibili, con nome e spiegazione, sono in `Calcolo.REGOLE`.

**Prove.** Non ci sono strumenti di test nel repository. Le prove sono state fatte con Edge senza finestra (`msedge --headless=new --remote-debugging-port=…`) pilotato da uno script Node tramite il protocollo DevTools, che apre `index.html` da `file://`, simula clic e digitazione e legge il risultato dalla pagina. Dopo una modifica al motore va rifatta almeno la prova del contratto noto (le rate devono tornare tutte).

**Testi.** L'interfaccia è in italiano e parla a chi non sa niente di mutui: ogni domanda dice che cosa si chiede, dove trovarlo e cosa fare se non lo si sa. Chi aggiunge una regola o un campo deve aggiungere anche questi testi.

## Licenza

Codice con licenza MIT (vedi `LICENSE`). I valori dell'Euribor non fanno parte del progetto: vedi sopra.
