// La prima apertura: la scritta «OCCHIO ALLA RATA» in cima alla prima pagina della guida, quando si parte da zero
// (configura.js). Le lettere sorgono una dopo l'altra, poi il motto; l'animazione sta sotto
// la classe «in-volo», che c'è solo la prima volta che la scritta si disegna in questa apertura della pagina, e un clic
// la rifà. Stile e animazioni in stile.css («La prima apertura»): senza animazioni si vede tutto fermo, al suo posto.
(() => {
  const DURATA = 1.6;   // secondi: dopo, il motto e i riquadri della presentazione (--durata, anche sull'elenco)
  let vista = false;
  const lettere = (parola, da) => [...parola].map((l, k) => `<span class="scritta-lettera" style="--i:${da + k}">${l}</span>`).join('');
  const parola = (testo, da, classe = '') => `<span class="scritta-parola ${classe}" aria-hidden="true">${lettere(testo, da)}</span>`;
  function crea() {
    const scena = document.createElement('div');
    scena.className = 'intro-scritta' + (vista ? '' : ' in-volo');
    scena.style.setProperty('--durata', DURATA + 's');
    scena.title = 'Clic per rivedere l\'animazione';
    scena.innerHTML = `<div class="scritta-testo">
        <p class="scritta-titolo" aria-label="Occhio alla Rata">${parola('OCCHIO', 0)} ${parola('ALLA', 6)}<br>${parola('RATA', 10, 'scritta-rata')}</p>
        <p class="scritta-motto">Tiene d'occhio le rate del tuo mutuo o finanziamento, al centesimo.</p>
      </div>`;
    scena.addEventListener('click', () => { scena.classList.remove('in-volo'); void scena.offsetWidth; scena.classList.add('in-volo'); });
    vista = true;
    return scena;
  }
  window.Intro = { crea, durata: () => DURATA };
})();
