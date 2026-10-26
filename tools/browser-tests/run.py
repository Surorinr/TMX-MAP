#!/usr/bin/env python3
"""
TMX MapForge Offline · 真实浏览器回归测试（3.14.0 新增，3.15.0 扩充第 9 节，3.16.0 扩充第 10 节：动态主题，
3.17.0 扩充第 11 节：第十五轮审查修复 + 配方码 / 实时体检徽章 / 触屏放大镜 / 专注模式 / 视图截图）

用 Playwright + Chromium 加载 assets 目录里的真实前端，点击真实按钮、跑真实的 WASM 引擎，
断言 3.14.0 修复的缺陷与新增功能。与 tools/smoke-test.mjs（只检查静态资源）互补。

依赖：pip install playwright && playwright install chromium
用法：python3 tools/browser-tests/run.py          （自动在随机端口起一个静态服务器，不需要手动启动）
      ONLY=11 python3 tools/browser-tests/run.py （3.17.0：只跑第 11 节，调试新用例时省时间）
退出码：全部通过为 0，否则为 1。
说明：这是桌面 Chromium 测试，不等价于 Android WebView / Tauri WebView 真机测试。
"""
import asyncio, http.server, socketserver, threading, sys, os, json, zipfile, tempfile
from functools import partial
from playwright.async_api import async_playwright

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', 'app', 'src', 'main', 'assets'))
FAILED = []

def check(name, ok, extra=''):
    print(('ok   : ' if ok else 'FAIL : ') + name + (f'  [{extra}]' if extra and not ok else ''))
    if not ok: FAILED.append(name)

class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map, '.wasm': 'application/wasm', '.js': 'text/javascript'}

def serve():
    srv = socketserver.TCPServer(('127.0.0.1', 0), partial(Quiet, directory=ROOT))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv

MOCK_ANDROID = """
window.__shareCalls=[];window.AndroidBridge={_list:[],_n:0,sessions:{},
 resetShareList(){this._list=[];window.__shareCalls.push('reset')},canShare(){return this._list.length>0},
 shareSaved(){window.__shareCalls.push('share:'+this._list.length);return this._list.length>0},
 beginSave(n){const id='s'+(++this._n);this.sessions[id]=n;return id},appendChunk(){return true},
 finishSave(id){const n=this.sessions[id];this._list.push(n);return 'ok:'+n+'|downloads'},setKeepScreenOn(){},setSystemBars(){}};
"""

async def new_page(browser, url, mock=False, w=1366, h=860, touch=False):
    ctx = await browser.new_context(viewport={'width': w, 'height': h}, accept_downloads=True, has_touch=touch, locale='zh-CN')  # 3.26.0：界面会按系统语言自动选择，测试固定简体中文
    if mock: await ctx.add_init_script(MOCK_ANDROID)
    pg = await ctx.new_page()
    pg.errors = []
    pg.on('pageerror', lambda e: pg.errors.append(str(e)))
    pg.on('console', lambda m: pg.errors.append(m.text) if m.type == 'error' else None)
    await pg.goto(url)
    await pg.wait_for_function("/本地运行/.test(document.getElementById('runtime').textContent)", timeout=30000)
    await pg.wait_for_timeout(400)
    return pg

async def settle(pg, t=120000):
    try: await pg.wait_for_function("!document.getElementById('busy').hidden", timeout=2500)
    except Exception: pass
    await pg.wait_for_function("document.getElementById('busy').hidden && !window.__tmx.S.locked", timeout=t)
    await pg.wait_for_timeout(250)

async def gen(pg, js=False, **kw):
    await pg.evaluate("""(a)=>{const set=(id,v)=>{if(v==null)return;const e=document.getElementById(id);e.value=v;e.dispatchEvent(new Event('change',{bubbles:true}))};
      set('width',a.w);set('height',a.w);set('players',a.players);set('mirror',a.mirror);set('resources',a.res)}""", kw)
    if js: await pg.evaluate("document.getElementById('generate').click()")  # 手机：按钮在关闭的抽屉里，点不到
    else: await pg.click('#generate')
    await pg.wait_for_timeout(350)
    if await pg.evaluate("!document.getElementById('modal').hidden && document.getElementById('modal').classList.contains('show')"):
        await pg.click('#modal .modal-actions button:last-child')  # 「重新生成地图？」确认框：备份并重新生成
    await settle(pg)

async def layout_stable(pg, sel='#map', t=3000):
    """等元素尺寸连续 3 帧不变（专注模式等布局过渡结束），不用固定等待时间"""
    await pg.wait_for_function("""(sel)=>{const e=document.querySelector(sel);const r=e.getBoundingClientRect();const k=r.width+'x'+r.height;
      window.__ls=window.__ls||{k:'',n:0};if(window.__ls.k===k)window.__ls.n++;else window.__ls={k,n:0};return window.__ls.n>=3}""", arg=sel, timeout=t, polling='raf')
    await pg.evaluate("window.__ls=null")

