/*
 * 铁锈战争地图生成器 · TMX MapForge Offline
 * 版本 3.5.0 —— PC 版（Rust + Tauri 2，desktop/）：与 Android 共用本前端；新增 saveFile 的 PC 分支、
 *              关闭前自动保存可等待（__onAppPause 返回 Promise）、导出提示「打开文件夹」。逻辑与布局不变。
 * 版本 3.4.0 —— 小地图 PNG 重写（与预览一致显示出生点编号 / 资源点，≤500×500、≤512KB），PNG 预览与样式选择；
 *              第四轮审查：删除/放置出生点后槽位奇偶错乱、拖动跨中轴队伍改变、多边形同步乱序、导入地图队伍推断等
 * 版本 3.3.0 —— 第三轮全局审查：修复「出生点序号 ↔ 游戏玩家（team）映射错误」（核心），
 *              队伍选择不影响导出槽位、设为玩家 1 打乱全部槽位、导入 TMX 按 GID 排序等问题；
 *              新增槽位映射表 / 导出读回校验 / 镜像对位排序 / 列表重排动画 / 对位连线等
 * 版本 3.2.0 —— 第二轮全局审查：画笔断线 / 自动优化开关失效 / 弹窗竞态 / 手势接续 等修复
 *
 * 架构概览：
 *   Engine     —— Web Worker + Rust/WASM 生成引擎的 RPC 封装；负责崩溃检测、自动重启、取消
 *   S          —— 全局应用状态（快照、出生点权威列表、视图、工具、历史栈……）
 *   Spawn*     —— 出生点完全由 JS 侧管理（放置 / 移动 / 删除 / 撤销 / 智能布局 / 槽位排序）
 *   TMX        —— 解析（导入/恢复）与 Units 图层增量修补（导出）；槽位 ↔ GID 按瓦片 team 属性映射
 *   Render     —— 离屏缓存的地形底图 + 叠加层 + 小地图 + 动画
 *   Pointer    —— 统一手势状态机：平移 / 双指缩放 / 画笔 / 多边形 / 放置 / 拖动出生点 / 长按删除
 *   Project    —— IndexedDB 项目存储（可保存大体积 TMX），兼容旧版 localStorage 草稿
 */
const APP_VERSION = '3.5.0';
const PROJECT_FORMAT = 340;
const $ = id => document.getElementById(id);
const MAX_SPAWN_POINTS = 50;
const MAX_MAP_DIMENSION = 2000;
const MAX_RESOURCES = 500;
const LARGE_MAP_AREA = 600000;
const CC_GID_BASE = 101;

const DEFAULTS = {
  width: 160, height: 160, tileset: 5, heightLevels: 7, oceanLevels: 3,
  players: 10, resources: 12, mirror: 'vertical', preset: '5v5',
  symmetryStrength: 'balanced', slotOrder: 'alternate'
};
const DEFAULT_GRID = [[1,0,1,0,1],[1,1,0,1,1],[1,0,1,0,1],[1,1,0,1,1],[1,0,1,0,1]];
const STEP_NAMES = ['海岸线', '墙体与丘陵', '高度与海洋', '指挥中心', '资源点', '完成'];
const STEP_TOOLS = ['pan', 'brush', 'pan', 'cc', 'resource', 'pan'];
const MIRROR_LABELS = { none: '不对称', horizontal: 'X 轴对称', vertical: 'Y 轴对称', diagonal1: '主对角线对称', diagonal2: '副对角线对称', both: 'XY 双轴对称' };
const SYMMETRY_MODES = new Set(Object.keys(MIRROR_LABELS));
const PRESET_COUNTS = { '1v1': 2, '2v2': 4, '3v3': 6, '4v4': 8, '5v5': 10, '10v10': 20, '20v20': 40, '25v25': 50 };
const TEAM_COLORS = { A: '#4b8aff', B: '#ff6b6b' };
const PREF_KEY = 'rmtool_prefs_v2';
const THEME_KEY = 'tmx_theme';
const UI_KEY = 'tmx_ui_v31';
const LEGACY_PROJECT_KEY = 'tmx_mapforge_project_v3_3';
const THEMES = [
  { id: 'dark', name: '深空', bar: '#0b1220', lightIcons: false },
  { id: 'teal', name: '青岚', bar: '#071a21', lightIcons: false },
  { id: 'light', name: '亮白', bar: '#f4f7fb', lightIcons: true }
];
/* 引擎侧依赖已有状态的操作：导入地图或引擎重启后不能直接执行 */
const ENGINE_STATEFUL = new Set([
  'run_height_ocean', 'draw_brush_walls', 'undo_brush', 'redo_brush', 'clear_brush_walls',
  'update_polygons', 'place_resource_manual', 'remove_resource_manual', 'place_resource_random',
  'undo_resource', 'clear_resource', 'run_finalize', 'set_hill_drawing_mode'
]);
const NON_MUTATING = new Set(['init', 'get_state_snapshot', 'set_hill_drawing_mode', 'reset_state']);

/* ------------------------------------------------------------------ 全局状态 */
const S = {
  snapshot: null,
  source: null,            // 'engine' | 'import'
  engineEpoch: 0,          // 每次引擎重启 +1
  snapshotEpoch: -1,       // 当前快照来自哪一代引擎
  lastTmx: null,
  tmxDirty: false,         // 生成 TMX 之后地形/资源又被修改
  unitsDirty: false,       // 出生点已修改但尚未写回 TMX（导出时再写，避免频繁 gzip）
  mode: 'quick',
  step: 0,
  tool: 'pan',
  spawnAuthority: null,    // JS 侧出生点权威列表 [[row,col],...]
  teamOverrides: new Map(),// "r,c" -> 'A' | 'B'
  selectedSpawn: -1,
  spawnHistory: [], spawnRedo: [],
  history: [], redoHistory: [],
  brushValue: 1, brushSize: 3, brushErasing: false, hillMode: 'brush',
  polygons: [], drawingPolygon: null, selectedPolygonId: null, selectedEdgeIndex: null,
  polygonSeq: 1, polyUndo: [], polyRedo: [],
  randomResourceKeys: new Set(),
  smartPlacement: true, autoSave: true, animate: true,
  layers: { terrain: true, spawns: true, resources: true, walls: true, grid: false },
  view: { zoom: 1, x: 0, y: 0, fitted: false },
  locked: false,
  fadeStart: 0,
  themeIndex: 0,
  slotVerified: null       // 最近一次导出前读回校验结果：true / false / null（未校验或已修改）
};

