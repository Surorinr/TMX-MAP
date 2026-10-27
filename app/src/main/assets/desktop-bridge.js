/*
 * 铁锈战争地图生成器 · PC 版桥接（随主版本同步维护，当前 3.30.0）
 *
 * Android 与 PC 共用同一份前端（index.html / style.css / app.js / worker.js / wasm-pkg）。
 * 本文件只在 PC 版（Rust + Tauri 2，存在 window.__TAURI__）中生效，Android 上立即返回、不做任何事。
 *
 * 作用：把 Android 宿主（MainActivity.kt）提供的能力映射为 PC 宿主（desktop/src/main.rs）的 Rust 命令：
 *   AndroidBridge.setSystemBars   → set_window_theme   标题栏深浅色随主题
 *   AndroidBridge.setKeepScreenOn → 空实现             PC 不需要保持亮屏
 *   AndroidBridge.beginSave/…     → DesktopBridge.saveFile → save_file（二进制 IPC，写入导出目录）
 *   onPause → __onAppPause        → 关闭窗口时 __desktopBeforeClose：先自动保存，再 confirm_close
 * PC 专属：导出目录设置（项目卡片内）、在文件夹中显示、F11 全屏、Ctrl+O 导入、拖放导入 TMX / 项目 / 图片、
 *          禁用刷新（避免生成中途丢失状态）、禁用网页默认右键菜单（发布版）。
 */
