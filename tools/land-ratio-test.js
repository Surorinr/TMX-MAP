/* 陆地比例 / 模板形态专项回归（3.24.0 重写）：
 *   ① 每个模板 × 10/30/50/70/90% × 3 个种子：比例误差 ≤ ±2%、输出长度、默认对称严格镜像、无被山围死的空地；
 *   ② 保形：同一种子下 30% 的陆地有 ≥ 90% 仍是 70% 时的陆地（比例只让陆地单调扩张，不换一套形态）；
 *   ③ 模板特征：岛屿四边环海、半岛伸出、群岛多岛、双河三块、山湖中央湖 + 环形山、火山岩浆、迷宫高地墙、两岸中央水道；
 *   ④ 对称压力：全部模板 × 6 种镜像 × 10/50/90%，最终引擎矩阵逐格严格镜像。
 * 用法：node tools/land-ratio-test.js */
const TS = require('../app/src/main/assets/terrain-shapes.js');
const ratios = [0.1, 0.3, 0.5, 0.7, 0.9];
const seeds = [42, 777, 20240];
const failures = [];
let checks = 0, mirrorChecks = 0, maxErr = 0;
const isWater = v => v === TS.T.WATER || v === TS.T.DEEP || v === TS.T.SHALLOW;
const isLand = v => !isWater(v) && v !== TS.T.LAVA;
function components(view, w, h, pred) {
  const lab = new Int32Array(w * h), sizes = []; let id = 0;
  for (let s = 0; s < w * h; s++) {
    if (lab[s] || !pred(view[s])) continue;
    id++; let size = 0; const st = [s]; lab[s] = id;
    while (st.length) {
      const k = st.pop(); size++; const x = k % w, y = (k / w) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
        const q = yy * w + xx; if (!lab[q] && pred(view[q])) { lab[q] = id; st.push(q); }
      }
    }
    sizes.push(size);
  }
  return sizes;
}
const built = {};
for (const shape of TS.SHAPES) for (const seed of seeds) for (const land of ratios) {
  const [w, h] = shape.size;
  const tag = `${shape.id} seed=${seed} land=${land}`;
  let r;
  try { r = TS.build({ shape: shape.id, width: w, height: h, seed, mirror: shape.mirror, land, rough: 0.3 }); }
  catch (e) { failures.push(`${tag}: throw ${e?.stack || e}`); continue; }
  checks++;
  built[`${shape.id}|${seed}|${land}`] = r;
  const err = Math.abs(r.stats.landRatio - land); maxErr = Math.max(maxErr, err);
  if (!Number.isFinite(r.stats.landRatio) || err > 0.02) failures.push(`${tag}: actual=${r.stats.landRatio}, tolerance=±0.02`);
  if (r.data.length !== w * h || r.view.length !== w * h) failures.push(`${tag}: wrong output length`);
  const src = TS.mirrorSource(shape.mirror, w, h);
  if (src) { let asym = 0; for (let k = 0; k < w * h; k++) if (r.data[k] !== r.data[src(k)]) asym++; if (asym) failures.push(`${tag}: asymmetry=${asym}`); }
  if (r.stats.sealedPockets) failures.push(`${tag}: sealedPockets=${r.stats.sealedPockets}`);
  const V = r.view, at = (fx, fy) => V[Math.round((h - 1) * fy) * w + Math.round((w - 1) * fx)];
  const big = components(V, w, h, isLand).filter(s => s >= w * h * 0.004);
  switch (shape.id) {
    case 'island': {
      let shore = 0; for (let x = 0; x < w; x++) { if (isLand(V[x]) || isLand(V[(h - 1) * w + x])) shore++; }
      for (let y = 0; y < h; y++) { if (isLand(V[y * w]) || isLand(V[y * w + w - 1])) shore++; }
      if (shore) failures.push(`${tag}: island touches map border (${shore})`);
      if (big.length !== 1) failures.push(`${tag}: island landmasses=${big.length}`);
      break;
    }
    case 'peninsula': {
      // 大陆在左缘（推荐的上下对称），半岛沿水平中线伸出：中线 45% 处是陆地，尖端外侧是海
      if (!isLand(at(0.02, 0.5))) failures.push(`${tag}: mainland edge missing`);
      if (!isLand(at(0.45, 0.5))) failures.push(`${tag}: peninsula arm missing`);
      if (isLand(at(0.99, 0.5))) failures.push(`${tag}: peninsula tip not surrounded by sea`);
      if (land <= 0.5 && (isLand(at(0.45, 0.06)) || isLand(at(0.45, 0.94)))) failures.push(`${tag}: no sea beside peninsula`);
      break;
    }
    case 'archipelago':
      if (land <= 0.7 && big.length < 4) failures.push(`${tag}: only ${big.length} islands`);
      break;
    case 'river':
      if (big.length < 3) failures.push(`${tag}: rivers do not split land into three (${big.length})`);
      break;
    case 'mountain_lake': {
      let water = 0, mount = 0, ring = 0;
      for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) if (isWater(V[(Math.round((h - 1) / 2) + y) * w + Math.round((w - 1) / 2) + x])) water++;
      for (let a = 0; a < 64; a++) {
        const t = a / 64 * Math.PI * 2, v = V[Math.round((h - 1) / 2 * (1 + 0.43 * Math.sin(t))) * w + Math.round((w - 1) / 2 * (1 + 0.43 * Math.cos(t)))];
        ring++; if (v === TS.T.MOUNTAIN || v === TS.VIEW.RAMP) mount++;
      }
      if (water < 23) failures.push(`${tag}: central lake probe=${water}/25`);
      if (mount / ring < 0.45) failures.push(`${tag}: mountain ring only ${(mount / ring).toFixed(2)}`);
      break;
    }
    case 'volcano': {
      const lava = V.reduce((n, v) => n + (v === TS.T.LAVA ? 1 : 0), 0);
      if (lava < 40) failures.push(`${tag}: lava feature lost (${lava} cells)`);
      if (at(0.5, 0.5) !== TS.T.LAVA) failures.push(`${tag}: crater is not lava`);
      break;
    }
    case 'labyrinth':
      if (r.stats.mountainRatio < Math.min(0.12, r.stats.landRatio * 0.2)) failures.push(`${tag}: maze walls too few (mountain=${r.stats.mountainRatio})`);
      break;
    case 'two_sides': {
      let wateryRows = 0;
      for (let y = 0; y < h; y++) {
        let wv = 0; for (let x = Math.floor(w * 0.44); x <= Math.ceil(w * 0.56); x++) if (isWater(V[y * w + x])) wv++;
        if (wv) wateryRows++;
      }
      if (wateryRows < h * 0.6) failures.push(`${tag}: central channel only intersects ${wateryRows}/${h} rows`);
      if (land <= 0.5 && (isLand(at(0.01, 0.5)) || isLand(at(0.99, 0.5)))) failures.push(`${tag}: outer sides should be sea`);
      if (r.stats.landmasses > 1 && land >= 0.3) failures.push(`${tag}: banks not joined by crossings (${r.stats.landmasses})`);
      break;
    }
  }
}
// ② 保形：低比例陆地应基本包含在高比例陆地内
for (const shape of TS.SHAPES) for (const seed of seeds) {
  const lo = built[`${shape.id}|${seed}|0.3`], hi = built[`${shape.id}|${seed}|0.7`];
  if (!lo || !hi) continue;
  let a = 0, both = 0;
  for (let k = 0; k < lo.data.length; k++) if (lo.data[k] !== 0) { a++; if (hi.data[k] !== 0) both++; }
  if (both / a < 0.9) failures.push(`${shape.id} seed=${seed}: 30% land only ${(both / a * 100).toFixed(1)}% contained in 70% land`);
}
// ④ 对称压力
const modes = ['none', 'vertical', 'horizontal', 'both', 'diagonal1', 'diagonal2'];
for (const shape of TS.SHAPES) for (const mirror of modes) for (const land of [0.1, 0.5, 0.9]) {
  mirrorChecks++;
  const w = 80, h = 80;
  try {
    const r = TS.build({ shape: shape.id, width: w, height: h, seed: 42, mirror, land, rough: 0.35 });
    const source = TS.mirrorSource(mirror, w, h);
    if (source) { let asym = 0; for (let k = 0; k < w * h; k++) if (r.data[k] !== r.data[source(k)]) asym++; if (asym) failures.push(`${shape.id} mirror=${mirror} land=${land}: asymmetry=${asym}`); }
    if (Math.abs(r.stats.landRatio - land) > 0.03) failures.push(`${shape.id} mirror=${mirror} land=${land}: actual=${r.stats.landRatio}`);
  } catch (e) { failures.push(`${shape.id} mirror=${mirror} land=${land}: throw ${e?.message || e}`); }
}
console.log(`land-ratio checks=${checks}, mirror checks=${mirrorChecks}, max ratio error=${(maxErr * 100).toFixed(2)}%, failures=${failures.length}`);
for (const f of failures) console.log('FAIL', f);
if (failures.length) process.exitCode = 1;
