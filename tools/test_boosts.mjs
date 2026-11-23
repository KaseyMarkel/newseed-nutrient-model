import fs from 'fs';
import { createEngine } from '../engine/engine.js';
const R = new URL('..', import.meta.url).pathname;
const econ = JSON.parse(fs.readFileSync(R+'site/data/bundle_econ.json')), nutB = JSON.parse(fs.readFileSync(R+'site/data/bundle_nutrition.json'));
const eng = createEngine({ ...econ, ...nutB });
const d = eng.defaults();
const seed = { id:'s30', label:'2030', year:'2030', yield_change:{ OPV_Criollo: 0.705, Low: 0.705, Mid: 0.32, High: 0.078 } };
const sub = d.subsidies.find(s=>s.id==='sub00');
const run = (pathway, pen, params={}) => eng.run({ seed, subsidy: sub, pathway, penetration: pen, params });
const boost = (fe, zn, pr, va=0) => ({ factor_fe: 1+fe/100, factor_zn: 1+zn/100, factor_prot: 1+pr/100, gunaratna_effect_size: 0.09*pr/94, lystrp_scale: pr/94, va_fraction: va/100 });
const K = ['stunting_pct','n_stunting_averted','iron_inad_pct','zinc_inad_pct','protein_inad_pct','va_inad_pct','va_inad_pct_baseline','mean_va','mean_va_baseline'];
const show = (lab, r) => console.log(lab.padEnd(34), K.map(k=>`${k.replace('_pct','')}=${(+r.national[k]).toFixed(k.startsWith('n_')?0:3)}`).join(' '));
let t=performance.now();
for (const pw of ['pco','pma']) {
  const a = run(pw, 0.5), b = run(pw, 0.5, boost(19,38,94));
  show(pw+' replica default', a); show(pw+' sliders at 19/38/94', b);
  let maxd = 0; for (const k of Object.keys(a.national)) if (typeof a.national[k]==='number' && !k.startsWith('va') && !k.includes('_va')) maxd = Math.max(maxd, Math.abs(a.national[k]-b.national[k]) / Math.max(1e-12,Math.abs(a.national[k])));
  for (let i=0;i<a.departments.length;i++) for (const k of Object.keys(a.departments[i])) { const x=a.departments[i][k], y=b.departments[i][k]; if (typeof x==='number' && !Number.isNaN(x)) maxd=Math.max(maxd, Math.abs(x-y)/Math.max(1e-12,Math.abs(x))); }
  console.log('   max rel diff default vs explicit sliders:', maxd);
  show(pw+' all zero', run(pw, 0.5, boost(0,0,0)));
  show(pw+' Fe only 19', run(pw, 0.5, boost(19,0,0)));
  show(pw+' Zn only 38', run(pw, 0.5, boost(0,38,0)));
  show(pw+' prot only 94', run(pw, 0.5, boost(0,0,94)));
  show(pw+' all 100 + VA 100', run(pw, 0.5, boost(100,100,100,100)));
  show(pw+' VA 100 only', run(pw, 0.5, boost(0,0,0,100)));
  show(pw+' 100% pen, all 100 + VA', run(pw, 1, boost(100,100,100,100)));
}
console.log('ms/run', ((performance.now()-t)/18).toFixed(0));
// dLT sanity
const P = nutB.nutrition.pathways.pco, X=P.factor_inputs.cols, NP=P.factor_inputs.ni_params, M={k_t:2.42,a:0.633,e:0.311};
const taz=(zn,age)=>{const a=M.a*Math.pow(age,M.e), s=M.k_t+a+zn; return 0.5*(s-Math.sqrt(s*s-4*a*zn));};
const zfe=fe=>(fe*0.05-NP.fe_absorbed_mean)/NP.fe_absorbed_sd, zt=(zn,age)=>(taz(zn,age)-NP.taz_mean)/NP.taz_sd;
let neg=0, xs=[], ys=[];
for (let i=0;i<P.n;i++){ const age=P.cols.age[i]; const dLT=4*(X.ni_q[i]-X.ni_b[i])-(zfe(X.fe_n[i]+X.fe_m[i]*0.19)-zfe(X.fe_n[i]))-(zt(X.zn_n[i]+X.zn_m[i]*0.38,age)-zt(X.zn_n[i],age)); if (dLT<-1e-9) neg++; xs.push(X.pr_m[i]); ys.push(dLT); }
const mean=a=>a.reduce((s,v)=>s+v,0)/a.length, mx=mean(xs), my=mean(ys);
const cov=xs.reduce((s,v,i)=>s+(v-mx)*(ys[i]-my),0), r=cov/Math.sqrt(xs.reduce((s,v)=>s+(v-mx)**2,0)*ys.reduce((s,v)=>s+(v-my)**2,0));
console.log(`dLT: n=${P.n} negative=${neg} corr(pr_m, dLT)=${r.toFixed(4)} mean dLT=${my.toFixed(3)} ratio dLT/pr_m (min,max)=`, Math.min(...ys.map((y,i)=>y/xs[i]).filter(Number.isFinite)).toFixed(4), Math.max(...ys.map((y,i)=>y/xs[i]).filter(Number.isFinite)).toFixed(4));
