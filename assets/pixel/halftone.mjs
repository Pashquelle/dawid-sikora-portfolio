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
// Raster jednofarbowy: sama limonka, bez czarnego screenu pod spodem.
// Półtony mieszane w oliwkę wyglądają brudno i rozjeżdżają się
// z resztą strony, która zna tylko czerń i jeden akcent.
const JEDNA   = process.env.JEDNA === '1';

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

/* Wyrównanie histogramu zamiast prostego rozciągnięcia skali.
   Rozciągnięcie zakłada, że tony rozkładają się równomiernie między
   lo a hi — przy portrecie mniej więcej tak jest, ale zrzut
   interfejsu jest w 80% jasny i cały ląduje na maksimum krycia,
   czyli w jednolitej płachcie. Tu ton kropki to pozycja jasności
   w posortowanej próbce, więc każdy poziom krycia dostaje tyle samo
   powierzchni i raster zawsze ma pełną skalę. */
const rownaj = (v) => {
  let a = 0, b = probki.length;
  while (a < b){ const m = (a+b) >> 1; if (probki[m] < v) a = m+1; else b = m; }
  return probki.length ? a / probki.length : 0;
};

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

/* --- 6. raster ------------------------------------------------
   Dla każdego piksela wyjścia pytamy: w którą komórkę rastra
   wpada po obrocie i jak daleko jest od jej środka. Mieści się
   w promieniu wynikającym z tonu — dostaje farbę. */
const outW = KROPKI * KOMORKA;
const outH = Math.round(KROPKI * kadrH / kadrW) * KOMORKA;
const px = Buffer.alloc(outW*outH*4, 0);

const naZrodlo = kadrW / outW;                // piksel wyjścia → piksel źródła
const komorkaZr = KOMORKA * naZrodlo;         // bok komórki w pikselach źródła

// Promień kropki przy pełnym kryciu. Nieco ponad pół komórki, więc
// przy maksimum kropki się stykają, ale raster dalej jest rastrem —
// 0.78 zlewało światła w jednolite plamy.
const R_MAX = KOMORKA * 0.52;

/* Ton komórki: średnia z jej pola, liczona na kadrze źródła.
   Zwraca null, gdy komórka jest w większości poza sylwetką. */
const ton = (sx, sy) => {
  const ax = Math.min(img.w, Math.max(0, Math.round(x0 + sx - komorkaZr/2)));
  const ay = Math.min(img.h, Math.max(0, Math.round(y0 + sy - komorkaZr/2)));
  const bx = Math.min(img.w, Math.max(ax+1, Math.round(x0 + sx + komorkaZr/2)));
  const by = Math.min(img.h, Math.max(ay+1, Math.round(y0 + sy + komorkaZr/2)));
  const pole = (bx-ax)*(by-ay);
  const kryte = suma(sumA, ax, ay, bx, by);
  if (kryte < pole*0.4) return null;
  const v = suma(sumL, ax, ay, bx, by) / kryte;
  return rownaj(v);
};

const farba = (kat, kryjaca) => {
  const cos = Math.cos(kat), sin = Math.sin(kat);
  for (let oy = 0; oy < outH; oy++){
    for (let ox = 0; ox < outW; ox++){
      // obrót układu rastra wokół środka obrazu
      const cx = ox - outW/2, cy = oy - outH/2;
      const rx =  cx*cos + cy*sin;
      const ry = -cx*sin + cy*cos;

      // środek najbliższej komórki w obróconym układzie
      const gx = Math.round(rx / KOMORKA), gy = Math.round(ry / KOMORKA);
      const sx = gx*KOMORKA, sy = gy*KOMORKA;

      // ten sam środek z powrotem w układzie obrazu — stamtąd bierzemy ton,
      // żeby cała kropka miała jeden ton, a nie gradient w poprzek
      const bx = sx*cos - sy*sin + outW/2;
      const by = sx*sin + sy*cos + outH/2;
      const t = ton(bx*naZrodlo, by*naZrodlo);
      if (t === null) continue;

      const pokrycie = kryjaca(t);
      if (pokrycie <= 0) continue;

      const d = Math.hypot(rx - sx, ry - sy);
      // pierwiastek, bo to pole kropki ma rosnąć liniowo z tonem, nie promień
      if (d > R_MAX * Math.sqrt(pokrycie)) continue;

      const o = (oy*outW + ox)*4;
      const c = kryjaca === swiatla ? LIME : BLACK;
      px[o] = c[0]; px[o+1] = c[1]; px[o+2] = c[2]; px[o+3] = 255;
    }
  }
};

// Limonka niesie światła, czerń cienie. Zakresy zachodzą na siebie
// w półtonach — tam oba rastry kładą małe kropki i to one robią
// przejście. Górny limit 0.92 pilnuje, żeby w najjaśniejszym
// miejscu nadal było widać, że to raster, a nie wypełnienie.
// W trybie jednofarbowym limonka musi objąć całą skalę sama: kropka
// rośnie od zera w najgłębszym cieniu do pełnej w świetle. Tło pod
// spodem jest ciemne, więc brak kropki to cień.
const swiatla = JEDNA
  ? t => Math.min(0.95, t)
  : t => Math.min(0.95, Math.max(0, (t - 0.14) / 0.86));
const cienie  = t => Math.min(0.95, Math.max(0, (0.56 - t) / 0.60));

if (!JEDNA) farba(KAT_BLACK, cienie);   // cienie pod spód
farba(KAT_LIME,  swiatla);    // limonka na wierzch — to ona ma być widoczna

fs.writeFileSync(OUT, encode(outW, outH, px));
console.log(`${OUT}  ${outW}×${outH}  (raster ${KROPKI} kropek w poziomie, komórka ${KOMORKA}px)`);
