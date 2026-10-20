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
    ctx = await browser.new_context(viewport={'width': w, 'height': h}, accept_downloads=True, has_touch=touch)
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
      return [press(g[1][3],'ArrowDown'), press(g[2][1],'ArrowUp'), press(g[0][2],'ArrowDown'), press(g[1][0],'ArrowUp'), g[2][0].dataset.themeId, g[1][4].dataset.themeId, g[1][2].dataset.themeId, g[0][0].dataset.themeId]})()""")
    check('11f 主题面板 ↑↓：跨组保持同一列（3 / 5 / 2 个一组时不再落错列）（修复）', r[0] == r[4] and r[1] == r[5] and r[2] == r[6] and r[3] == r[7], str(r))
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
      return {len:c.length,same:JSON.stringify(x.data)===JSON.stringify({...d,grid:d.grid.map(r=>r.map(Number))}),bad:!!y.error,trunc:!!z.error,code:x.code===c}})()""")
    check('11j 配方码：往返一致 / 夹在聊天文字里可识别 / 改动一个字符即校验失败', r['same'] and r['bad'] and r['trunc'] and r['code'] and r['len'] <= 50, str(r))
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
    await pg.click('#healthBadge'); await pg.wait_for_timeout(500)
    t = await pg.inner_text('#modalTitle')
    ok_delta = (r2[0] == r[0] and r2[2] == '') or (r2[0] != r[0] and r2[2] == ('▲' if r2[0] > r[0] else '▼') + str(abs(r2[0] - r[0])))
    check('11l 实时体检徽章：自动评分与体检一致，编辑后自动刷新并显示涨跌，点击打开体检', r[0] == r[1] == r[2] and r2[0] == r2[1] and ok_delta and t == '地图体检', f'{r} {r2} {t}')
    await pg.keyboard.press('Escape'); await pg.wait_for_timeout(300)
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

async def main():
    srv = serve(); base = f'http://127.0.0.1:{srv.server_address[1]}/index.html?debug'
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--no-sandbox'])
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
        check('change 事件即约束越界输入（修复）', v == ['40', '50'], str(v))
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
        ctx = await b.new_context(viewport={'width': 1280, 'height': 760})
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
        check('主题面板列出 10 个选项（8 套主题 + 跟随系统 + 昼夜流转）', n_items == 10, str(n_items))
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
        check('昼夜流转：深夜星云 / 清晨樱雾 / 白天亮白 / 傍晚熔岩 / 入夜极光', cyc == ['nebula','nebula','sakura','sakura','light','light','light','ember','ember','aurora','aurora','nebula'], str(cyc))
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
        await b.close()
    srv.shutdown()
    print('\nALL BROWSER TESTS PASSED' if not FAILED else f'\nBROWSER TESTS FAILED ({len(FAILED)}): {FAILED}')
    sys.exit(0 if not FAILED else 1)

if __name__ == '__main__':
    asyncio.run(main())
