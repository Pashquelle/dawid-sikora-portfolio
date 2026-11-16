import fs from 'fs'; import zlib from 'zlib';

/* Klaster sześcianów w izometrii — rysowany z kodu, nie odrysowany z obrazka.
   Trzy tony z dwóch kolorów: góra lita limonka, lewa ścianka szachownica,
   prawa czerń. Krawędzie czarne. Ten sam chwyt co dithering w grafikach obok. */

const OUT = process.argv[2];
const S   = Number(process.argv[3] || 6);    // półszerokość sześcianu w px
const W = S, HH = Math.round(S/2), CH = S;   // rzut 2:1, wysokość bryły
const LIME=[0xD8,0xF2,0x3A], BLACK=[0x17,0x17,0x13];

/* siatka 3D: [x, y, z]; klaster + kilka odłączonych kostek */
const CORE = [
  // krzyż 3D: środek i sześć sąsiadów przez ścianki, plus dwa narożniki
  [1,1,1],
  [0,1,1],[2,1,1],
  [1,0,1],[1,2,1],
  [1,1,0],[1,1,2],
  [0,0,0],[2,2,2],[0,2,0],
];
const LOOSE = [[-2,-1,3],[4,1,3],[3,3,-1],[-1,3,2],[4,-2,1]];
const CUBES = [...CORE, ...LOOSE];

/* rzut */
const proj = ([x,y,z]) => [ (x - y) * W, (x + y) * HH - z * CH ];

let pts = CUBES.map(proj);
const minX = Math.min(...pts.map(p=>p[0])) - W - 1;
const minY = Math.min(...pts.map(p=>p[1])) - HH - 1;
const maxX = Math.max(...pts.map(p=>p[0])) + W + 1;
const maxY = Math.max(...pts.map(p=>p[1])) + HH + CH + 1;
const CW = Math.ceil(maxX - minX), CHt = Math.ceil(maxY - minY);
const px = Buffer.alloc(CW * CHt * 4, 0);

const put = (x,y,c) => {
  x = Math.round(x); y = Math.round(y);
  if (x<0||y<0||x>=CW||y>=CHt) return;
  const o=(y*CW+x)*4; px[o]=c[0]; px[o+1]=c[1]; px[o+2]=c[2]; px[o+3]=255;
};

/* wypełnienie wielokąta skanliniowo; 'checker' = co drugi piksel */
function fill(poly, mode){
  const ys = poly.map(p=>p[1]);
  for (let y = Math.ceil(Math.min(...ys)); y <= Math.floor(Math.max(...ys)); y++){
    const xs = [];
    for (let i=0;i<poly.length;i++){
      const [x1,y1] = poly[i], [x2,y2] = poly[(i+1)%poly.length];
      if ((y1 <= y && y2 > y) || (y2 <= y && y1 > y))
        xs.push(x1 + (y - y1) / (y2 - y1) * (x2 - x1));
    }
    xs.sort((a,b)=>a-b);
    for (let i=0;i+1<xs.length;i+=2)
      for (let x = Math.ceil(xs[i]); x <= Math.floor(xs[i+1]); x++){
        if (mode === 'checker' && ((x + y) & 1)) put(x,y,BLACK);
        else if (mode === 'checker') put(x,y,LIME);
        else put(x, y, mode === 'lime' ? LIME : BLACK);
      }
  }
}
function line(a, b){                      // Bresenham
  let [x0,y0]=a.map(Math.round), [x1,y1]=b.map(Math.round);
  const dx=Math.abs(x1-x0), sx=x0<x1?1:-1, dy=-Math.abs(y1-y0), sy=y0<y1?1:-1;
  let err=dx+dy;
  for(;;){
    put(x0,y0,BLACK);
    if (x0===x1 && y0===y1) break;
    const e2=2*err;
    if (e2>=dy){ err+=dy; x0+=sx; }
    if (e2<=dx){ err+=dx; y0+=sy; }
  }
}

/* malarz: od tyłu do przodu */
const order = [...CUBES].sort((a,b) => (a[0]+a[1]+a[2]) - (b[0]+b[1]+b[2]));
for (const c of order){
  const [cx, cy] = proj(c);
  const x = cx - minX, y = cy - minY;
  const N=[x, y-HH], E=[x+W, y], Sp=[x, y+HH], Wp=[x-W, y];
  const Nd=[N[0],N[1]+CH], Ed=[E[0],E[1]+CH], Sd=[Sp[0],Sp[1]+CH], Wd=[Wp[0],Wp[1]+CH];
  fill([N,E,Sp,Wp], 'lime');              // góra
  fill([Wp,Sp,Sd,Wd], 'checker');         // lewa ścianka
  fill([Sp,E,Ed,Sd], 'black');            // prawa ścianka
  line(N,E); line(E,Sp); line(Sp,Wp); line(Wp,N);
  line(Wp,Wd); line(Sp,Sd); line(E,Ed);
  line(Wd,Sd); line(Sd,Ed);
}

function crc32(b){let c,t=crc32.t;if(!t){t=crc32.t=[];for(let n=0;n<256;n++){c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0;}}let r=0xFFFFFFFF;for(const x of b)r=t[(r^x)&255]^(r>>>8);return (r^0xFFFFFFFF)>>>0;}
function ch(t,d){const l=Buffer.alloc(4);l.writeUInt32BE(d.length);const td=Buffer.concat([Buffer.from(t,'ascii'),d]);const c=Buffer.alloc(4);c.writeUInt32BE(crc32(td));return Buffer.concat([l,td,c]);}
function enc(w,h,rgba){const s=w*4,raw=Buffer.alloc(h*(s+1));for(let y=0;y<h;y++){raw[y*(s+1)]=0;rgba.copy(raw,y*(s+1)+1,y*s,(y+1)*s);}const ih=Buffer.alloc(13);ih.writeUInt32BE(w,0);ih.writeUInt32BE(h,4);ih[8]=8;ih[9]=6;return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),ch('IHDR',ih),ch('IDAT',zlib.deflateSync(raw,{level:9})),ch('IEND',Buffer.alloc(0))]);}

fs.writeFileSync(OUT, enc(CW, CHt, px));
console.log(`${OUT} ${CW}×${CHt} (${CUBES.length} sześcianów, moduł ${S}px)`);
