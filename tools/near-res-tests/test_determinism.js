const { planNearSpawnResources } = require('./extracted.js');
function makeFlatMap(rows, cols) {
  const data = new Int32Array(rows * cols).fill(1);
  return { meta: { hill_drawing_mode: 'brush' }, resource_positions: [], matrices: { height_map: { shape: [rows, cols], data } } };
}
const s1 = makeFlatMap(60, 60), s2 = makeFlatMap(60, 60);
const spawns = [[30, 30], [15, 45]];
const r1 = planNearSpawnResources(s1, spawns, {});
const r2 = planNearSpawnResources(s2, spawns, {});
const a = JSON.stringify(r1.added.map(a=>a.p));
const b = JSON.stringify(r2.added.map(a=>a.p));
console.log('run1:', a);
console.log('run2:', b);
console.log(a === b ? 'DETERMINISTIC: OK' : 'DETERMINISTIC: FAILED');
process.exit(a === b ? 0 : 1);