async def sec11(b, base):
    # —— 11. 3.17.0：第十五轮审查修复 + 新功能 ——
    pg = await new_page(b, base); await pg.click('#animToggle')
    await gen(pg, w=140, players=10, mirror='vertical', res=12)
    await pg.evaluate("document.querySelectorAll('#toastBox .toast').forEach(t => t.remove())")
    # 11a 连续两次删除同一序号的玩家：两条提示各自独立，最新一条的「撤销」可用
    r = await pg.evaluate("""(()=>{const T=window.__tmx;const n0=T.currentSpawns().length;T.removeSpawnIndex(0);T.removeSpawnIndex(0);
      const ts=[...document.querySelectorAll('#toastBox .toast')].filter(t=>/已删除玩家 1/.test(t.textContent));
      const n1=T.currentSpawns().length;ts[ts.length-1]?.querySelector('.toast-act')?.click();return [n0,n1,T.currentSpawns().length,ts.length]})()""")
    check('11a 连续删除同一序号玩家：两条「撤销」提示不合并，最新一步可从提示条撤销（修复）', r[3] == 2 and r[2] == r[1] + 1, str(r))
    # 11b 取消生成：队伍分配 / 撤销记录 / 近家资源标记原样保留
    await pg.evaluate("document.querySelectorAll('#toastBox .toast').forEach(t => t.remove())")
    before = await pg.evaluate("""(()=>{const T=window.__tmx,S=T.S;const k=T.currentSpawns()[0];S.teamOverrides.set(k[0]+','+k[1],'B');T.S.__snap=S.snapshot;
      return {hist:S.history.length,sh:S.spawnHistory.length,team:S.teamOverrides.size,near:S.nearResKeys.size,spawns:JSON.stringify(T.currentSpawns())}})()""")
    await pg.evaluate("(()=>{const s=(i,v)=>{const e=document.getElementById(i);e.value=v;e.dispatchEvent(new Event('change',{bubbles:true}))};s('width',700);s('height',700)})()")  # 700² < LARGE_MAP_AREA：走 quick_generate 单步路径
    await pg.click('#generate'); await pg.wait_for_timeout(300)
    if await pg.evaluate("!document.getElementById('modal').hidden && document.getElementById('modal').classList.contains('show')"):
        await pg.click('#modal .modal-actions button:last-child')
    await pg.wait_for_function("!document.getElementById('busy').hidden", timeout=10000)
    await pg.wait_for_timeout(200)
    await pg.click('#busyCancel')
    await pg.wait_for_function("document.getElementById('busy').hidden && !window.__tmx.S.locked", timeout=30000)
    after = await pg.evaluate("""(()=>{const T=window.__tmx,S=T.S;return {hist:S.history.length,sh:S.spawnHistory.length,team:S.teamOverrides.size,near:S.nearResKeys.size,
      spawns:JSON.stringify(T.currentSpawns()),same:S.snapshot===S.__snap}})()""")
    check('11b 取消生成后：队伍分配 / 撤销记录 / 近家资源标记 / 出生点原样保留（修复）', after['same'] and all(after[k] == before[k] for k in before), f'{before} → {after}')
    await pg.evaluate("(()=>{const s=(i,v)=>{const e=document.getElementById(i);e.value=v;e.dispatchEvent(new Event('change',{bubbles:true}))};s('width',140);s('height',140)})()")
    await pg.wait_for_function("/本地运行/.test(document.getElementById('runtime').textContent)", timeout=30000)
    # 11c 测距模式下右键出生点：只清除测量，不删除出生点
    await pg.evaluate("window.__tmx.fitView ? 0 : 0"); await pg.keyboard.press('f'); await pg.wait_for_timeout(700)
    sp = await pg.evaluate("window.__tmx.currentSpawns()")
    pos = await pg.evaluate(f"(()=>{{const S=window.__tmx.S,cv=document.getElementById('map').getBoundingClientRect();return [cv.left+S.view.x+({sp[0][1]}+.5)*S.view.zoom,cv.top+S.view.y+({sp[0][0]}+.5)*S.view.zoom]}})()")
    await pg.evaluate("document.querySelectorAll('#toastBox .toast').forEach(t => t.remove())")
    await pg.evaluate("window.__tmx.setMeasure(true)")
    await pg.mouse.click(*pos); await pg.wait_for_timeout(100)
    had = await pg.evaluate("!!window.__tmx.measure.a")
    await pg.mouse.click(*pos, button='right'); await pg.wait_for_timeout(250)
    r = await pg.evaluate("[window.__tmx.currentSpawns().length, !!window.__tmx.measure.a, window.__tmx.measure.on]")
    check('11c 测距模式下右键出生点：清除测量而不是删除出生点（修复）', had and r == [len(sp), False, True], f'{had} {r}')
    # 11d 恢复默认 / 新建项目后测距模式退出
    await pg.mouse.click(*pos); await pg.wait_for_timeout(80)
    await pg.evaluate("window.__tmx.resetAll({keepParams:true})"); await pg.wait_for_timeout(200)
    r = await pg.evaluate("[window.__tmx.measure.on, !!window.__tmx.measure.a, document.getElementById('measureBtn').classList.contains('active'), document.getElementById('mapPanel').classList.contains('measuring')]")
    check('11d 清空地图后测距模式自动退出（按钮 / 十字光标 / 测量点都复位）（修复）', r == [False, False, False, False], str(r))
    # 11e 历史面板：删除的二次确认点「取消」后回到列表
    await gen(pg, w=100, players=4, mirror='vertical')
    await pg.evaluate("void window.__tmx.showHistory()"); await pg.wait_for_timeout(700)  # 不等待返回的 Promise（它要等对话框关闭）
    await pg.click('.hist-row:first-child .hist-del'); await pg.wait_for_timeout(350)
    t1 = await pg.inner_text('#modalTitle')
    await pg.click('#modal .modal-actions button:first-child'); await pg.wait_for_timeout(700)
    t2 = await pg.evaluate("[document.getElementById('modalTitle').textContent, document.getElementById('modal').classList.contains('show'), document.querySelectorAll('.hist-row').length]")
    check('11e 历史面板：删除确认点「取消」后回到历史列表，而不是整个面板消失（修复）', t1 == '删除历史快照' and t2[0] == '版本历史' and t2[1] and t2[2] >= 1, f'{t1} {t2}')
    await pg.keyboard.press('Escape'); await pg.wait_for_timeout(300)
    # 11f 主题面板上下键按真实网格移动
    await pg.click('#themeToggle'); await pg.wait_for_timeout(400)
    r = await pg.evaluate("""(()=>{const m=document.getElementById('themeMenu'),g=[...m.querySelectorAll('.tm-grid')].map(x=>[...x.querySelectorAll('[data-theme-id]')]);
      const press=(el,k)=>{el.focus();el.dispatchEvent(new KeyboardEvent('keydown',{key:k,bubbles:true}));return document.activeElement.dataset.themeId};
      // 3.26.0：分组数量改为 6 / 8 / 2，按网格几何断言（与具体数量无关）：跨组保持同一列，目标列不存在时取最后一个
      const id=(gi,i)=>g[gi][i].dataset.themeId, L0=g[0].length, L1=g[1].length, last0=Math.floor((L0-1)/3)*3, last1=Math.floor((L1-1)/3)*3;
      return [press(g[0][last0+1],'ArrowDown'), id(1,1), press(g[1][2],'ArrowUp'), id(0,Math.min(last0+2,L0-1)), press(g[1][last1],'ArrowDown'), id(2,0), press(g[2][1],'ArrowUp'), id(1,Math.min(last1+1,L1-1)), press(g[1][1],'ArrowDown'), id(1,4)]})()""")
    check('11f 主题面板 ↑↓：跨组保持同一列、组内移动一行（3.26.0 起按网格几何断言）', r[0] == r[1] and r[2] == r[3] and r[4] == r[5] and r[6] == r[7] and r[8] == r[9], str(r))
    await pg.keyboard.press('Escape'); await pg.wait_for_timeout(300)
    # 11g 焦点在方向菜单里时，字母快捷键不作用到画布
    # 桌面浏览器没有屏幕方向桥接，菜单默认隐藏：这里直接显示菜单并把焦点放进去（只验证键盘守卫）
    await pg.evaluate("(()=>{document.querySelector('.orient-wrap').removeAttribute('hidden');const m=document.getElementById('orientMenu');m.hidden=false;m.classList.add('show');m.querySelector('[data-orient]').focus()})()")
    t0 = await pg.evaluate("window.__tmx.S.layers.territory")
    await pg.keyboard.press('t'); await pg.wait_for_timeout(150)
    r = await pg.evaluate("[window.__tmx.S.layers.territory, !!document.activeElement.closest('#orientMenu')]")
    check('11g 焦点在屏幕方向菜单里时按 T 不切换领地图层（修复）', r[0] == t0 and r[1], str(r))
    await pg.keyboard.press('Escape'); await pg.wait_for_timeout(300)
    await pg.evaluate("document.querySelector('.orient-wrap').setAttribute('hidden','')")
    # 11h 关闭自动保存后，已排队的保存不再写入
    r = await pg.evaluate("""(async()=>{const T=window.__tmx;document.getElementById('projectInfo').textContent='MARK';
      T.removeSpawnIndex(0);document.getElementById('autoSaveToggle').click();await new Promise(r=>setTimeout(r,2100));
      const txt=document.getElementById('projectInfo').textContent;document.getElementById('autoSaveToggle').click();return [txt,T.S.autoSave]})()""")
    check('11h 关闭自动保存后，排队中的那次保存不再写入（修复）', r[0] == 'MARK' and r[1], str(r))
    # 11i 近家资源距离输入框上限与代码一致
    r = await pg.evaluate("[document.getElementById('nearResMin').max, document.getElementById('nearResMax').max]")
    check('11i 近家资源距离输入框上限 = 代码限制 120 / 160（修复）', r == ['120', '160'], str(r))
    # 11j 配方码：往返一致、校验防篡改、夹在聊天文字里可识别
    r = await pg.evaluate("""(()=>{const T=window.__tmx;const d=T.recipeData(),c=T.encodeRecipe(d),x=T.decodeRecipe('来试试这张图 '+c+' 很好玩');
      const bad=c.slice(0,-3)+(c.slice(-3,-2)==='A'?'B':'A')+c.slice(-2);const y=T.decodeRecipe(bad),z=T.decodeRecipe('TMX1-abc');
      const xd={...x.data};delete xd.legacyShape;delete xd.legacyFrom; // 3.24.1 起解码结果带旧码标记（3.26.0：当前码只有 legacyShape=false）
      return {len:c.length,same:JSON.stringify(xd)===JSON.stringify({...d,grid:d.grid.map(r=>r.map(Number))}),noLegacy:x.data.legacyShape===false&&!('legacyFrom' in x.data),bad:!!y.error,trunc:!!z.error,code:x.code===c}})()""")
    check('11j 配方码：往返一致 / 夹在聊天文字里可识别 / 改动一个字符即校验失败 / 当前码不带旧版标记', r['same'] and r['noLegacy'] and r['bad'] and r['trunc'] and r['code'] and r['len'] <= 50, str(r))
    # 11k 配方码：形态模式下对方套用后生成的地形完全一致
    await pg.evaluate("(()=>{const T=window.__tmx;T.selectShape('island');document.getElementById('shapeSeed').value='24680'})()")
    await gen(pg, w=120, players=4, mirror='vertical')
    h1 = await pg.evaluate("(()=>{const m=window.__tmx.getMatrix('height_map');return JSON.stringify(m).length+':'+JSON.stringify(m).split('').reduce((a,c)=>(a*31+c.charCodeAt(0))|0,0)})()")
    code = await pg.evaluate("window.__tmx.encodeRecipe()")
    await pg.evaluate("(()=>{const T=window.__tmx;T.selectShape('classic');document.getElementById('shapeSeed').value='';const s=(i,v)=>{const e=document.getElementById(i);e.value=v;e.dispatchEvent(new Event('change',{bubbles:true}))};s('width',200);s('height',200);s('players',8);s('tileset',2)})()")
    await pg.evaluate("document.querySelectorAll('#toastBox .toast').forEach(t => t.remove())")
    await pg.evaluate(f"void window.__tmx.pasteRecipe({json.dumps('分享配方：' + code)})"); await pg.wait_for_timeout(400)
    pv = await pg.inner_text('#recipePreview')
    await pg.click('#modal .modal-actions button:last-child')
    await pg.wait_for_timeout(300)
    if await pg.evaluate("!document.getElementById('modal').hidden && document.getElementById('modal').classList.contains('show')"):
        await pg.click('#modal .modal-actions button:last-child')
    await settle(pg)
    h2 = await pg.evaluate("(()=>{const m=window.__tmx.getMatrix('height_map');return JSON.stringify(m).length+':'+JSON.stringify(m).split('').reduce((a,c)=>(a*31+c.charCodeAt(0))|0,0)})()")
    w2 = await pg.evaluate("[+document.getElementById('width').value, window.__tmx.shapeState.id, window.__tmx.currentSpawns().length]")
    check('11k 配方码「套用并生成」：参数还原，形态模式下地形与原图完全一致', pv.startswith('✓') and w2 == [120, 'island', 4] and h1 == h2, f'{pv} {w2} {h1} {h2}')
    # 11l 实时体检徽章：自动出现、分数与体检一致，点击打开体检
    await pg.wait_for_function("!document.getElementById('healthBadge').hidden && window.__tmx.health.score!=null", timeout=8000)
    await pg.wait_for_timeout(600)
    r = await pg.evaluate("[window.__tmx.health.score, window.__tmx.analyzeMap().score, +document.querySelector('#healthBadge .hb-num').textContent]")
    await pg.evaluate("window.__tmx.removeSpawnIndex(0)")
    await pg.wait_for_function("window.__tmx.health.sig===''||true", timeout=1000)
    await pg.wait_for_timeout(2200)
    r2 = await pg.evaluate("[window.__tmx.health.score, window.__tmx.analyzeMap().score, document.querySelector('#healthBadge .hb-delta').textContent]")
    await pg.click('#healthBadge')
    # 3.26.0：体检弹窗异步打开，负载高时 500ms 内可能还没出现 —— 等它真正显示，避免 Esc 早于弹窗导致后续用例被遮挡
    await pg.wait_for_function("!document.getElementById('modal').hidden && document.getElementById('modal').classList.contains('show')", timeout=15000)
    t = await pg.inner_text('#modalTitle')
    ok_delta = (r2[0] == r[0] and r2[2] == '') or (r2[0] != r[0] and r2[2] == ('▲' if r2[0] > r[0] else '▼') + str(abs(r2[0] - r[0])))
    check('11l 实时体检徽章：自动评分与体检一致，编辑后自动刷新并显示涨跌，点击打开体检', r[0] == r[1] == r[2] and r2[0] == r2[1] and ok_delta and t == '地图体检', f'{r} {r2} {t}')
    await pg.keyboard.press('Escape')
    await pg.wait_for_function("document.getElementById('modal').hidden", timeout=5000)
    # 11m 当前视图截图：下载 PNG
    async with pg.expect_download() as dl: await pg.click('#shotBtn')
    d = await dl.value; path = os.path.join(tempfile.gettempdir(), 'view_shot.png'); await d.save_as(path)
    sig = open(path, 'rb').read(8)
    check('11m 当前视图截图：保存为 PNG（文件名含 _view_）', sig == bytes([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]) and '_view_' in d.suggested_filename, d.suggested_filename)
    # 11n 专注模式：Z 进入 → 画布铺满窗口；Esc 退出 → 恢复侧栏
    await pg.keyboard.press('z'); await layout_stable(pg)
    r = await pg.evaluate("(()=>{const m=document.getElementById('map').getBoundingClientRect(),t=document.querySelector('.topbar').getBoundingClientRect();return [document.body.classList.contains('focus-mode'),Math.round(m.width),Math.round(m.height),innerWidth,innerHeight,Math.round(t.bottom)]})()")
    check('11n 专注模式（Z）：侧栏与顶栏收起，画布铺满窗口', r[0] and r[1] >= r[3] - 2 and r[2] >= r[4] - 2 and r[5] <= 1, str(r))
    await pg.keyboard.press('Escape'); await layout_stable(pg)
    r = await pg.evaluate("[document.body.classList.contains('focus-mode'), Math.round(document.getElementById('sidebar').getBoundingClientRect().width)]")
    check('11n Esc 退出专注模式，侧栏恢复', not r[0] and r[1] >= 300, str(r))
    # 11o 命令面板能找到新命令
    await pg.keyboard.press('Control+k'); await pg.wait_for_timeout(250)
    await pg.fill('#cmdkInput', 'pfm'); await pg.wait_for_timeout(150)
    items = await pg.evaluate("[...document.querySelectorAll('.cmdk-item .cmdk-t')].map(e=>e.textContent)")
    await pg.keyboard.press('Escape')
    check('11o 命令面板：拼音首字母 pfm 找到「复制配方码」「使用配方码」', any('复制配方码' in x for x in items) and any('使用配方码' in x for x in items), str(items[:4]))
    check('3.17.0 桌面测试无页面错误', not pg.errors, str(pg.errors[:3]))
    await pg.context.close()

    # 11p 手机：触屏放大镜 + 专注模式不再整屏空白
    pg = await new_page(b, base, w=360, h=740, touch=True)
    await pg.evaluate("document.getElementById('animToggle').click()")
    await gen(pg, js=True, w=100, players=4, mirror='vertical')
    await pg.wait_for_timeout(800)
    await pg.evaluate("document.querySelectorAll('#toastBox .toast').forEach(t => t.remove())")
    sp = await pg.evaluate("window.__tmx.currentSpawns()")
    r = await pg.evaluate(f"""(async()=>{{const S=window.__tmx.S,cv=document.getElementById('map'),R=cv.getBoundingClientRect();
      const x=R.left+S.view.x+({sp[0][1]}+.5)*S.view.zoom,y=R.top+S.view.y+({sp[0][0]}+.5)*S.view.zoom;
      const ev=(t,dx)=>cv.dispatchEvent(new PointerEvent(t,{{pointerId:7,pointerType:'touch',isPrimary:true,clientX:x+dx,clientY:y,bubbles:true,button:0,buttons:t==='pointerup'?0:1}}));
      const fr=()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
      ev('pointerdown',0);await fr();ev('pointermove',12);await fr();ev('pointermove',24);await fr();await new Promise(r=>setTimeout(r,260));
      const L=document.getElementById('loupe'),lr=L.getBoundingClientRect(),px=L.getContext('2d').getImageData(L.width/2|0,4,1,1).data;
      const out={{on:window.__tmx.loupe.on,shown:L.classList.contains('show')&&!L.hidden,above:(lr.bottom<y)||(L.classList.contains('below')&&lr.top>y),alpha:px[3]}};
      ev('pointerup',24);await new Promise(r=>setTimeout(r,300));out.off=!window.__tmx.loupe.on&&L.hidden;return out}})()""")
    check('11p 手机：拖动出生点时在手指上方显示放大镜，抬起后消失', r['on'] and r['shown'] and r['above'] and r['alpha'] == 255 and r['off'], str(r))
    await pg.evaluate("window.__tmx.setFocusMode(true)"); await layout_stable(pg)
    r = await pg.evaluate("""(()=>{const c=document.getElementById('map'),R=c.getBoundingClientRect(),S=window.__tmx.S;const [rows,cols]=window.__tmx.dims();
      const x=Math.round((S.view.x+cols/2*S.view.zoom)*c.width/R.width),y=Math.round((S.view.y+rows/2*S.view.zoom)*c.height/R.height);
      const p=c.getContext('2d').getImageData(x,y,1,1).data;return [Math.round(R.width),Math.round(R.height),innerWidth,innerHeight,p[3],getComputedStyle(document.getElementById('focusExit')).display]})()""")
    check('11p 手机专注模式：画布铺满整屏且地图正常绘制（修复首版整屏空白），显示「退出专注」胶囊', r[0] == r[2] and r[1] >= r[3] - 2 and r[4] == 255 and r[5] != 'none', str(r))
    await pg.tap('#focusExit'); await layout_stable(pg)
    check('11p 点「退出专注」胶囊恢复正常布局', not await pg.evaluate("document.body.classList.contains('focus-mode')"))
    check('3.17.0 手机测试无页面错误', not pg.errors, str(pg.errors[:3]))
    await pg.context.close()

