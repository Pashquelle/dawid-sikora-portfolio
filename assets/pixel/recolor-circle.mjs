/* =========================================================
   recolor-circle.mjs — przebarwia niebieskie koło pod telefonem
   na limonkę marki (--accent #D8F23A), zostawiając ekran
   telefonu nietknięty.
   ---------------------------------------------------------
   Metoda: RGB → HSL, podmiana odcienia i nasycenia przy
   zachowaniu jasności, więc cieniowanie i krawędź koła
   przeżywają zabieg. Maska: wszystko poza ramką telefonu,
   którą znajdujemy jako największy skupisk pikseli czarnych.

   Użycie: node recolor-circle.mjs <wejscie.png> <wyjscie.png>
   ========================================================= */
import fs from 'fs';
import zlib from 'zlib';

const SRC = process.argv[2];
const OUT = process.argv[3];

const TARGET_H = 71.4 / 360;   // odcień #D8F23A
const TARGET_S = 0.88;         // nasycenie limonki
const BLUE_LO  = 165 / 360;    // dolna granica „niebieskiego"
const BLUE_HI  = 265 / 360;
const MIN_SAT  = 0.12;         // niżej to już szarość tła, nie koło

/* --- dekoder PNG: 8-bit RGBA, bez przeplotu --- */
function decode(buf) {
  const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
  if (buf[24] !== 8 || buf[25] !== 6 || buf[28] !== 0) {
    throw new Error('oczekiwano 8-bit RGBA bez przeplotu');
  }
  const parts = [];
  let o = 8;
  while (o < buf.length) {
    const len = buf.readUInt32BE(o);
    const type = buf.toString('ascii', o + 4, o + 8);
    if (type === 'IDAT') parts.push(buf.subarray(o + 8, o + 8 + len));
    if (type === 'IEND') break;
    o += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(parts));
  const bpp = 4, stride = w * bpp;
  const out = Buffer.alloc(h * stride);
  let p = 0;
  for (let y = 0; y < h; y++) {
    const filter = raw[p++];
    const line = raw.subarray(p, p + stride); p += stride;
    const cur = out.subarray(y * stride, (y + 1) * stride);
    const prev = y > 0 ? out.subarray((y - 1) * stride, y * stride) : null;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? cur[x - bpp] : 0;
      const b = prev ? prev[x] : 0;
      const c = (prev && x >= bpp) ? prev[x - bpp] : 0;
      let v = line[x];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c);
        v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
      }
      cur[x] = v & 0xff;
    }
  }
  return { w, h, data: out };
}

/* --- enkoder PNG --- */
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c;
  }
  return t;
})();
function crc32(b) {
  let c = -1;
  for (let i = 0; i < b.length; i++) c = CRC_TABLE[(c ^ b[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function encode(w, h, rgba) {
  const stride = w * 4;
  const raw = Buffer.alloc(h * (stride + 1));
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* --- konwersje barw --- */
function rgb2hsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  const l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn;
  const s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  let hh;
  if (mx === r) hh = (g - b) / d + (g < b ? 6 : 0);
  else if (mx === g) hh = (b - r) / d + 2;
  else hh = (r - g) / d + 4;
  return [hh / 6, s, l];
}
function hue2rgb(p, q, t) {
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
  return p;
}
function hsl2rgb(h, s, l) {
  if (s === 0) { const v = Math.round(l * 255); return [v, v, v]; }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [
    Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    Math.round(hue2rgb(p, q, h) * 255),
    Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
  ];
}

/* --- sylwetka telefonu, wiersz po wierszu ---------------------
   Prostokątna obwiednia byłaby za szeroka: telefon stoi lekko
   przekrzywiony, więc przy górnej i dolnej krawędzi mieściłyby
   się w niej paski koła, które zostałyby niebieskie. Dlatego dla
   każdego wiersza bierzemy skrajne piksele ciemnej ramki — maska
   przylega wtedy do obrysu telefonu.
   ------------------------------------------------------------- */
function phoneSpans(w, h, d) {
  const pad = 3;
  const spans = new Array(h).fill(null);
  for (let y = 0; y < h; y++) {
    let x0 = -1, x1 = -1;
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (d[i] < 60 && d[i + 1] < 60 && d[i + 2] < 60 && d[i + 3] > 128) {
        if (x0 < 0) x0 = x;
        x1 = x;
      }
    }
    if (x0 >= 0) spans[y] = [x0 - pad, x1 + pad];
  }
  return spans;
}

const img = decode(fs.readFileSync(SRC));
const { w, h, data } = img;
const spans = phoneSpans(w, h, data);
const rows = spans.filter(Boolean).length;
console.log(`telefon zajmuje ${rows} wierszy`);

let touched = 0;
for (let y = 0; y < h; y++) {
  const span = spans[y];
  for (let x = 0; x < w; x++) {
    if (span && x >= span[0] && x <= span[1]) continue;  // telefon zostaje
    const i = (y * w + x) * 4;
    const [hh, ss, ll] = rgb2hsl(data[i], data[i + 1], data[i + 2]);
    if (ss < MIN_SAT || hh < BLUE_LO || hh > BLUE_HI) continue;
    const [r, g, b] = hsl2rgb(TARGET_H, Math.min(TARGET_S, ss * 1.15), ll);
    data[i] = r; data[i + 1] = g; data[i + 2] = b;
    touched++;
  }
}
console.log(`przebarwionych pikseli: ${touched}`);
fs.writeFileSync(OUT, encode(w, h, data));
