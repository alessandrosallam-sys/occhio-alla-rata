# Occhio alla Rata

Una pagina web che controlla mutui (a tasso variabile o fisso) e finanziamenti: ricostruisce il piano rata per rata e lo confronta con quello che la banca addebita, calcola costo totale e TAEG, simula l'estinzione anticipata e confronta le offerte prima di firmare. Segue più prestiti insieme. I nomi interni restano quelli di prima per non perdere i dati salvati: `mutuo-variabile` (chiave dei dati nel browser, campo `programma` dei backup) e `mutuo-generale` (nome della cartella del repository).

L'autore scrive in italiano: rispondi in italiano, e scrivi in italiano anche nomi, commenti, messaggi dei commit e testi dell'interfaccia.

Leggi [docs/progetto-generale.md](docs/progetto-generale.md) prima di toccare il codice: descrive file, dati, motore di calcolo, interfaccia e prove, sezione per sezione. Quando cambi qualcosa, aggiorna la sezione che lo descrive o aggiungine una in fondo.

## Regole fisse (chieste dall'autore)

- **Niente librerie esterne, niente CDN, niente installazioni nel progetto.** La pagina è HTML, CSS e JavaScript scritti a mano; gli script usano solo i moduli integrati di Node.
- **Internet solo per i dati**: la pagina scarica i valori dell'Euribor dal sito della Bundesbank (`tassi-internet.js`), anche da sola all'apertura. È l'unica cosa che passa dalla rete.
- **`tassi-precaricati.js` è generato** e non sta nel repository (`.gitignore`, come i CSV di `dati-euribor/`): non si modifica a mano, si rigenera con `crea-precaricati.js`. Senza, la pagina funziona lo stesso e scarica i valori da internet.
- **Niente dati personali.** Il repository diventerà pubblico. Mai cifre di un mutuo vero (importi, rate, tassi, durate, date), nomi, email, percorsi del computer, nomi di banche o riferimenti a progetti privati: né nel codice, né nei testi di esempio, nei commenti, nella documentazione o nei messaggi dei commit. Negli esempi usa cifre inventate. Se l'autore te ne dà di vere per una prova, usale solo in file fuori dal repository.
- I destinatari sono persone che non sanno niente di mutui: ogni testo deve spiegare che cosa si chiede, dove trovarlo e cosa fare se non lo si sa.

## Git e GitHub: si lavora da più computer

Il repository è https://github.com/alessandrosallam-sys/occhio-alla-rata (ramo `main`, per ora privato). Nessun altro ci lavora, ma l'autore usa più computer: GitHub è il punto d'incontro, quindi deve essere sempre aggiornato. Come si prepara un computer nuovo, cosa c'è e cosa manca, i problemi comuni: [docs/lavorare-da-un-altro-pc.md](docs/lavorare-da-un-altro-pc.md). Se l'autore ti chiede aiuto per preparare un computer, segui quella guida.

- **All'inizio di ogni sessione**: `git status` e `git pull`. Se trovi modifiche non salvate che non sono tue (un'altra sessione al lavoro), non toccarle e non metterle nei tuoi commit.
- **Dopo ogni modifica completata e provata**: commit e subito `git push`, senza chiedere. Messaggio in italiano: cosa e perché. Nel commit metti solo i file che hai cambiato tu.
- **Prima di ogni push** guarda che cosa parte (`git log -p origin/main..HEAD`): niente dati personali (vedi sopra), niente file generati.
- **Email dei commit**: l'indirizzo privato di GitHub, `342585660+alessandrosallam-sys@users.noreply.github.com`. L'account rifiuta gli invii con un'altra email. Su un computer appena clonato, prima del primo commit, controlla `git config user.email` e se serve imposta nel repository `git config user.name "Alessandro S"` e `git config user.email` con quell'indirizzo.
- **Push rifiutato** perché su GitHub ci sono commit nuovi: `git pull --rebase`, poi di nuovo `git push`. Mai `--force`.
- **Accesso a GitHub**: nel terminale di Claude Code le richieste di accesso di git sono spente, e il primo push su un computer si ferma con «terminal prompts disabled». Rilancialo permettendo la finestra di accesso (PowerShell: `$env:GIT_TERMINAL_PROMPT='1'; $env:GCM_INTERACTIVE='auto'; git push`; Bash: `GIT_TERMINAL_PROMPT=1 GCM_INTERACTIVE=auto git push`) e avvisa l'autore che deve completare l'accesso nel browser. Basta una volta per computer.

