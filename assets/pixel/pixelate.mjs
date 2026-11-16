import fs from 'fs';
import zlib from 'zlib';

const SRC = process.argv[2];
const OUT = process.argv[3];
const N   = Number(process.argv[4] || 64);   // liczba pikseli w poziomie
const SCALE = Number(process.argv[5] || 1);  // powiększenie na wyjściu

const LIME  = [0xD8, 0xF2, 0x3A];
const BLACK = [0x17, 0x17, 0x13];

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

/* --- 1. zejście do siatki N×M: średnia ważona kanałem alfa --- */
const img = decode(fs.readFileSync(SRC));
const M = Math.round(N * img.h / img.w);
const cellW = img.w / N, cellH = img.h / M;
const lum = new Float64Array(N*M), alpha = new Float64Array(N*M);

for (let gy=0; gy<M; gy++){
  for (let gx=0; gx<N; gx++){
    const x0 = Math.floor(gx*cellW), x1 = Math.max(x0+1, Math.floor((gx+1)*cellW));
    const y0 = Math.floor(gy*cellH), y1 = Math.max(y0+1, Math.floor((gy+1)*cellH));
    let r=0,g=0,b=0,a=0,n=0;
    for (let y=y0;y<y1;y++) for (let x=x0;x<x1;x++){
      const i = (y*img.w+x)*4, av = img.data[i+3]/255;
      r += img.data[i]*av; g += img.data[i+1]*av; b += img.data[i+2]*av;
      a += av; n++;
    }
    const k = a > 0 ? a : 1;
    // luminancja Rec. 709 na kolorze odseparowanym od alfy
    lum[gy*N+gx]   = (0.2126*(r/k) + 0.7152*(g/k) + 0.0722*(b/k)) / 255;
    alpha[gy*N+gx] = a/n;
  }
}

/* --- 2. rozciągnięcie kontrastu po samym kształcie --- */
let lo = 1, hi = 0;
for (let i=0;i<lum.length;i++) if (alpha[i] >= 0.5){ lo = Math.min(lo, lum[i]); hi = Math.max(hi, lum[i]); }
const span = Math.max(1e-6, hi - lo);

/* --- 3. dithering Bayer 8×8 na dwa kolory --- */
const B8 = [
  [ 0,32, 8,40, 2,34,10,42],[48,16,56,24,50,18,58,26],
  [12,44, 4,36,14,46, 6,38],[60,28,52,20,62,30,54,22],
  [ 3,35,11,43, 1,33, 9,41],[51,19,59,27,49,17,57,25],
  [15,47, 7,39,13,45, 5,37],[63,31,55,23,61,29,53,21]];

const outW = N*SCALE, outH = M*SCALE;
const px = Buffer.alloc(outW*outH*4, 0);

for (let gy=0; gy<M; gy++){
  for (let gx=0; gx<N; gx++){
    const i = gy*N+gx;
    if (alpha[i] < 0.5) continue;                     // tło zostaje przezroczyste
    const v = (lum[i]-lo)/span;
    const t = (B8[gy & 7][gx & 7] + 0.5) / 64;
    const c = v > t ? LIME : BLACK;                   // jasne → limonka, ciemne → czerń
    for (let sy=0; sy<SCALE; sy++) for (let sx=0; sx<SCALE; sx++){
      const o = (((gy*SCALE+sy)*outW) + gx*SCALE+sx)*4;
      px[o]=c[0]; px[o+1]=c[1]; px[o+2]=c[2]; px[o+3]=255;
    }
  }
}

fs.writeFileSync(OUT, encode(outW, outH, px));
console.log(`${OUT}  ${outW}×${outH}  (siatka ${N}×${M}, skala ${SCALE}×)`);
