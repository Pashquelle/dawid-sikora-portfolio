/* =========================================================
   ODSŁONA — maska zjeżdża z nagłówków przy wejściu w ekran
   Wspólna dla index.html i case-study.html. Raz na element.
   Bez JS-a nagłówki są normalnie widoczne.
   ========================================================= */
(() => {
  if (matchMedia('(prefers-reduced-motion:reduce)').matches) return;

  // H3 tylko w sekcji PRACE — tytuły case studies dostają tę samą maskę
  const cele = [...document.querySelectorAll('h1, h2, #work .story h3, .hero .meta')];
  cele.forEach(el => el.classList.add('wipe'));

  const obs = new IntersectionObserver((wpisy) => {
    for (const w of wpisy) {
      if (!w.isIntersecting) continue;
      w.target.classList.add('is-open');
      obs.unobserve(w.target);        // raz i koniec
    }
    // Próg musi być 0: clip-path przycina element do zerowej
    // powierzchni, więc intersectionRatio zawsze wynosi 0 i każdy
    // wyższy próg blokuje odsłonę na zawsze.
  }, { threshold: 0, rootMargin: '0px 0px -8% 0px' });

  cele.forEach(el => obs.observe(el));
})();
