/*
 * TMX MapForge Offline · 界面多语言（3.26.0 新增）
 * 支持：简体中文（源语言）/ 繁體中文 / English / Français / Deutsch / 日本語 / 한국어 / Русский / Español
 *
 * 设计：
 *  · 源码里的界面文字全部是简体中文（HTML + app.js 动态生成的提示、弹窗、命令面板等）。为了不在 7800 行的 app.js 里
 *    逐处改成 t('key') 调用（改动面太大、容易漏、也会让后续维护者难以阅读），这里在 DOM 层做翻译：
 *    启动时遍历文本节点与 title / placeholder / aria-label 属性，之后用 MutationObserver 翻译新插入或被改写的内容。
 *  · 每个节点记住「原文」（WeakMap），切换语言时总是从原文重新翻译；切回简体中文时还原原文。
 *    节点内容被 app.js 改写时（与我们上次写入的译文不同）视为新原文，重新翻译。我们自己的写入不会引起循环：
 *    观察到的值等于上次译文时直接跳过。
 *  · 繁體中文：先做词组级替换（默认→預設、项目→專案、导出→匯出… 台湾常用词），再逐字简→繁映射，因此任何中文文本
 *    （包括词典里没有的动态提示）都能完整显示为繁体。
 *  · 其他语言：整句词典 → 带占位的句式（「X」地图生成完成、出生点 N…）→ 按「 · 」拆段逐段翻译；仍未命中的文字保持中文原文，
 *    不会出现半句乱码。画布上绘制的文字（小地图 / 海报 / 截图里的标注）不经过 DOM，保持中文。
 *  · 应用逻辑从不读取被翻译的文本做判断（见 README「多语言」一节的核对清单），切换语言不影响任何功能。
 */
