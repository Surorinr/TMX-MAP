/*
 * TMX MapForge Offline · 地形形态 Worker（3.8.0 新增）
 * 在独立线程中计算 terrain-shapes.js 的形态矩阵，避免大地图（2000×2000 约 5～15 秒）卡住界面；
 * 与 WASM 引擎 Worker 分开，「取消」时只需结束本 Worker，引擎状态不受影响。
 * 消息：{id, action:'preview'|'build', opts} → 进度 {id, progress, stage} / 结果 {id, ok, result} / 失败 {id, ok:false, error}
 */
importScripts('terrain-shapes.js');

self.onmessage = e => {
  const { id, action, opts } = e.data || {};
  try {
    const TS = self.TerrainShapes;
    if (action === 'preview') {
      const r = TS.preview(opts, opts.maxSide || 160);
      const rgba = TS.paint(r.view, r.width, r.height, new Uint8ClampedArray(r.width * r.height * 4));
      self.postMessage({ id, ok: true, result: { width: r.width, height: r.height, stride: r.stride, stats: r.stats, rgba: rgba.buffer } }, [rgba.buffer]);
      return;
    }
    if (action === 'build') {
      let last = 0;
      const onProgress = (stage, f) => {
        const now = Date.now();
        if (now - last < 120) return;
        last = now;
        self.postMessage({ id, stage, progress: stage === 'terrain' ? f * 0.8 : 0.8 + Math.min(1, f) * 0.2 });
      };
      const r = TS.build({ ...opts, onProgress });
      self.postMessage({ id, ok: true, result: { width: r.width, height: r.height, data: r.data, stats: r.stats } }, [r.data.buffer]);
      return;
    }
    throw new Error('未知操作：' + action);
  } catch (err) {
    self.postMessage({ id, ok: false, error: String((err && err.message) || err) });
  }
};