async def sec12(b, base):
    # —— 12. 3.19.0：第十七轮审查修复 + 100 人 / 新预设 / 自由混战 + 对称检查 / 巡视 / 玩家对比 ——
    pg = await new_page(b, base); await pg.click('#animToggle')
    T = "window.__tmx"
    # 12a 多步生成（大地图 4 步）中途取消：整张回滚到生成前的地图，导出的 TMX 不被「0 个出生点」覆盖
    await gen(pg, w=120, players=4, mirror='vertical', res=8)
    before = await pg.evaluate(f"[{T}.S.snapshot.meta.width, {T}.S.lastTmx.length, {T}.currentSpawns().map(p=>p.join(',')).join(';')]")
    await pg.evaluate("(()=>{const s=(id,v)=>{const e=document.getElementById(id);e.value=v;e.dispatchEvent(new Event('change',{bubbles:true}))};s('width',800);s('height',800)})()")
    await pg.evaluate("document.getElementById('generate').click()")
    await pg.wait_for_timeout(300)
    if await pg.evaluate("!document.getElementById('modal').hidden && document.getElementById('modal').classList.contains('show')"):
        await pg.click('#modal .modal-actions button:last-child')
    await pg.wait_for_function("document.getElementById('busyStage').textContent==='2/4'", timeout=90000)
    await pg.evaluate("document.getElementById('busyCancel').click()")
    await settle(pg)
    after = await pg.evaluate(f"[{T}.S.snapshot.meta.width, {T}.S.lastTmx.length, {T}.currentSpawns().map(p=>p.join(',')).join(';'), {T}.S.snapshotEpoch === {T}.S.engineEpoch, document.getElementById('export').disabled]")
    check('大地图分步生成第 2 步取消：画布与出生点回滚到生成前的地图（修复：半成品 + 旧 TMX 错配）', after[0] == before[0] and after[1] == before[1] and after[2] == before[2], f'{before} → {after}')
    check('回滚后旧地图不再被当作引擎可分步编辑（引擎状态已变）、导出仍可用', after[3] is False and after[4] is False, str(after))
    await pg.evaluate(f"{T}.syncTmxUnits()"); await pg.wait_for_timeout(400)
    rb = await pg.evaluate(f"(async()=>{{const t=await {T}.parseTmx({T}.S.lastTmx);return t.positions.length}})()")
    check('回滚后导出的 TMX 仍有原来的 4 个出生点', rb == 4, str(rb))
    sc = await pg.evaluate(f"(()=>{{const r={T}.analyzeSymmetry();return [r.mode, r.counts.land + r.counts.wall, r.spawnsOff.length]}})()")
    check('对称检查无误报：引擎生成的 Y 轴对称地图不标出任何成片差异（平滑造成的细边被开运算滤掉）', sc == ['vertical', 0, 0], str(sc))
    # 12b 配方码以「地图生成时的参数」为准：生成后改宽度，配方码不变
    rc1 = await pg.evaluate(f"{T}.encodeRecipe({T}.recipeData())")
    await pg.evaluate("(()=>{const e=document.getElementById('width');e.value=200;e.dispatchEvent(new Event('change',{bubbles:true}))})()")
    rc2 = await pg.evaluate(f"[{T}.encodeRecipe({T}.recipeData()), {T}.decodeRecipe({T}.encodeRecipe({T}.recipeData())).data.w]")
    check('生成后改界面宽度：配方码仍是这张地图的（修复：混用地图 / 界面参数）', rc1 == rc2[0] and rc2[1] == 120, f'{rc2[1]}')
    pj = await pg.evaluate(f"(()=>{{const c={T}.mapRecipeCode();return !!c && c===\"{rc1}\"}})()")
    check('项目载荷中带有当前地图的配方码', pj)
    # 12c 新预设与出生点上限
    opts = await pg.evaluate("[...document.getElementById('gamePreset').options].map(o=>o.value)")
    check('预设：去掉 25V25，新增 30V30 / 40V40 / 50V50 / 自由混战', '25v25' not in opts and all(v in opts for v in ['30v30','40v40','50v50','ffa']), str(opts))
    await pg.select_option('#gamePreset', '50v50'); await pg.wait_for_timeout(200)
    check('选 50V50 → 出生点数量 100', await pg.evaluate("document.getElementById('players').value") == '100')
    old = await pg.evaluate(f"(()=>{{const d={T}.recipeData();d.preset='25v25';d.pl=50;const c={T}.encodeRecipe(d);{T}.applyRecipe({T}.decodeRecipe(c).data);return [document.getElementById('gamePreset').value, document.getElementById('players').value]}})()")
    check('旧配方码里的 25V25 套用后落到「自由配置」、人数 50（下拉框不空白）', old == ['free', '50'], str(old))
    # 12d 100 人地图：引擎布 50 个，JS 补齐；导出时自动补 51～100 号指挥中心瓦片，读回校验通过
    await gen(pg, w=700, players=100, mirror='vertical', res=60)
    n100 = await pg.evaluate(f"{T}.currentSpawns().length")
    check('100 人地图：出生点放满 100 个（超出引擎 50 槽位的部分由 JS 补齐）', n100 == 100, str(n100))
    await pg.evaluate(f"{T}.syncTmxUnits()"); await pg.wait_for_function(f"!{T}.S.unitsDirty", timeout=60000); await pg.wait_for_timeout(600)
    v = await pg.evaluate(f"(async()=>{{const t=await {T}.parseTmx({T}.S.lastTmx);const cc={T}.ccMapFor({T}.S.lastTmx);const sp={T}.currentSpawns();return [cc.capacity, t.positions.length, t.positions.every((p,i)=>p[0]===sp[i][0]&&p[1]===sp[i][1]), {T}.S.slotVerified]}})()")
    check('导出 TMX：指挥中心槽位扩展到 100，100 个出生点按 team 0～99 写入且读回顺序一致', v == [100, 100, True, True], str(v))
    ex = await pg.evaluate(f"(()=>{{const x=new TextDecoder().decode({T}.S.lastTmx.subarray(0,400000));const m=x.match(/<tileset\\b[^>]*name=\"50pCommandCenter_ext1\"[^>]*>/);return m?m[0]:''}})()")
    check('扩展瓦片集追加在末尾（firstgid 不与已有瓦片冲突）', 'firstgid="' in ex and int(ex.split('firstgid="')[1].split('"')[0]) > 335, ex[:120])
    # 12e 自由混战（FFA）
    await pg.select_option('#gamePreset', 'ffa'); await pg.wait_for_timeout(150)
    await gen(pg, w=200, players=8, mirror='both', res=16)
    f = await pg.evaluate(f"""(()=>{{const sp={T}.currentSpawns(),[R,C]={T}.dims();const ang=p=>{{let a=Math.atan2(p[1]-(C-1)/2,-(p[0]-(R-1)/2));return a<0?a+2*Math.PI:a}};
      const a=sp.map(ang);let wraps=0;for(let i=1;i<a.length;i++)if(a[i]<a[i-1]-1e-9)wraps++;
      const am={T}.analyzeMap();return [sp.length, document.body.classList.contains('ffa'), wraps, am.ffa, am.rush.list.every((r,i)=>Number.isFinite(r.d)&&r.enemy>=0&&r.enemy!==i), Number.isFinite(am.score), !!am.ffaStats]}})()""")
    check('FFA：8 人、body.ffa、槽位绕中心顺时针（至多一次回绕）', f[0] == 8 and f[1] and f[2] <= 1, str(f))
    check('FFA 体检：每人都有最近对手（不是自己）且得分有效', f[3] and f[4] and f[5] and f[6], str(f))
    fair = await pg.evaluate("document.getElementById('fairnessReport').textContent")
    check('FFA 公平度报告按混战口径（最近对手间距）', '自由混战' in fair and '最近对手' in fair, fair[:60])
    tsel = await pg.evaluate("getComputedStyle(document.querySelector('.spawn-row .spawn-team')).display")
    check('FFA 下队伍下拉框隐藏', tsel == 'none', tsel)
    await pg.keyboard.press('d'); await pg.wait_for_timeout(700)
    rows = await pg.evaluate("[document.querySelectorAll('#modalBody .doc-players .pr').length, /最近对手/.test(document.getElementById('modalBody').textContent)]")
    check('FFA 体检弹窗：玩家对比表 8 行 + 「最近对手」结论', rows == [8, True], str(rows))
    await pg.click('#modalBody .doc-players .pr:nth-child(4)'); await pg.wait_for_timeout(700)
    card = await pg.evaluate("[!document.getElementById('spawnCard').hidden, document.getElementById('spawnCard').textContent.includes('玩家 3'), window.__tmx.S.selectedSpawn]")
    check('点击玩家对比第 3 行：飞到玩家 3 并弹出玩家卡片', card == [True, True, 2], str(card))
    # 切回两队对抗：槽位按 A/B 重排，可撤销
    await pg.keyboard.press('Escape'); await pg.keyboard.press('Escape')
    await pg.select_option('#gamePreset', '4v4'); await pg.wait_for_timeout(300)
    back = await pg.evaluate(f"[document.body.classList.contains('ffa'), {T}.analyzeMap().ffa, {T}.S.spawnHistory.length>0]")
    check('切回 4V4：退出 FFA、体检恢复两队口径、重排可撤销', back == [False, False, True], str(back))
    # 12f 对称检查：XY 对称地图移动一个出生点 → 标出无镜像点
    sy0 = await pg.evaluate(f"(()=>{{const r={T}.analyzeSymmetry();return [r.mode, r.spawnsOff.length]}})()")
    check('对称检查：XY 双轴地图识别为 both，出生点全部有镜像', sy0 == ['both', 0], str(sy0))
    # 直接改写一个出生点坐标（只把它沿列方向挪 5 格，不动它的镜像点）
    await pg.evaluate(f"(()=>{{const sp={T}.currentSpawns(),[R,C]={T}.dims();sp[0]=[sp[0][0],Math.min(C-3,sp[0][1]+5)];{T}.S.snapshot.cc_positions=sp;{T}.S.spawnAuthority=sp.map(p=>[...p]);}})()")
    sy1 = await pg.evaluate(f"(()=>{{const r={T}.analyzeSymmetry();return r.spawnsOff.length}})()")
    check('对称检查：单边移动一个出生点后被标为「无镜像点」', sy1 >= 1, str(sy1))
    await pg.keyboard.press('y'); await pg.wait_for_timeout(500)
    syl = await pg.evaluate("[document.getElementById('layerSymmetry').getAttribute('aria-checked'), document.getElementById('mapPanel').classList.contains('sym-on')]")
    check('Y 键打开对称图层（aria-checked 同步、图例出现）', syl == ['true', True], str(syl))
    # 12g 出生点巡视：. 下一个 / , 上一个 / Esc 关闭
    await pg.keyboard.press('Escape'); await pg.wait_for_timeout(100)
    await pg.evaluate(f"{T}.S.selectedSpawn=-1")
    await pg.keyboard.press('.'); await pg.wait_for_timeout(650)
    t1 = await pg.evaluate(f"[{T}.S.selectedSpawn, !document.getElementById('spawnCard').hidden]")
    await pg.keyboard.press('.'); await pg.wait_for_timeout(650)
    t2 = await pg.evaluate(f"{T}.S.selectedSpawn")
    await pg.keyboard.press(','); await pg.keyboard.press(','); await pg.wait_for_timeout(650)
    t3 = await pg.evaluate(f"[{T}.S.selectedSpawn, {T}.currentSpawns().length]")
    check('巡视：「.」玩家 1 → 玩家 2，「,」×2 回绕到最后一位', t1 == [0, True] and t2 == 1 and t3[0] == t3[1] - 1, f'{t1} {t2} {t3}')
    await pg.keyboard.press('Escape'); await pg.keyboard.press('Escape'); await pg.wait_for_timeout(350)
    check('Esc 收起玩家卡片', await pg.evaluate("document.getElementById('spawnCard').hidden"))
    # 12h 涟漪与 CC 瓦片集扩展单元测试
    await pg.dispatch_event('#layerGrid', 'pointerdown', {'clientX': 10, 'clientY': 10, 'button': 0})
    check('按下图层开关出现涟漪', await pg.evaluate("!!document.querySelector('#layerGrid .ripple-box i')"))
    u = await pg.evaluate(f"""(()=>{{const tsx='<?xml version=\"1.0\"?><map width=\"4\" height=\"4\"><tileset firstgid=\"1\" name=\"a\" tilecount=\"100\"/><tileset firstgid=\"101\" name=\"50pCommandCenter\" columns=\"5\" tilecount=\"50\">'+
      Array.from({{length:50}},(_,i)=>`<tile id=\"${{i}}\"><properties><property name=\"team\" value=\"${{i}}\" /><property name=\"unit\" value=\"commandCenter\" /></properties></tile>`).join('')+'</tileset><layer name=\"Units\"></layer></map>';
      const r={T}.extendCcTileset(tsx,100);const cc={T}.buildCcMap(r.xml);return [r.added, cc.capacity, cc.gidForTeam(99) > 150, {T}.extendCcTileset(r.xml,100).added]}})()""")
    check('extendCcTileset：补 50 个槽位 → 容量 100、新 GID 在原有之后、已足够时不重复追加', u == [50, 100, True, 0], str(u))
    check('3.19.0 测试无页面错误', not pg.errors, str(pg.errors[:3]))
    await pg.context.close()
    # 12i 无旧地图时取消形态分步生成：回到空白画布（不留半成品）
    pg = await new_page(b, base); await pg.click('#animToggle')
    await pg.evaluate(f"{T}.selectShape('island', false)")
    await pg.evaluate("(()=>{const s=(id,v)=>{const e=document.getElementById(id);e.value=v;e.dispatchEvent(new Event('change',{bubbles:true}))};s('width',400);s('height',400)})()")
    await pg.evaluate("document.getElementById('generate').click()")
    await pg.wait_for_function("['3/5','4/5'].includes(document.getElementById('busyStage').textContent)", timeout=90000)
    await pg.evaluate("document.getElementById('busyCancel').click()"); await settle(pg)
    em = await pg.evaluate(f"[{T}.S.snapshot === null, !document.getElementById('emptyState').classList.contains('hide'), document.getElementById('export').disabled]")
    check('无旧地图时取消形态生成（第 3/4 步）：回到空白画布、导出不可用', em == [True, True, True], str(em))
    check('12i 无页面错误', not pg.errors, str(pg.errors[:3]))
    await pg.context.close()

