/* =========================================================
   crop.mjs — kadruje PNG i przy okazji mierzy, co gdzie leży
   ---------------------------------------------------------
   Bez argumentów kadru wypisuje tylko pomiary: obwiednię
   ciemnej ramki telefonu i obwiednię limonkowego koła.
   Z argumentami wycina prostokąt.

   Użycie:
     node crop.mjs <wejscie.png>                       — pomiar
     node crop.mjs <wejscie.png> <wyjscie.png> x y w h — kadr
   ========================================================= */
import fs from 'fs';
import zlib from 'zlib';

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

function box(w, h, d, test) {
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (!test(d[i], d[i + 1], d[i + 2], d[i + 3])) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  return { x0, y0, x1, y1 };
}

const img = decode(fs.readFileSync(process.argv[2]));
const { w, h, data } = img;

const phone = box(w, h, data, (r, g, b, a) => r < 60 && g < 60 && b < 60 && a > 128);
// limonka: zielony wyraźnie nad czerwonym, czerwony nad niebieskim
const lime = box(w, h, data, (r, g, b) => g > 140 && g - b > 60 && r - b > 30);
console.log(`obraz:   ${w}×${h}`);
console.log(`telefon: x ${phone.x0}–${phone.x1}  y ${phone.y0}–${phone.y1}`);
console.log(`koło:    x ${lime.x0}–${lime.x1}  y ${lime.y0}–${lime.y1}`);

if (process.argv.length >= 8) {
  const [OUT, X, Y, CW, CH] = [process.argv[3], ...process.argv.slice(4, 8).map(Number)];
  const out = Buffer.alloc(CW * CH * 4);
  for (let y = 0; y < CH; y++) {
    const sy = Y + y;
    if (sy < 0 || sy >= h) continue;
    data.copy(out, y * CW * 4, (sy * w + X) * 4, (sy * w + X + CW) * 4);
  }
  fs.writeFileSync(OUT, encode(CW, CH, out));
  console.log(`kadr:    ${CW}×${CH} od (${X}, ${Y}) → ${OUT}`);
}
