// Jednorazowy sprawdzian zagnieżdżenia znaczników w podstronach case study.
// Nie jest częścią strony — leży w .podglad/, które nie trafia do repo.
const fs = require('fs');

const VOID = new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr','path','use']);

for (const plik of process.argv.slice(2)) {
  let s = fs.readFileSync(plik, 'utf8');
  s = s.replace(/<!--[\s\S]*?-->/g, '');          // komentarze
  s = s.replace(/<script[\s\S]*?<\/script>/g, ''); // skrypty
  s = s.replace(/<style[\s\S]*?<\/style>/g, '');   // arkusz

  const stos = [];
  const bledy = [];
  const re = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b[^>]*?(\/?)>/g;
  let m;
  while ((m = re.exec(s))) {
    const [, zamyk, nazwa, self] = m;
    const t = nazwa.toLowerCase();
    if (VOID.has(t) || self === '/') continue;
    if (!zamyk) { stos.push(t); continue; }
    const oczekiwane = stos.pop();
    if (oczekiwane !== t) bledy.push(`</${t}> zamyka <${oczekiwane}>`);
  }
  console.log(plik, bledy.length === 0 && stos.length === 0 ? 'OK' : `BŁĄD: ${bledy.slice(0,5).join(' | ')} | niedomknięte: ${stos.join(',')}`);
}