async def sec13(b, base):
    # —— 13. 3.20.0：第十八轮审查修复 + 公平度微调 / 落点热力 / 对称修复 ——
    pg = await new_page(b, base); await pg.click('#animToggle')
    T = "window.__tmx"
    # 13a 分步模式在完整地图之后重跑「海岸线」：写回出生点 / 项目载荷都不能污染上一张地图的 TMX
    await gen(pg, w=120, players=6, mirror='vertical', res=10)
    await pg.evaluate("document.querySelector('[data-act=run_coastline]').click()"); await settle(pg)
    await pg.evaluate(f"{T}.syncTmxUnits()"); await pg.wait_for_timeout(500)
    st = await pg.evaluate(f"(async()=>{{const t=await {T}.parseTmx({T}.S.lastTmx);const p={T}.projectPayload();return [{T}.mapUnfinished(), t.positions.length, p.spawnPositions===undefined, p.unfinished===true]}})()")
    check('未完成地图：写回出生点不再抹掉上一张地图 TMX 的出生点（修复）', st[0] and st[1] == 6, str(st))
    check('未完成地图：项目载荷只保存上一张地图的 TMX，不混入画布上的出生点（修复）', st[2] and st[3], str(st))
    await pg.evaluate("document.getElementById('export').click()"); await pg.wait_for_timeout(700)
    btns = await pg.evaluate("[document.getElementById('modalTitle')?.textContent||'', [...document.querySelectorAll('#modal .modal-actions button')].map(b=>b.textContent)]")
    check('导出未完成地图：对话框说明「尚未完成」并提供「补完」与「载入上一张」', '载入上一张完整地图' in btns[1] and '补完剩余步骤并导出' in btns[1], str(btns))
    await pg.click("#modal .modal-actions button:has-text('补完剩余步骤并导出')"); await settle(pg, 240000); await pg.wait_for_timeout(1500)
    fin = await pg.evaluate(f"(async()=>{{const t=await {T}.parseTmx({T}.S.lastTmx);return [{T}.S.snapshot.meta.completed_step, t.positions.length===({T}.currentSpawns().length), t.positions.length>0, {T}.mapUnfinished()]}})()")
    check('「补完剩余步骤并导出」：地图完成、TMX 与画布出生点一致', fin == [5, True, True, False], str(fin))
    await pg.evaluate("document.querySelector('[data-act=run_coastline]').click()"); await settle(pg)
    await pg.evaluate("document.getElementById('export').click()"); await pg.wait_for_timeout(700)
    await pg.click("#modal .modal-actions button:has-text('载入上一张完整地图')"); await settle(pg); await pg.wait_for_timeout(1500)
    rl = await pg.evaluate(f"[{T}.S.source, {T}.currentSpawns().length>0, {T}.mapUnfinished()]")
    check('「载入上一张完整地图」：画布换回完整地图（出生点来自 TMX 本身）', rl == ['import', True, False], str(rl))
    # 13b 60 人：列表不再误报「不会写入」
    await pg.select_option('#gamePreset', '30v30'); await gen(pg, w=500, mirror='vertical'); await pg.wait_for_timeout(1500)
    oc = await pg.evaluate(f"[{T}.currentSpawns().length, document.querySelectorAll('.spawn-row.over-cap').length, [...document.querySelectorAll('.spawn-row small')].some(x=>x.textContent.includes('不会写入'))]")
    check('60 人地图：第 51 号之后不再误显示「超出槽位，不会写入」（修复）', oc[0] == 60 and oc[1] == 0 and not oc[2], str(oc))
    # 13c FFA 新生成：玩家 1 在正上方（12 点钟方向最近）
    await pg.select_option('#gamePreset', 'ffa'); await gen(pg, w=220, players=8, mirror='both', res=16)
    up = await pg.evaluate(f"""(()=>{{const sp={T}.currentSpawns(),[R,C]={T}.dims();const ang=p=>{{let a=Math.atan2(p[1]-(C-1)/2,-(p[0]-(R-1)/2));return a<0?a+2*Math.PI:a}};
      const a=sp.map(ang);return a[0]===Math.min(...a)&&a.every((x,i)=>i===0||x>=a[i-1]-1e-9)}})()""")
    check('FFA 新生成：玩家 1 是正上方顺时针第一个，编号单调顺时针（修复）', up)
    # 13d 公平度一键微调：把布局向中心挤压后微调。局部搜索的提升幅度取决于地形，所以断言「从不变差、始终对称、
    #     3 张图里至少一张提升 ≥5 分」，而不是要求每张图都大幅提升
    squeeze = f"""(()=>{{const t={T};const sp=t.currentSpawns(),[R,C]=t.dims();const out=sp.map(q=>[Math.round(R/2+(q[0]-R/2)*0.3),Math.round(C/2+(q[1]-C/2)*0.3)]);
      t.S.snapshot.cc_positions=out;t.S.spawnAuthority=out.map(p=>[...p]);t.S.unitsDirty=true;}})()"""
    results, never_worse, sym_ok = [], True, True
    for attempt in range(3):
        if attempt: await gen(pg, w=220, players=8, mirror='both', res=16)
        await pg.evaluate(squeeze)
        f0 = await pg.evaluate(f"{T}.spawnFairness().score")
        if attempt == 0:
            await pg.evaluate("document.activeElement?.blur()")  # 焦点在下拉框里时快捷键会被（有意）忽略
            await pg.keyboard.press('o'); await pg.wait_for_timeout(1500)
        else:
            await pg.evaluate(f"{T}.tuneFairness()"); await pg.wait_for_timeout(300)
        f1 = await pg.evaluate(f"[{T}.spawnFairness().score, {T}.analyzeSymmetry().spawnsOff.length, {T}.currentSpawns().length]")
        results.append((f0, f1[0])); never_worse &= f1[0] >= f0; sym_ok &= f1[1] == 0 and f1[2] == 8
        if f1[0] >= f0 + 5: break
    check('一键微调（O）：从不让公平度变差、FFA XY 对称严格保持', never_worse and sym_ok, str(results))
    check('一键微调：挤压后的布局至少有一张图提升 ≥ 5 分', any(b2 >= a2 + 5 for a2, b2 in results), str(results))
    await pg.keyboard.press('Control+z'); await pg.wait_for_timeout(300)
    check('一键微调可撤销', await pg.evaluate(f"{T}.spawnFairness().score") == results[-1][0])
    await pg.select_option('#gamePreset', '5v5'); await gen(pg, w=200, players=10, mirror='vertical', res=20)
    nr = await pg.evaluate(f"""(()=>{{const t={T},res=t.S.snapshot.resource_positions||[],m=t.S.nearRes;const cnt=q=>res.filter(x=>{{const d=Math.hypot(q[0]-x[0],q[1]-x[1]);return d>=m.min-0.5&&d<=m.max+0.5}}).length;
      const before=t.currentSpawns().map(cnt);const r=t.optimizeSpawnLayout(t.currentSpawns(),{{seed:7}});const after=r.list.map(cnt);
      return after.every((v,i)=>v>=Math.min(m.perSpawn,before[i]))}})()""")
    check('微调保持近家资源保证（每个出生点近家范围内的资源点不减少）', nr)
    # 13e 落点热力
    await pg.evaluate("document.activeElement?.blur()")
    await pg.keyboard.press('k'); await pg.wait_for_timeout(600)
    sp = await pg.evaluate(f"(()=>{{const r={T}.analyzeSpots();const[R,C]={T}.dims();return [!!r.best, r.best&&Math.min(r.best[0],r.best[1],R-1-r.best[0],C-1-r.best[1])>2, document.getElementById('layerSpots').getAttribute('aria-checked'), document.getElementById('mapPanel').classList.contains('spots-on')]}})()")
    check('落点热力（K）：给出合法的最佳落点，图层与图例同步', sp == [True, True, 'true', True], str(sp))
    n0 = await pg.evaluate(f"{T}.currentSpawns().length")
    await pg.click("#toastBox button:has-text('在此放置')"); await pg.wait_for_timeout(600)
    n1 = await pg.evaluate(f"[{T}.currentSpawns().length, {T}.analyzeSymmetry().spawnsOff.length]")
    check('「在此放置」：按对称设置放下出生点及其镜像', n1[0] == n0 + 2 and n1[1] == 0, f'{n0} → {n1}')
    await pg.keyboard.press('k')
    # 13f 对称修复
    await pg.evaluate(f"{T}.removeSpawnIndex(3)"); await pg.wait_for_timeout(300)
    r0 = await pg.evaluate(f"{T}.analyzeSymmetry().spawnsOff.length")
    await pg.evaluate(f"{T}.repairSpawnSymmetry()"); await pg.wait_for_timeout(300)
    r1 = await pg.evaluate(f"{T}.analyzeSymmetry().spawnsOff.length")
    check('对称修复：删掉一个出生点后一键补回镜像', r0 >= 1 and r1 == 0, f'{r0} → {r1}')
    check('3.20.0 测试无页面错误', not pg.errors, str(pg.errors[:3]))
    await pg.context.close()


