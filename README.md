# Mutuo variabile

Una pagina web che ricostruisce, rata per rata, un mutuo a tasso variabile e lo confronta con quello che la banca addebita. Dice se ogni rata è giusta al centesimo, quanto si è pagato finora di interessi e come potrebbero andare le rate future.

È pensata per chi non sa niente di mutui: una configurazione guidata spiega ogni domanda, dove trovare la risposta nei documenti e cosa fare se non la si conosce. Dove può, il programma ricava le regole del contratto da solo, a partire dalle rate già pagate.

Non serve installare niente: si scarica la cartella e si apre `index.html` con il browser. I dati restano nel browser di chi la usa (e si possono salvare su file). L'unica cosa che passa da internet è lo scarico dei valori dell'Euribor dal sito della Bundesbank.

## Come si usa

1. Scarica il progetto (pulsante **Code → Download ZIP** su GitHub, oppure `git clone`) e apri `index.html` con un doppio clic. Provato con Microsoft Edge; dovrebbe funzionare con qualunque browser recente.
2. Alla prima apertura parte la **configurazione guidata**: nove passi, con le spiegazioni. Tieni a portata di mano il contratto di mutuo e qualche ricevuta delle rate. Alle domande tecniche puoi rispondere «Non lo so»: se inserisci tre o quattro rate già pagate, il programma prova le combinazioni di regole e sceglie quella che le riproduce.
3. Nella pagina **Piano** scrivi, mese per mese, la rata che la banca ti ha addebitato (colonna «Rata vera»): la riga diventa verde se i conti tornano, rossa se no.
4. Nella pagina **Tassi** ci sono i valori dell'indice. Se il tuo indice è un Euribor, il programma li scarica da solo a ogni apertura (vedi sotto); altrimenti li scrivi o li incolli a mano.
5. Nella pagina **Previsioni** vedi la storia dell'Euribor dal 1999 e la proietti in avanti con diversi modelli statistici (media delle variazioni, ARIMA, VAR, GARCH, Vasicek), con le fasce di incertezza. Un confronto all'indietro dice quale modello ha sbagliato di meno negli anni passati. Ogni proiezione mostra anche cosa vorrebbe dire per le tue rate in tre scenari (fascia bassa, atteso, fascia alta), e puoi scegliere quale di questi usa il piano per stimare le rate future.
6. Dal **Pannello di controllo** puoi salvare tutto su un file, ricaricarlo su un altro computer, rivedere le regole del contratto o lanciare la taratura automatica.

I dati stanno nel browser (`localStorage`): se cancelli i dati di navigazione li perdi. Per questo c'è «Salva su file».

## Cosa sa calcolare

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

**Le rate future** sono stime: l'indice dei mesi a venire non lo conosce nessuno. All'inizio il programma lo proietta con la variazione media del passato; nella pagina Previsioni si può scegliere un modello statistico al suo posto. Le fasce di incertezza dicono quanto l'indice è stato variabile finora, non cosa farà la BCE.

**Non sono coperti**: preammortamento, estinzioni parziali, rate non mensili, spread che cambia nel tempo (si può solo scrivere a mano, rata per rata, il tasso applicato).

**Attenzione**: il programma riproduce al centesimo un solo contratto vero, quello su cui è nato (Euribor 6 mesi, rilevazione quattro giorni lavorativi prima della fine del periodo, giorni effettivi su 365/366, quote fissate all'inizio). Le altre combinazioni hanno superato solo controlli di coerenza. Se il tuo contratto torna, o non torna, apri una segnalazione: è il modo per migliorarlo.

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
index.html            pagina unica: guida iniziale + sei schede (Piano, Tassi, Calendario, Festività, Previsioni, Pannello)
stile.css             stile, tema chiaro e scuro
calcolo.js            motore di calcolo con le regole sceglibili, e taratura automatica
archivio.js           dati nel browser: lettura, scrittura, controlli, salvataggio e caricamento su file
app.js                nucleo della pagina: formati, piano, statistiche, pannello di controllo
tassi.js              scheda Tassi, scarico da internet
calendario.js         schede Calendario e Festività
previsioni.js         scheda Previsioni: serie storica, proiezioni, scelta del modello per le rate future
modelli.js            i modelli (media, ARIMA, VAR, GARCH, Vasicek): solo matematica, gira anche in Node
configura.js          configurazione guidata, regole nel pannello, taratura
tassi-internet.js     lettura dei valori dell'Euribor dal sito della Bundesbank
tassi-precaricati.js  (generato, non nel repository) valori dell'Euribor dentro la pagina
crea-precaricati.js   genera tassi-precaricati.js dai CSV
dati-euribor/         scarica.js e i CSV che produce (non nel repository)
```

Gli script si caricano in quest'ordine: `calcolo.js`, `tassi-precaricati.js`, `tassi-internet.js`, `archivio.js`, `modelli.js`, `app.js`, `tassi.js`, `calendario.js`, `previsioni.js`, `configura.js`.

**Dati.** Un unico oggetto JSON in `localStorage` (chiave `mutuo-variabile:dati`), lo stesso formato del salvataggio su file: `parametri` (importo, rate, date, regole), `rate` (solo i valori scritti a mano: rata vera, quota capitale, tasso applicato…), `euribor` (i valori dell'indice, `{ giorno, tasso_360 }`), `festivita`. `Archivio.richiesta(metodo, percorso, corpo)` espone le operazioni (`GET dati`, `POST configura`, `PUT rate/<n>`, `POST euribor`, …): ogni operazione è tutto-o-niente e restituisce i dati aggiornati.

**Modelli.** `Modelli.stima(modello, serieMensile, opzioni)` (in `modelli.js`) restituisce la proiezione con le fasce; `Modelli.perGiorno` la trasforma nella funzione giorno → valore che il piano riceve come `opzioni.previsione`. Il file non tocca la pagina: `node -e "const M = require('./modelli.js'); …"` per provarlo.

**Motore.** `Calcolo.calcolaPiano(dati, opzioni)` restituisce le righe del piano con, per ogni rata, periodo, data di rilevazione, indice, tasso, interessi, quota capitale, rata calcolata e confronto con la rata vera. `Calcolo.tara(dati)` prova le combinazioni di regole sulle rate vere e restituisce le migliori. Le scelte possibili, con nome e spiegazione, sono in `Calcolo.REGOLE`.

**Prove.** Non ci sono strumenti di test nel repository. Le prove sono state fatte con Edge senza finestra (`msedge --headless=new --remote-debugging-port=…`) pilotato da uno script Node tramite il protocollo DevTools, che apre `index.html` da `file://`, simula clic e digitazione e legge il risultato dalla pagina. Dopo una modifica al motore va rifatta almeno la prova del contratto noto (le rate devono tornare tutte).

**Testi.** L'interfaccia è in italiano e parla a chi non sa niente di mutui: ogni domanda dice che cosa si chiede, dove trovarlo e cosa fare se non lo si sa. Chi aggiunge una regola o un campo deve aggiungere anche questi testi.

## Licenza

Codice con licenza MIT (vedi `LICENSE`). I valori dell'Euribor non fanno parte del progetto: vedi sopra.
