const fs = require('fs');
const path = require('path');
const { resourcePoolGids, patchTmxItems } = require('./extracted.js');

async function main() {
  const dir = path.join(__dirname, '../../app/src/main/assets/blueprints');
  let failures = 0;
  for (const f of fs.readdirSync(dir).filter(x => x.endsWith('.tmx'))) {
    const xml = fs.readFileSync(`${dir}/${f}`, 'utf-8');
    const block = resourcePoolGids(xml);
    const expect = [[1,2,3],[11,12,13],[21,22,23]];
    const ok = JSON.stringify(block) === JSON.stringify(expect);
    console.log(f, 'resourcePoolGids =', JSON.stringify(block), ok ? 'OK' : 'MISMATCH, expected ' + JSON.stringify(expect));
    if (!ok) failures++;
  }

  // Build a minimal synthetic TMX with an Items layer (csv-encoded) matching the real tileset structure,
  // to test patchTmxItems end-to-end (write GIDs, re-decode, confirm correct cells changed).
  const rows = 10, cols = 10;
  const itemsCsv = Array.from({length: rows}, () => Array(cols).fill(0).join(',')).join(',\n');
  const tilesetXml = fs.readFileSync(`${dir}/generator_blueprint1.tmx`, 'utf-8').match(/<tileset firstgid="1" name="export_items".*?<\/tileset>/s)[0];
  const tmxStr = `<?xml version="1.0" encoding="UTF-8"?>
<map version="1.10" orientation="orthogonal" width="${cols}" height="${rows}" tilewidth="20" tileheight="20" infinite="0">
${tilesetXml}
<layer id="1" name="Items" width="${cols}" height="${rows}">
<data encoding="csv">
${itemsCsv}
</data>
</layer>
</map>`;
  const tmxBytes = new TextEncoder().encode(tmxStr);
  const addPoints = [[3,3],[6,7]];
  const r = await patchTmxItems(tmxBytes, addPoints);
  if (!r.changed) { console.log('patchTmxItems FAILED: no change reported'); failures++; }
  else {
    const outXml = new TextDecoder().decode(r.tmx);
    const dataMatch = outXml.match(/<data encoding="csv">([\s\S]*?)<\/data>/);
    const vals = dataMatch[1].trim().split(/[\s,]+/).map(Number);
    let ok = true;
    for (const [pr, pc] of addPoints) {
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        const expectGid = [[1,2,3],[11,12,13],[21,22,23]][dr+1][dc+1];
        const got = vals[(pr+dr)*cols + (pc+dc)];
        if (got !== expectGid) { ok = false; console.log(`mismatch at (${pr+dr},${pc+dc}): got ${got} expected ${expectGid}`); }
      }
    }
    // also check a cell well away from both points is still 0 (untouched)
    if (vals[0] !== 0) { ok = false; console.log('untouched cell (0,0) was modified:', vals[0]); }
    console.log('patchTmxItems round-trip (csv):', ok ? 'OK' : 'FAILED');
    if (!ok) failures++;
  }

  console.log(failures ? `\n${failures} FAILURE(S)` : '\nALL TMX TESTS PASSED');
  process.exit(failures ? 1 : 0);
}
main();
