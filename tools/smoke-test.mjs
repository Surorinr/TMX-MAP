/**
 * TMX MapForge Offline · 跨平台静态冒烟测试（3.17.0 起，3.24.0 更新形态模板锚点，3.25.0 增加比例参照物锚点）
 * 检查本地资产可服务、关键 UI / 版本锚点存在、资源可读取、路径穿越被拒绝。
 * 不依赖 Chrome / Playwright；不等价于真实浏览器或真机交互测试。
 * 用法：node tools/smoke-test.mjs
 */
import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { extname, relative, isAbsolute, resolve, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', 'app', 'src', 'main', 'assets');
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png',
  '.svg': 'image/svg+xml', '.tmx': 'application/xml', '.wasm': 'application/wasm',
  '.ico': 'image/x-icon'
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://127.0.0.1');
    let p;
    try { p = decodeURIComponent(url.pathname).replace(/^[/\\]+/, ''); }
    catch { res.writeHead(400); res.end('bad path'); return; }
    if (!p || p === '.') p = 'index.html';
    const file = resolve(ROOT, p);
    const rel = relative(ROOT, file);
    if (rel === '..' || rel.startsWith('..' + sep) || isAbsolute(rel)) {
      res.writeHead(403); res.end('forbidden'); return;
    }
    if (!existsSync(file)) { res.writeHead(404); res.end('not found'); return; }
    const data = await readFile(file);
    res.writeHead(200, { 'Content-Type': MIME[extname(file).toLowerCase()] || 'application/octet-stream' });
    res.end(data);
  } catch (e) {
    res.writeHead(500); res.end(String(e?.message || e));
  }
});

