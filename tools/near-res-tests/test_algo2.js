const { keyOf, planNearSpawnResources, groupSpawnOrbits, detectFlip } = require('./extracted.js');
function makeFlatMap(rows, cols) {
  const data = new Int32Array(rows * cols).fill(1);
  return { meta: { hill_drawing_mode: 'brush' }, resource_positions: [], matrices: { height_map: { shape: [rows, cols], data } } };
}
let failures = 0;
function check(name, cond, detail) { if (!cond) { failures++; console.log('FAIL:', name, detail || ''); } else console.log('ok  :', name); }

// Diagonal symmetry (square map required)
{
  const n = 80;
  const s = makeFlatMap(n, n);
  const spawns = [[10, 50], [50, 10]]; // diagonal1 flip: (c,r)
  const f = detectFlip(spawns[0], spawns[1], n, n);
  check('diag1 detected', f === 'd1', f);
  const { added } = planNearSpawnResources(s, spawns, {});
  const p0 = added.filter(a => a.owner === 0).map(a => a.p);
  const p1 = added.filter(a => a.owner === 1).map(a => a.p);
  let mirrored = p0.every(([r,c]) => p1.some(([r2,c2]) => r2 === c && c2 === r));
  check('diag1 mirror correct', mirrored, JSON.stringify({p0,p1}));
}

// 4-fold "both" symmetry with 4 spawns
{
  const rows = 100, cols = 100;
  const s = makeFlatMap(rows, cols);
  const spawns = [[20, 20], [79, 20], [20, 79], [79, 79]]; // h, v, both of spawn0
  const groups = groupSpawnOrbits(spawns, rows, cols);
  check('both: single group of 4', groups.length === 1 && groups[0].length === 4, JSON.stringify(groups));
  const { added } = planNearSpawnResources(s, spawns, {});
  check('both: each spawn gets 2', [0,1,2,3].every(i => added.filter(a=>a.owner===i).length === 2), added.map(a=>a.owner));
  const byOwner = i => added.filter(a=>a.owner===i).map(a=>a.p);
  const p0 = byOwner(0);
  // spawn1 = horizontal flip (rows-1-r, c); spawn2 = vertical flip (r, cols-1-c); spawn3 = both
  const okH = p0.every(([r,c]) => byOwner(1).some(([r2,c2]) => r2===rows-1-r && c2===c));
  const okV = p0.every(([r,c]) => byOwner(2).some(([r2,c2]) => r2===r && c2===cols-1-c));
  const okB = p0.every(([r,c]) => byOwner(3).some(([r2,c2]) => r2===rows-1-r && c2===cols-1-c));
  check('both: spawn1 is h-flip of spawn0', okH);
  check('both: spawn2 is v-flip of spawn0', okV);
  check('both: spawn3 is both-flip of spawn0', okB);
}

// Odd count: 5 spawns, 2 paired + 1 solo
{
  const rows = 80, cols = 80;
  const s = makeFlatMap(rows, cols);
  const spawns = [[10, 40], [69, 40], [10, 10], [69, 10], [40, 40]]; // last one unpaired (its h-flip (39,40) != any other spawn)
  const groups = groupSpawnOrbits(spawns, rows, cols);
  check('odd: 3 groups (2 pairs + 1 solo)', groups.length === 3, JSON.stringify(groups));
  const soloGroup = groups.find(g => g.length === 1);
  check('odd: solo group exists and is spawn index 4', soloGroup && soloGroup[0].idx === 4, JSON.stringify(soloGroup));
  const { added } = planNearSpawnResources(s, spawns, {});
  check('odd: all 5 spawns get points', [0,1,2,3,4].every(i => added.filter(a=>a.owner===i).length === 2), added.map(a=>a.owner));
}

// Asymmetric spawns entirely unrelated (mode 'none' equivalent, no accidental pairing)
{
  const rows = 100, cols = 100;
  const s = makeFlatMap(rows, cols);
  const spawns = [[10, 10], [85, 60], [40, 90]];
  const groups = groupSpawnOrbits(spawns, rows, cols);
  check('asymmetric: 3 solo groups', groups.every(g => g.length === 1) && groups.length === 3, JSON.stringify(groups));
}

console.log(failures ? `\n${failures} FAILURE(S)` : '\nALL SYMMETRY TESTS PASSED');
process.exit(failures ? 1 : 0);
