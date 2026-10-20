/* 地形形态回归测试：11 套形态 × 6 种对称 × 4 种尺寸 × 3 个种子，检查无异常、严格对称、取值合法、没有被悬崖围死的区域。
 * 用法：node tools/shape-sweep.js */
const TS=require('../app/src/main/assets/terrain-shapes.js');
const modes=['none','vertical','horizontal','both','diagonal1','diagonal2'];
let bad=0,cnt=0,t0=Date.now();
for (const s of TS.SHAPES) for (const m of modes) for (const [w,h] of [[80,80],[160,120],[200,200],[57,91]]) for (const seed of [1,99,31337]) {
  cnt++;
  let r; try { r=TS.build({shape:s.id,width:w,height:h,seed,mirror:m,land:[.35,.5,.65][seed%3],rough:[0,.3,.8][seed%3]}); } catch(e){ bad++; console.log('EXC',s.id,m,w,h,seed,e.stack); continue; }
  const src=TS.mirrorSource(m,w,h); let asym=0;
  if (src) for (let k=0;k<w*h;k++) if (r.data[k]!==r.data[src(k)]) asym++;
  const vals=new Set(r.data);
  for (const v of vals) if (![0,1,2,-2].includes(v)) { bad++; console.log('val',v); }
  if (asym||r.stats.sealedPockets) { bad++; console.log('FAIL',s.id,m,w,h,seed,'asym',asym,'pockets',r.stats.sealedPockets); }
}
console.log('cases',cnt,'bad',bad,'time',Date.now()-t0,'ms');