await new Promise((resolveListen, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', resolveListen);
});
const base = `http://127.0.0.1:${server.address().port}`;
let failed = 0;
function check(name, ok) {
  console.log(`${ok ? 'ok  ' : 'FAIL'} : ${name}`);
  if (!ok) failed++;
}
try {
  const [htmlRes, appRes, cssRes, workerRes, shapeWorkerRes, tsRes, wasmRes, traversalRes] = await Promise.all([
    fetch(`${base}/index.html`), fetch(`${base}/app.js`), fetch(`${base}/style.css`),
    fetch(`${base}/worker.js`), fetch(`${base}/shape-worker.js`), fetch(`${base}/terrain-shapes.js`),
    fetch(`${base}/wasm-pkg/rust_map_gen_bg.wasm`),
    fetch(`${base}/%2e%2e%2fAndroidManifest.xml`)
  ]);
  const [html, app, css, worker, shapeWorker, ts] = await Promise.all([
    htmlRes.text(), appRes.text(), cssRes.text(), workerRes.text(), shapeWorkerRes.text(), tsRes.text()
  ]);
  check('首页通过本地 HTTP 正常提供', htmlRes.status === 200 && html.includes('<html'));
  check('前端版本为 v3.25.0', app.includes("const APP_VERSION = '3.25.0'") && app.includes('const PROJECT_FORMAT = 3250'));
  // 3.25.0：陆地比例按参照物调节（山湖 ↔ 中央湖、火山 ↔ 周围陆地、两岸 ↔ 中央水道），沿岸骨架随水体缩放
  check('3.25.0 模板定义比例参照物 / 沿岸骨架 / 熔岩流反函数', ["ref: '中央湖'", "ref: '火山（岩浆）'", "ref: '中央水道'", 'const RING = {', 'function radBlend', 'const flowInv = R =>', "hole = shape === 'volcano' ? T.LAVA : T.WATER"].every(k => ts.includes(k)));
  check('3.25.0 界面显示比例参照 / 配方码格式版本 3 并识别重做模板的旧码', html.includes('id="shapeLandRef"') && app.includes("$('shapeLandRef').textContent") && app.includes('const RECIPE_VERSION = 3') && app.includes('RECIPE_SHAPES_V3.includes(d.shape)'));
  // 3.24.1：全量审查修复锚点
  check('3.24.1 形态种子按生成器规则折叠 / 配方码格式版本 2 且识别旧版形态码', app.includes('TerrainShapes.normSeed(v)') && app.includes('u8(RECIPE_VERSION)') && app.includes('(b[0] < 2 ||'));
  check('3.24.1 模板场与比例无关并缓存 / 参数 NaN 防护 / 对角对称步长', ts.includes('const FIELD_CACHE_MAX = 160000') && !ts.includes('waterFrac') && ts.includes('const unit = (v, def)') && ts.includes('const cellQ = cellMin / (fr.E * fr.E)'));
  check('3.24.1 陆地比例滑块说明语义', html.includes('只改变陆地的多少'));
  check('3.21.0 陆地占比全路径为 10～90', [
    "shapeState.land = clamp(+s.land, 10, 90)",
    "shapeState.land = clamp(Number($('shapeLand').value) || 50, 10, 90)",
    "shapeState.land = clamp(+p.shape.land, 10, 90)",
    "shapeState.land = clamp(+q.land, 10, 90)",
    'clamp(Math.round(Number(d.land) || 50), 10, 90)',
    'd.land >= 10 && d.land <= 90',
    '10 + Math.floor(Math.random() * 81)'
  ].every(k => app.includes(k)) && html.includes('id="shapeLand" type="range" min="10" max="90"'));
  // 3.24.0：模板层重写 —— 比例无关的陆地优先级场 + 精确选格；旧的 50% 基准图形态学缩放已移除。
  check('3.24.0 模板场 / 精确选格锚点存在', ['function templateFields', 'function setupTemplate', 'function selectLand', 'function categoriesFromFields', 'function frameOf', 'function mazeWallDist', 'function prepareShape', 'function finishShape', "const API = { VERSION: '1.3'"].every(k => ts.includes(k)));
  check('3.24.0 生成流程：模板场只算一次、比例只驱动选格', ts.includes('const pr = prepareShape(o)') && ts.includes('const r = finishShape(pr, goal)') && ts.includes('const targetN = Math.round(clamp01(targetLand) * n)'));
  check('3.24.0 旧的基准图形态学缩放已移除', !['function adjustLandRatio', 'function heightMap', 'land: 0.5, shape: meta.id', 'protectedWater.fill(0)'].some(k => ts.includes(k)));
  check('3.24.0 双河 / 两岸不自动搭浅滩（结构水域贯通）', /id: 'river'[^\n]*bridge: false/.test(ts) && /id: 'two_sides'[^\n]*bridge: false/.test(ts));
  // 3.20.0：第十八轮审查修复 + 新功能
  check('3.20.0 修复锚点存在（未完成地图不写回出生点 / 导出补完或载入 / 载荷不混存 / 槽位可扩展判断 / FFA 全新布局从正上方编号）', ['function mapUnfinished', 'if (mapUnfinished()) return;', 'function finishRemainingSteps', "delete p.spawnPositions", 'function ccExtendableCap', '{ fresh: true }'].every(k => app.includes(k)));
  check('3.20.0 新功能锚点与控件存在（公平度微调 / 落点热力 / 对称修复）', ['function tuneFairness', 'function optimizeSpawnLayout', 'function mirrorGroups', 'function analyzeSpots', 'function repairSpawnSymmetry'].every(k => app.includes(k)) && ['id="spawnTune"', 'id="layerSpots"'].every(k => html.includes(k)) && ['.chip-spots', '.tune-btn', '.gauge-pop'].every(k => css.includes(k)));
  // 3.19.0：第十七轮审查修复 + 100 人 / 新预设 / FFA + 新功能
  check('3.19.0 修复锚点存在（半成品地图回滚 / 配方码以地图生成参数为准 / 引擎槽位上限）', ['function restoreAfterAbort', 'function recipeFrom', 'S.mapRecipe = recipeFrom(p, S.mapShape)', 'const ENGINE_MAX_CC = 50', 'function extendCcTileset'].every(k => app.includes(k)));
  check('3.19.0 出生点上限 100、预设去掉 25V25、新增 30V30 / 40V40 / 50V50 / FFA', app.includes('const MAX_SPAWN_POINTS = 100') && /id="players"[^>]*max="100"/.test(html) && !html.includes('value="25v25"') && ['30v30', '40v40', '50v50', 'ffa'].every(v => html.includes(`value="${v}"`)) && app.includes("'50v50': 100"));
  check('3.19.0 FFA 逻辑锚点存在（顺时针槽位 / FFA 公平度 / FFA 接敌 / 每人一色）', ['function orderClockwise', 'function ffaFairness', 'function rushAnalysisFFA', 'function teamColor', 'function onTeamModeChange'].every(k => app.includes(k)));
  check('3.19.0 新功能锚点与控件存在（对称检查 / 出生点巡视 / 玩家对比 / 涟漪）', ['function analyzeSymmetry', 'function tourSpawn', 'function playersHtml', 'function bindRipples', 'function flyViewTo'].every(k => app.includes(k)) && ['id="layerSymmetry"', 'id="tourBtn"', 'id="spawnCard"'].every(k => html.includes(k)) && ['.spawn-card', '.chip-sym', '.doc-players', '.ripple-box', 'body.ffa'].every(k => css.includes(k)));
  check('3.19.0 配方码预设表只在末尾追加（旧码可解）', app.includes("const RECIPE_PRESETS = ['1v1', '2v2', '3v3', '4v4', '5v5', '10v10', '20v20', '25v25', 'free', '30v30', '40v40', '50v50', 'ffa']"));
  check('3.18.0 修复锚点存在（图层 aria 同步 / 队伍号枚举上限钳制）', app.includes('function syncLayerAria') && app.includes('Math.min(MAX_SPAWN_POINTS - 1'));
  check('3.18.0 无障碍状态存在（图层 role="switch" / 标签页 aria-selected）', html.includes('role="switch"') && html.includes('aria-selected="true"'));
  check('3.17.0 新功能锚点存在（配方码 / 体检徽章 / 放大镜 / 专注模式 / 视图截图 / 生成取消还原）', ['function encodeRecipe', 'function decodeRecipe', 'function runHealthBadge', 'function drawLoupe', 'function setFocusMode', 'function saveViewShot', 'function restoreEditorState', 'function themeGridMove'].every(k => app.includes(k)));
  check('3.17.0 新控件存在', ['id="recipeCopy"', 'id="recipePaste"', 'id="healthBadge"', 'id="loupe"', 'id="focusBtn"', 'id="focusExit"', 'id="shotBtn"'].every(k => html.includes(k)));
  check('3.17.0 近家资源距离输入框上限与代码一致（120 / 160）', /id="nearResMin"[^>]*max="120"/.test(html) && /id="nearResMax"[^>]*max="160"/.test(html));
  check('样式包含 3.17.0 新组件且专注模式列宽只在桌面布局生效', css.includes('.health-badge') && css.includes('.loupe') && css.includes('.focus-pill') && /@media\(min-width:901px\)\{\s*body\.focus-mode main\{grid-template-columns:0 1fr\}/.test(css));
  check('3.16.0 主题模块存在（选择面板 / 昼夜流转 / 旧版下标迁移）', app.includes('function openThemeMenu') && app.includes('THEME_CYCLE') && app.includes('LEGACY_THEME_ORDER'));
  check('3.16.0 主题面板与动态背景图层存在', html.includes('id="themeMenu"') && html.includes('class="theme-fx"'));
  check('样式包含 5 套动态主题且有「减少动态效果」处理', ['aurora','ember','nebula','tide','sakura'].every(t => css.includes(`body[data-theme="${t}"]`)) && css.includes('body.fx-off'));
  check('3.15.0 新逻辑锚点存在（命令面板 / 地形剖面 / 起名 / Toast 撤销校验）', app.includes('function openCmdk') && app.includes('function measureProfile') && app.includes('function rollMapName') && app.includes('function spawnUndoAction'));
  check('3.15.0 新控件与图标存在', html.includes('id="cmdk"') && html.includes('id="measureProfile"') && html.includes('id="nameDice"') && html.includes('icons/icon-192.png'));
  check('样式包含 3.15.0 新增模块', css.includes('.cmdk-card') && css.includes('.measure-profile') && css.includes('.name-dice'));
  check('地图体检控件存在', html.includes('id="mapDoctor"'));
  check('惊喜生成控件存在', html.includes('id="surprise"'));
  check('历史快照控件存在', html.includes('id="histOpen"'));
  check('样式包含减少动态效果支持', css.includes('prefers-reduced-motion: reduce'));
  check('测距按钮 / 密度提示 / 抽屉关闭条存在', html.includes('id="measureBtn"') && html.includes('id="densityHint"') && html.includes('id="drawerClose"'));
  check('3.14.0 新逻辑锚点存在（mutateTmx / 候选导出 / 分享）', app.includes('async function mutateTmx') && app.includes('exportCandidatesZip') && app.includes('function shareAction'));
  check('样式包含 3.14.0 新增模块', css.includes('.map-panel.no-map .minimap-wrap') && css.includes('.density-hint') && css.includes('.hist-pin'));
  check('Worker 脚本可加载', workerRes.status === 200 && worker.length > 100);
  check('形态 Worker 脚本可加载', shapeWorkerRes.status === 200 && shapeWorker.length > 100);
  check('WASM 资源可加载且 MIME 正确', wasmRes.status === 200 && wasmRes.headers.get('content-type')?.includes('application/wasm'));
  check('路径穿越请求被拒绝', traversalRes.status === 403);
} catch (e) {
  check(`测试执行无异常（${e?.message || e}）`, false);
} finally {
  await new Promise(resolveClose => server.close(resolveClose));
}
console.log(failed === 0 ? '\nSTATIC SMOKE TEST PASSED' : `\nSTATIC SMOKE TEST FAILED (${failed})`);
process.exitCode = failed === 0 ? 0 : 1;
