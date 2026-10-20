"""
3.10.0 屏幕方向持久化 · 浏览器端自动化测试

用 Playwright（Chromium）加载 app/src/main/assets/index.html，注入一个模拟 Android 原生层的 AndroidBridge
（getOrientationMode / setOrientationMode，内部维护一份「SharedPreferences」状态），覆盖 8 个场景：
  fresh               首次安装：只读取，不调用任何锁定接口
  pick_landscape      菜单选择「锁定横屏」：调用 setOrientationMode('landscape')，提示「下次打开会保持」
  relaunch_landscape  重启（原生已保存横屏）：只读取，不再重新锁定 —— 本次修复的核心断言
  native_wins         原生保存竖屏、网页备份是横屏：以原生为准
  migrate             从 3.9.0 升级（网页只有 orient=true、原生无记录）：迁移一次 setOrientationMode('current')
  current             「锁定当前方向」：由原生解析为具体方向后回传
  to_auto             恢复自动旋转
  nobridge            PC / 浏览器（无桥接）：方向按钮隐藏，不调用任何接口

用法（先在 assets 目录启动静态服务器，ES Module 不能用 file:// 加载）：
  cd app/src/main/assets && python3 -m http.server 8765 &
  pip install playwright && python3 -m playwright install chromium
  python3 tools/orientation-tests/test_orientation.py
"""
import json, time
from playwright.sync_api import sync_playwright
URL="http://localhost:8765/index.html"
def mock(stored_mode, stored, current):
    return """
window.__calls=[];
window.__native={mode:%s,stored:%s,current:%s};
window.AndroidBridge={
  getOrientationMode(){ __calls.push(['get']); return JSON.stringify(window.__native); },
  setOrientationMode(m){ __calls.push(['set',m]); const r = m==='current'? __native.current : m; __native.mode=r; __native.stored=true;
     setTimeout(()=>window.__onOrientationMode&&window.__onOrientationMode(r),30); },
  setOrientationLock(l){ __calls.push(['lock',l]); },
  setKeepScreenOn(o){ __calls.push(['keep',o]); },
  setSystemBars(){}, getExportFolder(){return '{"set":false}'},
};""" % (json.dumps(stored_mode), json.dumps(stored), json.dumps(current))
res={}
with sync_playwright() as p:
    b=p.chromium.launch()
    def run(name, init, vw, vh, prefs=None, action=None, shot=None):
        ctx=b.new_context(viewport={'width':vw,'height':vh}, device_scale_factor=2, has_touch=True)
        pg=ctx.new_page(); errs=[]
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console.'+m.type+': '+m.text) if m.type=='error' else None)
        if prefs is not None:
            pg.add_init_script("localStorage.setItem('rmtool_prefs_v2', %s)" % json.dumps(json.dumps(prefs)))
        pg.add_init_script(init)
        pg.goto(URL); pg.wait_for_timeout(3500)
        if action: action(pg)
        out={'mode':pg.get_attribute('#orientToggle','data-mode'),'pressed':pg.get_attribute('#orientToggle','aria-pressed'),
             'calls':pg.evaluate('window.__calls.filter(c=>c[0]!=="keep")'),'native':pg.evaluate('window.__native'),
             'prefs':pg.evaluate("JSON.parse(localStorage.getItem('rmtool_prefs_v2')||'null')?.orientMode"),
             'toasts':pg.evaluate("[...document.querySelectorAll('.toast span')].map(x=>x.textContent)"),'errors':errs}
        if shot: pg.screenshot(path=shot)
        res[name]=out; ctx.close()
    # 1: fresh install, portrait
    run('fresh', mock('auto',False,'portrait'), 390, 844)
    # 2: user selects landscape via menu
    def pick(pg, which):
        pg.click('#orientToggle'); pg.wait_for_timeout(400)
        pg.click(f'#orientMenu [data-orient="{which}"]'); pg.wait_for_timeout(600)
    run('pick_landscape', mock('auto',False,'portrait'), 390, 844, action=lambda pg: pick(pg,'landscape'))
    # 3: relaunch with native stored landscape, phone held portrait (viewport landscape since native applied it)
    run('relaunch_landscape', mock('landscape',True,'landscape'), 915, 412, shot=None)
    # 4: relaunch stored portrait, but web prefs says landscape (native wins)
    run('native_wins', mock('portrait',True,'portrait'), 390, 844, prefs={'orientMode':'landscape','orient':True})
    # 5: migration from 3.9.0 prefs orient:true, native not stored
    run('migrate', mock('auto',False,'landscape'), 915, 412, prefs={'orient':True})
    # 6: lock current
    run('current', mock('auto',False,'landscape'), 915, 412, action=lambda pg: pick(pg,'current'))
    # 7: back to auto
    run('to_auto', mock('portrait',True,'portrait'), 390, 844, action=lambda pg: pick(pg,'auto'))
    # 8: desktop/no bridge
    run('nobridge', "window.__calls=[];window.__native=null;", 1366, 860)
    b.close()
for k,v in res.items(): print(k, json.dumps(v, ensure_ascii=False))

EXPECT = {'fresh': ('auto', [['get']]), 'pick_landscape': ('landscape', [['get'], ['set', 'landscape']]),
          'relaunch_landscape': ('landscape', [['get']]), 'native_wins': ('portrait', [['get']]),
          'migrate': ('landscape', [['get'], ['set', 'current']]), 'current': ('landscape', [['get'], ['set', 'current']]),
          'to_auto': ('auto', [['get'], ['set', 'auto']]), 'nobridge': ('auto', [])}
failed = [k for k, v in res.items() if (v['mode'], v['calls']) != EXPECT[k] or v['errors']]
print('\nALL ORIENTATION SCENARIOS PASS' if not failed else '\nFAILED: ' + ', '.join(failed))
raise SystemExit(1 if failed else 0)