async def sec14(b, base):
    # —— 14. 3.26.0：第二十轮审查修复 + 新旧对比 + 形态种子画廊 + 6 套新主题 ——
    pg = await new_page(b, base)
    # 14a 出生点列表空状态文案与上限一致
    r = await pg.evaluate("getComputedStyle(document.getElementById('spawnList'),'::before').content")
    check('14a 出生点列表空状态写「最多支持 100 个」（与 MAX_SPAWN_POINTS 一致）（修复）', '100' in r and '50 个' not in r, r)
    await pg.click('#animToggle')
    await gen(pg, w=100, players=4, mirror='vertical')
    sp1 = await pg.evaluate("JSON.stringify(window.__tmx.currentSpawns())")
    # 14b 导入的 TMX 名称：重新生成后改回自动命名；用户改过的名称保持
    async with pg.expect_download() as dl: await pg.evaluate("document.getElementById('export').click()")
    d = await dl.value; path = os.path.join(tempfile.gettempdir(), 'imported_name.tmx'); await d.save_as(path)
    await settle(pg)
    await pg.set_input_files('#tmxFile', path); await pg.wait_for_timeout(800)
    for _ in range(3):
        if await pg.evaluate("!document.getElementById('modal').hidden && document.getElementById('modal').classList.contains('show')"):
            await pg.click('#modal .modal-actions button:last-child'); await pg.wait_for_timeout(400)
    await settle(pg)
    n1 = await pg.evaluate("document.getElementById('mapName').value")
    await gen(pg, w=100, players=4)
    n2 = await pg.evaluate("document.getElementById('mapName').value")
    check('14b 导入 TMX 后重新生成：名称改回自动命名，不再沿用导入文件名（修复）', n1 == 'imported_name' and n2 == '', f'{n1!r} {n2!r}')
    await pg.set_input_files('#tmxFile', path); await pg.wait_for_timeout(800)
    for _ in range(3):
        if await pg.evaluate("!document.getElementById('modal').hidden && document.getElementById('modal').classList.contains('show')"):
            await pg.click('#modal .modal-actions button:last-child'); await pg.wait_for_timeout(400)
    await settle(pg)
    await pg.fill('#mapName', '我的决战图'); await pg.dispatch_event('#mapName', 'change')
    await gen(pg, w=100, players=4)
    check('14c 用户改过的地图名称在重新生成后保持不变', await pg.evaluate("document.getElementById('mapName').value") == '我的决战图')
    await pg.fill('#mapName', ''); await pg.dispatch_event('#mapName', 'change')
    # 14d 新旧对比：生成两次后可对比；表格 7 行；换回上一张 = 找回第一张，且对比方向对调
    # 地图指纹用「出生点 + 资源点集合」：同参数两次生成的出生点坐标可能恰好相同；资源点读回 TMX 后顺序不同，按集合比较
    await gen(pg, w=100, players=4); spA = await pg.evaluate("JSON.stringify([window.__tmx.currentSpawns(), (window.__tmx.S.snapshot.resource_positions||[]).map(String).sort()])")
    await gen(pg, w=100, players=4); spB = await pg.evaluate("JSON.stringify([window.__tmx.currentSpawns(), (window.__tmx.S.snapshot.resource_positions||[]).map(String).sort()])")
    en = await pg.evaluate("!document.getElementById('cmpBtn').disabled")
    await pg.keyboard.press('x')
    await pg.wait_for_function("document.getElementById('modalTitle').textContent==='新旧对比' && document.getElementById('modal').classList.contains('show')", timeout=8000)
    rows = await pg.evaluate("document.querySelectorAll('.cmp-table tbody tr').length")
    # 拖动分界线：点在舞台 25% 处，--x 跟随
    box = await pg.query_selector('#cmpStage'); bb = await box.bounding_box()
    await pg.mouse.click(bb['x'] + bb['width'] * 0.25, bb['y'] + bb['height'] / 2); await pg.wait_for_timeout(150)
    xv = await pg.evaluate("parseFloat(document.getElementById('cmpStage').style.getPropertyValue('--x'))")
    await pg.click('#modal .modal-actions button:nth-child(2)'); await pg.wait_for_timeout(500); await settle(pg)
    spC = await pg.evaluate("JSON.stringify([window.__tmx.currentSpawns(), (window.__tmx.S.snapshot.resource_positions||[]).map(String).sort()])")
    prevAfter = await pg.evaluate("window.__tmx.cmp.prev && window.__tmx.cmp.prev.spawns")
    check('14d 新旧对比：两次生成后按 X 打开、7 项指标、拖动分界线、「换回上一张」找回前一张', en and rows == 7 and 20 <= xv <= 30 and spC == spA and spC != spB and prevAfter == 4, f'{en} {rows} {xv} A={spC == spA} B={spC != spB} prev={prevAfter}')
    # 14e 替换失败时摘要不提交（不会拿当前地图和它自己对比）
    r = await pg.evaluate("""(async()=>{const T=window.__tmx;const before=T.cmp.prev;let threw=false;
      try{await T.loadTmxBytes(new TextEncoder().encode('<not-a-map/>'),'bad.tmx')}catch{threw=true}
      return [threw, T.cmp.prev===before]})()""")
    check('14e 导入失败：对比摘要不被替换（pending 只在替换成功后提交）', r == [True, True], str(r))
    # 14f 种子画廊：经典模式下提示而不打开
    await pg.evaluate("window.__tmx.selectShape('classic')")
    await pg.keyboard.press('g'); await pg.wait_for_timeout(400)
    check('14f 经典模式下按 G：提示先选形态，不打开画廊', await pg.evaluate("document.getElementById('modal').hidden || document.getElementById('modalTitle').textContent.indexOf('种子画廊')<0"))
    # 14g 种子画廊：6 张全部算完、第一张是当前种子；选第 4 张「固定此种子」；再「用它生成」后地图种子一致
    await pg.evaluate("(()=>{const T=window.__tmx;T.selectShape('island');document.getElementById('shapeSeed').value='13579'})()")
    await pg.keyboard.press('g')
    await pg.wait_for_function("document.querySelectorAll('.gal-tile.ready').length===6", timeout=30000)
    first = await pg.evaluate("document.querySelector('.gal-tile').dataset.seed")
    tiles = await pg.query_selector_all('.gal-tile'); seed4 = await tiles[3].get_attribute('data-seed')
    await tiles[3].click(); await pg.click('#modal .modal-actions button:nth-child(2)'); await pg.wait_for_timeout(400)
    fixed = await pg.evaluate("document.getElementById('shapeSeed').value")
    await pg.keyboard.press('g')
    await pg.wait_for_function("document.querySelectorAll('.gal-tile.ready').length>=1", timeout=30000)
    old = await pg.evaluate("document.querySelector('.gal-tile').dataset.seed")
    await pg.click('#galReroll'); await pg.wait_for_function("document.querySelectorAll('.gal-tile.ready').length===6", timeout=30000)
    seeds = await pg.evaluate("[...document.querySelectorAll('.gal-tile')].map(t=>t.dataset.seed)")
    tiles = await pg.query_selector_all('.gal-tile'); seed6 = await tiles[5].get_attribute('data-seed')
    await tiles[5].click(); await pg.click('#modal .modal-actions button:last-child'); await pg.wait_for_timeout(400)
    if await pg.evaluate("!document.getElementById('modal').hidden && document.getElementById('modal').classList.contains('show')"):
        await pg.click('#modal .modal-actions button:last-child')
    await settle(pg)
    ms = await pg.evaluate("String(window.__tmx.S.mapShape && window.__tmx.S.mapShape.seed)")
    check('14g 种子画廊：首张为当前种子、固定种子、换一批保留已选并换新 5 个、「用它生成」种子一致', first == '13579' and fixed == seed4 and old == seed4 and seeds[0] == seed4 and len(set(seeds)) == 6 and ms == seed6, f'{first} {fixed}/{seed4} {seeds} {ms}/{seed6}')
    # 14h 6 套新主题：data-theme / 色调 / 动态图层正确；亮强调色主题的主按钮用深色文字；雷暴暂停时闪电层不可见
    # 按钮文字色有 0.18s 过渡：每套主题等过渡结束再读
    await pg.add_style_tag(content='*,*::before,*::after{transition:none!important}')  # 只验证层叠结果，排除颜色过渡的中间值
    r = await pg.evaluate("""(async()=>{const T=window.__tmx,out={};for(const id of ['sand','graphite','field','storm','firefly','sky']){T.applyTheme(id,false);await new Promise(r=>setTimeout(r,60));
      const b=document.body;out[id]=[b.dataset.tone,b.dataset.fx||'',getComputedStyle(b).colorScheme,getComputedStyle(document.getElementById('generate')).color]}return out})()""")
    ok = (r['sand'][:3] == ['light', '', 'light'] and r['graphite'][:3] == ['dark', '', 'dark'] and r['field'][:3] == ['dark', '', 'dark']
          and r['storm'][:2] == ['dark', 'storm'] and r['firefly'][:2] == ['dark', 'firefly'] and r['sky'][:3] == ['light', 'sky', 'light']
          and r['graphite'][3] == 'rgb(42, 23, 0)' and r['field'][3] == 'rgb(20, 32, 6)' and r['storm'][3] == 'rgb(11, 16, 48)' and r['firefly'][3] == 'rgb(19, 36, 10)' and r['sky'][3] == 'rgb(255, 255, 255)')
    check('14h 新主题：砂岩 / 石墨 / 战地（静态）与雷暴 / 萤林 / 晴空（动态）的色调、动态图层、主按钮文字色', ok, str(r))
    r = await pg.evaluate("""(()=>{const T=window.__tmx;T.applyTheme('storm',false);T.setFxEnabled(false);const o=getComputedStyle(document.querySelector('.fx-b')).opacity;T.setFxEnabled(true);return o})()""")
    check('14i 雷暴：关闭动态背景时闪电层强制不可见（不会停在亮屏那一帧）', r == '0', r)
    # 14j 主题面板点选：圆形揭示过渡结束后清理状态、主题已切换并保存
    await pg.evaluate("window.__tmx.openThemeMenu()"); await pg.wait_for_timeout(400)
    await pg.click('#themeMenu [data-theme-id="firefly"]'); await pg.wait_for_timeout(1500)
    r = await pg.evaluate("[document.body.dataset.theme, localStorage.getItem('tmx_theme'), document.documentElement.classList.contains('vt-theme')]")
    check('14j 主题面板选「萤林」：圆形揭示过渡结束、主题生效并保存', r == ['firefly', 'firefly', False], str(r))
    await pg.keyboard.press('Escape')
    check('14z 第 14 节无页面错误', not pg.errors, str(pg.errors[:3]))


