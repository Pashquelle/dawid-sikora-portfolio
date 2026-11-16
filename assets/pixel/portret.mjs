/* =========================================================
   halftone.mjs — portret na raster półtonowy w dwóch farbach
   ---------------------------------------------------------
   Klasyczny raster drukarski, nie filtr: siatka punktów o stałym
   rozstawie, w której nośnikiem tonu jest średnica kropki, nie jej
   kolor. Stąd „half tone" — pół tonu robi papier między kropkami.

   Dwie farby, dwa kąty rastra, jak w duotonie:
   • limonka (--accent) pod światła, raster obrócony o 15°
   • czerń (--line-strong) pod cienie, raster obrócony o 75°
   Różnica kątów to warunek, żeby oba rastry się przeplatały,
   a nie nakładały w mórz (typografowie nazywają to mora).

   Sekcja „About" ma ciemne tło (shader-bg), więc czarna farba
   w nią wsiąka i portret czyta się jako limonkowy. Gdyby kiedyś
   wróciła na jasne .bg-soft, czerń przejmuje rysunek i obraz dalej
   trzyma formę. Jedno wyjście działa w obu wariantach.

   Tło zostaje przezroczyste — kropki kładą się wprost na sekcji.

   Użycie:
     node assets/pixel/halftone.mjs <src.png> <out.png> [rozstaw] [skala]
       rozstaw — ile kropek w poziomie (domyślnie 56)
       skala   — ile pikseli wyjścia na jedną komórkę (domyślnie 14)
   ========================================================= */
import fs from 'fs';
import zlib from 'zlib';

const SRC     = process.argv[2];
const OUT     = process.argv[3];
const KROPKI  = Number(process.argv[4] || 56);
const KOMORKA = Number(process.argv[5] || 14);
// Kadr w pikselach źródła: x y szerokość wysokość. Bez niego skrypt
// kadruje do obwiedni sylwetki, co przy portrecie en pied zostawia
// twarzy za mało kropek, żeby cokolwiek było z niej widać.
const KADR    = process.argv.slice(6, 10).map(Number);
const STOPNIE = Number(process.env.STOPNIE || 4);   // ile stopni rampy

const LIME  = [0xD8, 0xF2, 0x3A];
const BLACK = [0x17, 0x17, 0x13];

const KAT_LIME  = 15 * Math.PI / 180;
const KAT_BLACK = 75 * Math.PI / 180;

