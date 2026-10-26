// Far conoscere il programma (26 ottobre 2026): la carta «Fallo conoscere» del pannello di controllo.
//  - «Condividi» apre la condivisione del telefono o del computer (navigator.share: WhatsApp, Telegram, email…) con un
//    messaggio già scritto e l'indirizzo del sito. Dove il browser non la offre (Firefox sul computer, per esempio)
//    il pulsante non c'è.
//  - «Manda con WhatsApp» apre wa.me con lo stesso messaggio: WhatsApp sul telefono, WhatsApp Web sul computer.
//  - «Copia il link» mette l'indirizzo negli appunti.
// Si condivide sempre l'indirizzo del sito, anche dalla pagina aperta dal disco; i prestiti non partono. È un
// collegamento da aprire, non una richiesta della pagina: la regola sulle connessioni (index.html) non c'entra.
(function () {
  'use strict';
  const { $, avvisa } = window.Mutuo;
  const SITO = 'https://alessandrosallam-sys.github.io/occhio-alla-rata/';
  const MESSAGGIO = 'Ti segnalo Occhio alla Rata: controlla se la banca ti addebita la rata giusta del mutuo o del finanziamento, al centesimo. '
    + 'Ti dice anche quanto costa davvero il prestito e quanto risparmieresti rimborsandolo prima. '
    + 'È gratis, non serve registrarsi e i dati restano sul tuo telefono. Per vedere come funziona c\'è «Prova con degli esempi».';

  $('#condividi').hidden = !navigator.share;
  $('#condividi').addEventListener('click', async () => {
    try {
      await navigator.share({ title: 'Occhio alla Rata', text: MESSAGGIO, url: SITO });
    } catch (errore) {
      // Chiusa la finestra senza scegliere: niente da dire. Altrimenti restano gli altri due pulsanti.
      if (errore.name !== 'AbortError') avvisa('La condivisione non è riuscita: usa «Manda con WhatsApp» o «Copia il link».', true);
    }
  });
  $('#manda-whatsapp').addEventListener('click', () => {
    window.open('https://wa.me/?text=' + encodeURIComponent(MESSAGGIO + '\n' + SITO), '_blank', 'noopener');
  });
  // Gli appunti del browser; dove non ci sono (pagina aperta dal disco in alcuni browser) il vecchio «copia».
  $('#copia-link').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(SITO);
    } catch {
      const campo = Object.assign(document.createElement('textarea'), { value: SITO });
      campo.style.cssText = 'position:fixed;opacity:0';
      document.body.append(campo);
      campo.select();
      const copiato = document.execCommand('copy');
      campo.remove();
      if (!copiato) return avvisa(`Non riesco a copiarlo: l'indirizzo è ${SITO}`, true);
    }
    avvisa('Link copiato: incollalo dove vuoi.');
  });
})();
