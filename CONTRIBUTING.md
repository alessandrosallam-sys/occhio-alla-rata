# Contribuire a Occhio alla Rata

Grazie per l'interesse! Il contributo più utile non è il codice: è **il tuo contratto**. Il programma riproduce al centesimo un solo contratto vero, e ogni mutuo o finanziamento diverso che torna, o che non torna, lo rende più affidabile. Per raccontarlo apri una [segnalazione «Il mio contratto»](../../issues/new/choose).

## Prima di tutto: niente dati personali

Le segnalazioni e il codice sono pubblici. Non scrivere mai nomi, banca, indirizzi, numeri di conto o di contratto, e non allegare il file di backup: contiene tutti i tuoi prestiti. Negli esempi, nel codice e nei commenti usa cifre inventate.

## Le regole del progetto

- **Tutto in italiano**: testi della pagina, nomi nel codice, commenti, messaggi dei commit.
- **Niente librerie e niente installazioni.** La pagina è HTML, CSS e JavaScript scritti a mano, senza passaggi di compilazione: si modifica un file e si ricarica la pagina. Gli script usano solo i moduli integrati di Node.
- **Internet solo per l'Euribor**, dal sito della Bundesbank. I valori dell'Euribor non vanno nel repository (licenza EMMI): ogni dispositivo li scarica da sé.
- **Per chi non sa niente di mutui.** Ogni testo dice che cosa si chiede, dove trovarlo e che cosa fare se non lo si sa. Chi aggiunge una regola o un campo aggiunge anche questi testi.
- **Grandezza dei testi**: nel foglio di stile ogni `font-size` si scrive `calc(Npx * var(--testo))`, così segue la grandezza scelta nelle impostazioni.

## Come è fatto

Il [README](README.md) elenca i file. La documentazione di sviluppo, [docs/progetto-generale.md](docs/progetto-generale.md), spiega ogni parte, perché è fatta così e come è stata provata: leggila prima di toccare il motore di calcolo, e quando cambi qualcosa aggiorna la sezione che lo descrive.

Per provare: apri `index.html` con un doppio clic, oppure servi la cartella da un piccolo server locale se vuoi provare l'app installabile (il service worker funziona solo da `localhost` o https). Le prove automatiche del progetto pilotano Edge senza finestra con il protocollo DevTools: come si fanno è scritto nella sezione 9 della documentazione. Dopo una modifica al motore di calcolo il piano deve restare identico, riga per riga, a quello della versione precedente.

Se usi Claude Code, le stesse regole sono in [CLAUDE.md](CLAUDE.md).

## Proposte di modifica

Il progetto ha la licenza [PolyForm Noncommercial 1.0.0](LICENSE): si usa liberamente, ma non a scopo di lucro. Proponendo una modifica accetti che sia distribuita con la stessa licenza, e che l'autore possa concederla anche con altri termini, per esempio un permesso per un uso commerciale.


1. Fai un fork e un ramo con un nome che dica che cosa cambia.
2. Un commit per ogni cambiamento, con un messaggio in italiano: che cosa e perché.
3. Apri una pull request spiegando che cosa hai provato, e su quali browser.

Per le modifiche grandi apri prima una segnalazione «Un'idea»: così se ne parla prima di scrivere il codice.