/* --- dekoder PNG (8-bit RGBA, bez przeplotu) --- */
function decode(buf){
  const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
  if (buf[24] !== 8 || buf[25] !== 6 || buf[28] !== 0) throw new Error('nieobsługiwany format PNG');
  let p = 8, idat = [];
  while (p < buf.length){
    const len = buf.readUInt32BE(p), type = buf.toString('ascii', p+4, p+8);
    if (type === 'IDAT') idat.push(buf.slice(p+8, p+8+len));
    if (type === 'IEND') break;
    p += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const bpp = 4, stride = w*bpp, out = Buffer.alloc(h*stride);
  let q = 0;
  for (let y = 0; y < h; y++){
    const f = raw[q++];
    const line = raw.slice(q, q+stride); q += stride;
    const cur = out.slice(y*stride, (y+1)*stride);
    const prev = y ? out.slice((y-1)*stride, y*stride) : null;
    for (let x = 0; x < stride; x++){
      const a = x >= bpp ? cur[x-bpp] : 0;
      const b = prev ? prev[x] : 0;
      const c = (prev && x >= bpp) ? prev[x-bpp] : 0;
      let v = line[x];
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += (a+b) >> 1;
      else if (f === 4){
        const pp = a+b-c, pa = Math.abs(pp-a), pb = Math.abs(pp-b), pc = Math.abs(pp-c);
        v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
      }
      cur[x] = v & 0xff;
    }
  }
  return { w, h, data: out };
}

/* --- koder PNG --- */
function crc32(b){
  let c, t = crc32.t;
  if (!t){ t = crc32.t = []; for (let n=0;n<256;n++){ c=n; for(let k=0;k<8;k++) c = c&1 ? 0xEDB88320 ^ (c>>>1) : c>>>1; t[n]=c>>>0; } }
  let r = 0xFFFFFFFF;
  for (const x of b) r = t[(r ^ x) & 0xff] ^ (r >>> 8);
  return (r ^ 0xFFFFFFFF) >>> 0;
}
function chunk(type, data){
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function encode(w, h, rgba){
  const stride = w*4, raw = Buffer.alloc(h*(stride+1));
  for (let y=0;y<h;y++){ raw[y*(stride+1)] = 0; rgba.copy(raw, y*(stride+1)+1, y*stride, (y+1)*stride); }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w,0); ihdr.writeUInt32BE(h,4);
  ihdr[8]=8; ihdr[9]=6; ihdr[10]=0; ihdr[11]=0; ihdr[12]=0;
  return Buffer.concat([
    Buffer.from([0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const img = decode(fs.readFileSync(SRC));

/* --- 1. jasność i krycie w rozdzielczości źródła ---------------
   Kolor liczymy po odseparowaniu alfy, inaczej półprzezroczysty
   brzeg włosów wychodzi ciemniejszy, niż jest naprawdę. */
const lum = new Float64Array(img.w*img.h);
const alf = new Float64Array(img.w*img.h);
for (let i = 0, p = 0; i < lum.length; i++, p += 4){
  const a = img.data[p+3] / 255;
  const k = a > 0 ? a : 1;
  lum[i] = (0.2126*img.data[p] + 0.7152*img.data[p+1] + 0.0722*img.data[p+2]) / (255*k);
  alf[i] = a;
}

/* --- 2. odrzucenie zabłąkanych okruchów ------------------------
   W źródle została drobina po wycinaniu tła, oderwana od sylwetki.
   Szukamy największej spójnej wyspy krycia i tylko ją zostawiamy. */
const widoczny = new Uint8Array(img.w*img.h);
for (let i = 0; i < alf.length; i++) widoczny[i] = alf[i] >= 0.5 ? 1 : 0;

const wyspa = new Int32Array(img.w*img.h).fill(-1);
let najwieksza = -1, najwiecej = 0;
const kolejka = new Int32Array(img.w*img.h);
let nr = 0;
for (let start = 0; start < widoczny.length; start++){
  if (!widoczny[start] || wyspa[start] !== -1) continue;
  let czolo = 0, koniec = 0, ile = 0;
  kolejka[koniec++] = start; wyspa[start] = nr;
  while (czolo < koniec){
    const i = kolejka[czolo++]; ile++;
    const x = i % img.w, y = (i - x) / img.w;
    if (x > 0)          { const j = i-1;      if (widoczny[j] && wyspa[j] === -1){ wyspa[j] = nr; kolejka[koniec++] = j; } }
    if (x < img.w-1)    { const j = i+1;      if (widoczny[j] && wyspa[j] === -1){ wyspa[j] = nr; kolejka[koniec++] = j; } }
    if (y > 0)          { const j = i-img.w;  if (widoczny[j] && wyspa[j] === -1){ wyspa[j] = nr; kolejka[koniec++] = j; } }
    if (y < img.h-1)    { const j = i+img.w;  if (widoczny[j] && wyspa[j] === -1){ wyspa[j] = nr; kolejka[koniec++] = j; } }
  }
  if (ile > najwiecej){ najwiecej = ile; najwieksza = nr; }
  nr++;
}
for (let i = 0; i < alf.length; i++) if (wyspa[i] !== najwieksza) alf[i] = 0;

/* --- 3. kadr do sylwetki ---------------------------------------
   Źródło ma sporo pustego tła nad głową i po lewej. Kadrujemy do
   obwiedni sylwetki z niewielkim luzem, żeby raster nie marnował
   rozdzielczości na przezroczystość. */
let x0 = img.w, y0 = img.h, x1 = -1, y1 = -1;
for (let i = 0; i < alf.length; i++){
  if (alf[i] < 0.5) continue;
  const x = i % img.w, y = (i - x) / img.w;
  if (x < x0) x0 = x; if (x > x1) x1 = x;
  if (y < y0) y0 = y; if (y > y1) y1 = y;
}
const luz = Math.round(Math.max(x1-x0, y1-y0) * 0.04);
x0 = Math.max(0, x0-luz); y0 = Math.max(0, y0-luz);
x1 = Math.min(img.w-1, x1+luz); y1 = Math.min(img.h-1, y1+luz);
if (KADR.length === 4 && KADR.every(Number.isFinite)){
  x0 = KADR[0]; y0 = KADR[1];
  x1 = KADR[0] + KADR[2] - 1; y1 = KADR[1] + KADR[3] - 1;
}
const kadrW = x1-x0+1, kadrH = y1-y0+1;

/* --- 4. rozciągnięcie tonu po samej sylwetce -------------------
   Percentyle zamiast skrajnych wartości: pojedynczy prześwietlony
   piksel nie ma decydować o całej skali. */
// Tylko z kadru: gdyby liczyć z całego źródła, skalę ustawiałyby
// partie, których i tak nie widać na wyjściu.
const probki = [];
for (let y = y0; y <= y1; y++)
  for (let x = x0; x <= x1; x++){
    const i = y*img.w+x;
    if (alf[i] >= 0.5) probki.push(lum[i]);
  }
probki.sort((a,b) => a-b);
const lo = probki[Math.floor(probki.length * 0.03)] ?? 0;
const hi = probki[Math.floor(probki.length * 0.97)] ?? 1;
const rozpietosc = Math.max(1e-6, hi - lo);

/* --- 5. tablice sum prefiksowych -------------------------------
   Ton kropki to średnia z całej jej komórki, nie wartość jednego
   piksela w środku. Bez uśredniania raster łapie szum skóry
   i tkaniny zamiast kształtu. Sumy prefiksowe dają tę średnią
   w stałym czasie niezależnie od wielkości komórki. */
const sw = img.w+1, sh = img.h+1;
const sumL = new Float64Array(sw*sh), sumA = new Float64Array(sw*sh);
for (let y = 0; y < img.h; y++){
  for (let x = 0; x < img.w; x++){
    const i = y*img.w+x, s = (y+1)*sw + (x+1);
    const kryje = alf[i] >= 0.5 ? 1 : 0;
    sumL[s] = lum[i]*kryje + sumL[s-1] + sumL[s-sw] - sumL[s-sw-1];
    sumA[s] = kryje        + sumA[s-1] + sumA[s-sw] - sumA[s-sw-1];
  }
}
const suma = (t, ax, ay, bx, by) => t[by*sw+bx] - t[ay*sw+bx] - t[by*sw+ax] + t[ay*sw+ax];

/* --- 6. komórki ------------------------------------------------
   Jedna komórka = jeden kolor. Ton nie steruje wielkością kropki,
   tylko wyborem stopnia z rampy — stąd twarde, kwadratowe piksele
   zamiast rastra. */
const outW = KROPKI * KOMORKA;
const WIERSZE = Math.max(1, Math.round(KROPKI * kadrH / kadrW));
const outH = WIERSZE * KOMORKA;
const px = Buffer.alloc(outW*outH*4, 0);

const komorkaZr = kadrW / KROPKI;             // bok komórki w pikselach źródła

/* Ton komórki: średnia z jej pola. Zwraca null, gdy komórka leży
   w większości poza sylwetką — wtedy zostaje przezroczysta i to
   ona rysuje schodkowy kontur. */
const ton = (gx, gy) => {
  const ax = Math.min(img.w, Math.max(0, Math.round(x0 + gx*komorkaZr)));
  const ay = Math.min(img.h, Math.max(0, Math.round(y0 + gy*komorkaZr)));
  const bx = Math.min(img.w, Math.max(ax+1, Math.round(x0 + (gx+1)*komorkaZr)));
  const by = Math.min(img.h, Math.max(ay+1, Math.round(y0 + (gy+1)*komorkaZr)));
  const pole = (bx-ax)*(by-ay);
  const kryte = suma(sumA, ax, ay, bx, by);
  if (kryte < pole*0.5) return null;
  const v = suma(sumL, ax, ay, bx, by) / kryte;
  return Math.min(1, Math.max(0, (v-lo) / rozpietosc));
};

/* Rampa: czerń i kolejne stopnie limonki, mieszanej w stronę czerni.
   Cztery stopnie wystarczają portretowi — ma światło, półcień i cień.
   Zrzut interfejsu potrzebuje więcej, bo jego treścią są drobne
   różnice jasności, a nie bryła; stąd STOPNIE w argumentach. */
const mieszaj = (f) => [
  Math.round(BLACK[0] + (LIME[0]-BLACK[0])*f),
  Math.round(BLACK[1] + (LIME[1]-BLACK[1])*f),
  Math.round(BLACK[2] + (LIME[2]-BLACK[2])*f),
];
const RAMPA = Array.from({length: STOPNIE}, (_, i) => mieszaj(i / (STOPNIE-1)));

/* Progi z histogramu samych komórek, nie wpisane na sztywno.
   Powód jest praktyczny: portret ma pełną skalę od czerni czapki do
   bieli wiatrówki, a zrzut interfejsu jest prawie cały jasny. Progi
   dobre dla jednego wypchnęłyby drugi w jednolitą plamę. Kwantyle
   dają każdemu stopniowi mniej więcej tyle samo powierzchni, więc
   każdy obraz sam znajduje swój podział — to wyrównanie histogramu,
   tylko policzone na gotowej siatce. */
const tony = [];
for (let gy = 0; gy < WIERSZE; gy++)
  for (let gx = 0; gx < KROPKI; gx++){
    const t = ton(gx, gy);
    if (t !== null) tony.push(t);
  }
tony.sort((a,b) => a-b);
const PROGI = Array.from({length: STOPNIE-1}, (_, i) =>
  tony[Math.floor(tony.length * (i+1) / STOPNIE)] ?? 1);

const stopien = t => {
  let s = 0;
  while (s < PROGI.length && t >= PROGI[s]) s++;
  return s;
};

for (let gy = 0; gy < WIERSZE; gy++){
  for (let gx = 0; gx < KROPKI; gx++){
    const t = ton(gx, gy);
    if (t === null) continue;
    const c = RAMPA[stopien(t)];
    for (let sy = 0; sy < KOMORKA; sy++){
      const wiersz = (gy*KOMORKA + sy)*outW;
      for (let sx = 0; sx < KOMORKA; sx++){
        const o = (wiersz + gx*KOMORKA + sx)*4;
        px[o] = c[0]; px[o+1] = c[1]; px[o+2] = c[2]; px[o+3] = 255;
      }
    }
  }
}

fs.writeFileSync(OUT, encode(outW, outH, px));
console.log(`${OUT}  ${outW}×${outH}  (siatka ${KROPKI}×${WIERSZE}, piksel ${KOMORKA}px, ${STOPNIE} stopni)`);