/* ------------------------------------------------------------------ 通用工具 */
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const nextFrame = () => new Promise(r => requestAnimationFrame(() => r()));
const keyOf = p => p[0] + ',' + p[1];
const dist2 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const escapeHtml = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function intOf(id, min, max, dft) {
  let v = Math.round(Number($(id)?.value));
  if (!Number.isFinite(v)) v = dft;
  return clamp(v, min, max);
}
function clampInput(id, min, max, dft) {
  const v = intOf(id, min, max, dft);
  if ($(id).value !== String(v)) $(id).value = v;
  return v;
}
function stamp() {
  const d = new Date(), p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`;
}
function base64ToBytes(value) {
  const s = String(value || '').replace(/\s+/g, '');
  if (!s) return new Uint8Array(0);
  const normalized = s.replace(/-/g, '+').replace(/_/g, '/');
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(normalized) || normalized.length % 4 === 1) throw new Error('Base64 数据格式无效');
  const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
  const binary = atob(padded);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}
function bytesToBase64(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input || []);
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  return btoa(binary);
}
async function streamTransform(input, kind, compress) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input || []);
  const Stream = compress ? globalThis.CompressionStream : globalThis.DecompressionStream;
  if (typeof Stream !== 'function') throw new Error('当前 Android WebView 不支持压缩流，请升级系统 WebView');
  // pipeThrough + Response 一次性排空，避免手写 writer 在解压（输出>输入）时背压死锁
  const stream = new Response(bytes).body.pipeThrough(new Stream(kind));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
const gunzip = b => streamTransform(b, 'gzip', false);
const gzip = b => streamTransform(b, 'gzip', true);
const inflateZlib = b => streamTransform(b, 'deflate', false);

/* ------------------------------------------------------------------ UI 基础：Toast */
const TOAST_ICONS = { info: 'ℹ', success: '✓', warn: '!', error: '✕' };
/* 3.2.0：
 *  - 修复：相同消息去重时只做放大提示、不延长寿命，连续触发时提示会“刚放大就消失”；现在会重新计时。
 *  - 新增：opts.action = { label, fn } 在 Toast 内显示操作按钮（如「撤销」「立即恢复」）；点击 Toast 可提前关闭。 */
function dismissToast(t) {
  if (!t || t.classList.contains('leaving')) return;
  clearTimeout(t._timer);
  t.classList.add('leaving'); t.classList.remove('show');
  setTimeout(() => t.remove(), 320);
}
function armToast(t, ms) {
  clearTimeout(t._timer);
  const life = t.querySelector('.toast-life');
  if (life) { life.style.animation = 'none'; void life.offsetWidth; life.style.animation = ''; life.style.animationDuration = ms + 'ms'; }
  t._timer = setTimeout(() => dismissToast(t), ms);
}
function toast(msg, type = 'info', ms = 2800, opts = {}) {
  const box = $('toastBox'); if (!box) return null;
  if (opts.action) ms = Math.max(ms, 5000);
  for (const t of box.children) {
    if (t.dataset.msg === msg && !t.classList.contains('leaving')) {
      t.classList.remove('bump'); void t.offsetWidth; t.classList.add('bump');
      armToast(t, ms);
      return t;
    }
  }
  while (box.children.length >= 4) box.firstElementChild.remove();
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.dataset.msg = msg;
  t.innerHTML = `<i class="toast-ico">${TOAST_ICONS[type] || 'ℹ'}</i><span></span><b class="toast-life"></b>`;
  t.querySelector('span').textContent = msg;
  if (opts.action) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'toast-act'; b.textContent = opts.action.label;
    b.onclick = ev => { ev.stopPropagation(); dismissToast(t); try { opts.action.fn(); } catch (e) { console.error(e); } };
    t.appendChild(b);
    t.classList.add('has-action');
  }
  t.addEventListener('click', () => dismissToast(t));
  box.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  armToast(t, ms);
  return t;
}

/* ------------------------------------------------------------------ UI 基础：状态栏 / 运行时 */
function setStatus(s) { const el = $('status'); if (el.textContent !== s) { el.textContent = s; el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); } }
function setRuntime(text, level = 'ok') {
  $('runtime').textContent = text;
  $('runtimePill').dataset.level = level;
}

/* ------------------------------------------------------------------ UI 基础：忙碌遮罩 */
let busyToken = 0;
let busyHideTimer = null;
let animSkipHandler = null;
let busyStart = 0, busyClock = null;
function tickBusyClock() {
  const el = $('busyElapsed'); if (!el) return;
  const sec = (performance.now() - busyStart) / 1000;
  el.textContent = sec >= 1 ? `已用时 ${sec.toFixed(1)}s` : '';
}
function busy(on, text = '正在处理…', stage = '', progress = null, opts = {}) {
  const el = $('busy');
  clearTimeout(busyHideTimer);
  if (on) {
    if (el.hidden || !el.classList.contains('show')) {
      el.hidden = false; requestAnimationFrame(() => el.classList.add('show'));
      if (!busyClock) { busyStart = performance.now(); tickBusyClock(); busyClock = setInterval(tickBusyClock, 200); }
    }
    $('busyText').textContent = text;
    $('busyStage').textContent = stage;
    const pb = $('progressBar');
    if (progress == null) { pb.classList.add('indeterminate'); pb.style.width = ''; }
    else { pb.classList.remove('indeterminate'); pb.style.width = clamp(progress, 0, 100) + '%'; }
    $('busySkip').hidden = !opts.skippable;
    $('busyCancel').hidden = opts.cancellable === false || !!opts.skippable;
    busyToken++;
  } else {
    const tk = busyToken;
    el.classList.remove('show');
    busyHideTimer = setTimeout(() => {
      if (tk !== busyToken) return;
      el.hidden = true;
      clearInterval(busyClock); busyClock = null;
      if ($('busyElapsed')) $('busyElapsed').textContent = '';
    }, 220);
  }
  try { window.AndroidBridge?.setKeepScreenOn?.(!!on); } catch { /* 旧版桥接无此方法 */ }
}

/* ------------------------------------------------------------------ UI 基础：模态对话框（替代 WebView 中不可用的 confirm()） */
/* 3.2.0 修复：旧实现关闭弹窗时用无条件的 200ms 定时器设置 hidden，若在此期间又弹出下一个对话框
 * （如确认后紧接着弹出选择框），新对话框会被这个定时器错误隐藏，Promise 永远不 resolve，界面卡死在锁定状态。
 * 现以 modalToken 区分每次打开，只隐藏属于自己的那一次。 */
let modalResolve = null, modalToken = 0, modalHideTimer = null, modalLastFocus = null;
function uiChoice(title, body, buttons, opts = {}) {
  return new Promise(resolve => {
    if (modalResolve) { const r = modalResolve; modalResolve = null; r(null); }
    modalResolve = resolve;
    modalToken++;
    clearTimeout(modalHideTimer);
    const m = $('modal');
    if (m.hidden) modalLastFocus = document.activeElement;
    m.dataset.tone = opts.tone || (buttons.some(b => b.danger) ? 'danger' : 'info');
    m.querySelector('.modal-card').classList.toggle('wide', !!opts.wide);
    $('modalTitle').textContent = title;
    $('modalBody').innerHTML = body;
    const actions = m.querySelector('.modal-actions');
    actions.innerHTML = '';
    buttons.forEach(b => {
      const btn = document.createElement('button');
      btn.textContent = b.label;
      if (b.primary) btn.className = 'primary-soft';
      if (b.danger) btn.className = 'danger';
      btn.style.setProperty('--d', `${60 + actions.children.length * 40}ms`);
      btn.onclick = () => closeModal(b.key);
      actions.appendChild(btn);
    });
    m.hidden = false;
    requestAnimationFrame(() => m.classList.add('show'));
    setTimeout(() => actions.querySelector('.primary-soft,.danger')?.focus(), 60);
  });
}
function uiConfirm(title, body, okLabel = '确定', danger = false) {
  return uiChoice(title, body, [{ key: 'cancel', label: '取消' }, { key: 'ok', label: okLabel, primary: !danger, danger }], { tone: danger ? 'danger' : 'info' }).then(k => k === 'ok');
}
function closeModal(key = null) {
  const m = $('modal');
  if (m.hidden || !m.classList.contains('show')) return false;
  m.classList.remove('show');
  const tk = modalToken;
  clearTimeout(modalHideTimer);
  modalHideTimer = setTimeout(() => { if (tk === modalToken) { m.hidden = true; try { modalLastFocus?.focus?.({ preventScroll: true }); } catch { /* ignore */ } } }, 200);
  const r = modalResolve; modalResolve = null;
  r?.(key);
  return true;
}
const modalOpen = () => { const m = $('modal'); return !m.hidden && m.classList.contains('show'); };

/* ------------------------------------------------------------------ 引擎（Web Worker + WASM）管理 */
class EngineError extends Error {
  constructor(msg, { fatal = false, cancelled = false, raw = '' } = {}) {
    super(msg); this.fatal = fatal; this.cancelled = cancelled; this.raw = raw;
  }
}
function translateEngineError(msg) {
  const m = String(msg || '');
  if (/Missing height map/i.test(m)) return '请先完成「③ 高度与海洋」步骤';
  if (/Missing.*coastline|coastline.*missing/i.test(m)) return '请先完成「① 海岸线」步骤';
  if (/Missing blueprintXml/i.test(m)) return '缺少地形模板数据';
  if (/Unknown RPC method/i.test(m)) return '引擎不支持该操作：' + m;
  if (/unreachable|RuntimeError|borrowed/i.test(m)) return '本地引擎内部错误（已自动重启）';
  return m || '本地引擎操作失败';
}
const Engine = {
  worker: null, seq: 0, pending: new Map(), ready: null, restarts: [],
  start() {
    this.worker = new Worker('./worker.js', { type: 'module' });
    this.worker.onmessage = e => this.onMessage(e.data);
    this.worker.onerror = e => {
      e.preventDefault?.();
      console.error('worker error', e.message);
      this.restart('error');
    };
    this.ready = this.raw('init', {});
    return this.ready;
  },
  raw(action, params, transfer) {
    return new Promise((resolve, reject) => {
      const id = ++this.seq;
      this.pending.set(id, { resolve, reject, action });
      try { this.worker.postMessage({ id, action, params }, transfer || []); }
      catch (err) { this.pending.delete(id); reject(err); }
    });
  },
  onMessage(m) {
    const p = this.pending.get(m?.id);
    if (!p) return;
    this.pending.delete(m.id);
    if (m.ok) { p.resolve(m.result); return; }
    p.reject(new EngineError(translateEngineError(m.error), { fatal: !!m.fatal, raw: m.error }));
    if (m.fatal) this.restart('crash');
  },
  failAll(err) { for (const p of this.pending.values()) p.reject(err); this.pending.clear(); },
  restart(reason) {
    const now = Date.now();
    this.restarts = this.restarts.filter(t => now - t < 10000);
    this.restarts.push(now);
    try { this.worker?.terminate(); } catch { /* ignore */ }
    this.failAll(new EngineError(reason === 'cancel' ? '操作已取消' : '本地引擎已重启', { fatal: reason !== 'cancel', cancelled: reason === 'cancel' }));
    S.engineEpoch++;
    if (this.restarts.length > 4) {
      setRuntime('引擎连续崩溃，已停止自动重启', 'err');
      toast('本地引擎连续崩溃，请重启应用', 'error', 5000);
      this.ready = Promise.reject(new EngineError('本地引擎不可用', { fatal: true }));
      this.ready.catch(() => {});
      return;
    }
    setRuntime('引擎重启中…', 'warn');
    this.start().then(() => setRuntime('本地运行 · 无网络依赖', 'ok'))
      .catch(e => setRuntime('引擎初始化失败：' + e.message, 'err'));
  },
  async call(action, params = {}, transfer) {
    await this.ready;
    return this.raw(action, params, transfer);
  }
};

/* ------------------------------------------------------------------ 参数 */
function params() {
  return {
    grid: getGrid(),
    width: intOf('width', 40, MAX_MAP_DIMENSION, DEFAULTS.width),
    height: intOf('height', 40, MAX_MAP_DIMENSION, DEFAULTS.height),
    mirroring: $('mirror').value,
    tileset: intOf('tileset', 1, 5, DEFAULTS.tileset),
    heightLevels: intOf('heightLevels', 1, 32, DEFAULTS.heightLevels),
    oceanLevels: intOf('oceanLevels', 0, 32, DEFAULTS.oceanLevels),
    numPlayers: intOf('players', 0, MAX_SPAWN_POINTS, DEFAULTS.players),
    numResources: intOf('resources', 0, MAX_RESOURCES, DEFAULTS.resources)
  };
}
function effectiveSpawnMode(mode) {
  if ($('symmetryStrength').value === 'soft') return 'none';
  return SYMMETRY_MODES.has(mode) ? mode : 'none';
}
function updateMirrorHint() {
  const el = $('mirrorHint');
  const m = $('mirror').value, n = intOf('players', 0, MAX_SPAWN_POINTS, 10);
  const w = intOf('width', 40, MAX_MAP_DIMENSION, 160), h = intOf('height', 40, MAX_MAP_DIMENSION, 160);
  let text = '对称只负责空间布局，出生点数量与玩家/队伍完全独立', accent = false;
  if ((m === 'diagonal1' || m === 'diagonal2') && w !== h) { text = `对角线对称需要宽高相等（当前 ${w}×${h}），出生点将退化为不对称布局`; accent = true; }
  else if (m === 'both' && n % 4 !== 0) { text = `XY 双轴：优先四点镜像组；${n} 不是 4 的倍数，余数采用平衡补位`; accent = true; }
  else if (m === 'both') text = 'XY 双轴：按四点镜像组生成，队伍/玩家槽位独立分配';
  else if (m !== 'none' && n % 2 === 1) { text = `${MIRROR_LABELS[m]}：${n} 为奇数，最后 1 个点无法成对，将放在最均衡的位置`; accent = true; }
  el.textContent = text;
  el.classList.toggle('accent-hint', accent);
}

/* ------------------------------------------------------------------ 海岸线 5×5 模板 */
function getGrid() {
  const cells = [...document.querySelectorAll('#grid .cell')];
  const g = [];
  cells.forEach((b, i) => { (g[Math.floor(i / 5)] ??= []).push(b.classList.contains('on') ? 1 : 0); });
  return g.length === 5 ? g : DEFAULT_GRID.map(r => [...r]);
}
function renderGrid(g = DEFAULT_GRID) {
  if (!Array.isArray(g) || g.length !== 5 || g.some(r => !Array.isArray(r) || r.length !== 5)) g = DEFAULT_GRID;
  const box = $('grid');
  box.innerHTML = '';
  g.forEach((r, y) => r.forEach((v, x) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'cell ' + (v ? 'on' : 'off');
    b.style.setProperty('--d', `${(y * 5 + x) * 14}ms`);
    b.setAttribute('aria-label', `海岸线方格 ${y + 1},${x + 1}`);
    b.setAttribute('aria-pressed', v ? 'true' : 'false');
    b.onclick = () => mirrorCell(y, x, !b.classList.contains('on'));
    box.appendChild(b);
  }));
}
function gridMirrorSet(r, c) {
  const size = 5, m = $('mirror').value, pts = new Set([`${r},${c}`]);
  if (m === 'horizontal' || m === 'both') pts.add(`${size - 1 - r},${c}`);
  if (m === 'vertical' || m === 'both') pts.add(`${r},${size - 1 - c}`);
  if (m === 'diagonal1') pts.add(`${c},${r}`);
  if (m === 'diagonal2') pts.add(`${size - 1 - c},${size - 1 - r}`);
  if (m === 'both') pts.add(`${size - 1 - r},${size - 1 - c}`);
  return pts;
}
function setCell(y, x, on, linked) {
  const b = $('grid').children[y * 5 + x];
  if (!b) return;
  b.classList.toggle('on', on); b.classList.toggle('off', !on);
  b.setAttribute('aria-pressed', on ? 'true' : 'false');
  if (linked) { b.classList.remove('linked'); void b.offsetWidth; b.classList.add('linked'); }
}
function mirrorCell(r, c, on) {
  const pts = gridMirrorSet(r, c);
  for (const s of pts) { const [y, x] = s.split(',').map(Number); setCell(y, x, on, pts.size > 1 && !(y === r && x === c)); }
  queuePrefs();
}
function randomGrid() {
  const g = Array.from({ length: 5 }, () => Array(5).fill(0));
  for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) g[y][x] = Math.random() < 0.62 ? 1 : 0;
  renderGrid(g);
  // 按当前对称模式联动，保证模板本身对称
  for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) {
    const on = g[y][x] === 1;
    for (const s of gridMirrorSet(y, x)) { const [yy, xx] = s.split(',').map(Number); if (yy * 5 + xx > y * 5 + x) { g[yy][xx] = on ? 1 : 0; setCell(yy, xx, on, false); } }
  }
  queuePrefs();
}

/* ------------------------------------------------------------------ 矩阵与尺寸 */
function getMatrix(key, s = S.snapshot) { return s?.matrices?.[key] || null; }
function terrainMatrix(s = S.snapshot) { return getMatrix('height_map', s) || getMatrix('coastline_height_map', s); }
function dimsOf(s = S.snapshot) {
  const m = terrainMatrix(s) || getMatrix('id_matrix', s) || getMatrix('wall_matrix', s);
  if (m?.shape) return [m.shape[0], m.shape[1]];
  return [Number(s?.meta?.height) || 0, Number(s?.meta?.width) || 0];
}
const dims = () => dimsOf(S.snapshot);

/* ------------------------------------------------------------------ 出生点：合法性
 * 与 Rust 引擎 add_command_centers / run_place_cc_manual 的判定对齐：
 *   中心 3×3 必须是陆地；半径 1 内不能有墙线；半径 2 内不能有资源池；距地图边缘 ≥2 格。
 * 修复：旧实现把多边形模式的「分层深度」也当作墙体（深度>0 即判非法），导致多边形内部无法放出生点。
 */
function spawnCellValid(s, r, c) {
  const [rows, cols] = dimsOf(s);
  if (!rows || !cols || r < 2 || c < 2 || r >= rows - 2 || c >= cols - 2) return false;
  const h = terrainMatrix(s);
  if (h?.data) {
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) if (h.data[(r + dr) * cols + c + dc] <= 0) return false;
  }
  const wall = getMatrix('wall_matrix', s);
  if (wall?.data && wall.shape?.[1] === cols) {
    if ((s?.meta?.hill_drawing_mode || 'brush') === 'polygon') {
      const d0 = wall.data[r * cols + c];
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        const d = wall.data[(r + dr) * cols + c + dc];
        if (Math.abs(d) !== Math.abs(d0)) return false; // 处于分层边界（墙线）上
      }
    } else {
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) if (wall.data[(r + dr) * cols + c + dc] === 1) return false;
    }
  }
  const items = getMatrix('items_matrix', s);
  if (items?.data && items.shape?.[1] === cols) {
    for (let dr = -2; dr <= 2; dr++) {
      const rr = r + dr; if (rr < 0 || rr >= rows) continue;
      for (let dc = -2; dc <= 2; dc++) {
        const cc = c + dc; if (cc < 0 || cc >= cols) continue;
        if (items.data[rr * cols + cc] !== 0) return false;
      }
    }
  }
  return true;
}
function mirrorPoint(p, mode, rows, cols) {
  const [r, c] = p, out = [];
  const add = (a, b) => { if (a >= 0 && b >= 0 && a < rows && b < cols && !(a === r && b === c) && !out.some(x => x[0] === a && x[1] === b)) out.push([a, b]); };
  if (mode === 'horizontal' || mode === 'both') add(rows - 1 - r, c);
  if (mode === 'vertical' || mode === 'both') add(r, cols - 1 - c);
  if (mode === 'diagonal1' && rows === cols) add(c, r);
  if (mode === 'diagonal2' && rows === cols) add(cols - 1 - c, rows - 1 - r);
  if (mode === 'both') add(rows - 1 - r, cols - 1 - c);
  return out;
}

/* ------------------------------------------------------------------ 出生点：智能布局（最远点采样）
 * 旧实现按「扫描顺序」挑选候选，出生点会从左上角开始扎堆。
 * 新实现：在真实分辨率地形上构建对称轨道候选，每轮选择「与已选点最小距离最大」的轨道，
 * 并在接近最优的前几名中随机挑选，兼顾分散度与多样性；距离阈值逐步放宽，保证尽量放满。
 */
function spawnOrbits(s, mode, strict) {
  const [rows, cols] = dimsOf(s);
  if (!rows || !cols) return [];
  const mR = Math.max(2, Math.round(rows * 0.07)), mC = Math.max(2, Math.round(cols * 0.07));
  const area = (rows - 2 * mR) * (cols - 2 * mC);
  const stride = Math.max(1, Math.ceil(Math.sqrt(Math.max(1, area) / 4200)));
  const orbits = [], seen = new Set();
  // 期望轨道大小：落在对称轴上的点只能映射到自身，视为「残缺轨道」，避免破坏两侧人数平衡
  const square = rows === cols;
  const expected = mode === 'both' ? 4 : (mode === 'horizontal' || mode === 'vertical' || (square && (mode === 'diagonal1' || mode === 'diagonal2'))) ? 2 : 1;
  for (let r = mR; r < rows - mR; r += stride) {
    for (let c = mC; c < cols - mC; c += stride) {
      if (!spawnCellValid(s, r, c)) continue;
      const raw = [[r, c], ...mirrorPoint([r, c], mode, rows, cols)];
      const canon = raw.map(keyOf).sort().join('|');
      if (seen.has(canon)) continue;
      seen.add(canon);
      const valid = raw.filter(p => spawnCellValid(s, p[0], p[1]));
      if (strict && valid.length !== raw.length) continue;
      let intra = Infinity;
      for (let i = 0; i < valid.length; i++) for (let j = i + 1; j < valid.length; j++) intra = Math.min(intra, dist2(valid[i], valid[j]));
      orbits.push({ pts: valid, full: valid.length === raw.length && raw.length === expected, intra });
    }
  }
  return orbits;
}
function bestSubset(pts, k) {
  if (pts.length <= k) return pts;
  if (k === 1) return [pts[0]];
  let best = null, bestD = -1;
  for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
    const d = dist2(pts[i], pts[j]); if (d > bestD) { bestD = d; best = [pts[i], pts[j]]; }
  }
  while (best.length < k) {
    let cand = null, cd = -1;
    for (const p of pts) { if (best.includes(p)) continue; const d = Math.min(...best.map(q => dist2(p, q))); if (d > cd) { cd = d; cand = p; } }
    best.push(cand);
  }
  return best;
}
function placeSpawns(s, wanted, mirrorMode, existing = []) {
  const mode = effectiveSpawnMode(mirrorMode);
  const strict = $('symmetryStrength').value === 'strict';
  const [rows, cols] = dimsOf(s);
  const out = existing.map(p => [p[0], p[1]]);
  if (out.length >= wanted || !rows || !cols) return out.slice(0, wanted);
  let orbits = spawnOrbits(s, mode, strict);
  if (!orbits.length && strict) orbits = spawnOrbits(s, mode, false);
  if (!orbits.length) return out;
  const flat = [];
  orbits.forEach((o, oi) => o.pts.forEach(p => flat.push({ p, oi })));
  const near = new Float64Array(flat.length).fill(Infinity);
  const updateNear = added => { for (let i = 0; i < flat.length; i++) for (const q of added) { const d = dist2(flat[i].p, q); if (d < near[i]) near[i] = d; } };
  updateNear(out);
  const orbitNear = () => {
    const on = new Float64Array(orbits.length).fill(Infinity);
    for (let i = 0; i < flat.length; i++) if (near[i] < on[flat[i].oi]) on[flat[i].oi] = near[i];
    return on;
  };
  const minDim = Math.min(rows, cols);
  let minD = Math.max(3, minDim * 0.10);
  const floorD = Math.max(2.2, minDim * 0.025);
  const used = new Set(out.map(keyOf));
  let guard = 0;
  while (out.length < wanted && guard++ < 400) {
    const remaining = wanted - out.length;
    const on = orbitNear();
    const scored = [];
    // 优先完整对称轨道；只有在距离阈值已降到下限仍无完整轨道可用时，才允许残缺轨道（保证两侧人数平衡）
    const allowPartial = minD <= floorD;
    for (let oi = 0; oi < orbits.length; oi++) {
      const o = orbits[oi];
      if (!o.full && !allowPartial) continue;
      let pts = o.pts.filter(p => !used.has(keyOf(p)));
      if (!pts.length || (!allowPartial && pts.length < o.pts.length)) continue;
      if (pts.length > remaining) pts = bestSubset(pts, remaining);
      let intra = Infinity;
      for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) intra = Math.min(intra, dist2(pts[i], pts[j]));
      const nearest = out.length ? on[oi] : Infinity;
      // 首个轨道：偏好成员彼此距离远（对称对拉开）；单点轨道偏好靠近四角
      let score = Math.min(nearest, intra);
      if (!Number.isFinite(score)) {
        const p = pts[0];
        score = Math.hypot(p[0] - rows / 2, p[1] - cols / 2);
      }
      if (score < minD) continue;
      const penalty = o.full ? 1 : 0.82;
      scored.push({ pts, score: score * penalty });
    }
    if (!scored.length) {
      if (minD <= floorD) break;
      minD = Math.max(floorD, minD * 0.84);
      continue;
    }
    scored.sort((a, b) => b.score - a.score);
    const top = scored[0].score;
    const pool = scored.filter(x => x.score >= top * 0.93).slice(0, 6);
    const pick = pool[Math.floor(Math.random() * pool.length)];
    const added = pick.pts.map(p => [p[0], p[1]]);
    added.forEach(p => { out.push(p); used.add(keyOf(p)); });
    updateNear(added);
  }
  return out.slice(0, wanted);
}

/* ------------------------------------------------------------------ 出生点：队伍与槽位 */
function sideTeam(p, s = S.snapshot) {
  const [rows, cols] = dimsOf(s);
  const m = s?.meta?.mirroring || $('mirror').value;
  const [r, c] = p;
  if (m === 'horizontal') return r < rows / 2 ? 'A' : 'B';
  if (m === 'diagonal1' && rows === cols) return r < c ? 'A' : 'B';
  if (m === 'diagonal2' && rows === cols) return r + c < rows - 1 ? 'A' : 'B';
  return c < cols / 2 ? 'A' : 'B';
}
function teamOf(p, i) { return S.teamOverrides.get(keyOf(p)) || sideTeam(p) || (i % 2 ? 'B' : 'A'); }
/* 3.3.0：「A/B 交替」时，B 队按「A[i] 的镜像点」重新配对 —— 玩家 1 与玩家 2、玩家 3 与玩家 4……互为镜像对手，
 * 旧实现按列表顺序硬拼，常出现玩家 1 的对位点在地图另一角。 */
function orderBySlot(positions, orderMode = $('slotOrder').value) {
  if (orderMode === 'engine' || positions.length < 2) return positions;
  const A = [], B = [];
  positions.forEach((p, i) => (teamOf(p, i) === 'A' ? A : B).push(p));
  if (orderMode === 'grouped') return [...A, ...B];
  const [rows, cols] = dims(), mode = effectiveSpawnMode(S.snapshot?.meta?.mirroring || $('mirror').value);
  let Bs = B;
  if (mode !== 'none' && rows && cols) {
    const pool = [...B]; Bs = [];
    for (const a of A) {
      if (!pool.length) break;
      const mir = mirrorPoint(a, mode, rows, cols);
      if (!mir.length) { Bs.push(pool.shift()); continue; }
      let best = 0, bd = Infinity;
      pool.forEach((b, j) => { const d = Math.min(...mir.map(m => dist2(m, b))); if (d < bd) { bd = d; best = j; } });
      Bs.push(pool.splice(best, 1)[0]);
    }
    Bs.push(...pool);
  }
  const out = [];
  for (let i = 0; i < Math.max(A.length, Bs.length); i++) { if (A[i]) out.push(A[i]); if (Bs[i]) out.push(Bs[i]); }
  return out;
}
/* 3.4.0：结构性修改（放置 / 删除）后按当前规则整理槽位。
 * 旧版删除玩家 3 后，玩家 4–10 整体前移一位，交替模式下所有人的奇偶（队伍）同时翻转；
 * 在奇数个出生点之后追加一对镜像点，也会让新点的队伍与槽位奇偶错开。 */
function normalizeSlots(list) { return $('slotOrder').value === 'engine' ? list : orderBySlot(list); }
/* 槽位 → 期望队伍：交替模式下奇数号玩家=A、偶数号=B；A 队在前模式按前 nA 个=A */
function slotTeamFor(i, list = currentSpawns()) {
  const mode = $('slotOrder').value;
  if (mode === 'alternate') return i % 2 ? 'B' : 'A';
  if (mode === 'grouped') { const nA = list.filter((q, k) => teamOf(q, k) === 'A').length; return i < nA ? 'A' : 'B'; }
  return teamOf(list[i], i);
}
function enginePositionsBySlot(s) {
  // Rust 快照的 cc_positions 是行优先扫描顺序，引擎的选点顺序编码在 units_matrix 的 GID（101 + 选点序号）中。
  // 注意：内置 wasm 仍按「101 + 序号」写 GID（该值并不等于 team，见 buildCcMap），这里只用它恢复引擎的选点顺序，
  // 真正写入 TMX 的 GID 由导出前的 patchTmxUnits 按 team 属性重写。
  const u = getMatrix('units_matrix', s), pos = s?.cc_positions || [];
  if (!u?.data || !pos.length) return pos.map(p => [p[0], p[1]]);
  const cols = u.shape[1];
  return pos.map(p => ({ p: [p[0], p[1]], g: u.data[p[0] * cols + p[1]] || 9999 }))
    .sort((a, b) => a.g - b.g).map(x => x.p);
}

/* ------------------------------------------------------------------ 出生点：权威状态读写 */
function currentSpawns() { return (S.snapshot?.cc_positions || []).map(p => [p[0], p[1]]); }
/* 出生点弹出动画：新出现 / 移动到新位置的出生点在画布上以弹性缩放出现 */
const spawnPop = new Map();
function markSpawnPop(list, all = false) {
  const old = all ? new Set() : new Set((S.snapshot?.cc_positions || []).map(keyOf)), now = performance.now();
  for (const p of list || []) if (!old.has(keyOf(p))) spawnPop.set(keyOf(p), now);
  if (spawnPop.size > 200) spawnPop.clear();
}
function setSpawns(positions, { s = S.snapshot, markDirty = true } = {}) {
  const list = (positions || []).slice(0, MAX_SPAWN_POINTS).map(p => [Math.round(p[0]), Math.round(p[1])]);
  if (s === S.snapshot) markSpawnPop(list);
  if (s) s.cc_positions = list;
  S.spawnAuthority = list.map(p => [...p]);
  if (S.selectedSpawn >= list.length) S.selectedSpawn = -1;
  if (markDirty && S.lastTmx) { S.unitsDirty = true; S.slotVerified = null; queueMicrotask(updateSlotBadge); }
}
function spawnState() { return { pos: currentSpawns(), teams: [...S.teamOverrides] }; }
function pushSpawnHistory() {
  if (!S.snapshot) return;
  S.spawnHistory.push(spawnState());
  if (S.spawnHistory.length > 60) S.spawnHistory.shift();
  S.spawnRedo = [];
  pushGlobal('spawn');
}
function restoreSpawnState(st) {
  if (!S.snapshot || !st) return;
  S.teamOverrides = new Map(st.teams || []);
  setSpawns(st.pos);
  afterSpawnChange();
}
function undoSpawn(fromGlobal = false) {
  if (!S.spawnHistory.length) { toast('没有可撤销的出生点操作'); return false; }
  if (!fromGlobal) syncLocal('spawn', 'undo');
  S.spawnRedo.push(spawnState());
  restoreSpawnState(S.spawnHistory.pop());
  toast('已撤销出生点操作');
  return true;
}
function redoSpawn(fromGlobal = false) {
  if (!S.spawnRedo.length) { toast('没有可重做的出生点操作'); return false; }
  if (!fromGlobal) syncLocal('spawn', 'redo');
  S.spawnHistory.push(spawnState());
  restoreSpawnState(S.spawnRedo.pop());
  toast('已重做出生点操作');
  return true;
}
function afterSpawnChange() {
  updateUndoButtons();
  updateSpawnUI();
  scheduleRender();
  queueAutoSave();
}

/* 全局撤销：按操作类型记录，撤销时分派给对应子系统（出生点 / 多边形 / 画笔） */
function pushGlobal(type) { S.history.push(type); if (S.history.length > 200) S.history.shift(); S.redoHistory = []; queueMicrotask(updateUndoButtons); }
/* 局部撤销/重做按钮也要同步全局栈，否则之后的「全局撤销」会多撤一步 */
function syncLocal(type, dir) {
  const from = dir === 'undo' ? S.history : S.redoHistory, to = dir === 'undo' ? S.redoHistory : S.history;
  const i = from.lastIndexOf(type);
  if (i >= 0) { from.splice(i, 1); to.push(type); }
  queueMicrotask(updateUndoButtons);
}
/* 3.2.0 修复：旧实现先移动全局栈再调用子系统，子系统没有可撤销记录（或引擎状态失效、正忙）时
 * 全局栈已经错位，之后的撤销/重做会作用到错误的子系统。现在只有子系统真正执行成功才移动全局栈。 */
async function globalUndo() {
  if (!guard()) return;
  const type = S.history[S.history.length - 1];
  if (!type) { toast('没有可撤销的操作'); return; }
  let ok = false;
  if (type === 'spawn') ok = undoSpawn(true);
  else if (type === 'polygon') ok = await undoPolygonLocal(true);
  else if (type === 'brush') ok = (await action('undo_brush', true)) !== undefined;
  if (ok) { S.history.pop(); S.redoHistory.push(type); }
  else if (type !== 'brush' || !engineStateUsable('undo_brush')) { S.history.pop(); } // 记录已失效，丢弃避免卡死
  updateUndoButtons();
}
async function globalRedo() {
  if (!guard()) return;
  const type = S.redoHistory[S.redoHistory.length - 1];
  if (!type) { toast('没有可重做的操作'); return; }
  let ok = false;
  if (type === 'spawn') ok = redoSpawn(true);
  else if (type === 'polygon') ok = await redoPolygonLocal(true);
  else if (type === 'brush') ok = (await action('redo_brush', true)) !== undefined;
  if (ok) { S.redoHistory.pop(); S.history.push(type); }
  else if (type !== 'brush' || !engineStateUsable('redo_brush')) { S.redoHistory.pop(); }
  updateUndoButtons();
}
/* 撤销/重做按钮根据可用记录自动启用/禁用（3.2.0 新增） */
function updateUndoButtons() {
  const set = (id, on) => { const el = $(id); if (el) el.disabled = !on; };
  set('spawnUndo', S.spawnHistory.length > 0); set('spawnRedo', S.spawnRedo.length > 0);
  set('undoGlobal', S.history.length > 0); set('redoGlobal', S.redoHistory.length > 0);
  set('fabUndo', S.history.length > 0);
  document.querySelectorAll('[data-act="undo_polygons"]').forEach(b => { b.disabled = !S.polyUndo.length; });
  document.querySelectorAll('[data-act="redo_polygons"]').forEach(b => { b.disabled = !S.polyRedo.length; });
}

/* ------------------------------------------------------------------ 出生点：编辑操作 */
function minManualGap() { const [r, c] = dims(); return Math.max(3, Math.min(r, c) * 0.02); }
function placeSpawnAt(cell) {
  const s = S.snapshot; if (!s) return;
  const [rows, cols] = dims();
  const cur = currentSpawns();
  if (cur.length >= MAX_SPAWN_POINTS) { toast(`出生点已达上限 ${MAX_SPAWN_POINTS} 个`, 'warn'); return; }
  const gap = minManualGap();
  const orbit = [[cell.row, cell.col], ...mirrorPoint([cell.row, cell.col], effectiveSpawnMode($('mirror').value), rows, cols)];
  const accepted = [];
  for (const p of orbit) {
    if (!spawnCellValid(s, p[0], p[1])) continue;
    if ([...cur, ...accepted].some(q => dist2(p, q) < gap)) continue;
    accepted.push(p);
  }
  if (!accepted.length) { toast('此处无法放置：需要陆地、远离墙线/资源，且与其他出生点保持距离', 'warn'); return; }
  const room = MAX_SPAWN_POINTS - cur.length;
  const add = accepted.slice(0, room);
  pushSpawnHistory();
  const next = normalizeSlots([...cur, ...add]);
  setSpawns(next);
  S.selectedSpawn = next.findIndex(q => keyOf(q) === keyOf(add[0]));
  afterSpawnChange();
  setStatus(`已放置 ${add.length} 个出生点${add.length < orbit.length ? `（镜像点 ${orbit.length - add.length} 个不合法已跳过）` : ''}`);
  if (accepted.length > add.length) toast(`已达上限，仅放置 ${add.length} 个`, 'warn');
}
function spawnIndexNear(cell, pxRadius = 16) {
  const p = currentSpawns();
  const rad = Math.max(1.6, pxRadius / S.view.zoom);
  let best = -1, bd = Infinity;
  p.forEach((q, i) => { const d = Math.hypot(q[0] + 0.5 - cell.y, q[1] + 0.5 - cell.x); if (d < bd) { bd = d; best = i; } });
  return bd <= rad ? best : -1;
}
function removeSpawnAt(cell) {
  let idx = spawnIndexNear(cell, 22);
  if (idx < 0) { const p = currentSpawns(); idx = p.findIndex(q => Math.max(Math.abs(q[0] - cell.row), Math.abs(q[1] - cell.col)) <= 3); }
  if (idx < 0) return false;
  removeSpawnIndex(idx);
  return true;
}
function removeSpawnIndex(idx) {
  const p = currentSpawns();
  if (idx < 0 || idx >= p.length) return;
  pushSpawnHistory();
  const [gone] = p.splice(idx, 1);
  S.teamOverrides.delete(keyOf(gone));
  const next = normalizeSlots(p);
  const moved = next.some((q, i) => keyOf(q) !== keyOf(p[i]));
  setSpawns(next);
  S.selectedSpawn = -1;
  afterSpawnChange();
  setStatus(`已删除玩家 ${idx + 1}${moved ? '，其余槽位已按队伍规则整理' : ''}`);
  toast(`已删除玩家 ${idx + 1}${moved ? ' · 槽位已整理' : ''}`, 'info', 4200, { action: { label: '撤销', fn: () => undoSpawn() } });
}
function moveSpawn(idx, cell) {
  const s = S.snapshot, p = currentSpawns();
  if (!s || idx < 0 || idx >= p.length) return false;
  const target = [cell.row, cell.col];
  if (target[0] === p[idx][0] && target[1] === p[idx][1]) return true;
  if (!spawnCellValid(s, target[0], target[1])) { toast('目标位置不合法：需要陆地、远离墙线与资源', 'warn'); return false; }
  if (p.some((q, i) => i !== idx && dist2(q, target) < minManualGap())) { toast('目标位置离其他出生点太近', 'warn'); return false; }
  pushSpawnHistory();
  const oldKey = keyOf(p[idx]);
  // 3.4.0：移动时锁定原队伍。旧版未手动指定队伍的点按地图左右半边推断队伍，拖过中轴后队伍悄悄改变，与槽位奇偶不一致
  const keepTeam = S.teamOverrides.get(oldKey) || teamOf(p[idx], idx);
  S.teamOverrides.delete(oldKey); S.teamOverrides.set(keyOf(target), keepTeam);
  p[idx] = target;
  setSpawns(p);
  S.selectedSpawn = idx;
  afterSpawnChange();
  setStatus(`玩家 ${idx + 1} 已移动到 ${target[0] + 1}, ${target[1] + 1}（队伍 ${keepTeam} 保持不变）`);
  return true;
}
/* 3.2.0：新增 allowPartial —— 大地图分步生成路径中，旧实现在出生点放不满时直接抛错，
 * 导致前面已完成的海岸线/高度/资源全部作废、整次生成失败；现在尽量放置并给出提示。 */
async function smartPlaceAll(wanted, { history = true, quiet = false, allowPartial = false } = {}) {
  if (!S.snapshot) throw new Error('请先生成地图地形');
  const target = clamp(Math.round(Number(wanted) || 0), 0, MAX_SPAWN_POINTS);
  let positions = target ? placeSpawns(S.snapshot, target, $('mirror').value, []) : [];
  if (positions.length < target) {
    const msg = `合法地形不足：需要 ${target} 个出生点，实际只能放置 ${positions.length} 个。可减少出生点数量或调整墙体/海岸线。`;
    if (!allowPartial || !positions.length) throw new Error(msg);
    toast(msg, 'warn', 5000);
  }
  if (history) pushSpawnHistory();
  S.teamOverrides.clear();
  positions = orderBySlot(positions);
  setSpawns(positions);
  afterSpawnChange();
  if (!quiet) toast(`已智能布置 ${positions.length} 个出生点`, 'success');
  return positions;
}

/* ------------------------------------------------------------------ 公平度分析 */
function spawnFairness(p = currentSpawns(), snap = S.snapshot) {
  const [rows, cols] = dimsOf(snap);
  if (p.length < 2 || !rows || !cols) return { score: 0, text: p.length ? '出生点不足，至少需要 2 个点' : '暂无出生点' };
  const ds = [];
  for (let i = 0; i < p.length; i++) for (let j = i + 1; j < p.length; j++) ds.push(dist2(p[i], p[j]));
  const min = Math.min(...ds), avg = ds.reduce((a, b) => a + b, 0) / ds.length;
  const edge = Math.min(...p.map(([r, c]) => Math.min(r, c, rows - 1 - r, cols - 1 - c))) / (Math.min(rows, cols) / 2);
  const target = Math.max(1, Math.min(rows, cols) * 0.16);
  const spacing = Math.min(1, min / target);
  const teams = p.map((q, i) => snap === S.snapshot ? teamOf(q, i) : sideTeam(q, snap));
  const nA = teams.filter(t => t === 'A').length, nB = teams.length - nA;
  const countBalance = Math.min(nA, nB) / Math.max(nA, nB, 1);
  const res = snap?.resource_positions || [];
  let resourceBalance = 1;
  if (res.length) {
    const nearest = p.map(a => Math.min(...res.map(b => dist2(a, b))));
    const av = t => { const v = nearest.filter((_, i) => teams[i] === t); return v.length ? v.reduce((x, y) => x + y, 0) / v.length : null; };
    const a = av('A'), b = av('B');
    if (a !== null && b !== null) resourceBalance = Math.min(1, Math.min(a, b) / Math.max(a, b, 1));
  }
  const score = Math.round(clamp((spacing * 0.42 + Math.min(1, edge * 2) * 0.16 + Math.min(1, avg / (target * 2)) * 0.16 + resourceBalance * 0.13 + countBalance * 0.13) * 100, 0, 100));
  return {
    score, min, avg, edge, resourceBalance, nA, nB,
    text: `最小间距 ${min.toFixed(1)} · 平均间距 ${avg.toFixed(1)}<br>边缘安全 ${Math.round(edge * 100)}% · 资源平衡 ${Math.round(resourceBalance * 100)}% · 队伍 A ${nA} / B ${nB}`
  };
}
function animateNumber(el, to, suffix = '') {
  const from = Number(el.dataset.v || 0);
  el.dataset.v = to;
  if (!Number.isFinite(to)) { el.textContent = '—'; return; }
  const t0 = performance.now(), dur = 420;
  const tick = now => {
    const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
    el.textContent = Math.round(from + (to - from) * e) + suffix;
    if (k < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
function renderFairness() {
  const f = spawnFairness();
  const arc = $('gaugeArc');
  if (f.score) {
    animateNumber($('fairnessSummary'), f.score);
    arc.style.strokeDasharray = `${f.score} 100`;
    arc.dataset.level = f.score >= 80 ? 'good' : f.score >= 60 ? 'warn' : 'bad';
    const cls = f.score >= 80 ? 'good' : f.score >= 60 ? 'warn' : 'bad';
    $('fairnessReport').innerHTML = `公平度 <strong class="${cls}">${f.score}/100</strong><br>${f.text}<br><span>建议：${f.score < 70 ? '点击「智能重新布置」，或手动拖动出生点拉开间距' : f.nA !== f.nB ? '两队人数不等，可调整队伍分配' : '当前布局可用，可继续手动微调'}</span>`;
  } else {
    $('fairnessSummary').textContent = '—'; $('fairnessSummary').dataset.v = 0;
    arc.style.strokeDasharray = '0 100';
    $('fairnessReport').textContent = S.snapshot ? f.text : '生成地图后可查看：出生点间距、边缘距离、资源距离、两队平衡度。';
  }
}

/* ------------------------------------------------------------------ 出生点列表 UI */
function updateHumanSlotOptions() {
  const el = $('humanSlot');
  const p = currentSpawns();
  el.innerHTML = '';
  const o0 = document.createElement('option'); o0.value = ''; o0.textContent = p.length ? '选择出生点…' : '暂无出生点'; el.appendChild(o0);
  p.forEach((q, i) => { const o = document.createElement('option'); o.value = String(i); o.textContent = `玩家 ${i + 1}（${q[0] + 1}, ${q[1] + 1}）`; el.appendChild(o); });
  el.value = '';
  el.disabled = p.length < 2;
}
function updateStats() {
  const s = S.snapshot;
  if (!s) { $('stats').textContent = ''; return; }
  const [h, w] = dims();
  $('stats').textContent = `${w} × ${h} · 出生点 ${s.cc_positions?.length || 0} · 资源 ${s.resource_positions?.length || 0} · ${MIRROR_LABELS[s.meta?.mirroring] || '不对称'}`;
}
function updateSpawnUI() {
  updateStats();
  const p = currentSpawns();
  const [h, w] = dims();
  $('terrainSummary').textContent = w && h ? `${w}×${h}` : '—';
  animateNumber($('spawnSummary'), p.length);
  renderFairness();
  updateHumanSlotOptions();
  const list = $('spawnList');
  // 3.3.0：FLIP 重排动画 —— 记录旧行位置，重排后从旧位置平滑移动到新位置（而不是整列表闪烁重建）
  const oldTops = new Map();
  for (const el of list.children) if (el.dataset.key) oldTops.set(el.dataset.key, el.getBoundingClientRect().top);
  const cc = ccMapFor();
  const frag = document.createDocumentFragment();
  p.forEach((pos, i) => {
    const team = teamOf(pos, i);
    const gid = i < cc.capacity ? cc.gidForTeam(i) : 0;
    const row = document.createElement('div');
    row.className = 'spawn-row' + (i === S.selectedSpawn ? ' selected' : '') + (oldTops.has(keyOf(pos)) ? ' settled' : '') + (gid ? '' : ' over-cap');
    row.dataset.index = i;
    row.dataset.key = keyOf(pos);
    row.style.setProperty('--d', `${Math.min(i, 20) * 18}ms`);
    row.innerHTML = `<span class="spawn-badge team-${team}">${i + 1}</span>
      <div class="spawn-main"><b>玩家 ${i + 1}${i === 0 ? ' <em>P1</em>' : ''}</b><small>坐标 ${pos[0] + 1}, ${pos[1] + 1} · ${gid ? `team ${i} · GID ${gid}` : '超出瓦片集槽位，不会写入'}</small></div>
      <select class="spawn-team" aria-label="玩家 ${i + 1} 的队伍"><option value="A">队伍 A</option><option value="B">队伍 B</option></select>
      <button class="spawn-del" title="删除出生点" aria-label="删除玩家 ${i + 1}">✕</button>`;
    const sel = row.querySelector('.spawn-team');
    sel.value = team;
    // 3.3.0 修复：旧实现修改队伍只改了颜色，导出的玩家槽位不变（游戏里仍按原槽位分队）。
    // 现在修改队伍后按「槽位顺序」规则重排玩家槽位，并提示新的玩家编号。
    sel.onchange = () => changeSpawnTeam(pos, sel.value);
    sel.onclick = ev => ev.stopPropagation();
    row.querySelector('.spawn-del').onclick = ev => { ev.stopPropagation(); removeSpawnIndex(i); };
    row.onclick = () => { selectSpawn(i, true); };
    frag.appendChild(row);
  });
  list.replaceChildren(frag);
  if (oldTops.size && S.animate && typeof Element.prototype.animate === 'function') {
    for (const el of list.children) {
      const t0 = oldTops.get(el.dataset.key); if (t0 === undefined) continue;
      const dy = t0 - el.getBoundingClientRect().top;
      if (Math.abs(dy) > 1) el.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], { duration: 340, easing: 'cubic-bezier(.2,.8,.2,1)' });
    }
  }
  updateSlotBadge();
}
/* 槽位映射状态徽标：映射来源 · 容量 · 读回校验结果 */
function updateSlotBadge() {
  const el = $('slotBadge'); if (!el) return;
  const n = currentSpawns().length;
  if (!S.snapshot || !n) { el.hidden = true; return; }
  const cc = ccMapFor();
  el.hidden = false;
  const state = S.slotVerified === true ? 'ok' : S.slotVerified === false ? 'bad' : 'pending';
  el.dataset.state = state;
  el.innerHTML = `<i aria-hidden="true">${state === 'ok' ? '✓' : state === 'bad' ? '!' : '•'}</i><span>槽位映射：${CC_SOURCE_LABEL[cc.source]} · ${n}/${cc.capacity} · ${state === 'ok' ? '导出读回校验通过' : state === 'bad' ? '校验未通过' : '导出时自动写入并校验'}</span>`;
  if (n > cc.capacity) el.dataset.state = 'bad';
}
/* 3.3.0 新增：槽位映射表 —— 逐行列出 玩家 / team / GID / 坐标 / 队伍，并读回 TMX 核对 */
async function showSlotTable() {
  const p = currentSpawns();
  if (!p.length) { toast('暂无出生点', 'warn'); return; }
  let v = null;
  if (S.lastTmx) {
    if (!guard()) return;
    S.locked = true;
    try {
      busy(true, '正在写入并校验槽位…', '', null, { cancellable: false });
      if (S.unitsDirty) await syncTmxUnits();
      v = await verifySpawnMapping(S.lastTmx, p);
      S.slotVerified = v.ok; updateSlotBadge();
    } catch (e) { toast('校验失败：' + e.message, 'error'); }
    finally { busy(false); S.locked = false; }
  }
  const cc = ccMapFor();
  const rows = p.map((pos, i) => {
    const r = v?.rows[i];
    const gid = i < cc.capacity ? cc.gidForTeam(i) : 0;
    const team = teamOf(pos, i), want = slotTeamFor(i, p);
    const st = !gid ? '<span class="st bad">超出容量</span>' : !v ? '<span class="st">待生成</span>' : r?.ok ? '<span class="st ok">✓</span>' : '<span class="st bad">✕</span>';
    return `<tr style="--d:${Math.min(i, 24) * 16}ms"><td><b class="spawn-badge team-${team}">${i + 1}</b></td><td>${i}</td><td>${gid || '—'}</td><td>${pos[0] + 1}, ${pos[1] + 1}</td><td><span class="team-tag team-${team}">${team}</span>${team !== want && $('slotOrder').value !== 'engine' ? '<small class="warn-txt">≠槽位</small>' : ''}</td><td>${st}</td></tr>`;
  }).join('');
  const head = v ? (v.ok ? '<p class="help-p ok-txt">✓ 已读回导出 TMX 核对：每个玩家编号与 team 属性、坐标完全一致。</p>' : `<p class="help-p warn-txt">✕ 校验未通过${v.extra > 0 ? `：TMX 中有 ${v.extra} 个多余的指挥中心` : ''}${v.dups?.length ? `；team ${v.dups.join('、')} 重复` : ''}。</p>`)
    : '<p class="help-p">尚未生成 TMX，按内置蓝图的 50pCommandCenter 布局预测 GID；生成/导出时会自动写入并读回核对。</p>';
  uiChoice('出生点槽位映射表', `${head}
    <p class="help-p">映射来源：<b>${CC_SOURCE_LABEL[cc.source]}</b> · 可用槽位 ${cc.capacity} · 规则：玩家 N ⇔ team 属性 N-1 ⇔ 对应 GID。</p>
    <div class="slot-table-wrap"><table class="slot-table"><thead><tr><th>玩家</th><th>team</th><th>GID</th><th>坐标(行,列)</th><th>队伍</th><th>校验</th></tr></thead><tbody>${rows}</tbody></table></div>`,
  [{ key: 'reorder', label: '按队伍重排槽位' }, { key: 'ok', label: '知道了', primary: true }], { wide: true }).then(k => { if (k === 'reorder') $('spawnReorder').click(); });
}
function changeSpawnTeam(pos, team) {
  pushSpawnHistory();
  S.teamOverrides.set(keyOf(pos), team);
  const before = currentSpawns();
  if ($('slotOrder').value !== 'engine') {
    const after = orderBySlot(before);
    const oldI = before.findIndex(q => keyOf(q) === keyOf(pos)), newI = after.findIndex(q => keyOf(q) === keyOf(pos));
    if (after.some((q, i) => keyOf(q) !== keyOf(before[i]))) {
      setSpawns(after); S.selectedSpawn = newI;
      toast(`队伍已改为 ${team}，玩家槽位已重排${oldI !== newI ? `：玩家 ${oldI + 1} → 玩家 ${newI + 1}` : ''}`, 'success', 3600, { action: { label: '撤销', fn: () => undoSpawn() } });
    }
  } else if (S.lastTmx) { S.unitsDirty = true; S.slotVerified = null; }
  afterSpawnChange();
}
/* 3.3.0 修复：旧版「设为玩家 1」把选中点 unshift 到首位，其后所有出生点整体后移一位，
 * 在交替排序下所有人的队伍奇偶都被打乱。现在改为「交换」：交替模式整对交换（保持镜像对手关系），
 * 其他模式只交换两个槽位；被交换的两点同时交换队伍归属，其余玩家的编号与队伍完全不变。 */
function makePlayerOne(idx) {
  const p = currentSpawns();
  if (idx <= 0 || idx >= p.length) return;
  pushSpawnHistory();
  const swapTeams = (i, j) => {
    const ki = keyOf(p[i]), kj = keyOf(p[j]), ti = teamOf(p[i], i), tj = teamOf(p[j], j);
    S.teamOverrides.set(ki, tj); S.teamOverrides.set(kj, ti);
    [p[i], p[j]] = [p[j], p[i]];
  };
  if ($('slotOrder').value === 'alternate' && p.length >= 2) {
    const base = idx - (idx % 2);
    if (base > 0) {
      [p[0], p[base]] = [p[base], p[0]];
      if (base + 1 < p.length) [p[1], p[base + 1]] = [p[base + 1], p[1]];
    }
    if (idx % 2) swapTeams(0, 1);
  } else swapTeams(0, idx);
  setSpawns(p); S.selectedSpawn = 0; afterSpawnChange();
  toast(`已将原玩家 ${idx + 1} 设为玩家 1（其余玩家槽位不变）`, 'success', 3600, { action: { label: '撤销', fn: () => undoSpawn() } });
}
function selectSpawn(i, center = false) {
  S.selectedSpawn = i;
  document.querySelectorAll('.spawn-row').forEach(x => x.classList.toggle('selected', Number(x.dataset.index) === i));
  if (i >= 0) {
    const row = document.querySelector(`.spawn-row[data-index="${i}"]`);
    row?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    if (center) {
      const pos = currentSpawns()[i];
      const r = $('map').getBoundingClientRect();
      const z = Math.max(S.view.zoom, Math.min(6, S.view.zoom * 1.6));
      animateViewTo(r.width / 2 - (pos[1] + 0.5) * z, r.height / 2 - (pos[0] + 0.5) * z, z);
    }
  }
  scheduleRender();
}

/* ------------------------------------------------------------------ 快照应用 */
function setSnapshot(s, { fit = false, fade = false } = {}) {
  if (!s) return;
  S.snapshot = s;
  const done = s.meta?.completed_step ?? -1;
  if (S.source === 'engine' && done + 1 > S.step) S.step = clamp(done + 1, 0, 5);
  $('emptyState').classList.toggle('hide', true);
  if (fade) S.fadeStart = performance.now();
  updateSpawnUI();
  updateSteps(done);
  if (fit || !S.view.fitted) fitView(); else scheduleRender();
}
/* 根据操作类型决定出生点目标数量（修复：旧实现在「海岸线」第 1 步就自动铺满出生点；
 * 随机资源/完成地图会把手动布局补齐到参数数量；撤销/清空出生点被 JS 覆盖层立即还原）。 */
function spawnTargetFor(action) {
  switch (action) {
    case 'quick_generate': return intOf('players', 0, MAX_SPAWN_POINTS, DEFAULTS.players);
    case 'run_coastline': case 'set_coastline_from_image': case 'run_height_ocean': case 'reset_state': return 0;
    default: return S.spawnAuthority ? S.spawnAuthority.length : (S.snapshot?.cc_positions?.length || 0);
  }
}
function applySpawnPolicy(s, action) {
  const target = spawnTargetFor(action);
  if (target <= 0) { s.cc_positions = []; S.spawnAuthority = []; S.teamOverrides.clear(); return { lost: 0 }; }
  const base = action === 'quick_generate' || !S.spawnAuthority ? enginePositionsBySlot(s) : S.spawnAuthority;
  const keep = base.filter(p => spawnCellValid(s, p[0], p[1])).slice(0, target);
  const lost = Math.min(target, base.length) - keep.length;
  const mirrorMode = s.meta?.mirroring || $('mirror').value;
  let positions = keep;
  if (positions.length < target) positions = placeSpawns(s, target, mirrorMode, keep);
  /* 3.2.0 修复：「自动优化：开/关」按钮此前只切换文案，没有任何实际效果。
   * 现在：开启时额外跑一次 JS 最远点布局，与引擎布局比较公平度，取得分更高且数量不少于引擎的方案；
   * 关闭时完全保留引擎原始布局（不足时才由 JS 补齐）。 */
  let optimized = false;
  if (action === 'quick_generate' && S.smartPlacement && target >= 2) {
    const alt = placeSpawns(s, target, mirrorMode, []);
    if (alt.length >= positions.length) {
      const fa = spawnFairness(alt, s).score, fb = spawnFairness(positions, s).score;
      if (fa > fb) { positions = alt; optimized = fa - fb; }
    }
  }
  if (action === 'quick_generate') { S.teamOverrides.clear(); S.snapshot = s; positions = orderBySlot(positions); }
  markSpawnPop(positions, action === 'quick_generate');
  s.cc_positions = positions.map(p => [...p]);
  S.spawnAuthority = positions.map(p => [...p]);
  return { lost, short: target - positions.length, optimized };
}
const FRESH_MAP_ACTIONS = new Set(['quick_generate', 'run_coastline', 'set_coastline_from_image']);
async function applyEngineResult(action, r, label) {
  if (!r) return;
  if (r.tmx_bytes?.length) { S.lastTmx = r.tmx_bytes; S.tmxDirty = false; S.unitsDirty = true; S.slotVerified = null; setExportEnabled(true); }
  else if (S.lastTmx && r.snapshot && !NON_MUTATING.has(action)) S.tmxDirty = true;
  if (!r.snapshot) return;
  const s = r.snapshot;
  S.source = 'engine';
  S.snapshotEpoch = S.engineEpoch;
  const prev = S.snapshot;
  const res = applySpawnPolicy(s, action);
  if (res.lost > 0 && !FRESH_MAP_ACTIONS.has(action) && action !== 'quick_generate') toast(`${res.lost} 个出生点与新地形/资源冲突，已自动重新安置`, 'warn');
  if (res.short > 0) toast(`合法地形不足，仅放置了 ${s.cc_positions.length} 个出生点`, 'warn', 4000);
  S.lastOptimized = res.optimized || 0;
  const fresh = FRESH_MAP_ACTIONS.has(action);
  const [nr, nc] = dimsOf(s), [or, oc] = prev ? dimsOf(prev) : [0, 0];
  if (fresh) { S.selectedSpawn = -1; }
  setSnapshot(s, { fit: fresh && (nr !== or || nc !== oc || !S.view.fitted), fade: fresh });
  if (S.animate && r.frames?.length) await playFrames(r.frames.map(f => ({ height: f })), label);
  if (S.animate && r.quick_frames?.length) await playFrames(r.quick_frames.map(f => ({ height: f.height_map, items: f.items_matrix, units: f.units_matrix })), label);
  updateDirtyNote();
}
function setExportEnabled(on) { $('export').disabled = !on; $('exportZip').disabled = !on; if ($('fabExport')) $('fabExport').disabled = !on; if ($('pngPreview')) $('pngPreview').disabled = !on; }
function updateDirtyNote() { $('dirtyNote').hidden = !(S.lastTmx && S.tmxDirty && S.source === 'engine'); }

/* ------------------------------------------------------------------ 操作执行（统一忙碌、错误、自动保存） */
function guard() {
  if (S.locked) { toast('正在处理中，请稍候…', 'warn'); return false; }
  return true;
}
async function locked(fn) {
  if (!guard()) return;
  S.locked = true;
  $('generate').classList.add('loading'); $('fabGenerate')?.classList.add('loading');
  try { return await fn(); }
  catch (e) { if (!(e instanceof EngineError)) { console.error(e); toast('操作失败：' + (e?.message || e), 'error'); } return undefined; } // 引擎错误已在 run() 中提示
  finally { S.locked = false; $('generate').classList.remove('loading'); $('fabGenerate')?.classList.remove('loading'); }
}
function engineStateUsable(action) {
  if (!ENGINE_STATEFUL.has(action)) return true;
  if (S.source === 'import') { toast('导入/恢复的地图仅支持出生点编辑与导出；如需完整编辑请先「生成海岸线」或重新生成地图', 'warn', 4200); return false; }
  if (S.source === 'engine' && S.snapshotEpoch !== S.engineEpoch) { toast('引擎已重启，旧的分步编辑进度已失效，请从「① 海岸线」重新开始', 'warn', 4200); return false; }
  return true;
}
async function run(action, payload = {}, label = '正在处理…', opts = {}) {
  if (!engineStateUsable(action)) throw new EngineError('engine-state', { cancelled: true });
  busy(true, label, opts.stage || '', opts.progress ?? null);
  setStatus(label);
  try {
    const r = await Engine.call(action, payload, opts.transfer);
    await applyEngineResult(action, r, label);
    if (!opts.silent) setStatus((opts.done || label.replace(/^正在/, '').replace(/（.*?）/, '').replace(/…$/, '') + '完成') + (r?.elapsed_ms != null ? `（${(r.elapsed_ms / 1000).toFixed(1)}s）` : ''));
    queueAutoSave();
    return r;
  } catch (e) {
    if (e.cancelled) { setStatus('操作已取消'); if (e.message !== 'engine-state') toast('操作已取消', 'info'); }
    else { setStatus('操作失败：' + e.message); if (!opts.quietError) toast('操作失败：' + e.message, 'error', 4200); }
    throw e;
  } finally {
    if (!opts.keepBusy) busy(false);
  }
}

/* ------------------------------------------------------------------ 生成流程 */
async function blueprint() {
  const t = intOf('tileset', 1, 5, 5);
  const r = await fetch(`./blueprints/generator_blueprint${t}.tmx`);
  if (!r.ok) throw new Error(`地形模板 ${t} 不存在`);
  return r.text();
}
function resetEditorState() {
  S.polygons = []; S.drawingPolygon = null; S.selectedPolygonId = null; S.selectedEdgeIndex = null;
  S.polyUndo = []; S.polyRedo = []; S.polygonSeq = 1;
  S.spawnAuthority = null; S.teamOverrides.clear(); S.selectedSpawn = -1;
  S.spawnHistory = []; S.spawnRedo = []; S.history = []; S.redoHistory = [];
  S.randomResourceKeys.clear();
  spawnPop.clear();
  updatePolygonInfo();
  updateUndoButtons();
}
async function generate() {
  return locked(async () => {
    stopAnimation();
    const p = params(), area = p.width * p.height;
    resetEditorState();
    S.mode === 'wizard' || (S.tool = 'pan');
    const t0 = performance.now();
    try {
      if (area > LARGE_MAP_AREA) {
        // 大地图：分步生成，避免 quick_generate 一次性返回大量动画帧导致内存峰值。
        // 优化：先放资源再由 JS 放出生点（出生点会自动避开资源池），并省去一次多余的整图快照传输。
        await run('run_coastline', p, '正在生成海岸线（大地图优化）…', { keepBusy: true, stage: '1/4' });
        await run('run_height_ocean', { heightLevels: p.heightLevels, oceanLevels: p.oceanLevels, wallMagnetism: 0 }, '正在生成高度与海洋（大地图优化）…', { keepBusy: true, stage: '2/4' });
        await run('place_resource_random', { mirroring: p.mirroring, numResources: p.numResources }, '正在布置资源点（大地图优化）…', { keepBusy: true, stage: '3/4' });
        busy(true, '正在智能布置出生点…', '3/4');
        await nextFrame();
        try { await smartPlaceAll(p.numPlayers, { history: false, quiet: true, allowPartial: true }); }
        catch (e) { toast(e.message, 'warn', 5000); }
        await run('run_finalize', { blueprintXml: await blueprint() }, '正在完成地图并生成 TMX（大地图优化）…', { stage: '4/4' });
      } else {
        const bp = await blueprint();
        try {
          await run('quick_generate', { ...p, blueprintXml: bp }, '正在生成完整地图…', { quietError: true });
        } catch (e) {
          if (e.cancelled) throw e;
          // 引擎内置的指挥中心搜索在「多人 + 双轴对称」等组合下会越界 panic，panic 后 WASM 实例永久失效。
          // Engine 已自动重建 Worker；这里以 numPlayers=0 重试，出生点改由 JS 智能布局补齐。
          console.warn('quick_generate 失败，改用 JS 布点重试：', e.raw || e.message);
          setStatus('引擎布点失败，正在以本地智能布点重试…');
          await Engine.ready;
          await run('quick_generate', { ...p, numPlayers: 0, blueprintXml: bp }, '正在重新生成完整地图…');
        }
      }
      const sec = ((performance.now() - t0) / 1000).toFixed(1);
      setStatus(`地图生成完成（${sec}s）`);
      toast(`地图生成完成 · ${p.width}×${p.height} · 出生点 ${currentSpawns().length}${S.lastOptimized ? ` · 已自动优化布局（公平度 +${S.lastOptimized}）` : ''}`, 'success', 3400);
      S.lastOptimized = 0;
      pulseMap();
    } catch (e) {
      if (!e.cancelled && !/^操作失败/.test($('status').textContent)) { setStatus('生成失败：' + e.message); toast('生成失败：' + e.message, 'error', 4200); }
    } finally { busy(false); }
  });
}
async function action(a, fromGlobal = false) {
  return locked(async () => {
    const p = params();
    if (a === 'run_coastline') {
      resetEditorState(); setStep(0, false);
      return run(a, p, '正在生成海岸线…');
    }
    if (a === 'run_height_ocean') {
      const seedRaw = $('seed').value.trim();
      const payload = { heightLevels: p.heightLevels, oceanLevels: p.oceanLevels, wallMagnetism: intOf('wallMagnetism', 0, 100, 0) };
      if (seedRaw !== '' && Number.isFinite(Number(seedRaw))) payload.seed = Math.trunc(Number(seedRaw)) | 0;
      return run(a, payload, '正在生成高度与海洋…');
    }
    if (a === 'place_cc_random') {
      if (!S.snapshot) { toast('请先生成地形', 'warn'); return; }
      setStep(3);
      busy(true, '正在智能布置出生点…'); await nextFrame();
      try {
        if (p.numPlayers < 1) toast('「出生点数量」为 0，请先在参数中设置出生点数量', 'warn');
        else await smartPlaceAll(p.numPlayers, { allowPartial: true });
      } catch (e) { toast('随机布置失败：' + e.message, 'error', 4200); } finally { busy(false); }
      return;
    }
    if (a === 'undo_cc') { if (S.spawnHistory.length) undoSpawn(); else { const c = currentSpawns(); if (!c.length) { toast('没有可撤销的出生点'); return; } pushSpawnHistory(); const gone = c.pop(); S.teamOverrides.delete(keyOf(gone)); setSpawns(c); afterSpawnChange(); } return; }
    if (a === 'clear_cc') {
      if (!currentSpawns().length) return;
      pushSpawnHistory(); S.teamOverrides.clear(); setSpawns([]); afterSpawnChange();
      toast('已清空全部出生点', 'info', 5000, { action: { label: '撤销', fn: () => undoSpawn() } }); return;
    }
    if (a === 'place_resource_random') {
      setStep(4);
      const r = await run(a, { mirroring: p.mirroring, numResources: p.numResources }, '正在随机布置资源点…');
      S.randomResourceKeys = new Set((r?.snapshot?.resource_positions || []).map(keyOf));
      return r;
    }
    if (a === 'run_finalize') return runFinalize();
    if (a === 'undo_brush' && !fromGlobal) syncLocal('brush', 'undo');
    if (a === 'redo_brush' && !fromGlobal) syncLocal('brush', 'redo');
    if (a === 'undo_polygons') return undoPolygonLocal();
    if (a === 'redo_polygons') return redoPolygonLocal();
    if (a === 'clear_all_polygons') return clearPolygonsLocal();
    if (a === 'clear_resource' || a === 'clear_brush_walls') {
      const ok = await uiConfirm('确认清空', a === 'clear_resource' ? '将移除全部资源点。' : '将清空全部画笔墙体（可用撤销恢复）。', '清空', true);
      if (!ok) return;
    }
    const label = { undo_brush: '正在撤销画笔…', redo_brush: '正在重做画笔…', clear_brush_walls: '正在清空墙体…', undo_resource: '正在撤销资源点…', clear_resource: '正在清空资源点…' }[a] || '正在处理地图…';
    return run(a, {}, label);
  });
}
async function runFinalize() {
  if (!S.snapshot || S.source !== 'engine') { toast('请先生成高度与海洋', 'warn'); return; }
  if ((S.snapshot.meta?.completed_step ?? -1) < 2 && !getMatrix('height_map')) { toast('请先完成「③ 高度与海洋」步骤', 'warn'); return; }
  setStep(5);
  const n = intOf('players', 0, MAX_SPAWN_POINTS, 10);
  if (!currentSpawns().length && n > 0) {
    try { const got = await smartPlaceAll(n, { quiet: true, allowPartial: true }); toast(`未放置出生点，已自动智能布置 ${got.length} 个`, 'info'); }
    catch (e) { toast(e.message, 'warn', 4200); }
  }
  const r = await run('run_finalize', { blueprintXml: await blueprint() }, '正在完成地图并生成 TMX…', { done: '地图已完成，TMX 已生成' });
  toast('TMX 已生成，可以导出了', 'success');
  return r;
}

/* ------------------------------------------------------------------ 多边形 */
const clonePolys = () => S.polygons.map(p => ({ ...p, vertices: p.vertices.map(v => [...v]), edgeGaps: [...(p.edgeGaps || [])] }));
function pushPolyUndo() { S.polyUndo.push(clonePolys()); if (S.polyUndo.length > 40) S.polyUndo.shift(); S.polyRedo = []; pushGlobal('polygon'); }
/* 3.4.0：多边形同步串行化。闭合多边形时 applyPolygons 未 await，连续快速编辑会让多个 update_polygons 响应
 * 乱序到达，较早的响应覆盖较新的快照（多边形“回退”）。现在排队执行，并且只应用最后一次请求的结果。 */
let polySyncChain = Promise.resolve(), polySyncSeq = 0;
function applyPolygons() {
  const my = ++polySyncSeq;
  polySyncChain = polySyncChain.then(() => (my === polySyncSeq ? applyPolygonsNow() : undefined)).catch(() => {});
  return polySyncChain;
}
async function applyPolygonsNow() {
  if (!engineStateUsable('update_polygons')) return;
  try {
    const r = await Engine.call('update_polygons', { polygons: S.polygons.map(p => ({ id: p.id, vertices: p.vertices, edgeGaps: p.edgeGaps, closed: p.closed })) });
    // 修复：旧实现直接 setSnapshot，Rust 快照中没有 JS 出生点，导致编辑多边形后出生点从画面消失
    await applyEngineResult('update_polygons', r, '多边形');
    queueAutoSave();
  } catch (e) { if (!e.cancelled) toast('多边形同步失败：' + e.message, 'error'); }
}
async function undoPolygonLocal(fromGlobal = false) {
  if (!S.polyUndo.length) { toast('没有可撤销的多边形'); return false; }
  if (!fromGlobal) syncLocal('polygon', 'undo');
  S.polyRedo.push(clonePolys()); S.polygons = S.polyUndo.pop();
  S.selectedPolygonId = null; S.selectedEdgeIndex = null;
  await applyPolygons(); updatePolygonInfo(); scheduleRender(); updateUndoButtons();
  return true;
}
async function redoPolygonLocal(fromGlobal = false) {
  if (!S.polyRedo.length) { toast('没有可重做的多边形'); return false; }
  if (!fromGlobal) syncLocal('polygon', 'redo');
  S.polyUndo.push(clonePolys()); S.polygons = S.polyRedo.pop();
  S.selectedPolygonId = null; S.selectedEdgeIndex = null;
  await applyPolygons(); updatePolygonInfo(); scheduleRender(); updateUndoButtons();
  return true;
}
async function clearPolygonsLocal() {
  if (!S.polygons.length && !S.drawingPolygon) return;
  pushPolyUndo(); S.polygons = []; S.drawingPolygon = null; S.selectedPolygonId = null; S.selectedEdgeIndex = null;
  await applyPolygons(); updatePolygonInfo(); scheduleRender();
}
function polygonClickAt(p) {
  if (!S.drawingPolygon) {
    if (S.polygons.length) { selectPolygon(p); if (S.selectedPolygonId !== null) return; }
    S.drawingPolygon = { id: S.polygonSeq++, vertices: [[p.row, p.col]], edgeGaps: [], closed: false };
    updatePolygonInfo(); scheduleRender(); return;
  }
  const dp = S.drawingPolygon, first = dp.vertices[0];
  const tol = Math.max(1, Math.ceil(10 / S.view.zoom));
  const close = Math.abs(first[0] - p.row) <= tol && Math.abs(first[1] - p.col) <= tol && dp.vertices.length >= 3;
  if (close) {
    dp.closed = true; dp.edgeGaps = new Array(dp.vertices.length).fill(false);
    pushPolyUndo(); S.polygons.push(dp); S.selectedPolygonId = dp.id; S.drawingPolygon = null;
    applyPolygons(); toast('多边形已闭合', 'success');
  } else {
    const last = dp.vertices[dp.vertices.length - 1];
    if (last[0] !== p.row || last[1] !== p.col) dp.vertices.push([p.row, p.col]);
  }
  updatePolygonInfo(); scheduleRender();
}
function selectPolygon(p) {
  let best = null, bestD = Infinity;
  for (const poly of S.polygons) {
    for (let i = 0; i < poly.vertices.length; i++) {
      const [r, c] = poly.vertices[i], d = (r - p.row) ** 2 + (c - p.col) ** 2;
      if (d < bestD) { bestD = d; best = { id: poly.id, edge: null }; }
      if (poly.closed) {
        const [r2, c2] = poly.vertices[(i + 1) % poly.vertices.length];
        const dr = r2 - r, dc = c2 - c, len = dr * dr + dc * dc || 1;
        const t = clamp(((p.row - r) * dr + (p.col - c) * dc) / len, 0, 1);
        const ed = (r + t * dr - p.row) ** 2 + (c + t * dc - p.col) ** 2;
        if (ed < bestD) { bestD = ed; best = { id: poly.id, edge: i }; }
      }
    }
  }
  const tol = Math.max(4, (12 / S.view.zoom)) ** 2;
  if (best && bestD <= tol) { S.selectedPolygonId = best.id; S.selectedEdgeIndex = best.edge; }
  else { S.selectedPolygonId = null; S.selectedEdgeIndex = null; }
  updatePolygonInfo(); scheduleRender();
}
function updatePolygonInfo() {
  const p = S.polygons.find(x => x.id === S.selectedPolygonId);
  $('polygonInfo').textContent = p
    ? `已选中：多边形 ${p.id} · ${p.vertices.length} 个顶点${S.selectedEdgeIndex !== null ? ' · 边 ' + (S.selectedEdgeIndex + 1) : ''}`
    : `当前多边形：${S.polygons.length} 个 · ${S.drawingPolygon ? `正在绘制 ${S.drawingPolygon.vertices.length} 点（点击起点闭合）` : '暂无选中'}`;
}
async function toggleGap() {
  if (S.selectedPolygonId == null || S.selectedEdgeIndex == null) { toast('请先点击多边形的边进行选择'); return; }
  const p = S.polygons.find(x => x.id === S.selectedPolygonId); if (!p) return;
  pushPolyUndo(); p.edgeGaps[S.selectedEdgeIndex] = !p.edgeGaps[S.selectedEdgeIndex];
  S.selectedEdgeIndex = null; await applyPolygons(); updatePolygonInfo(); scheduleRender();
}
async function deleteSelectedPolygon() {
  if (S.selectedPolygonId == null) { toast('请先选中一个多边形'); return; }
  pushPolyUndo(); S.polygons = S.polygons.filter(p => p.id !== S.selectedPolygonId);
  S.selectedPolygonId = null; S.selectedEdgeIndex = null; await applyPolygons(); updatePolygonInfo(); scheduleRender();
}

/* ------------------------------------------------------------------ 渲染：离屏缓存
 * 修复/优化：
 *  - 缓存改为 WeakMap（随快照自动回收，旧实现 Map 手动淘汰在多矩阵交替时反复重算）
 *  - 墙体叠加层也离屏缓存（旧实现每帧逐格 fillRect，大地图平移/缩放明显卡顿）
 *  - 新配色：分层设色 + 简易山体阴影，水深渐变，层级更清晰
 */
const baseCache = new WeakMap();
const wallCache = new WeakMap();
const LAND_STOPS = [[0, [214, 197, 130]], [0.18, [128, 182, 92]], [0.42, [74, 140, 70]], [0.62, [122, 104, 70]], [0.8, [140, 140, 142]], [1, [236, 241, 244]]];
function lerpStops(stops, t) {
  for (let i = 1; i < stops.length; i++) {
    if (t <= stops[i][0]) {
      const [t0, a] = stops[i - 1], [t1, b] = stops[i], k = (t - t0) / Math.max(1e-6, t1 - t0);
      return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
    }
  }
  return stops[stops.length - 1][1];
}
function sampleMatrix(m, maxW = 1024) {
  if (!m?.shape || !m.data) return null;
  const rows = m.shape[0], cols = m.shape[1];
  const scale = Math.max(1, Math.ceil(Math.max(rows, cols) / maxW));
  const w = Math.ceil(cols / scale), h = Math.ceil(rows / scale), data = new Int32Array(w * h);
  for (let y = 0; y < h; y++) {
    const sy = Math.min(rows - 1, y * scale + (scale >> 1));
    for (let x = 0; x < w; x++) data[y * w + x] = m.data[sy * cols + Math.min(cols - 1, x * scale + (scale >> 1))] || 0;
  }
  return { rows: h, cols: w, data, scale };
}
function baseCanvasFor(m) {
  if (!m?.shape || !m?.data) return null;
  const hit = baseCache.get(m); if (hit) return hit;
  const sm = sampleMatrix(m); if (!sm) return null;
  let mn = Infinity, mx = -Infinity;
  for (const v of sm.data) { if (v < mn) mn = v; if (v > mx) mx = v; }
  const off = document.createElement('canvas'); off.width = sm.cols; off.height = sm.rows;
  const oc = off.getContext('2d'), img = oc.createImageData(sm.cols, sm.rows), d = img.data;
  const W = sm.cols, landSpan = Math.max(1, mx - 1), deep = Math.max(1, Math.abs(Math.min(mn, 0)) + 1);
  for (let i = 0; i < sm.data.length; i++) {
    const v = sm.data[i];
    let r, g, b;
    if (v <= 0) {
      const q = clamp((Math.abs(v) + 1) / deep, 0, 1);
      r = 46 - 36 * q; g = 126 - 86 * q; b = 190 - 104 * q;
      // 浅滩：紧邻陆地的水面提亮
      const x = i % W, y = (i / W) | 0;
      if ((x > 0 && sm.data[i - 1] > 0) || (x < W - 1 && sm.data[i + 1] > 0) || (y > 0 && sm.data[i - W] > 0) || (y < sm.rows - 1 && sm.data[i + W] > 0)) { r += 30; g += 40; b += 30; }
    } else {
      [r, g, b] = lerpStops(LAND_STOPS, clamp((v - 1) / landSpan, 0, 1));
      const x = i % W, y = (i / W) | 0;
      if (x > 0 && y > 0) {
        const nw = sm.data[i - W - 1];
        if (v > nw) { r *= 1.14; g *= 1.14; b *= 1.14; } else if (v < nw) { r *= 0.8; g *= 0.8; b *= 0.8; }
      }
    }
    d[i * 4] = r; d[i * 4 + 1] = g; d[i * 4 + 2] = b; d[i * 4 + 3] = 255;
  }
  oc.putImageData(img, 0, 0);
  baseCache.set(m, off);
  return off;
}
function wallCanvasFor(m, kind = 'brush') {
  if (!m?.shape || !m?.data) return null;
  const polygonMode = kind === 'polygon', itemsMode = kind === 'items';
  const hit = wallCache.get(m); if (hit && hit.kind === kind) return hit.canvas;
  const sm = sampleMatrix(m); if (!sm) return null;
  const off = document.createElement('canvas'); off.width = sm.cols; off.height = sm.rows;
  const oc = off.getContext('2d'), img = oc.createImageData(sm.cols, sm.rows), d = img.data;
  let any = false;
  for (let i = 0; i < sm.data.length; i++) {
    const v = sm.data[i]; if (!v) continue;
    any = true;
    if (itemsMode) { d[i * 4] = 85; d[i * 4 + 1] = 230; d[i * 4 + 2] = 165; d[i * 4 + 3] = 230; }
    else if (polygonMode) {
      if (v < 0) { d[i * 4] = 80; d[i * 4 + 1] = 225; d[i * 4 + 2] = 235; d[i * 4 + 3] = 120; }
      else { d[i * 4] = 255; d[i * 4 + 1] = 255; d[i * 4 + 2] = 255; d[i * 4 + 3] = Math.min(110, 26 * v); }
    } else if (v === 2) { d[i * 4] = 80; d[i * 4 + 1] = 225; d[i * 4 + 2] = 235; d[i * 4 + 3] = 170; }
    else { d[i * 4] = 245; d[i * 4 + 1] = 172; d[i * 4 + 2] = 66; d[i * 4 + 3] = 215; }
  }
  if (!any) { wallCache.set(m, { canvas: null, kind }); return null; }
  oc.putImageData(img, 0, 0);
  wallCache.set(m, { canvas: off, kind });
  return off;
}

/* ------------------------------------------------------------------ 渲染：视图 */
let renderQueued = false;
function scheduleRender() { if (renderQueued) return; renderQueued = true; requestAnimationFrame(() => { renderQueued = false; renderMap(); }); }
function fitCanvas() {
  const c = $('map'), rect = c.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = Math.max(1, Math.floor(rect.width * dpr)), h = Math.max(1, Math.floor(rect.height * dpr));
  if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
  return [rect, dpr];
}
function viewInsets() {
  const panel = $('mapPanel').getBoundingClientRect();
  const tb = document.querySelector('.toolbar').getBoundingClientRect();
  const narrow = panel.width < 560;
  return {
    top: Math.max(12, tb.bottom - panel.top + 12),
    bottom: narrow ? 64 : 56,
    left: $('toolPalette').hidden ? 16 : (narrow ? 16 : 76),
    right: narrow ? 16 : 64
  };
}
function fitView(animate = false) {
  const [rows, cols] = dims(); if (!rows || !cols) { scheduleRender(); return; }
  const rect = $('map').getBoundingClientRect(), ins = viewInsets();
  const aw = Math.max(40, rect.width - ins.left - ins.right), ah = Math.max(40, rect.height - ins.top - ins.bottom);
  const z = clamp(Math.min(aw / cols, ah / rows), 0.05, 40);
  const x = ins.left + (aw - cols * z) / 2, y = ins.top + (ah - rows * z) / 2;
  S.view.fitted = true;
  if (animate) animateViewTo(x, y, z); else { S.view.zoom = z; S.view.x = x; S.view.y = y; scheduleRender(); }
}
let viewAnim = null;
function animateViewTo(x, y, zoom, dur = 280) {
  cancelAnimationFrame(viewAnim);
  const from = { ...S.view }, t0 = performance.now();
  const tick = now => {
    const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
    S.view.zoom = from.zoom + (zoom - from.zoom) * e;
    S.view.x = from.x + (x - from.x) * e;
    S.view.y = from.y + (y - from.y) * e;
    renderMap();
    if (k < 1) viewAnim = requestAnimationFrame(tick);
  };
  viewAnim = requestAnimationFrame(tick);
}
function zoomAt(factor, mx, my, animate = true) {
  const r = $('map').getBoundingClientRect();
  if (mx == null) { mx = r.width / 2; my = r.height / 2; }
  const old = S.view.zoom, next = clamp(old * factor, 0.05, 40);
  const ux = (mx - S.view.x) / old, uy = (my - S.view.y) / old;
  S.view.fitted = false;
  if (animate) animateViewTo(mx - ux * next, my - uy * next, next, 160);
  else { S.view.zoom = next; S.view.x = mx - ux * next; S.view.y = my - uy * next; scheduleRender(); }
}
function cellFromPoint(clientX, clientY) {
  const r = $('map').getBoundingClientRect(), [rows, cols] = dims();
  if (!rows || !cols) return null;
  const x = (clientX - r.left - S.view.x) / S.view.zoom, y = (clientY - r.top - S.view.y) / S.view.zoom;
  return { row: Math.floor(y), col: Math.floor(x), x, y };
}
function validCell(p) { const [rows, cols] = dims(); return !!p && p.row >= 0 && p.col >= 0 && p.row < rows && p.col < cols; }
const toScreen = (r, c) => [S.view.x + (c + 0.5) * S.view.zoom, S.view.y + (r + 0.5) * S.view.zoom];

/* ------------------------------------------------------------------ 渲染：主画布 */
function cssVar(name) { return getComputedStyle(document.body).getPropertyValue(name).trim(); }
let canvasBg = '#050b14';
function paintBackground(ctx, w, h) {
  ctx.fillStyle = canvasBg; ctx.fillRect(0, 0, w, h);
}
function drawImageLayer(ctx, canvas, rows, cols, alpha = 1) {
  if (!canvas) return;
  ctx.save(); ctx.globalAlpha = alpha; ctx.imageSmoothingEnabled = false;
  ctx.drawImage(canvas, S.view.x, S.view.y, cols * S.view.zoom, rows * S.view.zoom);
  ctx.restore();
}
function drawFrame(ctx, rows, cols) {
  // 地图边框 + 柔和投影
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = 18;
  ctx.fillStyle = canvasBg;
  ctx.fillRect(S.view.x, S.view.y, cols * S.view.zoom, rows * S.view.zoom);
  ctx.restore();
}
function drawResources(ctx, positions) {
  const z = S.view.zoom, s = clamp(z * 1.3, 3, 9);
  ctx.save();
  ctx.lineWidth = 1.4; ctx.strokeStyle = 'rgba(6,40,26,.85)'; ctx.fillStyle = '#55e6a5';
  for (const [r, c] of positions || []) {
    const [x, y] = toScreen(r, c);
    ctx.beginPath(); ctx.moveTo(x, y - s); ctx.lineTo(x + s, y); ctx.lineTo(x, y + s); ctx.lineTo(x - s, y); ctx.closePath();
    ctx.fill(); ctx.stroke();
  }
  ctx.restore();
}
function spawnRadius() { return clamp(S.view.zoom * 1.8, 6, 13); }
function drawSpawns(ctx, now) {
  const p = currentSpawns(); if (!p.length) return false;
  const R0 = spawnRadius();
  let animating = false;
  ctx.save();
  // 3.3.0：选中出生点时画出它的对位玩家（交替模式下 1↔2、3↔4…）连线，直观检查镜像对手是否正确
  const sel = S.selectedSpawn;
  if (sel >= 0 && sel < p.length && $('slotOrder').value === 'alternate') {
    const mate = sel ^ 1;
    if (mate < p.length) {
      const [x1, y1] = toScreen(...p[sel]), [x2, y2] = toScreen(...p[mate]);
      ctx.save(); ctx.setLineDash([7, 6]); ctx.lineDashOffset = -(now / 40) % 13;
      ctx.strokeStyle = 'rgba(255,212,92,.75)'; ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.restore();
    }
  }
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `700 ${Math.round(clamp(R0 * 1.1, 8, 13))}px system-ui,sans-serif`;
  p.forEach((q, i) => {
    if (drag?.type === 'spawn' && drag.index === i && drag.target && !drag.cancelled) return;
    const [x, y] = toScreen(q[0], q[1]);
    const team = teamOf(q, i);
    // 弹出动画（easeOutBack，360ms）
    let R = R0;
    const t0 = spawnPop.get(keyOf(q));
    if (t0 !== undefined) {
      const k = (now - t0) / 360;
      if (k >= 1) spawnPop.delete(keyOf(q));
      else { const c1 = 1.70158, c3 = c1 + 1, e = 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2); R = Math.max(0.5, R0 * e); animating = true; }
    }
    if (i === S.selectedSpawn) {
      const t = (now % 1400) / 1400;
      ctx.beginPath(); ctx.arc(x, y, R + 4 + t * 12, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255,212,92,${0.75 * (1 - t)})`; ctx.lineWidth = 2.5; ctx.stroke();
    }
    ctx.beginPath(); ctx.arc(x, y + 1.5, R, 0, Math.PI * 2); ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fill();
    ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2);
    const g = ctx.createRadialGradient(x - R * 0.35, y - R * 0.4, 1, x, y, R);
    g.addColorStop(0, '#fff3b8'); g.addColorStop(1, '#f2b829');
    ctx.fillStyle = g; ctx.fill();
    ctx.lineWidth = 2.2; ctx.strokeStyle = TEAM_COLORS[team] || '#2a1f00'; ctx.stroke();
    if (R >= 6) { ctx.fillStyle = '#3a2600'; ctx.fillText(String(i + 1), x, y + 0.5); }
  });
  // 选中点标签：玩家号 / team / 队伍
  if (sel >= 0 && sel < p.length) {
    const [x, y] = toScreen(...p[sel]), label = `玩家 ${sel + 1} · team ${sel} · ${teamOf(p[sel], sel)} 队`;
    ctx.font = '600 11px system-ui,sans-serif';
    const w = ctx.measureText(label).width + 14, h = 20, bx = x - w / 2, by = y - R0 - h - 8;
    ctx.fillStyle = 'rgba(10,16,28,.86)'; ctx.strokeStyle = TEAM_COLORS[teamOf(p[sel], sel)]; ctx.lineWidth = 1.2;
    ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(bx, by, w, h, 6); else ctx.rect(bx, by, w, h); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.textBaseline = 'middle'; ctx.fillText(label, x, by + h / 2 + 0.5);
  }
  ctx.restore();
  return animating;
}
function drawDragGhost(ctx) {
  if (drag?.type !== 'spawn' || !drag.target || drag.cancelled) return;
  const R = spawnRadius(), [x, y] = toScreen(drag.target.row, drag.target.col);
  const ok = spawnCellValid(S.snapshot, drag.target.row, drag.target.col);
  const [ox, oy] = toScreen(...currentSpawns()[drag.index]);
  ctx.save();
  ctx.setLineDash([4, 4]); ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(x, y); ctx.stroke(); ctx.setLineDash([]);
  ctx.globalAlpha = 0.9;
  ctx.beginPath(); ctx.arc(x, y, R + 2, 0, Math.PI * 2);
  ctx.fillStyle = ok ? 'rgba(255,212,92,.9)' : 'rgba(255,90,90,.85)'; ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = ok ? '#fff' : '#ffd0d0'; ctx.stroke();
  ctx.restore();
}
/* 与 Rust get_mirrored_positions 完全一致的镜像（画笔按地图对称方式自动镜像） */
function engineMirrors(r, c, rows, cols, m) {
  const out = [[r, c]];
  if (m === 'horizontal') out.push([rows - 1 - r, c]);
  else if (m === 'vertical') out.push([r, cols - 1 - c]);
  else if (m === 'diagonal1' && r < cols && c < rows) out.push([c, r]);
  else if (m === 'diagonal2' && c < rows && r < cols) out.push([rows - 1 - c, cols - 1 - r]);
  else if (m === 'both') out.push([rows - 1 - r, c], [r, cols - 1 - c], [rows - 1 - r, cols - 1 - c]);
  return out;
}
/* 3.2.0：画笔预览改为与引擎一致的方形笔刷，并同时预览镜像笔画（旧版只画圆点、不显示镜像，松手后才发现另一侧也被画上） */
function drawBrushPreview(ctx) {
  if (drag?.type !== 'paint' || drag.cancelled || !drag.points?.length) return;
  const z = S.view.zoom, rad = Math.floor(S.brushSize / 2), side = (rad * 2 + 1) * z;
  const [rows, cols] = dims(), m = S.snapshot?.meta?.mirroring || 'none';
  ctx.save();
  ctx.fillStyle = S.brushErasing ? 'rgba(255,255,255,.30)' : S.brushValue === 2 ? 'rgba(80,225,235,.5)' : 'rgba(245,172,66,.6)';
  ctx.beginPath();
  const pts = drag.points.length > 4000 ? drag.points.filter((_, i) => i % 2 === 0) : drag.points;
  for (const [r, c] of pts) {
    for (const [mr, mc] of engineMirrors(r, c, rows, cols, m)) {
      ctx.rect(S.view.x + (mc - rad) * z, S.view.y + (mr - rad) * z, Math.max(2, side), Math.max(2, side));
    }
  }
  ctx.fill();
  ctx.restore();
}
function drawHover(ctx) {
  if (!hoverCell || !validCell(hoverCell) || drag) return;
  const z = S.view.zoom;
  ctx.save();
  if (S.tool === 'brush') {
    const rad = Math.floor(S.brushSize / 2), side = Math.max(4, (rad * 2 + 1) * z);
    ctx.strokeStyle = S.brushErasing ? 'rgba(255,255,255,.8)' : S.brushValue === 2 ? 'rgba(80,225,235,.9)' : 'rgba(245,172,66,.9)';
    ctx.lineWidth = 1.4; ctx.setLineDash([4, 3]);
    ctx.strokeRect(S.view.x + (hoverCell.col - rad) * z + 0.5, S.view.y + (hoverCell.row - rad) * z + 0.5, side - 1, side - 1);
    ctx.setLineDash([]);
  } else if (z >= 4 && (S.tool === 'cc' || S.tool === 'resource' || S.tool === 'polygon')) {
    ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 1;
    ctx.strokeRect(S.view.x + hoverCell.col * z + 0.5, S.view.y + hoverCell.row * z + 0.5, z - 1, z - 1);
  }
  ctx.restore();
}
function drawPolygons(ctx) {
  const all = [...S.polygons]; if (S.drawingPolygon) all.push(S.drawingPolygon);
  const z = S.view.zoom;
  for (const p of all) {
    if (!p.vertices.length) continue;
    const sel = p.id === S.selectedPolygonId;
    ctx.beginPath();
    p.vertices.forEach(([r, c], i) => { const [x, y] = toScreen(r, c); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
    if (p === S.drawingPolygon && hoverCell && validCell(hoverCell)) { const [x, y] = toScreen(hoverCell.row, hoverCell.col); ctx.lineTo(x, y); }
    if (p.closed && p.vertices.length > 2) { ctx.closePath(); ctx.fillStyle = sel ? 'rgba(66,153,225,.16)' : 'rgba(45,212,191,.08)'; ctx.fill(); }
    ctx.strokeStyle = sel ? '#58a6ff' : '#37d39b'; ctx.lineWidth = clamp(z * 0.18, 1.5, 5); ctx.stroke();
    for (let i = 0; i < p.vertices.length; i++) {
      const [r, c] = p.vertices[i], [x, y] = toScreen(r, c);
      if (p.closed && p.edgeGaps?.[i]) {
        const [x2, y2] = toScreen(...p.vertices[(i + 1) % p.vertices.length]);
        ctx.save(); ctx.strokeStyle = '#ffbd5a'; ctx.lineWidth = clamp(z * 0.22, 2, 6); ctx.setLineDash([6, 5]);
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x2, y2); ctx.stroke(); ctx.restore();
      }
      if (sel && S.selectedEdgeIndex === i && p.closed) {
        const [x2, y2] = toScreen(...p.vertices[(i + 1) % p.vertices.length]);
        ctx.save(); ctx.strokeStyle = '#fff'; ctx.lineWidth = clamp(z * 0.3, 3, 7); ctx.globalAlpha = 0.6;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x2, y2); ctx.stroke(); ctx.restore();
      }
      ctx.fillStyle = i === 0 ? '#ffd45c' : sel ? '#58a6ff' : '#37d39b';
      ctx.beginPath(); ctx.arc(x, y, clamp(z * 0.35, 3, 7), 0, Math.PI * 2); ctx.fill();
    }
  }
}
function drawGrid(ctx, rows, cols) {
  if (!S.layers.grid || S.view.zoom < 4) return;
  const z = S.view.zoom, r = $('map').getBoundingClientRect();
  const c0 = clamp(Math.floor(-S.view.x / z), 0, cols), c1 = clamp(Math.ceil((r.width - S.view.x) / z), 0, cols);
  const r0 = clamp(Math.floor(-S.view.y / z), 0, rows), r1 = clamp(Math.ceil((r.height - S.view.y) / z), 0, rows);
  ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,.09)'; ctx.lineWidth = 1; ctx.beginPath();
  for (let c = c0; c <= c1; c++) { const x = Math.round(S.view.x + c * z) + 0.5; ctx.moveTo(x, S.view.y + r0 * z); ctx.lineTo(x, S.view.y + r1 * z); }
  for (let rr = r0; rr <= r1; rr++) { const y = Math.round(S.view.y + rr * z) + 0.5; ctx.moveTo(S.view.x + c0 * z, y); ctx.lineTo(S.view.x + c1 * z, y); }
  ctx.stroke(); ctx.restore();
}
let pulseLoop = 0;
function renderMap() {
  const c = $('map'), [rect, dpr] = fitCanvas(), ctx = c.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  paintBackground(ctx, rect.width, rect.height);
  const now = performance.now();
  if (S.snapshot) {
    const [rows, cols] = dims();
    drawFrame(ctx, rows, cols);
    const fadeK = S.fadeStart ? clamp((now - S.fadeStart) / 380, 0, 1) : 1;
    if (S.layers.terrain) drawImageLayer(ctx, baseCanvasFor(terrainMatrix() || getMatrix('id_matrix')), rows, cols, fadeK);
    if (S.layers.walls) drawImageLayer(ctx, wallCanvasFor(getMatrix('wall_matrix'), S.snapshot.meta?.hill_drawing_mode === 'polygon' ? 'polygon' : 'brush'), rows, cols, fadeK);
    drawGrid(ctx, rows, cols);
    drawPolygons(ctx);
    if (S.layers.resources) drawResources(ctx, S.snapshot.resource_positions);
    drawBrushPreview(ctx);
    let popping = false;
    if (S.layers.spawns) { popping = drawSpawns(ctx, now); drawDragGhost(ctx); }
    drawHover(ctx);
    if (fadeK < 1 || popping) scheduleRender(); else S.fadeStart = 0;
    // 3.2.0：选中光环的循环重绘在页面不可见（App 切到后台）时暂停，避免持续耗电
    if (S.selectedSpawn >= 0 && S.layers.spawns && !document.hidden) { clearTimeout(pulseLoop); pulseLoop = setTimeout(scheduleRender, 50); }
  }
  renderMinimap();
}

