const { keyOf, planNearSpawnResources, groupSpawnOrbits, detectFlip, S } = require('./extracted.js');

function makeFlatMap(rows, cols) {
  const data = new Int32Array(rows * cols).fill(1); // all land
  return { meta: { hill_drawing_mode: 'brush' }, resource_positions: [], matrices: { height_map: { shape: [rows, cols], data } } };
}
function makeMapWithWater(rows, cols, waterFn) {
  const data = new Int32Array(rows * cols);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) data[r*cols+c] = waterFn(r,c) ? 0 : 1;
  return { meta: { hill_drawing_mode: 'brush' }, resource_positions: [], matrices: { height_map: { shape: [rows, cols], data } } };
}

let failures = 0;
function check(name, cond, detail) {
  if (!cond) { failures++; console.log('FAIL:', name, detail || ''); }
  else console.log('ok  :', name);
}

// --- Test 1: basic distance constraint on a flat open map, single spawn ---
{
  const s = makeFlatMap(60, 60);
  const spawns = [[30, 30]];
  const { added, tier } = planNearSpawnResources(s, spawns, {});
  check('T1 single spawn gets perSpawn points', added.length === 2, `got ${added.length}, tier=${tier}`);
  for (const a of added) {
    const d = Math.hypot(a.p[0]-30, a.p[1]-30);
    check(`T1 distance in [10,20] for ${a.p}`, d >= 10 - 1e-9 && d <= 20 + 1e-9, `d=${d}`);
  }
  // no duplicate cells
  const keys = new Set(added.map(a => keyOf(a.p)));
  check('T1 no duplicate points', keys.size === added.length);
}

// --- Test 2: two spawns horizontally mirrored, check mirrored resource points are also mirrored ---
{
  const rows = 80, cols = 80;
  const s = makeFlatMap(rows, cols);
  const spawns = [[10, 40], [69, 40]]; // horizontal flip of each other: rows-1-10=69
  const f = detectFlip(spawns[0], spawns[1], rows, cols);
  check('T2 detectFlip finds horizontal', f === 'h', `got ${f}`);
  const groups = groupSpawnOrbits(spawns, rows, cols);
  check('T2 groups into one orbit', groups.length === 1 && groups[0].length === 2, JSON.stringify(groups));
  const { added } = planNearSpawnResources(s, spawns, {});
  check('T2 total added = 4 (2 per spawn)', added.length === 4, `got ${added.length}`);
  const forSpawn0 = added.filter(a => a.owner === 0).map(a => a.p);
  const forSpawn1 = added.filter(a => a.owner === 1).map(a => a.p);
  check('T2 2 points each', forSpawn0.length === 2 && forSpawn1.length === 2, `${forSpawn0.length}/${forSpawn1.length}`);
  // each spawn1 point should be the horizontal-flip of the corresponding spawn0 point
  let mirrored = true;
  for (let i = 0; i < forSpawn0.length; i++) {
    const [r, c] = forSpawn0[i];
    const expect = [rows - 1 - r, c];
    const hit = forSpawn1.some(p => p[0] === expect[0] && p[1] === expect[1]);
    if (!hit) mirrored = false;
  }
  check('T2 spawn1 points are exact mirror of spawn0 points', mirrored, JSON.stringify({forSpawn0, forSpawn1}));
}

// --- Test 3: small map where 10-20 range mostly falls outside bounds -> tiered fallback still returns something ---
{
  const s = makeFlatMap(18, 18); // max distance within map is small, corner spawn
  const spawns = [[2, 2]];
  const { added, tier } = planNearSpawnResources(s, spawns, {});
  console.log('T3 small map tight corner: added=', added.length, 'tier=', tier);
  // Not asserting success here (18x18 at corner may genuinely have little room within [10,20] from (2,2) and edgeMargin 1) — just must not throw and must not duplicate/invalid distances if any found
  for (const a of added) {
    const d = Math.hypot(a.p[0]-2, a.p[1]-2);
    check(`T3 distance in range for ${a.p}`, d >= 10 - 1e-9 && d <= 20 + 1e-9, `d=${d}`);
  }
}

