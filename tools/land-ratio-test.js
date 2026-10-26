/* 陆地比例 / 模板形态专项回归（3.24.0 重写，3.25.0 更新「参照物」断言）：
 *   ① 每个模板 × 10/30/50/70/90% × 3 个种子：比例误差 ≤ ±2%、输出长度、默认对称严格镜像、无被山围死的空地；
 *   ② 保形：同一种子下 30% 的陆地有 ≥ 90% 仍是 70% 时的陆地（比例只让陆地单调扩张，不换一套形态）；
 *   ③ 模板特征：岛屿四边环海、半岛伸出、群岛多岛、双河三块、迷宫高地墙；
 *      3.25.0 参照物：山湖的水全部是中央湖（四周一圈完整陆地）+ 环形山贴着湖岸；火山的非陆地全部是岩浆（无海）+ 火山锥；
 *      两岸的水全部是中央水道（两岸延伸到图边）+ 中间渡口始终相通；
 *   ⑤ 参照物单调：同一种子下中央湖 / 火口 / 中央水道的面积随陆地比例增大而严格减小；
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
/** 中心连通的非陆地块占全部非陆地的比例（4 邻接） */
function centralShare(view, w, h, pred) {
  const c = Math.round((h - 1) / 2) * w + Math.round((w - 1) / 2);
  let total = 0; for (let k = 0; k < w * h; k++) if (pred(view[k])) total++;
  if (!total || !pred(view[c])) return 0;
  const seen = new Uint8Array(w * h), st = [c]; seen[c] = 1; let n = 0;
  while (st.length) {
    const k = st.pop(); n++; const x = k % w, y = (k / w) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
      const q = yy * w + xx; if (!seen[q] && pred(view[q])) { seen[q] = 1; st.push(q); }
    }
  }
  return n / total;
}
/** 图边一圈格子中陆地的比例 */
function borderLand(view, w, h) {
  let n = 0, l = 0;
  for (let x = 0; x < w; x++) for (const y of [0, h - 1]) { n++; if (isLand(view[y * w + x])) l++; }
  for (let y = 1; y < h - 1; y++) for (const x of [0, w - 1]) { n++; if (isLand(view[y * w + x])) l++; }
  return l / n;
}
/** 沿 64 条射线从图心向外走，找到第一格陆地后在 reach 格内是否遇到山地 / 坡道：返回命中射线的比例（检查山环贴着岸线） */
function shoreRing(view, w, h, reach) {
  let hit = 0;
  const cx = (w - 1) / 2, cy = (h - 1) / 2;
  for (let a = 0; a < 64; a++) {
    const t = (a + 0.5) / 64 * Math.PI * 2, dx = Math.cos(t), dy = Math.sin(t);
    let r = 0, land = -1;
    for (; r < Math.max(w, h); r += 0.5) {
      const x = Math.round(cx + dx * r), y = Math.round(cy + dy * r);
      if (x < 0 || y < 0 || x >= w || y >= h) break;
      const v = view[y * w + x];
      if (land < 0) { if (isLand(v)) land = r; continue; }
      if (r - land > reach) break;
      if (v === TS.T.MOUNTAIN || v === TS.VIEW.RAMP) { hit++; break; }
    }
  }
  return hit / 64;
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
      // 参照物：陆地 ↔ 中央湖。水全部是中央湖，图边一圈都是陆地；陆地 ≥ 30% 时环形山贴着湖岸
      let water = 0;
      for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) if (isWater(V[(Math.round((h - 1) / 2) + y) * w + Math.round((w - 1) / 2) + x])) water++;
      if (water < 23) failures.push(`${tag}: central lake probe=${water}/25`);
      const cs = centralShare(V, w, h, isWater);
      if (cs < 0.97) failures.push(`${tag}: water is not one central lake (share ${cs.toFixed(3)})`);
      const bl = borderLand(V, w, h);
      if (bl < 0.98) failures.push(`${tag}: outer ring not land (${bl.toFixed(3)})`);
      if (land >= 0.3) { const ring = shoreRing(V, w, h, Math.max(8, w * (1 - land) * 0.2)); if (ring < 0.5) failures.push(`${tag}: mountain ring off the lake shore (${ring.toFixed(2)})`); }
      if (big.length !== 1) failures.push(`${tag}: land split into ${big.length} pieces`);
      break;
    }
    case 'volcano': {
      // 参照物：火山 ↔ 周围陆地。非陆地全部是岩浆（不再有海），图边一圈是陆地，火口为岩浆；陆地 ≥ 50% 时有火山锥
      let lava = 0, sea = 0;
      for (const v of V) { if (v === TS.T.LAVA) lava++; else if (isWater(v)) sea++; }
      if (sea) failures.push(`${tag}: ${sea} sea cells (non-land must be lava)`);
      if (at(0.5, 0.5) !== TS.T.LAVA) failures.push(`${tag}: crater is not lava`);
      const share = lava / (w * h), expect = 1 - r.stats.landRatio;
      if (Math.abs(share - expect) > 0.005) failures.push(`${tag}: lava ${share.toFixed(3)} != 1 - land ${expect.toFixed(3)}`);
      const cs = centralShare(V, w, h, v => v === TS.T.LAVA);
      if (cs < 0.97) failures.push(`${tag}: lava is not one central volcano (share ${cs.toFixed(3)})`);
      const bl = borderLand(V, w, h);
      if (bl < 0.98) failures.push(`${tag}: outer ring not land (${bl.toFixed(3)})`);
      if (land >= 0.5) { const ring = shoreRing(V, w, h, Math.max(8, w * (1 - land) * 0.25)); if (ring < 0.35) failures.push(`${tag}: volcanic cone missing (${ring.toFixed(2)})`); }
      if (big.length !== 1) failures.push(`${tag}: land split into ${big.length} pieces`);
      break;
    }
    case 'labyrinth':
      if (r.stats.mountainRatio < Math.min(0.12, r.stats.landRatio * 0.2)) failures.push(`${tag}: maze walls too few (mountain=${r.stats.mountainRatio})`);
      break;
    case 'two_sides': {
      // 参照物：两岸陆地 ↔ 中央水道。水道居中贯通，两岸一直延伸到左右图边，水全部属于中央水道，中间渡口始终相通
      let wateryRows = 0;
      for (let y = 0; y < h; y++) {
        let wv = 0; for (let x = Math.floor(w * 0.44); x <= Math.ceil(w * 0.56); x++) if (isWater(V[y * w + x])) wv++;
        if (wv) wateryRows++;
      }
      if (wateryRows < h * 0.6) failures.push(`${tag}: central channel only intersects ${wateryRows}/${h} rows`);
      let edgeL = 0, edgeR = 0;
      for (let y = 0; y < h; y++) { if (isLand(V[y * w])) edgeL++; if (isLand(V[y * w + w - 1])) edgeR++; }
      if (edgeL < h * 0.95 || edgeR < h * 0.95) failures.push(`${tag}: banks do not reach the map sides (${edgeL}/${edgeR} of ${h})`);
      // 渡口把水道切成几段：所有与中线相交的水体合计应占全部水面的 97% 以上（没有外海 / 岸上大湖）
      let wt = 0, wcen = 0;
      { const seen = new Uint8Array(w * h), cx = Math.round((w - 1) / 2);
        for (let k = 0; k < w * h; k++) if (isWater(V[k])) wt++;
        for (let y = 0; y < h; y++) { const s0 = y * w + cx; if (seen[s0] || !isWater(V[s0])) continue;
          const st = [s0]; seen[s0] = 1;
          while (st.length) { const k = st.pop(); wcen++; const x = k % w, yy = (k / w) | 0;
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = x + dx, y2 = yy + dy; if (xx < 0 || y2 < 0 || xx >= w || y2 >= h) continue;
              const q = y2 * w + xx; if (!seen[q] && isWater(V[q])) { seen[q] = 1; st.push(q); } } } } }
      if (wt && wcen / wt < 0.97) failures.push(`${tag}: water is not the central channel (${(wcen / wt).toFixed(3)})`);
      if (r.stats.landmasses > 1) failures.push(`${tag}: banks not joined by crossings (${r.stats.landmasses})`);
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
// ⑤ 参照物单调：中央湖 / 火口 / 中央水道的面积随陆地比例增大而严格减小（其余水体也不应反向变化）
for (const id of ['mountain_lake', 'volcano', 'two_sides', 'river', 'desert']) for (const seed of seeds) {
  let prev = Infinity;
  for (const land of ratios) {
    const r = built[`${id}|${seed}|${land}`]; if (!r) continue;
    let wet = 0; for (const v of r.view) if (!isLand(v)) wet++;
    if (wet >= prev) failures.push(`${id} seed=${seed}: water/lava area not decreasing at land=${land} (${wet} >= ${prev})`);
    prev = wet;
  }
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
