# 真实浏览器回归测试（3.14.0 新增）

`run.py` 用 Playwright + Chromium 加载 `app/src/main/assets` 的真实前端，点击真实按钮并运行真实的 Rust/WASM 引擎。

```bash
pip install playwright && playwright install chromium
python3 tools/browser-tests/run.py
```

覆盖：空状态小地图、输入约束、密度提示、`nearResKeys` 不跨地图累积、测距、历史收藏 / 淘汰 / 旧格式迁移、
择优候选 ZIP 导出、Android 分享链路（用模拟桥接）、手机抽屉关闭条；3.15.0 第 9 节、3.16.0 第 10 节（动态主题）；
3.17.0 第 11 节：第十五轮审查的 9 项修复 + 配方码 / 实时体检徽章 / 触屏放大镜（合成 touch 指针事件）/ 专注模式（桌面与手机）/ 视图截图。

只跑第 11 节：`ONLY=11 python3 tools/browser-tests/run.py`。
后台运行时请用 `setsid nohup … &`，并注意不要用 `pkill -f run.py`（会连同发出命令的 shell 一起结束）。

**局限**：桌面 Chromium 不等于 Android WebView / Tauri WebView；Kotlin / Rust 原生层不在此测试范围内。