## Convenzioni dello stile

- **Grandezza dei testi**: ogni `font-size` di `stile.css` si scrive `calc(Npx * var(--testo))`. `--testo` è la grandezza scelta nelle impostazioni, da 1 a 1,4. Un `font-size` fisso non crescerebbe con la scelta. Le cifre dei riquadri hanno in più un tetto, per restare dentro il riquadro (docs/progetto-generale.md, sezione 29).
- **Colori**: solo variabili del tema (`var(--accento)`, `var(--inchiostro)`…), mai colori scritti a mano fuori dai blocchi dei temi, così valgono anche per i temi calcolati e per «Il tuo tema» (sezione 28).

## Node

Serve solo agli script (`crea-precaricati.js`, `dati-euribor/scarica.js`) e alle prove, non alla pagina. Ci vuole la versione 22 o successiva (WebSocket integrato). Cercalo in quest'ordine: `node` nel PATH; `..\runtime\node.exe`, una copia portatile nella cartella che contiene il repository. Se non c'è, dillo all'autore: non installarlo di tua iniziativa.

## Comandi utili

Dalla cartella del repository:

```
node dati-euribor/scarica.js   # riscarica dalla Bundesbank gli Euribor dal 1999 (serve internet)
node crea-precaricati.js       # rigenera tassi-precaricati.js dai CSV
```

La pagina si apre con un doppio clic su `index.html`: non serve nessun server. Dopo una modifica basta ricaricarla (F5).

## Come si prova l'interfaccia

Non ci sono strumenti di test installati. Il metodo usato finora: Edge senza finestra (`msedge.exe --headless=new --remote-debugging-port=<porta> --user-data-dir=<cartella temporanea>`) pilotato da uno script Node tramite il protocollo DevTools (WebSocket integrato in Node 22), che apre `index.html` da `file://`, simula clic e digitazione e legge il risultato dalla pagina. Su un sistema senza Edge va bene Chrome o Chromium con le stesse opzioni. Gli script di prova sono temporanei: stanno nella cartella temporanea della sessione, non nel repository, e vanno riscritti quando servono. Dettagli ed elenco delle prove fatte: docs/progetto-generale.md, sezione 9 e i paragrafi «Prove» delle altre sezioni.

Prima di lanciare una prova chiudi gli `msedge.exe` rimasti aperti dalle prove precedenti (quelli il cui comando contiene la cartella del profilo di prova): altrimenti il nuovo Edge si aggancia al vecchio e la porta di debug non risponde.

## Avvertenze pratiche (Windows, PowerShell)

- Per script lunghi scrivi un file `.js` nella cartella temporanea e lancialo, invece di passare il codice sulla riga di comando: in PowerShell virgolette e backtick vengono interpretati. Nel tool Bash gli heredoc perdono una barra rovesciata: gli script che contengono `\` vanno scritti con il tool Write.
- Messaggi di commit su più righe: scrivili in un file e usa `git commit -F <file>` (in PowerShell 5.1 un here-string passato a git diventa un argomento, non il messaggio).
- Se il percorso contiene uno spazio, `Remove-Item` può essere bloccato: per cancellare o spostare file usa uno script Node (`fs.rmSync`, `fs.renameSync`).
- In modalità automatica Edit e Write sui file del progetto a volte vengono rifiutati: in quel caso fai le sostituzioni con uno script Node.
- Se git si rifiuta di lavorare perché la cartella ha un altro proprietario (dischi che non lo registrano), aggiungila a `safe.directory`.
