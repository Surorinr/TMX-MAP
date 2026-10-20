# 近家资源点 · 自动化测试

3.9.0 新增「近家资源点」功能的测试脚本。容器内没有浏览器 / 真实 Android 设备，没法端到端跑 WASM 引擎，
所以这里改为把新增的纯逻辑函数直接从 `app.js` 里按原文切片抽取出来（`extract.js` → `extracted.js`），
对照项目自带的真实 TMX 模板（`../../app/src/main/assets/blueprints/`）和合成的地形数据跑测试，而不是另外
重新实现一遍逻辑再测——测的是会被实际打进 APK / exe 的那份代码。

```
node run_all.js        # 重新抽取 + 跑全部测试
node extract.js         # 仅重新生成 extracted.js（改了 app.js 里相关函数后先跑这个）
```

覆盖范围见项目根目录 README.md 的「3.9.0 更新说明 → 三、测试方式」一节；没有覆盖真实设备/浏览器安装运行、
UI 交互可视回归，这些需要图形环境或 Android SDK，建议在具备条件的机器上另行验证。
