// L'app da installare sul telefono (PWA, 24 ottobre 2026). Registra il service worker (sw.js) quando la pagina è aperta
// da un sito https o da localhost (con il doppio clic su index.html i browser non lo permettono, e non serve), e riempie
// la carta «L'app sul telefono» del pannello: dice come installarla e, dove il browser lo consente (Chrome, Edge su
// Android e sul computer), mostra il pulsante «Installa l'app», che apre la finestra di installazione del browser.
(function () {
  'use strict';
  const daSito = location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  if (daSito && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => { /* senza copia offline: la pagina funziona lo stesso */ }); });
  }
  let richiesta = null;   // l'evento «beforeinstallprompt»: tenuto da parte, apre la finestra di installazione dal pulsante
  const installata = () => (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  const iPhone = /iPhone|iPad|iPod/.test(navigator.userAgent);
  function disegna() {
    const testo = document.getElementById('testo-app'), pulsante = document.getElementById('installa-app');
    if (!testo || !pulsante) return;
    pulsante.hidden = !richiesta || installata();
    testo.textContent = installata()
      ? 'Stai usando l\'app installata: si apre dall\'icona, a schermo intero, e funziona anche senza connessione. Gli aggiornamenti arrivano da soli quando sei connesso.'
      : !daSito
        ? 'Questa pagina è aperta dal computer (doppio clic su index.html). Per averla come app sul telefono, aprila dal sito del progetto con il browser del telefono e installala da lì: compare un\'icona come per le altre app, e funziona anche senza connessione.'
        : richiesta
          ? 'Puoi installarla come un\'app: compare un\'icona sullo schermo, si apre a schermo intero e funziona anche senza connessione.'
          : iPhone
            ? 'Su iPhone e iPad: in Safari tocca il pulsante Condividi (il quadrato con la freccia) e poi «Aggiungi alla schermata Home».'
            : 'Per installarla: nel menù del browser (i tre puntini) scegli «Installa app» o «Aggiungi a schermata Home». Compare un\'icona come per le altre app, e funziona anche senza connessione.';
  }
  window.addEventListener('beforeinstallprompt', evento => { evento.preventDefault(); richiesta = evento; disegna(); });
  window.addEventListener('appinstalled', () => { richiesta = null; disegna(); });
  document.addEventListener('click', async evento => {
    if (!evento.target.closest('#installa-app') || !richiesta) return;
    const r = richiesta;
    richiesta = null;
    await r.prompt();
    try { await r.userChoice; } catch { /* finestra chiusa */ }
    disegna();
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', disegna); else disegna();
  window.Pwa = { daSito: () => daSito, installata, puoInstallare: () => !!richiesta };
})();