async def sec15(b, base):
    # —— 15. 3.26.0：界面多语言（简 / 繁 / EN / FR / DE / 日 / 한 / RU / ES） ——
    pg = await new_page(b, base)
    TXT = "document.body.innerText"
    zh0 = await pg.evaluate(TXT)
    st = await pg.evaluate("[window.I18N.lang, document.documentElement.lang, document.getElementById('generate').innerText.trim()]")
    check('15a 中文系统默认简体中文', st == ['zh-CN', 'zh-CN', '生成地图'], str(st))
    # 15b 菜单：9 种语言、选英文后菜单关闭并保存
    await pg.click('#langToggle'); await pg.wait_for_timeout(350)
    n = await pg.evaluate("document.querySelectorAll('#langMenu [data-lang]').length")
    await pg.click('#langMenu [data-lang="en"]'); await pg.wait_for_timeout(400)
    r = await pg.evaluate("[window.I18N.lang, document.documentElement.lang, localStorage.getItem('tmx_lang'), document.getElementById('langMenu').classList.contains('show'), document.getElementById('generate').innerText.trim(), document.title, document.querySelector('#langToggle .lang-badge').textContent]")
    check('15b 语言菜单列出 9 种语言；选 English 后界面 / 标题 / 角标切换并保存，菜单关闭', n == 9 and r[0] == 'en' and r[1] == 'en' and r[2] == 'en' and not r[3] and r[4] == 'Generate map' and r[5].startswith('Rusted Warfare') and r[6] == 'EN', f'{n} {r}')
    # 15c 切换语言后功能照常：生成地图、动态状态与提示被翻译、命令面板标题被翻译
    await pg.click('#animToggle')
    await gen(pg, w=100, players=4)
    r = await pg.evaluate("[document.getElementById('status').textContent, document.getElementById('stats').textContent]")
    await pg.keyboard.press('Control+k'); await pg.wait_for_timeout(300)
    await pg.fill('#cmdkInput', 'compare'); await pg.wait_for_timeout(200)
    ck = await pg.evaluate("document.querySelector('#cmdkList .cmdk-item')?.innerText || ''")
    await pg.keyboard.press('Escape')
    check('15c 英文界面：生成正常，状态 / 统计 / 命令面板为英文', r[0].startswith('Map generated') and 'spawns' in r[1] and 'resources' in r[1] and 'Compare' in ck, f'{r} {ck!r}')
    # 15d 繁體中文：词组 + 逐字转换（导出→匯出、默认→預設、地图→地圖）
    await pg.evaluate("window.I18N.set('zh-TW')"); await pg.wait_for_timeout(300)
    tw = await pg.evaluate(TXT)
    check('15d 繁體中文：整页简体字转为繁体（地圖 / 匯出 / 預設），html lang = zh-Hant', '生成地圖' in tw and '匯出' in tw and '預設' in tw and '地图' not in tw and await pg.evaluate("document.documentElement.lang") == 'zh-Hant')
    # 15e 其余 6 种语言都能切换且主按钮已翻译；切回简体中文后文字与原文一致
    labels = {}
    for L in ['fr', 'de', 'ja', 'ko', 'ru', 'es']:
        await pg.evaluate(f"window.I18N.set('{L}')"); await pg.wait_for_timeout(150)
        labels[L] = await pg.evaluate("document.getElementById('generate').innerText.trim()")
    ok = labels == {'fr': 'Générer la carte', 'de': 'Karte generieren', 'ja': 'マップ生成', 'ko': '맵 생성', 'ru': 'Создать карту', 'es': 'Generar mapa'}
    await pg.evaluate("window.I18N.set('zh-CN')"); await pg.wait_for_timeout(300)
    gen_zh = await pg.evaluate("document.getElementById('generate').innerText.trim()")
    check('15e 法 / 德 / 日 / 韩 / 俄 / 西均可切换，切回简体中文后还原原文', ok and gen_zh == '生成地图' and (await pg.evaluate("document.title")).startswith('铁锈战争'), str(labels))
    # 15f 持久化：重新加载后保持所选语言；Esc 关闭语言菜单
    await pg.evaluate("window.I18N.set('ko')")
    await pg.reload(); await pg.wait_for_function("window.I18N && document.getElementById('runtime').textContent.length > 0", timeout=30000)
    await pg.wait_for_timeout(600)
    kl = await pg.evaluate("[window.I18N.lang, document.getElementById('generate').innerText.trim()]")
    await pg.click('#langToggle'); await pg.wait_for_timeout(300)
    await pg.keyboard.press('Escape'); await pg.wait_for_timeout(300)
    closed = not await pg.evaluate("document.getElementById('langMenu').classList.contains('show')")
    check('15f 重新加载后保持韩语；Esc 关闭语言菜单', kl == ['ko', '맵 생성'] and closed, str(kl))
    await pg.evaluate("window.I18N.set('zh-CN')")
    check('15g 第 15 节无页面错误', not pg.errors, str(pg.errors[:3]))
    # 15h 首次启动按系统语言自动选择（日语系统 → 日本語；未保存过选择）
    ctx = await b.new_context(viewport={'width': 1280, 'height': 800}, locale='ja-JP')
    jp = await ctx.new_page(); await jp.goto(base)
    await jp.wait_for_function("window.I18N && document.getElementById('generate')", timeout=30000); await jp.wait_for_timeout(500)
    r = await jp.evaluate("[window.I18N.lang, document.getElementById('generate').innerText.trim()]")
    check('15h 首次启动按系统语言自动选择（ja-JP → 日本語）', r == ['ja', 'マップ生成'], str(r))
    await ctx.close()

