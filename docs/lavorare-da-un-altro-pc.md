# Lavorare al progetto da un altro computer, con Claude

Il progetto sta su GitHub (https://github.com/alessandrosallam-sys/occhio-alla-rata, per ora privato) e ogni computer ne ha una copia. Claude trova nella copia tutto quello che gli serve: le regole in [CLAUDE.md](../CLAUDE.md) e la documentazione in [progetto-generale.md](progetto-generale.md). Su un computer nuovo non si copia niente a mano, salvo Node se vuoi che Claude faccia le prove nel browser.

Questa pagina si legge anche su GitHub, dal browser del computer nuovo, prima di aver installato qualsiasi cosa.

## Cosa serve

- L'account GitHub che ha accesso al repository (è privato: senza accesso non si scarica).
- L'account Claude di sempre.
- Windows con Microsoft Edge, che c'è già: Claude lo usa per provare la pagina.

## Preparare il computer (una volta sola)

1. **Git per Windows**: scaricalo da https://git-scm.com/download/win e installalo con le opzioni proposte. Contiene anche la finestra di accesso a GitHub, così non serve nessuna password nel terminale.
2. **VS Code e Claude Code**: installa VS Code da https://code.visualstudio.com, poi nelle estensioni (icona dei quadratini a sinistra) cerca **Claude Code**, editore Anthropic, e installala. Accedi con il tuo account Claude. Va bene anche l'app desktop di Claude, con Claude Code dentro.
3. **La copia del progetto**: crea una cartella, per esempio `C:\MUTUO`, aprici un terminale (in Esplora file: tasto destro → «Apri nel terminale») e scrivi:
   ```
   git clone https://github.com/alessandrosallam-sys/occhio-alla-rata.git mutuo-generale
   ```
   La prima volta si apre il browser per l'accesso a GitHub: scegli **Sign in with your browser** e autorizza. Il nome `mutuo-generale` tiene la stessa struttura del computer principale, così i comandi scritti nella documentazione valgono uguali.
4. **Node** (consigliato): serve a Claude per le prove nel browser e per riscaricare gli Euribor, non alla pagina. Due modi, senza installare niente:
   - copia la cartella `runtime` dal computer principale (chiavetta, OneDrive…) in `C:\MUTUO\runtime`, accanto a `mutuo-generale`;
   - oppure scarica da https://nodejs.org la versione 22 «Windows Binary (.zip)», aprila e copia `node.exe` in `C:\MUTUO\runtime\`.

   Claude cerca Node proprio lì (`..\runtime\node.exe` rispetto al repository). Se manca, lo dice e lavora senza prove.
5. **Il primo avvio**: in VS Code apri la cartella `C:\MUTUO\mutuo-generale` (File → Apri cartella; alla domanda se ti fidi degli autori rispondi di sì) e apri Claude Code. Come prima richiesta va bene: «controlla che il progetto sia aggiornato e pronto». Claude legge il CLAUDE.md, scarica le ultime modifiche e imposta l'email privata per i commit. Al primo invio su GitHub potrebbe aprirsi di nuovo la finestra di accesso: completala nel browser.

Apri proprio la cartella `mutuo-generale`, non quella sopra: è lì che Claude trova il suo CLAUDE.md.

## Ogni volta che lavori

- **Non devi fare niente a mano**: Claude scarica da GitHub all'inizio della sessione e invia dopo ogni commit.
- **Prima di passare all'altro computer** assicurati che l'ultima sessione abbia finito e inviato. Chiedi a Claude «è tutto su GitHub?», oppure scrivi `git status` in un terminale nella cartella del progetto: deve dire `up to date` e `nothing to commit`.
- **Evita di lavorare sui due computer insieme.** Se capita, Claude unisce le modifiche (`git pull --rebase`). Se le due versioni hanno cambiato le stesse righe, si ferma e te lo dice.
- **Le regole nuove vanno nel CLAUDE.md.** La memoria di Claude resta sul computer dove l'hai detto. Se dai a Claude una regola che deve valere sempre, chiedigli di scriverla nel CLAUDE.md del repository (senza dati personali): così la troverà su tutti i computer.

## Cosa non c'è sul computer nuovo

- **I tuoi prestiti** inseriti nella pagina: stanno nel browser del computer dove li hai scritti. Sul computer principale usa «Salva un backup» (Pannello di controllo), poi sul nuovo «Carica un backup».
- **I valori dell'Euribor già dentro la pagina** (`tassi-precaricati.js`): è un file generato, che non sta su GitHub. La pagina funziona lo stesso e scarica i valori dalla Bundesbank all'apertura. Per rigenerarlo, con Node: `node dati-euribor/scarica.js` e poi `node crea-precaricati.js`, oppure chiedilo a Claude.
- **Il materiale privato del computer principale**: è fuori dal repository e non deve finirci. Resta solo lì.

## Senza installare niente: Claude Code nel browser

Da qualunque browser puoi usare Claude Code su https://claude.ai/code, collegando il tuo account GitHub e scegliendo il repository. Va bene per lavori piccoli o quando sei su un computer non tuo. Ci sono però dei limiti. Claude lavora su un computer nel cloud, non sul tuo: non ha Edge per provare la pagina come qui, e potrebbe non raggiungere il sito della Bundesbank. Inoltre di solito le modifiche arrivano su un ramo a parte, da unire a `main` su GitHub (una «pull request»). Per il lavoro vero conviene un computer preparato come sopra.

## Problemi comuni

- **«terminal prompts disabled» al primo invio**: il terminale di Claude non può chiedere l'accesso. Claude rilancia l'invio permettendo la finestra di accesso (è scritto nel CLAUDE.md): completala nel browser.
- **«push declined due to email privacy restrictions»**: un commit ha un'email diversa da quella privata di GitHub. Chiedi a Claude di impostare l'email del CLAUDE.md e di correggere i commit non ancora inviati.
- **«detected dubious ownership»**: succede su dischi esterni o chiavette. Chiedi a Claude di aggiungere la cartella a `safe.directory`, oppure scrivi `git config --global --add safe.directory <percorso della cartella>`.
- **Git chiede nome utente e password nel terminale**: GitHub non accetta più la password da lì. Chiudi e rilancia il comando: deve aprirsi la finestra di accesso nel browser. Se non si apre, reinstalla Git per Windows con le opzioni proposte.
- **«Repository not found» al clone**: l'account con cui hai fatto l'accesso non vede il repository privato. Controlla di essere entrato con l'account giusto.
