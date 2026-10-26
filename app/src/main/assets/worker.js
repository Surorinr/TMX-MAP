/*
 * TMX MapForge Offline · 本地生成引擎 Worker（3.25.0，逻辑与 3.1.0 一致；Android 与 PC 版共用；
 *   3.9.0 的新功能「近家资源点」完全在 app.js 主线程里完成，不改动这个 Worker 或它调用的 WASM 引擎接口）
 *
 * 修复要点：
 * 1. WASM 引擎一旦 panic（RuntimeError: unreachable），Rust 侧 RefCell 借用标志不会被释放，
 *    之后所有调用都会继续报 unreachable —— 引擎实例永久“中毒”。这里会识别这类致命错误，
 *    标记 poisoned 并回传 fatal:true，由主线程销毁并重建 Worker（自动恢复）。
 * 2. 引擎返回的矩阵是普通 JS Array，postMessage 结构化克隆 2000×2000 地图时极慢且占内存。
 *    这里统一转换为 Int32Array / Uint8Array 并以 Transferable 零拷贝回传。
 * 3. 初始化失败后允许重试（旧实现 initPromise 失败后永久保持 rejected）。
 * 4. 参数中的 TypedArray 在 JSON 序列化前转回普通数组（否则会被序列化成 {"0":..} 对象）。
 */
let rpc = null;
let initPromise = null;
let poisoned = false;

async function init() {
  if (rpc) return;
  if (!initPromise) {
    initPromise = (async () => {
      const m = await import('./wasm-pkg/rust_map_gen.js');
      // 新版 wasm-bindgen 推荐以对象形式传参，避免控制台弃用警告
      await m.default({ module_or_path: new URL('./wasm-pkg/rust_map_gen_bg.wasm', import.meta.url) });
      rpc = m.rpc_call;
    })().catch(err => {
      initPromise = null; // 允许下次重试
      throw err;
    });
  }
  await initPromise;
}

function isFatal(err) {
  if (typeof WebAssembly !== 'undefined' && err instanceof WebAssembly.RuntimeError) return true;
  const msg = String((err && err.message) || err || '');
  return /unreachable|RuntimeError|already (mutably )?borrowed|memory access out of bounds|recursive use of an object/i.test(msg);
}

function jsonReplacer(_key, value) {
  if (ArrayBuffer.isView(value) && !(value instanceof DataView)) return Array.from(value);
  return value;
}

function toInt32(m, transfer) {
  if (!m || !m.data) return;
  if (!(m.data instanceof Int32Array)) m.data = Int32Array.from(m.data);
  transfer.push(m.data.buffer);
}

function pack(result) {
  const transfer = [];
  if (!result || typeof result !== 'object') return { result, transfer };
  const mats = result.snapshot && result.snapshot.matrices;
  if (mats) for (const key of Object.keys(mats)) toInt32(mats[key], transfer);
  if (Array.isArray(result.frames)) result.frames.forEach(f => toInt32(f, transfer));
  if (Array.isArray(result.quick_frames)) {
    result.quick_frames.forEach(f => {
      toInt32(f.height_map, transfer);
      toInt32(f.id_matrix, transfer);
      toInt32(f.items_matrix, transfer);
      toInt32(f.units_matrix, transfer);
    });
  }
  if (result.tmx_bytes && !(result.tmx_bytes instanceof Uint8Array)) {
    result.tmx_bytes = Uint8Array.from(result.tmx_bytes);
  }
  if (result.tmx_bytes) transfer.push(result.tmx_bytes.buffer);
  // 去重，避免同一个 buffer 被重复 transfer 导致 DataCloneError
  return { result, transfer: [...new Set(transfer)] };
}

self.onmessage = async e => {
  const { id, action, params } = e.data || {};
  if (poisoned) {
    self.postMessage({ id, ok: false, fatal: true, error: '本地引擎已崩溃，正在重启' });
    return;
  }
  try {
    await init();
    if (action === 'init') {
      self.postMessage({ id, ok: true, result: { ready: true } });
      return;
    }
    const t0 = performance.now();
    const raw = rpc(action, JSON.stringify(params || {}, jsonReplacer));
    const { result, transfer } = pack(raw);
    if (result && typeof result === 'object') result.elapsed_ms = Math.round(performance.now() - t0);
    self.postMessage({ id, ok: true, result }, transfer);
  } catch (err) {
    const fatal = isFatal(err);
    if (fatal) poisoned = true;
    self.postMessage({ id, ok: false, fatal, error: String((err && err.message) || err) });
  }
};
