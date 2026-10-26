// Far conoscere il programma (26 ottobre 2026). Il pulsante «Condividi» sta sempre in vista, accanto a «Impostazioni»:
// sul telefono un'icona nella testata, sul computer una riga sotto «Impostazioni» in fondo alla barra laterale.
//  - Sul telefono (niente mouse, e il browser sa condividere) apre subito la condivisione del sistema (navigator.share:
//    WhatsApp, Telegram, email…) con un messaggio già scritto e l'indirizzo del sito.
//  - Altrimenti apre il riquadro «Fallo conoscere» (#menu-condividi, con l'aspetto di quello delle impostazioni):
//    «Manda con WhatsApp» (wa.me: WhatsApp sul telefono, WhatsApp Web sul computer), «Copia il link» e, dove il
//    browser la offre, «Altre app» (la condivisione del sistema).
// Si condivide sempre l'indirizzo del sito, anche dalla pagina aperta dal disco; i prestiti non partono. Sono
// collegamenti da aprire, non richieste della pagina: la regola sulle connessioni (index.html) non c'entra.
(function () {
  'use strict';
  const { $, avvisa } = window.Mutuo;
  const SITO = 'https://alessandrosallam-sys.github.io/occhio-alla-rata/';
  const MESSAGGIO = 'Ti segnalo Occhio alla Rata: controlla se la banca ti addebita la rata giusta del mutuo o del finanziamento, al centesimo. '
    + 'Ti dice anche quanto costa davvero il prestito e quanto risparmieresti rimborsandolo prima. '
    + 'È gratis, non serve registrarsi e i dati restano sul tuo telefono. Per vedere come funziona c\'è «Prova con degli esempi».';
  const pulsante = $('#condividi-testata'), menu = $('#menu-condividi');

  async function conIlSistema() {
    try {
      await navigator.share({ title: 'Occhio alla Rata', text: MESSAGGIO, url: SITO });
      return true;
    } catch (errore) {
      // Chiusa la finestra senza scegliere: niente da dire. Altrimenti restano WhatsApp e la copia del link.
      if (errore.name !== 'AbortError') avvisa('La condivisione non è riuscita: usa «Manda con WhatsApp» o «Copia il link».', true);
      return false;
    }
  }
  function conWhatsApp() {
    window.open('https://wa.me/?text=' + encodeURIComponent(MESSAGGIO + '\n' + SITO), '_blank', 'noopener');
  }
  // Gli appunti del browser; dove non ci sono (pagina aperta dal disco in alcuni browser) il vecchio «copia».
  async function copiaLink() {
    try {
      await navigator.clipboard.writeText(SITO);
    } catch {
      const campo = Object.assign(document.createElement('textarea'), { value: SITO });
      campo.style.cssText = 'position:fixed;opacity:0';
      document.body.append(campo);
      campo.select();
      const copiato = document.execCommand('copy');
      campo.remove();
      if (!copiato) { avvisa(`Non riesco a copiarlo: l'indirizzo è ${SITO}`, true); return false; }
    }
    avvisa('Link copiato: incollalo dove vuoi.');
    return true;
  }

  // ---------- Il riquadro ----------
  // Vicino al pulsante: a destra se il pulsante è in fondo alla barra laterale, sotto se è nella testata in alto. Sui
  // telefoni sale dal basso (stile.css, come quello delle impostazioni).
  function posiziona() {
    menu.style.left = menu.style.top = '';
    if (matchMedia('(max-width: 760px)').matches) return;
    const r = pulsante.getBoundingClientRect(), largo = menu.offsetWidth, alto = menu.offsetHeight, margine = 12;
    const inBarraLaterale = r.left < 320 && r.top > innerHeight / 2;
    let left = inBarraLaterale ? r.right + margine : r.right - largo, top = inBarraLaterale ? r.bottom - alto : r.bottom + 8;
    menu.style.left = Math.max(margine, Math.min(left, innerWidth - largo - margine)) + 'px';
    menu.style.top = Math.max(margine, Math.min(top, innerHeight - alto - margine)) + 'px';
  }
  function apri() {
    menu.hidden = false;
    pulsante.setAttribute('aria-expanded', 'true');
    posiziona();
    $('#manda-whatsapp').focus();
  }
  function chiudi(rimettiFuoco = false) {
    if (menu.hidden) return;
    menu.hidden = true;
    pulsante.setAttribute('aria-expanded', 'false');
    if (rimettiFuoco) pulsante.focus();
  }
  pulsante.addEventListener('click', () => {
    if (!menu.hidden) return chiudi();
    if (window.Mutuo.senzaMouse() && navigator.share) conIlSistema();
    else apri();
  });
  $('#chiudi-condividi').addEventListener('click', () => chiudi(true));
  document.addEventListener('keydown', evento => { if (evento.key === 'Escape') chiudi(true); });
  document.addEventListener('pointerdown', evento => { if (!menu.hidden && !menu.contains(evento.target) && !pulsante.contains(evento.target)) chiudi(); });
  window.addEventListener('resize', () => { if (!menu.hidden) posiziona(); });

  $('#condividi').hidden = !navigator.share;
  $('#condividi').addEventListener('click', async () => { if (await conIlSistema()) chiudi(); });
  $('#manda-whatsapp').addEventListener('click', () => { conWhatsApp(); chiudi(); });
  $('#copia-link').addEventListener('click', async () => { if (await copiaLink()) chiudi(); });

  window.Condividi = { apri, chiudi, SITO };
})();
