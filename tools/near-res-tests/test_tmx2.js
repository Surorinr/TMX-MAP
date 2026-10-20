const fs = require('fs');
const path = require('path');
const { patchTmxItems, itemTileInfo } = require('./extracted.js');

async function main() {
  let failures = 0;
  const dir = path.join(__dirname, '../../app/src/main/assets/blueprints');
  for (const f of fs.readdirSync(dir).filter(x => x.endsWith('.tmx'))) {
    const xml = fs.readFileSync(`${dir}/${f}`, 'utf-8');
    const { resGids, cliffRange } = itemTileInfo(xml);
    const ok = resGids.has(12) && resGids.size === 1;
    console.log(f, 'itemTileInfo resGids=', [...resGids], 'cliffRange=', cliffRange, ok ? 'OK' : 'MISMATCH (expected only GID 12)');
    if (!ok) failures++;
  }

  // gzip-compressed Items layer round trip
  const rows = 8, cols = 8;
  const tilesetXml = fs.readFileSync(`${dir}/generator_blueprint1.tmx`, 'utf-8').match(/<tileset firstgid="1" name="export_items".*?<\/tileset>/s)[0];
  const cells = new Uint32Array(rows * cols);
  const bytes = new Uint8Array(cells.buffer);
  const gz = await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer();
  const b64 = Buffer.from(gz).toString('base64');
  const tmxStr = `<?xml version="1.0" encoding="UTF-8"?>
<map version="1.10" orientation="orthogonal" width="${cols}" height="${rows}" tilewidth="20" tileheight="20" infinite="0">
${tilesetXml}
<layer id="1" name="Items" width="${cols}" height="${rows}">
<data encoding="base64" compression="gzip">
${b64}
</data>
</layer>
</map>`;
  const tmxBytes = new TextEncoder().encode(tmxStr);
  const addPoints = [[4,4]];
  const r = await patchTmxItems(tmxBytes, addPoints);
  if (!r.changed) { console.log('gzip patchTmxItems FAILED: no change'); failures++; }
  else {
    // decode back to verify
    const outXml = new TextDecoder().decode(r.tmx);
    const m = outXml.match(/<data encoding="base64" compression="gzip">([\s\S]*?)<\/data>/);
    const packed = Buffer.from(m[1].trim(), 'base64');
    const raw = await new Response(new Blob([packed]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
    const outCells = new Uint32Array(raw);
    let ok = true;
    const expect = [[1,2,3],[11,12,13],[21,22,23]];
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      const got = outCells[(4+dr)*cols + (4+dc)];
      if (got !== expect[dr+1][dc+1]) { ok = false; console.log(`gzip mismatch at (${4+dr},${4+dc}): got ${got} expected ${expect[dr+1][dc+1]}`); }
    }
    console.log('patchTmxItems round-trip (gzip):', ok ? 'OK' : 'FAILED');
    if (!ok) failures++;
  }
  console.log(failures ? `\n${failures} FAILURE(S)` : '\nALL TESTS PASSED');
  process.exit(failures ? 1 : 0);
}
main();
