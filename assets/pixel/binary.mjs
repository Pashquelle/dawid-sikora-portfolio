import fs from 'fs'; import zlib from 'zlib';

/* Pole binarne dla dymka „Data-heavy". Rysowane wprost z kodu — żadnego
   obrazka źródłowego. Strumień bitów to ASCII tekstu, ucięty na siatce,
   więc te zera i jedynki naprawdę coś znaczą. */
const TEXT = process.argv[2] || 'data-heavy ';
const COLS = Number(process.argv[3] || 14);
const ROWS = Number(process.argv[4] || 10);
const MODE = process.argv[5] || 'tiles';   // tiles | plain
const OUT  = process.argv[6];
const HL   = (process.argv[7]||'').split(',').map(Number); // wiersz,kolumna,długość podświetlenia

const LIME=[0xD8,0xF2,0x3A], BLACK=[0x17,0x17,0x13];

/* font 3×5 — tylko dwie potrzebne cyfry */
const GLYPH = {
  '0': ['111','101','101','101','111'],
  '1': ['.1.','11.','.1.','.1.','111'],
};
const CW = 4, CH = 6;                       // komórka: glif + 1px odstępu
const W = COLS*CW - 1, H = ROWS*CH - 1;

/* strumień bitów z ASCII */
let bits = '';
while (bits.length < COLS*ROWS)
  for (const c of TEXT) bits += c.charCodeAt(0).toString(2).padStart(8,'0');

const px = Buffer.alloc(W*H*4, 0);
const put = (x,y,c) => { if(x<0||y<0||x>=W||y>=H) return; const o=(y*W+x)*4;
  px[o]=c[0]; px[o+1]=c[1]; px[o+2]=c[2]; px[o+3]=255; };

for (let r=0; r<ROWS; r++) for (let c=0; c<COLS; c++){
  const bit = bits[r*COLS+c];
  const x0 = c*CW, y0 = r*CH;
  // jedynka dostaje limonkowe pole, zero zostaje samą cyfrą — akcent
  // jako wypełnienie, nigdy jako kolor tekstu (DESIGN.md)
  const tile = MODE === 'tiles'
    ? bit === '1'
    : (HL.length === 3 && r === HL[0] && c >= HL[1] && c < HL[1] + HL[2]);
  if (tile) for (let y=0;y<CH;y++) for (let x=0;x<CW;x++) put(x0+x, y0+y, LIME);
  const g = GLYPH[bit];
  for (let y=0;y<5;y++) for (let x=0;x<3;x++)
    if (g[y][x] === '1') put(x0+x, y0+y, BLACK);
}

function crc32(b){let c,t=crc32.t;if(!t){t=crc32.t=[];for(let n=0;n<256;n++){c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0;}}let r=0xFFFFFFFF;for(const x of b)r=t[(r^x)&255]^(r>>>8);return (r^0xFFFFFFFF)>>>0;}
function ch(t,d){const l=Buffer.alloc(4);l.writeUInt32BE(d.length);const td=Buffer.concat([Buffer.from(t,'ascii'),d]);const cc=Buffer.alloc(4);cc.writeUInt32BE(crc32(td));return Buffer.concat([l,td,cc]);}
function enc(w,h,rgba){const s=w*4,raw=Buffer.alloc(h*(s+1));for(let y=0;y<h;y++){raw[y*(s+1)]=0;rgba.copy(raw,y*(s+1)+1,y*s,(y+1)*s);}const ih=Buffer.alloc(13);ih.writeUInt32BE(w,0);ih.writeUInt32BE(h,4);ih[8]=8;ih[9]=6;return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),ch('IHDR',ih),ch('IDAT',zlib.deflateSync(raw,{level:9})),ch('IEND',Buffer.alloc(0))]);}

fs.writeFileSync(OUT, enc(W,H,px));
console.log(`${OUT} ${W}×${H} (${COLS}×${ROWS} bitów, tryb ${MODE})`);
