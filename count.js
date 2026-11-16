/* =========================================================
   NALICZANIE — liczby wyników dobijają do wartości przy wejściu
   w ekran. Wspólne dla index.html i case-study.html.

   Bez biblioteki, bo nie ma czego dokładać: cała rzecz to parsowanie
   trzech kawałków tekstu i requestAnimationFrame. CountUp.js czy
   odometer to kilkanaście kilobajtów i zależność w projekcie, który
   dziś nie ma żadnej.

   Bez JS-a liczby po prostu stoją na swoich wartościach — animacja
   jest dekoracją, nie nośnikiem treści.
   ========================================================= */
(() => {
  const CELE = '.outcome .num, .case-results dt, .metric-num';
  const CZAS = 1100;                   // ms; dłużej zaczyna męczyć

  // data-licznik="off" zdejmuje kafelek z animacji. Potrzebne tam, gdzie
  // cyfra nie jest wynikiem — „WCAG 2.0" to nazwa wersji, a nie liczba,
  // która ma dobijać od zera.
  const liczby = [...document.querySelectorAll(CELE)]
    .filter(el => el.dataset.licznik !== 'off');
  if (!liczby.length) return;
  if (matchMedia('(prefers-reduced-motion:reduce)').matches) return;

  // „−47%" → prefiks „−", wartość 47, sufiks „%".
  // Minus jest znakiem typograficznym (U+2212) z &minus;, nie dywizem,
  // więc łapiemy wszystko, co nie jest cyfrą, zamiast wymieniać znaki.
  const rozbierz = tekst => {
    const m = tekst.match(/^(\D*?)(\d+(?:[.,]\d+)?)(.*)$/);
    if (!m) return null;                        // kafelek bez liczby („—")
    const [, prefiks, surowa, sufiks] = m;
    const przecinek = surowa.includes(',');
    const wartosc = parseFloat(surowa.replace(',', '.'));
    const miejsca = (surowa.split(/[.,]/)[1] || '').length;
    return { prefiks, sufiks, wartosc, miejsca, przecinek };
  };

  // Wyhamowanie na końcu: licznik, który zwalnia, czyta się jak
  // dobijanie do wyniku, a liniowy jak pasek postępu.
  const wyhamuj = t => 1 - Math.pow(1 - t, 3);

  const nalicz = (el, dane) => {
    const start = performance.now();

    const klatka = teraz => {
      const t = Math.min((teraz - start) / CZAS, 1);
      const v = dane.wartosc * wyhamuj(t);
      let tekst = v.toFixed(dane.miejsca);
      if (dane.przecinek) tekst = tekst.replace('.', ',');
      el.textContent = dane.prefiks + tekst + dane.sufiks;
      if (t < 1) requestAnimationFrame(klatka);
    };

    requestAnimationFrame(klatka);
  };

  const obs = new IntersectionObserver((wpisy) => {
    for (const w of wpisy) {
      if (!w.isIntersecting) continue;
      const dane = w.target.__licznik;
      obs.unobserve(w.target);          // raz i koniec
      nalicz(w.target, dane);
    }
  }, { threshold: 0.6 });

  for (const el of liczby) {
    const dane = rozbierz(el.textContent.trim());
    if (!dane) continue;
    el.__licznik = dane;
    // Od zera, a nie od wartości docelowej: inaczej pierwsza klatka
    // mignęłaby wynikiem, zanim licznik ruszy.
    el.textContent = dane.prefiks + (0).toFixed(dane.miejsca) + dane.sufiks;
    obs.observe(el);
  }
})();
