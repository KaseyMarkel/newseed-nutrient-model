import fs from 'fs';
const R = new URL('..', import.meta.url).pathname;
const nut = JSON.parse(fs.readFileSync(R+'site/data/bundle_nutrition.json')).nutrition;
for (const pw of ['pco','pma']) {
  const c = nut.pathways[pw].cols; const xs=[];
  for (let i=0;i<c.w.length;i++) if (c.age[i]>=24) xs.push([Math.max(0,c.ekt[i]-c.ekm[i]), c.w[i]]);
  xs.sort((a,b)=>a[0]-b[0]); const W=xs.reduce((s,x)=>s+x[1],0); let acc=0, med;
  for (const [v,w] of xs){acc+=w; if(acc>=W/2){med=v;break;}}
  console.log(pw, 'weighted median non-maize kcal, 24-59 mo:', med.toFixed(0), '-> density for 850 µg median:', (850/med*1000).toFixed(0));
}