async def main():
    srv = serve(); base = f'http://127.0.0.1:{srv.server_address[1]}/index.html?debug'
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--no-sandbox'])
        if os.environ.get('ONLY') == '15':
            await sec15(b, base); await b.close(); srv.shutdown()
            print('SECTION 15 ' + ('PASSED' if not FAILED else f'FAILED ({len(FAILED)}): {FAILED}')); sys.exit(1 if FAILED else 0)
        if os.environ.get('ONLY') == '14':
            await sec14(b, base); await b.close(); srv.shutdown()
            print('SECTION 14 ' + ('PASSED' if not FAILED else f'FAILED ({len(FAILED)}): {FAILED}')); sys.exit(1 if FAILED else 0)
        if os.environ.get('ONLY') == '13':
            await sec13(b, base); await b.close(); srv.shutdown()
            print('\nALL BROWSER TESTS PASSED' if not FAILED else f'\nBROWSER TESTS FAILED ({len(FAILED)}): {FAILED}'); sys.exit(0 if not FAILED else 1)
        if os.environ.get('ONLY') == '12':
            await sec12(b, base); await b.close(); srv.shutdown()
            print('\nALL BROWSER TESTS PASSED' if not FAILED else f'\nBROWSER TESTS FAILED ({len(FAILED)}): {FAILED}'); sys.exit(0 if not FAILED else 1)
        if os.environ.get('ONLY') == '11':
            await sec11(b, base); await b.close(); srv.shutdown()
            print('\nSECTION 11 PASSED' if not FAILED else f'\nSECTION 11 FAILED ({len(FAILED)}): {FAILED}')
            sys.exit(0 if not FAILED else 1)

        # —— 1. 启动 / 空状态 ——
        pg = await new_page(b, base)
        check('启动无页面错误', not pg.errors, str(pg.errors[:2]))
        vis = await pg.evaluate("getComputedStyle(document.getElementById('minimapWrap')).visibility")
        check('空状态下小地图隐藏（修复：白色方框）', vis == 'hidden')
        await pg.click('#animToggle')

        # —— 2. 输入约束 / 密度提示 ——
        v = await pg.evaluate("""()=>{const e=document.getElementById('width');e.value='-5';e.dispatchEvent(new Event('change',{bubbles:true}));const a=e.value;
          const f=document.getElementById('players');f.value='999';f.dispatchEvent(new Event('change',{bubbles:true}));return [a,f.value]}""")
        check('change 事件即约束越界输入（修复；3.19.0 上限改为 100）', v == ['40', '100'], str(v))
        await pg.evaluate("""()=>{const s=(i,v)=>{const e=document.getElementById(i);e.value=v;e.dispatchEvent(new Event('change',{bubbles:true}))};s('width',60);s('height',60);s('players',10)}""")
        lv = await pg.evaluate("document.getElementById('densityHint').dataset.level")
        check('小图多人 → 密度提示为「过于拥挤」', lv == 'bad', lv)
        await pg.evaluate("document.querySelector('.dh-apply').click()")
        wh = await pg.evaluate("[+document.getElementById('width').value, +document.getElementById('height').value]")
        check('一键套用推荐尺寸后密度回到合理区间', 200 <= wh[0] <= 260, str(wh))

        # —— 3. nearResKeys 不再跨地图累积 ——
        await gen(pg, w=140, players=6, mirror='vertical', res=12)
        for _ in range(4): await gen(pg, w=140, players=6, mirror='vertical', res=12)
        n = await pg.evaluate("window.__tmx.S.nearResKeys.size")
        check('连续生成 5 次后 nearResKeys ≤ 出生点数 × 每点个数（修复：状态泄漏）', n <= 12, str(n))
        ok = await pg.evaluate("""()=>{const have=new Set(window.__tmx.S.snapshot.resource_positions.map(p=>p[0]+','+p[1]));return [...window.__tmx.S.nearResKeys].every(k=>have.has(k))}""")
        check('nearResKeys 中的每个键都对应当前地图上真实存在的资源点', ok)
        check('生成过程无页面错误', not pg.errors, str(pg.errors[:2]))
        mv = await pg.evaluate("getComputedStyle(document.getElementById('minimapWrap')).visibility")
        check('有地图后小地图可见', mv == 'visible')

        # —— 3b. TMX 写回竞态：补丁计算期间基底被替换，必须在新基底上重做 ——
        cas = await pg.evaluate("""(async()=>{const T=window.__tmx;const orig=T.S.lastTmx;let calls=0;const other=new Uint8Array([9,9,9]);
          const r=await T.mutateTmx(async src=>{calls++;if(calls===1)T.S.lastTmx=other;return {tmx:Uint8Array.from([...src,1]),changed:true}});
          const out={calls,len:T.S.lastTmx.length,tail:[...T.S.lastTmx]};T.S.lastTmx=orig;return out})()""")
        check('mutateTmx：基底被并发替换时重做而不是覆盖（修复：写回竞态）', cas['calls'] == 2 and cas['tail'] == [9, 9, 9, 1], str(cas))

        # —— 4. 测距 ——
        sp = await pg.evaluate("window.__tmx.currentSpawns()")
        async def xy(r, c):
            return await pg.evaluate(f"(()=>{{const S=window.__tmx.S,cv=document.getElementById('map').getBoundingClientRect();return [cv.left+S.view.x+({c}+.5)*S.view.zoom,cv.top+S.view.y+({r}+.5)*S.view.zoom]}})()")
        await pg.wait_for_timeout(900)  # 等生成后的自适应缩放动画结束，坐标才稳定
        await pg.evaluate("document.querySelectorAll('#toastBox .toast').forEach(t => t.remove())")  # 刚生成完的提示条会盖在画布上拦截点击
        await pg.click('#measureBtn')
        await pg.evaluate("document.querySelectorAll('#toastBox .toast').forEach(t => t.remove())")
        await pg.mouse.click(*(await xy(sp[0][0] + 1, sp[0][1] + 1))); await pg.wait_for_timeout(150)
        await pg.mouse.click(*(await xy(sp[1][0], sp[1][1] - 1))); await pg.wait_for_timeout(400)
        st = await pg.inner_text('#status')
        check('测距：点两个出生点 → 状态栏给出玩家名 + 直线 + 步行距离', '玩家 1 → 玩家 2' in st and '直线' in st and '步行' in st, st + ' | ' + str(await pg.evaluate('JSON.stringify(window.__tmx.measure)')))
        before = await pg.evaluate("JSON.stringify(window.__tmx.currentSpawns())")
        await pg.mouse.move(*(await xy(*sp[0]))); await pg.mouse.down(); await pg.mouse.move(*(await xy(sp[0][0] + 8, sp[0][1])), steps=4); await pg.mouse.up()
        check('测距模式下拖动不会误移动出生点', before == await pg.evaluate("JSON.stringify(window.__tmx.currentSpawns())"))
        await pg.keyboard.press('Escape'); await pg.keyboard.press('Escape')
        check('Esc 两次退出测距', not await pg.evaluate("document.getElementById('measureBtn').classList.contains('active')"))

        # —— 5. 历史：收藏 + 淘汰 + 迁移 ——
        for _ in range(2): await gen(pg, w=100, players=4, mirror='vertical')
        await pg.click('#histOpen'); await pg.wait_for_timeout(800)
        await pg.click('.hist-row:nth-child(2) .hist-pin'); await pg.wait_for_timeout(300)
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(400)
        for _ in range(12): await gen(pg, w=80, players=2, mirror='vertical')
        await pg.wait_for_timeout(600)
        r = await pg.evaluate("(async()=>{const l=await window.__tmx.HistoryStore.list();return {n:l.length,pin:l.filter(e=>e.pinned).length}})()")
        check('超过上限后：收藏版本保留、未收藏版本被淘汰（≤10）', r['pin'] == 1 and r['n'] == 11, str(r))
        # 旧格式迁移
        mig = await pg.evaluate("""(async()=>{const P=window.__tmx.HistoryStore;await P.clear(false);
           const db=await new Promise(res=>{const q=indexedDB.open('tmx_mapforge',1);q.onsuccess=()=>res(q.result)});
           // 模拟从 3.13.0 升级：新格式索引键根本不存在，只有旧的单键数组
           await new Promise(r=>{const t=db.transaction('kv','readwrite');t.objectStore('kv').delete('tmx_history_idx_v2');t.oncomplete=r});
           const legacy=[{id:'old1',at:Date.now(),name:'旧版地图',w:10,h:10,players:2,thumb:'',label:'旧',payload:{params:{},tmx:new Uint8Array([1,2,3])}}];
           await new Promise(r=>{const t=db.transaction('kv','readwrite');t.objectStore('kv').put(legacy,'tmx_history_v1');t.oncomplete=r});
           const l=await P.list();const g=await P.get('old1');return {n:l.length,name:l[0]?.name,payloadOk:!!g&&g.tmx.length===3}})()""")
        check('3.11.0 旧格式历史自动迁移到新格式', mig['n'] == 1 and mig['name'] == '旧版地图' and mig['payloadOk'], str(mig))
        await pg.context.close()

        # —— 6. 择优候选导出 ——
        pg = await new_page(b, base); await pg.click('#animToggle')
        await gen(pg, w=100, players=4, mirror='vertical')
        keep = await pg.evaluate("JSON.stringify(window.__tmx.currentSpawns())")
        await pg.click('#bestOf')
        await pg.wait_for_function("document.getElementById('candExport')", timeout=120000); await pg.wait_for_timeout(800)
        async with pg.expect_download() as dl: await pg.click('#candExport')
        d = await dl.value; path = os.path.join(tempfile.gettempdir(), 'cands_test.zip'); await d.save_as(path)
        z = zipfile.ZipFile(path); names = z.namelist()
        check('候选 ZIP 完整有效（TMX + 小地图 + 说明）', z.testzip() is None and sum(n.endswith('.tmx') for n in names) == sum(n.endswith('_map.png') for n in names) >= 2 and '候选说明.txt' in names, str(names))
        check('导出候选不影响当前画布', keep == await pg.evaluate("JSON.stringify(window.__tmx.currentSpawns())"))
        await pg.context.close()

        # —— 7. Android 分享链路（模拟桥接） ——
        pg = await new_page(b, base, mock=True); await pg.click('#animToggle')
        await gen(pg, w=100, players=4, mirror='vertical')
        await pg.click('#export'); await pg.wait_for_timeout(2500)
        has = await pg.evaluate("!![...document.querySelectorAll('.toast-act')].find(b=>b.textContent==='分享')")
        check('Android：导出完成提示里出现「分享」按钮', has)
        await pg.evaluate("[...document.querySelectorAll('.toast-act')].find(b=>b.textContent==='分享').click()")
        calls = await pg.evaluate("window.__shareCalls")
        check('点击「分享」→ 先 reset 批次、再对 TMX + 小地图 2 个文件调用 shareSaved', calls[-1] == 'share:2' and 'reset' in calls, str(calls))
        await pg.context.close()

        # —— 8. 手机视口：抽屉关闭条 ——
        pg = await new_page(b, base, w=412, h=860, touch=True)
        await pg.click('#menuBtn'); await pg.wait_for_timeout(500)
        await pg.click('#drawerClose'); await pg.wait_for_timeout(500)
        check('手机抽屉可用顶部「×」关闭', not await pg.evaluate("document.getElementById('sidebar').classList.contains('open')"))
        await pg.context.close()
        # —— 9. 3.15.0：缺陷修复 + 新功能 ——
        pg = await new_page(b, base); await pg.click('#animToggle')
        await gen(pg, w=160, players=10, mirror='vertical', res=12)
        # 9a Toast「撤销」只撤销它对应的那一步
        r = await pg.evaluate("""(async()=>{const T=window.__tmx;const n0=T.currentSpawns().length;
          T.removeSpawnIndex(3);const t1=[...document.querySelectorAll('#toastBox .toast')].pop();
          T.removeSpawnIndex(0);const n2=T.currentSpawns().length;
          t1.querySelector('.toast-act').click();const n3=T.currentSpawns().length;
          const t2=[...document.querySelectorAll('#toastBox .toast')].filter(t=>/已删除玩家/.test(t.textContent)).pop();
          t2.querySelector('.toast-act').click();const n4=T.currentSpawns().length;return [n0,n2,n3,n4]})()""")
        check('Toast「撤销」不再撤错步骤：旧提示失效、最新提示仍可撤销（修复）', r == [10, 8, 8, 9], str(r))
        # 9b 处理中不允许改出生点
        r = await pg.evaluate("(()=>{const T=window.__tmx;const n=T.currentSpawns().length;T.S.locked=true;T.removeSpawnIndex(0);const m=T.currentSpawns().length;T.S.locked=false;return [n,m]})()")
        check('处理中（S.locked）删除出生点被拒绝（修复）', r[0] == r[1], str(r))
        # 9c mutateTmx 绑定快照：换图后放弃补丁
        r = await pg.evaluate("""(async()=>{const T=window.__tmx;const tmx=T.S.lastTmx,snap=T.S.snapshot;
          const out=await T.mutateTmx(async src=>{T.S.snapshot={...snap};return {tmx:new Uint8Array([7]),changed:true}});
          const same=T.S.lastTmx===tmx;T.S.snapshot=snap;return {out:out===null,same}})()""")
        check('mutateTmx：补丁期间换了地图 → 放弃，不写到新地图上（修复）', r['out'] and r['same'], str(r))
        # 9d 近家资源点撤销只还原自己
        r = await pg.evaluate("""(async()=>{const T=window.__tmx,S=T.S;const keys=[...S.nearResKeys];if(keys.length<2)return {skip:keys.length};
          const P=k=>k.split(',').map(Number);const [a,b]=[P(keys[0]),P(keys[1])];
          await T.removeNearSpawnResourceAt(a);const ta=[...document.querySelectorAll('#toastBox .toast')].pop();
          await T.removeNearSpawnResourceAt(b);
          ta.querySelector('.toast-act').click();await new Promise(r=>setTimeout(r,800));
          const has=k=>S.snapshot.resource_positions.some(q=>q[0]+','+q[1]===k);
          const t=await T.parseTmx(S.lastTmx);const inTmx=k=>t.resources.some(q=>Math.abs(q[0]-P(k)[0])<=1&&Math.abs(q[1]-P(k)[1])<=1);
          return {a:has(keys[0]),b:has(keys[1]),ka:S.nearResKeys.has(keys[0]),kb:S.nearResKeys.has(keys[1]),ta:inTmx(keys[0]),tb:inTmx(keys[1])}})()""")
        check('近家资源点撤销只还原被撤销的那一个（画布 / 键 / TMX 一致）（修复）', r.get('a') and not r.get('b') and r.get('ka') and not r.get('kb') and r.get('ta') and not r.get('tb'), str(r))
        # 9e 引擎连续崩溃后可手动重启
        await pg.evaluate("(()=>{const E=window.__tmx.Engine;E.restarts=[1,2,3,4].map(()=>Date.now());E.restart('crash')})()")
        await pg.wait_for_timeout(300)
        lv = await pg.evaluate("document.getElementById('runtimePill').dataset.level")
        await pg.click('#runtimePill')
        await pg.wait_for_function("/本地运行/.test(document.getElementById('runtime').textContent)", timeout=30000)
        await gen(pg, w=100, players=4, mirror='vertical')
        check('引擎连续崩溃后：状态胶囊变红，点击即可重启并继续生成（修复）', lv == 'err' and await pg.evaluate("window.__tmx.currentSpawns().length") == 4, lv)
        # 9f 命令面板
        await pg.keyboard.press('Control+k'); await pg.wait_for_timeout(300)
        opened = await pg.evaluate("!document.getElementById('cmdk').hidden")
        await pg.keyboard.type('dc'); await pg.wait_for_timeout(150)
        first = await pg.evaluate("document.querySelector('.cmdk-item .cmdk-t').textContent")
        await pg.fill('#cmdkInput', '测距'); await pg.keyboard.press('Enter'); await pg.wait_for_timeout(400)
        check('命令面板：Ctrl+K 打开、拼音首字母 dc → 导出、回车执行「测距」', opened and first.startswith('导出') and await pg.evaluate("window.__tmx.measure.on"), f'{opened} {first}')
        # 9g 地形剖面
        sp = await pg.evaluate("window.__tmx.currentSpawns()")
        async def xy(r, c):
            return await pg.evaluate(f"(()=>{{const S=window.__tmx.S,cv=document.getElementById('map').getBoundingClientRect();return [cv.left+S.view.x+({c}+.5)*S.view.zoom,cv.top+S.view.y+({r}+.5)*S.view.zoom]}})()")
        await pg.evaluate("document.querySelectorAll('#toastBox .toast').forEach(t => t.remove())")
        await pg.mouse.click(*(await xy(*sp[0]))); await pg.wait_for_timeout(150)
        await pg.mouse.click(*(await xy(*sp[1]))); await pg.wait_for_timeout(500)
        pf = await pg.evaluate("[document.getElementById('measureProfile').classList.contains('show'), document.querySelector('#measureProfile .mp-facts')?.textContent||'']")
        check('测距完成后显示地形剖面（海拔 / 水域 / 墙体 / 爬升）', pf[0] and '海拔' in pf[1], str(pf))
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(300)
        check('Esc 清除测量后剖面随之隐藏', not await pg.evaluate("document.getElementById('measureProfile').classList.contains('show')"))
        await pg.keyboard.press('Escape')
        # 9h 随机起名
        await pg.click('#nameDice')
        nm = await pg.input_value('#mapName')
        check('随机起名：生成「主题+地形·人数」格式的名字', '·' in nm and len(nm) >= 4, nm)
        check('3.15.0 测试过程无页面错误', not pg.errors, str(pg.errors[:3]))
        await pg.context.close()

        # —— 10. 3.16.0 动态主题 ——
        # 10a 旧版下标存储迁移：3.15.0 保存的 '1' = 青岚
        ctx = await b.new_context(viewport={'width': 1280, 'height': 760}, locale='zh-CN')
        await ctx.add_init_script("if(!sessionStorage.getItem('__seeded')){localStorage.setItem('tmx_theme','1');sessionStorage.setItem('__seeded','1')}")
        pg = await ctx.new_page(); pg.errors = []
        pg.on('pageerror', lambda e: pg.errors.append(str(e)))
        await pg.goto(base)
        await pg.wait_for_function("/本地运行/.test(document.getElementById('runtime').textContent)", timeout=30000)
        check('旧版主题下标迁移：tmx_theme=1 → 青岚', await pg.evaluate("document.body.dataset.theme") == 'teal')
        # 10b 面板：打开、选择动态主题后保持打开、存储为 id、data-fx / 画布透明
        await pg.click('#themeToggle'); await pg.wait_for_timeout(400)
        n_items = await pg.evaluate("document.querySelectorAll('#themeMenu [data-theme-id]').length")
        await pg.click('#themeMenu [data-theme-id="aurora"]'); await pg.wait_for_timeout(500)
        st = await pg.evaluate("""(()=>{const c=document.getElementById('map'),x=c.getContext('2d').getImageData(2,2,1,1).data;
          return {open:document.getElementById('themeMenu').classList.contains('show'),theme:document.body.dataset.theme,fx:document.body.dataset.fx,
          saved:localStorage.getItem('tmx_theme'),alpha:x[3],fxShown:getComputedStyle(document.querySelector('.theme-fx')).display}})()""")
        check('主题面板列出 16 个选项（14 套主题 + 跟随系统 + 昼夜流转；3.26.0 新增 6 套）', n_items == 16, str(n_items))
        check('选「极光」：面板保持打开、存储为 id、显示动态图层、画布空白处透明', st['open'] and st['theme'] == 'aurora' and st['fx'] == 'aurora' and st['saved'] == 'aurora' and st['alpha'] == 0 and st['fxShown'] == 'block', str(st))
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(300)
        check('Esc 关闭主题面板', not await pg.evaluate("document.getElementById('themeMenu').classList.contains('show')"))
        await pg.evaluate("window.__tmx.applyTheme('dark', true)"); await pg.wait_for_timeout(200)
        a2 = await pg.evaluate("(()=>{const c=document.getElementById('map');return c.getContext('2d').getImageData(2,2,1,1).data[3]})()")
        check('静态主题下画布仍铺满不透明底色（行为与旧版一致）', a2 == 255, str(a2))
        # 10c 樱雾为亮色调：复用亮色覆盖规则
        await pg.evaluate("window.__tmx.applyTheme('sakura', true)")
        check('樱雾：data-tone=light，color-scheme 为 light', await pg.evaluate("document.body.dataset.tone==='light' && getComputedStyle(document.body).colorScheme==='light'"))
        # 10d 昼夜流转时间表与跟随系统
        cyc = await pg.evaluate("[0,4,5,6,7,12,16,17,18,19,22,23].map(h=>window.__tmx.resolveTheme('cycle',new Date(2026,0,1,h)))")
        check('昼夜流转（3.26.0）：深夜星云 / 清晨樱雾 / 上午晴空 / 午后亮白 / 傍晚熔岩 / 入夜萤林 / 夜晚极光', cyc == ['nebula','nebula','sakura','sakura','sky','light','light','ember','ember','firefly','aurora','nebula'], str(cyc))
        await pg.evaluate("window.__tmx.applyTheme('system', true)")
        sysv = await pg.evaluate("[localStorage.getItem('tmx_theme'), document.body.dataset.theme]")
        check('选「跟随系统」= 删除存储项（之后随系统深浅色变化）', sysv[0] is None and sysv[1] in ('dark', 'light'), str(sysv))
        # 10e 动态背景开关持久化 + 重新加载后保持
        await pg.evaluate("window.__tmx.applyTheme('ember', true); window.__tmx.setFxEnabled(false)")
        await pg.reload(); await pg.wait_for_function("/本地运行/.test(document.getElementById('runtime').textContent)", timeout=30000)
        rl = await pg.evaluate("[document.body.dataset.theme, document.body.classList.contains('fx-off'), getComputedStyle(document.querySelector('.fx-a')).animationPlayState]")
        check('重新加载后：主题「熔岩」与「动态背景：暂停」均保持', rl == ['ember', True, 'paused'], str(rl))
        # 10f 命令面板里能直接选主题
        await pg.keyboard.press('Control+k'); await pg.wait_for_timeout(250)
        await pg.fill('#cmdkInput', '星云'); await pg.keyboard.press('Enter'); await pg.wait_for_timeout(300)
        check('命令面板：搜索「星云」回车即切换', await pg.evaluate("document.body.dataset.theme") == 'nebula')
        check('3.16.0 主题测试无页面错误', not pg.errors, str(pg.errors[:3]))
        await ctx.close()
        # 10g 手机宽度：面板完整落在屏幕内
        pg = await new_page(b, base, w=360, h=740, touch=True)
        await pg.tap('#themeToggle'); await pg.wait_for_timeout(450)
        rc = await pg.evaluate("(()=>{const r=document.getElementById('themeMenu').getBoundingClientRect();return [r.left,r.right,r.bottom,innerWidth,innerHeight]})()")
        check('手机 360px：主题面板完整显示在屏幕内', rc[0] >= 0 and rc[1] <= rc[3] and rc[2] <= rc[4], str(rc))
        await pg.context.close()
        await sec11(b, base)
        await sec12(b, base)
        await sec13(b, base)
        await sec14(b, base)
        await sec15(b, base)
        await b.close()
    srv.shutdown()
    print('\nALL BROWSER TESTS PASSED' if not FAILED else f'\nBROWSER TESTS FAILED ({len(FAILED)}): {FAILED}')
    sys.exit(0 if not FAILED else 1)

if __name__ == '__main__':
    asyncio.run(main())