// --- Test 4: many spawns (50) on a large map, all symmetry-free ('none' equivalent since no mirroring passed) ---
{
  const rows = 500, cols = 500;
  const s = makeFlatMap(rows, cols);
  const spawns = [];
  for (let i = 0; i < 50; i++) spawns.push([30 + (i % 10) * 45, 30 + Math.floor(i / 10) * 90]);
  const t0 = Date.now();
  const { added, tier } = planNearSpawnResources(s, spawns, {});
  const ms = Date.now() - t0;
  check('T4 50 spawns all got points', spawns.every((_, i) => added.filter(a => a.owner === i).length >= 1), `counts=${spawns.map((_,i)=>added.filter(a=>a.owner===i).length).join(',')}`);
  console.log(`T4 perf: 50 spawns on 500x500 took ${ms}ms, tier=${tier}, added=${added.length}`);
  check('T4 reasonably fast (<3000ms)', ms < 3000, `${ms}ms`);
  // check global no-overlap (min separation)
  let sepOk = true;
  for (let i = 0; i < added.length; i++) for (let j = i+1; j < added.length; j++) {
    const d = Math.hypot(added[i].p[0]-added[j].p[0], added[i].p[1]-added[j].p[1]);
    if (d < 3.9) { sepOk = false; }
  }
  check('T4 min separation between resource points held', sepOk);
}

// --- Test 5: huge map (2000x2000), moderate spawn count, perf sanity (user's stated worst case) ---
{
  const rows = 2000, cols = 2000;
  const s = makeFlatMap(rows, cols);
  const spawns = [];
  for (let i = 0; i < 20; i++) spawns.push([200 + (i % 5) * 380, 200 + Math.floor(i / 5) * 380]);
  const t0 = Date.now();
  const { added } = planNearSpawnResources(s, spawns, {});
  const ms = Date.now() - t0;
  console.log(`T5 perf: 20 spawns on 2000x2000 took ${ms}ms, added=${added.length}`);
  check('T5 fast on huge map (local BFS, not full-map)', ms < 3000, `${ms}ms`);
  check('T5 all spawns satisfied', spawns.every((_, i) => added.filter(a => a.owner === i).length === 2));
}

// --- Test 6: spawn near water — BFS reachability should avoid placing points across an unreachable lake ---
{
  const rows = 60, cols = 60;
  // vertical lake splitting the map in half from col 28..31
  const s = makeMapWithWater(rows, cols, (r,c) => c >= 28 && c <= 31);
  const spawns = [[30, 10]]; // left side, lake blocks reaching the right side
  const { added, tier } = planNearSpawnResources(s, spawns, {});
  console.log('T6 spawn near lake: added=', JSON.stringify(added.map(a=>a.p)), 'tier=', tier);
  // every added point should be on the same (left) side, i.e. col < 28, OR flagged as non-'A' tier (relaxed reachability)
  const allLeftOrRelaxed = tier !== 'A' || added.every(a => a.p[1] < 28);
  check('T6 reachability respected at tier A, or tier correctly downgraded', allLeftOrRelaxed, JSON.stringify({tier, added: added.map(a=>a.p)}));
}

// --- Test 7: existing resource already in range should reduce how many new ones get added ---
{
  const s = makeFlatMap(60, 60);
  s.resource_positions = [[30, 45]]; // distance 15 from spawn, within [10,20]
  const spawns = [[30, 30]];
  const { added } = planNearSpawnResources(s, spawns, {});
  check('T7 only adds 1 more (perSpawn=2, 1 already present)', added.length === 1, `got ${added.length}`);
}

// --- Test 8: perSpawn=4 config respected ---
{
  const s = makeFlatMap(60, 60);
  const spawns = [[30, 30]];
  const { added } = planNearSpawnResources(s, spawns, { perSpawn: 4 });
  check('T8 perSpawn=4 honored', added.length === 4, `got ${added.length}`);
}

console.log(failures ? `\n${failures} FAILURE(S)` : '\nALL ALGORITHM TESTS PASSED');
process.exit(failures ? 1 : 0);