/* ------------------------------------------------------------------ 生成过程动画帧 */
let animTimer = null, animResolve = null;
function stopAnimation() { if (animTimer) { clearTimeout(animTimer); animTimer = null; } if (animResolve) { const r = animResolve; animResolve = null; r(); } }
function renderAnimFrame(f) {
  const c = $('map'), [rect, dpr] = fitCanvas(), ctx = c.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  paintBackground(ctx, rect.width, rect.height);
  const [rows, cols] = dims(); if (!rows || !cols) return;
  drawFrame(ctx, rows, cols);
  // 修复：海岸线帧分辨率低于最终地图，旧实现按帧自身尺寸绘制导致图像缩在左上角
  drawImageLayer(ctx, baseCanvasFor(f.height), rows, cols);
  if (f.items) drawImageLayer(ctx, wallCanvasFor(f.items, 'items'), rows, cols, 0.9);
  if (f.units?.data) {
    const u = f.units, uc = u.shape[1], pts = [];
    for (let i = 0; i < u.data.length; i++) if (u.data[i] > 0) pts.push([(i / uc) | 0, i % uc]);
    ctx.save(); ctx.fillStyle = '#ffd45c';
    const sy = rows / u.shape[0], sx = cols / uc, R = spawnRadius();
    for (const [r, cc] of pts) { const [x, y] = toScreen(r * sy, cc * sx); ctx.beginPath(); ctx.arc(x, y, R * 0.8, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  }
}
function playFrames(frames, label) {
  return new Promise(resolve => {
    stopAnimation();
    const total = frames.length; if (!total) { resolve(); return; }
    const delay = clamp(Math.round(1500 / total), 50, 220);
    let i = 0;
    animResolve = () => { busy(false); scheduleRender(); resolve(); };
    const tick = () => {
      renderAnimFrame(frames[i]); i++;
      busy(true, label, `生成过程预览 ${i}/${total}`, Math.round(i / total * 100), { skippable: true });
      if (i < total) animTimer = setTimeout(tick, delay);
      else { animTimer = null; const r = animResolve; animResolve = null; r?.(); }
    };
    tick();
  });
}
function pulseMap() { const el = $('mapPanel'); el.classList.remove('pulse'); void el.offsetWidth; el.classList.add('pulse'); }

/* ------------------------------------------------------------------ 小地图 */
function minimapGeom() {
  const [rows, cols] = dims();
  const s = Math.min(248 / cols, 248 / rows);
  return { rows, cols, s, ox: (256 - cols * s) / 2, oy: (256 - rows * s) / 2 };
}
function renderMinimap() {
  const mm = $('minimap'), ctx = mm.getContext('2d');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, 256, 256);
  const { rows, cols, s, ox, oy } = minimapGeom(); if (!rows || !cols) return;
  ctx.imageSmoothingEnabled = false;
  const base = baseCanvasFor(terrainMatrix() || getMatrix('id_matrix'));
  if (base && S.layers.terrain) ctx.drawImage(base, ox, oy, cols * s, rows * s);
  else { ctx.fillStyle = '#16263e'; ctx.fillRect(ox, oy, cols * s, rows * s); }
  if (S.layers.resources) { ctx.fillStyle = '#55e6a5'; for (const [r, c] of S.snapshot?.resource_positions || []) ctx.fillRect(ox + c * s - 1.5, oy + r * s - 1.5, 3, 3); }
  if (S.layers.spawns) currentSpawns().forEach((q, i) => {
    ctx.beginPath(); ctx.arc(ox + (q[1] + 0.5) * s, oy + (q[0] + 0.5) * s, i === S.selectedSpawn ? 4.5 : 3.2, 0, Math.PI * 2);
    ctx.fillStyle = '#ffd45c'; ctx.fill(); ctx.lineWidth = 1.2; ctx.strokeStyle = TEAM_COLORS[teamOf(q, i)]; ctx.stroke();
  });
  const mr = $('map'), rw = mr.clientWidth || 300, rh = mr.clientHeight || 300;
  const vx = ox + (-S.view.x / S.view.zoom) * s, vy = oy + (-S.view.y / S.view.zoom) * s;
  const vw = (rw / S.view.zoom) * s, vh = (rh / S.view.zoom) * s;
  const x0 = clamp(vx, ox, ox + cols * s), y0 = clamp(vy, oy, oy + rows * s);
  const x1 = clamp(vx + vw, ox, ox + cols * s), y1 = clamp(vy + vh, oy, oy + rows * s);
  ctx.fillStyle = 'rgba(75,138,255,.12)'; ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  ctx.strokeStyle = '#6aa7ff'; ctx.lineWidth = 2; ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
}
function minimapNavigate(e) {
  const { rows, cols, s, ox, oy } = minimapGeom(); if (!rows || !cols) return;
  const r = $('minimap').getBoundingClientRect();
  const cx = (e.clientX - r.left) * (256 / r.width), cy = (e.clientY - r.top) * (256 / r.height);
  const col = clamp((cx - ox) / s, 0, cols), row = clamp((cy - oy) / s, 0, rows);
  const mr = $('map');
  S.view.x = mr.clientWidth / 2 - col * S.view.zoom;
  S.view.y = mr.clientHeight / 2 - row * S.view.zoom;
  S.view.fitted = false;
  scheduleRender();
}

/* ------------------------------------------------------------------ 步骤条 */
function updateSteps(done = S.snapshot?.meta?.completed_step ?? -1) {
  const box = $('steps');
  box.innerHTML = '';
  STEP_NAMES.forEach((x, i) => {
    const d = document.createElement('button');
    d.type = 'button';
    d.className = 'step' + (i <= done ? ' done' : '') + (i === S.step ? ' current' : '');
    d.innerHTML = `<i>${i <= done ? '✓' : i + 1}</i><span>${x}</span>`;
    d.style.setProperty('--d', `${i * 30}ms`);
    d.onclick = () => setStep(i);
    box.appendChild(d);
  });
  document.querySelectorAll('.editor-block').forEach(b => b.classList.toggle('current-block', Number(b.dataset.step) === S.step));
  const pg = $('stepProgress'); if (pg) pg.style.width = `${clamp((done + 1) / STEP_NAMES.length, 0, 1) * 100}%`;
}
function setStep(i, scroll = true) {
  S.step = clamp(i, 0, 5);
  if (S.mode === 'wizard') {
    let tool = STEP_TOOLS[S.step];
    if (tool === 'brush' && S.hillMode === 'polygon') tool = 'polygon';
    if (tool === 'cc' && $('ccManual') && !$('ccManual').classList.contains('active')) tool = 'pan';
    if (tool === 'resource' && $('resManual') && !$('resManual').classList.contains('active')) tool = 'pan';
    setTool(tool, false);
  }
  updateSteps();
  if (scroll) document.querySelector(`.editor-block[data-step="${S.step}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}
const TOOL_TIPS = {
  pan: '<b>拖动</b>平移 · <b>双指/滚轮</b>缩放 · <b>点出生点</b>选中 · <b>拖出生点</b>移动 · <b>右键/长按</b>删除',
  brush: '<b>拖动</b>绘制墙体 · <b>双指</b>平移缩放 · <b>中键</b>平移 · 画笔大小在侧栏调整',
  polygon: '<b>点击</b>添加顶点 · <b>点起点</b>闭合 · <b>点边</b>选择 · <b>Esc</b>取消绘制',
  cc: '<b>点击</b>放置出生点（自动镜像） · <b>拖动</b>出生点移动 · <b>右键/长按</b>删除',
  resource: '<b>点击</b>放置资源点（自动镜像） · <b>右键/长按</b>删除附近资源'
};
function setTool(tool, fromUser = true) {
  if (S.mode !== 'wizard') tool = 'pan';
  S.tool = tool;
  document.querySelectorAll('#toolPalette [data-tool]').forEach(b => b.classList.toggle('active', b.dataset.tool === tool));
  $('legendTip').innerHTML = TOOL_TIPS[tool] || TOOL_TIPS.pan;
  $('map').dataset.tool = tool;
  if (fromUser) {
    if (tool === 'brush' || tool === 'polygon') { if ((tool === 'polygon') !== (S.hillMode === 'polygon')) (tool === 'polygon' ? $('polygonMode') : $('brushMode')).click(); S.step = 1; }
    if (tool === 'cc') { S.step = 3; $('ccManual').classList.add('active'); $('ccRandom').classList.remove('active'); }
    if (tool === 'resource') { S.step = 4; $('resManual').classList.add('active'); $('resRandom').classList.remove('active'); }
    updateSteps();
  }
  if (tool !== 'polygon' && S.drawingPolygon) { S.drawingPolygon = null; updatePolygonInfo(); }
  scheduleRender();
}

/* ------------------------------------------------------------------ 画布手势状态机
 * 修复：旧实现在分步模式下只要处于画笔模式，任何单指拖动都会画墙（无法平移）；
 * 长按删除后抬手仍会落一笔；点出生点列表会静默切换为「放置出生点」工具。
 */
const pointers = new Map();
let drag = null, pinch = null, longPressTimer = null, hoverCell = null, spaceHeld = false;
function clearLongPress() { if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; } }
function pdist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
let lastCoordText = '';
function updateCoord(p) {
  const t = p && validCell(p) ? `${p.row + 1}, ${p.col + 1} · ${S.view.zoom.toFixed(2)}×` : `— · ${S.view.zoom.toFixed(2)}×`;
  if (t !== lastCoordText) { lastCoordText = t; $('coord').textContent = t; }
}
function beginGesture(e) {
  const cell = cellFromPoint(e.clientX, e.clientY);
  const g = { id: e.pointerId, sx: e.clientX, sy: e.clientY, lx: e.clientX, ly: e.clientY, cell, moved: false, button: e.button, touch: e.pointerType === 'touch', type: 'pan' };
  if (e.button === 1 || (e.button === 0 && spaceHeld)) { g.type = 'pan'; return g; }
  if (e.button === 2) { g.type = 'context'; return g; }
  const tool = S.tool;
  if ((tool === 'pan' || tool === 'cc') && S.layers.spawns && cell) {
    const idx = spawnIndexNear(cell);
    if (idx >= 0) { g.type = 'spawn'; g.index = idx; return g; }
  }
  if (tool === 'brush' && validCell(cell)) { g.type = 'paint'; g.points = [[cell.row, cell.col]]; return g; }
  if (tool === 'polygon') { g.type = 'tap-polygon'; return g; }
  if (tool === 'cc' || tool === 'resource') { g.type = 'tap-place'; return g; }
  g.type = 'tap-pan';
  return g;
}
async function contextDelete(cell) {
  if (!validCell(cell)) return;
  if (S.tool === 'polygon') { selectPolygon(cell); return; }
  if (S.tool === 'resource') { await removeResourceAt(cell); return; }
  if (S.layers.spawns && removeSpawnAt(cell)) return;
  if (S.tool === 'pan' && S.source === 'engine' && (S.snapshot?.resource_positions || []).some(q => Math.max(Math.abs(q[0] - cell.row), Math.abs(q[1] - cell.col)) <= 3)) { await removeResourceAt(cell); return; }
  toast('附近没有可删除的对象（请在出生点/资源点 3 格内操作）');
}
async function removeResourceAt(cell) {
  if (!guard() || !engineStateUsable('remove_resource_manual')) return;
  const near = (S.snapshot?.resource_positions || []).filter(q => Math.max(Math.abs(q[0] - cell.row), Math.abs(q[1] - cell.col)) <= 3);
  if (!near.length) { toast('附近没有资源点（3 格内）'); return; }
  if (near.some(q => S.randomResourceKeys.has(keyOf(q))) && S.randomResourceKeys.size > 1) {
    const ok = await uiConfirm('删除随机资源点', `随机生成的资源点在引擎中属于同一组，删除将同时移除全部 <b>${S.randomResourceKeys.size}</b> 个随机资源点。是否继续？`, '全部删除', true);
    if (!ok) return;
  }
  await locked(async () => {
    try {
      const r = await run('remove_resource_manual', { row: cell.row, col: cell.col }, '正在删除资源点…', { silent: true });
      if (r?.removed === false) toast('附近没有可删除的资源点');
      else { setStatus('已删除资源点'); S.randomResourceKeys = new Set([...S.randomResourceKeys].filter(k => (S.snapshot?.resource_positions || []).some(q => keyOf(q) === k))); }
    } catch { /* 已提示 */ }
  });
}
async function placeResourceAt(cell) {
  if (!guard() || !engineStateUsable('place_resource_manual')) return;
  await locked(async () => {
    try {
      const r = await run('place_resource_manual', { row: cell.row, col: cell.col, mirrored: true, mirroring: $('mirror').value }, '正在放置资源点…', { silent: true });
      if (!r?.placed?.length) toast('此处无法放置：资源点需要在陆地、远离墙线且距出生点 4 格以外', 'warn');
      else setStatus(`已放置 ${r.placed.length} 个资源点`);
    } catch { /* 已提示 */ }
  });
}
async function commitStroke(points) {
  if (!points.length || !guard() || !engineStateUsable('draw_brush_walls')) { scheduleRender(); return; }
  await locked(async () => {
    try {
      await run('draw_brush_walls', { points: compactStroke(points, S.brushSize), value: S.brushErasing ? 0 : S.brushValue, brush_size: S.brushSize }, '正在绘制墙体…', { silent: true });
      pushGlobal('brush');
      setStatus(S.brushErasing ? '已擦除墙体' : S.brushValue === 2 ? '已绘制缺口' : '已绘制墙体');
    } catch { /* 已提示 */ }
  });
}
function endGesture(g, e) {
  const cell = cellFromPoint(e.clientX, e.clientY);
  switch (g.type) {
    case 'paint': drag = null; commitStroke(g.points); return;
    case 'spawn':
      drag = null;
      if (g.moved && g.target) moveSpawn(g.index, g.target);
      else selectSpawn(S.selectedSpawn === g.index ? -1 : g.index);
      scheduleRender(); return;
    case 'context': if (!g.moved) contextDelete(cell); return;
    case 'tap-place':
      if (g.moved || !validCell(cell)) return;
      if (S.tool === 'cc') placeSpawnAt(cell); else placeResourceAt(cell);
      return;
    case 'tap-polygon': if (!g.moved && validCell(cell)) polygonClickAt(cell); return;
    case 'tap-pan': if (!g.moved && S.selectedSpawn >= 0) selectSpawn(-1); return;
  }
}
/* Bresenham 直线插值：把 (r0,c0)→(r1,c1) 之间的所有格子补进笔画 */
function appendStrokeCell(points, row, col) {
  const last = points[points.length - 1];
  if (!last) { points.push([row, col]); return; }
  let [r0, c0] = last;
  if (r0 === row && c0 === col) return;
  const dr = Math.abs(row - r0), dc = Math.abs(col - c0), sr = r0 < row ? 1 : -1, sc = c0 < col ? 1 : -1;
  let err = dc - dr, guardN = 0;
  while ((r0 !== row || c0 !== col) && guardN++ < 8192) {
    const e2 = 2 * err;
    if (e2 > -dr) { err -= dr; c0 += sc; }
    if (e2 < dc) { err += dc; r0 += sr; }
    points.push([r0, c0]);
  }
}
/* 笔画点去重压缩：画笔直径较大时相邻点重叠严重，按半径抽稀后再发给引擎，减少 JSON 体积 */
function compactStroke(points, size) {
  if (points.length < 3) return points;
  const step = Math.max(1, Math.floor(size / 2)), out = [points[0]];
  let lastKept = points[0];
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i];
    if (Math.max(Math.abs(p[0] - lastKept[0]), Math.abs(p[1] - lastKept[1])) >= step) { out.push(p); lastKept = p; }
  }
  out.push(points[points.length - 1]);
  return out;
}
function bindCanvas() {
  const canvas = $('map');
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  canvas.addEventListener('pointerdown', e => {
    if (!S.snapshot) return;
    try { canvas.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (isNarrow()) closeDrawer();
    if (pointers.size === 2) {
      clearLongPress();
      if (drag) drag.cancelled = true; // 第二根手指落下：取消单指手势（未提交的笔画/拖动作废）
      const [a, b] = [...pointers.values()];
      pinch = { d: pdist(a, b), zoom: S.view.zoom, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
      scheduleRender();
      return;
    }
    if (pointers.size > 2) return;
    drag = beginGesture(e);
    if (drag.touch && drag.type !== 'paint') {
      const g = drag;
      longPressTimer = setTimeout(() => {
        if (drag !== g || g.moved) return;
        g.cancelled = true;
        navigator.vibrate?.(18);
        contextDelete(cellFromPoint(g.sx, g.sy));
      }, 520);
    }
  });
  canvas.addEventListener('pointermove', e => {
    const cell = cellFromPoint(e.clientX, e.clientY);
    updateCoord(cell);
    if (!pointers.has(e.pointerId)) {
      if (e.pointerType === 'mouse' && S.snapshot) { const k = cell ? keyOf([cell.row, cell.col]) : ''; if (k !== (hoverCell ? keyOf([hoverCell.row, hoverCell.col]) : '')) { hoverCell = cell; scheduleRender(); } }
      return;
    }
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2 && pinch) {
      const [a, b] = [...pointers.values()];
      const nd = pdist(a, b), nmx = (a.x + b.x) / 2, nmy = (a.y + b.y) / 2;
      const r = canvas.getBoundingClientRect();
      const next = clamp(pinch.zoom * nd / Math.max(1, pinch.d), 0.05, 40);
      const ux = (pinch.mx - r.left - S.view.x) / pinch.zoom, uy = (pinch.my - r.top - S.view.y) / pinch.zoom;
      S.view.zoom = next; S.view.x = nmx - r.left - ux * next; S.view.y = nmy - r.top - uy * next;
      pinch = { d: nd, zoom: next, mx: nmx, my: nmy };
      S.view.fitted = false;
      scheduleRender(); return;
    }
    const g = drag; if (!g || g.id !== e.pointerId || g.cancelled) return;
    if (!g.moved && Math.hypot(e.clientX - g.sx, e.clientY - g.sy) > 6) { g.moved = true; clearLongPress(); }
    if (g.type === 'paint') {
      // 3.2.0 修复：引擎只在传入的点上落笔，旧实现快速拖动时 pointermove 会跳过很多格，墙体变成“虚线”，
      // 单位可以从缺口穿过。现在合并 coalesced 事件，并在相邻采样点之间做 Bresenham 插值，保证笔画连续。
      const evs = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : null;
      for (const ev of (evs && evs.length ? evs : [e])) {
        const c2 = cellFromPoint(ev.clientX, ev.clientY);
        if (validCell(c2)) appendStrokeCell(g.points, c2.row, c2.col);
      }
      scheduleRender();
    } else if (g.type === 'spawn') {
      if (g.moved && validCell(cell)) { g.target = { row: cell.row, col: cell.col }; scheduleRender(); }
    } else if (g.moved && g.type !== 'context') {
      S.view.x += e.clientX - g.lx; S.view.y += e.clientY - g.ly; S.view.fitted = false;
      scheduleRender();
    }
    g.lx = e.clientX; g.ly = e.clientY;
  });
  const up = e => {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    clearLongPress();
    const wasPinch = !!pinch;
    if (pointers.size < 2) pinch = null;
    // 3.2.0 修复：双指缩放后抬起一根手指，旧实现中剩下的手指什么也做不了（手势已作废），
    // 必须全部抬起重来；现在自动把剩下的手指接续为平移手势。
    if (wasPinch && pointers.size === 1) {
      const [[id, pt]] = [...pointers.entries()];
      drag = { id, sx: pt.x, sy: pt.y, lx: pt.x, ly: pt.y, moved: true, button: 0, touch: true, type: 'pan' };
      scheduleRender();
      return;
    }
    const g = drag;
    if (!g || g.id !== e.pointerId) { if (pointers.size === 0) { drag = null; scheduleRender(); } return; }
    drag = null;
    if (g.cancelled || e.type === 'pointercancel') { scheduleRender(); return; }
    endGesture(g, e);
  };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse' && hoverCell) { hoverCell = null; updateCoord(null); scheduleRender(); } });
  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    const r = canvas.getBoundingClientRect();
    const f = Math.exp(-clamp(e.deltaY, -120, 120) * 0.0022);
    zoomAt(f, e.clientX - r.left, e.clientY - r.top, false);
  }, { passive: false });
}

/* ------------------------------------------------------------------ TMX：解析
 * 旧实现：只支持 base64+gzip；把 Ground GID 线性映射成高度（结果几乎全是陆地）；资源点丢失。
 * 新实现：支持 csv / base64 / base64+gzip / base64+zlib；按引擎瓦片表反查真实高度层级；
 * 资源池按连通块求中心；出生点按 GID（玩家槽位）排序；自动检测地图对称方式。
 */
const TILE_HEIGHT = (() => {
  const sets = [[-1, [83, 28, 0, 1, 2, 27, 29, 54, 55, 56, 81, 82, 108, 109]], [0, [28, 31, 3, 4, 5, 30, 32, 57, 58, 59, 84, 85, 111, 112]],
    [1, [31, 34, 6, 7, 8, 33, 35, 60, 61, 62, 87, 88, 114, 115]], [2, [34, 37, 9, 10, 11, 36, 38, 63, 64, 65, 90, 91, 117, 118]],
    [3, [37, 40, 12, 13, 14, 39, 41, 66, 67, 68, 93, 94, 120, 121]], [4, [40, 43, 15, 16, 17, 42, 44, 69, 70, 71, 96, 97, 123, 124]],
    [5, [43, 46, 18, 19, 20, 45, 47, 72, 73, 74, 99, 100, 126, 127]], [6, [46, 49, 21, 22, 23, 48, 50, 75, 76, 77, 102, 103, 129, 130]],
    [7, [49, 52, 24, 25, 26, 51, 53, 78, 79, 80, 105, 106, 132, 133]]];
  const map = new Map();
  for (const [lv, set] of sets) set.forEach((id, i) => { if (i >= 2 && !map.has(id)) map.set(id, lv); });
  for (const [lv, set] of sets) { map.set(set[1], lv); if (!map.has(set[0])) map.set(set[0], lv - 1); }
  [[1, [86, 89, 116]], [2, [110, 119]], [3, [95, 122]], [4, [98, 125]], [5, [101, 128]], [6, [104, 131]], [7, [107, 134]]].forEach(([lv, ids]) => ids.forEach(id => map.set(id, lv)));
  return map;
})();
/* 3.3.0：同时支持单/双引号属性，并反转义 XML 实体（第三方编辑器导出的 TMX 可能使用单引号） */
const XML_ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const unescapeXml = v => v.replace(/&(amp|lt|gt|quot|apos);/g, (_, k) => XML_ENT[k]);
function xmlAttrs(tag) { const o = {}; for (const m of tag.matchAll(/([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) o[m[1]] = unescapeXml(m[2] ?? m[3] ?? ''); return o; }

/* ------------------------------------------------------------------ 出生点槽位 ↔ GID 映射（3.3.0 核心修复）
 * 根因：铁锈战争（以及 NotTiled 等编辑器）识别指挥中心时读取的是瓦片自身的 unit / team 属性，而不是瓦片序号。
 * 内置蓝图的 50pCommandCenter 瓦片集（5 列 × 10 行）的 team 属性并非线性排列，而是每 10 个瓦片（两行）一组：
 *     第 1 行：team +0 +2 +4 +6 +8      第 2 行：team +1 +3 +5 +7 +9
 * 旧版无论引擎还是 JS 修补都按「101 + 序号」写入，于是界面上的出生点 2 在游戏里是玩家 3（team 2），
 * 出生点 6 变成玩家 2（team 1）……10 人以上地图槽位与队伍整体错乱。
 * 现在：从 TMX 中读取每个瓦片的 unit/team 属性建立 team→GID 双向表；找不到属性时按 50p 布局公式回退。
 * 约定：出生点 i（界面编号 i+1）= 玩家 i+1 = team 属性 i。 */
const CC_UNIT_RE = /^\s*commandcenter\s*$/i;
function ccLocalFor50p(team) { const b = Math.floor(team / 10), r = team % 10; return b * 10 + (r % 2 === 0 ? r / 2 : 5 + (r - 1) / 2); }
function ccTeamFor50p(local) { const b = Math.floor(local / 10), k = local % 10; return b * 10 + (k < 5 ? k * 2 : (k - 5) * 2 + 1); }
/** 只解码 TMX 中第一个 <layer 之前的部分（瓦片集都在图层之前），避免为了读瓦片属性解码几十 MB 的图层数据 */
function tmxHeadXml(bytes) {
  if (typeof bytes === 'string') { const i = bytes.search(/<layer\b/); return i < 0 ? bytes : bytes.slice(0, i); }
  const pat = [60, 108, 97, 121, 101, 114]; // "<layer"
  let end = bytes.length;
  outer: for (let i = 0; i + pat.length <= bytes.length; i++) {
    if (bytes[i] !== 60) continue;
    for (let k = 1; k < pat.length; k++) if (bytes[i + k] !== pat[k]) continue outer;
    const nx = bytes[i + pat.length]; if (nx === 32 || nx === 62 || nx === 9 || nx === 10 || nx === 13) { end = i; break; }
  }
  return new TextDecoder().decode(bytes.subarray(0, end));
}
function parseTilesets(xml) {
  const out = [], re = /<tileset\b([^>]*?)(\/?)>/g;
  let m;
  while ((m = re.exec(xml))) {
    const a = xmlAttrs(m[1]);
    const ts = { firstgid: Number(a.firstgid) || 0, name: a.name || '', tilecount: Number(a.tilecount) || 0, columns: Number(a.columns) || 0, external: !!a.source, tiles: new Map() };
    if (!m[2]) {
      const end = xml.indexOf('</tileset>', re.lastIndex);
      const body = end < 0 ? '' : xml.slice(re.lastIndex, end);
      const tre = /<tile\b([^>]*?)(\/?)>/g; let t;
      while ((t = tre.exec(body))) {
        if (t[2]) continue;
        const tEnd = body.indexOf('</tile>', tre.lastIndex); if (tEnd < 0) break;
        const id = Number(xmlAttrs(t[1]).id);
        const props = {};
        for (const pm of body.slice(tre.lastIndex, tEnd).matchAll(/<property\b([^>]*?)\/?>/g)) { const pa = xmlAttrs(pm[1]); if (pa.name) props[pa.name] = pa.value ?? ''; }
        if (Number.isFinite(id)) ts.tiles.set(id, props);
        tre.lastIndex = tEnd + 7;
      }
      if (end > 0) re.lastIndex = end + 10;
    }
    out.push(ts);
  }
  return out;
}
/** 构建槽位映射。返回 { source, capacity, gidForTeam(t), teamForGid(g), isCc(g), primary } */
function buildCcMap(xmlHead) {
  const tilesets = xmlHead ? parseTilesets(xmlHead) : [];
  const gidTeam = new Map();
  let primary = null, primaryN = 0;
  for (const ts of tilesets) {
    let n = 0;
    for (const [id, p] of ts.tiles) {
      if (!CC_UNIT_RE.test(String(p.unit ?? ''))) continue;
      const team = Number(p.team);
      if (!Number.isInteger(team) || team < 0) continue;
      gidTeam.set(ts.firstgid + id, team); n++;
    }
    const named = /commandcenter/i.test(ts.name);
    if (n && (!primary || (named && !/commandcenter/i.test(primary.name)) || (named === /commandcenter/i.test(primary.name) && n > primaryN))) { primary = ts; primaryN = n; }
  }
  const named = tilesets.find(t => /commandcenter/i.test(t.name));
  let source, teamGid = new Map(), ranges = [];
  if (primary) {
    source = 'props';
    // 先取主瓦片集，再用其他瓦片集补齐缺失的 team
    const ordered = [...gidTeam.entries()].sort((a, b) => {
      const pa = a[0] >= primary.firstgid && a[0] < primary.firstgid + Math.max(primary.tilecount, 1) ? 0 : 1;
      const pb = b[0] >= primary.firstgid && b[0] < primary.firstgid + Math.max(primary.tilecount, 1) ? 0 : 1;
      return pa - pb || a[0] - b[0];
    });
    for (const [g, t] of ordered) if (!teamGid.has(t)) teamGid.set(t, g);
    if (named) ranges.push([named.firstgid, named.firstgid + (named.tilecount || MAX_SPAWN_POINTS)]);
  } else {
    const ts = named || { firstgid: CC_GID_BASE, tilecount: MAX_SPAWN_POINTS, columns: 5, name: '50pCommandCenter' };
    const count = clamp(ts.tilecount || MAX_SPAWN_POINTS, 1, 1000);
    // 外部 .tsx 或缺少属性：5 列且数量为 10 的倍数时按内置 50p 布局推断，否则按线性顺序
    const is50p = (ts.columns === 5 || !ts.columns) && count % 10 === 0;
    source = !named ? 'default' : is50p ? '50p' : 'linear';
    for (let t = 0; t < count; t++) { const g = ts.firstgid + (is50p ? ccLocalFor50p(t) : t); teamGid.set(t, g); gidTeam.set(g, t); }
    ranges.push([ts.firstgid, ts.firstgid + count]);
    primary = ts;
  }
  let capacity = 0; while (teamGid.has(capacity)) capacity++;
  return {
    source, capacity: Math.min(capacity, MAX_SPAWN_POINTS), primary,
    gidForTeam: t => teamGid.get(t) || 0,
    teamForGid: g => (gidTeam.has(g) ? gidTeam.get(g) : -1),
    isCc: g => gidTeam.has(g) || ranges.some(([a, b]) => g >= a && g < b)
  };
}
const ccMapCache = new WeakMap();
let defaultCcMap = null;
/** 当前地图的槽位映射：优先读当前 TMX，没有 TMX（分步编辑中）时使用内置蓝图的 50p 布局 */
function ccMapFor(bytes = S.lastTmx) {
  if (!bytes) return defaultCcMap || (defaultCcMap = buildCcMap(''));
  let m = ccMapCache.get(bytes);
  if (!m) { m = buildCcMap(tmxHeadXml(bytes)); ccMapCache.set(bytes, m); }
  return m;
}
const CC_SOURCE_LABEL = { props: '瓦片 team 属性', '50p': '50p 布局推断', linear: '线性顺序（未找到 team 属性）', default: '内置蓝图 50p 布局' };
async function decodeLayerData(attrs, text, n) {
  const enc = attrs.encoding || '', comp = attrs.compression || '';
  if (enc === 'csv') {
    const out = new Uint32Array(n); let i = 0;
    for (const t of text.split(/[\s,]+/)) { if (!t) continue; if (i >= n) break; out[i++] = Number(t) >>> 0; }
    return out;
  }
  if (enc !== 'base64') throw new Error('不支持的图层编码（仅支持 CSV / Base64）');
  let raw = base64ToBytes(text);
  if (comp === 'gzip') raw = await gunzip(raw);
  else if (comp === 'zlib') raw = await inflateZlib(raw);
  else if (comp) throw new Error(`不支持的压缩方式：${comp}`);
  const out = new Uint32Array(n), dv = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
  for (let i = 0; i < n && i * 4 + 4 <= dv.byteLength; i++) out[i] = dv.getUint32(i * 4, true);
  return out;
}
function components(data, rows, cols) {
  const seen = new Uint8Array(data.length), out = [], stack = new Int32Array(data.length);
  for (let i = 0; i < data.length; i++) {
    if (!data[i] || seen[i]) continue;
    let sp = 0, sr = 0, sc = 0, n = 0; stack[sp++] = i; seen[i] = 1;
    while (sp) {
      const k = stack[--sp], r = (k / cols) | 0, c = k % cols; sr += r; sc += c; n++;
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        const rr = r + dr, cc = c + dc; if (rr < 0 || cc < 0 || rr >= rows || cc >= cols) continue;
        const kk = rr * cols + cc; if (data[kk] && !seen[kk]) { seen[kk] = 1; stack[sp++] = kk; }
      }
    }
    out.push([Math.round(sr / n), Math.round(sc / n)]);
  }
  return out;
}
function detectSymmetry(h, rows, cols) {
  const test = f => { let same = 0, total = 0; const step = Math.max(1, Math.floor(Math.sqrt(rows * cols / 40000))); for (let r = 0; r < rows; r += step) for (let c = 0; c < cols; c += step) { const [r2, c2] = f(r, c); total++; if ((h[r * cols + c] > 0) === (h[r2 * cols + c2] > 0)) same++; } return same / Math.max(1, total); };
  const v = test((r, c) => [r, cols - 1 - c]), hz = test((r, c) => [rows - 1 - r, c]);
  if (v > 0.97 && hz > 0.97) return 'both';
  if (v > 0.97) return 'vertical';
  if (hz > 0.97) return 'horizontal';
  if (rows === cols) { if (test((r, c) => [c, r]) > 0.97) return 'diagonal1'; if (test((r, c) => [cols - 1 - c, rows - 1 - r]) > 0.97) return 'diagonal2'; }
  return 'none';
}
/** 3.3.0：按 team 属性（而不是 GID 大小或扫描顺序）读取出生点，并报告缺号 / 重号 */
function readSpawnSlots(units, cols, cc) {
  const list = [];
  if (units) for (let i = 0; i < units.length; i++) {
    const g = units[i] & 0x1fffffff;
    if (g && cc.isCc(g)) list.push({ g, team: cc.teamForGid(g), p: [(i / cols) | 0, i % cols] });
  }
  list.sort((a, b) => (a.team < 0 ? 1e9 : a.team) - (b.team < 0 ? 1e9 : b.team) || a.p[0] - b.p[0] || a.p[1] - b.p[1]);
  const teams = list.map(x => x.team), seen = new Set(), dups = new Set();
  teams.forEach(t => { if (seen.has(t)) dups.add(t); seen.add(t); });
  const maxT = Math.max(-1, ...teams);
  const gaps = []; for (let t = 0; t <= maxT; t++) if (!seen.has(t)) gaps.push(t);
  return { list, gaps, dups: [...dups], unknown: teams.filter(t => t < 0).length };
}
async function parseTmx(bytes) {
  const xml = typeof bytes === 'string' ? bytes : new TextDecoder().decode(bytes);
  const mapTag = xml.match(/<map\b[^>]*>/); if (!mapTag) throw new Error('不是有效的 TMX 文件');
  const ma = xmlAttrs(mapTag[0]);
  if (ma.infinite === '1') throw new Error('不支持无限地图（infinite）');
  const rows = Number(ma.height || 0), cols = Number(ma.width || 0);
  if (!rows || !cols || rows > MAX_MAP_DIMENSION || cols > MAX_MAP_DIMENSION) throw new Error(`TMX 尺寸无效或超过 ${MAX_MAP_DIMENSION}×${MAX_MAP_DIMENSION}`);
  const tilesets = [...xml.matchAll(/<tileset\b[^>]*>/g)].map(m => xmlAttrs(m[0]));
  const terrainTs = tilesets.find(t => /autolight/i.test(t.name || ''));
  const terrainBase = terrainTs ? Number(terrainTs.firstgid) : 201;
  const cc = buildCcMap(tmxHeadXml(xml));
  const layers = {};
  const re = /<layer\b([^>]*)>\s*(?:<properties>[\s\S]*?<\/properties>\s*)?<data\b([^>]*)>([\s\S]*?)<\/data>/g;
  for (const m of xml.matchAll(re)) {
    const la = xmlAttrs(m[1]), da = xmlAttrs(m[2]);
    if (/<chunk/.test(m[3])) throw new Error('不支持分块（chunk）图层');
    layers[la.name || ''] = await decodeLayerData(da, m[3].trim(), rows * cols);
  }
  // 3.3.0：图层名大小写不敏感（部分编辑器导出为 units / ground）
  const layerOf = name => layers[name] || layers[Object.keys(layers).find(k => k.toLowerCase() === name.toLowerCase())];
  const ground = layerOf('Ground') || Object.values(layers)[0];
  if (!ground) throw new Error('找不到 Ground 图层');
  const height = new Int32Array(rows * cols);
  let unknown = 0;
  for (let i = 0; i < height.length; i++) {
    const lv = TILE_HEIGHT.get((ground[i] & 0x1fffffff) - terrainBase);
    if (lv === undefined) { unknown++; height[i] = i > 0 ? height[i - 1] : 1; } else height[i] = lv;
  }
  if (unknown > height.length * 0.4) {
    // 非本工具/非标准瓦片集：退化为「有瓦片=陆地」并按 GID 粗略分层，仅用于预览与出生点编辑
    for (let i = 0; i < height.length; i++) { const g = ground[i] & 0x1fffffff; height[i] = g ? 1 + (g % 6) : 0; }
  }
  const itemsRaw = layerOf('Items');
  const items = itemsRaw ? Int32Array.from(itemsRaw, v => (v & 0x1fffffff) ? 1 : 0) : new Int32Array(rows * cols);
  const unitsRaw = layerOf('Units');
  const spawns = readSpawnSlots(unitsRaw, cols, cc);
  return {
    rows, cols, height, items, resources: components(items, rows, cols),
    positions: spawns.list.slice(0, MAX_SPAWN_POINTS).map(x => x.p),
    slots: spawns, ccSource: cc.source,
    mirroring: detectSymmetry(height, rows, cols), approximate: unknown > height.length * 0.4
  };
}
async function loadTmxBytes(bytes, name, { fromProject = false } = {}) {
  const t = await parseTmx(bytes);
  resetEditorState();
  S.source = 'import';
  S.snapshotEpoch = -1;
  const snap = {
    meta: { height: t.rows, width: t.cols, mirroring: t.mirroring, num_command_centers: t.positions.length, num_resource_pulls: t.resources.length, completed_step: 5, current_step: 5, hill_drawing_mode: 'brush' },
    cc_positions: t.positions, resource_positions: t.resources,
    matrices: { height_map: { shape: [t.rows, t.cols], data: t.height }, items_matrix: { shape: [t.rows, t.cols], data: t.items } }
  };
  S.lastTmx = bytes; S.tmxDirty = false; S.unitsDirty = false; S.slotVerified = null;
  S.spawnAuthority = t.positions.map(p => [...p]);
  // 3.3.0：team 缺号 / 重号 / 未知时，导出前统一重写为连续的 team 0..n-1（游戏中缺号会少玩家、重号会两个出生点同属一个玩家）
  const sl = t.slots;
  if (sl && (sl.gaps.length || sl.dups.length || sl.unknown)) { S.unitsDirty = true; t.slotIssues = sl; }
  // 3.4.0：导入地图的队伍按槽位推断（交替：奇数号玩家 A / 偶数号 B；A 队在前：前一半 A）。
  // 旧版按地图左右半边推断，与该地图真实的槽位分队经常不一致，映射表中大量出现「≠槽位」，点「按队伍排槽位」还会打乱原作者的槽位。
  if (!fromProject) {
    const mode = $('slotOrder').value, n = t.positions.length;
    if (mode !== 'engine') t.positions.forEach((q, i) => S.teamOverrides.set(keyOf(q), mode === 'alternate' ? (i % 2 ? 'B' : 'A') : (i < Math.ceil(n / 2) ? 'A' : 'B')));
  }
  $('width').value = t.cols; $('height').value = t.rows;
  if (!fromProject) {
    const n = Math.min(MAX_SPAWN_POINTS, t.positions.length);
    $('players').value = n; syncPresetFromPlayers();
    if (t.mirroring !== 'none') $('mirror').value = t.mirroring;
    $('mapName').value = String(name || '').replace(/\.(tmx|xml)$/i, '');
    updateMirrorHint();
  }
  setExportEnabled(true);
  S.view.fitted = false;
  setSnapshot(snap, { fit: true, fade: true });
  updateDirtyNote();
  return t;
}
async function importFile(file) {
  if (!file) return;
  if (/\.json$/i.test(file.name) || file.type === 'application/json') { await importProjectFile(file); return; }
  await locked(async () => {
    try {
      busy(true, '正在导入 TMX…', file.name, null, { cancellable: false });
      const t = await loadTmxBytes(new Uint8Array(await file.arrayBuffer()), file.name);
      setStatus(`TMX 导入完成：${t.cols} × ${t.rows} · 出生点 ${t.positions.length} · 资源 ${t.resources.length}`);
      toast(`已导入 ${file.name}${t.mirroring !== 'none' ? ` · 检测到${MIRROR_LABELS[t.mirroring]}` : ''}`, 'success');
      if (t.approximate) toast('该 TMX 使用了非标准地形瓦片，地形预览为近似显示', 'warn', 4200);
      if (t.slotIssues) {
        const si = t.slotIssues, parts = [];
        if (si.gaps.length) parts.push(`缺少玩家 ${si.gaps.slice(0, 6).map(x => x + 1).join('、')}${si.gaps.length > 6 ? '…' : ''}`);
        if (si.dups.length) parts.push(`玩家 ${si.dups.slice(0, 6).map(x => x + 1).join('、')} 重复`);
        if (si.unknown) parts.push(`${si.unknown} 个指挥中心无 team 属性`);
        toast(`该 TMX 的出生点槽位不连续（${parts.join('；')}），已按 team 顺序重新编号，导出时会写成连续槽位`, 'warn', 6500);
      }
      queueAutoSave();
    } catch (e) { toast('TMX 导入失败：' + e.message, 'error', 4200); setStatus('TMX 导入失败：' + e.message); }
    finally { busy(false); $('tmxFile').value = ''; }
  });
}

/* ------------------------------------------------------------------ TMX：Units 图层修补
 * 只替换出生点 GID（保留图层中其他单位）。出生点 i 写入「team 属性 = i」的那个 GID（见 buildCcMap）。
 * 3.3.0 修复：旧版按「firstgid + 序号」写入，与瓦片 team 属性不一致，导致出生点序号 ↔ 游戏玩家映射错乱。
 */
function findUnitsLayer(xml) {
  const re = /<layer\b[^>]*>/g; let m;
  while ((m = re.exec(xml))) { const a = xmlAttrs(m[0]); if (String(a.name || '').toLowerCase() === 'units') return { m, attrs: a }; }
  return null;
}
async function readUnitsLayer(xml) {
  const hit = findUnitsLayer(xml); if (!hit) return null;
  const mapA = xmlAttrs(xml.match(/<map\b[^>]*>/)[0]);
  const cols = Number(mapA.width), rows = Number(mapA.height);
  const dataStart = xml.indexOf('<data', hit.m.index), tagEnd = dataStart < 0 ? -1 : xml.indexOf('>', dataStart), dataEnd = tagEnd < 0 ? -1 : xml.indexOf('</data>', tagEnd);
  if (dataStart < 0 || tagEnd < 0 || dataEnd < 0) return null;
  const da = xmlAttrs(xml.slice(dataStart, tagEnd + 1));
  if (/<chunk/.test(xml.slice(tagEnd, dataEnd))) throw new Error('不支持分块（chunk）图层');
  const units = await decodeLayerData(da, xml.slice(tagEnd + 1, dataEnd).trim(), rows * cols);
  return { units, rows, cols, da, tagEnd, dataEnd };
}
async function patchTmxUnits(tmx, positions) {
  const xml = new TextDecoder().decode(tmx);
  const L = await readUnitsLayer(xml);
  if (!L) return { tmx, changed: false, missing: !findUnitsLayer(xml) };
  const { units, rows, cols, da, tagEnd, dataEnd } = L;
  const cc = buildCcMap(tmxHeadXml(xml));
  const cap = cc.capacity;
  let changed = false;
  const want = new Map();
  positions.slice(0, cap).forEach((p, i) => want.set(p[0] * cols + p[1], cc.gidForTeam(i)));
  for (let i = 0; i < units.length; i++) {
    const g = units[i] & 0x1fffffff;
    const target = want.has(i) ? want.get(i) : (g && cc.isCc(g) ? 0 : units[i]);
    if (units[i] !== target) { units[i] = target; changed = true; }
  }
  const truncated = positions.length > cap ? cap : 0;
  if (!changed) return { tmx, changed: false, truncated, source: cc.source };
  const bytes = new Uint8Array(units.buffer, units.byteOffset, units.byteLength);
  let body;
  if (da.encoding === 'csv') {
    const lines = []; for (let r = 0; r < rows; r++) lines.push(Array.from(units.subarray(r * cols, (r + 1) * cols)).join(','));
    body = '\n' + lines.join(',\n') + '\n';
  } else {
    let packed = bytes;
    if (da.compression === 'gzip') packed = await gzip(bytes);
    else if (da.compression === 'zlib') packed = await streamTransform(bytes, 'deflate', true);
    body = bytesToBase64(packed);
  }
  return { tmx: new TextEncoder().encode(xml.slice(0, tagEnd + 1) + body + xml.slice(dataEnd)), changed: true, truncated, source: cc.source };
}
/** 3.3.0：读回 TMX，逐个核对「出生点 i 的坐标」与「team = i 的指挥中心坐标」，保证导出结果与界面编号完全一致 */
async function verifySpawnMapping(tmx, positions) {
  const xml = new TextDecoder().decode(tmx);
  const L = await readUnitsLayer(xml);
  if (!L) return { ok: !positions.length, rows: [], missing: true };
  const cc = buildCcMap(tmxHeadXml(xml));
  const back = readSpawnSlots(L.units, L.cols, cc);
  const byTeam = new Map(back.list.map(x => [x.team, x]));
  const rowsOut = positions.slice(0, MAX_SPAWN_POINTS).map((p, i) => {
    const hit = byTeam.get(i);
    return { player: i + 1, team: i, gid: cc.gidForTeam(i), pos: p, ok: !!hit && hit.p[0] === p[0] && hit.p[1] === p[1] };
  });
  const extra = back.list.length - rowsOut.filter(r => r.ok).length;
  return { ok: rowsOut.every(r => r.ok) && extra === 0 && !back.dups.length, rows: rowsOut, extra, dups: back.dups, source: cc.source, capacity: cc.capacity };
}
async function syncTmxUnits() {
  if (!S.lastTmx || !S.unitsDirty) return;
  const spawns = currentSpawns();
  const r = await patchTmxUnits(S.lastTmx, spawns);
  S.lastTmx = r.tmx; S.unitsDirty = false;
  // 旧实现在缺少 Units 图层时静默丢弃出生点修改，现在明确提示
  if (r.missing && spawns.length) toast('该 TMX 没有 Units 图层，出生点修改无法写入导出文件（地形照常导出）', 'warn', 5200);
  if (r.truncated) toast(`该 TMX 的指挥中心瓦片集只有 ${r.truncated} 个槽位，超出的出生点未写入`, 'warn', 5200);
  if (r.source === 'linear') toast('该 TMX 的指挥中心瓦片缺少 team 属性，已按线性顺序写入，游戏内玩家顺序可能与编号不同', 'warn', 5600);
  if (!r.missing && spawns.length) {
    const v = await verifySpawnMapping(S.lastTmx, spawns);
    S.slotVerified = v.ok;
    if (!v.ok) { console.warn('出生点映射校验失败', v); toast('出生点槽位校验未通过：导出文件中的玩家编号与界面不一致，请打开「槽位映射表」查看', 'error', 6000); }
    updateSlotBadge();
  }
}

/* ------------------------------------------------------------------ 导出：文件保存（Android 分块桥接 / 浏览器下载） */
async function saveFile(bytes, name, mime) {
  // 3.5.0：PC 版（desktop-bridge.js）由 Rust 写入导出目录；Android / 浏览器走原有分支，行为不变
  if (window.DesktopBridge?.saveFile) return window.DesktopBridge.saveFile(bytes, name, mime);
  const B = window.AndroidBridge;
  if (B?.beginSave) {
    const id = B.beginSave(name, mime);
    if (!id) throw new Error('无法创建导出文件');
    const CH = 3 * 256 * 1024; // 3 的倍数，保证每块 Base64 可独立解码
    for (let i = 0; i < bytes.length; i += CH) {
      if (!B.appendChunk(id, bytesToBase64(bytes.subarray(i, i + CH)))) { B.abortSave?.(id); throw new Error('写入导出文件失败'); }
      if ((i / CH) % 8 === 7) await nextFrame();
    }
    const res = String(B.finishSave(id) || '');
    if (res.startsWith('ok:')) return { ok: true, name: res.slice(3) };
    if (res === 'pending') return { ok: true, pending: true, name };
    throw new Error(res.replace(/^error:/, '') || '保存失败');
  }
  if (B?.saveBase64File) { B.saveBase64File(bytesToBase64(bytes), name, mime); return { ok: true, name, legacy: true }; }
  const blob = new Blob([bytes], { type: mime }), a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  return { ok: true, name };
}
function sanitizeName(s) {
  // 3.4.0：去掉首尾点号（Android 文件系统会拒绝 / 改名，TMX 与 _map.png 不再同名成对）
  return String(s || '').replace(/\.tmx$/i, '').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').replace(/\s+/g, ' ').trim().replace(/^[.\s]+|[.\s]+$/g, '').slice(0, 80);
}
function exportBaseName() {
  const custom = sanitizeName($('mapName').value);
  return custom || `[p${currentSpawns().length}]铁锈地图_${stamp()}`;
}
async function prepareTmxForExport() {
  if (!S.lastTmx) { toast('请先生成或导入地图', 'warn'); return null; }
  if (S.tmxDirty && S.source === 'engine') {
    const alive = S.snapshotEpoch === S.engineEpoch && getMatrix('height_map');
    const buttons = [{ key: 'cancel', label: '取消' }, { key: 'old', label: '导出旧版 TMX' }];
    if (alive) buttons.push({ key: 'regen', label: '重新生成并导出', primary: true });
    const c = await uiChoice('地图已修改', `生成 TMX 之后，地形 / 墙体 / 资源又被编辑过，当前 TMX 与画布不一致。${alive ? '建议重新生成 TMX 后再导出。' : '（引擎状态已失效，只能导出旧版）'}`, buttons);
    if (!c || c === 'cancel') return null;
    if (c === 'regen') {
      await run('run_finalize', { blueprintXml: await blueprint() }, '正在重新生成 TMX…');
      if (S.tmxDirty) return null;
    }
  }
  if (S.unitsDirty) { busy(true, '正在写入出生点…', '', null, { cancellable: false }); try { await syncTmxUnits(); } finally { busy(false); } }
  // 3.4.0：读回校验未通过时不再静默导出
  if (S.slotVerified === false) {
    const ok = await uiConfirm('出生点槽位校验未通过', '导出文件中的玩家编号与界面不一致（常见于第三方 TMX 的指挥中心瓦片缺少 team 属性或槽位不足）。仍要导出吗？', '仍然导出', true);
    if (!ok) return null;
  }
  return S.lastTmx;
}
async function exportPair() {
  await locked(async () => {
    const tmx = await prepareTmxForExport(); if (!tmx) return;
    const base = exportBaseName();
    try {
      busy(true, '正在导出…', '保存 TMX', 30, { cancellable: false });
      const r1 = await saveFile(tmx, `${base}.tmx`, 'application/octet-stream');
      busy(true, '正在导出…', '生成小地图', 65, { cancellable: false });
      const png = await buildMapPng();
      if (png) { await sleep(150); await saveFile(png, `${base}_map.png`, 'image/png'); }
      const pi = S.lastPngInfo;
      const doneMsg = `已导出 ${r1.desktop ? r1.name : `${base}.tmx`}${png ? ` 与 _map.png（${pi.width}×${pi.height} · ${(pi.size / 1024).toFixed(0)}KB）` : '（小地图生成失败）'}`;
      if (r1.desktop) toast(doneMsg, png ? 'success' : 'warn', 5200, { action: { label: '打开文件夹', fn: () => window.DesktopBridge.reveal(r1.path) } });
      else toast(r1.pending ? '等待存储权限授予后自动保存' : doneMsg, png ? 'success' : 'warn', 4200);
      setStatus(`已导出：${base}.tmx`);
    } catch (e) { toast('导出失败：' + e.message, 'error', 4200); }
    finally { busy(false); }
  });
}
async function exportZipFn() {
  await locked(async () => {
    const tmx = await prepareTmxForExport(); if (!tmx) return;
    busy(true, '正在打包 ZIP…', '生成小地图图片', 30, { cancellable: false });
    try {
      const base = exportBaseName();
      const png = await buildMapPng();
      if (!png) { toast('小地图图片生成失败，未导出', 'error'); return; }
      const s = S.snapshot;
      const cc = ccMapFor(tmx), sp = currentSpawns();
      const table = sp.slice(0, cc.capacity).map((q, i) => `  玩家 ${String(i + 1).padStart(2)}  team ${String(i).padStart(2)}  GID ${cc.gidForTeam(i)}  坐标(行,列) ${q[0] + 1},${q[1] + 1}  队伍 ${teamOf(q, i)}`).join('\r\n');
      const info = new TextEncoder().encode(`铁锈战争地图生成器离线版 v${APP_VERSION}\r\n地图：${s?.meta?.width || 0} × ${s?.meta?.height || 0}\r\n出生点：${sp.length}\r\n资源点：${s?.resource_positions?.length || 0}\r\n对称：${MIRROR_LABELS[s?.meta?.mirroring] || '不对称'}\r\n小地图：${S.lastPngInfo ? `${S.lastPngInfo.width}×${S.lastPngInfo.height} · ${(S.lastPngInfo.size / 1024).toFixed(1)}KB · ${PNG_STYLES[S.lastPngInfo.style]}` : '—'}\r\n槽位映射：${CC_SOURCE_LABEL[cc.source]}${S.slotVerified ? '（已读回校验）' : ''}\r\n导出时间：${new Date().toLocaleString()}\r\n\r\n出生点槽位表（玩家 N = team N-1）：\r\n${table}\r\n`);
      busy(true, '正在打包 ZIP…', '计算校验', 60, { cancellable: false });
      await nextFrame();
      const zip = zipStore([{ name: `${base}.tmx`, data: tmx }, { name: `${base}_map.png`, data: png }, { name: '说明.txt', data: info }]);
      busy(true, '正在打包 ZIP…', '保存文件', 85, { cancellable: false });
      const r = await saveFile(zip, `${base}.zip`, 'application/zip');
      if (r.desktop) window.DesktopBridge.savedToast(r, `导出完成：${r.name}`);
      else toast(r.pending ? '等待存储权限授予后自动保存' : `导出完成：${base}.zip`, 'success', 3600);
    } catch (e) { toast('导出失败：' + e.message, 'error', 4200); }
    finally { busy(false); }
  });
}

/* ZIP（STORE 无压缩）：修复中文文件名乱码（设置 UTF-8 标志位 0x0800）、补充修改时间、查表 CRC32 */
const CRC_TABLE = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(bytes) { let c = 0xffffffff; for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function zipStore(entries) {
  const enc = new TextEncoder(), d = new Date();
  const dosTime = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
  const dosDate = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  const parts = [], central = []; let offset = 0;
  for (const e of entries) {
    const name = enc.encode(e.name), data = e.data, crc = crc32(data);
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true);
    lh.setUint16(10, dosTime, true); lh.setUint16(12, dosDate, true); lh.setUint32(14, crc, true);
    lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true); lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true);
    parts.push(new Uint8Array(lh.buffer), name, data);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(10, 0, true);
    ch.setUint16(12, dosTime, true); ch.setUint16(14, dosDate, true); ch.setUint32(16, crc, true);
    ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true); ch.setUint16(28, name.length, true);
    ch.setUint32(42, offset, true);
    central.push(new Uint8Array(ch.buffer), name);
    offset += 30 + name.length + data.length;
  }
  const cSize = central.reduce((n, a) => n + a.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, entries.length, true); end.setUint16(10, entries.length, true);
  end.setUint32(12, cSize, true); end.setUint32(16, offset, true);
  const all = [...parts, ...central, new Uint8Array(end.buffer)];
  const out = new Uint8Array(all.reduce((n, a) => n + a.length, 0)); let o = 0;
  for (const a of all) { out.set(a, o); o += a.length; }
  return out;
}

/* ------------------------------------------------------------------ 小地图 PNG（3.4.0 重写）
 * 需求：导出的 _map.png 与画布预览一致，能看到出生点（带玩家编号、队伍色环）与资源点；
 *       分辨率 ≤ 500×500，文件 ≤ 512KB，PNG 格式，文件名 = 地图名 + _map.png。
 * 旧版问题：
 *  1. 按「1 格 = 1 像素」输出，地图小于 500 时不放大 —— 80×80 地图只有 80×80 像素，出生点只有 2px 小圆点；
 *  2. 出生点半径 = 格子大小 × 1.6，大地图（格子 < 1px）时出生点 / 资源点几乎看不见，也没有编号；
 *  3. 资源点画成圆点，与画布上的菱形不一致；
 *  4. 超过 512KB 时每次缩小 30%，最多 6 次，很快缩到看不清；失败时无任何提示。
 * 新实现：长边固定缩放到 500（小图放大、大图缩小，像素风最近邻采样），标注尺寸按图片尺寸而不是格子尺寸计算，
 *       并按出生点最小间距自动收缩避免重叠；超限时按 8% 步长逐级缩小，同时报告最终尺寸 / 体积。 */
const PNG_MAX_DIM = 500, PNG_MAX_BYTES = 512 * 1024;
const PNG_STYLES = { full: '标注：编号 + 资源', dots: '标注：仅点位', terrain: '纯地形' };
function mapPngStyle() { const v = $('mapPngStyle')?.value; return PNG_STYLES[v] ? v : 'full'; }
function drawPngSpawn(ctx, x, y, R, team, label) {
  ctx.beginPath(); ctx.arc(x, y + Math.max(0.8, R * 0.14), R, 0, Math.PI * 2); ctx.fillStyle = 'rgba(0,0,0,.42)'; ctx.fill();
  ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2);
  const g = ctx.createRadialGradient(x - R * 0.35, y - R * 0.4, 0.5, x, y, R);
  g.addColorStop(0, '#fff3b8'); g.addColorStop(1, '#f2b829');
  ctx.fillStyle = g; ctx.fill();
  ctx.lineWidth = Math.max(1.2, R * 0.26); ctx.strokeStyle = TEAM_COLORS[team] || '#2a1f00'; ctx.stroke();
  if (label) {
    ctx.fillStyle = '#3a2600';
    ctx.font = `800 ${Math.round(R * (label.length > 1 ? 0.98 : 1.18))}px system-ui,"Microsoft YaHei",sans-serif`;
    ctx.fillText(label, x, y + R * 0.06);
  }
}
function drawPngResource(ctx, x, y, r) {
  ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y); ctx.closePath();
  ctx.fillStyle = '#55e6a5'; ctx.fill();
  ctx.lineWidth = Math.max(1, r * 0.28); ctx.strokeStyle = 'rgba(6,40,26,.9)'; ctx.stroke();
}
function drawExportPng(maxDim = PNG_MAX_DIM, style = mapPngStyle()) {
  const [rows, cols] = dims(); if (!rows || !cols) return null;
  const k = Math.min(PNG_MAX_DIM, maxDim) / Math.max(rows, cols);
  const w = clamp(Math.round(cols * k), 1, PNG_MAX_DIM), h = clamp(Math.round(rows * k), 1, PNG_MAX_DIM);
  const sx = w / cols, sy = h / rows;
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#0a1423'; ctx.fillRect(0, 0, w, h);
  ctx.imageSmoothingEnabled = false;
  const base = baseCanvasFor(terrainMatrix() || getMatrix('id_matrix'));
  if (base) ctx.drawImage(base, 0, 0, w, h);
  const wall = wallCanvasFor(getMatrix('wall_matrix'), S.snapshot?.meta?.hill_drawing_mode === 'polygon' ? 'polygon' : 'brush');
  if (wall) ctx.drawImage(wall, 0, 0, w, h);
  if (style === 'terrain') return cv;
  ctx.imageSmoothingEnabled = true;
  const minSide = Math.min(w, h), at = (r, c) => [(c + 0.5) * sx, (r + 0.5) * sy];
  // 资源点：菱形（与画布一致）
  const res = S.snapshot?.resource_positions || [];
  const rr = clamp(minSide * 0.013, 2.4, 6.5);
  for (const [r, c] of res) { const [x, y] = at(r, c); drawPngResource(ctx, x, y, rr); }
  // 出生点：半径按图片尺寸计算，再按最小间距收缩，保证不重叠
  const sp = currentSpawns();
  if (sp.length) {
    let R = clamp(minSide * 0.024, 3.2, 11);
    let dMin = Infinity;
    const pts = sp.map(q => at(q[0], q[1]));
    for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) dMin = Math.min(dMin, Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1]));
    if (Number.isFinite(dMin)) R = clamp(Math.min(R, dMin * 0.48), 2.6, 11);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const numbered = style === 'full' && R >= 4.6;
    sp.forEach((q, i) => { const [x, y] = pts[i]; drawPngSpawn(ctx, x, y, R, teamOf(q, i), numbered ? String(i + 1) : ''); });
  }
  return cv;
}
const canvasToPng = cv => new Promise(r => cv.toBlob(r, 'image/png'));
/** 返回 { bytes, width, height, size, style, steps }；无法满足 512KB 时返回 null */
async function buildMapPngInfo(style = mapPngStyle()) {
  let maxDim = PNG_MAX_DIM;
  for (let step = 0; step < 14; step++) {
    const cv = drawExportPng(maxDim, style); if (!cv) return null;
    const blob = await canvasToPng(cv);
    if (blob && blob.size <= PNG_MAX_BYTES) {
      return { bytes: new Uint8Array(await blob.arrayBuffer()), width: cv.width, height: cv.height, size: blob.size, style, steps: step };
    }
    maxDim = Math.max(96, Math.floor(maxDim * 0.92));
  }
  return null;
}
async function buildMapPng() {
  const info = await buildMapPngInfo();
  S.lastPngInfo = info ? { width: info.width, height: info.height, size: info.size, style: info.style } : null;
  if (info?.steps) console.info(`小地图超过 512KB，已缩小到 ${info.width}×${info.height}`);
  return info?.bytes || null;
}
/* 3.4.0 新增：小地图预览 —— 导出前查看最终 PNG（尺寸、体积、样式、文件名） */
async function showMapPngPreview() {
  if (!S.snapshot) { toast('请先生成或导入地图', 'warn'); return; }
  if (!guard()) return;
  S.locked = true;
  let info = null;
  try { busy(true, '正在生成小地图预览…', '', null, { cancellable: false }); await nextFrame(); info = await buildMapPngInfo(); }
  finally { busy(false); S.locked = false; }
  if (!info) { toast('小地图生成失败', 'error'); return; }
  const url = URL.createObjectURL(new Blob([info.bytes], { type: 'image/png' }));
  const name = `${exportBaseName()}_map.png`;
  const k = await uiChoice('小地图预览', `
    <div class="png-preview"><img src="${url}" alt="小地图预览" width="${info.width}" height="${info.height}"></div>
    <div class="png-meta"><span>${info.width} × ${info.height}</span><span>${(info.size / 1024).toFixed(1)} KB / 512 KB</span><span>PNG</span><span>${escapeHtml(PNG_STYLES[info.style])}</span></div>
    <p class="help-p">文件名：<code>${escapeHtml(name)}</code>${info.steps ? `<br>原始图像超过 512KB，已自动缩小 ${info.steps} 级以满足体积限制。` : ''}</p>`,
  [{ key: 'cancel', label: '关闭' }, { key: 'export', label: '导出 TMX+小地图', primary: true }], { wide: true });
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  if (k === 'export') exportPair();
}

/* ------------------------------------------------------------------ 图片导入海岸线 */
async function importImage(file) {
  if (!file) return;
  await locked(async () => {
    try {
      busy(true, '正在分析地形图片…', file.name, null, { cancellable: false });
      const bmp = await createImageBitmap(file);
      const k = Math.min(1, MAX_MAP_DIMENSION / Math.max(bmp.width, bmp.height));
      const iw = clamp(Math.round(bmp.width * k), 40, MAX_MAP_DIMENSION), ih = clamp(Math.round(bmp.height * k), 40, MAX_MAP_DIMENSION);
      const canvas = document.createElement('canvas'); canvas.width = iw; canvas.height = ih;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(bmp, 0, 0, iw, ih);
      bmp.close?.();
      const px = ctx.getImageData(0, 0, iw, ih).data, data = new Int32Array(iw * ih);
      for (let i = 0; i < data.length; i++) {
        const r = px[i * 4], g = px[i * 4 + 1], b = px[i * 4 + 2], lum = 0.299 * r + 0.587 * g + 0.114 * b;
        if (lum < 30) data[i] = 0;
        else if (lum > 225) data[i] = 1;
        else if (g > 60 && g > r * 1.5 && g > b * 1.5) data[i] = -2;
        else data[i] = Math.min(9, Math.max(1, Math.round((lum / 255) * 9)));
      }
      resetEditorState();
      $('width').value = iw; $('height').value = ih;
      const p = params();
      // 优化：以 TypedArray 零拷贝传给 Worker（旧实现 Array.from 400 万元素，主线程卡顿明显）
      await run('set_coastline_from_image', { data, height: ih, width: iw, mirroring: 'none', tileset: p.tileset, heightLevels: p.heightLevels, oceanLevels: p.oceanLevels, numPlayers: p.numPlayers, numResources: p.numResources }, '正在导入图片地形…', { transfer: [data.buffer] });
      S.view.fitted = false; fitView();
      $('imageName').textContent = `已导入：${file.name} · ${iw} × ${ih}`;
      toast('图片地形导入完成，下一步请绘制墙体或直接生成高度', 'success');
      setStep(1);
    } catch (e) { if (!e.cancelled) { setStatus('图片导入失败：' + e.message); toast('图片导入失败：' + e.message, 'error'); } }
    finally { busy(false); $('imageFile').value = ''; }
  });
}

/* ------------------------------------------------------------------ 项目存储（IndexedDB）
 * 旧实现：localStorage 存 Base64 TMX，超过约 5MB 配额就保存失败；每次操作后弹「项目已保存」刷屏；
 * 恢复项目时只恢复参数，不显示地图；新建项目依赖 confirm()（WebView 未设置 WebChromeClient 时恒为 false）。
 */
const ProjectStore = {
  db: null,
  open() {
    if (this.db) return Promise.resolve(this.db);
    return new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) { reject(new Error('IndexedDB 不可用')); return; }
      const req = indexedDB.open('tmx_mapforge', 1);
      req.onupgradeneeded = () => req.result.createObjectStore('kv');
      req.onsuccess = () => { this.db = req.result; resolve(this.db); };
      req.onerror = () => reject(req.error);
    });
  },
  async tx(mode, fn) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const t = db.transaction('kv', mode), st = t.objectStore('kv'), req = fn(st);
      t.oncomplete = () => resolve(req?.result);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error || new Error('事务中止'));
    });
  },
  get(k) { return this.tx('readonly', st => st.get(k)); },
  put(k, v) { return this.tx('readwrite', st => st.put(v, k)); },
  del(k) { return this.tx('readwrite', st => st.delete(k)); }
};
function projectPayload() {
  return {
    version: PROJECT_FORMAT, app: APP_VERSION, savedAt: Date.now(),
    params: params(), mapName: $('mapName').value, preset: $('gamePreset').value,
    symmetryStrength: $('symmetryStrength').value, slotOrder: $('slotOrder').value,
    grid: getGrid(), polygons: clonePolys(), spawnPositions: currentSpawns(),
    teamOverrides: [...S.teamOverrides], tmx: S.lastTmx && S.lastTmx.length < 64e6 ? S.lastTmx : null,
    autoSaveEnabled: S.autoSave, mode: S.mode
  };
}
async function saveProject(silent = false) {
  try {
    if (S.unitsDirty && S.lastTmx) await syncTmxUnits();
    await ProjectStore.put('current', projectPayload());
    const t = new Date().toLocaleTimeString();
    $('projectInfo').textContent = `${silent ? '已自动保存' : '项目已保存'} · ${t}${S.lastTmx ? ` · 含 TMX（${(S.lastTmx.length / 1024).toFixed(0)} KB）` : ''}`;
    if (!silent) toast('项目已保存到本机', 'success');
  } catch (e) {
    if (!silent) toast('项目保存失败：' + e.message, 'error');
    else console.warn('自动保存失败', e);
  }
}
let autoSaveTimer = null;
function queueAutoSave() { if (!S.autoSave) return; clearTimeout(autoSaveTimer); autoSaveTimer = setTimeout(() => { if (!S.locked) saveProject(true); else queueAutoSave(); }, 1500); }
function applyProjectParams(p) {
  const set = (id, v) => { if (v != null && $(id)) $(id).value = v; };
  const pr = p.params || {};
  set('width', pr.width); set('height', pr.height); set('heightLevels', pr.heightLevels); set('oceanLevels', pr.oceanLevels);
  set('players', pr.numPlayers); set('resources', pr.numResources); set('tileset', pr.tileset); set('mirror', pr.mirroring);
  set('gamePreset', p.preset); set('symmetryStrength', p.symmetryStrength || 'balanced'); set('slotOrder', p.slotOrder || 'alternate');
  set('mapName', p.mapName || '');
  renderGrid(p.grid);
  updateMirrorHint();
}
async function restoreProject(p, label = '项目') {
  let tmx = p.tmx;
  if (typeof tmx === 'string') tmx = base64ToBytes(tmx);
  // 3.2.0 修复：恢复「仅参数」的项目时，旧实现保留了画布上的上一张地图，并把新项目的队伍数据套在旧出生点上
  if (!tmx?.length) await resetAll({ keepParams: true });
  applyProjectParams(p);
  if (tmx?.length) {
    await loadTmxBytes(tmx instanceof Uint8Array ? tmx : new Uint8Array(tmx), p.mapName, { fromProject: true });
    if (Array.isArray(p.spawnPositions)) {
      S.teamOverrides = new Map(p.teamOverrides || []);
      const valid = p.spawnPositions.filter(q => Array.isArray(q) && validCell({ row: q[0], col: q[1] }));
      setSpawns(valid, { markDirty: true });
    }
  } else {
    S.teamOverrides = new Map(p.teamOverrides || []);
  }
  S.polygons = (p.polygons || []).filter(x => Array.isArray(x?.vertices));
  S.polygonSeq = S.polygons.reduce((m, x) => Math.max(m, Number(x.id) || 0), 0) + 1;
  updatePolygonInfo();
  updateSpawnUI();
  if (p.mode === 'quick' || p.mode === 'wizard') setMode(p.mode);
  scheduleRender();
  toast(`已恢复${label}${tmx?.length ? '（含地图）' : '（仅参数）'}`, 'success');
}
async function loadProject() {
  await locked(async () => {
    try {
      let p = await ProjectStore.get('current').catch(() => null);
      if (!p) { const raw = localStorage.getItem(LEGACY_PROJECT_KEY); if (raw) p = JSON.parse(raw); }
      if (!p) { toast('没有找到本机项目草稿'); return; }
      busy(true, '正在恢复项目…', '', null, { cancellable: false });
      await restoreProject(p, '项目草稿');
    } catch (e) { toast('项目恢复失败：' + e.message, 'error'); }
    finally { busy(false); }
  });
}
async function exportProject() {
  await locked(async () => {
    try {
      if (S.unitsDirty) await syncTmxUnits();
      const p = projectPayload();
      p.tmx = S.lastTmx ? bytesToBase64(S.lastTmx) : null;
      const r = await saveFile(new TextEncoder().encode(JSON.stringify(p)), `${exportBaseName()}_project.json`, 'application/json');
      if (r.desktop) window.DesktopBridge.savedToast(r, `项目文件已导出：${r.name}`);
      else toast(r.pending ? '等待存储权限授予后自动保存' : '项目文件已导出', 'success');
    } catch (e) { toast('导出项目失败：' + e.message, 'error'); }
  });
}
async function importProjectFile(file) {
  await locked(async () => {
    try {
      busy(true, '正在导入项目…', file.name, null, { cancellable: false });
      const p = JSON.parse(await file.text());
      if (!p || typeof p !== 'object' || !p.params) throw new Error('不是有效的项目文件');
      await restoreProject(p, '项目文件');
      queueAutoSave();
    } catch (e) { toast('项目导入失败：' + e.message, 'error', 4200); }
    finally { busy(false); $('tmxFile').value = ''; }
  });
}
async function newProject() {
  const ok = await uiConfirm('新建项目', '将清除当前地图、出生点与编辑历史（参数保留）。本机自动保存的草稿也会被清空。', '新建', true);
  if (!ok) return;
  await resetAll({ keepParams: true });
  try { await ProjectStore.del('current'); } catch { /* ignore */ }
  localStorage.removeItem(LEGACY_PROJECT_KEY);
  $('projectInfo').textContent = '已新建项目 · 草稿已清空';
  toast('已新建项目', 'success');
}
async function resetAll({ keepParams = false } = {}) {
  stopAnimation();
  resetEditorState();
  Engine.call('reset_state').catch(() => {});
  S.lastTmx = null; S.snapshot = null; S.source = null; S.tmxDirty = false; S.unitsDirty = false; S.slotVerified = null;
  S.view = { zoom: 1, x: 0, y: 0, fitted: false };
  setExportEnabled(false); updateDirtyNote();
  if (!keepParams) {
    $('width').value = DEFAULTS.width; $('height').value = DEFAULTS.height; $('tileset').value = DEFAULTS.tileset;
    $('heightLevels').value = DEFAULTS.heightLevels; $('oceanLevels').value = DEFAULTS.oceanLevels;
    $('players').value = DEFAULTS.players; $('resources').value = DEFAULTS.resources; $('mirror').value = DEFAULTS.mirror;
    $('gamePreset').value = DEFAULTS.preset; $('symmetryStrength').value = DEFAULTS.symmetryStrength; $('slotOrder').value = DEFAULTS.slotOrder;
    $('mapName').value = ''; $('seed').value = ''; $('wallMagnetism').value = 0; $('magnetText').textContent = '0';
    renderGrid();
    savePrefs();
  }
  $('stats').textContent = '';
  $('emptyState').classList.remove('hide');
  $('imageName').textContent = '未导入图片 · 暗色=水域，亮色=陆地，绿色=缺口';
  S.step = 0; updateSteps(-1); updateSpawnUI(); updateMirrorHint(); scheduleRender();
  setStatus(keepParams ? '已清空当前地图' : '已恢复默认设置');
}

/* ------------------------------------------------------------------ 偏好持久化 */
function savePrefs() {
  try {
    const p = params();
    localStorage.setItem(PREF_KEY, JSON.stringify({
      w: p.width, h: p.height, hl: p.heightLevels, ol: p.oceanLevels, pl: p.numPlayers, rs: p.numResources, ts: p.tileset,
      mirror: $('mirror').value, grid: getGrid(), preset: $('gamePreset').value, sym: $('symmetryStrength').value, slot: $('slotOrder').value,
      name: $('mapName').value, smart: S.smartPlacement, autoSave: S.autoSave, animate: S.animate, png: mapPngStyle()
    }));
  } catch { /* 隐私模式等 */ }
}
let prefsTimer = null;
function queuePrefs() { clearTimeout(prefsTimer); prefsTimer = setTimeout(savePrefs, 400); }
function loadPrefs() {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(PREF_KEY) || 'null'); } catch { s = null; }
  if (!s) { renderGrid(); return; }
  const set = (id, v) => { const el = $(id); if (el && v != null) el.value = v; };
  set('width', s.w); set('height', s.h); set('heightLevels', s.hl); set('oceanLevels', s.ol); set('players', s.pl); set('resources', s.rs);
  set('tileset', s.ts); set('mirror', s.mirror); set('gamePreset', s.preset); set('symmetryStrength', s.sym); set('slotOrder', s.slot); set('mapName', s.name);
  if (typeof s.smart === 'boolean') S.smartPlacement = s.smart;
  if (typeof s.autoSave === 'boolean') S.autoSave = s.autoSave;
  if (typeof s.animate === 'boolean') S.animate = s.animate;
  if (PNG_STYLES[s.png]) set('mapPngStyle', s.png);
  renderGrid(Array.isArray(s.grid) && s.grid.length === 5 ? s.grid : undefined);
}
function syncPresetFromPlayers() {
  const n = intOf('players', 0, MAX_SPAWN_POINTS, 10);
  const hit = Object.entries(PRESET_COUNTS).find(([, v]) => v === n);
  $('gamePreset').value = hit ? hit[0] : 'free';
}
function applyPreset() {
  const n = PRESET_COUNTS[$('gamePreset').value];
  if (n) { $('players').value = n; flashInput('players'); }
  updateMirrorHint(); queuePrefs();
}
function flashInput(id) { const el = $(id); el.classList.remove('flash-input'); void el.offsetWidth; el.classList.add('flash-input'); }

/* ------------------------------------------------------------------ 主题 / 系统栏 */
function applyTheme(i, announce = false) {
  S.themeIndex = ((i % THEMES.length) + THEMES.length) % THEMES.length;
  const t = THEMES[S.themeIndex];
  document.body.dataset.theme = t.id;
  document.querySelector('meta[name=theme-color]').setAttribute('content', t.bar);
  canvasBg = cssVar('--canvas-bg') || '#050b14';
  try { localStorage.setItem(THEME_KEY, String(S.themeIndex)); } catch { /* ignore */ }
  try { window.AndroidBridge?.setSystemBars?.(t.bar, t.lightIcons); } catch { /* 旧版桥接 */ }
  $('themeToggle').title = `主题：${t.name}（点击切换）`;
  if (announce) toast(`主题：${t.name}`);
  scheduleRender();
}

/* ------------------------------------------------------------------ 抽屉 / 折叠卡片 */
const isNarrow = () => window.matchMedia('(max-width:900px)').matches;
function openDrawer() { $('sidebar').classList.add('open'); $('drawerBackdrop').classList.add('show'); $('menuBtn').setAttribute('aria-expanded', 'true'); }
function closeDrawer() { $('sidebar').classList.remove('open'); $('drawerBackdrop').classList.remove('show'); $('menuBtn').setAttribute('aria-expanded', 'false'); }
function loadUiState() { try { return JSON.parse(localStorage.getItem(UI_KEY) || '{}') || {}; } catch { return {}; } }
function saveUiState(st) { try { localStorage.setItem(UI_KEY, JSON.stringify(st)); } catch { /* ignore */ } }
function bindAccordion() {
  const st = loadUiState(); st.collapsed ||= {};
  document.querySelectorAll('.card[data-card]').forEach(card => {
    const key = card.dataset.card;
    if (st.collapsed[key]) card.classList.add('collapsed');
    card.querySelector('.section-title').addEventListener('click', () => {
      card.classList.toggle('collapsed');
      st.collapsed[key] = card.classList.contains('collapsed');
      saveUiState(st);
    });
  });
}

/* ------------------------------------------------------------------ 模式切换 */
function setMode(m) {
  S.mode = m;
  $('quickTab').classList.toggle('active', m === 'quick');
  $('wizardTab').classList.toggle('active', m === 'wizard');
  document.querySelector('.tabs').dataset.active = m;
  $('wizardSec').hidden = m !== 'wizard';
  $('toolPalette').hidden = m !== 'wizard';
  if (m === 'wizard') { $('wizardSec').classList.add('reveal'); setStep(S.step, false); }
  else setTool('pan', false);
  updateSteps();
  if (S.view.fitted) fitView(true); else scheduleRender();
}

/* ------------------------------------------------------------------ 帮助 */
function showHelp() {
  uiChoice('快捷键与操作说明', `
    <div class="help-grid">
      <div><kbd>Ctrl</kbd>+<kbd>Enter</kbd></div><div>生成地图</div>
      <div><kbd>Ctrl</kbd>+<kbd>Z</kbd> / <kbd>Y</kbd></div><div>全局撤销 / 重做</div>
      <div><kbd>Ctrl</kbd>+<kbd>S</kbd></div><div>保存项目</div>
      <div><kbd>Ctrl</kbd>+<kbd>E</kbd></div><div>导出 TMX + 小地图</div>
      <div><kbd>F</kbd> / <kbd>0</kbd></div><div>适应画布 / 1:1 像素</div>
      <div><kbd>+</kbd> / <kbd>-</kbd></div><div>放大 / 缩小</div>
      <div><kbd>V</kbd> <kbd>B</kbd> <kbd>P</kbd> <kbd>C</kbd> <kbd>R</kbd></div><div>分步模式：平移 / 画笔 / 多边形 / 出生点 / 资源</div>
      <div><kbd>Del</kbd></div><div>删除选中的出生点</div>
      <div><kbd>M</kbd></div><div>打开出生点槽位映射表</div>
      <div><kbd>I</kbd></div><div>预览导出的小地图 PNG</div>
      <div><kbd>[</kbd> / <kbd>]</kbd></div><div>画笔变小 / 变大</div>
      <div><kbd>H</kbd> / <kbd>?</kbd></div><div>打开本帮助</div>
      <div><kbd>Space</kbd>+拖动</div><div>任意工具下临时平移</div>
      <div><kbd>Esc</kbd></div><div>取消绘制 / 取消选择 / 关闭面板</div>
    </div>
    <p class="help-p">槽位规则：<b>出生点 N = 游戏玩家 N = 瓦片 team 属性 N-1</b>。导出前会按 team 属性写入 GID 并读回校验；修改队伍会自动重排槽位，「设为玩家 1」只交换槽位、不影响其他玩家。</p>
    <p class="help-p">触屏：单指拖动平移，双指缩放（抬起一指可继续平移）；长按删除出生点/资源点；拖动出生点可直接移动。手机上右下角的悬浮按钮可直接生成 / 导出 / 撤销。</p>
    ${window.DesktopBridge ? '<p class="help-p">PC 版：<kbd>F11</kbd> 全屏；把 TMX / 项目文件 / 地形图片拖进窗口即可导入；导出文件保存在「项目 / 恢复」卡片中设置的导出目录（默认系统下载目录）；关闭窗口前自动保存草稿。</p>' : ''}
    <p class="help-p">版本 v${APP_VERSION}${window.DesktopBridge ? ' · PC 版' : ''} · 所有计算均在本机完成，不联网。</p>`, [{ key: 'ok', label: '知道了', primary: true }]);
}

/* ------------------------------------------------------------------ Android 返回键 / 生命周期 */
window.__onAndroidBack = () => {
  if (closeModal('cancel')) return true;
  if (!$('busy').hidden && animTimer) { stopAnimation(); return true; }
  if ($('sidebar').classList.contains('open')) { closeDrawer(); return true; }
  if (S.drawingPolygon) { S.drawingPolygon = null; updatePolygonInfo(); scheduleRender(); return true; }
  if (S.selectedSpawn >= 0) { selectSpawn(-1); return true; }
  return false;
};
/* 3.2.0：原生侧异步保存结果回调（Android 9 及以下等待存储权限后才真正写入，旧版网页永远不知道结果） */
window.__onNativeSaveResult = (ok, msg) => {
  if (ok) toast(`已保存到下载目录：${msg}`, 'success', 3600);
  else toast(`保存失败：${msg}`, 'error', 4600);
};
// 3.5.0：返回 Promise，PC 版关闭窗口时可等待保存完成（Android 端忽略返回值，行为不变）
window.__onAppPause = () => (S.autoSave && (S.snapshot || S.lastTmx)) ? saveProject(true) : Promise.resolve();
// 3.5.0：供 desktop-bridge.js 使用的最小接口（Toast 提示）
window.TMXApp = { toast: (...a) => toast(...a), version: APP_VERSION };

/* ------------------------------------------------------------------ 按钮涟漪 */
document.addEventListener('pointerdown', e => {
  const b = e.target.closest('button'); if (!b || b.disabled || b.classList.contains('cell')) return;
  const r = b.getBoundingClientRect(), s = Math.max(r.width, r.height) * 1.2;
  const rip = document.createElement('span');
  rip.className = 'ripple';
  rip.style.cssText = `width:${s}px;height:${s}px;left:${e.clientX - r.left - s / 2}px;top:${e.clientY - r.top - s / 2}px`;
  b.appendChild(rip);
  setTimeout(() => rip.remove(), 600);
}, { passive: true });

/* ------------------------------------------------------------------ 控件绑定 */
function bindControls() {
  $('versionBadge').textContent = 'v' + APP_VERSION + (window.DesktopBridge ? ' · PC' : '');
  $('menuBtn').onclick = () => $('sidebar').classList.contains('open') ? closeDrawer() : openDrawer();
  $('drawerBackdrop').onclick = closeDrawer;
  // 修复：旧实现抽屉内任何按钮（包括海岸线方格、图层开关）点击后都会收起抽屉
  $('sidebar').addEventListener('click', e => {
    if (!isNarrow()) return;
    if (e.target.closest('#generate,[data-act],#spawnAuto,#ccRandom,#resRandom,#fitMap,#imageImport,#tmxImport,#export,#exportZip,#pngPreview')) setTimeout(closeDrawer, 160);
  });
  $('minimap').addEventListener('pointerdown', e => {
    if (!S.snapshot) return;
    $('minimap').setPointerCapture(e.pointerId);
    minimapNavigate(e);
    const mv = ev => minimapNavigate(ev), upf = () => { $('minimap').removeEventListener('pointermove', mv); $('minimap').removeEventListener('pointerup', upf); };
    $('minimap').addEventListener('pointermove', mv); $('minimap').addEventListener('pointerup', upf);
  });
  ['width', 'height', 'heightLevels', 'oceanLevels', 'players', 'resources', 'tileset', 'mirror', 'symmetryStrength', 'slotOrder', 'mapName'].forEach(id => {
    const el = $(id);
    const fn = () => { queuePrefs(); if (['players', 'mirror', 'width', 'height', 'symmetryStrength'].includes(id)) updateMirrorHint(); if (id === 'players') syncPresetFromPlayers(); };
    el.addEventListener('change', fn); el.addEventListener('input', fn);
  });
  [['width', 40, 2000, 160], ['height', 40, 2000, 160], ['heightLevels', 1, 32, 7], ['oceanLevels', 0, 32, 3], ['players', 0, MAX_SPAWN_POINTS, 10], ['resources', 0, MAX_RESOURCES, 12]].forEach(([id, mn, mx, dft]) => {
    $(id).addEventListener('blur', () => { clampInput(id, mn, mx, dft); updateMirrorHint(); });
  });
  document.querySelectorAll('[data-size]').forEach(b => b.onclick = () => { $('width').value = b.dataset.size; $('height').value = b.dataset.size; flashInput('width'); flashInput('height'); updateMirrorHint(); queuePrefs(); });
  $('gridRandom').onclick = randomGrid;
  $('gridInvert').onclick = () => { renderGrid(getGrid().map(r => r.map(v => v ? 0 : 1))); queuePrefs(); };
  $('gridDefault').onclick = () => { renderGrid(); queuePrefs(); };

  $('generate').onclick = () => generate();
  // 3.2.0：手机端悬浮操作按钮，无需打开抽屉即可生成 / 导出 / 撤销
  $('fabGenerate').onclick = () => generate();
  $('fabExport').onclick = () => exportPair();
  $('fabUndo').onclick = () => globalUndo();
  $('reset').onclick = async () => { if (await uiConfirm('恢复默认', '将清除当前地图，并把所有参数恢复为默认值。', '恢复默认', true)) { await resetAll(); toast('已恢复默认设置'); } };
  $('export').onclick = () => exportPair();
  $('pngPreview').onclick = () => showMapPngPreview();
  $('mapPngStyle').onchange = () => { queuePrefs(); toast(`小地图样式：${PNG_STYLES[mapPngStyle()]}`); };
  $('exportZip').onclick = () => exportZipFn();
  $('quickTab').onclick = () => setMode('quick');
  $('wizardTab').onclick = () => setMode('wizard');
  document.querySelectorAll('[data-act]').forEach(b => b.onclick = () => action(b.dataset.act).catch(() => {}));
  document.querySelectorAll('#toolPalette [data-tool]').forEach(b => b.onclick = () => setTool(b.dataset.tool));

  $('brushSize').oninput = e => { S.brushSize = Number(e.target.value); $('brushSizeText').textContent = S.brushSize; scheduleRender(); };
  $('wallMagnetism').oninput = e => { $('magnetText').textContent = e.target.value; };
  const setBrush = (v, erase) => { S.brushValue = v; S.brushErasing = erase; [$('wallBrush'), $('gapBrush'), $('eraseBrush')].forEach(x => x.classList.remove('active')); $(erase ? 'eraseBrush' : v === 2 ? 'gapBrush' : 'wallBrush').classList.add('active'); if (S.mode === 'wizard') setTool('brush'); };
  $('wallBrush').onclick = () => setBrush(1, false);
  $('gapBrush').onclick = () => setBrush(2, false);
  $('eraseBrush').onclick = () => setBrush(S.brushValue, true);
  const setHill = async m => {
    S.hillMode = m;
    $('brushMode').classList.toggle('active', m === 'brush'); $('polygonMode').classList.toggle('active', m === 'polygon');
    $('brushControls').hidden = m !== 'brush'; $('polygonControls').hidden = m !== 'polygon';
    if (S.mode === 'wizard') setTool(m, false);
    updatePolygonInfo();
    if (S.source === 'engine' && S.snapshotEpoch === S.engineEpoch) {
      try { const r = await Engine.call('set_hill_drawing_mode', { mode: m }); await applyEngineResult('set_hill_drawing_mode', r, ''); } catch { /* ignore */ }
    }
  };
  $('brushMode').onclick = () => setHill('brush');
  $('polygonMode').onclick = () => setHill('polygon');
  $('cancelPolygon').onclick = () => { S.drawingPolygon = null; updatePolygonInfo(); scheduleRender(); };
  $('deletePolygon').onclick = () => deleteSelectedPolygon();
  $('toggleGap').onclick = () => toggleGap();
  $('ccManual').onclick = () => { $('ccManual').classList.add('active'); $('ccRandom').classList.remove('active'); S.step = 3; setTool('cc'); };
  $('ccRandom').onclick = () => { $('ccRandom').classList.add('active'); $('ccManual').classList.remove('active'); action('place_cc_random'); };
  $('resManual').onclick = () => { $('resManual').classList.add('active'); $('resRandom').classList.remove('active'); S.step = 4; setTool('resource'); };
  $('resRandom').onclick = () => { $('resRandom').classList.add('active'); $('resManual').classList.remove('active'); action('place_resource_random'); };
  $('imageImport').onclick = () => $('imageFile').click();
  $('imageFile').onchange = e => importImage(e.target.files?.[0]);
  $('fitMap').onclick = () => fitView(true);
  $('zoomIn').onclick = () => zoomAt(1.3);
  $('zoomOut').onclick = () => zoomAt(1 / 1.3);
  $('zoomReset').onclick = () => { const r = $('map').getBoundingClientRect(), [rows, cols] = dims(); S.view.fitted = false; animateViewTo((r.width - cols) / 2, (r.height - rows) / 2, 1); };
  $('clearView').onclick = () => fitView(true);

  $('gamePreset').onchange = applyPreset;
  $('humanSlot').onchange = () => {
    const v = $('humanSlot').value; if (v === '') return;
    const idx = Number(v);
    $('humanSlot').value = '';
    makePlayerOne(idx);
  };
  $('slotTable').onclick = () => showSlotTable();
  $('spawnAuto').onclick = async () => {
    if (!guard()) return;
    if (!S.snapshot) { toast('请先生成地图', 'warn'); return; }
    const n = intOf('players', 0, MAX_SPAWN_POINTS, 10);
    if (n < 1) { toast('「出生点数量」为 0，请先在参数中设置出生点数量', 'warn'); return; }
    try {
      const got = await smartPlaceAll(n, { quiet: true, allowPartial: true });
      toast(`已智能布置 ${got.length} 个出生点 · 公平度 ${spawnFairness().score}`, 'success', 4000, { action: { label: '撤销', fn: () => undoSpawn() } });
    } catch (e) { toast('智能重新布置失败：' + e.message, 'error', 4200); }
  };
  $('spawnReorder').onclick = () => {
    const p = currentSpawns(); if (p.length < 2) { toast('出生点不足'); return; }
    const mode = $('slotOrder').value === 'engine' ? 'alternate' : $('slotOrder').value;
    const next = orderBySlot(p, mode);
    if (next.every((q, i) => keyOf(q) === keyOf(p[i]))) { toast('槽位顺序已符合当前规则，无需重排'); return; }
    pushSpawnHistory(); setSpawns(next); S.selectedSpawn = -1; afterSpawnChange();
    toast(mode === 'grouped' ? '已按「A 队在前」重排玩家槽位' : '已按「A/B 交替 + 镜像对位」重排玩家槽位', 'success', 3600, { action: { label: '撤销', fn: () => undoSpawn() } });
  };
  $('smartToggle').onclick = () => {
    S.smartPlacement = !S.smartPlacement;
    $('smartToggle').textContent = `自动优化：${S.smartPlacement ? '开' : '关'}`;
    $('smartToggle').classList.toggle('active', S.smartPlacement);
    toast(S.smartPlacement ? '已开启：生成后自动优化出生点分布' : '已关闭：保留引擎原始出生点布局');
    queuePrefs();
  };
  $('spawnAnalyze').onclick = () => { renderFairness(); $('fairnessReport').classList.remove('flash-box'); void $('fairnessReport').offsetWidth; $('fairnessReport').classList.add('flash-box'); };
  $('spawnUndo').onclick = () => undoSpawn();
  $('spawnRedo').onclick = () => redoSpawn();
  const layerBtn = (name, id) => $(id).onclick = () => { S.layers[name] = !S.layers[name]; $(id).classList.toggle('active', S.layers[name]); scheduleRender(); };
  layerBtn('terrain', 'layerTerrain'); layerBtn('spawns', 'layerSpawns'); layerBtn('resources', 'layerResources'); layerBtn('walls', 'layerWalls'); layerBtn('grid', 'layerGrid');
  $('projectNew').onclick = () => newProject();
  $('projectSave').onclick = () => saveProject(false);
  $('projectLoad').onclick = () => loadProject();
  $('projectExport').onclick = () => exportProject();
  $('tmxImport').onclick = () => $('tmxFile').click();
  $('tmxFile').onchange = e => importFile(e.target.files?.[0]);
  $('undoGlobal').onclick = () => globalUndo();
  $('redoGlobal').onclick = () => globalRedo();
  $('autoSaveToggle').onclick = () => {
    S.autoSave = !S.autoSave;
    $('autoSaveToggle').textContent = `自动保存：${S.autoSave ? '开' : '关'}`;
    $('autoSaveToggle').classList.toggle('active', S.autoSave);
    if (S.autoSave) saveProject(true);
    queuePrefs();
  };
  $('animToggle').onclick = () => { S.animate = !S.animate; $('animToggle').classList.toggle('on', S.animate); $('animToggle').setAttribute('aria-checked', String(S.animate)); queuePrefs(); };
  $('themeToggle').onclick = () => applyTheme(S.themeIndex + 1, true);
  $('helpBtn').onclick = showHelp;
  $('busyCancel').onclick = () => { if (S.locked) Engine.restart('cancel'); };
  $('busySkip').onclick = () => stopAnimation();
  $('modal').addEventListener('click', e => { if (e.target === $('modal')) closeModal('cancel'); });

  // 同步开关类按钮的初始文案
  $('smartToggle').textContent = `自动优化：${S.smartPlacement ? '开' : '关'}`; $('smartToggle').classList.toggle('active', S.smartPlacement);
  $('autoSaveToggle').textContent = `自动保存：${S.autoSave ? '开' : '关'}`; $('autoSaveToggle').classList.toggle('active', S.autoSave);
  $('animToggle').classList.toggle('on', S.animate); $('animToggle').setAttribute('aria-checked', String(S.animate));

  let resizeRaf = 0;
  const onResize = () => { cancelAnimationFrame(resizeRaf); resizeRaf = requestAnimationFrame(() => { if (!isNarrow()) closeDrawer(); if (S.view.fitted) fitView(); else scheduleRender(); }); };
  window.addEventListener('resize', onResize);
  if (window.ResizeObserver) new ResizeObserver(onResize).observe($('mapPanel'));
}

/* ------------------------------------------------------------------ 键盘快捷键 */
function bindKeyboard() {
  document.addEventListener('keydown', e => {
    const typing = e.target.closest?.('input,select,textarea');
    const mod = e.ctrlKey || e.metaKey;
    if (e.key === 'Escape') {
      if (closeModal('cancel')) return;
      if (S.drawingPolygon) { S.drawingPolygon = null; updatePolygonInfo(); scheduleRender(); return; }
      if (S.selectedSpawn >= 0) { selectSpawn(-1); return; }
      closeDrawer(); return;
    }
    if (modalOpen()) { if (e.key === 'Enter' && !e.target.closest?.('.modal-actions button')) { e.preventDefault(); $('modal').querySelector('.primary-soft,.danger')?.click(); } return; }
    if (mod && e.key === 'Enter') { e.preventDefault(); generate(); return; }
    if (typing) return;
    if (mod && (e.key === 'z' || e.key === 'Z')) { e.preventDefault(); e.shiftKey ? globalRedo() : globalUndo(); return; }
    if (mod && (e.key === 'y' || e.key === 'Y')) { e.preventDefault(); globalRedo(); return; }
    if (mod && (e.key === 's' || e.key === 'S')) { e.preventDefault(); saveProject(false); return; }
    if (mod && (e.key === 'e' || e.key === 'E')) { e.preventDefault(); if (S.lastTmx) exportPair(); return; }
    if (mod || e.altKey) return;
    if (e.key === ' ' && !spaceHeld) { spaceHeld = true; $('map').classList.add('space-pan'); e.preventDefault(); return; }
    const k = e.key.toLowerCase();
    if (k === 'f') fitView(true);
    else if (k === '0') $('zoomReset').click();
    else if (k === '+' || k === '=') zoomAt(1.3);
    else if (k === '-' || k === '_') zoomAt(1 / 1.3);
    else if ((k === 'delete' || k === 'backspace') && S.selectedSpawn >= 0) removeSpawnIndex(S.selectedSpawn);
    else if (k === '[' || k === ']') { const v = clamp(S.brushSize + (k === ']' ? 2 : -2), 1, 9); $('brushSize').value = v; $('brushSize').dispatchEvent(new Event('input')); setStatus(`画笔大小：${v}`); }
    else if (k === '?' || k === 'h') showHelp();
    else if (k === 'm') showSlotTable();
    else if (k === 'i') showMapPngPreview();
    else if (S.mode === 'wizard' && { v: 1, b: 1, p: 1, c: 1, r: 1 }[k]) setTool({ v: 'pan', b: 'brush', p: 'polygon', c: 'cc', r: 'resource' }[k]);
  });
  document.addEventListener('keyup', e => { if (e.key === ' ') { spaceHeld = false; $('map').classList.remove('space-pan'); } });
  // 3.2.0 修复：按住空格时切换窗口（Alt+Tab），keyup 不会触发，空格平移状态会一直卡住
  window.addEventListener('blur', () => { spaceHeld = false; $('map').classList.remove('space-pan'); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) scheduleRender(); });
}

/* ------------------------------------------------------------------ 启动 */
async function migrateLegacyProject() {
  try {
    const raw = localStorage.getItem(LEGACY_PROJECT_KEY);
    if (!raw) return;
    const existing = await ProjectStore.get('current');
    if (!existing) { await ProjectStore.put('current', JSON.parse(raw)); }
    localStorage.removeItem(LEGACY_PROJECT_KEY);
  } catch { /* 保留旧数据 */ }
}
async function boot() {
  // 3.2.0：首次启动（未手动选择过主题）时跟随系统深浅色
  let themeIdx = 0;
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved == null) themeIdx = window.matchMedia?.('(prefers-color-scheme: light)').matches ? 2 : 0;
    else themeIdx = Number(saved) || 0;
  } catch { /* ignore */ }
  applyTheme(themeIdx);
  loadPrefs();
  bindAccordion();
  bindControls();
  bindCanvas();
  bindKeyboard();
  syncPresetFromPlayers();
  updateMirrorHint();
  updateSteps(-1);
  updateSpawnUI();
  setTool('pan', false);
  updateUndoButtons();
  scheduleRender();
  const splashOff = () => { const sp = $('splash'); if (!sp || sp.classList.contains('hide')) return; sp.classList.add('hide'); setTimeout(() => sp.remove(), 600); };
  setTimeout(splashOff, 2600);
  try {
    await Engine.start();
    setRuntime('本地运行 · 无网络依赖', 'ok');
    setStatus('本地地图生成引擎已就绪');
  } catch (e) {
    setStatus('本地引擎初始化失败：' + e.message);
    setRuntime('本地引擎初始化失败', 'err');
    toast('本地引擎初始化失败：' + e.message, 'error', 5000);
  }
  splashOff();
  migrateLegacyProject().then(async () => {
    const p = await ProjectStore.get('current').catch(() => null);
    if (p?.tmx && !S.snapshot) {
      $('projectInfo').innerHTML = `发现上次的项目草稿（${new Date(p.savedAt || Date.now()).toLocaleString()}）· <a href="#" id="quickRestore">立即恢复</a>`;
      $('quickRestore')?.addEventListener('click', ev => { ev.preventDefault(); loadProject(); });
      // 3.2.0：旧版只在「项目」卡片里放一个链接，卡片折叠或手机抽屉关闭时用户根本看不到
      const crashed = /[?&]recovered\b/.test(location.search);
      toast(crashed ? '页面因内存不足被系统回收，已自动重启。可恢复上次的项目草稿' : '发现上次的项目草稿', crashed ? 'warn' : 'info', 9000, { action: { label: '立即恢复', fn: () => loadProject() } });
    }
  });
}
if (/[?&]debug\b/.test(location.search)) window.__tmx = { S, Engine, currentSpawns, dims, getMatrix, patchTmxUnits, parseTmx, uiChoice, uiConfirm, globalUndo, globalRedo, removeSpawnIndex, spawnFairness, buildCcMap, ccMapFor, verifySpawnMapping, orderBySlot, makePlayerOne, showSlotTable, buildMapPngInfo, drawExportPng, showMapPngPreview, normalizeSlots };
boot();
