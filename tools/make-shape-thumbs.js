/* 生成「地形形态」卡片缩略图的原始像素（node tools/make-shape-thumbs.js > thumbs.json），再由 make-shape-thumbs.py 写成 PNG。
 * 缩略图使用推荐尺寸、种子 42、推荐对称方式，经完整的可对战化后处理。 */
const TS = require('../app/src/main/assets/terrain-shapes.js');
// 3.25.0：山湖 / 火山 / 两岸的水体随陆地比例缩放，50% 时缩略图几乎被湖 / 岩浆占满，改用更能体现形态特征的比例
const THUMB_LAND = { mountain_lake: 0.7, volcano: 0.75, two_sides: 0.6 };
const out = TS.SHAPES.map(s => {
  const r = TS.preview({ shape: s.id, width: s.size[0], height: s.size[1], seed: 42, mirror: s.mirror, land: THUMB_LAND[s.id] ?? 0.5 }, 96);
  const rgba = TS.paint(r.view, r.width, r.height, new Uint8Array(r.width * r.height * 4));
  return { id: s.id, w: r.width, h: r.height, rgba: Buffer.from(rgba).toString('base64') };
});
process.stdout.write(JSON.stringify(out));
