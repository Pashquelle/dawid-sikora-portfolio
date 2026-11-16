import fs from 'fs'; import zlib from 'zlib';

const [,, SRC, OUT, Ns, CROP, EDGEs] = process.argv;
const N = Number(Ns||56), EDGE = Number(EDGEs||80);
const LIME=[0xD8,0xF2,0x3A], BLACK=[0x17,0x17,0x13], SAT_MIN=34;

/* dekoder PNG: 8-bit RGB (typ 2) i RGBA (typ 6), bez przeplotu */
function decode(b){
  const w=b.readUInt32BE(16), h=b.readUInt32BE(20), ct=b[25];
  if (b[24]!==8 || (ct!==2 && ct!==6) || b[28]!==0) throw new Error('nieobsługiwany PNG');
  const bpp = ct===6?4:3;
  let p=8, idat=[];
  while(p<b.length){const l=b.readUInt32BE(p),t=b.toString('ascii',p+4,p+8);
    if(t==='IDAT')idat.push(b.slice(p+8,p+8+l)); if(t==='IEND')break; p+=12+l;}
  const raw=zlib.inflateSync(Buffer.concat(idat)), s=w*bpp, out=Buffer.alloc(h*s);
  let q=0;
  for(let y=0;y<h;y++){
    const f=raw[q++], line=raw.slice(q,q+s); q+=s;
    const cur=out.slice(y*s,(y+1)*s), prev=y?out.slice((y-1)*s,y*s):null;
    for(let x=0;x<s;x++){
      const a=x>=bpp?cur[x-bpp]:0, bb=prev?prev[x]:0, c=(prev&&x>=bpp)?prev[x-bpp]:0;
      let v=line[x];
      if(f===1)v+=a; else if(f===2)v+=bb; else if(f===3)v+=(a+bb)>>1;
      else if(f===4){const pp=a+bb-c,pa=Math.abs(pp-a),pb=Math.abs(pp-bb),pc=Math.abs(pp-c);
        v+=(pa<=pb&&pa<=pc)?a:(pb<=pc?bb:c);}
      cur[x]=v&255;
    }
  }
  return {w,h,bpp,data:out};
}
function crc32(b){let c,t=crc32.t;if(!t){t=crc32.t=[];for(let n=0;n<256;n++){c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0;}}let r=0xFFFFFFFF;for(const x of b)r=t[(r^x)&255]^(r>>>8);return (r^0xFFFFFFFF)>>>0;}
function ch(t,d){const l=Buffer.alloc(4);l.writeUInt32BE(d.length);const td=Buffer.concat([Buffer.from(t,'ascii'),d]);const c=Buffer.alloc(4);c.writeUInt32BE(crc32(td));return Buffer.concat([l,td,c]);}
function enc(w,h,rgba){const s=w*4,raw=Buffer.alloc(h*(s+1));for(let y=0;y<h;y++){raw[y*(s+1)]=0;rgba.copy(raw,y*(s+1)+1,y*s,(y+1)*s);}const ih=Buffer.alloc(13);ih.writeUInt32BE(w,0);ih.writeUInt32BE(h,4);ih[8]=8;ih[9]=6;return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),ch('IHDR',ih),ch('IDAT',zlib.deflateSync(raw,{level:9})),ch('IEND',Buffer.alloc(0))]);}

const img = decode(fs.readFileSync(SRC));
let [cx,cy,cw,chh] = (CROP||'').split(',').map(Number);
if(!cw){cx=0;cy=0;cw=img.w;chh=img.h;}
const M=Math.round(N*chh/cw), cellW=cw/N, cellH=chh/M;
const R=new Float64Array(N*M),G=new Float64Array(N*M),B=new Float64Array(N*M),cov=new Float64Array(N*M);

for(let gy=0;gy<M;gy++) for(let gx=0;gx<N;gx++){
  const x0=cx+Math.floor(gx*cellW), x1=cx+Math.max(Math.floor(gx*cellW)+1,Math.floor((gx+1)*cellW));
  const y0=cy+Math.floor(gy*cellH), y1=cy+Math.max(Math.floor(gy*cellH)+1,Math.floor((gy+1)*cellH));
  let r=0,g=0,b=0,k=0,n=0;
  for(let y=y0;y<y1;y++) for(let x=x0;x<x1;x++){
    const i=(y*img.w+x)*img.bpp, rr=img.data[i],gg=img.data[i+1],bb2=img.data[i+2];
    const al = img.bpp===4 ? img.data[i+3] : 255;
    n++;
    if (al < 128) continue;                                     // przezroczyste tło
    if (Math.max(rr,gg,bb2)-Math.min(rr,gg,bb2) < SAT_MIN) continue; // biel, szarość, cień
    r+=rr; g+=gg; b+=bb2; k++;
  }
  const i=gy*N+gx; cov[i]=k/n; if(k){R[i]=r/k;G[i]=g/k;B[i]=b/k;}
}
const inside = i => cov[i] >= 0.5;
const diff = (a,b) => Math.abs(R[a]-R[b])+Math.abs(G[a]-G[b])+Math.abs(B[a]-B[b]);

const px = Buffer.alloc(N*M*4,0);
for(let gy=0;gy<M;gy++) for(let gx=0;gx<N;gx++){
  const i=gy*N+gx; if(!inside(i)) continue;
  let edge=false;
  for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
    const x=gx+dx,y=gy+dy;
    if(x<0||y<0||x>=N||y>=M){edge=true;break;}
    const j=y*N+x;
    if(!inside(j) || diff(i,j)>EDGE){edge=true;break;}
  }
  const c = edge?BLACK:LIME, o=i*4;
  px[o]=c[0];px[o+1]=c[1];px[o+2]=c[2];px[o+3]=255;
}
const isBlack=(x,y)=>{if(x<0||y<0||x>=N||y>=M)return false;const o=(y*N+x)*4;return px[o+3]===255&&px[o]===BLACK[0];};
const clean=Buffer.from(px);
for(let y=0;y<M;y++) for(let x=0;x<N;x++){
  if(!isBlack(x,y)) continue;
  let n=0; for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]) if(isBlack(x+dx,y+dy)) n++;
  if(n===0){const o=(y*N+x)*4;clean[o]=LIME[0];clean[o+1]=LIME[1];clean[o+2]=LIME[2];}
}
fs.writeFileSync(OUT, enc(N,M,clean));
console.log(`${OUT} siatka ${N}×${M}`);