(function () {
  'use strict';
  const T = window.__TAURI__;
  if (!T || !T.core || typeof T.core.invoke !== 'function') return;
  const invoke = T.core.invoke;
  const html = document.documentElement;
  html.classList.add('is-desktop');

  let info = { debug: false, platform: 'desktop' };
  invoke('app_info').then(i => { info = i || info; html.dataset.platform = info.platform || ''; }).catch(() => {});

  const say = (msg, type = 'info', ms, opts) => {
    try { if (window.TMXApp?.toast) return window.TMXApp.toast(msg, type, ms, opts); } catch { /* ignore */ }
    console.log('[desktop]', msg);
    return null;
  };

  /* ---------------------------------------------------------------- 1. Android 桥接兼容层 */
  window.AndroidBridge = {
    setKeepScreenOn() { /* PC 不息屏，无需处理 */ },
    setSystemBars(_color, lightIcons) { invoke('set_window_theme', { light: !!lightIcons }).catch(() => {}); }
  };

  /* ---------------------------------------------------------------- 2. 文件保存 */
  window.DesktopBridge = {
    platform: () => info.platform,
    async saveFile(bytes, name, mime) {
      let data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
      // subarray 视图：复制成独立缓冲区，确保 IPC 只发送这一段
      if (data.byteOffset !== 0 || data.byteLength !== data.buffer.byteLength) data = data.slice();
      let r;
      try {
        r = await invoke('save_file', data, {
          headers: { 'x-file-name': encodeURIComponent(name), 'x-file-mime': mime || 'application/octet-stream' }
        });
      } catch (e) { throw new Error(typeof e === 'string' ? e : (e?.message || String(e))); } // Rust 返回 Err(String)
      return { ok: true, name: r.name, path: r.path, dir: r.dir, desktop: true };
    },
    reveal(path) {
      return invoke('open_path', { path: path || null }).catch(e => say('无法打开文件夹：' + e, 'error'));
    },
    /* 3.8.0：「另存为」面板读取 / 更改导出目录（同时刷新「项目 / 恢复」卡片里的目录行） */
    getDir() { return invoke('get_export_dir'); },
    async chooseDir() { const d = await invoke('choose_export_dir'); if (d) renderDir(d); return d; },
    savedToast(r, text) {
      return say(text || `已保存到导出目录：${r.name}`, 'success', 5200, { action: { label: '打开文件夹', fn: () => this.reveal(r.path) } });
    }
  };

  /* ---------------------------------------------------------------- 3. 关闭窗口前自动保存 */
  window.__desktopBeforeClose = async () => {
    try {
      const p = window.__onAppPause ? window.__onAppPause() : null;
      await Promise.race([Promise.resolve(p), new Promise(r => setTimeout(r, 2500))]);
    } catch (e) { console.warn('关闭前保存失败', e); }
    finally { invoke('confirm_close').catch(() => {}); }
  };

  /* ---------------------------------------------------------------- 4. 键盘：F11 全屏；禁用刷新 */
  document.addEventListener('keydown', e => {
    if (e.key === 'F11') { e.preventDefault(); invoke('toggle_fullscreen').then(on => say(on ? '已进入全屏（F11 退出）' : '已退出全屏')).catch(() => {}); return; }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'o' || e.key === 'O')) { e.preventDefault(); document.getElementById('tmxImport')?.click(); return; } // 3.6.0：Ctrl+O 导入
    const reload = e.key === 'F5' || ((e.ctrlKey || e.metaKey) && (e.key === 'r' || e.key === 'R'));
    if (reload && !info.debug) { e.preventDefault(); say('PC 版已禁用刷新，避免丢失正在编辑的地图（数据会自动保存）', 'warn'); }
  }, true);

  /* ---------------------------------------------------------------- 5. 右键菜单：发布版只在输入框中保留 */
  document.addEventListener('contextmenu', e => {
    if (info.debug) return;
    if (!e.target.closest?.('input,textarea,[contenteditable="true"]')) e.preventDefault();
  });

  /* ---------------------------------------------------------------- 6. 拖放导入 */
  const DROP_TMX = /\.(tmx|xml|json)$/i, DROP_IMG = /\.(png|jpe?g|webp|bmp|gif)$/i;
  let dragDepth = 0, overlay = null;
  const hasFiles = e => [...(e.dataTransfer?.types || [])].includes('Files');
  function showOverlay(on) {
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'desk-drop';
      overlay.innerHTML = '<div class="desk-drop-card"><div class="desk-drop-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7 10l5 5 5-5"/><path d="M5 21h14"/></svg></div><b>松开以导入</b><span>TMX 地图 / 项目文件（.json）/ 地形图片</span></div>';
      document.body.appendChild(overlay);
    }
    overlay.classList.toggle('show', on);
  }
  function feedInput(id, file) {
    const input = document.getElementById(id); if (!input) return false;
    const dt = new DataTransfer(); dt.items.add(file);
    input.files = dt.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }
  window.addEventListener('dragenter', e => { if (!hasFiles(e)) return; e.preventDefault(); dragDepth++; showOverlay(true); });
  window.addEventListener('dragover', e => { if (!hasFiles(e)) return; e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; });
  window.addEventListener('dragleave', e => { if (!hasFiles(e)) return; dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) showOverlay(false); });
  window.addEventListener('drop', e => {
    if (!hasFiles(e)) return;
    e.preventDefault(); dragDepth = 0; showOverlay(false);
    const file = e.dataTransfer.files?.[0]; if (!file) return;
    if (e.dataTransfer.files.length > 1) say('一次只能导入一个文件，已导入第一个', 'warn');
    if (DROP_TMX.test(file.name)) feedInput('tmxFile', file);
    else if (DROP_IMG.test(file.name) || /^image\//.test(file.type)) {
      // 图片地形属于「分步编辑 ① 海岸线」，先切换到分步模式
      if (document.getElementById('wizardSec')?.hidden) document.getElementById('wizardTab')?.click();
      feedInput('imageFile', file);
    } else say(`不支持的文件类型：${file.name}`, 'warn');
  });

  /* ---------------------------------------------------------------- 7. 导出目录设置（插入「项目 / 恢复」卡片） */
  let renderDir = () => {};
  function mountDirRow() {
    const anchor = document.getElementById('projectInfo'); if (!anchor || document.getElementById('deskDir')) return;
    const row = document.createElement('div');
    row.className = 'desk-dir'; row.id = 'deskDir';
    row.innerHTML = '<div class="desk-dir-head"><span>导出目录</span><small id="deskDirTag"></small></div>' +
      '<code id="deskDirPath" title="">…</code>' +
      '<div class="toolrow desk-dir-actions"><button id="deskDirChange" type="button">更改目录</button><button id="deskDirOpen" type="button">打开</button><button id="deskDirReset" type="button">恢复默认</button></div>';
    anchor.parentNode.insertBefore(row, anchor);
    const render = d => {
      if (!d) return;
      const el = document.getElementById('deskDirPath');
      el.textContent = d.path; el.title = d.path;
      document.getElementById('deskDirTag').textContent = d.is_default ? '默认：系统下载目录' : '自定义';
      document.getElementById('deskDirReset').disabled = !!d.is_default;
      row.classList.remove('flash'); void row.offsetWidth; row.classList.add('flash');
    };
    renderDir = render;
    invoke('get_export_dir').then(render).catch(() => {});
    document.getElementById('deskDirChange').onclick = () => invoke('choose_export_dir').then(d => { if (d) { render(d); say('导出目录已更改', 'success'); } }).catch(e => say('选择目录失败：' + e, 'error'));
    document.getElementById('deskDirOpen').onclick = () => window.DesktopBridge.reveal(null);
    document.getElementById('deskDirReset').onclick = () => invoke('reset_export_dir').then(d => { render(d); say('已恢复默认导出目录（系统下载目录）'); }).catch(() => {});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountDirRow); else mountDirRow();
})();