(function () {
  'use strict';
  const LANGS = [
    { id: 'zh-CN', name: '简体中文', short: '简' },
    { id: 'zh-TW', name: '繁體中文', short: '繁' },
    { id: 'en', name: 'English', short: 'EN' },
    { id: 'fr', name: 'Français', short: 'FR' },
    { id: 'de', name: 'Deutsch', short: 'DE' },
    { id: 'ja', name: '日本語', short: '日' },
    { id: 'ko', name: '한국어', short: '한' },
    { id: 'ru', name: 'Русский', short: 'RU' },
    { id: 'es', name: 'Español', short: 'ES' }
  ];
  const COL = { en: 0, fr: 1, de: 2, ja: 3, ko: 4, ru: 5, es: 6 };
  const KEY = 'tmx_lang';
  const DICT = /*__DICT__*/{};
  const S2T = /*__S2T__*/'';
  const PHR = /*__PHR__*/[];
  const s2t = new Map();
  for (let i = 0; i + 1 < S2T.length; i += 2) s2t.set(S2T[i], S2T[i + 1]);
  const CJK = /[\u4e00-\u9fff]/;

  /* 带占位的句式：$1… 是捕获组；含中文的捕获组会递归翻译。列顺序 = en fr de ja ko ru es */
  const PAT = [
    [/^「(.+?)」地图生成完成$/, ['Map “$1” generated', 'Carte « $1 » générée', 'Karte „$1“ generiert', '「$1」マップ生成完了', '‘$1’ 맵 생성 완료', 'Карта «$1» создана', 'Mapa «$1» generado']],
    [/^地图生成完成（([\d.]+)s）$/, ['Map generated ($1 s)', 'Carte générée ($1 s)', 'Karte generiert ($1 s)', 'マップ生成完了（$1 秒）', '맵 생성 완료 ($1초)', 'Карта создана ($1 с)', 'Mapa generado ($1 s)']],
    [/^「(.+?)」地图生成完成（([\d.]+)s(）?)$/, ['Map “$1” generated ($2 s$3', 'Carte « $1 » générée ($2 s$3', 'Karte „$1“ generiert ($2 s$3', '「$1」マップ生成完了（$2 秒$3', '‘$1’ 맵 생성 완료 ($2초$3', 'Карта «$1» создана ($2 с$3', 'Mapa «$1» generado ($2 s$3']],
    [/^种子 (\d+)(）?)$/, ['seed $1$2', 'graine $1$2', 'Seed $1$2', 'シード $1$2', '시드 $1$2', 'сид $1$2', 'semilla $1$2']],
    [/^坡道 (\d+)(）?)$/, ['$1 ramps$2', '$1 rampes$2', '$1 Rampen$2', 'スロープ $1$2', '경사로 $1$2', 'склонов: $1$2', '$1 rampas$2']],
    [/^通道 (\d+)(）?)$/, ['$1 passes$2', '$1 passages$2', '$1 Durchgänge$2', '通路 $1$2', '통로 $1$2', 'проходов: $1$2', '$1 pasos$2']],
    [/^出生点 (\d+)$/, ['$1 spawns', '$1 départs', '$1 Startpunkte', '出撃地点 $1', '시작 지점 $1', 'стартов: $1', '$1 inicios']],
    [/^(\d+) 个出生点$/, ['$1 spawns', '$1 départs', '$1 Startpunkte', '出撃地点 $1', '시작 지점 $1', 'стартов: $1', '$1 inicios']],
    [/^资源 (\d+)$/, ['$1 resources', '$1 ressources', '$1 Ressourcen', '資源 $1', '자원 $1', 'ресурсов: $1', '$1 recursos']],
    [/^(\d+) 个资源点$/, ['$1 resources', '$1 ressources', '$1 Ressourcen', '資源 $1', '자원 $1', 'ресурсов: $1', '$1 recursos']],
    [/^陆地 (\d+)%$/, ['land $1%', 'terre $1 %', 'Land $1 %', '陸地 $1%', '육지 $1%', 'суша $1%', 'tierra $1 %']],
    [/^陆块 (\d+)$/, ['$1 landmasses', '$1 masses', '$1 Landmassen', '陸塊 $1', '육괴 $1', 'массивов: $1', '$1 masas']],
    [/^高地 (\d+)%$/, ['highland $1%', 'hauteurs $1 %', 'Hochland $1 %', '高地 $1%', '고지 $1%', 'высоты $1%', 'tierras altas $1 %']],
    [/^预览 1:(\d+)$/, ['Preview 1:$1', 'Aperçu 1:$1', 'Vorschau 1:$1', 'プレビュー 1:$1', '미리보기 1:$1', 'Превью 1:$1', 'Vista 1:$1']],
    [/^玩家 (\d+)$/, ['Player $1', 'Joueur $1', 'Spieler $1', 'プレイヤー $1', '플레이어 $1', 'Игрок $1', 'Jugador $1']],
    [/^已固定形态种子 (\d+)$/, ['Shape seed fixed: $1', 'Graine fixée : $1', 'Form-Seed festgelegt: $1', '形状シードを $1 に固定', '형태 시드 고정: $1', 'Сид формы: $1', 'Semilla fijada: $1']],
    [/^主题：(.+)$/, ['Theme: $1', 'Thème : $1', 'Thema: $1', 'テーマ：$1', '테마: $1', 'Тема: $1', 'Tema: $1']],
    [/^套用 (\d+×\d+)$/, ['Apply $1', 'Appliquer $1', '$1 übernehmen', '$1 を適用', '$1 적용', 'Применить $1', 'Aplicar $1']],
    [/^坐标 (\d+), (\d+)$/, ['pos $1, $2', 'pos. $1, $2', 'Pos. $1, $2', '座標 $1, $2', '좌표 $1, $2', 'коорд. $1, $2', 'pos. $1, $2']],
    [/^最小间距 ([\d.]+)$/, ['min spacing $1', 'écart min. $1', 'min. Abstand $1', '最小間隔 $1', '최소 간격 $1', 'мин. расстояние $1', 'separación mín. $1']],
    [/^平均间距 ([\d.]+)$/, ['avg spacing $1', 'écart moyen $1', 'mittl. Abstand $1', '平均間隔 $1', '평균 간격 $1', 'ср. расстояние $1', 'separación media $1']],
    [/^边缘安全 (\d+)%$/, ['edge safety $1%', 'marge au bord $1 %', 'Randabstand $1 %', '端の安全度 $1%', '가장자리 안전 $1%', 'запас у края $1%', 'margen de borde $1 %']],
    [/^资源平衡 (\d+)%$/, ['resource balance $1%', 'équilibre ressources $1 %', 'Ressourcenbalance $1 %', '資源バランス $1%', '자원 균형 $1%', 'баланс ресурсов $1%', 'equilibrio de recursos $1 %']],
    [/^队伍 A (\d+) \/ B (\d+)$/, ['teams A $1 / B $2', 'équipes A $1 / B $2', 'Teams A $1 / B $2', 'チーム A $1 / B $2', '팀 A $1 / B $2', 'команды A $1 / B $2', 'equipos A $1 / B $2']],
    [/^含 TMX（(.+)）$/, ['incl. TMX ($1)', 'avec TMX ($1)', 'inkl. TMX ($1)', 'TMX 含む（$1）', 'TMX 포함 ($1)', 'с TMX ($1)', 'con TMX ($1)']],
    [/^已为每个出生点补齐近家资源点（共 \+(\d+)）$/, ['Home resources added for every spawn (+$1)', 'Ressources ajoutées à chaque départ (+$1)', 'Basisressourcen ergänzt (+$1)', '各出撃地点に資源を補充（+$1）', '각 시작 지점에 자원 보충 (+$1)', 'Ресурсы добавлены у стартов (+$1)', 'Recursos añadidos a cada inicio (+$1)']],
    [/^已切换语言 · (.+)$/, ['Language: $1', 'Langue : $1', 'Sprache: $1', '言語：$1', '언어: $1', 'Язык: $1', 'Idioma: $1']],
    // 通用「A（B）」：只有括号内外都翻译成功才改写，否则保持原文（不会出现中文配半角括号）
    [/^(.+?)（(.+)）$/, ['$1 ($2)', '$1 ($2)', '$1 ($2)', '$1（$2）', '$1 ($2)', '$1 ($2)', '$1 ($2)'], true]
  ];

  let lang = 'zh-CN';
  const ORIG = new WeakMap(), OUT = new WeakMap(), AORIG = new WeakMap();
  const ATTRS = ['title', 'placeholder', 'aria-label'];
  let observer = null, origTitle = document.title;

  function toTW(s) {
    for (const [a, b] of PHR) if (s.indexOf(a) >= 0) s = s.split(a).join(b);
    let o = '';
    for (const ch of s) o += s2t.get(ch) || ch;
    return o;
  }
  function trSeg(s, col, depth = 0) {
    if (!s || !CJK.test(s) || depth > 4) return s;
    const d = DICT[s];
    if (d) return d[col];
    for (const [re, tpl, strict] of PAT) {
      const m = s.match(re);
      if (!m) continue;
      let miss = false;
      const out = tpl[col].replace(/\$(\d)/g, (_, i) => {
        const g = m[i] || ''; if (!CJK.test(g)) return g;
        const r = trSeg(g, col, depth + 1); if (r === g) miss = true; return r;
      });
      if (strict && miss) continue;
      if (out !== s) return out;
    }
    if (s.indexOf(' · ') > 0) return s.split(' · ').map(p => trSeg(p, col, depth + 1)).join(' · ');
    if (s.startsWith('· ')) return '· ' + trSeg(s.slice(2), col, depth + 1);
    return s;
  }
  /** 翻译任意文本（保留首尾空白）；简体中文原样返回 */
  function t(src, to = lang) {
    if (to === 'zh-CN' || !src || !CJK.test(src)) return src;
    if (to === 'zh-TW') return toTW(src);
    const col = COL[to]; if (col == null) return src;
    const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(src);
    return m[1] + trSeg(m[2], col) + m[3];
  }

  const SKIP = 'script,style,textarea,[data-i18n-skip],[contenteditable="true"]';
  function doText(n) {
    const p = n.parentElement; if (!p || p.closest(SKIP)) return;
    const cur = n.data;
    let o = ORIG.get(n);
    if (o === undefined || cur !== OUT.get(n)) {
      if (!CJK.test(cur)) { ORIG.delete(n); OUT.delete(n); return; }
      o = cur; ORIG.set(n, o);
    }
    const out = t(o);
    OUT.set(n, out);
    if (out !== cur) n.data = out;
  }
  function doAttrs(el) {
    if (el.closest(SKIP)) return;
    let rec = AORIG.get(el);
    for (const a of ATTRS) {
      const cur = el.getAttribute(a);
      if (cur == null) continue;
      if (!rec) { rec = {}; AORIG.set(el, rec); }
      const r = rec[a];
      if (!r || cur !== r.out) {
        if (!CJK.test(cur)) { delete rec[a]; continue; }
        rec[a] = { orig: cur, out: cur };
      }
      const out = t(rec[a].orig);
      rec[a].out = out;
      if (out !== cur) el.setAttribute(a, out);
    }
  }
  function walk(root) {
    if (root.nodeType === 3) { doText(root); return; }
    if (root.nodeType !== 1 && root.nodeType !== 9 && root.nodeType !== 11) return;
    if (root.nodeType === 1) { if (root.closest(SKIP)) return; doAttrs(root); }
    const tw = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
      acceptNode: n => n.nodeType === 1 && n.matches(SKIP) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT
    });
    let n;
    while ((n = tw.nextNode())) n.nodeType === 3 ? doText(n) : doAttrs(n);
  }
  function startObserver() {
    if (observer) return;
    observer = new MutationObserver(list => {
      for (const m of list) {
        if (m.type === 'characterData') doText(m.target);
        else if (m.type === 'attributes') doAttrs(m.target);
        else m.addedNodes.forEach(walk);
      }
    });
    observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  }
  function stopObserver() { observer?.disconnect(); observer = null; }

  function apply(next, { persist = true, announce = false } = {}) {
    if (!LANGS.some(l => l.id === next)) next = 'zh-CN';
    lang = next;
    if (persist) try { localStorage.setItem(KEY, next); } catch { /* ignore */ }
    document.documentElement.lang = next === 'zh-CN' ? 'zh-CN' : next === 'zh-TW' ? 'zh-Hant' : next;
    document.body.dataset.lang = next;
    document.title = t(origTitle);
    walk(document.body); // 切回简体中文时 t() 返回原文 = 还原
    if (next === 'zh-CN') stopObserver(); else startObserver();
    renderMenu();
    const b = document.getElementById('langToggle');
    if (b) {
      const L = LANGS.find(l => l.id === next);
      b.querySelector('.lang-badge').textContent = L.short;
      b.setAttribute('aria-label', `${t('界面语言')}: ${L.name}`);
      b.title = `${t('界面语言')}: ${L.name}`;
    }
    // 提示用中文原文发出，由观察器按当前语言翻译（之后再切换语言时这条提示也会跟着变）
    if (announce && typeof window.__tmxToast === 'function') window.__tmxToast('已切换语言 · ' + LANGS.find(l => l.id === next).name);
    try { window.dispatchEvent(new CustomEvent('tmx:lang', { detail: next })); } catch { /* ignore */ }
  }
  function detect() {
    let saved = null;
    try { saved = localStorage.getItem(KEY); } catch { /* ignore */ }
    if (saved && LANGS.some(l => l.id === saved)) return saved;
    // 首次启动：按系统语言选择；中文系统（含未知地区）保持简体中文
    const nav = (navigator.languages && navigator.languages[0]) || navigator.language || 'zh-CN';
    const lc = nav.toLowerCase();
    if (lc.startsWith('zh')) return /tw|hk|mo|hant/.test(lc) ? 'zh-TW' : 'zh-CN';
    const base = lc.split('-')[0];
    return COL[base] != null ? base : 'zh-CN';
  }

  /* ---------- 语言菜单（顶栏地球按钮） ---------- */
  function buildUI() {
    const theme = document.querySelector('.theme-wrap');
    if (!theme || document.getElementById('langToggle')) return;
    const wrap = document.createElement('div');
    wrap.className = 'lang-wrap';
    wrap.innerHTML = `<button id="langToggle" class="icon-btn" type="button" aria-haspopup="menu" aria-expanded="false" aria-controls="langMenu">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.6 2.6 3.9 5.6 3.9 9s-1.3 6.4-3.9 9c-2.6-2.6-3.9-5.6-3.9-9S9.4 5.6 12 3z"/></svg>
      <span class="lang-badge" aria-hidden="true">简</span></button>
      <div id="langMenu" class="orient-menu lang-menu" role="menu" hidden data-i18n-skip>
        <div class="om-head">LANGUAGE · 语言</div>
        ${LANGS.map((l, i) => `<button type="button" role="menuitemradio" aria-checked="false" data-lang="${l.id}" lang="${l.id === 'zh-TW' ? 'zh-Hant' : l.id}" style="animation-delay:${(i * 0.025).toFixed(3)}s"><b>${l.short}</b><span>${l.name}</span><i aria-hidden="true"></i></button>`).join('')}
      </div>`;
    theme.parentNode.insertBefore(wrap, theme);
    const btn = wrap.querySelector('#langToggle'), menu = wrap.querySelector('#langMenu');
    btn.addEventListener('click', e => { e.stopPropagation(); isOpen() ? closeMenu() : openMenu(); });
    menu.addEventListener('click', e => {
      const it = e.target.closest('[data-lang]'); if (!it) return;
      if (it.dataset.lang !== lang) {
        document.body.classList.add('lang-swap');
        apply(it.dataset.lang, { announce: true });
        setTimeout(() => document.body.classList.remove('lang-swap'), 450);
      }
      closeMenu(); btn.focus({ preventScroll: true });
    });
    menu.addEventListener('keydown', e => {
      const items = [...menu.querySelectorAll('[data-lang]')], i = items.indexOf(document.activeElement);
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeMenu(); btn.focus(); return; }
      if (i < 0) return;
      const to = { ArrowDown: i + 1, ArrowUp: i - 1, Home: 0, End: items.length - 1 }[e.key];
      if (to == null) return;
      e.preventDefault(); items[(to + items.length) % items.length].focus();
    });
    document.addEventListener('pointerdown', e => { if (isOpen() && !wrap.contains(e.target)) closeMenu(); }, true);
  }
  const isOpen = () => !!document.getElementById('langMenu')?.classList.contains('show');
  function openMenu() {
    const m = document.getElementById('langMenu'); if (!m) return;
    clearTimeout(m._hideT); m.hidden = false; renderMenu();
    requestAnimationFrame(() => m.classList.add('show'));
    document.getElementById('langToggle').setAttribute('aria-expanded', 'true');
    (m.querySelector('.current') || m.querySelector('[data-lang]'))?.focus({ preventScroll: true });
  }
  function closeMenu() {
    const m = document.getElementById('langMenu'); if (!m || !m.classList.contains('show')) return false;
    m.classList.remove('show');
    document.getElementById('langToggle')?.setAttribute('aria-expanded', 'false');
    m._hideT = setTimeout(() => { m.hidden = true; }, 220);
    return true;
  }
  function renderMenu() {
    document.querySelectorAll('#langMenu [data-lang]').forEach(it => {
      const on = it.dataset.lang === lang;
      it.classList.toggle('current', on); it.setAttribute('aria-checked', String(on));
    });
  }

  function init() {
    buildUI();
    apply(detect(), { persist: false });
  }
  window.I18N = { get lang() { return lang; }, langs: LANGS, t, set: (id, o) => apply(id, { announce: true, ...o }), openMenu, closeMenu, isOpen, init };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
