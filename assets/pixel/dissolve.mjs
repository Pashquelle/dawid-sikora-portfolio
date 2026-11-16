import fs from 'fs'; import zlib from 'zlib';

/* Sprite do pikselowego rozsypywania się przycisków.
   Pionowy pas klatek: od pustej do pełnej.

   O kolejności zapalania decyduje ranking budowany tak, żeby piksele
   jak najdłużej nie stykały się bokami ani rogami: kandydat mający już
   zapalonego sąsiada jest odrzucany, dopóki istnieje jakikolwiek wolny
   piksel bez sąsiada. Dopiero gdy takich zabraknie, dosypujemy resztę
   „najdalej od zapalonych". Dzięki temu początek rozsypki to pojedyncze
   bloki rozrzucone po całym przycisku, a nie pary i zlepy.
   Odległości i sąsiedztwo liczone na torusie, bo kafel się powtarza.

   Więcej klatek = drobniejszy przyrost = płynniejsze wejście.
   Ziarno jest stałe, więc plik odtwarza się co do piksela.

   Użycie: node assets/pixel/dissolve.mjs <plik.png> <kolumny> <wiersze> <klatki> [kolor] [in|out] [y|x]
   'out' odwraca kolejność klatek: pas zaczyna się pełny i pustoszeje —
   tak działa warstwa przykrywająca ilustracje w dymkach.

   Oś pasa: 'y' (domyślnie) układa klatki jedna pod drugą — animuje się
   wtedy background-position-y, a kafel powtarza się w poziomie. 'x'
   układa je obok siebie, do pasów pionowych: kafel powtarza się wtedy
   w pionie (repeat-y), a przewija się background-position-x. */

const OUT    = process.argv[2] || 'assets/pixel/dissolve.png';
const COLS   = Number(process.argv[3] || 16);
const ROWS   = Number(process.argv[4] || 4);
const FRAMES = Number(process.argv[5] || 17);   // klatka 0 pusta, ostatnia pełna
const HEX    = (process.argv[6] || '171713').replace('#','');
const ORDER  = process.argv[7] || 'in';         // in = przybywa, out = ubywa
const AXIS   = process.argv[8] || 'y';          // y = pas w pionie, x = pas w poziomie
const INK    = [0,2,4].map(i => parseInt(HEX.slice(i,i+2),16));
const CELLS  = COLS * ROWS;
const STEP   = CELLS / (FRAMES - 1);
const TRIES  = 24;

let seed = 20260926;
const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;

const rank   = new Int32Array(CELLS).fill(-1);
const placed = [];

const wrapX = d => (d > COLS/2 ? COLS - d : d);
const wrapY = d => (d > ROWS/2 ? ROWS - d : d);

const hasNeighbour = (x, y) => {
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++){
    if (!dx && !dy) continue;
    const nx = (x + dx + COLS) % COLS, ny = (y + dy + ROWS) % ROWS;
    if (rank[ny * COLS + nx] !== -1) return true;
  }
  return false;
};
const minDist = (x, y) => {
  let m = Infinity;
  for (const [px_, py_] of placed){
    const dx = wrapX(Math.abs(x - px_)), dy = wrapY(Math.abs(y - py_));
    m = Math.min(m, dx*dx + dy*dy);
  }
  return m;
};

/* czy gdziekolwiek jest jeszcze wolny piksel bez zapalonego sąsiada */
const loneLeft = () => {
  for (let i = 0; i < CELLS; i++)
    if (rank[i] === -1 && !hasNeighbour(i % COLS, (i / COLS) | 0)) return true;
  return false;
};

for (let r = 0; r < CELLS; r++){
  const wantLone = loneLeft();
  let best = -1, bestDist = -1;
  for (let t = 0; t < TRIES; t++){
    const i = Math.floor(rnd() * CELLS);
    if (rank[i] !== -1) continue;
    const x = i % COLS, y = (i / COLS) | 0;
    if (wantLone && hasNeighbour(x, y)) continue;     // nie dokładamy pary
    const d = minDist(x, y);
    if (d > bestDist){ bestDist = d; best = i; }
  }
  if (best === -1){                                   // losowanie nie trafiło
    let fallback = -1, fd = -1;
    for (let i = 0; i < CELLS; i++){
      if (rank[i] !== -1) continue;
      const x = i % COLS, y = (i / COLS) | 0;
      if (wantLone && hasNeighbour(x, y)) continue;
      const d = minDist(x, y);
      if (d > fd){ fd = d; fallback = i; }
    }
    best = fallback !== -1 ? fallback : rank.findIndex(v => v === -1);
  }
  rank[best] = r;
  placed.push([best % COLS, (best / COLS) | 0]);
}

const W = AXIS === 'x' ? COLS * FRAMES : COLS;
const H = AXIS === 'x' ? ROWS : ROWS * FRAMES;
const px = Buffer.alloc(W * H * 4, 0);
for (let fi = 0; fi < FRAMES; fi++){
  const f = ORDER === 'out' ? FRAMES - 1 - fi : fi;   // klatka 0 pełna, ostatnia pusta
  for (let y = 0; y < ROWS; y++)
    for (let x = 0; x < COLS; x++){
      if (rank[y * COLS + x] >= f * STEP) continue;   // jeszcze nie ta klatka
      const o = AXIS === 'x'
        ? (y * W + fi * COLS + x) * 4
        : ((fi * ROWS + y) * W + x) * 4;
      px[o] = INK[0]; px[o+1] = INK[1]; px[o+2] = INK[2]; px[o+3] = 255;
    }
}

function crc32(b){let c,t=crc32.t;if(!t){t=crc32.t=[];for(let n=0;n<256;n++){c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0;}}let r=0xFFFFFFFF;for(const x of b)r=t[(r^x)&255]^(r>>>8);return (r^0xFFFFFFFF)>>>0;}
function ch(t,d){const l=Buffer.alloc(4);l.writeUInt32BE(d.length);const td=Buffer.concat([Buffer.from(t,'ascii'),d]);const c=Buffer.alloc(4);c.writeUInt32BE(crc32(td));return Buffer.concat([l,td,c]);}
function enc(w,h,rgba){const s=w*4,raw=Buffer.alloc(h*(s+1));for(let y=0;y<h;y++){raw[y*(s+1)]=0;rgba.copy(raw,y*(s+1)+1,y*s,(y+1)*s);}const ih=Buffer.alloc(13);ih.writeUInt32BE(w,0);ih.writeUInt32BE(h,4);ih[8]=8;ih[9]=6;return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),ch('IHDR',ih),ch('IDAT',zlib.deflateSync(raw,{level:9})),ch('IEND',Buffer.alloc(0))]);}

fs.writeFileSync(OUT, enc(W, H, px));
console.log(`${OUT} ${W}×${H} (${FRAMES} klatek po ${COLS}×${ROWS}, krok ${STEP} px/klatkę)`);
