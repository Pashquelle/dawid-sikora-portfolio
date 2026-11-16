import fs from 'fs'; import zlib from 'zlib';

/* Stos płyt w izometrii — rysowany z kodu, tą samą ręką co sześciany
   w cubes.mjs: góra lita limonka, lewa ścianka szachownica, prawa czerń,
   krawędzie czarne. Trzy tony z dwóch kolorów, bez odrysowywania gradientu.
   Użycie: node slabs.mjs <plik.png> <półszerokość> <grubość> <przerwa> <ile> */

const OUT   = process.argv[2];
const HW    = Number(process.argv[3] || 27);   // półszerokość płyty w px
const TH    = Number(process.argv[4] || 6);    // grubość płyty
const GAP   = Number(process.argv[5] || 7);    // przerwa między płytami
const COUNT = Number(process.argv[6] || 4);
const HH    = Math.round(HW / 2);              // rzut 2:1
const LIME=[0xD8,0xF2,0x3A], BLACK=[0x17,0x17,0x13];

const CW = HW * 2 + 1;
const CH = HH * 2 + (COUNT - 1) * (TH + GAP) + TH + 1;
const px = Buffer.alloc(CW * CH * 4, 0);

const put=(x,y,c)=>{x=Math.round(x);y=Math.round(y);if(x<0||y<0||x>=CW||y>=CH)return;
  const o=(y*CW+x)*4;px[o]=c[0];px[o+1]=c[1];px[o+2]=c[2];px[o+3]=255;};

function fill(poly, mode){
  const ys=poly.map(p=>p[1]);
  for(let y=Math.ceil(Math.min(...ys));y<=Math.floor(Math.max(...ys));y++){
    const xs=[];
    for(let i=0;i<poly.length;i++){
      const [x1,y1]=poly[i], [x2,y2]=poly[(i+1)%poly.length];
      if((y1<=y&&y2>y)||(y2<=y&&y1>y)) xs.push(x1+(y-y1)/(y2-y1)*(x2-x1));
    }
    xs.sort((a,b)=>a-b);
    for(let i=0;i+1<xs.length;i+=2)
      for(let x=Math.ceil(xs[i]);x<=Math.floor(xs[i+1]);x++){
        if(mode==='checker') put(x,y,((x+y)&1)?BLACK:LIME);
        else put(x,y,mode==='lime'?LIME:BLACK);
      }
  }
}
function line(a,b){
  let [x0,y0]=a.map(Math.round),[x1,y1]=b.map(Math.round);
  const dx=Math.abs(x1-x0),sx=x0<x1?1:-1,dy=-Math.abs(y1-y0),sy=y0<y1?1:-1;
  let err=dx+dy;
  for(;;){ put(x0,y0,BLACK); if(x0===x1&&y0===y1)break;
    const e2=2*err; if(e2>=dy){err+=dy;x0+=sx;} if(e2<=dx){err+=dx;y0+=sy;} }
}

/* od góry do dołu: niższa płyta zasłania fragment wyższej */
for(let k=0;k<COUNT;k++){
  const cx = HW, cy = HH + k*(TH+GAP);
  const N=[cx,cy-HH], E=[cx+HW,cy], S=[cx,cy+HH], W=[cx-HW,cy];
  const Ed=[E[0],E[1]+TH], Sd=[S[0],S[1]+TH], Wd=[W[0],W[1]+TH];
  fill([N,E,S,W],'lime');        // góra
  fill([W,S,Sd,Wd],'checker');   // lewa ścianka
  fill([S,E,Ed,Sd],'black');     // prawa ścianka
  line(N,E); line(E,S); line(S,W); line(W,N);
  line(W,Wd); line(S,Sd); line(E,Ed); line(Wd,Sd); line(Sd,Ed);
}

function crc32(b){let c,t=crc32.t;if(!t){t=crc32.t=[];for(let n=0;n<256;n++){c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0;}}let r=0xFFFFFFFF;for(const x of b)r=t[(r^x)&255]^(r>>>8);return (r^0xFFFFFFFF)>>>0;}
function ch(t,d){const l=Buffer.alloc(4);l.writeUInt32BE(d.length);const td=Buffer.concat([Buffer.from(t,'ascii'),d]);const c=Buffer.alloc(4);c.writeUInt32BE(crc32(td));return Buffer.concat([l,td,c]);}
function enc(w,h,rgba){const s=w*4,raw=Buffer.alloc(h*(s+1));for(let y=0;y<h;y++){raw[y*(s+1)]=0;rgba.copy(raw,y*(s+1)+1,y*s,(y+1)*s);}const ih=Buffer.alloc(13);ih.writeUInt32BE(w,0);ih.writeUInt32BE(h,4);ih[8]=8;ih[9]=6;return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),ch('IHDR',ih),ch('IDAT',zlib.deflateSync(raw,{level:9})),ch('IEND',Buffer.alloc(0))]);}

fs.writeFileSync(OUT, enc(CW,CH,px));
console.log(`${OUT} ${CW}×${CH} (${COUNT} płyt)`);
