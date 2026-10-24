// Service worker dell'app installabile (PWA, 24 ottobre 2026): tiene una copia della pagina per usarla senza connessione.
// Funziona solo quando la pagina è aperta da un sito https (per esempio GitHub Pages) o da localhost, non con il doppio
// clic su index.html. Le regole:
//  - all'installazione salva index.html e tutto quello che index.html carica (script, stile, icone: l'elenco si ricava
//    dalla pagina stessa, così aggiungendo un file non c'è un secondo elenco da aggiornare), più il manifest e le icone;
//  - per i file del sito prova prima la rete (così, con la connessione, si vede sempre l'ultima versione) e aggiorna la
//    copia; se la rete non risponde entro pochi secondi usa la copia;
//  - non tocca le richieste ad altri siti: i valori dell'Euribor arrivano dalla Bundesbank e li conserva storico.js.
'use strict';
const COPIA = 'occhio-alla-rata';
const ATTESA_RETE = 4000;   // millisecondi: oltre, con una connessione che non risponde, si usa la copia
const SEMPRE = ['./', './index.html', './manifest.webmanifest', './icone-app/icona-192.png', './icone-app/icona-512.png',
  './icone-app/icona-mascherabile-192.png', './icone-app/icona-mascherabile-512.png', './icone-app/icona-180.png'];

self.addEventListener('install', evento => {
  evento.waitUntil((async () => {
    const cache = await caches.open(COPIA);
    const file = new Set(SEMPRE);
    try {
      const pagina = await (await fetch('./index.html', { cache: 'no-cache' })).text();
      for (const [, percorso] of pagina.matchAll(/\b(?:src|href)="([^"#?:]+)"/g)) file.add('./' + percorso.replace(/^\.\//, ''));
    } catch { /* senza rete all'installazione: si salvano solo i file fissi */ }
    // Uno per uno: un file che manca (tassi-precaricati.js è generato e sul sito non c'è) non blocca gli altri.
    await Promise.all([...file].map(f => cache.add(new Request(f, { cache: 'no-cache' })).catch(() => null)));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', evento => {
  evento.waitUntil((async () => {
    for (const nome of await caches.keys()) if (nome !== COPIA) await caches.delete(nome);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', evento => {
  const richiesta = evento.request;
  if (richiesta.method !== 'GET' || new URL(richiesta.url).origin !== self.location.origin) return;
  evento.respondWith((async () => {
    const cache = await caches.open(COPIA);
    const dallaRete = fetch(richiesta).then(risposta => {
      if (risposta.ok) cache.put(richiesta, risposta.clone()).catch(() => null);
      return risposta;
    });
    dallaRete.catch(() => null);   // se vince la copia, un errore della rete arrivato dopo non va segnalato
    const tempo = new Promise(fatto => setTimeout(() => fatto(null), ATTESA_RETE));
    try {
      const risposta = await Promise.race([dallaRete, tempo]);
      if (risposta) return risposta;
    } catch { /* senza rete: la copia */ }
    const copia = await cache.match(richiesta, { ignoreSearch: true })
      || (richiesta.mode === 'navigate' ? await cache.match('./index.html') : null);
    if (copia) return copia;
    return dallaRete.catch(() => new Response('Senza connessione, e questo file non è stato salvato.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }));
  })());
});
