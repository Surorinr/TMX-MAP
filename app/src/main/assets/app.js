/*
 * 铁锈战争地图生成器 · TMX MapForge Offline
 * 版本 3.27.0 —— 第二十一轮：新增 4 套衍生地形形态（环礁 / 三角洲 / 高原要塞 / 沼泽，配方码格式版本 4 仅用于新形态）、
 *              「形态总览」（Shift+G）、种子收藏、6 套新主题（水墨 / 钢铁 / 薄荷 · 雪夜 / 霓虹 / 麦浪）、形态卡片新角标与动效。
 * 版本 3.26.0 —— 第二十轮审查：修复导入后新地图沿用导入文件名、配方码旧版标记误报、出生点上限文案；新增「新旧对比」
 *              （X）、「形态种子画廊」（G）、主题圆形揭示过渡、6 套新主题（砂岩 / 石墨 / 战地 · 雷暴 / 萤林 / 晴空）、
 *              9 种界面语言（i18n.js：简 / 繁 / EN / FR / DE / 日 / 한 / RU / ES）。
 * 版本 3.25.0 —— 地形形态的「陆地比例」按参照物调节：山湖 = 陆地 ↔ 中央湖（陆地少湖大，四周一圈陆地，环形山沿湖岸）、
 *              火山 = 周围陆地 ↔ 火山（非陆地全为岩浆，火口与熔岩流随比例缩放，火山锥沿火口）、两岸狭路 = 两岸 ↔ 中央水道
 *              （两岸延伸到图边，中间渡口始终相通）；群岛海峡与外缘海同步收放（高比例仍有贯通海峡、贴边岛不被切半）；
 *              沙漠绿洲湖 / 大陆内陆湖随比例缩放；界面显示每个模板的比例参照物；配方码格式版本 3。
 * 版本 3.24.1 —— 全量审查：形态种子按生成器规则折叠（大数种子的配方码可还原同一张图）、配方码写入格式版本 2 并识别旧版形态码、
 *              模板场与陆地比例完全无关并缓存（拖动比例滑块只重新选格）、迷宫 / 山湖响应「山地」档位、对角对称下河道 / 水道宽度修正、
 *              小地图岛屿外缘海带收窄、build 参数 NaN 防护、连通块标记提速；PC 版 open_path 限定在导出目录内。
 * 版本 3.24.0 —— 重写 11 套地形形态模板：每个模板定义与比例无关的「陆地优先级场」，陆地占比只决定取哪一条嵌套等值线
 *              （按格数精确命中目标、陆地随比例单调扩张），模板骨架 / 山脉 / 纹理不随比例变化；各模板形态按名字重新设计
 *              （迷宫为真正的迷宫墙、火山为火山锥 + 火口 + 对称熔岩流、两岸为居中水道 + 渡口等），方向性模板随对称方式定向。
 * 版本 3.23.2 —— 修复结构性水域在比例缩放时被填平：双河 / 两岸的河道与中央水道改为与高度场同一条中心线、
 *              任何陆地占比下都贯通（不再加浅滩、不再在空间不足时清空保护水域），双河三块陆地永不连通；
 *              群岛 / 迷宫增加水域中轴骨架保护，高陆地档位的水面变成贯穿陆地的海峡 / 走廊而不是外框；
 *              迷宫海岸改为岩岸并收窄沙滩带，避免密集水道把整片陆地涂成沙。
 * 版本 3.23.1 —— 修复 3.23.0 形态学比例缩放在不同陆地占比下的质量问题：去掉岛屿 / 群岛的人工环形水道（「双海岸」与
 *              沙地成片），边界同距格改用低频相干噪声整块取舍（海岸线不再被打成噪点 / 锯齿），新增连续沙滩环与按
 *              噪声分位校准的低地材质调色板（消除整片同色平原），火山海岸维持径向判定、内部水量归零。
 * 版本 3.23.0 —— 以 50% 标准模板为锚点，用有符号距离场对陆地边界等距膨胀 / 腐蚀，比例不再触发整张高度场重新取等高线。
 * 版本 3.22.1 —— 历史版本：高度场单调平移对齐原生海平面，山湖缩放同心湖面半径、火山按岩浆场分位数取阈值；
 *              此方案在极端比例下仍可能切换模板等高线，已由 3.23.0 的模板基准形态学调整取代。
 * 版本 3.22.0 —— 陆地占比对所有模板真正生效：海平面按目标水面比例取高度分位数校准、修正降序 smooth 被当成硬阶跃、
 *              并对碎岛清理等后处理造成的偏差做反馈重算（实测平均偏差 0.85%，最差 3.1%）。
 * 版本 3.21.0 —— 陆地占比统一支持 10～90（形态滑杆、偏好读取、项目 / 配方码载入与导出校验全部对齐）。
 * 版本 3.20.0 —— 第十八轮全局审查：修复「分步模式在完整地图之后重跑海岸线 / 高度步骤，导出、保存项目、自动保存会把未完成地图的
 *              出生点（通常 0 个）写进上一张地图的 TMX」、项目 / 草稿 / 历史快照把上一张地图的 TMX 与未完成地图的出生点存在一起、
 *              60 人以上地图第 51 号之后误显示「不会写入」、FFA 新生成时玩家 1 不在正上方、FFA 仍画 A/B 对位连线；
 *              新增「公平度一键微调」（O，保持对称与近家资源）、「落点热力」图层（K）、「对称修复：补齐镜像出生点」（详见 README）。
 * 版本 3.19.0 —— 第十七轮全局审查：修复「大地图 / 形态多步生成中途取消后，半成品地图与旧 TMX 错配（导出会抹掉旧地图的出生点）」、
 *              「配方码混用地图参数与界面参数」、「择优候选全部失败时引擎状态标记未更新」、Android 文件选择器回调被完成两次（3.18.0 回归）、
 *              Android 导出文件夹遇到瞬时写入错误即被永久遗忘、PC 版 JSON 兜底分支截断字节等；
 *              出生点上限 50 → 100（51～100 号指挥中心瓦片导出时自动补进 TMX）；预设去掉 25V25，新增 30V30 / 40V40 / 50V50 与
 *              「自由混战（FFA）」——顺时针槽位、每人一色、FFA 公平度与体检（最近对手 / 领地均衡）；
 *              新增「对称检查」图层（Y）、「出生点巡视」+ 玩家卡片（, / .）、体检「玩家对比」表、配方码写入 ZIP 说明与项目文件、
 *              按钮涟漪与图层开关动效（详见 README）。
 * 版本 3.18.0 —— 第十六轮全局审查：生成海岸线 / 图片导入失败丢编辑状态、畸形 TMX 队伍号致主线程卡死、Android 文件选择器回调与
 *              持久授权泄漏、图层与标签页 aria 状态（详见 README）。
 * 版本 3.17.0 —— 第十五轮全局审查：修复取消 / 失败的生成清空当前地图的队伍 / 撤销记录 / 近家资源标记、Toast 去重吞掉新的「撤销」、
 *              测距模式右键误删出生点、恢复默认 / 新建项目后测距模式残留、历史面板二次确认取消后整个面板消失、主题面板上下键跨组落错列、
 *              方向菜单里按字母键误触画布快捷键、关闭自动保存后排队中的保存仍写入、近家资源距离输入框上限与代码不一致；
 *              新增「配方码」（整套参数 + 形态种子编成短码，带校验，可夹在聊天文字里粘贴）、「实时体检徽章」（编辑后空闲时自动评分，
 *              ▲/▼ 显示涨跌）、「触屏放大镜」（拖动出生点 / 测距 / 画墙时在手指上方放大落点）、「专注模式」（Z，画布铺满）、
 *              「当前视图截图」（含已开启的图层与水印）；配套动效全部遵循「减少动态效果」（详见 README）。
 * 版本 3.16.0 —— 新增 5 套动态主题（极光 / 熔岩 / 星云 / 深潮 / 樱雾，画布区动态背景 + 顶栏流光，纯 CSS 合成器动画）与
 *              2 个自动主题（跟随系统 / 昼夜流转：按本机时间在 5 套主题间切换）；主题按钮改为选择面板（色板预览、方向键导航、
 *              「动态背景」开关）；主题存储从下标改为 id（兼容旧版）；亮色覆盖规则改为按色调 data-tone 匹配（详见 README）。
 * 版本 3.15.0 —— 新图标；第十四轮全局审查：修复 Toast「撤销」撤错步骤（总是撤销最新一步）、近家资源点删除补丁在换图后被重做到新地图、
 *              近家资源点撤销时连带复活其他已删除的点、生成 / 引擎处理中仍可删除 / 拖动 / 改队伍出生点、连续崩溃后引擎永久停用只能重启 App、
 *              安卓返回键一次就丢掉测量结果；新增「命令面板」（Ctrl+K，拼音首字母搜索）、「测距地形剖面」、「随机地图起名」、
 *              「复制小地图图片」；UI 动效打磨（详见 README）。
 * 版本 3.14.0 —— 第十三轮全局审查（首次使用真实浏览器 Chromium 动态测试）：修复近家资源点键（nearResKeys）跨地图累积导致的误路由、
 *              近家资源点新增 / 删除与自动保存之间的 TMX 写回竞态、历史快照整数组读改写（并发丢记录 / 大地图写入量巨大）、
 *              空状态小地图白框、长弹窗按钮被挤出视口、数字输入框只在失焦时约束、手机抽屉没有关闭入口；
 *              新增「测距工具」（直线 + 步行距离 + 绕路比例）、「历史收藏 / 重命名」、「导出全部候选 ZIP」、「地图密度提示」、
 *              「Android 导出后一键分享」；UI 动效打磨（详见 README）。
 * 版本 3.13.0 —— 第十二轮全局审查：动效可访问性（prefers-reduced-motion）、触屏粘滞 hover、冒烟测试改为静态 HTTP 测试（详见 README）。
 *              （3.15.0 更正：此前这里误抄了 3.11.0 的说明。）
 * 版本 3.10.0 —— 修复「屏幕方向锁定不能持久化」（核心）：方向模式改由原生层持久化并在 Activity 创建时立即恢复，
 *              顶栏方向按钮升级为「自动旋转 / 锁定竖屏 / 锁定横屏 / 锁定当前方向」菜单；
 *              第九轮全局审查：偏好防抖写入在切后台 / 关闭窗口时丢失、忙碌遮罩每次进度更新都跨线程切换屏幕常亮、
 *              旋转屏幕后（未适应画布时）视图中心漂移、横屏手机（宽 > 900px、高 ≤ 500px）落入桌面布局导致侧栏挤压画布；
 *              UI 动效升级（顶栏毛玻璃、方向菜单弹出、按钮按压反馈、卡片悬停、焦点环、横屏紧凑布局等，详见 README）。
 * 版本 3.9.0 —— 新增「近家资源点」：无论地图多大、出生点多少、是否对称/怎么对称，生成/完成地图后自动在每个
 *              出生点周边 10～20 格直线距离内补足 ≥2 个可用资源点（陆路可达、不压墙/悬崖、严格对称镜像，
 *              数量/距离范围可调，支持导入地图手动补齐、单点删除撤销、画布近家圈图层）；
 *              第八轮全局审查：修复 analysisSig() 缓存签名漏算资源点（体检/领地/接敌路线在资源点变化后不刷新）、
 *              Android 自定义导出文件夹授权失效时提示位置与实际落点不符的竞态、itemTileInfo() 解析内嵌瓦片集时
 *              被自闭合 <tile> 标签误导致资源池瓦片 GID 识别错位（详见 README）。
 * 版本 3.8.0 —— 新增「地形形态」：移植 11 套形态模板（岛屿 / 半岛 / 群岛 / 双河 / 山湖 / 大陆 / 沙漠 / 雪原 / 火山 / 迷宫 / 两岸狭路），
 *              含对称镜像、浅滩、高地坡道、自动凿通道等可对战化处理与所见即所得预览；Android 新增「另存为 / 导出位置」；
 *              第七轮全局审查（详见 README）。
 * 版本 3.7.0 —— 第六轮审查：修复「TMX 写回竞态（保存与生成并发时新地图被旧 TMX 覆盖）」「Android 10+ 重名改名后 TMX 与
 *              _map.png 不再成对」「局部 / 全局撤销栈上限不同步」「返回键在生成中直接退出」等；
 *              新增「择优生成」（一次生成多张候选并自动体检评分、缩略图对比）、「接敌（Rush）距离分析 + 路线图层」、
 *              「体检精确化」（读取 TMX 悬崖 / 水域瓦片，导入地图也能精确体检并显示悬崖）、「分享海报」导出。
 * 版本 3.6.0 —— 第五轮审查：合并 Android 3.4.x 与 PC 3.5.0 两条分支（找回被丢失的屏幕方向锁定 / 签名配置）；
 *              修复「取消」被当作崩溃导致引擎永久停用、小地图拖动监听泄漏、空格键劫持按钮、输入框内 Ctrl+S 失效等；
 *              新增「地图体检」（出生点连通性 / 领地平衡 / 资源分配 / 地形构成）与领地图层、生成前保护与「找回上一张地图」、
 *              「我的参数方案」。
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
const APP_VERSION = '3.27.0';
const PROJECT_FORMAT = 3270; // 3.27.0：仅记录写入版本（读取时不校验），旧项目仍可读取（项目结构本轮无变化）
const $ = id => document.getElementById(id);
const MAX_SPAWN_POINTS = 100; // 3.19.0：50 → 100（51～100 号槽位的指挥中心瓦片在导出时自动补进 TMX，见 extendCcTileset）
const ENGINE_MAX_CC = 50;     // 3.19.0：WASM 引擎与内置蓝图只有 50 个指挥中心槽位；超出部分由 JS 智能布点补齐
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
/* 3.19.0：去掉 25V25，新增 30V30 / 40V40 / 50V50；「自由混战（FFA）」不在此表中——它不固定人数，人数沿用「出生点数量」 */
const PRESET_COUNTS = { '1v1': 2, '2v2': 4, '3v3': 6, '4v4': 8, '5v5': 10, '10v10': 20, '20v20': 40, '30v30': 60, '40v40': 80, '50v50': 100 };
const FFA_DEFAULT_PLAYERS = 8;
const TEAM_COLORS = { A: '#4b8aff', B: '#ff6b6b' };
/* ------------------------------------------------------------------ 3.19.0：自由混战（FFA）
 * 铁锈战争地图里的「队伍」其实只是指挥中心瓦片的 team 属性（= 玩家槽位），真正的结盟在游戏大厅里设置。
 * 本工具此前把所有地图都当作 A / B 两队来布局和评估（槽位 A/B 交替、领地 / 资源 / 接敌按两队比较）。
 * FFA 模式下每位玩家各自为战：teamOf() 返回每人独立的队伍号 P0…P99，于是
 *   · 槽位：按「绕地图中心顺时针」编号（玩家 1 在正上方附近，邻座就是相邻编号），不再 A/B 交替；
 *   · 公平度：看「每人到最近对手的距离」是否均匀，而不是两队人数 / 资源是否对等；
 *   · 体检：领地均衡 = 最小领地 / 平均领地，接敌 = 每人到最近对手的行走距离（一次多源 Dijkstra + Voronoi 边界求出，
 *     100 人也只需一次寻路），资源 = 到最近资源点距离的均衡度；
 *   · 颜色：每位玩家一种颜色（黄金角色环，相邻编号色相相差约 137°，100 人也容易区分）。 */
const isFFA = () => $('gamePreset')?.value === 'ffa';
const ffaHue = i => (i * 137.508) % 360;
function ffaRgb(i) {
  const h = ffaHue(i) / 360, s = 0.72, l = i % 2 ? 0.66 : 0.56;
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = t => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 0.5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
  return [Math.round(f(h + 1 / 3) * 255), Math.round(f(h) * 255), Math.round(f(h - 1 / 3) * 255)];
}
const ffaColor = i => { const [r, g, b] = ffaRgb(i); return `rgb(${r},${g},${b})`; };
/** 队伍号 → 颜色：A / B 两队用固定色，FFA 的 P{n} 用每人一色 */
function teamColor(t) { return typeof t === 'string' && t[0] === 'P' ? ffaColor(Number(t.slice(1)) || 0) : (TEAM_COLORS[t] || '#ffffff'); }
const teamLabel = t => typeof t === 'string' && t[0] === 'P' ? '混战' : `${t} 队`;
const PREF_KEY = 'rmtool_prefs_v2';
const THEME_KEY = 'tmx_theme';
const UI_KEY = 'tmx_ui_v31';
const LEGACY_PROJECT_KEY = 'tmx_mapforge_project_v3_3';
/* 3.16.0：主题从 3 套扩充为 8 套具体主题 + 2 个自动主题。
 * tone = 'light' 的主题共用亮色专用的样式覆盖（body[data-tone="light"]）与系统栏深色图标；fx = 带动态背景（见 style.css「3.16.0 · 动态主题」）。
 * 本机存储从「下标」改为「主题 id」；3.15.0 及更早保存的下标 0 / 1 / 2 按 LEGACY_THEME_ORDER 迁移。 */
const THEMES = [
  { id: 'dark', name: '深空', group: '经典', bar: '#0b1220', tone: 'dark', desc: '默认深色，长时间编辑不刺眼' },
  { id: 'teal', name: '青岚', group: '经典', bar: '#071a21', tone: 'dark', desc: '青绿冷色调的深色主题' },
  { id: 'light', name: '亮白', group: '经典', bar: '#f4f7fb', tone: 'light', desc: '强光环境 / 投屏演示更清楚' },
  /* 3.26.0：新增三套静态主题 */
  { id: 'sand', name: '砂岩', group: '经典', bar: '#f8f3ea', tone: 'light', desc: '暖色纸张质感的亮色主题，陶土橙点缀，白天久看不累' },
  { id: 'graphite', name: '石墨', group: '经典', bar: '#141518', tone: 'dark', desc: '中性炭灰 + 琥珀强调色，不偏色，看地图配色最准' },
  { id: 'field', name: '战地', group: '经典', bar: '#12170e', tone: 'dark', desc: '军绿与卡其的深色主题，铁锈战争的战场味道' },
  /* 3.27.0：再新增三套静态主题 */
  { id: 'ink', name: '水墨', group: '经典', bar: '#f7f5ef', tone: 'light', desc: '宣纸底色配朱砂红与墨色，留白多、层次干净的亮色主题' },
  { id: 'steel', name: '钢铁', group: '经典', bar: '#141920', tone: 'dark', desc: '冷灰钢板 + 深绯红强调色，硬朗醒目的深色主题' },
  { id: 'mint', name: '薄荷', group: '经典', bar: '#f3faf6', tone: 'light', desc: '清爽薄荷绿 + 翡翠强调色，低饱和不刺眼的亮色主题' },
  { id: 'aurora', name: '极光', group: '动态', bar: '#08151f', tone: 'dark', fx: true, desc: '星空下缓缓摆动的极光带，星点闪烁' },
  { id: 'ember', name: '熔岩', group: '动态', bar: '#1a0d09', tone: 'dark', fx: true, desc: '底部呼吸的熔岩光晕与不断上升的火星' },
  { id: 'nebula', name: '星云', group: '动态', bar: '#110a22', tone: 'dark', fx: true, desc: '缓慢旋转的紫粉星云，偶尔有流星划过' },
  { id: 'tide', name: '深潮', group: '动态', bar: '#051c27', tone: 'dark', fx: true, desc: '海底交错的光纹、摇曳的光束与上浮气泡' },
  { id: 'sakura', name: '樱雾', group: '动态', bar: '#fffafc', tone: 'light', fx: true, desc: '浅粉薄雾与斜斜飘落的花瓣（亮色）' },
  /* 3.26.0：新增三套动态主题 */
  { id: 'storm', name: '雷暴', group: '动态', bar: '#0d121c', tone: 'dark', fx: true, desc: '翻滚的云团与斜雨，偶尔一道柔和的闪电（不刺眼）' },
  { id: 'firefly', name: '萤林', group: '动态', bar: '#0a1712', tone: 'dark', fx: true, desc: '月下林间薄雾，成群萤火虫游走明灭' },
  { id: 'sky', name: '晴空', group: '动态', bar: '#f3f8fd', tone: 'light', fx: true, desc: '暖阳光晕与远近两层缓缓飘过的白云（亮色）' },
  /* 3.27.0：再新增三套动态主题 */
  { id: 'snow', name: '雪夜', group: '动态', bar: '#0f1620', tone: 'dark', fx: true, desc: '冷月薄雾下远近两层雪花轻轻摇曳飘落，灯火金点缀' },
  { id: 'neon', name: '霓虹', group: '动态', bar: '#100b1c', tone: 'dark', fx: true, desc: '地平线辉光与向前奔流的透视网格，复古霓虹风' },
  { id: 'wheat', name: '麦浪', group: '动态', bar: '#faf5e8', tone: 'light', fx: true, desc: '午后暖阳下起伏的麦浪与上飘的蒲公英（亮色）' }
];
const THEME_AUTO = [
  { id: 'system', name: '跟随系统', group: '自动', desc: '跟随系统深浅色：浅色用「亮白」，深色用「深空」' },
  { id: 'cycle', name: '昼夜流转', group: '自动', desc: '按本机时间自动换：清晨樱雾 · 上午晴空 · 午后亮白 · 傍晚熔岩 · 入夜萤林 · 夜晚极光 · 深夜星云' }
];
const THEME_CHOICES = [...THEMES, ...THEME_AUTO];
const LEGACY_THEME_ORDER = ['dark', 'teal', 'light'];
const THEME_FX_KEY = 'tmx_theme_fx'; // '0' = 关闭动态背景（停在静止画面）
/* 昼夜流转时间表：[起始小时, 主题, 时段名]，按起始小时升序 */
/* 3.26.0：加入晴空（上午）与萤林（入夜），午后仍用静态的亮白 */
const THEME_CYCLE = [[0, 'nebula', '深夜'], [5, 'sakura', '清晨'], [7, 'sky', '上午'], [12, 'light', '午后'], [17, 'ember', '傍晚'], [19, 'firefly', '入夜'], [21, 'aurora', '夜晚'], [23, 'nebula', '深夜']];
/* 引擎侧依赖已有状态的操作：导入地图或引擎重启后不能直接执行 */
const ENGINE_STATEFUL = new Set([
  'run_height_ocean', 'draw_brush_walls', 'undo_brush', 'redo_brush', 'clear_brush_walls',
  'update_polygons', 'place_resource_manual', 'remove_resource_manual', 'place_resource_random',
  'undo_resource', 'clear_resource', 'run_finalize', 'set_hill_drawing_mode'
]);
const NON_MUTATING = new Set(['init', 'get_state_snapshot', 'set_hill_drawing_mode', 'reset_state']);
/* 3.9.0：这些引擎操作各自会返回一份全新的快照，且引擎自身并不知道「近家资源点」的存在（见下方近家资源点模块），
 * 用于在 applyEngineResult 里判断要不要重新静默补齐一次，避免手动资源操作把它们从画布上悄悄冲掉。 */
const RESOURCE_ENGINE_OPS = new Set(['place_resource_random', 'place_resource_manual', 'remove_resource_manual', 'undo_resource', 'clear_resource']);

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
  spawnRev: 0,             // 3.15.0：出生点修订号（任何出生点历史变化 +1），用于判断 Toast「撤销」是否仍对应同一步
  history: [], redoHistory: [],
  brushValue: 1, brushSize: 3, brushErasing: false, hillMode: 'brush',
  polygons: [], drawingPolygon: null, selectedPolygonId: null, selectedEdgeIndex: null,
  polygonSeq: 1, polyUndo: [], polyRedo: [],
  randomResourceKeys: new Set(),
  smartPlacement: true, autoSave: true, animate: true,
  orientMode: 'auto',      // 3.10.0：'auto' | 'portrait' | 'landscape'（Android 原生层持久化，网页只做显示与兼容备份）
  orientLegacy: false,     // 3.10.0：3.9.0 及更早版本只保存了 orient=true，首次启动时用于迁移
  layers: { terrain: true, spawns: true, resources: true, walls: true, grid: false, territory: false, routes: false, nearRes: true, symmetry: false, spots: false }, // 3.19.0：symmetry = 对称检查图层；3.20.0：spots = 落点热力
  view: { zoom: 1, x: 0, y: 0, fitted: false },
  locked: false,
  fadeStart: 0,
  themeChoice: 'system',   // 3.16.0：用户的选择（具体主题 id，或 'system' / 'cycle'）
  themeId: 'dark',         // 3.16.0：实际生效的主题 id
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
  if (typeof Stream !== 'function') throw new Error('当前系统 WebView 不支持压缩流（Android：请升级 Android System WebView；PC：请升级 WebView2 / WebKitGTK）');
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
  /* 3.17.0 修复：带操作按钮（如「撤销」）的提示不再参与去重。旧版连续两次删除同一序号的玩家时两条文字相同，
   * 第二条被合并进第一条，但按钮仍绑定第一步的操作，最新一步无法从提示条撤销。 */
  if (!opts.action) for (const t of box.children) {
    if (t.dataset.msg === msg && !t.classList.contains('leaving') && !t.classList.contains('has-action')) {
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
/* 3.26.0：界面可切换语言后，#status 的文字会被 i18n.js 翻译；逻辑判断一律用原文 statusRaw，不读界面文字 */
let statusRaw = '';
function setStatus(s) { const el = $('status'); if (statusRaw !== s || !el.textContent) { statusRaw = s; el.textContent = s; el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); } }
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
      clearBusyThumbs();
      if ($('busyElapsed')) $('busyElapsed').textContent = '';
    }, 220);
  }
  // 3.10.0：只在状态变化时调用原生桥接（旧版每次进度更新都会调用一次，跨线程投递到 UI 线程）
  if (keepScreenOn !== !!on) {
    keepScreenOn = !!on;
    try { window.AndroidBridge?.setKeepScreenOn?.(keepScreenOn); } catch { /* 旧版桥接无此方法 */ }
  }
}
let keepScreenOn = false;

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
      if (b.primary) btn.classList.add('primary-soft');
      if (b.danger) btn.classList.add('danger');
      if (b.className) btn.classList.add(b.className);
      btn.style.setProperty('--d', `${60 + actions.children.length * 40}ms`);
      btn.onclick = () => closeModal(b.key);
      actions.appendChild(btn);
    });
    m.hidden = false;
    requestAnimationFrame(() => m.classList.add('show'));
    // 3.6.0 修复：长弹窗（体检 / 槽位映射表 / 小地图预览）在手机上打开后，聚焦主按钮会把弹窗卷到底部，标题和顶部内容被滚出视野
    m.querySelector('.modal-card').scrollTop = 0;
    setTimeout(() => { actions.querySelector('.primary-soft,.danger')?.focus({ preventScroll: true }); m.querySelector('.modal-card').scrollTop = 0; }, 60);
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
  // 3.15.0：命令面板已打开时不还原焦点（否则 200ms 后会把焦点从面板搜索框抢走，输入落空）
  modalHideTimer = setTimeout(() => { if (tk === modalToken) { m.hidden = true; if (!cmdk.open) { try { modalLastFocus?.focus?.({ preventScroll: true }); } catch { /* ignore */ } } } }, 200);
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
    // 3.19.0：引擎只有 50 个指挥中心槽位；多于 50 人时引擎只布 50 个，其余由 JS 智能布点补齐（applySpawnPolicy）
    if (params && Number(params.numPlayers) > ENGINE_MAX_CC) params = { ...params, numPlayers: ENGINE_MAX_CC };
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
    // 3.6.0 修复：用户点「取消」也会走重启，旧版把它和真正的崩溃一起计入「10 秒内 >4 次即停止自动重启」，
    // 连续取消几次生成后引擎被永久停用，只能重启 App。取消不是崩溃，不再计数。
    this.restarts = this.restarts.filter(t => now - t < 10000);
    if (reason !== 'cancel') this.restarts.push(now);
    try { this.worker?.terminate(); } catch { /* ignore */ }
    this.failAll(new EngineError(reason === 'cancel' ? '操作已取消' : '本地引擎已重启', { fatal: reason !== 'cancel', cancelled: reason === 'cancel' }));
    S.engineEpoch++;
    if (this.restarts.length > 4) {
      /* 3.15.0：旧版在这里永久停用引擎，只能整个重启 App（未导出的地图编辑随之丢失）。现在暂停自动重启，
       * 但提供「重新启动引擎」：提示条按钮 / 点击顶栏红色状态胶囊 / 命令面板均可手动拉起一个全新的 Worker。 */
      setRuntime('引擎已暂停 · 点此重启', 'err');
      toast('本地引擎连续崩溃，已暂停自动重启', 'error', 9000, { action: { label: '重新启动引擎', fn: () => this.manualRestart() } });
      this.ready = Promise.reject(new EngineError('本地引擎不可用，请点击顶栏「点此重启」', { fatal: true }));
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
  },
  /** 3.15.0：手动重启（清空崩溃计数）。当前地图仍可编辑出生点 / 导出；地形分步编辑需从「① 海岸线」重新开始 */
  manualRestart() {
    if (S.locked) { toast('正在处理中，请稍候…', 'warn'); return; }
    this.restarts = [];
    try { this.worker?.terminate(); } catch { /* ignore */ }
    this.failAll(new EngineError('本地引擎已重启', { fatal: true }));
    S.engineEpoch++;
    setRuntime('引擎重启中…', 'warn');
    this.start().then(() => { setRuntime('本地运行 · 无网络依赖', 'ok'); toast('本地引擎已重新启动', 'success'); })
      .catch(e => { setRuntime('引擎初始化失败 · 点此重试', 'err'); toast('引擎初始化失败：' + e.message, 'error', 5000); });
  }
};

/* ------------------------------------------------------------------ 参数 */
const PARAM_LIMITS = [['width', 40, MAX_MAP_DIMENSION, DEFAULTS.width], ['height', 40, MAX_MAP_DIMENSION, DEFAULTS.height], ['heightLevels', 1, 32, DEFAULTS.heightLevels], ['oceanLevels', 0, 32, DEFAULTS.oceanLevels], ['players', 0, MAX_SPAWN_POINTS, DEFAULTS.players], ['resources', 0, MAX_RESOURCES, DEFAULTS.resources]];
/** 3.14.0：把数字输入框里的越界 / 非法值改回合法值并回显（只在生成等明确动作前调用，不在用户输入途中调用） */
function normalizeParamInputs() { PARAM_LIMITS.forEach(([id, mn, mx, dft]) => clampInput(id, mn, mx, dft)); }
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
/* ------------------------------------------------------------------ 地图密度提示（3.14.0 新增）
 * 新手最常见的失误是「小图塞太多人」或「大图只有两个人」：前者出生点挤在一起、一开局就接敌，
 * 后者行军半天碰不到对手。这里按「人均面积 = 宽 × 高 ÷ 出生点数」给出判断，并提供一键套用推荐尺寸。
 * 经验值：约 6000 格² / 人时，对战节奏最舒服（1V1 ≈ 110²，5V5 ≈ 250²）。 */
const DENSITY_TARGET = 6000;
function densityInfo(w, h, n) {
  const per = Math.round(w * h / n);
  let level = 'ok', label = '密度适中，对战节奏舒适';
  if (per < 1800) { level = 'bad'; label = '过于拥挤：开局就会接敌'; }
  else if (per < 3200) { level = 'warn'; label = '偏拥挤：前期节奏会很快'; }
  else if (per > 16000) { level = 'info'; label = '很空旷：行军时间长，前期不易接敌'; }
  else if (per > 11000) { level = 'info'; label = '偏空旷：适合喜欢运营的对局'; }
  const k = Math.sqrt(n * DENSITY_TARGET / (w * h));
  const rw = clamp(Math.round(w * k / 10) * 10, 40, MAX_MAP_DIMENSION), rh = clamp(Math.round(h * k / 10) * 10, 40, MAX_MAP_DIMENSION);
  return { per, level, label, rw, rh };
}
function updateDensityHint() {
  const el = $('densityHint'); if (!el) return;
  const n = intOf('players', 0, MAX_SPAWN_POINTS, DEFAULTS.players);
  if (n < 2) { el.hidden = true; return; }
  const w = intOf('width', 40, MAX_MAP_DIMENSION, DEFAULTS.width), h = intOf('height', 40, MAX_MAP_DIMENSION, DEFAULTS.height);
  const d = densityInfo(w, h, n);
  el.hidden = false; el.dataset.level = d.level;
  const off = d.level === 'ok' || (d.rw === w && d.rh === h);
  el.innerHTML = `<i class="dh-dot" aria-hidden="true"></i><span class="dh-text">人均 <b>${d.per.toLocaleString('zh-CN')}</b> 格² · ${d.label}</span>${off ? '' : `<button type="button" class="dh-apply" data-w="${d.rw}" data-h="${d.rh}" title="按每人约 ${DENSITY_TARGET} 格²推算">套用 ${d.rw}×${d.rh}</button>`}`;
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
  updateDensityHint();
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
 *   中心 3×3 必须是陆地；半径 2 内不能有墙线（3.8.0 起，见下）/ 资源池；距地图边缘 ≥2 格。
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
    /* 3.8.0 修复：墙线检查半径由 1 扩大到 2。完成地图（run_finalize）后墙体 / 悬崖会写入 Items 图层，而出生点规则要求
     * 「半径 2 内 Items 为空」—— 旧版在完成前按半径 1 放置的出生点，完成后有一部分紧贴悬崖，立刻被判为冲突并被自动挪走
     * （提示「N 个出生点与新地形/资源冲突，已自动重新安置」，手动摆好的位置也会变）。现在完成前后使用同一标准。 */
    if ((s?.meta?.hill_drawing_mode || 'brush') === 'polygon') {
      const D = (rr, cc) => wall.data[rr * cols + cc];
      const isWallCell = (rr, cc) => {
        const d = D(rr, cc); if (d <= 0) return false; // 0 = 平地；负数 = 缺口（坡道），都不画悬崖
        for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
          const y = rr + a, x = cc + b;
          if (y < 0 || x < 0 || y >= rows || x >= cols) continue;
          if (Math.abs(D(y, x)) < d) return true;
        }
        return false;
      };
      const d0 = Math.abs(D(r, c));
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) if (Math.abs(D(r + dr, c + dc)) !== d0) return false; // 处于分层边界（墙线）上
      for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) if (isWallCell(r + dr, c + dc)) return false;
    } else {
      for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) if (wall.data[(r + dr) * cols + c + dc] === 1) return false;
    }
  }
  // 3.7.0：导入地图 / 已完成地图读取了 TMX 悬崖瓦片（cliff_mask），出生点同样不能压在悬崖上
  const cliff = getMatrix('cliff_mask', s);
  if (cliff?.count && cliff.shape?.[1] === cols) {
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) if (cliff.data[(r + dr) * cols + c + dc]) return false;
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
function teamOf(p, i) { if (isFFA()) return 'P' + (i | 0); return S.teamOverrides.get(keyOf(p)) || sideTeam(p) || (i % 2 ? 'B' : 'A'); }
/* 3.3.0：「A/B 交替」时，B 队按「A[i] 的镜像点」重新配对 —— 玩家 1 与玩家 2、玩家 3 与玩家 4……互为镜像对手，
 * 旧实现按列表顺序硬拼，常出现玩家 1 的对位点在地图另一角。 */
/** 3.19.0：FFA 槽位——绕地图中心顺时针编号；保留原玩家 1 的位置作为起点（「设为玩家 1」后再增删出生点也不会被改回去） */
function orderClockwise(positions, keepFirst = true) {
  const [rows, cols] = dims(), cr = (rows - 1) / 2, cc = (cols - 1) / 2;
  const ang = p => { const a = Math.atan2(p[1] - cc, -(p[0] - cr)); return a < 0 ? a + Math.PI * 2 : a; }; // 0 = 正上方，顺时针递增
  const sorted = positions.map(p => ({ p, a: ang(p), d: Math.hypot(p[0] - cr, p[1] - cc) })).sort((x, y) => x.a - y.a || x.d - y.d).map(x => x.p);
  // 3.20.0 修复：只有「编辑」（增删出生点）才保留原玩家 1；全新布局（生成 / 重新布置 / 切换模式 / 重排）从正上方开始编号。
  // 3.19.0 一律保留原玩家 1，新生成的地图玩家 1 落在引擎第一个选点处（往往不在正上方），与「顺时针从正上方编号」的设计不符。
  if (!keepFirst) return sorted;
  const first = sorted.findIndex(q => keyOf(q) === keyOf(positions[0]));
  return first > 0 ? [...sorted.slice(first), ...sorted.slice(0, first)] : sorted;
}
function orderBySlot(positions, orderMode = $('slotOrder').value, { fresh = false } = {}) {
  if (orderMode === 'engine' || positions.length < 2) return positions;
  if (isFFA()) return orderClockwise(positions, !fresh); // 3.19.0；3.20.0：fresh = 全新布局，从正上方开始
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
  if (isFFA()) return 'P' + i; // 3.19.0
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
/* 3.9.0：资源点「掉落」动画——近家资源点新放置时，在画布上以从上方淡入落下的方式出现，而不是突然冒出来 */
const resPop = new Map();
function markResPop(points) { const now = performance.now(); for (const p of points || []) resPop.set(keyOf(p), now); if (resPop.size > 300) resPop.clear(); }
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
/* 3.7.0 修复：局部撤销栈有上限（出生点 60 / 多边形 40），全局栈上限 200。旧版局部栈丢弃最早一条时全局栈仍保留对应记录，
 * 连续操作超过 60 次后「全局撤销」会有 N 次按了没反应并提示「没有可撤销的出生点操作」。现在两边同步裁剪。 */
function dropOldestGlobal(type) { const i = S.history.indexOf(type); if (i >= 0) S.history.splice(i, 1); }
function pushSpawnHistory() {
  if (!S.snapshot) return;
  S.spawnRev++;
  S.spawnHistory.push(spawnState());
  if (S.spawnHistory.length > 60) { S.spawnHistory.shift(); dropOldestGlobal('spawn'); }
  S.spawnRedo = [];
  pushGlobal('spawn');
}
function restoreSpawnState(st) {
  if (!S.snapshot || !st) return;
  S.teamOverrides = new Map(st.teams || []);
  setSpawns(st.pos);
  afterSpawnChange();
}
function undoSpawn(fromGlobal = false, inLock = false) {
  if (!fromGlobal && !inLock && !guard()) return false; // 3.15.0：处理中（生成 / 引擎操作）不允许改出生点
  if (!S.spawnHistory.length) { toast('没有可撤销的出生点操作'); return false; }
  S.spawnRev++;
  if (!fromGlobal) syncLocal('spawn', 'undo');
  S.spawnRedo.push(spawnState());
  restoreSpawnState(S.spawnHistory.pop());
  toast('已撤销出生点操作');
  return true;
}
function redoSpawn(fromGlobal = false) {
  if (!fromGlobal && !guard()) return false;
  if (!S.spawnRedo.length) { toast('没有可重做的出生点操作'); return false; }
  S.spawnRev++;
  if (!fromGlobal) syncLocal('spawn', 'redo');
  S.spawnHistory.push(spawnState());
  restoreSpawnState(S.spawnRedo.pop());
  toast('已重做出生点操作');
  return true;
}
/* 3.15.0 修复：Toast 上的「撤销」按钮。旧版直接调用 undoSpawn()，撤销的是「当前最新的一步」而不是这条提示对应的那一步：
 * 删除玩家 4 → 又删除玩家 1 → 点第一条提示的「撤销」，恢复的是玩家 1（真机复现：10 → 9 → 8 → 9，玩家 4 仍然丢失）；
 * 生成新地图后、或生成过程中点旧提示的「撤销」也会作用到错误的状态上。
 * 现在提示创建时记下「出生点修订号 + 快照」，点击时两者都没变才执行撤销，否则说明原因并引导用 Ctrl+Z 逐步撤销。 */
function spawnUndoAction() {
  const rev = S.spawnRev, snap = S.snapshot;
  return { action: { label: '撤销', fn: () => {
    if (S.locked) { toast('正在处理中，请稍候…', 'warn'); return; }
    if (S.snapshot !== snap) { toast('地图已经变化，这条提示的撤销已失效', 'warn'); return; }
    if (S.spawnRev !== rev) { toast('之后又有新的出生点操作，请用「撤销」按钮或 Ctrl+Z 逐步撤销', 'warn', 4200); return; }
    undoSpawn();
  } } };
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
  const s = S.snapshot; if (!s || !guard()) return;
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
  if (idx < 0 || idx >= p.length || !guard()) return; // 3.15.0：处理中按 Delete / 点列表 ✕ 不再改动出生点
  pushSpawnHistory();
  const [gone] = p.splice(idx, 1);
  S.teamOverrides.delete(keyOf(gone));
  const next = normalizeSlots(p);
  const moved = next.some((q, i) => keyOf(q) !== keyOf(p[i]));
  setSpawns(next);
  S.selectedSpawn = -1;
  afterSpawnChange();
  setStatus(`已删除玩家 ${idx + 1}${moved ? '，其余槽位已按队伍规则整理' : ''}`);
  toast(`已删除玩家 ${idx + 1}${moved ? ' · 槽位已整理' : ''}`, 'info', 4200, spawnUndoAction());
}
function moveSpawn(idx, cell) {
  const s = S.snapshot, p = currentSpawns();
  if (!s || idx < 0 || idx >= p.length || !guard()) return false;
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
  positions = orderBySlot(positions, undefined, { fresh: true });
  setSpawns(positions);
  afterSpawnChange();
  if (!quiet) toast(`已智能布置 ${positions.length} 个出生点`, 'success');
  setStatus(`已智能布置 ${positions.length} 个出生点`); // 3.7.0：旧版状态栏仍停留在上一步（如「生成高度与海洋完成」）
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
  if (isFFA()) return ffaFairness(p, snap, rows, cols, min, edge);
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
  const raw = clamp((spacing * 0.42 + Math.min(1, edge * 2) * 0.16 + Math.min(1, avg / (target * 2)) * 0.16 + resourceBalance * 0.13 + countBalance * 0.13) * 100, 0, 100);
  const score = Math.round(raw);
  return {
    score, raw, min, avg, edge, resourceBalance, nA, nB, // 3.20.0：raw = 未取整的分数（公平度微调用它做目标函数，避免整数平台）
    text: `最小间距 ${min.toFixed(1)} · 平均间距 ${avg.toFixed(1)}<br>边缘安全 ${Math.round(edge * 100)}% · 资源平衡 ${Math.round(resourceBalance * 100)}% · 队伍 A ${nA} / B ${nB}`
  };
}
/** 3.19.0：FFA 公平度——人人互为对手，看的是「每人到最近对手的距离」是否均匀、整体是否拉得够开，以及到资源的远近是否均衡 */
function ffaFairness(p, snap, rows, cols, min, edge) {
  const n = p.length;
  const nn = p.map((a, i) => { let d = Infinity; p.forEach((b, j) => { if (j !== i) d = Math.min(d, dist2(a, b)); }); return d; });
  const nnAvg = nn.reduce((x, y) => x + y, 0) / n, nnBal = nnAvg ? Math.min(...nn) / nnAvg : 0;
  const target = Math.max(1, Math.sqrt(rows * cols / n) * 0.62); // 均匀铺满时每人「方格」边长的 0.62 倍
  const spacing = Math.min(1, min / target);
  const res = snap?.resource_positions || [];
  let resourceBalance = 1;
  if (res.length) { const near = p.map(a => Math.min(...res.map(b => dist2(a, b)))); resourceBalance = Math.min(1, Math.max(1, Math.min(...near)) / Math.max(1, ...near)); }
  const raw = clamp((spacing * 0.38 + Math.min(1, edge * 2) * 0.14 + nnBal * 0.28 + resourceBalance * 0.2) * 100, 0, 100);
  const score = Math.round(raw);
  return {
    score, raw, min, avg: nnAvg, edge, resourceBalance, nA: n, nB: n, ffa: true,
    text: `自由混战 · ${n} 人<br>最近对手间距：最小 ${min.toFixed(1)} · 平均 ${nnAvg.toFixed(1)}（均匀度 ${Math.round(nnBal * 100)}%）<br>边缘安全 ${Math.round(edge * 100)}% · 资源距离均衡 ${Math.round(resourceBalance * 100)}%`
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
  if (f.min !== undefined) { // 3.6.0：得分为 0 也是有效结果，旧版 if (f.score) 会把它显示成「无数据」
    animateNumber($('fairnessSummary'), f.score);
    arc.style.strokeDasharray = `${f.score} 100`;
    arc.dataset.level = f.score >= 80 ? 'good' : f.score >= 60 ? 'warn' : 'bad';
    const cls = f.score >= 80 ? 'good' : f.score >= 60 ? 'warn' : 'bad';
    $('fairnessReport').innerHTML = `公平度 <strong class="${cls}">${f.score}/100</strong><br>${f.text}<br><span>建议：${f.score < 70 ? '点击「智能重新布置」，或手动拖动出生点拉开间距' : !f.ffa && f.nA !== f.nB ? '两队人数不等，可调整队伍分配' : '当前布局可用，可继续手动微调'}</span>`;
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
  queueHealthBadge(); // 3.17.0：实时体检徽章（防抖 + 空闲时计算，结果按 analysisSig 缓存）
  // 3.19.0：巡视卡片跟随出生点变化（删除 / 换图后选中失效则收起；否则防抖刷新数据）
  if (tour.on) { clearTimeout(tour.timer); if (S.selectedSpawn < 0 || S.selectedSpawn >= currentSpawns().length) closeSpawnCard(); else tour.timer = setTimeout(() => { if (tour.on && S.selectedSpawn >= 0 && !drag) renderSpawnCard(S.selectedSpawn); }, 350); }
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
  const cc = ccMapFor(), extCap = ccExtendableCap(cc);
  const frag = document.createDocumentFragment();
  p.forEach((pos, i) => {
    const team = teamOf(pos, i);
    const gid = i < cc.capacity ? cc.gidForTeam(i) : 0;
    // 3.20.0 修复：超出当前 TMX 槽位、但导出时能自动补齐瓦片集的出生点，不再标成「不会写入」
    const pending = !gid && i < extCap;
    const row = document.createElement('div');
    row.className = 'spawn-row' + (i === S.selectedSpawn ? ' selected' : '') + (oldTops.has(keyOf(pos)) ? ' settled' : '') + (gid || pending ? '' : ' over-cap');
    row.dataset.index = i;
    row.dataset.key = keyOf(pos);
    row.style.setProperty('--d', `${Math.min(i, 20) * 18}ms`);
    row.innerHTML = `<span class="spawn-badge team-${team}"${team[0] === 'P' ? ` style="--tc:${teamColor(team)}"` : ''}>${i + 1}</span>
      <div class="spawn-main"><b>玩家 ${i + 1}${i === 0 ? ' <em>P1</em>' : ''}</b><small>坐标 ${pos[0] + 1}, ${pos[1] + 1} · ${gid ? `team ${i} · GID ${gid}` : pending ? `team ${i} · 导出时自动补槽位` : '超出瓦片集槽位，不会写入'}</small></div>
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
  if (!guard()) { updateSpawnUI(); return; } // 还原下拉框显示
  pushSpawnHistory();
  S.teamOverrides.set(keyOf(pos), team);
  const before = currentSpawns();
  if ($('slotOrder').value !== 'engine') {
    const after = orderBySlot(before);
    const oldI = before.findIndex(q => keyOf(q) === keyOf(pos)), newI = after.findIndex(q => keyOf(q) === keyOf(pos));
    if (after.some((q, i) => keyOf(q) !== keyOf(before[i]))) {
      setSpawns(after); S.selectedSpawn = newI;
      toast(`队伍已改为 ${team}，玩家槽位已重排${oldI !== newI ? `：玩家 ${oldI + 1} → 玩家 ${newI + 1}` : ''}`, 'success', 3600, spawnUndoAction());
    }
  } else if (S.lastTmx) { S.unitsDirty = true; S.slotVerified = null; }
  afterSpawnChange();
}
/* 3.3.0 修复：旧版「设为玩家 1」把选中点 unshift 到首位，其后所有出生点整体后移一位，
 * 在交替排序下所有人的队伍奇偶都被打乱。现在改为「交换」：交替模式整对交换（保持镜像对手关系），
 * 其他模式只交换两个槽位；被交换的两点同时交换队伍归属，其余玩家的编号与队伍完全不变。 */
function makePlayerOne(idx) {
  const p = currentSpawns();
  if (idx <= 0 || idx >= p.length || !guard()) return;
  pushSpawnHistory();
  const swapTeams = (i, j) => {
    const ki = keyOf(p[i]), kj = keyOf(p[j]), ti = teamOf(p[i], i), tj = teamOf(p[j], j);
    S.teamOverrides.set(ki, tj); S.teamOverrides.set(kj, ti);
    [p[i], p[j]] = [p[j], p[i]];
  };
  if (isFFA()) {
    // 3.19.0：FFA 没有队伍可换；把顺时针序列旋转到以该玩家为起点，其余玩家的相对顺序（邻座关系）不变
    const rot = [...p.slice(idx), ...p.slice(0, idx)];
    setSpawns(rot); S.selectedSpawn = 0; afterSpawnChange();
    toast(`已将原玩家 ${idx + 1} 设为玩家 1（其余玩家按顺时针顺延）`, 'success', 3600, spawnUndoAction());
    return;
  }
  if ($('slotOrder').value === 'alternate' && p.length >= 2) {
    const base = idx - (idx % 2);
    if (base > 0) {
      [p[0], p[base]] = [p[base], p[0]];
      if (base + 1 < p.length) [p[1], p[base + 1]] = [p[base + 1], p[1]];
    }
    if (idx % 2) swapTeams(0, 1);
  } else swapTeams(0, idx);
  setSpawns(p); S.selectedSpawn = 0; afterSpawnChange();
  toast(`已将原玩家 ${idx + 1} 设为玩家 1（其余玩家槽位不变）`, 'success', 3600, spawnUndoAction());
}
function selectSpawn(i, center = false) {
  const pos = i >= 0 ? currentSpawns()[i] : null;
  if (i >= 0 && !pos) i = -1; // 3.19.0：越界序号（如体检列表在出生点被删除后点击）不再在下面读取 pos[1] 时抛错
  S.selectedSpawn = i;
  document.querySelectorAll('.spawn-row').forEach(x => x.classList.toggle('selected', Number(x.dataset.index) === i));
  if (i >= 0) {
    const row = document.querySelector(`.spawn-row[data-index="${i}"]`);
    row?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    if (center === 'tour') {
      // 3.19.0：出生点巡视——统一观察尺度（约 56 格见方，但不小于「适应画布」），跃迁式飞行
      const r = $('map').getBoundingClientRect(), [rows, cols] = dims(), ins = viewInsets();
      const fitZ = Math.min(Math.max(40, r.width - ins.left - ins.right) / cols, Math.max(40, r.height - ins.top - ins.bottom) / rows);
      const z = clamp(Math.max(fitZ, Math.min(r.width, r.height) / 56), 0.05, 40);
      flyViewTo(r.width / 2 - (pos[1] + 0.5) * z, r.height / 2 - (pos[0] + 0.5) * z + (r.height > 520 ? 26 : 0), z);
    } else if (center) {
      const r = $('map').getBoundingClientRect();
      const z = Math.max(S.view.zoom, Math.min(6, S.view.zoom * 1.6));
      animateViewTo(r.width / 2 - (pos[1] + 0.5) * z, r.height / 2 - (pos[0] + 0.5) * z, z);
    }
  }
  if (tour.on) { if (i >= 0) renderSpawnCard(i); else closeSpawnCard(); }
  scheduleRender();
}

/* ------------------------------------------------------------------ 快照应用 */
function setSnapshot(s, { fit = false, fade = false } = {}) {
  if (!s) return;
  S.snapshot = s;
  const done = s.meta?.completed_step ?? -1;
  if (S.source === 'engine' && done + 1 > S.step) S.step = clamp(done + 1, 0, 5);
  $('emptyState').classList.toggle('hide', true);
  $('mapPanel').classList.remove('no-map'); // 3.14.0：有地图后才显示小地图
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
  if (action === 'quick_generate') { S.teamOverrides.clear(); S.snapshot = s; positions = orderBySlot(positions, undefined, { fresh: true }); }
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
  // 3.14.0 修复：引擎返回的快照里不含 JS 侧补的近家资源点（旧快照被整体替换后它们已从画布消失），
  // 旧版却保留着过期的键，之后在这些坐标上删除引擎资源点会被误路由到 JS 删除路径。先记下“此前补过”，再清空。
  const hadNearRes = S.nearResKeys.size > 0;
  S.nearResKeys = new Set();
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
  if (r.tmx_bytes?.length) attachCliffMask(s, r.tmx_bytes);
  if (action === 'set_coastline_from_image') syncImportedDepthUI(s);
  else if (action === 'run_coastline' || action === 'quick_generate') S.importedDepth = false;
  if (S.animate && r.frames?.length) await playFrames(r.frames.map(f => ({ height: f })), label);
  if (S.animate && r.quick_frames?.length) await playFrames(r.quick_frames.map(f => ({ height: f.height_map, items: f.items_matrix, units: f.units_matrix })), label);
  // 3.9.0：地图刚完成（quick_generate 一步到位，或分步/大地图优化走到 run_finalize）时自动补齐近家资源点。
  // 放在这里（而不是各个调用处分别调用）是因为所有生成流程最终都会经过 applyEngineResult 这一个收口点，
  // 包括「大地图分步」「地形形态」「分步编辑完成地图」「导出前重新生成」等，一处接入即可全部覆盖。
  if ((action === 'run_finalize' || action === 'quick_generate') && r.tmx_bytes?.length) {
    try { await autoApplyNearSpawnResources(); } catch (e) { console.warn('近家资源点自动补齐失败', e); }
  } else if (RESOURCE_ENGINE_OPS.has(action) && hadNearRes && S.lastTmx) {
    // 地图已完成过一次（S.lastTmx 存在）之后，用户又回到「资源点」步骤做了手动放置/随机/撤销/清空：
    // 这些操作各自从引擎拿回一份全新快照，引擎并不知道近家资源点的存在，直接覆盖会把它们从画布上悄悄抹掉。
    // 静默重新补齐一次（不弹「已补齐」提示，避免每点一下引擎资源按钮就跳一条），保持与用户心智一致。
    try { await autoApplyNearSpawnResources({ silent: true }); } catch (e) { console.warn('近家资源点重新同步失败', e); }
  }
  updateDirtyNote();
}
function setExportEnabled(on) { for (const id of ['export', 'exportZip', 'exportZipQuick', 'saveAsBtn', 'fabExport', 'pngPreview', 'posterBtn']) { const el = $(id); if (el) el.disabled = !on; } }
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
  if (S.source === 'engine' && S.snapshotEpoch !== S.engineEpoch) { toast('引擎状态已被新的生成覆盖（或引擎已重启），这张地图的地形 / 墙体 / 资源分步编辑已失效；出生点仍可编辑、可导出。如需完整编辑请从「① 海岸线」重新开始', 'warn', 5200); return false; }
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
  S.spawnRev++;
  S.randomResourceKeys.clear();
  S.importedDepth = false;
  S.nearResKeys = new Set(); // 3.14.0 修复：新地图 / 导入 / 恢复时必须清空，否则旧地图的坐标会误判新地图里的引擎资源点
  S.mapShape = null; // 3.8.0：当前地图的形态信息（ZIP 说明.txt 使用），新地图 / 导入时清空
  S.mapRecipe = null; // 3.19.0：当前地图「生成时」的整套参数（配方码以它为准，见 recipeData）
  closeSpawnCard(); // 3.19.0：换图 / 导入 / 清空时收起巡视卡片
  spawnPop.clear();
  resetHealthBadge(); // 3.17.0：新地图从头计分，不显示与旧地图比较的涨跌
  updatePolygonInfo();
  updateUndoButtons();
}
/* 3.17.0 修复：生成开始前会先 resetEditorState()，旧版取消或失败后画布仍显示旧地图，但手动指定的队伍、撤销历史、
 * 近家资源点标记、多边形和形态信息都已丢失（实测：玩家 1 的队伍被悄悄改回，撤销栈从 1 步变成 0 步）。
 * 现在开始前拍下这些状态；只要地图本身没有被替换（快照与 TMX 都还是原来的对象），就原样还原。 */
function captureEditorState() {
  return {
    snapshot: S.snapshot, lastTmx: S.lastTmx,
    polygons: S.polygons, drawingPolygon: S.drawingPolygon, selectedPolygonId: S.selectedPolygonId, selectedEdgeIndex: S.selectedEdgeIndex,
    polyUndo: S.polyUndo, polyRedo: S.polyRedo, polygonSeq: S.polygonSeq,
    spawnAuthority: S.spawnAuthority, teamOverrides: new Map(S.teamOverrides), selectedSpawn: S.selectedSpawn,
    spawnHistory: S.spawnHistory, spawnRedo: S.spawnRedo, history: S.history, redoHistory: S.redoHistory,
    randomResourceKeys: new Set(S.randomResourceKeys), importedDepth: S.importedDepth, nearResKeys: S.nearResKeys, mapShape: S.mapShape,
    mapRecipe: S.mapRecipe, // 3.19.0
    healthScore: health.score,
    // 3.19.0：地图级状态（只在 restoreAfterAbort 回滚半成品地图时使用，restoreEditorState 不写回这些字段）
    map: { source: S.source, snapshotEpoch: S.snapshotEpoch, tmxDirty: S.tmxDirty, unitsDirty: S.unitsDirty, slotVerified: S.slotVerified, step: S.step, view: { ...S.view }, engineSeq: Engine.seq }
  };
}
function restoreEditorState(k) {
  if (!k || !k.snapshot || S.snapshot !== k.snapshot || S.lastTmx !== k.lastTmx) return false;
  const { snapshot, lastTmx, healthScore, map, ...rest } = k;
  Object.assign(S, rest);
  S.spawnRev++; // 旧 Toast 上的「撤销」一律失效，避免与还原后的历史错位
  health.score = healthScore; health.sig = '';
  updatePolygonInfo(); updateUndoButtons(); updateSpawnUI(); scheduleRender();
  return true;
}
/* 3.19.0 修复（第十七轮审查 · 缺陷 1）：多步生成（大地图分 4 步 / 地形形态分 5 步）中途取消或失败时，前几步已经把
 * 「半成品」快照（例如只有海岸线、没有高度和出生点）换上了画布，但 TMX 还是上一张地图的。旧版 restoreEditorState
 * 发现快照已被替换就什么也不做，于是出现了「画布是半张新地图 + S.lastTmx 是旧地图 + 出生点为 0 + 导出按钮仍可用」
 * 的错配：此时导出，会把旧地图的 TMX 连同「0 个出生点」一起写出去（旧地图的出生点被全部抹掉）。
 * 现在按三种情况处理：
 *   ① 快照没被替换 → 与 3.17.0 相同，只还原编辑状态；
 *   ② 快照被替换、TMX 没变 → 说明只走完了前几步，整张回滚到生成前的地图（无旧地图时回到空白画布）；
 *   ③ 快照与 TMX 都换了 → 新地图已经完整生成（失败发生在收尾阶段），保留新地图，不回滚。
 * 引擎在这次操作中收到过新指令时（Engine.seq 变化），引擎内部状态已不再对应被还原的那张地图，
 * 把 snapshotEpoch 置为 -1，后续的地形分步编辑会给出明确提示，而不是在错误的引擎状态上继续操作。
 * 返回 'kept' | 'rolledback' | 'replaced' | 'none'。 */
function restoreAfterAbort(k) {
  if (!k) return 'none';
  const m = k.map || {}, touched = m.engineSeq != null && Engine.seq !== m.engineSeq;
  let how = 'kept';
  if (S.snapshot !== k.snapshot) {
    if (S.lastTmx !== k.lastTmx) return 'replaced';
    stopAnimation();
    S.snapshot = k.snapshot;
    how = 'rolledback';
  }
  if (!S.snapshot) {
    // 生成前本来就是空白画布：清掉半成品，回到空状态
    resetEditorState();
    S.source = null; S.tmxDirty = false; S.unitsDirty = false; S.slotVerified = null; S.step = m.step ?? 0;
    S.view = { zoom: 1, x: 0, y: 0, fitted: false };
    $('stats').textContent = '';
    $('emptyState').classList.remove('hide');
    $('mapPanel').classList.add('no-map');
    setExportEnabled(!!S.lastTmx); updateSteps(-1); updateSpawnUI(); updateDirtyNote(); scheduleRender();
    return how;
  }
  restoreEditorState(k);
  if (how === 'rolledback' || touched) {
    S.source = m.source ?? S.source;
    S.snapshotEpoch = touched ? -1 : (m.snapshotEpoch ?? S.snapshotEpoch);
    S.tmxDirty = !!m.tmxDirty; S.unitsDirty = !!m.unitsDirty; S.slotVerified = m.slotVerified ?? null;
  }
  if (how === 'rolledback') {
    S.step = m.step ?? S.step;
    if (m.view) S.view = { ...m.view };
    S.fadeStart = performance.now();
    $('emptyState').classList.add('hide');
    $('mapPanel').classList.remove('no-map');
    updateSteps(S.snapshot.meta?.completed_step ?? -1);
  }
  setExportEnabled(!!S.lastTmx); updateDirtyNote(); updateSpawnUI(); scheduleRender();
  return how;
}
/* ------------------------------------------------------------------ 生成保护与「找回上一张地图」（3.6.0 新增）
 * 旧版点「生成地图」（或 Ctrl+Enter / 手机悬浮按钮）会立刻覆盖当前地图：精心摆好的出生点、画好的墙体、多边形全部消失，
 * 自动保存的草稿也会在 1.5 秒后被新地图覆盖，等于无法找回。现在：
 *   ① 当前地图含手动编辑时先询问（只是连续「试生成」的未编辑地图不会打扰）；
 *   ② 生成前把当前 TMX 地图备份到 IndexedDB 的「previous」槽，生成完成的提示里带「找回上一张」按钮；
 *   ③ 「项目 / 恢复」里的「上一张地图 ⇄」按钮可来回切换（找回时会把当前地图换进备份槽）。
 * 注意：备份的是已生成的 TMX 地图；找回后按导入地图处理（出生点可编辑、可导出，地形不可再用引擎编辑）。 */
const hasManualWork = () => !!S.snapshot && (S.history.length > 0 || S.spawnHistory.length > 0 || S.polygons.length > 0 || (!!S.lastTmx && S.tmxDirty));
async function backupCurrent() {
  if (!S.lastTmx) return false;
  try {
    if (S.unitsDirty) await syncTmxUnits();
    await ProjectStore.put('previous', projectPayload());
    updatePrevButton(true);
    return true;
  } catch (e) { console.warn('备份当前地图失败', e); return false; }
}
function updatePrevButton(has) {
  const b = $('projectPrev'); if (!b) return;
  if (typeof has === 'boolean') { b.disabled = !has; return; }
  ProjectStore.get('previous').then(p => { b.disabled = !p?.tmx; }).catch(() => { b.disabled = true; });
}
async function restorePrevious() {
  await locked(async () => {
    try {
      const prev = await ProjectStore.get('previous').catch(() => null);
      if (!prev?.tmx) { toast('没有可找回的上一张地图'); updatePrevButton(false); return; }
      busy(true, '正在找回上一张地图…', '', null, { cancellable: false });
      let cur = null;
      if (S.lastTmx) { if (S.unitsDirty) await syncTmxUnits(); cur = projectPayload(); }
      await restoreProject(prev, '上一张地图');
      if (cur) await ProjectStore.put('previous', cur); else await ProjectStore.del('previous');
      updatePrevButton();
      queueAutoSave();
    } catch (e) { toast('找回失败：' + e.message, 'error'); }
    finally { busy(false); }
  });
}
/* 3.26.0 修复：导入 TMX 时会把文件名填进「地图名称」（方便原样导出）。旧版之后点「生成地图」得到的是一张全新的地图，
 * 导出时却仍叫导入的那个名字（如导入 rt.tmx → 新生成的地图也导出为 rt.tmx），在群里互传时很容易和原图混淆、
 * 甚至在导出目录里被当成同一张图。现在：名称仍是导入时代填的原值（用户没改过）时，新生成 / 择优采用后改回自动命名；
 * 用户自己改过名称则视为用户的选择，保持不动。 */
function releaseImportedName() {
  const n = S.importedName; S.importedName = null;
  if (!n || $('mapName').value !== n) return;
  $('mapName').value = ''; flashInput('mapName'); queuePrefs();
  toast(`新地图已改回自动命名（不再沿用导入文件的名称「${n}」）`, 'info', 3600);
}
async function generate() {
  if (!guard()) return;
  if (hasManualWork()) {
    const safe = !!S.lastTmx;
    const c = await uiChoice('重新生成地图？', `当前地图包含手动编辑（出生点 / 墙体 / 多边形等），重新生成会覆盖它们。<br>${safe ? '生成前会自动备份当前地图，之后可在「项目 / 恢复」里<b>找回上一张地图</b>。' : '这张地图尚未生成 TMX，<b>无法备份</b>，覆盖后不可找回。'}`,
      [{ key: 'cancel', label: '取消' }, { key: 'export', label: '先导出当前地图', hidden: !safe }, { key: 'go', label: safe ? '备份并重新生成' : '覆盖并重新生成', primary: safe, danger: !safe }].filter(b => !b.hidden));
    if (c === 'export') { await exportPair(); return; }
    if (c !== 'go') return;
  }
  return generateNow();
}
async function generateNow() {
  return locked(async () => {
    stopAnimation();
    normalizeParamInputs();
    const p = params(), area = p.width * p.height;
    stageCompare(); // 3.26.0：新旧对比——替换前先记下当前地图的摘要（成功才提交）
    const backedUp = await backupCurrent();
    const kept = captureEditorState(); // 3.17.0
    resetEditorState();
    S.mode === 'wizard' || (S.tool = 'pan');
    const t0 = performance.now();
    let shapeInfo = null;
    try {
      if (shapeActive()) {
        shapeInfo = await generateShapePipeline(p);
      } else if (area > LARGE_MAP_AREA) {
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
      S.mapRecipe = recipeFrom(p, S.mapShape); // 3.19.0：记下这张地图「生成时」的整套参数，配方码以它为准
      releaseImportedName(); commitCompare();
      const sec = ((performance.now() - t0) / 1000).toFixed(1);
      setStatus(`地图生成完成（${sec}s）`);
      if (shapeInfo) setStatus(`「${shapeInfo.label}」地图生成完成（${sec}s · 种子 ${shapeInfo.seed}${shapeSummary(shapeInfo.stats) ? ' · ' + shapeSummary(shapeInfo.stats) : ''}）`);
      toast(`${shapeInfo ? `「${shapeInfo.label}」` : ''}地图生成完成 · ${p.width}×${p.height} · 出生点 ${currentSpawns().length}${S.lastOptimized ? ` · 已自动优化布局（公平度 +${S.lastOptimized}）` : ''}`, 'success', 3400,
        cmp.prev ? { action: { label: '对比上一张', fn: () => showCompare() } } : backedUp ? { action: { label: '找回上一张', fn: () => restorePrevious() } } : {});
      S.lastOptimized = 0;
      pulseMap();
      pushHistorySnapshot('自动生成').catch(() => {}); // 3.11.0：每次生成自动入历史（失败仅记日志，不打断流程）
    } catch (e) {
      // 3.17.0：地图未被替换时还原队伍 / 撤销记录 / 近家资源标记 / 多边形 / 形态信息；
      // 3.19.0：多步生成只完成了前几步时，整张回滚到生成前的地图（见 restoreAfterAbort）
      const how = restoreAfterAbort(kept);
      if (how === 'rolledback') toast(kept.snapshot ? '生成未完成，已丢弃中间结果，画布恢复为生成前的地图' : '生成未完成，已丢弃中间结果', 'info', 4200);
      if (e.cancelled) { setStatus('已取消生成'); if (shapeActive() && how !== 'rolledback') toast('已取消生成，当前画布保持不变', 'info'); }
      else if (!/^操作失败/.test(statusRaw)) { setStatus('生成失败：' + e.message); toast('生成失败：' + e.message, 'error', 4200); }
    } finally { busy(false); }
  });
}
async function action(a, fromGlobal = false) {
  return locked(async () => {
    const p = params();
    if (a === 'run_coastline') {
      /* 3.18.0 修复：本分支与 generateNow() 一样会先 resetEditorState()，但旧版没有配套的 capture/restore。
       * 当引擎状态不可用（导入过 TMX，或引擎已重启导致快照失效）时，run() 会在真正调用引擎前抛错；
       * 形态模式下用户点忙碌条「取消」也会中断计算。这两条失败路径下画布与导出仍是旧地图，而手动指定的
       * 队伍、撤销/重做历史、多边形、近家资源标记、形态信息已被悄悄清空（实测：队伍被改回、撤销栈清空）。
       * 现在按 generateNow() 同款方式在失败/取消时还原 —— restoreEditorState 只在快照未被替换时生效。 */
      const kept = captureEditorState();
      resetEditorState(); setStep(0, false);
      if (shapeActive()) {
        try {
          const m = shapeMeta(shapeState.id), seed = shapeSeed();
          const r = await computeShape(p, seed, '1/1');
          const out = await importShapeToEngine(p, r, m);
          afterShapeGenerated(seed, r.stats);
          toast(`「${m.label}」形态已导入（种子 ${seed}${shapeSummary(r.stats) ? ' · ' + shapeSummary(r.stats) : ''}），下一步可绘制墙体或直接生成高度`, 'success', 4200);
          setStep(1);
          return out;
        } catch (e) {
          restoreAfterAbort(kept); // 3.19.0：同时恢复步骤与引擎可用性标记
          if (!e.cancelled && !(e instanceof EngineError)) toast('形态生成失败：' + e.message, 'error');
          return undefined;
        }
        finally { busy(false); }
      }
      try { return await run(a, p, '正在生成海岸线…'); }
      catch (e) { restoreAfterAbort(kept); throw e; }
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
    if (a === 'undo_cc') { if (S.spawnHistory.length) undoSpawn(false, true); else { const c = currentSpawns(); if (!c.length) { toast('没有可撤销的出生点'); return; } pushSpawnHistory(); const gone = c.pop(); S.teamOverrides.delete(keyOf(gone)); setSpawns(c); afterSpawnChange(); } return; }
    if (a === 'clear_cc') {
      if (!currentSpawns().length) return;
      pushSpawnHistory(); S.teamOverrides.clear(); setSpawns([]); afterSpawnChange();
      toast('已清空全部出生点', 'info', 5000, spawnUndoAction()); return;
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
/* 3.8.0 修复：地形形态 / 图片导入的高地保存在引擎的「多边形分层」深度矩阵里。旧版导入后界面仍停留在「画笔」模式：
 * 之后画的画笔墙体在完成地图时被引擎忽略（引擎处于多边形模式），而一旦切到画笔或新画一个多边形，导入的高地又会被
 * 静默清空。现在导入后界面自动切到多边形模式，并在这两种会替换导入高地的操作前先确认。 */
async function confirmReplaceImportedDepth(what) {
  const ok = await uiConfirm('替换导入的高地？', `当前地图的高地（悬崖与坡道）来自${S.mapShape ? `地形形态「${escapeHtml(S.mapShape.label)}」` : '图片导入'}。引擎会按多边形 / 画笔重新计算全部高地，${what}后这些高地将被替换，且无法撤销。`, '继续', true);
  if (ok) { S.importedDepth = false; toast(`可以开始${what === '绘制多边形' ? '点击地图绘制多边形' : '使用画笔'}了`, 'info'); }
  return ok;
}
function syncImportedDepthUI(snap) {
  const has = snap?.meta?.hill_drawing_mode === 'polygon' && !S.polygons.length;
  S.importedDepth = has;
  if (!has) return;
  S.hillMode = 'polygon';
  $('brushMode').classList.remove('active'); $('polygonMode').classList.add('active');
  $('brushControls').hidden = true; $('polygonControls').hidden = false;
  if (S.mode === 'wizard' && S.tool === 'brush') setTool('polygon', false);
  updatePolygonInfo();
}
const clonePolys = () => S.polygons.map(p => ({ ...p, vertices: p.vertices.map(v => [...v]), edgeGaps: [...(p.edgeGaps || [])] }));
function pushPolyUndo() { S.polyUndo.push(clonePolys()); if (S.polyUndo.length > 40) { S.polyUndo.shift(); dropOldestGlobal('polygon'); } S.polyRedo = []; pushGlobal('polygon'); }
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
    if (S.importedDepth) { confirmReplaceImportedDepth('绘制多边形'); return; }
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
/* 3.8.0：画布 / 小地图按地形模板（贴图主题）着色，与游戏内贴图一致 —— 旧版所有主题都画成「蓝水 + 绿地」，
 * 火山主题的「海」在游戏里其实是岩浆、沙漠主题的「海」是干涸的岩坑、雪山主题陆地全是冰雪，预览与成品差别很大。
 * water：[浅, 深] 两端颜色；land：高度层级色带。0 = 通用配色（导入地图等无法确定主题时）。 */
const THEME_PALETTES = {
  0: { water: [[46, 126, 190], [10, 40, 86]], shore: [30, 40, 30], land: LAND_STOPS },
  1: { water: [[46, 126, 190], [10, 40, 86]], shore: [30, 40, 30], land: [[0, [226, 196, 160]], [0.2, [70, 140, 60]], [0.45, [150, 110, 80]], [0.62, [112, 72, 48]], [0.78, [120, 120, 124]], [1, [228, 234, 240]]] },
  2: { water: [[52, 120, 200], [14, 40, 96]], shore: [40, 50, 40], land: [[0, [180, 196, 212]], [0.35, [214, 226, 238]], [0.7, [232, 240, 248]], [1, [250, 252, 255]]] },
  3: { water: [[214, 72, 34], [120, 24, 16]], shore: [40, 30, 0], land: [[0, [48, 44, 46]], [0.3, [74, 72, 76]], [0.55, [118, 116, 120]], [0.8, [168, 132, 106]], [1, [196, 160, 128]]] },
  4: { water: [[140, 102, 74], [84, 58, 44]], shore: [26, 20, 12], land: [[0, [222, 184, 146]], [0.65, [230, 194, 154]], [0.82, [84, 150, 70]], [1, [56, 112, 170]]] },
  5: { water: [[28, 84, 96], [8, 34, 44]], shore: [30, 40, 34], land: [[0, [150, 140, 116]], [0.22, [160, 150, 108]], [0.45, [80, 126, 66]], [0.66, [116, 158, 96]], [0.84, [112, 80, 58]], [1, [66, 48, 38]]] }
};
function paletteId(s = S.snapshot) {
  const p = Number(s?.meta?.pattern);
  return S.source === 'engine' && THEME_PALETTES[p] ? p : 0;
}
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
  const pid = paletteId(), pal = THEME_PALETTES[pid];
  const hit = baseCache.get(m); if (hit && hit.pid === pid) return hit.canvas;
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
      const q = clamp((Math.abs(v) + 1) / deep, 0, 1), [w0, w1] = pal.water;
      r = w0[0] + (w1[0] - w0[0]) * q; g = w0[1] + (w1[1] - w0[1]) * q; b = w0[2] + (w1[2] - w0[2]) * q;
      // 浅滩：紧邻陆地的水面提亮
      const x = i % W, y = (i / W) | 0;
      if ((x > 0 && sm.data[i - 1] > 0) || (x < W - 1 && sm.data[i + 1] > 0) || (y > 0 && sm.data[i - W] > 0) || (y < sm.rows - 1 && sm.data[i + W] > 0)) { r += pal.shore[0]; g += pal.shore[1]; b += pal.shore[2]; }
    } else {
      [r, g, b] = lerpStops(pal.land, clamp((v - 1) / landSpan, 0, 1));
      const x = i % W, y = (i / W) | 0;
      if (x > 0 && y > 0) {
        const nw = sm.data[i - W - 1];
        if (v > nw) { r *= 1.14; g *= 1.14; b *= 1.14; } else if (v < nw) { r *= 0.8; g *= 0.8; b *= 0.8; }
      }
    }
    d[i * 4] = r; d[i * 4 + 1] = g; d[i * 4 + 2] = b; d[i * 4 + 3] = 255;
  }
  oc.putImageData(img, 0, 0);
  baseCache.set(m, { pid, canvas: off });
  return off;
}
/** 3.7.0：墙体图层来源 —— 画笔 / 多边形用 wall_matrix；没有 wall_matrix 时（导入地图）显示 TMX 中读取的悬崖 */
const wallComposite = new WeakMap();
function wallLayerFor(s = S.snapshot) {
  const wm = getMatrix('wall_matrix', s), cm = getMatrix('cliff_mask', s);
  if (wm?.data) {
    const poly = s?.meta?.hill_drawing_mode === 'polygon', c = wallCanvasFor(wm, poly ? 'polygon' : 'brush');
    // 3.8.0：多边形 / 地形形态地图在生成 TMX 后叠加真实悬崖线（旧版只显示半透明的高地范围，看不出悬崖与坡道的位置）
    if (poly && c && cm?.count) {
      const hit = wallComposite.get(cm); if (hit?.base === c) return hit.canvas;
      const cl = wallCanvasFor(cm, 'cliff'); if (!cl) return c;
      const off = document.createElement('canvas'); off.width = c.width; off.height = c.height;
      const oc = off.getContext('2d'); oc.drawImage(c, 0, 0); oc.drawImage(cl, 0, 0, c.width, c.height);
      wallComposite.set(cm, { base: c, canvas: off });
      return off;
    }
    if (c || poly) return c;
  }
  return cm?.count ? wallCanvasFor(cm, 'cliff') : null;
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
let canvasClear = false; // 3.16.0：动态主题下画布透明清屏，露出下面的 .theme-fx 背景图层（地图本身仍铺 canvasBg 底色，见 drawFrame）
function paintBackground(ctx, w, h) {
  if (canvasClear) { ctx.clearRect(0, 0, w, h); return; }
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
function drawResources(ctx, positions, now = performance.now()) {
  const z = S.view.zoom, s0 = clamp(z * 1.3, 3, 9);
  ctx.save();
  ctx.lineWidth = 1.4; ctx.strokeStyle = 'rgba(6,40,26,.85)';
  let animating = false;
  for (const [r, c] of positions || []) {
    const [x, y] = toScreen(r, c);
    const isNear = S.nearResKeys.has(keyOf([r, c]));
    let s = s0, dy = 0, alpha = 1;
    // 3.9.0：近家资源点新放置时的「掉落」动效——从上方淡入落下，380ms ease-out
    const t0 = resPop.get(keyOf([r, c]));
    if (t0 !== undefined) {
      const k = (now - t0) / 380;
      if (k >= 1) resPop.delete(keyOf([r, c]));
      else { const e = 1 - Math.pow(1 - k, 3); dy = (1 - e) * -14; alpha = e; animating = true; }
    }
    ctx.globalAlpha = alpha;
    ctx.fillStyle = isNear ? '#7cf0c0' : '#55e6a5';
    ctx.beginPath(); ctx.moveTo(x, y - s + dy); ctx.lineTo(x + s, y + dy); ctx.lineTo(x, y + s + dy); ctx.lineTo(x - s, y + dy); ctx.closePath();
    ctx.fill(); ctx.stroke();
    if (isNear && z > 1.4) { // 近家资源点加一圈细描边，和引擎随机放置的区分开（纯视觉提示，不影响导出）
      ctx.save(); ctx.globalAlpha = alpha * 0.85; ctx.strokeStyle = 'rgba(55,211,155,.9)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(x, y + dy, s + 3, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    }
  }
  ctx.globalAlpha = 1;
  ctx.restore();
  return animating;
}
/* 3.9.0：选中出生点时，画出它的「近家资源范围」10–20 格圈——内圈=最小距离、外圈=最大距离，中间环带呼吸发光，
 * 提示「资源点会落在这个环带里」。纯提示性图层，不影响任何判定逻辑。 */
function drawNearResRange(ctx, now) {
  if (!S.layers.nearRes || S.selectedSpawn < 0 || !S.nearRes.enabled) return false;
  const p = currentSpawns(); if (S.selectedSpawn >= p.length) return false;
  const [x, y] = toScreen(...p[S.selectedSpawn]), z = S.view.zoom;
  const rMin = S.nearRes.min * z, rMax = S.nearRes.max * z;
  if (rMax < 8) return false; // 缩得太小时圈挤在一起，不画，避免糊成一团
  const pulse = 0.5 + 0.5 * Math.sin(now / 900);
  ctx.save();
  ctx.beginPath(); ctx.arc(x, y, rMax, 0, Math.PI * 2); ctx.arc(x, y, rMin, 0, Math.PI * 2, true);
  ctx.fillStyle = `rgba(55,211,155,${0.05 + 0.04 * pulse})`; ctx.fill('evenodd');
  ctx.setLineDash([6, 5]); ctx.lineDashOffset = -(now / 60) % 11;
  ctx.strokeStyle = `rgba(55,211,155,${0.55 + 0.25 * pulse})`; ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.arc(x, y, rMin, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(x, y, rMax, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
  return true;
}
function spawnRadius() { return clamp(S.view.zoom * 1.8, 6, 13); }
function drawSpawns(ctx, now) {
  let p = currentSpawns(); if (!p.length) return false;
  const R0 = spawnRadius();
  let animating = false;
  const tw = spawnTweenPositions(p); if (tw) { p = tw; animating = true; } // 3.20.0：公平度微调的移动补间
  ctx.save();
  // 3.3.0：选中出生点时画出它的对位玩家（交替模式下 1↔2、3↔4…）连线，直观检查镜像对手是否正确
  const sel = S.selectedSpawn;
  if (sel >= 0 && sel < p.length && $('slotOrder').value === 'alternate' && !isFFA()) { // 3.20.0：FFA 没有「对位玩家」
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
    ctx.lineWidth = 2.2; ctx.strokeStyle = teamColor(team); ctx.stroke();
    if (R >= 6) { ctx.fillStyle = '#3a2600'; ctx.fillText(String(i + 1), x, y + 0.5); }
  });
  // 选中点标签：玩家号 / team / 队伍
  if (sel >= 0 && sel < p.length) {
    const rt = S.layers.routes ? routeCache?.routes?.find(r => r.i === sel) : null;
    const [x, y] = toScreen(...p[sel]), label = `玩家 ${sel + 1} · team ${sel} · ${teamLabel(teamOf(p[sel], sel))}${rt ? ` · 接敌 ${Math.round(rt.d)} 格` : ''}`;
    ctx.font = '600 11px system-ui,sans-serif';
    const w = ctx.measureText(label).width + 14, h = 20, bx = x - w / 2, by = y - R0 - h - 8;
    ctx.fillStyle = 'rgba(10,16,28,.86)'; ctx.strokeStyle = teamColor(teamOf(p[sel], sel)); ctx.lineWidth = 1.2;
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
    if (S.layers.walls) drawImageLayer(ctx, wallLayerFor(), rows, cols, fadeK);
    let terrAnim = false;
    if (S.layers.territory) terrAnim = drawTerritory(ctx, rows, cols, fadeK);   // 3.6.0 领地图层
    if (S.layers.routes) drawRoutes(ctx, now);                                  // 3.7.0 接敌路线
    let symAnim = false;
    if (S.layers.symmetry) symAnim = drawSymmetry(ctx, rows, cols, fadeK);       // 3.19.0 对称检查
    const spotsPulse = S.layers.spots && drawSpots(ctx, rows, cols, now, fadeK);  // 3.20.0 落点热力（准星呼吸走下面 50ms 的节流循环，不占满帧率）
    drawGrid(ctx, rows, cols);
    drawPolygons(ctx);
    const nearRingShown = drawNearResRange(ctx, now);
    let resAnimating = false;
    if (S.layers.resources) resAnimating = drawResources(ctx, S.snapshot.resource_positions, now);
    drawBrushPreview(ctx);
    let popping = false;
    if (S.layers.spawns) { popping = drawSpawns(ctx, now); drawDragGhost(ctx); }
    drawHover(ctx);
    drawMeasure(ctx);
    drawProfileCursor(ctx); // 3.15.0：地形剖面光标
    drawLoupe(); // 3.17.0：触屏放大镜（复制本帧画面，必须在所有图层画完之后）
    if (fadeK < 1 || popping || terrAnim || resAnimating || symAnim) scheduleRender(); else if (fadeK >= 1) S.fadeStart = 0;
    // 3.2.0：选中光环的循环重绘在页面不可见（App 切到后台）时暂停，避免持续耗电
    const routesAnim = S.layers.routes && S.animate && routeCache?.routes?.length;
    if (((S.selectedSpawn >= 0 && S.layers.spawns) || routesAnim || nearRingShown || spotsPulse) && !document.hidden) { clearTimeout(pulseLoop); pulseLoop = setTimeout(scheduleRender, routesAnim && S.selectedSpawn < 0 ? 66 : 50); }
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
    ctx.fillStyle = '#ffd45c'; ctx.fill(); ctx.lineWidth = 1.2; ctx.strokeStyle = teamColor(teamOf(q, i)); ctx.stroke();
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
  if (fromUser && measure.on) setMeasure(false, { quiet: true }); // 3.14.0：选了别的工具就退出测距
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

/* ------------------------------------------------------------------ 测距工具（3.14.0 新增，快捷键 U）
 * 做图时经常要回答「这两个点到底多远」：近家资源是否在 10～20 格内、两个基地之间要走多远、绕路多不多。
 * 以前只能数格子。这里在画布上点两个点（或按住拖出一条线）即可得到：
 *   · 直线距离（格）；
 *   · 步行距离（格）：复用体检的通行网格与 8 邻接最短路（斜行 ×1.4，遇墙 / 悬崖 / 水域绕行），并画出实际走法；
 *   · 绕路比例：步行比直线多走了百分之多少；陆路不通时直接标「陆路不通」。
 * 点到出生点（16px 内）会自动吸附并显示玩家编号，资源点同理。再点一次空白处开始新的一次测量。 */
const measure = { on: false, a: null, b: null, walk: null, path: null, blocked: false, straight: 0, snap: 0, final: false }; // 3.15.0：final = 已完成一次测量（显示地形剖面）
let measureGridCache = null;
function measureGridFor() {
  const sn = S.snapshot; if (!sn) return null;
  const key = snapId(sn) + (getMatrix('cliff_mask', sn) ? 'c' : '');
  if (measureGridCache?.key === key) return measureGridCache.g;
  const g = buildGrid(sn, 420);
  measureGridCache = { key, g };
  return g;
}
/** 把屏幕点吸附到附近的出生点 / 资源点，返回 { r, c, label } */
function snapMeasurePoint(cell) {
  const rad = 16 / Math.max(S.view.zoom, 0.05);
  if (S.layers.spawns) {
    const sp = currentSpawns(); let best = -1, bd = rad;
    sp.forEach((q, i) => { const d = Math.hypot(q[0] - cell.row, q[1] - cell.col); if (d <= bd) { bd = d; best = i; } });
    if (best >= 0) return { r: sp[best][0], c: sp[best][1], label: `玩家 ${best + 1}` };
  }
  if (S.layers.resources) {
    let best = null, bd = Math.min(rad, 3);
    for (const q of S.snapshot?.resource_positions || []) { const d = Math.hypot(q[0] - cell.row, q[1] - cell.col); if (d <= bd) { bd = d; best = q; } }
    if (best) return { r: best[0], c: best[1], label: '资源点' };
  }
  return { r: cell.row, c: cell.col, label: '' };
}
function computeMeasure() {
  const m = measure; m.walk = null; m.path = null; m.blocked = false;
  if (!m.a || !m.b) return;
  m.straight = Math.hypot(m.a.r - m.b.r, m.a.c - m.b.c);
  const g = measureGridFor(); if (!g) return;
  const ka = snapToGrid(g, m.a.r, m.a.c), kb = snapToGrid(g, m.b.r, m.b.c);
  if (ka < 0 || kb < 0) { m.blocked = true; return; }
  const dist = costField(g, [ka]);
  if (dist[kb] === PATH_INF) { m.blocked = true; return; }
  m.walk = dist[kb] / 10 * g.scale;
  const pts = simplifyPath(g, tracePath(g, dist, kb));
  if (pts.length) { pts[0] = [m.b.r, m.b.c]; pts[pts.length - 1] = [m.a.r, m.a.c]; }
  m.path = pts;
}
function measureText() {
  const m = measure; if (!m.a || !m.b) return '';
  const names = m.a.label || m.b.label ? `${m.a.label || '起点'} → ${m.b.label || '终点'}：` : '';
  const walk = m.walk != null ? ` · 步行 ${Math.round(m.walk)} 格${m.walk > m.straight * 1.05 && m.straight > 0 ? `（绕路 +${Math.round((m.walk / m.straight - 1) * 100)}%）` : ''}` : m.blocked ? ' · 陆路不通' : '';
  return `${names}直线 ${m.straight.toFixed(1)} 格${walk}`;
}
function clearMeasurePoints() { measure.a = measure.b = measure.walk = measure.path = null; measure.blocked = false; measure.final = false; profileHover.t = -1; renderProfile(); }
function setMeasure(on, { quiet = false } = {}) {
  on = !!on && !!S.snapshot;
  if (measure.on === on) { if (!on) clearMeasurePoints(); return; }
  measure.on = on;
  if (!on) renderProfile();
  measure.snap = on ? snapId(S.snapshot) : 0; // 必须在开启时就记下当前快照：drawMeasure 以它判断「地图是否换了」，初始 0 会把第一帧渲染前的首个点误清除
  if (!on) clearMeasurePoints();
  const b = $('measureBtn'); if (b) { b.classList.toggle('active', on); b.setAttribute('aria-pressed', String(on)); }
  $('mapPanel').classList.toggle('measuring', on);
  if (on) {
    if (S.tool !== 'pan') setTool('pan', false);
    $('legendTip').innerHTML = '<b>测距</b>：依次点两个点，或按住拖出一条线 · 点出生点 / 资源点自动吸附 · <b>Esc</b> 退出';
    // 3.14.0：不用 Toast 提示——提示条盖在画布上沿，会吞掉用户开启后的第一下点击；底部提示条与状态栏已足够
    if (!quiet) setStatus('测距已开启：点两个点（或拖动画线），可量直线与步行距离');
  } else {
    $('legendTip').innerHTML = TOOL_TIPS[S.tool] || TOOL_TIPS.pan;
    if (!quiet) setStatus('已退出测距');
  }
  scheduleRender();
}
function measureTap(cell) {
  const pt = snapMeasurePoint(cell), m = measure;
  m.snap = snapId(S.snapshot);
  if (!m.a || (m.a && m.b)) { clearMeasurePoints(); m.a = pt; }
  else { m.b = pt; computeMeasure(); m.final = true; setStatus(measureText()); renderProfile(); }
  scheduleRender();
}
function measureDragTo(start, cell, final) {
  const m = measure;
  m.snap = snapId(S.snapshot);
  m.a = start; m.b = snapMeasurePoint(cell); m.final = !!final;
  if (final) { computeMeasure(); setStatus(measureText()); renderProfile(); }
  else { m.straight = Math.hypot(m.a.r - m.b.r, m.a.c - m.b.c); m.walk = null; m.path = null; m.blocked = false; }
  scheduleRender();
}
function drawMeasure(ctx) {
  const m = measure; if (!S.snapshot || (!m.on && !m.a)) return;
  const sid = snapId(S.snapshot);
  if (m.snap !== sid) { if (m.a) clearMeasurePoints(); m.snap = sid; }
  if (!m.a) return;
  const z = S.view.zoom, [ax, ay] = toScreen(m.a.r, m.a.c);
  ctx.save(); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const dot = (x, y, ch, col) => {
    ctx.beginPath(); ctx.arc(x, y, 8, 0, Math.PI * 2); ctx.fillStyle = col; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke();
    ctx.fillStyle = '#0b1220'; ctx.font = '800 10px system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(ch, x, y + 0.5);
  };
  const chip = (x, y, lines, accents) => {
    ctx.font = '700 12px system-ui,sans-serif';
    const tw = Math.max(...lines.map(t => ctx.measureText(t).width)) + 18, th = lines.length * 17 + 8;
    const rx = clamp(x - tw / 2, 6, Math.max(6, ctx.canvas.clientWidth - tw - 6)), ry = clamp(y - th - 12, 6, Math.max(6, ctx.canvas.clientHeight - th - 6));
    ctx.fillStyle = 'rgba(10,16,28,.9)'; ctx.strokeStyle = 'rgba(255,255,255,.28)'; ctx.lineWidth = 1;
    ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(rx, ry, tw, th, 10); else ctx.rect(rx, ry, tw, th); ctx.fill(); ctx.stroke();
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    lines.forEach((t, i) => { ctx.fillStyle = accents[i] || '#fff'; ctx.fillText(t, rx + 9, ry + 4 + 8.5 + i * 17); });
  };
  if (!m.b) {
    // 只有起点：脉冲环提示再点一下
    const ph = (performance.now() % 1200) / 1200;
    ctx.beginPath(); ctx.arc(ax, ay, 8 + ph * 14, 0, Math.PI * 2); ctx.strokeStyle = `rgba(255,212,92,${(1 - ph) * 0.8})`; ctx.lineWidth = 2; ctx.stroke();
    dot(ax, ay, 'A', '#ffd45c');
    chip(ax, ay, [m.a.label ? `${m.a.label} · 再点一个点` : '再点一个点'], ['#ffd45c']);
    ctx.restore();
    if (!document.hidden) { clearTimeout(pulseLoop); pulseLoop = setTimeout(scheduleRender, 50); }
    return;
  }
  const [bx, by] = toScreen(m.b.r, m.b.c);
  if (m.path && m.path.length > 1) {
    ctx.beginPath(); m.path.forEach(([r, c], i) => { const [x, y] = toScreen(r, c); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
    ctx.setLineDash([]); ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.lineWidth = 6; ctx.stroke();
    ctx.strokeStyle = '#ffd45c'; ctx.lineWidth = 3; ctx.stroke();
  }
  ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by);
  ctx.setLineDash([7, 6]); ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.lineWidth = 3.6; ctx.stroke();
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.8; ctx.stroke(); ctx.setLineDash([]);
  dot(ax, ay, 'A', '#ffd45c'); dot(bx, by, 'B', '#55e6a5');
  const lines = [`直线 ${m.straight.toFixed(1)} 格`], acc = ['#ffffff'];
  if (m.walk != null) { lines.push(`步行 ${Math.round(m.walk)} 格${m.walk > m.straight * 1.05 && m.straight > 0 ? ` · 绕路 +${Math.round((m.walk / m.straight - 1) * 100)}%` : ''}`); acc.push('#ffd45c'); }
  else if (m.blocked) { lines.push('陆路不通'); acc.push('#ff8a8a'); }
  chip((ax + bx) / 2, (ay + by) / 2, lines, acc);
  ctx.restore();
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
  if (measure.on && validCell(cell)) { g.type = 'measure'; g.start = snapMeasurePoint(cell); return g; }
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
  // 3.17.0 修复：测距模式下右键点到出生点会直接把它删掉；现在右键 / 长按只清除测量
  if (measure.on) { if (measure.a) { clearMeasurePoints(); setStatus('已清除测量'); scheduleRender(); } return; }
  if (!validCell(cell)) return;
  if (S.tool === 'polygon') { selectPolygon(cell); return; }
  if (S.tool === 'resource') { await removeResourceAt(cell); return; }
  if (S.layers.spawns && removeSpawnAt(cell)) return;
  // 3.9.0：导入的地图补齐近家资源后 S.source 仍是 'import'，这里放宽条件，只要附近有资源点（引擎放置的，
  // 或是近家功能新增的）就允许在平移工具下长按删除，而不再要求必须是引擎生成的地图。
  if (S.tool === 'pan' && (S.source === 'engine' || S.nearResKeys.size) && (S.snapshot?.resource_positions || []).some(q => Math.max(Math.abs(q[0] - cell.row), Math.abs(q[1] - cell.col)) <= 3)) { await removeResourceAt(cell); return; }
  toast('附近没有可删除的对象（请在出生点/资源点 3 格内操作）');
}
async function removeResourceAt(cell) {
  if (!guard()) return;
  const near = (S.snapshot?.resource_positions || []).filter(q => Math.max(Math.abs(q[0] - cell.row), Math.abs(q[1] - cell.col)) <= 3);
  if (!near.length) { toast('附近没有资源点（3 格内）'); return; }
  // 3.9.0：近家资源点是 JS 侧管理的，引擎并不知道它们存在，remove_resource_manual 这个引擎 RPC 对它们无效，
  // 必须单独路由。优先处理离点击位置最近的一个（通常也就是用户想删的那个）。
  const nearJs = near.filter(q => S.nearResKeys.has(keyOf(q)));
  // 3.15.0：加锁执行。旧版在 await 写回 TMX 期间不加锁，用户此时点「生成」，删除补丁会被重做到新地图上（见 mutateTmx）
  if (nearJs.length) { await locked(() => removeNearSpawnResourceAt(nearJs[0])); return; }
  if (!engineStateUsable('remove_resource_manual')) return;
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
    case 'measure':
      if (g.moved && validCell(cell)) measureDragTo(g.start, cell, true);
      else if (!g.moved && validCell(cell)) measureTap(cell);
      else scheduleRender();
      return;
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
      hideLoupe();
      scheduleRender();
      return;
    }
    if (pointers.size > 2) return;
    drag = beginGesture(e);
    if (drag.touch && drag.type !== 'paint' && drag.type !== 'measure') {
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
    } else if (g.type === 'measure') {
      if (g.moved && validCell(cell)) measureDragTo(g.start, cell, false);
    } else if (g.type === 'spawn') {
      if (g.moved && validCell(cell)) { g.target = { row: cell.row, col: cell.col }; scheduleRender(); }
    } else if (g.moved && g.type !== 'context') {
      S.view.x += e.clientX - g.lx; S.view.y += e.clientY - g.ly; S.view.fitted = false;
      scheduleRender();
    }
    g.lx = e.clientX; g.ly = e.clientY;
    updateLoupe(g, e); // 3.17.0
  });
  const up = e => {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    hideLoupe(); // 3.17.0
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
  /* 3.18.0 修复：team 取自 TMX 瓦片属性，buildCcMap 只校验了「非负整数」，没有上限。旧实现按 maxT 线性
   * 枚举缺号，遇到损坏/恶意数据（team="1000000000"）会循环十亿次并生成同量级数组，主线程直接卡死甚至 OOM。
   * 队伍号合法范围为 0..MAX_SPAWN_POINTS-1，把枚举上界钉在该范围即可（合法地图的 maxT 远小于此，行为不变）。 */
  const maxT = Math.min(MAX_SPAWN_POINTS - 1, Math.max(-1, ...teams));
  const gaps = []; for (let t = 0; t <= maxT; t++) if (!seen.has(t)) gaps.push(t);
  return { list, gaps, dups: [...dups], unknown: teams.filter(t => t < 0).length };
}
/** 3.8.0：从内嵌瓦片集读取资源池瓦片 GID（属性 res_pool）与悬崖瓦片集 GID 区间
 * 3.9.0 修复：旧实现自己用一条正则 /<tile\b[^>]*\bid="(\d+)"[^>]*>([\s\S]*?)<\/tile>/g 扫描瓦片集里的 <tile> 元素，
 * 没有处理「自闭合的 <tile id=".." .../>」——本工具内置瓦片集里资源池前面恰好有好几个这种自闭合 <tile> 标签
 * （只带 terrain 属性，没有 properties，Tiled 省略了闭合写法）。这条正则遇到自闭合标签时不会跳过，而是把
 * [^>]* 一路吃到标签末尾的 "/"，再找「最近的下一个 </tile>」——结果找到的其实是后面某个不相关的 <tile> 的
 * 闭合标签，把它的大段内容和前面自闭合标签的 id 错误拼在一起，于是「谁是 id」和「res_pool 属性在不在」对不上号。
 * 实测：firstgid=1、真正带 res_pool 的是 id=11（GID 12），这个旧实现却返回 GID 1（id=0，资源池左上角那格，
 * 碰巧本身也在每个资源池的 3×3 里，所以「识别资源点」这个具体场景里长期没有现出明显症状，但它并不是设计要
 * 检查的那个瓦片，一旦某个不相关的物件也用到 GID 1，就会被误判成资源点）。
 * 现在复用已经正确处理自闭合标签的 parseTilesets()（3.3.0 起一直在给指挥中心槽位映射用，经过验证），
 * 不再自己写一遍容易出错的瓦片级正则。 */
function itemTileInfo(xml) {
  const resGids = new Set(), cliffRange = [];
  for (const ts of parseTilesets(xml)) {
    if (!ts.firstgid) continue;
    if (/cliff/i.test(ts.name || '')) cliffRange.push([ts.firstgid, ts.firstgid + (ts.tilecount || 64)]);
    for (const [id, props] of ts.tiles) if ('res_pool' in props) resGids.add(ts.firstgid + id);
  }
  return { resGids, cliffRange };
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
  /* 3.8.0 修复：旧版把 Items 图层里「任何非空瓦片的连通块」都算作资源点 —— 悬崖、墙体、石块也被计入
   * （迷宫 / 高地地图导出后再导入，12 个资源被识别成 26 个），公平度与体检里的资源平衡随之失真；
   * 「找回上一张地图」走的也是这条路径。现在：只有包含资源池瓦片（瓦片属性 res_pool）的连通块才算资源点，
   * 悬崖瓦片集（名称含 cliff）一律排除；TMX 未声明 res_pool（外部瓦片集等）时退回旧规则但仍排除悬崖。 */
  const { resGids, cliffRange } = itemTileInfo(xml);
  const isCliffGid = g => cliffRange.some(([a, b]) => g >= a && g < b);
  const items = itemsRaw ? Int32Array.from(itemsRaw, v => { const g = v & 0x1fffffff; return g && !isCliffGid(g) ? 1 : 0; }) : new Int32Array(rows * cols);
  let resources = components(items, rows, cols);
  if (itemsRaw && resGids.size) {
    resources = resources.filter(([r, c]) => {
      for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) {
        const y = r + dr, x = c + dc;
        if (y >= 0 && x >= 0 && y < rows && x < cols && resGids.has(itemsRaw[y * cols + x] & 0x1fffffff)) return true;
      }
      return false;
    });
  }
  const unitsRaw = layerOf('Units');
  const spawns = readSpawnSlots(unitsRaw, cols, cc);
  return {
    rows, cols, height, items, resources,
    positions: spawns.list.slice(0, MAX_SPAWN_POINTS).map(x => x.p),
    slots: spawns, ccSource: cc.source,
    mirroring: detectSymmetry(height, rows, cols), approximate: unknown > height.length * 0.4
  };
}
async function loadTmxBytes(bytes, name, { fromProject = false } = {}) {
  stageCompare(); // 3.26.0：导入 / 恢复项目 / 找回上一张 / 恢复历史版本都经过这里：替换前记下摘要，替换成功再提交
  const t = await parseTmx(bytes);
  // 3.7.0：读取悬崖 / 水域瓦片属性 —— 导入地图也能显示悬崖、精确体检；非标准瓦片地图用 water 属性修正水域
  let mk = null;
  try { mk = await tmxTerrainMasks(bytes); } catch (e) { console.warn('读取悬崖 / 水域瓦片失败', e); }
  if (mk && (mk.rows !== t.rows || mk.cols !== t.cols)) mk = null;
  if (mk && t.approximate && mk.nWater) { for (let i = 0; i < t.height.length; i++) if (mk.water[i]) t.height[i] = 0; t.mirroring = detectSymmetry(t.height, t.rows, t.cols); }
  resetEditorState();
  S.source = 'import';
  S.snapshotEpoch = -1;
  const snap = {
    meta: { height: t.rows, width: t.cols, mirroring: t.mirroring, num_command_centers: t.positions.length, num_resource_pulls: t.resources.length, completed_step: 5, current_step: 5, hill_drawing_mode: 'brush' },
    cc_positions: t.positions, resource_positions: t.resources,
    matrices: { height_map: { shape: [t.rows, t.cols], data: t.height }, items_matrix: { shape: [t.rows, t.cols], data: t.items },
      ...(mk ? { cliff_mask: { shape: [t.rows, t.cols], data: mk.cliff, count: mk.nCliff } } : {}) }
  };
  t.cliffs = mk?.nCliff || 0;
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
    S.importedName = $('mapName').value || null; // 3.26.0：记下「导入时代填」的名称，之后新生成的地图不再沿用（见 releaseImportedName）
    updateMirrorHint();
  } else S.importedName = null; // 项目自带的名称是用户起的，不属于「导入代填」
  setExportEnabled(true);
  S.view.fitted = false;
  setSnapshot(snap, { fit: true, fade: true });
  commitCompare();
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
      if (t.cliffs) setStatus(`TMX 导入完成：${t.cols} × ${t.rows} · 出生点 ${t.positions.length} · 资源 ${t.resources.length} · 悬崖 ${t.cliffs} 格`);
      if (t.slotIssues) {
        const si = t.slotIssues, parts = [];
        if (si.gaps.length) parts.push(`缺少玩家 ${si.gaps.slice(0, 6).map(x => x + 1).join('、')}${si.gaps.length > 6 ? '…' : ''}`);
        if (si.dups.length) parts.push(`玩家 ${si.dups.slice(0, 6).map(x => x + 1).join('、')} 重复`);
        if (si.unknown) parts.push(`${si.unknown} 个指挥中心无 team 属性`);
        toast(`该 TMX 的出生点槽位不连续（${parts.join('；')}），已按 team 顺序重新编号，导出时会写成连续槽位`, 'warn', 6500);
      }
      queueAutoSave();
      pushHistorySnapshot('导入').catch(() => {}); // 3.11.0：导入的地图也入历史，方便回溯
    } catch (e) { toast('TMX 导入失败：' + e.message, 'error', 4200); setStatus('TMX 导入失败：' + e.message); }
    finally { busy(false); $('tmxFile').value = ''; }
  });
}

/* ------------------------------------------------------------------ TMX：Units 图层修补
 * 只替换出生点 GID（保留图层中其他单位）。出生点 i 写入「team 属性 = i」的那个 GID（见 buildCcMap）。
 * 3.3.0 修复：旧版按「firstgid + 序号」写入，与瓦片 team 属性不一致，导致出生点序号 ↔ 游戏玩家映射错乱。
 */
/** 3.9.0：从 TMX 自带的瓦片集里找到带 res_pool 属性的瓦片，推出它所在的 3×3 资源池 GID 块（见上面 itemTileInfo
 * 的说明——这里同样复用 parseTilesets()，不用容易被自闭合 <tile> 标签搞错位的手写正则）。不写死具体数值——
 * 不同模板（tileset 1~5）的 firstgid 可能不同，这里按「该瓦片的 firstgid + 本地 id」加减瓦片集的 columns
 * 算出上下左右 8 个邻居的 GID，兼容任何模板，只要素材本身仍是 3×3 的九宫格资源池贴图。 */
function resourcePoolGids(xml) {
  for (const ts of parseTilesets(xml)) {
    if (!ts.firstgid || !ts.columns) continue;
    for (const [id, props] of ts.tiles) {
      if (!('res_pool' in props)) continue;
      const block = [];
      for (let dr = -1; dr <= 1; dr++) { const row = []; for (let dc = -1; dc <= 1; dc++) row.push(ts.firstgid + id + dr * ts.columns + dc); block.push(row); }
      return block;
    }
  }
  return null;
}
/* 3.9.0：把「按图层名查找 / 解码」从 Units 专用改为通用（新增 Items 图层的近家资源修补复用同一套逻辑） */
function findLayerByName(xml, name) {
  const re = /<layer\b[^>]*>/g; let m, want = String(name).toLowerCase();
  while ((m = re.exec(xml))) { const a = xmlAttrs(m[0]); if (String(a.name || '').toLowerCase() === want) return { m, attrs: a }; }
  return null;
}
async function readLayerByName(xml, name) {
  const hit = findLayerByName(xml, name); if (!hit) return null;
  const mapA = xmlAttrs(xml.match(/<map\b[^>]*>/)[0]);
  const cols = Number(mapA.width), rows = Number(mapA.height);
  const dataStart = xml.indexOf('<data', hit.m.index), tagEnd = dataStart < 0 ? -1 : xml.indexOf('>', dataStart), dataEnd = tagEnd < 0 ? -1 : xml.indexOf('</data>', tagEnd);
  if (dataStart < 0 || tagEnd < 0 || dataEnd < 0) return null;
  const da = xmlAttrs(xml.slice(dataStart, tagEnd + 1));
  if (/<chunk/.test(xml.slice(tagEnd, dataEnd))) throw new Error('不支持分块（chunk）图层');
  const cells = await decodeLayerData(da, xml.slice(tagEnd + 1, dataEnd).trim(), rows * cols);
  return { cells, rows, cols, da, tagEnd, dataEnd };
}
function findUnitsLayer(xml) { return findLayerByName(xml, 'units'); }
async function readUnitsLayer(xml) {
  const r = await readLayerByName(xml, 'units'); if (!r) return null;
  return { units: r.cells, rows: r.rows, cols: r.cols, da: r.da, tagEnd: r.tagEnd, dataEnd: r.dataEnd };
}
/* 3.19.0：出生点上限 50 → 100。内置蓝图（以及引擎生成的 TMX）只带一个 50 格的「50pCommandCenter」瓦片集，team 0～49。
 * 出生点超过现有槽位时，在所有瓦片集之后追加该瓦片集的副本：firstgid 取当前最大 GID 之后的空位，名称加 _ext 后缀，
 * 贴图（embedded_png）原样复用，每个瓦片的 team 属性整体加上偏移量（第一份副本即 team 50～99）。
 * 新瓦片集只追加在末尾、firstgid 最大，不会改变任何已有瓦片的 GID，旧地图数据完全不受影响；
 * 槽位映射 buildCcMap 本来就合并所有瓦片集里带 unit=commandCenter + team 的瓦片，因此映射表 / 读回校验 / 导入都自动识别。
 * 主瓦片集是外部 .tsx 或缺少 team 属性时无法安全复制，返回原文（调用方仍按原容量截断并提示）。 */
function extendCcTileset(xml, need) {
  const head = tmxHeadXml(xml), cc = buildCcMap(head);
  need = Math.min(need, MAX_SPAWN_POINTS);
  if (cc.capacity >= need || cc.source !== 'props' || !cc.primary || cc.primary.external) return { xml, added: 0 };
  // 逐个扫描 <tileset>：自闭合（外部 .tsx）的没有正文；有正文的取到对应的 </tileset>。
  // 注意：引擎写出的 TMX 属性顺序不固定（如 <property value="0" name="team" />），所以下面一律按属性名解析，不依赖顺序。
  const re = /<tileset\b([^>]*?)(\/?)>/g;
  let block = null, lastEnd = -1, m;
  while ((m = re.exec(head))) {
    let end = re.lastIndex;
    if (!m[2]) { const close = head.indexOf('</tileset>', re.lastIndex); if (close < 0) break; end = close + 10; re.lastIndex = end; }
    lastEnd = end;
    if (Number(xmlAttrs(m[1]).firstgid) === cc.primary.firstgid && !m[2]) block = head.slice(m.index, end);
  }
  if (!block || lastEnd < 0) return { xml, added: 0 };
  const base = cc.capacity, span = Math.max(1, cc.primary.tilecount || MAX_SPAWN_POINTS);
  let nextGid = parseTilesets(head).reduce((mx, t) => Math.max(mx, t.firstgid + Math.max(1, t.tilecount)), 1);
  const setAttr = (tag, name, val) => tag.replace(new RegExp(`(\\s${name}=")[^"]*(")`), `$1${val}$2`);
  let extra = '', added = 0;
  for (let off = base, k = 1; off < need; off += span, k++) {
    const copy = block
      .replace(/<tileset\b[^>]*>/, t => setAttr(setAttr(t, 'firstgid', nextGid), 'name', `${xmlAttrs(t.slice(8, -1)).name || 'CommandCenter'}_ext${k}`))
      .replace(/<property\b[^>]*?\/?>/g, t => { const at = xmlAttrs(t.replace(/^<property|\/?>$/g, '')); return at.name === 'team' && /^\d+$/.test(at.value || '') ? setAttr(t, 'value', Number(at.value) + off) : t; });
    extra += '\n  ' + copy;
    nextGid += span; added += span;
  }
  return { xml: xml.slice(0, lastEnd) + extra + xml.slice(lastEnd), added };
}
/** 3.20.0：当前 TMX 的指挥中心槽位最多能被 extendCcTileset 扩展到多少（主瓦片集为内嵌且带 team 属性时可扩到上限） */
function ccExtendableCap(cc = ccMapFor()) {
  const ok = cc.source === 'default' || (cc.source === 'props' && cc.primary && !cc.primary.external);
  return ok ? MAX_SPAWN_POINTS : cc.capacity;
}
async function patchTmxUnits(tmx, positions) {
  let xml = new TextDecoder().decode(tmx);
  let extended = 0;
  if (positions.length > ENGINE_MAX_CC || positions.length > ccMapFor(tmx).capacity) { const ex = extendCcTileset(xml, positions.length); xml = ex.xml; extended = ex.added; } // 3.19.0
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
  if (extended) changed = true; // 3.19.0：补了瓦片集，即使 Units 图层碰巧未变也要写回
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
  return { tmx: new TextEncoder().encode(xml.slice(0, tagEnd + 1) + body + xml.slice(dataEnd)), changed: true, truncated, source: cc.source, extended };
}
/** 3.9.0：近家资源点修补 Items 图层（与 patchTmxUnits 同构：读层 → 改数组 → 按原编码/压缩写回）。
 * addPoints 是新增资源点的中心坐标；每个点按 resourcePoolGids 算出的 3×3 块写入 GID。
 * 找不到 res_pool 瓦片（非本工具生成的第三方 TMX）时返回 noPool，调用方据此提示「资源点只在画布可见，未写入导出文件」。 */
async function patchTmxItems(tmx, addPoints) {
  if (!addPoints?.length) return { tmx, changed: false };
  const xml = new TextDecoder().decode(tmx);
  const L = await readLayerByName(xml, 'Items');
  if (!L) return { tmx, changed: false, missing: true };
  const block = resourcePoolGids(xml);
  if (!block) return { tmx, changed: false, noPool: true };
  const { cells, rows, cols, da, tagEnd, dataEnd } = L;
  let changed = false;
  for (const [r, c] of addPoints) {
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      const rr = r + dr, cc = c + dc; if (rr < 0 || cc < 0 || rr >= rows || cc >= cols) continue;
      const gid = block[dr + 1][dc + 1], idx = rr * cols + cc;
      if (cells[idx] !== gid) { cells[idx] = gid; changed = true; }
    }
  }
  if (!changed) return { tmx, changed: false };
  const bytes = new Uint8Array(cells.buffer, cells.byteOffset, cells.byteLength);
  let body;
  if (da.encoding === 'csv') {
    const lines = []; for (let r = 0; r < rows; r++) lines.push(Array.from(cells.subarray(r * cols, (r + 1) * cols)).join(','));
    body = '\n' + lines.join(',\n') + '\n';
  } else {
    let packed = bytes;
    if (da.compression === 'gzip') packed = await gzip(bytes);
    else if (da.compression === 'zlib') packed = await streamTransform(bytes, 'deflate', true);
    body = bytesToBase64(packed);
  }
  return { tmx: new TextEncoder().encode(xml.slice(0, tagEnd + 1) + body + xml.slice(dataEnd)), changed: true };
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
/* 3.14.0 修复：对 S.lastTmx 的「读 → 异步压缩 → 写回」统一用比较后交换（CAS）。
 * 近家资源点的新增 / 删除过去直接读 S.lastTmx、await 压缩后无条件写回；期间若自动保存的 syncTmxUnits 先写回了
 * 带新出生点的 TMX，这里会用旧基底把它覆盖，而 unitsDirty 已被清除，出生点修改就静默丢失。
 * 这类补丁（写入 GID / 清零格子）都是幂等的，基底变了就在新基底上重做，最多 4 次。 */
/* 3.15.0 修复：CAS 只比较 TMX 字节对象，不比较「是哪张地图」。补丁计算期间若换成了另一张地图（生成 / 恢复历史 / 导入），
 * 旧版会把「在 (r,c) 清零 / 写入资源池」的补丁在新地图的 TMX 上重做一遍——新地图的 Items 图层被凭空挖掉一块或多出一个资源池。
 * 现在补丁绑定到开始时的快照对象，快照被替换就放弃（返回 null），只在同一张地图内重做。 */
async function mutateTmx(patchFn) {
  const owner = S.snapshot;
  for (let i = 0; i < 4; i++) {
    const src = S.lastTmx;
    if (!src || S.snapshot !== owner) return null;
    const r = await patchFn(src);
    if (S.snapshot !== owner) return null;
    if (S.lastTmx === src) { if (r?.changed && r.tmx) S.lastTmx = r.tmx; return r; }
  }
  throw new Error('TMX 正在被其他操作修改，请稍后重试');
}
/* 3.7.0 修复：TMX 写回竞态。
 * 旧版 syncTmxUnits 先读 S.lastTmx、await 压缩（大地图要几百毫秒），再无条件写回 S.lastTmx 并清除 unitsDirty。
 * 在这段时间里如果：① 引擎返回了新地图（生成 / 完成地图）—— 新 TMX 会被旧地图的修补结果覆盖，导出的是上一张地图；
 * ② 用户又拖动了出生点 —— unitsDirty 被错误清除，新位置永远不会写入导出文件。
 * 触发路径：Ctrl+S / 「保存项目」/ 自动保存 / 安卓 onPause 与生成并发。
 * 现在：所有写回串行执行；写回前后比对 TMX 是否仍是同一份，不是则丢弃结果；出生点在期间变化则保留 dirty 标记。 */
let unitsSyncChain = Promise.resolve();
function syncTmxUnits() {
  const job = unitsSyncChain.then(syncTmxUnitsNow, syncTmxUnitsNow);
  unitsSyncChain = job.catch(() => {});
  return job;
}
/* 3.20.0 修复（第十八轮审查 · 缺陷 1）：分步模式下，在一张完整地图之后重新执行「海岸线」或「高度与海洋」步骤，
 * 画布上就变成一张「未完成」的新地图（引擎 meta.completed_step < 5，实测：海岸线 → 0、高度 → 2；画笔 / 资源等
 * 编辑不会降低它），而 S.lastTmx 仍是上一张完整地图。旧版此时：
 *   ① 写回出生点（导出 / 保存项目 / 自动保存 / 安卓切后台都会触发）会把画布上「未完成地图」的出生点（通常 0 个）
 *      写进上一张地图的 TMX——上一张地图的出生点被全部抹掉；
 *   ② 导出对话框说「地形被编辑过」，唯一选项是「导出旧版 TMX」，于是导出一张出生点被清空的旧地图，小地图 PNG 却画的是新地图。
 * 现在：未完成的地图一律不往 TMX 写出生点（保留 dirty 标记，完成地图时引擎会生成新 TMX）；导出时给出准确说明与两条出路。 */
function mapUnfinished(s = S.snapshot) { return !!s && S.source === 'engine' && (s.meta?.completed_step ?? 5) < 5; }
async function syncTmxUnitsNow() {
  if (!S.lastTmx || !S.unitsDirty) return;
  if (mapUnfinished()) return; // 3.20.0：TMX 属于上一张完整地图，不能写入未完成地图的出生点
  const src = S.lastTmx, spawns = currentSpawns(), sig = spawns.map(keyOf).join(';');
  const r = await patchTmxUnits(src, spawns);
  if (S.lastTmx !== src) return; // 期间 TMX 已被新地图替换：旧结果作废，新地图保持 dirty，由下一次写回处理
  S.lastTmx = r.tmx;
  S.unitsDirty = currentSpawns().map(keyOf).join(';') !== sig;
  if (r.extended) updateSpawnUI(); // 3.20.0 修复：瓦片集扩展后槽位 / GID 变了，列表要按新映射重绘（否则 51 号之后仍显示旧提示）
  // 旧实现在缺少 Units 图层时静默丢弃出生点修改，现在明确提示
  if (r.missing && spawns.length) toast('该 TMX 没有 Units 图层，出生点修改无法写入导出文件（地形照常导出）', 'warn', 5200);
  if (r.truncated) toast(`该 TMX 的指挥中心瓦片集只有 ${r.truncated} 个槽位，超出的出生点未写入`, 'warn', 5200);
  if (r.source === 'linear') toast('该 TMX 的指挥中心瓦片缺少 team 属性，已按线性顺序写入，游戏内玩家顺序可能与编号不同', 'warn', 5600);
  if (!r.missing && spawns.length) {
    const v = await verifySpawnMapping(r.tmx, spawns);
    if (S.lastTmx !== r.tmx || S.unitsDirty) return; // 校验期间地图或出生点又变了：结果不再代表当前状态
    S.slotVerified = v.ok;
    if (!v.ok) { console.warn('出生点映射校验失败', v); toast('出生点槽位校验未通过：导出文件中的玩家编号与界面不一致，请打开「槽位映射表」查看', 'error', 6000); }
    updateSlotBadge();
  }
}

/* ------------------------------------------------------------------ 近家资源点（3.9.0 新增）
 * 需求：无论地图多大、出生点多少、是否对称/怎么对称，每个出生点周边 10～20 格直线距离内都有 ≥2 个可用资源点。
 *
 * 设计取舍（与「出生点完全由 JS 侧管理」同一思路，避免对引擎做大量小颗粒 RPC）：
 *   · 实测对引擎 place_resource_manual 逐点调用，每次都会把整张地图的 6 张矩阵传回来，
 *     160×160 约 56ms/次、400×400 约 484ms/次，随面积增长；大地图 + 多出生点会拖到几分钟，
 *     且容器内没有 Rust 工具链，无法重新编译 WASM 绕开这个限制。
 *   · 因此资源点的「合法性判定」「对称镜像」「TMX 写入」全部搬到 JS 侧完成，只在最后把结果整图
 *     写回 S.snapshot（画布/小地图/体检/公平度都直接读这里）与 S.lastTmx（Items 图层按资源池瓦片的
 *     3×3 GID 块写入，GID 从当前 TMX 自带瓦片集动态解析，见 resourcePoolGids，不写死任何模板）。
 *   · 合法性判定复用 spawnCellValid 已经验证过的规则（陆地 3×3、墙线/悬崖/已占用格半径检查），
 *     保证与指挥中心同一套标准，不额外发明一套可能更容易出 bug 的新规则。
 *   · 可达性：以出生点为中心做局部 BFS（包围盒按距离上限+2 格裁剪，不是整图 BFS），避免资源点
 *     被放到隔着海域或者没有坡道可下的高地上却只是直线距离达标。
 *   · 对称：不依赖「对称模式」这个全局设置本身，而是直接在出生点的真实坐标里两两测试 5 种翻转
 *     （水平/垂直/主对角/副对角/双轴）是否正好互为镜像，命中的分到同一组。这样无论地图是用哪种
 *     对称模式生成的、还是导入/手改过局部坐标的，都能按「实际几何关系」正确配对，而不是假设
 *     每个出生点都严格符合某个全局模式。配不上对的出生点单独成组，各自独立放置。
 *   · 随机性由出生点坐标决定的种子控制（mulberry32），同样的出生点/地形下重复执行结果一致，
 *     满足“撤销后重做要能复现”的要求，同时在等距候选格里仍有变化，不会每次都贴着同一个角落。
 */
const NEAR_RES_DEFAULTS = { enabled: true, perSpawn: 2, min: 10, max: 20 };
const NEAR_RES_SEP = 4;          // 新增资源点中心之间的最小间距（3×3 footprint 留一点缝隙，避免贴在一起）
const NEAR_RES_SPAWN_SEP = 6;    // 距「非自己」的出生点至少留这么远
S.nearRes = { ...NEAR_RES_DEFAULTS };
S.nearResKeys = new Set();       // 当前 resource_positions 里，由本功能新增（而非引擎放置）的点，用于单独删除/统计
let nearResSeq = 0;              // 调试/日志用的批次号

/** 把「水平/垂直/主对角/副对角/双轴」的单点翻转抽成可复用的纯函数，供出生点配对与资源点镜像共用 */
const RESOURCE_FLIPS = {
  h: (r, c, rows) => [rows - 1 - r, c],
  v: (r, c, rows, cols) => [r, cols - 1 - c],
  b: (r, c, rows, cols) => [rows - 1 - r, cols - 1 - c],
  d1: (r, c) => [c, r],
  d2: (r, c, rows, cols) => [cols - 1 - c, rows - 1 - r]
};
function detectFlip(p0, p1, rows, cols) {
  for (const k of ['h', 'v', 'b', 'd1', 'd2']) {
    const [fr, fc] = RESOURCE_FLIPS[k](p0[0], p0[1], rows, cols);
    if (fr === p1[0] && fc === p1[1]) return k;
  }
  return null;
}
/** 按「谁是谁的镜像」把出生点分组；每组第一个是 primary，其余成员带上相对 primary 的翻转方式（没有则 null=落单） */
function groupSpawnOrbits(spawns, rows, cols) {
  const n = spawns.length, used = new Array(n).fill(false), groups = [];
  for (let i = 0; i < n; i++) {
    if (used[i]) continue;
    const members = [{ idx: i, flip: null }]; used[i] = true;
    for (let j = i + 1; j < n; j++) {
      if (used[j]) continue;
      const f = detectFlip(spawns[i], spawns[j], rows, cols);
      if (f) { members.push({ idx: j, flip: f }); used[j] = true; }
    }
    groups.push(members);
  }
  return groups;
}
function seededRng(seed) {
  let a = seed >>> 0 || 1;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hashSeed = (r, c, extra = 0) => (((r | 0) * 73856093) ^ ((c | 0) * 19349663) ^ ((extra | 0) * 83492791)) >>> 0;
/** 墙线/悬崖是否在 (r,c) 处阻挡：与 spawnCellValid 的多边形分层判定完全一致（分层边界算墙，缺口/坡道不算） */
function isWallBlocking(s, wall, rows, cols, r, c) {
  if (!wall?.data || wall.shape?.[1] !== cols) return false;
  if ((s?.meta?.hill_drawing_mode || 'brush') === 'polygon') {
    const D = (rr, cc) => wall.data[rr * cols + cc];
    const d = D(r, c);
    if (d <= 0) return false;
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
      const y = r + a, x = c + b; if (y < 0 || x < 0 || y >= rows || x >= cols) continue;
      if (Math.abs(D(y, x)) < d) return true;
    }
    return false;
  }
  return wall.data[r * cols + c] === 1;
}
/** 资源点footprint合法性：与出生点同一套标准（陆地 3×3、墙线/悬崖/已占用格半径检查），edgeMargin 可单独放宽/收紧离图边的距离 */
function resourceCellValid(s, r, c, { edgeMargin = 1 } = {}) {
  const [rows, cols] = dimsOf(s);
  if (!rows || !cols || r < edgeMargin || c < edgeMargin || r >= rows - edgeMargin || c >= cols - edgeMargin) return false;
  const h = terrainMatrix(s);
  if (h?.data) { for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) if (h.data[(r + dr) * cols + (c + dc)] <= 0) return false; }
  const wall = getMatrix('wall_matrix', s);
  if (wall?.data && wall.shape?.[1] === cols) {
    for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) {
      const rr = r + dr, cc = c + dc; if (rr < 0 || cc < 0 || rr >= rows || cc >= cols) continue;
      if (isWallBlocking(s, wall, rows, cols, rr, cc)) return false;
    }
  }
  const cliff = getMatrix('cliff_mask', s);
  if (cliff?.count && cliff.shape?.[1] === cols) {
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) { const rr = r + dr, cc = c + dc; if (rr < 0 || cc < 0 || rr >= rows || cc >= cols) continue; if (cliff.data[rr * cols + cc]) return false; }
  }
  const items = getMatrix('items_matrix', s);
  if (items?.data && items.shape?.[1] === cols) {
    for (let dr = -2; dr <= 2; dr++) { const rr = r + dr; if (rr < 0 || rr >= rows) continue; for (let dc = -2; dc <= 2; dc++) { const cc = c + dc; if (cc < 0 || cc >= cols) continue; if (items.data[rr * cols + cc] !== 0) return false; } }
  }
  return true;
}
/** 以 from 为起点、在 from 周边的局部包围盒内做 BFS，判断 to 是否陆路可达（不跨墙/悬崖，坡道可走） */
function localReachable(s, from, to, rows, cols, maxR) {
  const pad = maxR + 2;
  const r0 = Math.max(0, from[0] - pad), r1 = Math.min(rows - 1, from[0] + pad);
  const c0 = Math.max(0, from[1] - pad), c1 = Math.min(cols - 1, from[1] + pad);
  if (to[0] < r0 || to[0] > r1 || to[1] < c0 || to[1] > c1) return false;
  const h = terrainMatrix(s), wall = getMatrix('wall_matrix', s);
  const w = c1 - c0 + 1;
  const walkable = (r, c) => {
    if (r < r0 || c < c0 || r > r1 || c > c1) return false;
    if (h?.data && h.data[r * cols + c] <= 0) return false;
    if (isWallBlocking(s, wall, rows, cols, r, c)) return false;
    return true;
  };
  if (!walkable(from[0], from[1]) || !walkable(to[0], to[1])) return false;
  const key = (r, c) => (r - r0) * w + (c - c0);
  const visited = new Uint8Array(w * (r1 - r0 + 1));
  const qr = [from[0]], qc = [from[1]]; visited[key(from[0], from[1])] = 1;
  for (let head = 0; head < qr.length; head++) {
    const r = qr[head], c = qc[head];
    if (r === to[0] && c === to[1]) return true;
    const nbrs = [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]];
    for (const [nr, nc] of nbrs) {
      if (nr < r0 || nr > r1 || nc < c0 || nc > c1) continue;
      const k = key(nr, nc); if (visited[k] || !walkable(nr, nc)) continue;
      visited[k] = 1; qr.push(nr); qc.push(nc);
    }
  }
  return false;
}
/** 在指定出生点周围 [min,max] 直线距离环带内找 count 个资源点；三档放宽：
 *  A 严格（陆路可达 + 离其它出生点≥NEAR_RES_SPAWN_SEP）→ B 放宽可达性 → C 再放宽离其它出生点的距离。
 *  候选格先按离出生点的距离升序排列（优先就近），再用出生点坐标播种的随机数在等距小窗口内打乱，
 *  兼顾「就近」与「同样条件下带点随机」。*/
function pickResourcePoints(s, spawn, { min, max, count }, rows, cols, reserved, others, edgeMargin = 1) {
  if (count <= 0) return { points: [], tier: 'none' };
  const rng = seededRng(hashSeed(spawn[0], spawn[1], count));
  const r0 = Math.max(0, spawn[0] - max), r1 = Math.min(rows - 1, spawn[0] + max);
  const c0 = Math.max(0, spawn[1] - max), c1 = Math.min(cols - 1, spawn[1] + max);
  const cands = [];
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
    const dr = r - spawn[0], dc = c - spawn[1], d = Math.hypot(dr, dc);
    if (d < min || d > max) continue;
    if (reserved.has(keyOf([r, c]))) continue;
    cands.push({ r, c, d });
  }
  cands.sort((a, b) => a.d - b.d);
  for (let i = 0; i < cands.length; i += 6) {
    const end = Math.min(cands.length, i + 6);
    for (let k = end - 1; k > i; k--) { const j = i + Math.floor(rng() * (k - i + 1)); const t = cands[k]; cands[k] = cands[j]; cands[j] = t; }
  }
  const chosen = [];
  const sepOk = cd => chosen.every(p => Math.hypot(p.r - cd.r, p.c - cd.c) >= NEAR_RES_SEP);
  const tryPick = predicate => {
    for (const cd of cands) {
      if (chosen.length >= count) break;
      if (chosen.some(p => p.r === cd.r && p.c === cd.c)) continue;
      if (!sepOk(cd) || !predicate(cd)) continue;
      chosen.push(cd);
    }
  };
  tryPick(cd => resourceCellValid(s, cd.r, cd.c, { edgeMargin })
    && others.every(sp => Math.hypot(cd.r - sp[0], cd.c - sp[1]) >= NEAR_RES_SPAWN_SEP)
    && localReachable(s, spawn, [cd.r, cd.c], rows, cols, max));
  let tier = chosen.length >= count ? 'A' : (chosen.length ? 'partial' : null);
  if (chosen.length < count) {
    tryPick(cd => resourceCellValid(s, cd.r, cd.c, { edgeMargin })
      && others.every(sp => Math.hypot(cd.r - sp[0], cd.c - sp[1]) >= NEAR_RES_SPAWN_SEP));
    tier = chosen.length >= count ? 'B' : (chosen.length ? 'partial' : tier);
  }
  if (chosen.length < count) {
    tryPick(cd => resourceCellValid(s, cd.r, cd.c, { edgeMargin }));
    tier = chosen.length >= count ? 'C' : (chosen.length ? 'partial' : tier);
  }
  return { points: chosen.map(p => [p.r, p.c]), tier: tier || 'none' };
}
/** 把新增资源点的 3×3 footprint 标记进 items_matrix（与引擎放置资源/指挥中心的约定一致：非 0 = 已占用），
 *  之后的出生点/资源点合法性判定都会读到它，不需要重新跑一次引擎查询。 */
function markItemsOccupied(s, pts, rows, cols) {
  let items = getMatrix('items_matrix', s);
  if (!items?.data || items.shape?.[0] !== rows || items.shape?.[1] !== cols) {
    items = { shape: [rows, cols], data: new Int32Array(rows * cols) };
    s.matrices = s.matrices || {}; s.matrices.items_matrix = items;
  }
  for (const [r, c] of pts) for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
    const rr = r + dr, cc = c + dc; if (rr < 0 || cc < 0 || rr >= rows || cc >= cols) continue;
    items.data[rr * cols + cc] = items.data[rr * cols + cc] || 1;
  }
}
/** 核心规划（同步，不碰 TMX）：计算需要新增的近家资源点，直接写回 s.resource_positions / items_matrix。
 *  返回新增点的列表（供调用方决定要不要再去异步修补 TMX 的 Items 图层）。可在 sandbox() 内对候选快照调用。 */
function planNearSpawnResources(s, spawns, opts = {}) {
  const cfg = { ...NEAR_RES_DEFAULTS, ...S.nearRes, ...opts };
  if (!cfg.enabled || !s || spawns.length < 1) return { added: [], tier: 'none' };
  const [rows, cols] = dimsOf(s);
  if (!rows || !cols) return { added: [], tier: 'none' };
  const { min, max, perSpawn } = cfg;
  const existing = (s.resource_positions || []).map(p => [p[0], p[1]]);
  const reserved = new Set(existing.map(keyOf));
  const groups = groupSpawnOrbits(spawns, rows, cols);
  const added = [];
  const countNear = sp => existing.filter(p => { const d = Math.hypot(p[0] - sp[0], p[1] - sp[1]); return d >= min && d <= max; }).length;
  let worstTier = null;
  const rankTier = { A: 0, B: 1, C: 2, partial: 3, none: 4 };
  const worse = (a, b) => (rankTier[a] ?? 9) > (rankTier[b] ?? 9) ? a : b;
  for (const group of groups) {
    const primary = group[0], spawnP = spawns[primary.idx];
    const need = Math.max(0, perSpawn - countNear(spawnP));
    const others = spawns.filter((_, i) => i !== primary.idx);
    const picked = need > 0 ? pickResourcePoints(s, spawnP, { min, max, count: need }, rows, cols, reserved, others) : { points: [], tier: 'none' };
    picked.points.forEach(p => { reserved.add(keyOf(p)); added.push({ owner: primary.idx, p }); });
    if (need > 0) worstTier = worstTier ? worse(worstTier, picked.tier) : picked.tier;
    for (let gi = 1; gi < group.length; gi++) {
      const mem = group[gi], memSpawn = spawns[mem.idx];
      const needM = Math.max(0, perSpawn - countNear(memSpawn));
      if (needM <= 0) continue;
      const flipFn = RESOURCE_FLIPS[mem.flip];
      let got = [];
      if (flipFn) {
        for (const pt of picked.points) {
          if (got.length >= needM) break;
          const [fr, fc] = flipFn(pt[0], pt[1], rows, cols);
          if (fr < 0 || fc < 0 || fr >= rows || fc >= cols) continue;
          if (reserved.has(keyOf([fr, fc]))) continue;
          if (!resourceCellValid(s, fr, fc, { edgeMargin: 1 })) continue;
          got.push([fr, fc]);
        }
      }
      let tierM = got.length >= needM ? (flipFn ? 'A' : 'none') : null;
      if (got.length < needM) {
        const othersM = spawns.filter((_, i) => i !== mem.idx);
        const extra = pickResourcePoints(s, memSpawn, { min, max, count: needM - got.length }, rows, cols, reserved, othersM);
        got = got.concat(extra.points);
        tierM = got.length >= needM ? (tierM && tierM !== 'A' ? tierM : extra.tier) : (extra.tier === 'none' ? (tierM || 'partial') : extra.tier);
      }
      got.forEach(p => { reserved.add(keyOf(p)); added.push({ owner: mem.idx, p }); });
      worstTier = worstTier ? worse(worstTier, tierM || 'none') : (tierM || 'none');
    }
  }
  if (added.length) {
    s.resource_positions = [...(s.resource_positions || []), ...added.map(a => a.p)];
    markItemsOccupied(s, added.map(a => a.p), rows, cols);
    const meta = s.meta; if (meta) meta.num_resource_pulls = s.resource_positions.length;
  }
  return { added, tier: worstTier || 'none' };
}
/** 生成流程收尾调用：规划 + 立刻把新增点写进当前 TMX 的 Items 图层（S.lastTmx），保持画布与导出文件一致。
 *  有意不走 S.tmxDirty/「重新生成并导出」那条路——那条路会让引擎重新 finalize，丢弃这里新加的 JS 侧资源点。 */
async function autoApplyNearSpawnResources({ toastOnNone = false, silent = false } = {}) {
  if (!S.nearRes.enabled || !S.snapshot) return { added: 0 };
  const spawns = currentSpawns();
  const { added, tier } = planNearSpawnResources(S.snapshot, spawns);
  S.nearResKeys = new Set([...S.nearResKeys, ...added.map(a => keyOf(a.p))]);
  if (added.length) markResPop(added.map(a => a.p));
  if (added.length && S.lastTmx) {
    try {
      const pts = added.map(a => a.p);
      const r = await mutateTmx(src => patchTmxItems(src, pts)) || { changed: false };
      if (r.changed) { /* mutateTmx 已写回 */ }
      else if (r.noPool && !silent) toast('该地图瓦片集没有资源池贴图信息，近家资源点只在画布上可见，不会写入导出的 TMX', 'warn', 5600);
      else if (r.missing && !silent) toast('该 TMX 没有 Items 图层，近家资源点无法写入导出文件', 'warn', 5200);
    } catch (e) { console.warn('近家资源点写入 TMX 失败', e); if (!silent) toast('近家资源点已加入画布，但写入 TMX 失败：' + e.message, 'warn', 5200); }
  }
  if (added.length) {
    nearResSeq++;
    if (!silent) {
      const msg = tier === 'A' ? `已为每个出生点补齐近家资源点（共 +${added.length}）`
        : `已补齐近家资源点（共 +${added.length}），部分出生点周边空间有限，放置标准做了适当放宽`;
      toast(msg, tier === 'A' ? 'success' : 'info', 3600);
    }
    scheduleRender();
  } else if (toastOnNone) toast('每个出生点周边已有足够的资源点，无需新增', 'info');
  return { added: added.length, tier };
}
/** 手动按钮：导入的地图默认不会自动跑一遍（避免覆盖别人手摆的地图意图），这里显式补齐一次 */
async function fillNearSpawnResourcesManual() {
  if (!S.snapshot) { toast('请先生成或导入地图', 'warn'); return; }
  if (!currentSpawns().length) { toast('当前地图没有出生点', 'warn'); return; }
  await locked(() => autoApplyNearSpawnResources({ toastOnNone: true }));
}
/** 删除单个 JS 侧放置的近家资源点：不经过引擎（引擎根本不知道这些点存在），直接改快照 + 修补 TMX，
 *  并通过 Toast 自带的「撤销」按钮还原（避免为这个小功能单独接入全局撤销栈，牵动既有的历史记录逻辑）。 */
async function removeNearSpawnResourceAt(p) {
  const key = keyOf(p);
  if (!S.nearResKeys.has(key) || !S.snapshot) return false;
  const s = S.snapshot;
  s.resource_positions = (s.resource_positions || []).filter(q => keyOf(q) !== key);
  S.nearResKeys.delete(key);
  const [rows, cols] = dimsOf(s);
  if (S.lastTmx) {
    try {
      // 3.14.0：改为 mutateTmx（CAS）写回，见该函数注释
      await mutateTmx(async src => {
        const xml = new TextDecoder().decode(src);
        const L = await readLayerByName(xml, 'Items');
        if (!L) return { tmx: src, changed: false };
        const { cells, rows: lr, cols: lc, da, tagEnd, dataEnd } = L;
        for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
          const rr = p[0] + dr, cc = p[1] + dc; if (rr < 0 || cc < 0 || rr >= lr || cc >= lc) continue;
          cells[rr * lc + cc] = 0;
        }
        const bytes = new Uint8Array(cells.buffer, cells.byteOffset, cells.byteLength);
        let body;
        if (da.encoding === 'csv') { const lines = []; for (let r = 0; r < lr; r++) lines.push(Array.from(cells.subarray(r * lc, (r + 1) * lc)).join(',')); body = '\n' + lines.join(',\n') + '\n'; }
        else { let packed = bytes; if (da.compression === 'gzip') packed = await gzip(bytes); else if (da.compression === 'zlib') packed = await streamTransform(bytes, 'deflate', true); body = bytesToBase64(packed); }
        return { tmx: new TextEncoder().encode(xml.slice(0, tagEnd + 1) + body + xml.slice(dataEnd)), changed: true };
      });
    } catch (e) { console.warn('删除近家资源点时回写 TMX 失败', e); }
  }
  const items = getMatrix('items_matrix', s);
  const cleared = []; // 3.15.0：只记录本次清掉的格子（下标 + 原值），撤销时只还原它们
  if (items?.data && items.shape?.[1] === cols) {
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      const rr = p[0] + dr, cc = p[1] + dc; if (rr < 0 || cc < 0 || rr >= rows || cc >= cols) continue;
      // 只清自己占的格子；若与其它资源点/出生点共享（理论上因 NEAR_RES_SEP 不会发生）则保守保留
      const stillUsed = (s.resource_positions || []).some(q => Math.abs(q[0] - rr) <= 1 && Math.abs(q[1] - cc) <= 1) || currentSpawns().some(q => Math.abs(q[0] - rr) <= 1 && Math.abs(q[1] - cc) <= 1);
      const k = rr * cols + cc;
      if (!stillUsed && items.data[k] !== 0) { cleared.push([k, items.data[k]]); items.data[k] = 0; }
    }
  }
  if (s.meta) s.meta.num_resource_pulls = Math.max(0, (s.resource_positions || []).length);
  setStatus('已删除近家资源点');
  /* 3.15.0 修复：旧版撤销把「删除前」的整份资源点数组、近家键集合、占用矩阵原样写回。连续删除 A、B 后撤销 A，
   * B 也被一并复活——但 TMX 只补回了 A，B 只出现在画布上、导出文件里没有，画布与导出不一致。
   * 现在撤销只还原这一个点：资源点列表 / 近家键 / 本次清掉的占用格 / TMX 中它的 3×3 块。 */
  toast('已删除近家资源点', 'info', 4200, { action: {
    label: '撤销',
    fn: async () => {
      if (S.locked) { toast('正在处理中，请稍候…', 'warn'); return; }
      if (S.snapshot !== s) { toast('地图已变化，无法撤销这次删除', 'warn'); return; } // 3.14.0：已换成别的地图时不要把旧点写回去
      if ((s.resource_positions || []).some(q => keyOf(q) === key)) return;
      s.resource_positions = [...(s.resource_positions || []), [p[0], p[1]]];
      S.nearResKeys.add(key);
      if (items?.data) for (const [k, v] of cleared) if (items.data[k] === 0) items.data[k] = v;
      if (s.meta) s.meta.num_resource_pulls = s.resource_positions.length;
      markResPop([p]);
      scheduleRender();
      // 用幂等补丁把这个资源点的 3×3 块写回，而不是整份回滚 TMX（整份回滚会冲掉删除之后的出生点修改）
      if (S.lastTmx) await locked(() => mutateTmx(src => patchTmxItems(src, [p]))).catch(e => console.warn('撤销删除：TMX 写回失败', e));
      setStatus('已恢复近家资源点');
    }
  } });
  scheduleRender();
  return true;
}

/* ------------------------------------------------------------------ 导出：文件保存（Android 分块桥接 / 浏览器下载） */
async function saveFile(bytes, name, mime, target = ExportLoc.target()) {
  // 3.5.0：PC 版（desktop-bridge.js）由 Rust 写入导出目录；Android / 浏览器走原有分支，行为不变
  if (window.DesktopBridge?.saveFile) return window.DesktopBridge.saveFile(bytes, name, mime);
  const B = window.AndroidBridge;
  if (B?.beginSave) {
    // 3.8.0：target = downloads（下载目录）/ tree（用户选择的导出文件夹）；旧版原生层没有 beginSaveTo 时只能写下载目录
    const id = B.beginSaveTo && target === 'tree' ? B.beginSaveTo(name, mime, 'tree') : B.beginSave(name, mime);
    if (!id) throw new Error('无法创建导出文件');
    const CH = 3 * 256 * 1024; // 3 的倍数，保证每块 Base64 可独立解码
    for (let i = 0; i < bytes.length; i += CH) {
      if (!B.appendChunk(id, bytesToBase64(bytes.subarray(i, i + CH)))) { B.abortSave?.(id); throw new Error('写入导出文件失败'); }
      if ((i / CH) % 8 === 7) await nextFrame();
    }
    const res = String(B.finishSave(id) || '');
    if (res.startsWith('ok:')) {
      /* 3.9.0 修复：原生层 finishSave() 现在把「实际写入位置」同步编码进返回值（"ok:<name>|tree" /
       * "ok:<name>|downloads" / "ok:<name>|downloads:fallback"），不再靠 target 参数（只代表"请求写入哪里"，
       * 不代表"实际写到了哪里"）和 ExportLoc.folder.set（它要等 notifyFolder 的异步回调才会更新，和这次
       * finishSave() 的返回值谁先到谁后没有保证）去猜。旧版原生层若还没升级、没有带 "|" 后缀，退回旧逻辑。 */
      const payload = res.slice(3), bar = payload.indexOf('|');
      if (bar < 0) return { ok: true, name: payload, where: target === 'tree' && ExportLoc.folder.set ? ExportLoc.label('tree') : '下载目录' };
      const name = payload.slice(0, bar), where = payload.slice(bar + 1);
      if (where === 'tree') return { ok: true, name, where: ExportLoc.label('tree') };
      if (where === 'downloads:fallback') { ExportLoc.folder = { set: false }; ExportLoc.setPref('downloads'); return { ok: true, name, where: '下载目录（所选文件夹已无法访问，已自动回退）' }; }
      // 3.19.0：写入所选文件夹时发生瞬时错误（如空间不足），本次回退到下载目录，但文件夹设置保留，下次仍写入该文件夹
      if (where === 'downloads:retry') return { ok: true, name, where: '下载目录（本次写入所选文件夹失败，已临时回退；文件夹设置保留）' };
      return { ok: true, name, where: '下载目录' };
    }
    if (res === 'pending') return { ok: true, pending: true, name };
    throw new Error(res.replace(/^error:/, '') || '保存失败');
  }
  if (B?.saveBase64File) { B.saveBase64File(bytesToBase64(bytes), name, mime); return { ok: true, name, legacy: true }; }
  const blob = new Blob([bytes], { type: mime }), a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  return { ok: true, name };
}
/* ------------------------------------------------------------------ 导出后分享（3.14.0，仅 Android）
 * 原生层记录本批次已保存文件的 content:// URI；导出完成的提示里带「分享」按钮，拉起系统分享面板，可直接发到 QQ / 微信群。
 * 旧版原生层（没有这些桥接方法）或 Android 9 及以下（没有可授权的 URI）时 shareAction() 返回空对象，不显示按钮。 */
function beginShareBatch() { try { window.AndroidBridge?.resetShareList?.(); } catch { /* 旧版原生层没有此方法 */ } }
function shareAction() {
  try {
    const B = window.AndroidBridge;
    if (B?.shareSaved && B.canShare?.()) {
      return { action: { label: '分享', fn: () => { try { if (!B.shareSaved()) toast('没有可分享的文件', 'warn'); } catch (e) { toast('分享失败：' + e.message, 'error'); } } } };
    }
  } catch { /* ignore */ }
  return {};
}
function sanitizeName(s) {
  // 3.4.0：去掉首尾点号（Android 文件系统会拒绝 / 改名，TMX 与 _map.png 不再同名成对）
  return String(s || '').replace(/\.tmx$/i, '').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').replace(/\s+/g, ' ').trim().replace(/^[.\s]+|[.\s]+$/g, '').slice(0, 80);
}
/** TMX 实际写入的文件名（去掉 .tmx）；拿不到（等待权限 / 浏览器下载）时用原名 */
function pairedBase(saved, base) {
  const n = String(saved?.name || '');
  return !saved?.pending && /\.tmx$/i.test(n) ? n.replace(/\.tmx$/i, '') : base;
}
function exportBaseName() {
  const custom = sanitizeName($('mapName').value);
  return custom || `[p${currentSpawns().length}]铁锈地图_${stamp()}`;
}
/** 3.20.0：一键补完分步生成剩下的步骤（高度 → 出生点 → 资源 → 完成），用于「导出未完成的地图」 */
async function finishRemainingSteps() {
  const p = params();
  try {
    if ((S.snapshot.meta?.completed_step ?? -1) < 2) await run('run_height_ocean', { heightLevels: p.heightLevels, oceanLevels: p.oceanLevels, wallMagnetism: 0 }, '正在补完：高度与海洋…', { keepBusy: true, stage: '1/3' });
    if (!(S.snapshot.resource_positions || []).length && p.numResources > 0) await run('place_resource_random', { mirroring: p.mirroring, numResources: p.numResources }, '正在补完：资源点…', { keepBusy: true, stage: '2/3' });
    await runFinalize(); // 内含「没有出生点时自动智能布置」
  } catch (e) { if (!(e instanceof EngineError)) toast('补完地图失败：' + e.message, 'error'); return false; }
  return !mapUnfinished();
}
async function prepareTmxForExport() {
  if (!S.lastTmx) { toast('请先生成或导入地图', 'warn'); return null; }
  if (mapUnfinished()) {
    const done = S.snapshot.meta?.completed_step ?? -1, alive = S.snapshotEpoch === S.engineEpoch;
    const buttons = [{ key: 'cancel', label: '取消' }, { key: 'reload', label: '载入上一张完整地图' }];
    if (alive) buttons.push({ key: 'finish', label: '补完剩余步骤并导出', primary: true });
    const c = await uiChoice('地图尚未完成', `画布上的地图是分步生成到一半的（已完成到「${STEP_NAMES[Math.max(0, done)]}」），还没有对应的 TMX。<br>现有的 TMX 属于<b>上一张完整地图</b>，与画布不同，直接导出会得到另一张地图。${alive ? '<br>可以一键补完剩余步骤（高度、出生点、资源点按当前参数自动生成），或载入上一张完整地图后再导出。' : '<br>引擎状态已失效，无法继续补完这张地图；可以载入上一张完整地图后再导出。'}`, buttons);
    if (!c || c === 'cancel') return null;
    if (c === 'finish') { if (!(await finishRemainingSteps())) return null; }
    else { await loadTmxBytes(S.lastTmx.slice(), exportBaseName() + '.tmx'); if (!S.lastTmx) return null; toast('已载入上一张完整地图', 'info'); }
  }
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
  try { // 3.6.0：导出前顺手体检，出生点被隔开时给一个不打断流程的提示
    const a = S.snapshot ? analyzeMap() : null;
    if (a && a.n >= 2 && !a.conn.allConnected && !a.conn.teamsApart) toast('提示：有出生点与其他出生点陆路不通，按 D 打开「地图体检」查看', 'warn', 5200);
  } catch (e) { console.warn('导出前体检失败', e); }
  return S.lastTmx;
}
async function exportPair(opts = {}) {
  await locked(async () => {
    const tmx = await prepareTmxForExport(); if (!tmx) return;
    const base = opts.base || exportBaseName(), target = opts.target || ExportLoc.target();
    try {
      beginShareBatch();
      busy(true, '正在导出…', '保存 TMX', 30, { cancellable: false });
      const r1 = await saveFile(tmx, `${base}.tmx`, 'application/octet-stream', target);
      busy(true, '正在导出…', '生成小地图', 65, { cancellable: false });
      const png = await buildMapPng();
      // 3.7.0 修复：Android 10+ 下载目录已有同名文件时 MediaStore 会把 TMX 改名为「xxx (1).tmx」，旧版仍按原名保存
      // 「xxx_map.png」，系统再改名成「xxx_map (1).png」—— 两者不再成对，游戏里看不到小地图。现在按 TMX 的实际文件名命名小地图。
      const pngBase = pairedBase(r1, base);
      if (png) { await sleep(150); await saveFile(png, `${pngBase}_map.png`, 'image/png', target); }
      const pi = S.lastPngInfo;
      const doneMsg = `已导出${r1.where ? `到${r1.where}` : ''} ${r1.name && !r1.pending ? r1.name : `${base}.tmx`}${png ? ` 与 _map.png（${pi.width}×${pi.height} · ${(pi.size / 1024).toFixed(0)}KB）` : '（小地图生成失败）'}`;
      if (r1.desktop) toast(doneMsg, png ? 'success' : 'warn', 5200, { action: { label: '打开文件夹', fn: () => window.DesktopBridge.reveal(r1.path) } });
      else toast(r1.pending ? '等待存储权限授予后自动保存' : doneMsg, png ? 'success' : 'warn', 4200, r1.pending ? {} : shareAction());
      setStatus(`已导出：${r1.name && !r1.pending ? r1.name : `${base}.tmx`}`);
      if (pngBase !== base && png) toast(`下载目录已有同名文件，已自动改名为「${pngBase}」，小地图同步改名保持成对`, 'info', 5200);
    } catch (e) { toast('导出失败：' + e.message, 'error', 4200); }
    finally { busy(false); }
  });
}
async function exportZipFn(opts = {}) {
  await locked(async () => {
    const tmx = await prepareTmxForExport(); if (!tmx) return;
    busy(true, '正在打包 ZIP…', '生成小地图图片', 30, { cancellable: false });
    try {
      beginShareBatch();
      const base = opts.base || exportBaseName();
      const png = await buildMapPng();
      if (!png) { toast('小地图图片生成失败，未导出', 'error'); return; }
      const s = S.snapshot;
      const cc = ccMapFor(tmx), sp = currentSpawns();
      const table = sp.slice(0, cc.capacity).map((q, i) => `  玩家 ${String(i + 1).padStart(2)}  team ${String(i).padStart(2)}  GID ${cc.gidForTeam(i)}  坐标(行,列) ${q[0] + 1},${q[1] + 1}  ${teamLabel(teamOf(q, i))}`).join('\r\n');
      let docText = '';
      try { // 3.6.0：说明.txt 附带地图体检摘要
        const a = analyzeMap();
        if (a && a.n >= 1) docText = `\r\n地图体检（健康度 ${a.score}/100）：\r\n` + doctorVerdicts(a).map(v => `  [${{ ok: '通过', warn: '提醒', bad: '问题', info: '提示' }[v.level]}] ${v.title} —— ${v.detail}`).join('\r\n') + '\r\n';
      } catch (e) { console.warn('体检摘要失败', e); }
      const info = new TextEncoder().encode(`铁锈战争地图生成器离线版 v${APP_VERSION}\r\n地图：${s?.meta?.width || 0} × ${s?.meta?.height || 0}\r\n出生点：${sp.length}\r\n资源点：${s?.resource_positions?.length || 0}\r\n对称：${MIRROR_LABELS[s?.meta?.mirroring] || '不对称'}\r\n${S.mapShape ? `地形形态：${S.mapShape.label}（种子 ${S.mapShape.seed}，陆地 ${S.mapShape.land}%）\r\n` : ''}小地图：${S.lastPngInfo ? `${S.lastPngInfo.width}×${S.lastPngInfo.height} · ${(S.lastPngInfo.size / 1024).toFixed(1)}KB · ${PNG_STYLES[S.lastPngInfo.style]}` : '—'}\r\n槽位映射：${CC_SOURCE_LABEL[cc.source]}${S.slotVerified ? '（已读回校验）' : ''}\r\n${mapRecipeCode() ? `配方码：${mapRecipeCode()}（在 App 中「使用配方码」可按同一套参数重新生成）\r\n` : ''}导出时间：${new Date().toLocaleString()}\r\n\r\n出生点槽位表（玩家 N = team N-1）：\r\n${table}\r\n${docText}`);
      busy(true, '正在打包 ZIP…', '计算校验', 60, { cancellable: false });
      await nextFrame();
      const zip = zipStore([{ name: `${base}.tmx`, data: tmx }, { name: `${base}_map.png`, data: png }, { name: '说明.txt', data: info }]);
      busy(true, '正在打包 ZIP…', '保存文件', 85, { cancellable: false });
      const r = await saveFile(zip, `${base}.zip`, 'application/zip', opts.target || ExportLoc.target());
      if (r.desktop) window.DesktopBridge.savedToast(r, `导出完成：${r.name}`);
      else toast(r.pending ? '等待存储权限授予后自动保存' : `导出完成${r.where ? `（${r.where}）` : ''}：${r.name || `${base}.zip`}`, 'success', 3600, r.pending ? {} : shareAction());
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
  ctx.lineWidth = Math.max(1.2, R * 0.26); ctx.strokeStyle = teamColor(team); ctx.stroke();
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
  const wall = wallLayerFor();
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
  [{ key: 'cancel', label: '关闭' }, ...(canCopyImage() ? [{ key: 'copy', label: '复制图片' }] : []), { key: 'export', label: '导出 TMX+小地图', primary: true }], { wide: true });
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  if (k === 'copy') copyPngToClipboard(info.bytes);
  if (k === 'export') exportPair();
}

/* ------------------------------------------------------------------ 地图体检（3.6.0 新增）
 * 回答地图作者最关心的几个问题：
 *   ① 所有出生点之间有没有陆路相通？有没有被水域 / 墙体隔开的孤立出生点？（连通性）
 *   ② 双方实际能控制多大的地盘？（领地：以「行走距离」划分的 Voronoi，4 邻接多源 BFS）
 *   ③ 资源点分配是否均衡？有没有谁都够不着的资源？
 *   ④ 地形构成：陆地 / 水域 / 墙体占比、与所有出生点都不相连的「孤岛」比例。
 * 通行判定：高度 > 0 的陆地，且不是画笔墙体（wall_matrix === 1；缺口 === 2 可通行）。
 * 多边形分层模式与导入的 TMX 无法还原悬崖，只按陆地估算（报告里会标注「估算」）。
 * 连通性使用 ≤1000 的网格（1000² 以内的地图逐格精确），领地 / 资源使用 ≤420 的网格，保证大地图也能秒出结果。 */
const DOC_CONN_DIM = 1000, DOC_TERR_DIM = 420;
let snapSeq = 0;
const snapIds = new WeakMap();
const snapId = s => { if (!s) return 0; let v = snapIds.get(s); if (!v) { v = ++snapSeq; snapIds.set(s, v); } return v; };
/* 3.9.0 修复：体检 / 领地 / 接敌路线三处缓存（docCache / terrCache / routeCache）都以 analysisSig() 的返回值
 * 作为失效判据，但这个签名此前只覆盖「快照对象本身 + 悬崖 + 出生点坐标/队伍」，不包含资源点。
 * snapId() 是按快照对象的引用身份分配 id 的 WeakMap，只要还是同一个快照对象，id 就不变——而本版新增的
 * 「近家资源点」功能会在不替换快照对象的前提下原地修改 s.resource_positions（引擎每次返回的快照都是新对象，
 * 此前资源点只会跟着新对象一起变化，这个旧签名碰巧没出过问题，但本质上一直是漏的）。现在补上资源点签名，
 * 使三处缓存在资源点增减后也能正确失效，不会继续显示旧的体检分数 / 领地着色 / 接敌路线。 */
function analysisSig(s = S.snapshot) {
  const sp = currentSpawns(), rs = s?.resource_positions || [];
  return `${snapId(s)}${getMatrix('cliff_mask', s) ? 'c' : ''}|${sp.map(keyOf).join(';')}|${sp.map((q, i) => teamOf(q, i)).join('')}|${rs.length}:${rs.map(keyOf).join(';')}`;
}
/** 把地图降采样成通行网格：陆地取块中心，块内任意一格是墙则整块不可通行（保守） */
function buildGrid(s, maxDim) {
  const h = terrainMatrix(s);
  if (!h?.data || !h.shape) return null;
  const rows = h.shape[0], cols = h.shape[1];
  const scale = Math.max(1, Math.ceil(Math.max(rows, cols) / maxDim));
  const gr = Math.ceil(rows / scale), gc = Math.ceil(cols / scale);
  const land = new Uint8Array(gr * gc), mask = new Uint8Array(gr * gc);
  const wm = getMatrix('wall_matrix', s);
  const useWalls = !!wm?.data && (s?.meta?.hill_drawing_mode || 'brush') !== 'polygon' && wm.shape?.[0] === rows && wm.shape?.[1] === cols;
  const cm = getMatrix('cliff_mask', s); // 3.7.0：TMX 悬崖瓦片（导入地图 / 已生成 TMX 的地图），精确判定不可通行
  const useCliff = !!cm?.data && cm.shape?.[0] === rows && cm.shape?.[1] === cols;
  let landCells = 0, wallCells = 0;
  for (let y = 0; y < gr; y++) {
    const r0 = y * scale, r1 = Math.min(rows, r0 + scale), cr = Math.min(rows - 1, r0 + (scale >> 1));
    for (let x = 0; x < gc; x++) {
      const c0 = x * scale, c1 = Math.min(cols, c0 + scale), cc = Math.min(cols - 1, c0 + (scale >> 1));
      const isLand = h.data[cr * cols + cc] > 0;
      let wall = false;
      if ((useWalls || useCliff) && isLand) {
        for (let r = r0; r < r1 && !wall; r++) for (let c = c0; c < c1; c++) { const k = r * cols + c; if ((useWalls && wm.data[k] === 1) || (useCliff && cm.data[k])) { wall = true; break; } }
      }
      const i = y * gc + x;
      if (isLand) { land[i] = 1; landCells++; if (wall) wallCells++; else mask[i] = 1; }
    }
  }
  return { rows: gr, cols: gc, scale, land, mask, landCells, wallCells, total: gr * gc, estimated: !useWalls && !useCliff, source: useCliff ? 'tmx' : useWalls ? 'brush' : 'land' };
}
/** 4 邻接连通域标记（保守：不允许斜穿墙角） */
function labelGrid(g) {
  const { rows, cols, mask } = g, n = rows * cols;
  const comp = new Int32Array(n), stack = new Int32Array(n), sizes = [0];
  let id = 0;
  for (let s0 = 0; s0 < n; s0++) {
    if (!mask[s0] || comp[s0]) continue;
    id++; let sp = 0, size = 0; stack[sp++] = s0; comp[s0] = id;
    while (sp) {
      const k = stack[--sp]; size++;
      const y = (k / cols) | 0, x = k - y * cols;
      if (x > 0 && mask[k - 1] && !comp[k - 1]) { comp[k - 1] = id; stack[sp++] = k - 1; }
      if (x < cols - 1 && mask[k + 1] && !comp[k + 1]) { comp[k + 1] = id; stack[sp++] = k + 1; }
      if (y > 0 && mask[k - cols] && !comp[k - cols]) { comp[k - cols] = id; stack[sp++] = k - cols; }
      if (y < rows - 1 && mask[k + cols] && !comp[k + cols]) { comp[k + cols] = id; stack[sp++] = k + cols; }
    }
    sizes[id] = size;
  }
  return { comp, sizes, count: id };
}
/** 把地图坐标吸附到最近的可通行网格（半径 3 以内），找不到返回 -1 */
function snapToGrid(g, r, c) {
  const y0 = clamp(Math.floor(r / g.scale), 0, g.rows - 1), x0 = clamp(Math.floor(c / g.scale), 0, g.cols - 1);
  if (g.mask[y0 * g.cols + x0]) return y0 * g.cols + x0;
  for (let rad = 1; rad <= 3; rad++) for (let dy = -rad; dy <= rad; dy++) for (let dx = -rad; dx <= rad; dx++) {
    if (Math.max(Math.abs(dy), Math.abs(dx)) !== rad) continue;
    const y = y0 + dy, x = x0 + dx;
    if (y < 0 || x < 0 || y >= g.rows || x >= g.cols) continue;
    if (g.mask[y * g.cols + x]) return y * g.cols + x;
  }
  return -1;
}
/** 多源 BFS：每个可通行格归属于「行走距离最近」的出生点；同距离时取直线距离更近者，避免序号靠前的一方占便宜 */
function territoryBfs(g, seeds) {
  const { rows, cols, mask } = g, n = rows * cols;
  const owner = new Int16Array(n).fill(-1), dist = new Int32Array(n).fill(-1), queue = new Int32Array(n);
  const sy = new Float64Array(seeds.length), sx = new Float64Array(seeds.length);
  let qh = 0, qt = 0;
  seeds.forEach((k, i) => {
    if (k < 0) return;
    sy[i] = (k / cols) | 0; sx[i] = k - sy[i] * cols;
    if (owner[k] < 0) { owner[k] = i; dist[k] = 0; queue[qt++] = k; }
  });
  const eu = (k, o) => { const y = (k / cols) | 0, x = k - y * cols; return (y - sy[o]) ** 2 + (x - sx[o]) ** 2; };
  while (qh < qt) {
    const k = queue[qh++], o = owner[k], d = dist[k] + 1, y = (k / cols) | 0, x = k - y * cols;
    const visit = nk => {
      if (!mask[nk]) return;
      if (dist[nk] < 0) { dist[nk] = d; owner[nk] = o; queue[qt++] = nk; }
      else if (dist[nk] === d && owner[nk] !== o && eu(nk, o) < eu(nk, owner[nk])) owner[nk] = o;
    };
    if (x > 0) visit(k - 1);
    if (x < cols - 1) visit(k + 1);
    if (y > 0) visit(k - cols);
    if (y < rows - 1) visit(k + cols);
  }
  return { owner, dist };
}
const balanceRatio = (a, b) => (a + b) > 0 ? Math.min(a, b) / Math.max(a, b) : 1;
const hasBothTeams = (teams, spawns) => spawns.length >= 2 && new Set(teams).size > 1;
/* 3.7.0：8 邻接 Dijkstra（直行 10 / 斜行 14，斜走时两侧都必须可通行）。代价是小整数，用 15 个循环桶的 Dial 算法，
 * 420² 网格约 10ms。返回每格到最近源点的代价（×10 格），不可达为 INF。 */
const PATH_INF = 0x7fffffff;
const NB_X = [1, -1, 0, 0, 1, 1, -1, -1], NB_Y = [0, 0, 1, -1, 1, -1, 1, -1], NB_W = [10, 10, 10, 10, 14, 14, 14, 14];
function costField(g, sources) {
  const { rows, cols, mask } = g, n = rows * cols, dist = new Int32Array(n).fill(PATH_INF);
  const B = 15, buckets = Array.from({ length: B }, () => []);
  let pending = 0;
  for (const k of sources) if (k >= 0 && mask[k] && dist[k] !== 0) { dist[k] = 0; buckets[0].push(k); pending++; }
  for (let d = 0; pending > 0; d++) {
    const bk = buckets[d % B];
    while (bk.length) {
      const k = bk.pop(); pending--;
      if (dist[k] !== d) continue;
      const y = (k / cols) | 0, x = k - y * cols;
      for (let j = 0; j < 8; j++) {
        const nx = x + NB_X[j], ny = y + NB_Y[j];
        if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
        const nk = ny * cols + nx;
        if (!mask[nk] || (j >= 4 && (!mask[y * cols + nx] || !mask[ny * cols + x]))) continue;
        const nd = d + NB_W[j];
        if (nd < dist[nk]) { dist[nk] = nd; buckets[nd % B].push(nk); pending++; }
      }
    }
  }
  return dist;
}
/** 沿代价场下降回溯最短路径（网格下标数组，起点 → 源点） */
function tracePath(g, dist, k) {
  const { rows, cols, mask } = g, out = [k];
  for (let guard = 0; dist[k] > 0 && guard < rows * cols; guard++) {
    const y = (k / cols) | 0, x = k - y * cols;
    let next = -1;
    for (let j = 0; j < 8 && next < 0; j++) {
      const nx = x + NB_X[j], ny = y + NB_Y[j];
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
      const nk = ny * cols + nx;
      if (!mask[nk] || (j >= 4 && (!mask[y * cols + nx] || !mask[ny * cols + x]))) continue;
      if (dist[nk] !== PATH_INF && dist[nk] + NB_W[j] === dist[k]) next = nk;
    }
    if (next < 0) break;
    k = next; out.push(k);
  }
  return out;
}
/** 每个出生点 → 最近敌方出生点：{ d（格）, path, enemy }；每队只做一次多源 Dijkstra */
function rushAnalysis(g, seeds, teams) {
  const res = seeds.map(() => ({ d: Infinity, path: null, enemy: -1 }));
  const byCell = new Map(); seeds.forEach((k, i) => { if (k >= 0 && !byCell.has(k)) byCell.set(k, i); });
  for (const T of ['A', 'B']) {
    const src = seeds.filter((k, i) => k >= 0 && teams[i] === T);
    if (!src.length) continue;
    const dist = costField(g, src);
    seeds.forEach((k, i) => {
      if (k < 0 || teams[i] === T || dist[k] === PATH_INF) return;
      const path = tracePath(g, dist, k);
      res[i] = { d: dist[k] / 10 * g.scale, path, enemy: byCell.has(path[path.length - 1]) ? byCell.get(path[path.length - 1]) : -1 };
    });
  }
  return res;
}
/* 3.19.0：FFA 接敌——每位玩家到「最近一个对手」的行走距离。
 * 逐人各跑一次 Dijkstra 在 100 人时要 100 次；这里只跑一次多源 Dijkstra 并记录每格归属（Voronoi 划分），
 * 再扫描所有「相邻但归属不同」的格对 (x, y)：dist[x] + 步长 + dist[y] 的最小值就是该玩家到最近对手的最短路长度
 * （最短路必然穿过两人领地的分界，且穿过点两侧各自是到本方源点的最短路）。路径 = x 回溯到本方 + y 回溯到对手。 */
function rushAnalysisFFA(g, seeds) {
  const { rows, cols, mask } = g, n = rows * cols, dist = new Int32Array(n).fill(PATH_INF), owner = new Int16Array(n).fill(-1);
  const B = 15, buckets = Array.from({ length: B }, () => []);
  let pending = 0;
  seeds.forEach((k, i) => { if (k >= 0 && mask[k] && owner[k] < 0) { dist[k] = 0; owner[k] = i; buckets[0].push(k); pending++; } });
  for (let d = 0; pending > 0; d++) {
    const bk = buckets[d % B];
    while (bk.length) {
      const k = bk.pop(); pending--;
      if (dist[k] !== d) continue;
      const y = (k / cols) | 0, x = k - y * cols;
      for (let j = 0; j < 8; j++) {
        const nx = x + NB_X[j], ny = y + NB_Y[j];
        if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
        const nk = ny * cols + nx;
        if (!mask[nk] || (j >= 4 && (!mask[y * cols + nx] || !mask[ny * cols + x]))) continue;
        const nd = d + NB_W[j];
        if (nd < dist[nk]) { dist[nk] = nd; owner[nk] = owner[k]; buckets[nd % B].push(nk); pending++; }
      }
    }
  }
  const best = seeds.map(() => ({ v: PATH_INF, x: -1, y: -1, e: -1 }));
  for (let k = 0; k < n; k++) {
    const o = owner[k]; if (o < 0) continue;
    const y = (k / cols) | 0, x = k - y * cols;
    for (let j = 0; j < 8; j++) {
      const nx = x + NB_X[j], ny = y + NB_Y[j];
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
      const nk = ny * cols + nx, o2 = owner[nk];
      if (o2 < 0 || o2 === o || (j >= 4 && (!mask[y * cols + nx] || !mask[ny * cols + x]))) continue;
      const v = dist[k] + NB_W[j] + dist[nk];
      if (v < best[o].v) best[o] = { v, x: k, y: nk, e: o2 };
    }
  }
  return best.map(b => {
    if (b.v === PATH_INF) return { d: Infinity, path: null, enemy: -1 };
    const path = [...tracePath(g, dist, b.x).reverse(), ...tracePath(g, dist, b.y)];
    return { d: b.v / 10 * g.scale, path, enemy: b.e };
  });
}
let docCache = null;
function analyzeMap(s = S.snapshot, spawns = currentSpawns()) {
  if (!s) return null;
  const sig = analysisSig(s);
  if (docCache && docCache.sig === sig && s === S.snapshot) return docCache.result;
  const g1 = buildGrid(s, DOC_CONN_DIM);
  if (!g1) return null;
  const [rows, cols] = dimsOf(s);
  const teams = spawns.map((q, i) => teamOf(q, i));
  const ffa = isFFA(); // 3.19.0
  /* ① 连通性 */
  const lab = labelGrid(g1);
  const spawnComp = spawns.map(q => { const k = snapToGrid(g1, q[0], q[1]); return k < 0 ? 0 : lab.comp[k]; });
  const gm = new Map();
  spawnComp.forEach((c, i) => { if (!gm.has(c)) gm.set(c, []); gm.get(c).push(i); });
  const groups = [...gm.entries()].map(([comp, idx]) => ({ comp, spawns: idx, size: lab.sizes[comp] || 0 })).sort((a, b) => b.spawns.length - a.spawns.length || b.size - a.size);
  const stuck = gm.get(0) || [];
  const passableTotal = lab.sizes.reduce((a, b) => a + b, 0);
  const used = new Set(spawnComp.filter(c => c > 0));
  const speck = Math.max(6, passableTotal * 0.001);
  let isolatedCells = 0;
  for (let c = 1; c <= lab.count; c++) if (!used.has(c) && lab.sizes[c] >= speck) isolatedCells += lab.sizes[c];
  const isolatedPct = passableTotal ? isolatedCells / passableTotal : 0;
  const realGroups = groups.filter(g => g.comp > 0);
  const allConnected = spawns.length >= 2 && stuck.length === 0 && realGroups.length === 1;
  const teamsApart = !ffa && spawns.length >= 2 && realGroups.length > 1 && realGroups.every(g => new Set(g.spawns.map(i => teams[i])).size === 1) &&
    new Set(teams).size > 1 && stuck.length === 0;
  /* ② 领地 + ③ 资源 */
  const g2 = g1.scale === Math.max(1, Math.ceil(Math.max(rows, cols) / DOC_TERR_DIM)) ? g1 : buildGrid(s, DOC_TERR_DIM);
  const seeds = spawns.map(q => snapToGrid(g2, q[0], q[1]));
  const { owner, dist } = territoryBfs(g2, seeds);
  const counts = new Array(spawns.length).fill(0);
  let owned = 0, passable2 = 0, unreached2 = 0;
  for (let i = 0; i < owner.length; i++) {
    if (!g2.mask[i]) continue;
    passable2++;
    if (owner[i] >= 0) { counts[owner[i]]++; owned++; } else unreached2++;
  }
  const share = { A: 0, B: 0 };
  counts.forEach((n, i) => { share[teams[i]] += n; });
  const resPos = s.resource_positions || [];
  const perSpawn = new Array(spawns.length).fill(0), resDist = new Array(spawns.length).fill(null).map(() => ({ min: Infinity, max: 0 }));
  const resTeam = { A: 0, B: 0 };
  let unreachableRes = 0;
  for (const [r, c] of resPos) {
    const k = snapToGrid(g2, r, c);
    const o = k < 0 ? -1 : owner[k];
    if (o < 0) { unreachableRes++; continue; }
    perSpawn[o]++; if (!ffa) resTeam[teams[o]]++;
    const dd = dist[k] * g2.scale;
    if (dd < resDist[o].min) resDist[o].min = dd;
    if (dd > resDist[o].max) resDist[o].max = dd;
  }
  /* ④ 接敌（Rush）距离（3.7.0）：每个出生点到最近敌方出生点的行走距离（8 邻接，斜走 ×1.4，不斜穿墙角） */
  const rushList = ffa ? (spawns.length >= 2 ? rushAnalysisFFA(g2, seeds) : []) : hasBothTeams(teams, spawns) ? rushAnalysis(g2, seeds, teams) : [];
  const teamRush = T => { const v = rushList.filter((r, i) => teams[i] === T && Number.isFinite(r.d)).map(r => r.d); return v.length ? v.reduce((x, y) => x + y, 0) / v.length : null; };
  const rushA = ffa ? null : teamRush('A'), rushB = ffa ? null : teamRush('B');
  let closest = -1; rushList.forEach((r, i) => { if (Number.isFinite(r.d) && (closest < 0 || r.d < rushList[closest].d)) closest = i; });
  const front = [];
  for (const T of ffa ? [] : ['A', 'B']) {
    const idx = rushList.map((r, i) => i).filter(i => teams[i] === T && Number.isFinite(rushList[i].d));
    if (idx.length < 3) continue;
    const ds = idx.map(i => rushList[i].d).sort((x, y) => x - y), med = ds[Math.floor(ds.length / 2)];
    idx.forEach(i => { if (rushList[i].d < med * 0.55) front.push(i); });
  }
  // 每个出生点到「任意」最近资源点的直线距离（不受领地归属影响），用来识别明显偏远的出生点
  const nearestRes = spawns.map(q => resPos.length ? Math.min(...resPos.map(p => Math.hypot(p[0] - q[0], p[1] - q[1]))) : Infinity);
  const hasBoth = !ffa && spawns.length >= 2 && new Set(teams).size > 1;
  /* 3.19.0：FFA 指标——领地均衡 = 最小 / 平均；接敌均衡 = 最小 / 平均；前线 = 不到中位数 55% 的玩家 */
  let ffaStats = null;
  if (ffa && spawns.length >= 2) {
    const mean = v => v.length ? v.reduce((x, y) => x + y, 0) / v.length : 0;
    const tAvg = mean(counts), tMin = Math.min(...counts);
    const rv = rushList.map(r => r.d).filter(Number.isFinite), rAvg = mean(rv), rMin = rv.length ? Math.min(...rv) : 0;
    const sortedR = [...rv].sort((x, y) => x - y), med = sortedR[Math.floor(sortedR.length / 2)] || 0;
    if (rv.length >= 3) rushList.forEach((r, i) => { if (Number.isFinite(r.d) && r.d < med * 0.55) front.push(i); });
    const nr = nearestRes.filter(Number.isFinite);
    ffaStats = {
      terrMin: owned ? tMin / owned : 0, terrAvg: owned ? tAvg / owned : 0, terrBal: tAvg ? clamp(tMin / tAvg, 0, 1) : 1,
      rushAvg: rAvg, rushMin: rMin, rushBal: rAvg ? clamp(rMin / rAvg, 0, 1) : 1,
      resBal: nr.length ? clamp(Math.max(1, Math.min(...nr)) / Math.max(1, ...nr), 0, 1) : 1
    };
  }
  /* 评分与结论 */
  const connScore = spawns.length < 2 ? 1 : allConnected ? 1 : teamsApart ? 0.4 : 0.2;
  const terrScore = ffaStats ? ffaStats.terrBal : hasBoth && owned ? balanceRatio(share.A, share.B) : 1;
  const resAvail = resPos.length ? 1 - unreachableRes / resPos.length : 1;
  const resScore = ffaStats ? (resPos.length ? ffaStats.resBal * resAvail : 1) : resPos.length && hasBoth ? balanceRatio(resTeam.A, resTeam.B) * resAvail : resAvail;
  const isoScore = 1 - clamp(isolatedPct * 2, 0, 1);
  const rushRatio = ffaStats ? ffaStats.rushBal : rushA != null && rushB != null ? balanceRatio(rushA, rushB) : 1;
  // 3.7.0：健康度加入接敌距离平衡（连通 30 + 领地 25 + 接敌 15 + 资源 15 + 孤岛 15）
  const score = Math.round(100 * (0.30 * connScore + 0.25 * terrScore + 0.15 * rushRatio + 0.15 * resScore + 0.15 * isoScore));
  const result = {
    sig, rows, cols, n: spawns.length, teams, score,
    conn: { groups, stuck, allConnected, teamsApart, isolatedPct, passableTotal, estimated: g1.estimated, source: g1.source, scale: g1.scale },
    rush: { list: rushList, avgA: rushA, avgB: rushB, ratio: rushRatio, closest, front },
    terr: { grid: g2, owner, dist, counts, share, owned, unreachedPct: passable2 ? unreached2 / passable2 : 0, ratio: terrScore },
    res: { total: resPos.length, perSpawn, resDist, nearest: nearestRes, team: resTeam, unreachable: unreachableRes, ratio: balanceRatio(resTeam.A, resTeam.B) },
    comp: { land: g1.landCells / g1.total, wall: g1.wallCells / g1.total, water: 1 - g1.landCells / g1.total },
    hasBoth, ffa, ffaStats
  };
  if (s === S.snapshot) docCache = { sig, result };
  return result;
}
const pct = v => `${(v * 100).toFixed(1)}%`;
const levelOfRatio = r => r >= 0.9 ? 'ok' : r >= 0.75 ? 'warn' : 'bad';
/** 体检结论列表：{ level: ok|warn|bad|info, title, detail, spawn? } */
function doctorVerdicts(a) {
  const out = [], pl = i => `玩家 ${i + 1}`;
  const names = idx => idx.slice(0, 6).map(i => i + 1).join('、') + (idx.length > 6 ? ` 等 ${idx.length} 个` : '');
  if (a.n === 0) { out.push({ level: 'warn', title: '还没有出生点', detail: '先「智能重新布置」或手动放置出生点，再进行体检。' }); }
  else if (a.n < 2) out.push({ level: 'info', title: '只有 1 个出生点', detail: '至少需要 2 个出生点才能评估连通性与领地平衡。' });
  if (a.n >= 2) {
    const c = a.conn;
    if (c.stuck.length) out.push({ level: 'bad', title: `${c.stuck.length} 个出生点不在可通行陆地上`, detail: `${names(c.stuck)} 号出生点落在水域或墙体内，单位无法行走。请移动它们。`, spawn: c.stuck[0] });
    if (c.allConnected) out.push({ level: 'ok', title: '出生点之间陆路相通', detail: `全部 ${a.n} 个出生点位于同一块可通行陆地。${c.estimated ? '（未获取到墙体数据：按陆地估算，未计入悬崖）' : ''}` });
    else if (c.teamsApart) out.push({ level: 'warn', title: '两队被水域 / 墙体完全隔开', detail: `共 ${c.groups.length} 块互不相连的陆地，每块只有同一队伍的出生点。这是岛屿图的典型布局，地面部队需要海空力量才能交战。`, spawn: c.groups.find(g => g.comp > 0)?.spawns[0] });
    else if (c.groups.filter(g => g.comp > 0).length > 1) {
      const minor = c.groups.filter(g => g.comp > 0).slice(1);
      out.push({ level: 'bad', title: `出生点被分隔成 ${c.groups.filter(g => g.comp > 0).length} 块`, detail: `${minor.map(g => names(g.spawns)).join(' ｜ ')} 号出生点与主陆地不相连，地面部队无法到达。可调低墙体、增加缺口，或移动出生点。`, spawn: minor[0].spawns[0] });
    }
    if (a.hasBoth) {
      const lv = levelOfRatio(a.terr.ratio), A = a.terr.share.A / Math.max(1, a.terr.owned), B = a.terr.share.B / Math.max(1, a.terr.owned);
      out.push({ level: lv, title: `领地 A ${pct(A)} ／ B ${pct(B)}`, detail: lv === 'ok' ? '按行走距离划分，双方可控制的地盘基本对等。' : `双方地盘相差较大（平衡度 ${Math.round(a.terr.ratio * 100)}%）。可开启「领地」图层查看分界，再调整出生点位置。` });
    }
    const R = a.rush, F = a.ffaStats;
    if (F) { // 3.19.0：FFA 体检结论
      const lt = levelOfRatio(F.terrBal + 0.15); // 多人混战领地天然有差异，阈值比两队对抗宽 15%
      out.push({ level: lt, title: `领地均衡 ${Math.round(F.terrBal * 100)}%（最小 ${pct(F.terrMin)} ／ 平均 ${pct(F.terrAvg)}）`, detail: lt === 'ok' ? '自由混战：每位玩家按行走距离可控制的地盘大致相当。' : '有玩家的地盘明显小于平均水平，开局发展空间受限。打开「领地」图层（每人一色）查看，或拖动出生点调整。', spawn: lt === 'ok' ? undefined : a.terr.counts.indexOf(Math.min(...a.terr.counts)) });
      if (R && R.closest >= 0) {
        const lv = levelOfRatio(F.rushBal + 0.15), c = R.closest, e = R.list[c].enemy;
        out.push({ level: lv, title: `最近对手：平均 ${Math.round(F.rushAvg)} 格 ／ 最近 ${Math.round(F.rushMin)} 格`, detail: `${lv === 'ok' ? '每位玩家离最近对手的距离比较均匀。' : '有玩家离邻座明显更近，开局就会被夹击。'}最近的一对：${pl(c)} ↔ ${e >= 0 ? pl(e) : '对手'}。按 L 显示每人到最近对手的路线。`, spawn: c });
        if (R.front.length) out.push({ level: 'warn', title: `${R.front.length} 个出生点贴得太近`, detail: `${names(R.front)} 号出生点到最近对手的距离不到中位数的 55%。`, spawn: R.front[0] });
      }
    }
    if (a.hasBoth && R && R.closest >= 0 && R.avgA != null && R.avgB != null) {
      const lv = levelOfRatio(R.ratio), c = R.closest, e = R.list[c].enemy;
      out.push({ level: lv, title: `接敌距离 A 平均 ${Math.round(R.avgA)} ／ B 平均 ${Math.round(R.avgB)} 格`, detail: `${lv === 'ok' ? '双方到最近敌人的行走距离相当。' : `双方到最近敌人的行走距离差距较大（平衡度 ${Math.round(R.ratio * 100)}%），距离近的一方更容易被速攻。`}最近接敌：${pl(c)} ↔ ${e >= 0 ? pl(e) : '敌方'}，约 ${Math.round(R.list[c].d)} 格。按 L 显示路线。`, spawn: c });
      if (R.front.length) out.push({ level: 'warn', title: `${R.front.length} 个出生点处在前线`, detail: `${names(R.front)} 号出生点离敌人明显比队友近（不到本队中位数的 55%），开局压力较大。`, spawn: R.front[0] });
    }
  }
  if (a.res.total) {
    if (a.res.unreachable) out.push({ level: 'warn', title: `${a.res.unreachable} 个资源点无人可达`, detail: '这些资源点与所有出生点都不在同一块可通行陆地上（或被墙体包围）。' });
    if (a.hasBoth && a.res.total - a.res.unreachable > 0) {
      const lv = levelOfRatio(a.res.ratio);
      out.push({ level: lv, title: `资源分配 A ${a.res.team.A} ／ B ${a.res.team.B}`, detail: lv === 'ok' ? '按最近出生点归属，双方资源点数量均衡。' : '双方最近的资源点数量不均，建议开启对称或重新布置资源点。' });
    }
    // 3.6.0：用「到最近资源点的直线距离」判断偏远，而不是「领地内有无资源」（资源常位于双方之间的公共区域，领地内为空很正常）
    const sorted = [...a.res.nearest].sort((x, y) => x - y), med = sorted[Math.floor(sorted.length / 2)] || 0, minDim = Math.min(a.rows, a.cols);
    const far = a.res.nearest.map((d, i) => (a.n >= 3 && d > Math.max(med * 2, minDim * 0.22)) ? i : -1).filter(i => i >= 0);
    if (far.length) out.push({ level: 'warn', title: `${far.length} 个出生点离资源点明显偏远`, detail: `${names(far)} 号出生点到最近资源点的距离是中位数的 2 倍以上，开局采集会比其他玩家慢。`, spawn: far[0] });
  } else if (a.n >= 2) out.push({ level: 'info', title: '地图上没有资源点', detail: '如不是刻意设计，可在「分步编辑 ⑤」放置资源点。' });
  // 3.9.0：近家资源点覆盖情况——与上面「偏远」检查的角度不同：那条看的是「最近一个资源点有多远」，
  // 这条看的是「出生点周边 min~max 格的环带内，是否凑够了设置里要求的数量」，直接对应本功能的目标。
  if (S.nearRes.enabled && a.n >= 1 && S.snapshot) {
    const { min, max, perSpawn } = S.nearRes, sp = currentSpawns(), res = S.snapshot.resource_positions || [];
    const short = [];
    sp.forEach((q, i) => {
      const n = res.filter(p => { const d = Math.hypot(p[0] - q[0], p[1] - q[1]); return d >= min && d <= max; }).length;
      if (n < perSpawn) short.push(i);
    });
    if (short.length) out.push({ level: 'warn', title: `${short.length} 个出生点的近家资源不足 ${perSpawn} 个`, detail: `${names(short)} 号出生点周边 ${min}～${max} 格内的资源点数量不到设置值，多见于出生点贴边、周边可用陆地有限的情况。可点击「补齐近家资源」重新尝试，或调整近家资源的距离范围。`, spawn: short[0] });
    else out.push({ level: 'ok', title: '近家资源点已达标', detail: `每个出生点周边 ${min}～${max} 格内都至少有 ${perSpawn} 个可用资源点。` });
  }
  // 3.19.0：对称检查——对称地图上出现明显的单边差异（多为手工改动只改了一边）
  try {
    const sy = S.snapshot ? analyzeSymmetry() : null;
    if (sy?.mode && !sy.clean) {
      const spawnIssue = sy.spawnsOff.length && $('symmetryStrength').value !== 'soft';
      if (sy.counts.land + sy.counts.wall >= Math.max(9, sy.rows * sy.cols * 0.0005) || spawnIssue || sy.resOff.length) {
        out.push({ level: 'warn', title: `对称性：发现单边差异（${MIRROR_LABELS[sy.mode]}）`, detail: `${symmetrySummary(sy).replace(/^对称检查（[^）]*）：/, '')}。按 Y 打开「对称」图层查看具体位置${spawnIssue ? '；出生点可在命令面板执行「对称修复」一键补齐镜像' : ''}。`, spawn: spawnIssue ? sy.spawnsOff[0] : undefined });
      }
    }
  } catch (e) { console.warn('对称检查失败', e); }
  if (a.conn.isolatedPct > 0.05) out.push({ level: a.conn.isolatedPct > 0.2 ? 'warn' : 'info', title: `${pct(a.conn.isolatedPct)} 的陆地是孤岛`, detail: '这部分陆地与所有出生点都不相连，只能通过空运 / 海运到达。' });
  if (!out.some(v => v.level === 'bad' || v.level === 'warn') && a.n >= 2) out.push({ level: 'ok', title: '没有发现明显问题', detail: '连通性、领地与资源分配都在合理范围内。' });
  return out;
}
const DOC_ICON = { ok: '✓', warn: '!', bad: '✕', info: 'i' };
/** 3.7.0：每位玩家的接敌距离柱状图（点击柱子定位到该玩家） */
function rushBarsHtml(a) {
  const L = a.rush?.list || [];
  if ((!a.hasBoth && !a.ffa) || a.rush.closest < 0 || L.length > MAX_SPAWN_POINTS) return '';
  const max = Math.max(1, ...L.map(r => Number.isFinite(r.d) ? r.d : 0));
  const bars = L.map((r, i) => { const ok = Number.isFinite(r.d); return `<i class="team-${a.teams[i]}${ok ? '' : ' none'}${a.rush.front.includes(i) ? ' front' : ''}" style="--h:${ok ? Math.max(5, r.d / max * 100) : 100}%;--d:${Math.min(i, 30) * 16}ms${a.ffa ? `;--tc:${teamColor(a.teams[i])}` : ''}" data-spawn="${i}" title="玩家 ${i + 1}：${ok ? `${Math.round(r.d)} 格` : '无法到达敌人'}"></i>`; }).join('');
  return `<div class="doc-rush"><div class="doc-rush-head"><b>接敌距离</b><small>每位玩家走到最近${a.ffa ? '对手' : '敌人'}的距离 · 最长 ${Math.round(max)} 格 · 点击柱子定位</small></div><div class="doc-rush-bars">${bars}</div></div>`;
}
function doctorHtml(a, verdicts) {
  const lv = a.score >= 80 ? 'good' : a.score >= 60 ? 'warn' : 'bad';
  const nb = verdicts.filter(v => v.level === 'bad').length, nw = verdicts.filter(v => v.level === 'warn').length, no = verdicts.filter(v => v.level === 'ok').length;
  const A = a.hasBoth && a.terr.owned ? a.terr.share.A / a.terr.owned : 0.5, B = a.hasBoth && a.terr.owned ? a.terr.share.B / a.terr.owned : 0.5;
  const items = verdicts.map((v, i) => `<li class="v-${v.level}${v.spawn !== undefined ? ' has-spawn' : ''}" style="--d:${Math.min(i, 12) * 55}ms"${v.spawn !== undefined ? ` data-spawn="${v.spawn}" title="点击定位到玩家 ${v.spawn + 1}"` : ''}><i aria-hidden="true">${DOC_ICON[v.level]}</i><div><b>${escapeHtml(v.title)}</b><small>${escapeHtml(v.detail)}</small></div></li>`).join('');
  return `<div class="doc-head">
      <div class="doc-ring" data-level="${lv}"><svg viewBox="0 0 36 36" aria-hidden="true"><circle class="doc-ring-bg" cx="18" cy="18" r="15.5"/><circle id="docRing" class="doc-ring-arc" cx="18" cy="18" r="15.5" pathLength="100" style="stroke-dasharray:0 100"/></svg><b id="docScore" data-v="0">0</b><small>健康度</small></div>
      <div class="doc-sum"><b>${a.n} 个出生点 · ${a.rows}×${a.cols}${a.res.total ? ` · ${a.res.total} 个资源点` : ''}</b>
        <span class="doc-chips"><em class="c-ok">${no} 通过</em><em class="c-warn">${nw} 提醒</em><em class="c-bad">${nb} 问题</em></span>
        <small>${a.conn.estimated ? '暂无悬崖数据（多边形分层编辑中）：按陆地估算，完成地图后可精确体检' : a.conn.source === 'tmx' ? '按陆地 + TMX 悬崖瓦片精确计算' : '按陆地 + 画笔墙体计算，缺口可通行'}${a.conn.scale > 1 ? ` · 网格 1:${a.conn.scale}` : ''}</small></div>
    </div>
    ${rushBarsHtml(a)}
    ${playersHtml(a)}
    ${a.hasBoth ? `<div class="doc-split" aria-label="领地分布"><span class="lab a">A 队 ${pct(A)}</span><div class="doc-bar"><i class="a" id="docBarA" style="width:50%"></i><i class="b" id="docBarB" style="width:50%"></i></div><span class="lab b">${pct(B)} B 队</span></div>` : ''}
    <ul class="doc-list">${items}</ul>
    <div class="doc-tiles"><div><b>${pct(a.comp.land)}</b><small>陆地</small></div><div><b>${pct(a.comp.water)}</b><small>水域</small></div><div><b>${pct(a.comp.wall)}</b><small>墙体</small></div><div><b>${pct(a.conn.isolatedPct)}</b><small>孤岛</small></div></div>`;
}
async function showMapDoctor() {
  if (!S.snapshot) { toast('请先生成或导入地图', 'warn'); return; }
  if (!guard()) return;
  let a;
  S.locked = true;
  try { busy(true, '正在体检地图…', '', null, { cancellable: false }); await nextFrame(); a = analyzeMap(); }
  catch (e) { console.error(e); toast('地图体检失败：' + e.message, 'error'); }
  finally { busy(false); S.locked = false; }
  if (!a) return;
  const verdicts = doctorVerdicts(a);
  const terrOn = S.layers.territory;
  const p = uiChoice('地图体检', doctorHtml(a, verdicts), [
    { key: 'report', label: '复制体检报告', className: 'report-action' },
    { key: 'routes', label: S.layers.routes ? '隐藏路线' : '显示路线' },
    { key: 'terr', label: terrOn ? '隐藏领地图' : '显示领地图' },
    { key: 'ok', label: '知道了', primary: true }
  ], { wide: true, tone: verdicts.some(v => v.level === 'bad') ? 'danger' : 'info' });
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const ring = $('docRing'); if (ring) ring.style.strokeDasharray = `${a.score} 100`;
    const sc = $('docScore'); if (sc) animateNumber(sc, a.score);
    if (a.hasBoth && a.terr.owned) {
      const A = a.terr.share.A / a.terr.owned, B = a.terr.share.B / a.terr.owned;
      const ea = $('docBarA'), eb = $('docBarB');
      if (ea && eb) { ea.style.width = `${A * 100}%`; eb.style.width = `${B * 100}%`; }
    }
    $('modalBody').querySelectorAll('[data-spawn]').forEach(li => {
      // 3.19.0：「玩家对比」表的行打开巡视卡片（飞过去并显示该玩家数据）；其余条目保持原来的定位行为
      li.onclick = () => { closeModal('cancel'); const i = Number(li.dataset.spawn); if (li.classList.contains('pr')) { tour.on = true; selectSpawn(i, 'tour'); } else selectSpawn(i, true); };
    });
  }));
  const k = await p;
  if (k === 'report') {
    const sev = { bad: '问题', warn: '提醒', ok: '通过', info: '信息' };
    const report = [
      `TMX MapForge 地图体检报告 v${APP_VERSION}`,
      `生成时间：${new Date().toLocaleString()}`,
      `地图尺寸：${a.cols} × ${a.rows}`,
      `出生点：${a.n}；资源点：${a.res.total}`,
      `健康度：${a.score}/100`,
      `陆地：${pct(a.comp.land)}；水域：${pct(a.comp.water)}；墙体：${pct(a.comp.wall)}；孤岛：${pct(a.conn.isolatedPct)}`,
      ...(mapRecipeCode() ? [`配方码：${mapRecipeCode()}`] : []),
      '', '检查结果：',
      ...verdicts.map((v, i) => `${i + 1}. [${sev[v.level] || v.level}] ${v.title}\n   ${v.detail}`),
      ...playerReportLines(a),
      '', '说明：体检分数是地图布局辅助指标，不代表所有游戏版本、模组或实战策略下的绝对平衡。'
    ].join('\n');
    // 3.19.0：复用 copyText()（旧版在这里重复实现了一遍「异步剪贴板 → execCommand」的回退逻辑）
    if (await copyText(report)) toast('体检报告已复制，可粘贴到备忘录或反馈问题', 'success', 3600);
    else toast('复制失败：请检查系统剪贴板权限后重试', 'warn', 3600);
  }
  if (k === 'terr') setTerritoryLayer(!S.layers.territory);
  if (k === 'routes') setRoutesLayer(!S.layers.routes);
}
/* 领地图层：按出生点归属着色（A 蓝 / B 红），分界线加亮，孤岛陆地标橙色 */
let terrCache = null, terrTimer = 0, terrFade = 0;
/* 3.18.0：图层开关 chip 采用 role="switch"，切换后需同步 aria-checked，读屏才能播报当前开/关状态 */
function syncLayerAria(id) {
  const el = $(id); if (el) el.setAttribute('aria-checked', String(el.classList.contains('active')));
}
function setTerritoryLayer(on) {
  S.layers.territory = !!on;
  $('layerTerritory')?.classList.toggle('active', S.layers.territory);
  syncLayerAria('layerTerritory');
  $('mapPanel')?.classList.toggle('terr-on', S.layers.territory);
  if (on) { terrFade = performance.now(); if (!S.snapshot) toast('生成地图后即可查看领地分布', 'info'); }
  scheduleRender();
}
function buildTerritoryNow() {
  const sig = analysisSig(), snap = snapId(S.snapshot);
  let canvas = null;
  try {
    const a = analyzeMap();
    if (a && a.n >= 1) {
      const { grid: g, owner } = a.terr, W = g.cols, H = g.rows;
      canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
      const ctx = canvas.getContext('2d'), img = ctx.createImageData(W, H), d = img.data;
      const col = { A: [75, 138, 255], B: [255, 107, 107] };
      for (let i = 0; i < owner.length; i++) {
        const o = owner[i], k = i * 4;
        if (o < 0) { if (g.mask[i]) { d[k] = 255; d[k + 1] = 189; d[k + 2] = 90; d[k + 3] = 92; } continue; }
        const c = a.ffa ? ffaRgb(o) : (col[a.teams[o]] || col.A); // 3.19.0：FFA 每人一色
        const x = i % W, y = (i / W) | 0;
        const edge = (x < W - 1 && owner[i + 1] >= 0 && owner[i + 1] !== o) || (y < H - 1 && owner[i + W] >= 0 && owner[i + W] !== o);
        d[k] = c[0]; d[k + 1] = c[1]; d[k + 2] = c[2]; d[k + 3] = edge ? 240 : (o % 2 ? 84 : 108);
      }
      ctx.putImageData(img, 0, 0);
      canvas._grid = g;
    }
  } catch (e) { console.error('领地图层生成失败', e); }
  terrCache = { sig, snap, canvas };
}
function drawTerritory(ctx, rows, cols, fadeK) {
  if (!S.layers.territory || !S.snapshot) return false;
  const snap = snapId(S.snapshot), sig = analysisSig();
  if (!terrCache || terrCache.snap !== snap) buildTerritoryNow();            // 新地图：同步生成一次
  else if (terrCache.sig !== sig) {                                           // 仅出生点变化：防抖重算，期间先显示旧图
    clearTimeout(terrTimer);
    terrTimer = setTimeout(() => { buildTerritoryNow(); scheduleRender(); }, 90);
  }
  const cv = terrCache?.canvas; if (!cv) return false;
  const g = cv._grid, k = clamp((performance.now() - terrFade) / 420, 0, 1), z = S.view.zoom;
  ctx.save(); ctx.globalAlpha = (0.35 + 0.65 * k) * fadeK; ctx.imageSmoothingEnabled = false;
  // 3.7.0 修复：网格比例不能整除地图尺寸时（如 1000 列 / 1:3），领地图会画出地图右 / 下边界 1～2 格
  ctx.beginPath(); ctx.rect(S.view.x, S.view.y, cols * z, rows * z); ctx.clip();
  ctx.drawImage(cv, S.view.x, S.view.y, g.cols * g.scale * z, g.rows * g.scale * z);
  ctx.restore();
  return k < 1;
}

/* ------------------------------------------------------------------ 体检精确化（3.7.0 新增）：从 TMX 读取悬崖 / 水域瓦片
 * 3.6.0 的体检在没有画笔墙体数据时（导入地图、快速生成、多边形分层）一律「按陆地估算」。实际上 TMX 里的悬崖都是
 * 带 cliff / large-cliff 属性（或属于名为 *cliff* 的瓦片集）的瓦片，水域瓦片带 water 属性。这里逐层（Units 除外）读取：
 *   cliff[i] = 1  该格任一图层是悬崖瓦片（不可通行）；water[i] = 1  该格是水域瓦片。
 * 结果挂在快照上（matrices.cliff_mask），体检 / 领地 / 路线 / 出生点合法性 / 墙体图层 / 小地图都会使用。 */
const CLIFF_PROP_RE = /^(cliff|large-cliff|solid|impassable)$/i;
function tilePropIndex(xmlHead) {
  const blocked = new Set(), water = new Set(), ranges = [];
  for (const ts of parseTilesets(xmlHead)) {
    if (/cliff/i.test(ts.name) && ts.tilecount) ranges.push([ts.firstgid, ts.firstgid + ts.tilecount]);
    for (const [id, p] of ts.tiles) {
      const keys = Object.keys(p);
      if (keys.some(k => CLIFF_PROP_RE.test(k))) blocked.add(ts.firstgid + id);
      if (keys.some(k => /^water$/i.test(k))) water.add(ts.firstgid + id);
    }
  }
  const memo = new Map();
  return g => {
    let v = memo.get(g);
    if (v === undefined) { v = (blocked.has(g) || ranges.some(([a, b]) => g >= a && g < b) ? 1 : 0) | (water.has(g) ? 2 : 0); memo.set(g, v); }
    return v;
  };
}
async function tmxTerrainMasks(bytes) {
  const xml = typeof bytes === 'string' ? bytes : new TextDecoder().decode(bytes);
  const mt = xml.match(/<map\b[^>]*>/); if (!mt) return null;
  const ma = xmlAttrs(mt[0]), rows = Number(ma.height), cols = Number(ma.width);
  if (!rows || !cols) return null;
  const flagOf = tilePropIndex(tmxHeadXml(xml)), n = rows * cols;
  const cliff = new Uint8Array(n), water = new Uint8Array(n);
  let nCliff = 0, nWater = 0;
  const re = /<layer\b([^>]*)>\s*(?:<properties>[\s\S]*?<\/properties>\s*)?<data\b([^>]*)>([\s\S]*?)<\/data>/g;
  for (const m of xml.matchAll(re)) {
    if (/^units$/i.test(xmlAttrs(m[1]).name || '') || /<chunk/.test(m[3])) continue;
    const d = await decodeLayerData(xmlAttrs(m[2]), m[3].trim(), n);
    for (let i = 0; i < n; i++) {
      const g = d[i] & 0x1fffffff; if (!g) continue;
      const f = flagOf(g); if (!f) continue;
      if ((f & 1) && !cliff[i]) { cliff[i] = 1; nCliff++; }
      if ((f & 2) && !water[i]) { water[i] = 1; nWater++; }
    }
  }
  return { rows, cols, cliff, water, nCliff, nWater };
}
/** 生成 / 完成地图后异步读取 TMX 悬崖，挂到对应快照（快照被替换后结果仍挂在原快照上，不影响新地图） */
function attachCliffMask(snap, tmx) {
  if (!snap?.matrices || !tmx?.length) return;
  tmxTerrainMasks(tmx).then(mk => {
    if (!mk) return;
    const [r, c] = dimsOf(snap);
    if (mk.rows !== r || mk.cols !== c) return;
    snap.matrices.cliff_mask = { shape: [r, c], data: mk.cliff, count: mk.nCliff };
    if (snap === S.snapshot) scheduleRender();
  }).catch(e => console.warn('读取 TMX 悬崖失败', e));
}

/* ------------------------------------------------------------------ 接敌路线图层（3.7.0 新增，快捷键 L）
 * 把体检里「每个出生点到最近敌人」的最短行走路径画在地图上：线色 = 出发方队伍，虚线流动表示行进方向。
 * 镜像地图中 A→B 与 B→A 往往是同一条路，只画一次。选中出生点时只高亮它自己的路线并标出距离。 */
let routeCache = null, routeTimer = 0;
function setRoutesLayer(on) {
  S.layers.routes = !!on;
  $('layerRoutes')?.classList.toggle('active', S.layers.routes);
  syncLayerAria('layerRoutes');
  $('mapPanel')?.classList.toggle('routes-on', S.layers.routes);
  if (on && S.snapshot) {
    const a = (() => { try { return analyzeMap(); } catch { return null; } })();
    if (!a?.hasBoth) toast('需要两支队伍都有出生点才能计算接敌路线', 'info');
  } else if (on) toast('生成地图后即可查看接敌路线', 'info');
  scheduleRender();
}
function simplifyPath(g, path) {
  const out = [], cols = g.cols, half = g.scale / 2 - 0.5;
  let pdx = 0, pdy = 0;
  for (let i = 0; i < path.length; i++) {
    const y = (path[i] / cols) | 0, x = path[i] - y * cols;
    if (i > 0 && i < path.length - 1) {
      const ny = (path[i + 1] / cols) | 0, nx = path[i + 1] - ny * cols, dx = nx - x, dy = ny - y;
      if (dx === pdx && dy === pdy) continue;
      pdx = dx; pdy = dy;
    } else if (i === 0 && path.length > 1) { const ny = (path[1] / cols) | 0; pdx = path[1] - ny * cols - x; pdy = ny - y; }
    out.push([y * g.scale + half, x * g.scale + half]);
  }
  return out;
}
function buildRoutesNow() {
  const sig = analysisSig(), snap = snapId(S.snapshot), routes = [];
  try {
    const a = analyzeMap();
    if (a?.hasBoth) {
      const g = a.terr.grid, seen = new Set();
      a.rush.list.forEach((r, i) => {
        if (!r.path || r.path.length < 2) return;
        const key = r.enemy >= 0 ? `${Math.min(i, r.enemy)}-${Math.max(i, r.enemy)}` : `x${i}`;
        routes.push({ i, enemy: r.enemy, d: r.d, team: a.teams[i], dup: seen.has(key), pts: simplifyPath(g, r.path) });
        seen.add(key);
      });
    }
  } catch (e) { console.error('接敌路线计算失败', e); }
  routeCache = { sig, snap, routes };
}
function drawRoutes(ctx, now) {
  if (!S.snapshot) return;
  const snap = snapId(S.snapshot), sig = analysisSig();
  if (!routeCache || routeCache.snap !== snap) buildRoutesNow();
  else if (routeCache.sig !== sig) { clearTimeout(routeTimer); routeTimer = setTimeout(() => { buildRoutesNow(); scheduleRender(); }, 90); }
  const rs = routeCache?.routes || []; if (!rs.length) return;
  const sel = S.selectedSpawn, z = S.view.zoom, w = clamp(z * 0.5, 1.6, 4);
  const off = S.animate ? -(now / 28) % 16 : 0;
  ctx.save(); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const line = r => { ctx.beginPath(); r.pts.forEach(([rr, cc], k) => { const [x, y] = toScreen(rr, cc); k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); };
  for (const r of rs) {
    const focus = sel >= 0 ? r.i === sel : !r.dup;
    if (!focus && (sel < 0 || r.dup)) continue;
    const col = teamColor(r.team);
    ctx.globalAlpha = sel >= 0 && !focus ? 0.22 : 1;
    line(r); ctx.strokeStyle = 'rgba(0,0,0,.45)'; ctx.lineWidth = w + 3; ctx.setLineDash([]); ctx.stroke();
    line(r); ctx.strokeStyle = col; ctx.lineWidth = w; ctx.setLineDash([w * 3.2, w * 2.2]); ctx.lineDashOffset = off; ctx.stroke();
  }
  ctx.setLineDash([]); ctx.globalAlpha = 1;
  const lab = sel >= 0 ? rs.find(r => r.i === sel) : null;
  if (lab && lab.pts.length) {
    const [rr, cc] = lab.pts[Math.floor(lab.pts.length / 2)], [x, y] = toScreen(rr, cc), t = `${Math.round(lab.d)} 格`;
    ctx.font = '700 11px system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const tw = ctx.measureText(t).width + 12;
    ctx.fillStyle = 'rgba(10,16,28,.88)'; ctx.strokeStyle = teamColor(lab.team); ctx.lineWidth = 1.2;
    ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x - tw / 2, y - 10, tw, 20, 10); else ctx.rect(x - tw / 2, y - 10, tw, 20); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.fillText(t, x, y + 0.5);
  }
  ctx.restore();
}

/* ------------------------------------------------------------------ 择优生成（3.7.0 新增，Ctrl+Shift+Enter）
 * 做图时最常见的操作是「不满意 → 再生成一次」，一张张比较既慢又容易错过更好的那张。
 * 这里一次生成 N 张候选（每张都走与「生成地图」相同的出生点智能布局），逐张自动体检，按
 * 综合分 = 健康度 55% + 出生点公平度 45% 排序，以缩略图并排展示，点选一张即可采用。
 * 在用户采用之前当前地图保持不变；采用时先备份当前地图（可「找回上一张」）。
 * 限制：只有最后生成的那张与引擎内部状态一致，选中其他候选时地形分步编辑不可用（出生点编辑 / 导出不受影响）。 */
const BEST_KEY = 'tmx_bestof_n', BEST_MAX_AREA = 400 * 400;
let bestOfN = (() => { try { return clamp(Number(localStorage.getItem(BEST_KEY)) || 4, 2, 8); } catch { return 4; } })();
function updateBestLabel() { const el = $('bestOfLabel'); if (el) el.textContent = `择优 ×${bestOfN}`; }
/** 在候选快照上临时执行出生点布局 / 体检 / 缩略图（这些函数都读取全局 S），结束后完整恢复当前地图状态 */
function sandbox(s, fn) {
  const keep = { snapshot: S.snapshot, auth: S.spawnAuthority, teams: S.teamOverrides, opt: S.lastOptimized, sel: S.selectedSpawn, pop: new Map(spawnPop) };
  S.snapshot = s; S.teamOverrides = new Map(); S.selectedSpawn = -1;
  try { return fn(); }
  finally {
    S.snapshot = keep.snapshot; S.spawnAuthority = keep.auth; S.teamOverrides = keep.teams; S.lastOptimized = keep.opt; S.selectedSpawn = keep.sel;
    spawnPop.clear(); keep.pop.forEach((v, k) => spawnPop.set(k, v));
  }
}
function buildCandidate(r, idx) {
  const s = r?.snapshot; if (!s || !r.tmx_bytes?.length) return null;
  r.quick_frames = null; r.frames = null;
  return sandbox(s, () => {
    applySpawnPolicy(s, 'quick_generate');
    const spawns = currentSpawns();
    // 3.9.0：择优生成的每张候选也要计入近家资源点，否则「资源分配」体检分与实际导出结果对不上，
    // 排序/推荐也会偏向「候选阶段看似资源够、采用后才自动补点」的方案。规划是同步的，sandbox 内可直接调用；
    // 实际写入 TMX 的异步修补延后到 adoptCandidate（只对用户最终选中的那一张做，其余候选直接丢弃不必浪费工作量）。
    const near = planNearSpawnResources(s, spawns);
    const a = analyzeMap(s, spawns), f = spawnFairness(spawns, s);
    const cv = drawExportPng(240, 'dots');
    const health = a?.score ?? 0;
    return {
      idx, snap: s, tmx: r.tmx_bytes, spawns, health, fair: f.score || 0, score: Math.round(health * 0.55 + (f.score || 0) * 0.45),
      sum: { conn: !a || a.n < 2 || a.conn.allConnected || a.conn.teamsApart, rush: a?.rush?.ratio ?? 1, terr: a?.terr?.ratio ?? 1, land: a?.comp?.land ?? 0 },
      thumb: cv ? cv.toDataURL('image/png') : '', epoch: S.engineEpoch, shapeSeed: r.shapeSeed ?? null, shapeStats: r.shapeStats || null,
      nearResAdded: near.added.map(x => x.p)
    };
  });
}
function clearBusyThumbs() { const b = $('busyThumbs'); if (b) { b.innerHTML = ''; b.hidden = true; } }
function addBusyThumb(c) {
  const b = $('busyThumbs'); if (!b || !c.thumb) return;
  b.hidden = false;
  const el = document.createElement('span'); el.className = 'busy-thumb';
  el.innerHTML = `<img src="${c.thumb}" alt=""><b>${c.score}</b>`;
  b.appendChild(el);
}
async function generateBestOf() {
  if (!guard()) return;
  normalizeParamInputs();
  const p = params(), area = p.width * p.height;
  if (area > BEST_MAX_AREA) { toast(`择优生成适用于 400×400 以内的地图（当前 ${p.width}×${p.height}），大地图请直接「生成地图」`, 'warn', 4800); return; }
  const n = clamp(bestOfN, 2, area > 256 * 256 ? 4 : 8);
  const cands = [];
  let cancelled = false;
  await locked(async () => {
    stopAnimation();
    const bp = await blueprint();
    clearBusyThumbs();
    const seqBefore = Engine.seq; // 3.19.0
    const useShape = shapeActive(), seed0 = useShape ? shapeSeed() : 0;
    for (let i = 0; i < n; i++) {
      busy(true, `正在择优生成 ${i + 1}/${n}…`, useShape ? `「${shapeMeta(shapeState.id).label}」形态 · 每张候选地图都会自动体检评分` : '每张候选地图都会自动体检评分', Math.round(i / n * 100));
      let r;
      try { r = useShape ? await shapeCandidateRaw(p, i === 0 ? seed0 : randSeed(), bp) : await Engine.call('quick_generate', { ...p, blueprintXml: bp }); }
      catch (e) {
        if (e.cancelled) { cancelled = true; break; }
        if (useShape) { console.warn('候选生成失败', e); continue; }
        try { await Engine.ready; r = await Engine.call('quick_generate', { ...p, numPlayers: 0, blueprintXml: bp }); } // 与「生成地图」相同的引擎布点失败兜底
        catch (e2) { if (e2.cancelled) { cancelled = true; break; } console.warn('候选生成失败', e2); continue; }
      }
      await nextFrame();
      const c = buildCandidate(r, i);
      if (c) { c.params = p; cands.push(c); addBusyThumb(c); } // 3.19.0：记下生成参数，采用后配方码以它为准
    }
    /* 3.19.0 修复（第十七轮审查 · 缺陷 5）：旧版只在「至少有一张候选」时才把当前地图标记为引擎状态失效。
     * 若候选全部失败（如形态候选在导入引擎之后的步骤出错、且未触发引擎重启），引擎里其实已经是半张候选地图，
     * 当前地图却仍被当作「可分步编辑」，之后的画笔 / 资源等操作会作用在错误的引擎状态上。现在只要发出过引擎指令就标记。 */
    if (S.source === 'engine' && Engine.seq !== seqBefore) S.snapshotEpoch = -1; // 引擎状态已被候选覆盖：当前地图不能再做地形分步编辑
    if (cands.length) {
      busy(true, cancelled ? '已取消，整理已生成的方案…' : '正在排序候选方案…', '', 100, { cancellable: false });
      await sleep(420);
    }
    busy(false);
  });
  if (!cands.length) { if (!cancelled) toast('没有生成成功的候选方案', 'error'); return; }
  await showCandidates(cands, cancelled);
}
async function showCandidates(cands, cancelled) {
  const ranked = [...cands].sort((a, b) => b.score - a.score || b.health - a.health);
  let pick = ranked[0];
  const card = (c, rank) => `<button type="button" class="cand${rank === 0 ? ' selected best' : ''}" data-i="${c.idx}" style="--d:${rank * 70}ms" aria-label="方案 ${rank + 1}，综合 ${c.score}">
      <span class="cand-img"><img src="${c.thumb}" alt=""></span>
      <span class="cand-rank">${rank === 0 ? '★ 推荐' : '#' + (rank + 1)}</span>
      <span class="cand-score"><b>${c.score}</b><small>综合</small></span>
      <span class="cand-meta"><em>体检 ${c.health}</em><em>公平 ${c.fair}</em><em>${c.spawns.length} 人</em>${c.shapeSeed != null ? `<em>种子 ${c.shapeSeed}</em>` : ''}${c.sum.rush < 0.9 ? `<em class="warn">接敌 ${Math.round(c.sum.rush * 100)}%</em>` : ''}${c.sum.conn ? '' : '<em class="bad">不连通</em>'}</span>
    </button>`;
  const opts = [2, 3, 4, 6, 8].map(v => `<option value="${v}"${v === bestOfN ? ' selected' : ''}>${v} 张</option>`).join('');
  const body = `<p class="help-p">${cancelled ? '已取消，' : ''}共 ${cands.length} 张候选地图，按<b>综合分</b>（体检健康度 55% + 出生点公平度 45%）排序。点选一张后「采用」；当前地图会先备份，可在「项目 / 恢复」找回。双击缩略图可直接采用。</p>
    <div class="cand-grid">${ranked.map(card).join('')}</div>
    <div class="cand-tools"><label class="cand-n"><span>每次择优生成</span><select id="candN" aria-label="每次择优生成的候选数量">${opts}</select></label>
      <button type="button" id="candExport" class="cand-export" title="把这 ${cands.length} 张候选各自的 TMX + 小地图打包成一个 ZIP，方便一次拿走、之后慢慢挑">导出全部 ${cands.length} 张 ZIP</button></div>`;
  const p = uiChoice('择优生成 · 挑一张', body, [{ key: 'cancel', label: S.snapshot ? '保留当前地图' : '都不要' }, { key: 'ok', label: '采用所选', primary: true }], { wide: true });
  requestAnimationFrame(() => {
    const box = $('modalBody');
    box.querySelectorAll('.cand').forEach(el => {
      const c = cands.find(x => x.idx === Number(el.dataset.i));
      el.onclick = () => { box.querySelectorAll('.cand').forEach(x => x.classList.toggle('selected', x === el)); pick = c; };
      el.ondblclick = () => { pick = c; closeModal('ok'); };
    });
    const ex = $('candExport');
    if (ex) ex.onclick = () => exportCandidatesZip(ranked, ex);
    const sel = $('candN');
    if (sel) sel.onchange = () => { bestOfN = clamp(Number(sel.value) || 4, 2, 8); try { localStorage.setItem(BEST_KEY, String(bestOfN)); } catch { /* ignore */ } updateBestLabel(); };
  });
  const k = await p;
  if (k !== 'ok' || !pick) { toast(S.snapshot ? '已保留当前地图，候选方案已丢弃' : '未采用候选方案'); return; }
  const last = cands[cands.length - 1];
  await adoptCandidate(pick, pick === last && !cancelled && pick.epoch === S.engineEpoch);
}
/* ------------------------------------------------------------------ 导出全部候选（3.14.0 新增）
 * 择优生成一次出 N 张图，过去只能采用其中一张，其余随弹窗关闭而丢弃。做地图包 / 想拿回去慢慢比较时很可惜。
 * 现在可把全部候选各自的 TMX + 同名小地图 + 说明打包成一个 ZIP：每张候选单独补写自己的近家资源点与出生点（与「采用」走同一套补丁，
 * 不改动候选本身，之后仍可正常采用），小地图在沙箱里按各自快照绘制，不会影响当前画布。 */
async function candidateTmx(c) {
  let tmx = c.tmx;
  if (c.nearResAdded?.length) { try { const r = await patchTmxItems(tmx, c.nearResAdded); if (r.changed) tmx = r.tmx; } catch (e) { console.warn('候选写入近家资源点失败', e); } }
  try { const r = await patchTmxUnits(tmx, c.spawns); if (r.changed) tmx = r.tmx; } catch (e) { console.warn('候选写入出生点失败', e); }
  return tmx;
}
async function candidatePng(c) {
  let maxDim = PNG_MAX_DIM;
  for (let step = 0; step < 14; step++) {
    const cv = sandbox(c.snap, () => drawExportPng(maxDim, mapPngStyle()));
    if (!cv) return null;
    const blob = await canvasToPng(cv);
    if (blob && blob.size <= PNG_MAX_BYTES) return new Uint8Array(await blob.arrayBuffer());
    maxDim = Math.max(96, Math.floor(maxDim * 0.92));
  }
  return null;
}
async function exportCandidatesZip(ranked, btn) {
  if (btn?.disabled) return;
  const label = btn?.textContent;
  if (btn) btn.disabled = true;
  try {
    const stampStr = stamp(), custom = sanitizeName($('mapName').value), entries = [], lines = [];
    for (let i = 0; i < ranked.length; i++) {
      const c = ranked[i];
      if (btn) btn.textContent = `打包中 ${i + 1}/${ranked.length}…`;
      await nextFrame();
      const base = `${custom || `[p${c.spawns.length}]铁锈地图_${stampStr}`}_方案${i + 1}`;
      entries.push({ name: `${base}.tmx`, data: await candidateTmx(c) });
      const png = await candidatePng(c);
      if (png) entries.push({ name: `${base}_map.png`, data: png });
      const [rr, cc] = dimsOf(c.snap);
      lines.push(`方案 ${i + 1}${i === 0 ? '（推荐）' : ''}：${base}.tmx　${cc}×${rr}　出生点 ${c.spawns.length}　资源点 ${(c.snap.resource_positions || []).length}　综合 ${c.score}（体检 ${c.health} / 公平度 ${c.fair}）${c.shapeSeed != null ? `　形态种子 ${c.shapeSeed}` : ''}${c.sum.conn ? '' : '　⚠ 出生点陆路不连通'}`);
    }
    entries.push({ name: '候选说明.txt', data: new TextEncoder().encode(`铁锈战争地图生成器离线版 v${APP_VERSION} · 择优生成候选包\r\n导出时间：${new Date().toLocaleString()}\r\n排序依据：综合分 = 体检健康度 55% + 出生点公平度 45%\r\n\r\n${lines.join('\r\n')}\r\n`) });
    if (btn) btn.textContent = '正在保存…';
    beginShareBatch();
    const r = await saveFile(zipStore(entries), `${custom || `铁锈地图_择优候选_${stampStr}`}.zip`, 'application/zip', ExportLoc.target());
    if (r.desktop) window.DesktopBridge.savedToast(r, `已导出 ${ranked.length} 张候选：${r.name}`);
    else toast(r.pending ? '等待存储权限授予后自动保存' : `已导出 ${ranked.length} 张候选${r.where ? `（${r.where}）` : ''}：${r.name || '候选包.zip'}`, 'success', 4200, r.pending ? {} : shareAction());
  } catch (e) { toast('导出候选失败：' + e.message, 'error', 4200); }
  finally { if (btn) { btn.disabled = false; btn.textContent = label; } }
}
async function adoptCandidate(c, editable) {
  await locked(async () => {
    stageCompare(); // 3.26.0
    const backedUp = await backupCurrent();
    const prev = S.snapshot;
    resetEditorState();
    S.source = 'engine';
    S.snapshotEpoch = editable ? S.engineEpoch : -1;
    S.lastTmx = c.tmx; S.tmxDirty = false; S.unitsDirty = true; S.slotVerified = null;
    // 3.9.0：c.snap.resource_positions 在 buildCandidate 阶段已经算过近家资源点，这里只需把同一批点补写进
    // 这一张候选自己的 TMX（c.tmx）；没被选中的候选连同它们的 nearResAdded 一起丢弃，不做多余的 TMX 修补。
    if (c.nearResAdded?.length) {
      S.nearResKeys = new Set([...S.nearResKeys, ...c.nearResAdded.map(keyOf)]);
      try { const r = await patchTmxItems(S.lastTmx, c.nearResAdded); if (r.changed) S.lastTmx = r.tmx; }
      catch (e) { console.warn('择优生成：近家资源点写入 TMX 失败', e); }
    }
    setExportEnabled(true);
    c.snap.cc_positions = c.spawns.map(p => [...p]);
    S.spawnAuthority = c.spawns.map(p => [...p]);
    markSpawnPop(c.spawns, true);
    const [nr, nc] = dimsOf(c.snap), [or, oc] = prev ? dimsOf(prev) : [0, 0];
    S.selectedSpawn = -1;
    setSnapshot(c.snap, { fit: nr !== or || nc !== oc || !S.view.fitted, fade: true });
    attachCliffMask(c.snap, c.tmx);
    if (c.shapeSeed != null) afterShapeGenerated(c.shapeSeed, c.shapeStats);
    S.mapRecipe = c.params ? recipeFrom(c.params, S.mapShape) : null; // 3.19.0
    releaseImportedName(); commitCompare();
    updateDirtyNote(); queueAutoSave(); pulseMap();
    pushHistorySnapshot('择优采用').catch(() => {}); // 3.11.0：择优采用也入历史
    setStatus(`已采用择优方案（综合 ${c.score} · 体检 ${c.health} · 公平度 ${c.fair}）`);
    toast(`已采用方案 · 综合分 ${c.score}${editable ? '' : ' · 如需地形分步编辑请重新生成'}`, 'success', 4400, backedUp ? { action: { label: '找回上一张', fn: () => restorePrevious() } } : {});
  });
}

/* ------------------------------------------------------------------ 分享海报（3.7.0 新增）
 * 导出一张适合发到群聊 / 论坛的竖版 PNG：地图（地形 + 悬崖 + 资源 + 带编号的出生点，可叠加领地）+ 标题 + 体检数据。
 * 宽 1080px，高度随地图比例变化；所有绘制在本机 Canvas 完成。 */
function fitText(ctx, text, maxW) {
  if (ctx.measureText(text).width <= maxW) return text;
  let t = text; while (t.length > 1 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1);
  return t + '…';
}
function roundRectPath(ctx, x, y, w, h, r) { ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h); }
function buildPoster() {
  const s = S.snapshot, [rows, cols] = dims(); if (!s || !rows || !cols) return null;
  let a = null; try { a = analyzeMap(); } catch { /* 体检失败时只画地图 */ }
  const f = spawnFairness(), sp = currentSpawns(), res = s.resource_positions || [];
  const W = 1080, pad = 54, maxSide = W - pad * 2;
  const k = maxSide / Math.max(rows, cols), mw = Math.round(cols * k), mh = Math.round(rows * k);
  const headH = 168, statH = a && a.n >= 2 ? 300 : 90, footH = 76, H = headH + mh + statH + footH;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d'), FONT = 'system-ui,"Microsoft YaHei","PingFang SC","Noto Sans CJK SC",sans-serif';
  const bg = ctx.createLinearGradient(0, 0, W, H); bg.addColorStop(0, '#0f2140'); bg.addColorStop(0.55, '#0a1528'); bg.addColorStop(1, '#060c18');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W * 0.86, 40, 10, W * 0.86, 40, 520); glow.addColorStop(0, 'rgba(75,138,255,.35)'); glow.addColorStop(1, 'rgba(75,138,255,0)');
  ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);
  const glow2 = ctx.createRadialGradient(80, H - 60, 10, 80, H - 60, 460); glow2.addColorStop(0, 'rgba(55,211,155,.20)'); glow2.addColorStop(1, 'rgba(55,211,155,0)');
  ctx.fillStyle = glow2; ctx.fillRect(0, 0, W, H);
  // 标题
  const title = sanitizeName($('mapName').value) || '铁锈战争 · 自定义地图';
  ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  ctx.fillStyle = '#ffd45c'; ctx.font = `800 20px ${FONT}`; ctx.fillText('RUSTED WARFARE MAP', pad, 62);
  ctx.fillStyle = '#eef4ff'; ctx.font = `800 46px ${FONT}`; ctx.fillText(fitText(ctx, title, W - pad * 2), pad, 116);
  ctx.fillStyle = '#9fb4d3'; ctx.font = `500 22px ${FONT}`;
  ctx.fillText(`${cols} × ${rows} · ${sp.length} 个出生点 · ${res.length} 个资源点 · ${MIRROR_LABELS[s.meta?.mirroring] || '不对称'}`, pad, 150);
  // 地图
  const mx = Math.round((W - mw) / 2), my = headH;
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.55)'; ctx.shadowBlur = 36; ctx.shadowOffsetY = 12;
  roundRectPath(ctx, mx, my, mw, mh, 18); ctx.fillStyle = '#050b14'; ctx.fill(); ctx.restore();
  ctx.save(); roundRectPath(ctx, mx, my, mw, mh, 18); ctx.clip(); ctx.imageSmoothingEnabled = false;
  const base = baseCanvasFor(terrainMatrix() || getMatrix('id_matrix')); if (base) ctx.drawImage(base, mx, my, mw, mh);
  const wall = wallLayerFor(); if (wall) ctx.drawImage(wall, mx, my, mw, mh);
  if (S.layers.territory && terrCache?.canvas && terrCache.snap === snapId(s)) {
    const g = terrCache.canvas._grid; ctx.globalAlpha = 0.5;
    ctx.drawImage(terrCache.canvas, mx, my, g.cols * g.scale * k, g.rows * g.scale * k); ctx.globalAlpha = 1;
  }
  ctx.imageSmoothingEnabled = true;
  const at = (r, c) => [mx + (c + 0.5) * k, my + (r + 0.5) * k];
  const rr = clamp(Math.min(mw, mh) * 0.012, 4, 9);
  for (const [r, c] of res) { const [x, y] = at(r, c); drawPngResource(ctx, x, y, rr); }
  if (sp.length) {
    const pts = sp.map(q => at(q[0], q[1]));
    let R = clamp(Math.min(mw, mh) * 0.022, 7, 19), dMin = Infinity;
    for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) dMin = Math.min(dMin, Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1]));
    if (Number.isFinite(dMin)) R = clamp(Math.min(R, dMin * 0.48), 5, 19);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    sp.forEach((q, i) => drawPngSpawn(ctx, pts[i][0], pts[i][1], R, teamOf(q, i), R >= 8 ? String(i + 1) : ''));
  }
  ctx.restore();
  roundRectPath(ctx, mx + 0.5, my + 0.5, mw - 1, mh - 1, 18); ctx.strokeStyle = 'rgba(160,190,240,.35)'; ctx.lineWidth = 1.5; ctx.stroke();
  // 数据区
  let y0 = my + mh + 40;
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  if (a && a.n >= 2) {
    const lvCol = a.score >= 80 ? '#55e6a5' : a.score >= 60 ? '#ffbd5a' : '#ff6b6b';
    const cx = pad + 78, cy = y0 + 92, R = 70;
    ctx.lineWidth = 14; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(255,255,255,.10)'; ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, R, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * a.score / 100); ctx.strokeStyle = lvCol; ctx.stroke();
    ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.font = `800 48px ${FONT}`; ctx.fillText(String(a.score), cx, cy + 12);
    ctx.fillStyle = '#9fb4d3'; ctx.font = `600 17px ${FONT}`; ctx.fillText('体检健康度', cx, cy + R + 44);
    const tiles = [
      ['出生点公平度', `${f.score ?? 0}`, '/100'],
      ['领地 A / B', a.hasBoth && a.terr.owned ? `${Math.round(a.terr.share.A / a.terr.owned * 100)} : ${Math.round(a.terr.share.B / a.terr.owned * 100)}` : '—', '%'],
      ['接敌距离 A / B', a.rush?.avgA != null && a.rush?.avgB != null ? `${Math.round(a.rush.avgA)} / ${Math.round(a.rush.avgB)}` : '—', '格'],
      ['资源 A / B', a.hasBoth ? `${a.res.team.A} / ${a.res.team.B}` : `${res.length}`, '个'],
      ['陆路连通', a.conn.allConnected ? '全部连通' : a.conn.teamsApart ? '两岸隔开' : '存在隔断', ''],
      ['地形', `陆地 ${Math.round(a.comp.land * 100)}%`, '']
    ];
    const tx0 = pad + 190, tw = (W - pad - tx0 - 24) / 3, th = 104;
    tiles.forEach(([lab, val, unit], i) => {
      const x = tx0 + (i % 3) * (tw + 12), y = y0 + Math.floor(i / 3) * (th + 12);
      roundRectPath(ctx, x, y, tw, th, 16); ctx.fillStyle = 'rgba(255,255,255,.055)'; ctx.fill(); ctx.strokeStyle = 'rgba(160,190,240,.18)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.textAlign = 'left'; ctx.fillStyle = '#8ea5c6'; ctx.font = `600 16px ${FONT}`; ctx.fillText(lab, x + 18, y + 32);
      ctx.fillStyle = '#f2f6ff'; ctx.font = `800 30px ${FONT}`; const v = fitText(ctx, val, tw - 60); ctx.fillText(v, x + 18, y + 76);
      if (unit) { const vw = ctx.measureText(v).width; ctx.fillStyle = '#8ea5c6'; ctx.font = `600 16px ${FONT}`; ctx.fillText(unit, x + 24 + vw, y + 76); }
    });
    if (a.hasBoth && a.terr.owned) {
      const by = y0 + 2 * (th + 12) + 14, bw = W - pad * 2, A = a.terr.share.A / a.terr.owned;
      roundRectPath(ctx, pad, by, bw, 12, 6); ctx.fillStyle = TEAM_COLORS.B; ctx.fill();
      roundRectPath(ctx, pad, by, Math.max(12, bw * A), 12, 6); ctx.fillStyle = TEAM_COLORS.A; ctx.fill();
    }
  }
  ctx.textAlign = 'center'; ctx.fillStyle = '#6f86a6'; ctx.font = `500 17px ${FONT}`;
  const d = new Date(), ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  ctx.fillText(`铁锈战争地图生成器 · TMX MapForge Offline v${APP_VERSION} · ${ds}`, W / 2, H - 32);
  return cv;
}
async function showPoster() {
  if (!S.snapshot) { toast('请先生成或导入地图', 'warn'); return; }
  if (!guard()) return;
  S.locked = true;
  let cv = null, bytes = null;
  try {
    busy(true, '正在绘制分享海报…', '', null, { cancellable: false }); await nextFrame();
    cv = buildPoster();
    const blob = cv && await canvasToPng(cv);
    bytes = blob ? new Uint8Array(await blob.arrayBuffer()) : null;
  } catch (e) { console.error(e); toast('海报生成失败：' + e.message, 'error'); }
  finally { busy(false); S.locked = false; }
  if (!bytes) return;
  const url = URL.createObjectURL(new Blob([bytes], { type: 'image/png' })), name = `${exportBaseName()}_poster.png`;
  const k = await uiChoice('分享海报', `<div class="poster-preview"><img src="${url}" alt="分享海报预览"></div>
    <div class="png-meta"><span>${cv.width} × ${cv.height}</span><span>${(bytes.length / 1024).toFixed(0)} KB</span><span>PNG</span></div>
    <p class="help-p">适合发到群聊 / 论坛展示：包含地形、悬崖、带编号的出生点、资源点与体检数据。${S.layers.territory ? '已叠加领地图层。' : '先开启「领地」图层再生成，海报会同时显示双方领地。'}<br>文件名：<code>${escapeHtml(name)}</code></p>`,
  [{ key: 'cancel', label: '关闭' }, { key: 'save', label: '保存海报', primary: true }], { wide: true });
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  if (k !== 'save') return;
  await locked(async () => {
    try {
      beginShareBatch();
      const r = await saveFile(bytes, name, 'image/png');
      if (r.desktop) window.DesktopBridge.savedToast(r, `海报已保存：${r.name}`);
      else toast(r.pending ? '等待存储权限授予后自动保存' : `海报已保存：${r.name || name}`, 'success', 3600, r.pending ? {} : shareAction());
    } catch (e) { toast('保存海报失败：' + e.message, 'error'); }
  });
}

/* ------------------------------------------------------------------ 另存为 / 导出位置（3.8.0 新增）
 * 旧版导出只能静默写进「下载」目录，文件多了很难找，也没法直接存进游戏的地图文件夹。现在：
 *   · Android：可通过系统文件夹选择器（SAF）指定一个导出文件夹并长期授权；「另存为…」面板里可改文件名、
 *     选择导出内容（TMX+小地图 / ZIP / 项目文件）和位置（下载目录 / 导出文件夹），并可设为默认位置。
 *   · PC：位置即「项目 / 恢复」中的导出目录，可在面板里直接更改。
 *   · 浏览器调试：只能交给浏览器下载。
 * 面板本身是应用内对话框，顶部留出安全区（刘海 / 状态栏），在 Android 15 强制边到边时也不会被遮挡；
 * 系统文件夹选择器直接以「下载」或上次选择的文件夹为初始位置打开，无需再从「共享存储」根目录逐级导航。 */
const EXPORT_TARGET_KEY = 'tmx_export_target_v1';
const ExportLoc = {
  folder: { set: false },           // Android 导出文件夹 {set, name, path}
  pref: 'downloads',                 // 默认位置：downloads | folder
  waiters: [],
  android() { return !!window.AndroidBridge?.chooseExportFolder && !window.DesktopBridge; },
  load() {
    try { this.pref = localStorage.getItem(EXPORT_TARGET_KEY) === 'folder' ? 'folder' : 'downloads'; } catch { /* ignore */ }
    this.refresh();
  },
  refresh() {
    if (!this.android()) return this.folder;
    try { this.folder = JSON.parse(window.AndroidBridge.getExportFolder() || '{}') || { set: false }; } catch { this.folder = { set: false }; }
    if (!this.folder.set && this.pref === 'folder') this.setPref('downloads');
    renderExportLocRow();
    return this.folder;
  },
  setPref(p) { this.pref = p === 'folder' ? 'folder' : 'downloads'; try { localStorage.setItem(EXPORT_TARGET_KEY, this.pref); } catch { /* ignore */ } renderExportLocRow(); },
  /** 当前默认写入目标（传给原生层） */
  target() { return this.android() && this.pref === 'folder' && this.folder.set ? 'tree' : 'downloads'; },
  /** 打开系统文件夹选择器；resolve 最新的文件夹信息（取消时 cancelled=true） */
  choose() {
    if (!this.android()) return Promise.resolve(this.folder);
    return new Promise(resolve => { this.waiters.push(resolve); window.AndroidBridge.chooseExportFolder(); });
  },
  clear() { if (this.android()) { window.AndroidBridge.clearExportFolder(); this.refresh(); this.setPref('downloads'); } },
  label(t = this.target()) {
    if (window.DesktopBridge) return '导出目录';
    if (!this.android()) return '浏览器下载';
    return t === 'tree' ? `文件夹「${this.folder.name || '已选择'}」` : '下载目录';
  }
};
/* 原生层回调：选择结果 / 授权失效 */
window.__onExportFolder = raw => {
  let j = {}; try { j = typeof raw === 'string' ? JSON.parse(raw) : (raw || {}); } catch { j = {}; }
  ExportLoc.folder = j.set ? { set: true, name: j.name, path: j.path } : { set: false };
  if (j.lost) { ExportLoc.setPref('downloads'); toast(`导出文件夹已无法访问（${j.error || '授权已失效'}），已改为保存到下载目录`, 'warn', 6000); }
  else if (j.error) toast(j.error, 'warn', 5000);
  renderExportLocRow();
  const ws = ExportLoc.waiters.splice(0); ws.forEach(w => w({ ...ExportLoc.folder, cancelled: !!j.cancelled }));
};
function renderExportLocRow() {
  const row = $('exportLocRow'); if (!row) return;
  row.hidden = !ExportLoc.android();
  if (row.hidden) return;
  const f = ExportLoc.folder;
  $('exportLocName').textContent = ExportLoc.pref === 'folder' && f.set ? (f.path || f.name) : '下载目录（Download）';
  $('exportLocTag').textContent = ExportLoc.pref === 'folder' && f.set ? '自选文件夹' : '默认';
  $('exportLocReset').disabled = !(ExportLoc.pref === 'folder' && f.set);
}
async function pickExportFolder() {
  const f = await ExportLoc.choose();
  if (f.cancelled) return false;
  if (f.set) { ExportLoc.setPref('folder'); toast(`导出位置已设为：${f.path || f.name}`, 'success'); return true; }
  return false;
}
async function showSaveAs() {
  if (!S.lastTmx) { toast('请先生成或导入地图', 'warn'); return; }
  if (S.locked) { guard(); return; }
  const desk = !!window.DesktopBridge, android = ExportLoc.android();
  if (android) ExportLoc.refresh();
  let deskDir = null;
  if (desk) { try { deskDir = await window.DesktopBridge.getDir?.(); } catch { deskDir = null; } }
  let kind = 'pair', target = ExportLoc.target();
  const base0 = exportBaseName();
  const locHtml = () => {
    if (desk) return `<div class="sa-loc-opt active" data-t="downloads"><i class="sa-ico">📁</i><span><b>导出目录</b><small>${escapeHtml(deskDir?.path || '系统下载目录')}</small></span><button type="button" id="saPick" class="sa-pick">更改…</button></div>`;
    if (!android) return `<div class="sa-loc-opt active" data-t="downloads"><i class="sa-ico">⬇</i><span><b>浏览器下载</b><small>由浏览器决定保存位置</small></span></div>`;
    const f = ExportLoc.folder;
    return `<button type="button" class="sa-loc-opt${target === 'downloads' ? ' active' : ''}" data-t="downloads" role="radio" aria-checked="${target === 'downloads'}"><i class="sa-ico">⬇</i><span><b>下载目录</b><small>内部存储/Download</small></span></button>
      <div class="sa-loc-opt${target === 'tree' ? ' active' : ''}${f.set ? '' : ' empty'}" data-t="tree" role="radio" tabindex="0" aria-checked="${target === 'tree'}"><i class="sa-ico">📁</i><span><b>${f.set ? escapeHtml(f.name || '导出文件夹') : '自选文件夹'}</b><small>${f.set ? escapeHtml(f.path || '') : '尚未选择，点「选择…」打开系统文件夹选择器'}</small></span><button type="button" id="saPick" class="sa-pick">${f.set ? '更换…' : '选择…'}</button></div>`;
  };
  const body = `<div class="saveas">
    <label class="wide-label"><span>文件名</span><input id="saName" type="text" maxlength="80" value="${escapeHtml(base0)}" autocomplete="off" spellcheck="false"></label>
    <div class="sa-label">导出内容</div>
    <div class="sa-seg" role="radiogroup" aria-label="导出内容">
      <button type="button" data-k="pair" class="active">TMX + 小地图</button><button type="button" data-k="zip">ZIP 包</button><button type="button" data-k="project">项目文件</button>
    </div>
    <div class="sa-label">保存位置</div>
    <div class="sa-loc" id="saLoc" role="radiogroup" aria-label="保存位置">${locHtml()}</div>
    ${android ? '<label class="sa-remember"><input id="saRemember" type="checkbox"> 设为默认导出位置（「导出 TMX+小地图」等按钮也保存到这里）</label>' : ''}
    <div class="sa-preview" id="saPreview"></div>
  </div>`;
  const pr = uiChoice('另存为', body, [{ key: 'cancel', label: '取消' }, { key: 'ok', label: '保存', primary: true }], { wide: true });
  const files = () => {
    const b = sanitizeName($('saName')?.value) || base0;
    return kind === 'pair' ? [`${b}.tmx`, `${b}_map.png`] : kind === 'zip' ? [`${b}.zip`] : [`${b}_project.json`];
  };
  const refresh = () => {
    const pv = $('saPreview'); if (!pv) return;
    pv.innerHTML = `将保存到 <b>${escapeHtml(desk ? (deskDir?.path || '导出目录') : ExportLoc.label(target))}</b>：${files().map(f => `<code>${escapeHtml(f)}</code>`).join(' ')}`;
    pv.classList.remove('pulse'); void pv.offsetWidth; pv.classList.add('pulse');
  };
  const bindLoc = () => {
    const box = $('saLoc'); if (!box) return;
    box.querySelectorAll('.sa-loc-opt[data-t]').forEach(el => {
      el.onclick = async ev => {
        if (ev.target.closest('#saPick')) return;
        const t = el.dataset.t;
        if (t === 'tree' && !ExportLoc.folder.set) { $('saPick')?.click(); return; }
        target = t; box.innerHTML = locHtml(); bindLoc(); refresh();
      };
    });
    const pick = $('saPick');
    if (pick) pick.onclick = async () => {
      if (desk) { try { const d = await window.DesktopBridge.chooseDir?.(); if (d) { deskDir = d; box.innerHTML = locHtml(); bindLoc(); refresh(); } } catch (e) { toast('选择目录失败：' + e, 'error'); } return; }
      const f = await ExportLoc.choose();
      if (f.set && !f.cancelled) target = 'tree';
      if (!$('saLoc')) return; // 面板已关闭
      box.innerHTML = locHtml(); bindLoc(); refresh();
    };
  };
  requestAnimationFrame(() => {
    document.querySelectorAll('.sa-seg button').forEach(b => b.onclick = () => {
      kind = b.dataset.k; document.querySelectorAll('.sa-seg button').forEach(x => x.classList.toggle('active', x === b)); refresh();
    });
    $('saName')?.addEventListener('input', refresh);
    bindLoc(); refresh();
    $('saName')?.select?.();
  });
  const k = await pr;
  if (k !== 'ok') return;
  const base = sanitizeName($('saName')?.value) || base0;
  if (android && $('saRemember')?.checked) ExportLoc.setPref(target === 'tree' ? 'folder' : 'downloads');
  const t = android ? target : undefined;
  if (kind === 'pair') await exportPair({ base, target: t });
  else if (kind === 'zip') await exportZipFn({ base, target: t });
  else await exportProject({ base, target: t });
}

/* ------------------------------------------------------------------ 地形形态（3.8.0 新增）
 * 11 套形态模板（岛屿 / 半岛 / 群岛 / 双河 / 山湖 / 大陆 / 沙漠 / 雪原 / 火山 / 迷宫 / 两岸狭路）移植自「锈匠地图生成器」，
 * 算法与对战化后处理见 terrain-shapes.js。形态在独立的 shape-worker.js 中计算（不占用引擎 Worker，取消时只结束它自己），
 * 结果是「水 / 平地 / 高地 / 坡道」矩阵，经引擎 set_coastline_from_image 导入后，沿用与大地图相同的分步流水线：
 *   形态 → 高度与海洋 → 资源 → JS 智能出生点 → 完成并生成 TMX。
 * 「经典」即原有的 5×5 海岸线模板算法，行为不变。
 * 所见即所得：预览使用的种子就是下一次生成使用的种子；种子框留空时每次生成后自动换一个新种子。 */
const SHAPE_KEY = 'tmx_shape_v1';
const SHAPE_THEMES = { 1: '丛林', 2: '雪山', 3: '火山', 4: '沙漠', 5: '森林' };
const ShapeWorker = {
  w: null, seq: 0, pending: new Map(),
  ensure() {
    if (this.w) return this.w;
    this.w = new Worker('./shape-worker.js');
    this.w.onmessage = e => {
      const m = e.data || {}, p = this.pending.get(m.id);
      if (!p) return;
      if (m.progress != null) { p.onProgress?.(m.stage, m.progress); return; }
      this.pending.delete(m.id);
      if (m.ok) p.resolve(m.result); else p.reject(new Error(m.error || '地形形态计算失败'));
    };
    this.w.onerror = e => { e.preventDefault?.(); this.reset(new Error('地形形态计算失败：' + (e.message || 'Worker 错误'))); };
    return this.w;
  },
  call(action, opts, onProgress) {
    const w = this.ensure();
    return new Promise((resolve, reject) => {
      const id = ++this.seq;
      this.pending.set(id, { resolve, reject, onProgress, action });
      w.postMessage({ id, action, opts });
    });
  },
  /** 取消：结束 Worker（大地图形态计算可能要十几秒），所有等待中的请求以「已取消」拒绝 */
  reset(err = new EngineError('操作已取消', { cancelled: true })) {
    try { this.w?.terminate(); } catch { /* ignore */ }
    this.w = null;
    for (const p of this.pending.values()) p.reject(err);
    this.pending.clear();
  }
};
const shapeState = { id: 'classic', land: 50, rough: '0.3', seedText: '', previewSeed: 0, auto: true, lastSeed: null, lastStats: null };
const shapeMeta = id => (window.TerrainShapes?.SHAPE_MAP.get(id)) || null;
const shapeActive = () => shapeState.id !== 'classic' && !!shapeMeta(shapeState.id);
const randSeed = () => 1 + Math.floor(Math.random() * 999999);
function shapeSeed() {
  const t = String($('shapeSeed')?.value ?? '').trim();
  // 3.24.0 修复：按生成器同一规则折叠到 [1, 2^31-2]（normSeed 对 2^31-1 以下的种子是恒等变换，旧种子不受影响）。
  // 旧版直接返回原值：输入 5000000000 这类大数时，地图用 normSeed 折叠后的种子，配方码却按 u32 截断写入，
  // 对方套用配方码得到的是另一张图；「当前地图种子」显示的也不是实际使用的种子。
  if (t !== '' && Number.isFinite(Number(t))) { const v = Math.abs(Math.trunc(Number(t))) || 1; return window.TerrainShapes ? TerrainShapes.normSeed(v) : v % 2147483647 || 7; }
  if (!shapeState.previewSeed) shapeState.previewSeed = randSeed();
  return shapeState.previewSeed;
}
function shapeOpts(p, seed) {
  return { shape: shapeState.id, width: p.width, height: p.height, seed, land: shapeState.land / 100, rough: Number(shapeState.rough), mirror: p.mirroring };
}
function saveShapePrefs() {
  try { localStorage.setItem(SHAPE_KEY, JSON.stringify({ id: shapeState.id, land: shapeState.land, rough: shapeState.rough, seed: $('shapeSeed').value, auto: shapeState.auto })); } catch { /* ignore */ }
}
function loadShapePrefs() {
  try {
    const s = JSON.parse(localStorage.getItem(SHAPE_KEY) || 'null');
    if (!s) return;
    if (s.id === 'classic' || shapeMeta(s.id)) shapeState.id = s.id;
    if (Number.isFinite(+s.land)) shapeState.land = clamp(+s.land, 10, 90);
    if (['0', '0.3', '0.8'].includes(String(s.rough))) shapeState.rough = String(s.rough);
    if (typeof s.auto === 'boolean') shapeState.auto = s.auto;
    if (s.seed != null) $('shapeSeed').value = s.seed;
  } catch { /* ignore */ }
}
function renderShapeGrid() {
  const box = $('shapeGrid'); if (!box || !window.TerrainShapes) return;
  const items = [{ id: 'classic', label: '经典', desc: '原有 5×5 海岸线模板算法' }, ...TerrainShapes.SHAPES];
  box.innerHTML = items.map((s, i) => `<button type="button" class="shape-tile${s.id === shapeState.id ? ' active' : ''}" data-shape="${s.id}" role="radio" aria-checked="${s.id === shapeState.id}" title="${escapeHtml(s.desc)}" style="--d:${i * 28}ms">
      <span class="shape-thumb">${s.id === 'classic' ? '<svg viewBox="0 0 40 40" aria-hidden="true"><g fill="currentColor"><rect x="4" y="4" width="9" height="9" rx="2"/><rect x="15.5" y="15.5" width="9" height="9" rx="2"/><rect x="27" y="4" width="9" height="9" rx="2"/><rect x="4" y="27" width="9" height="9" rx="2"/><rect x="27" y="27" width="9" height="9" rx="2"/><rect x="15.5" y="4" width="9" height="9" rx="2" opacity=".35"/><rect x="4" y="15.5" width="9" height="9" rx="2" opacity=".35"/><rect x="27" y="15.5" width="9" height="9" rx="2" opacity=".35"/><rect x="15.5" y="27" width="9" height="9" rx="2" opacity=".35"/></g></svg>' : `<img src="shapes/${s.id}.png" alt="" loading="lazy" decoding="async">`}</span>
      <span class="shape-name">${s.label}</span>${s.from ? '<i class="new-dot" aria-hidden="true">新</i>' : ''}</button>`).join('');
  box.querySelectorAll('.shape-tile').forEach(b => b.onclick = () => selectShape(b.dataset.shape, true));
}
function syncShapeUI() {
  const on = shapeActive(), m = shapeMeta(shapeState.id);
  $('shapeSec').classList.toggle('shape-on', on);
  $('shapeFields').hidden = !on;
  $('shapeDetail').hidden = !on;
  $('gridSec').classList.toggle('dimmed', on);
  $('gridSec').querySelector('.coast-note').hidden = !on;
  $('shapeLand').value = shapeState.land; $('shapeLandText').textContent = shapeState.land + '%';
  $('shapeRough').value = shapeState.rough;
  $('shapeAuto').classList.toggle('on', shapeState.auto); $('shapeAuto').setAttribute('aria-checked', String(shapeState.auto));
  $('shapeTag').textContent = on ? m.label : '经典';
  document.querySelectorAll('#shapeGrid .shape-tile').forEach(b => { const a = b.dataset.shape === shapeState.id; b.classList.toggle('active', a); b.setAttribute('aria-checked', String(a)); });
  if (on) {
    $('shapeTitle').textContent = m.label;
    $('shapeDesc').textContent = m.desc;
    $('shapeRec').innerHTML = `推荐：${m.size[0]}×${m.size[1]} · ${SHAPE_THEMES[m.theme]}主题 · ${MIRROR_LABELS[m.mirror]}`;
    // 3.25.0：陆地比例的参照物（陆地少则参照物大，陆地多则参照物小），滑块提示与之对应
    const ref = m.ref ? escapeHtml(m.ref) : '';
    $('shapeLandRef').textContent = m.ref ? `陆地 ↔ ${m.ref}` : '';
    $('shapeLand').closest('label').title = m.ref
      ? `陆地比例在「陆地 ↔ ${m.ref}」之间调节：陆地越少，${m.ref}越大；陆地越多，${m.ref}越小。山脉位置与地表纹理保持不变。`
      : '只改变陆地的多少：山脉位置与地表纹理保持不变';
    if (ref) $('shapeRec').innerHTML += `<br>陆地比例参照：陆地 ↔ ${ref}`;
  }
  const btn = document.querySelector('[data-act="run_coastline"]');
  if (btn) btn.textContent = on ? `生成「${m.label}」形态` : '生成海岸线';
  updateShapeSeedHint();
}
function updateShapeSeedHint() {
  const el = $('shapeSeedHint'); if (!el) return;
  const fixed = String($('shapeSeed').value).trim() !== '';
  el.innerHTML = (fixed ? '已固定种子，每次生成相同形态' : `预览种子 <b>${shapeSeed()}</b>，生成后自动换新`) + (shapeState.lastSeed != null ? ` · 当前地图 <a href="#" id="shapeReuse">${shapeState.lastSeed}</a>` : '');
  $('shapeReuse')?.addEventListener('click', ev => { ev.preventDefault(); $('shapeSeed').value = shapeState.lastSeed; saveShapePrefs(); updateShapeSeedHint(); queueShapePreview(); toast('已固定为当前地图的形态种子', 'success'); });
}
/** 选择形态；auto 开启时同时套用推荐的贴图主题 / 对称方式 / 高度与海洋层级 */
function selectShape(id, user = false) {
  if (id !== 'classic' && !shapeMeta(id)) id = 'classic';
  const changed = id !== shapeState.id;
  shapeState.id = id;
  const m = shapeMeta(id);
  if (user && m && shapeState.auto && changed) {
    const set = (k, v) => { const el = $(k); if (el && String(el.value) !== String(v)) { el.value = v; flashInput(k); } };
    set('tileset', m.theme); set('mirror', m.mirror); set('heightLevels', m.levels); set('oceanLevels', m.ocean);
    updateMirrorHint(); queuePrefs();
    toast(`已套用「${m.label}」推荐：${SHAPE_THEMES[m.theme]}主题 · ${MIRROR_LABELS[m.mirror]} · 高度 ${m.levels} / 海洋 ${m.ocean}`, 'info', 3200);
  }
  syncShapeUI(); saveShapePrefs();
  if (shapeActive()) queueShapePreview(0);
}
let shapePreviewTimer = null, shapePreviewSeq = 0;
function queueShapePreview(delay = 260) {
  clearTimeout(shapePreviewTimer);
  if (!shapeActive()) return;
  $('shapePreviewWrap').classList.add('loading');
  shapePreviewTimer = setTimeout(renderShapePreview, delay);
}
async function renderShapePreview() {
  if (!shapeActive()) return;
  const p = params(), seq = ++shapePreviewSeq;
  try {
    const r = await ShapeWorker.call('preview', { ...shapeOpts(p, shapeSeed()), maxSide: 160 });
    if (seq !== shapePreviewSeq) return;
    const cv = $('shapePreview'), ctx = cv.getContext('2d');
    cv.width = r.width; cv.height = r.height;
    ctx.putImageData(new ImageData(new Uint8ClampedArray(r.rgba), r.width, r.height), 0, 0);
    cv.style.aspectRatio = `${p.width} / ${p.height}`;
    const s = r.stats;
    $('shapeStats').innerHTML = `<span><b>${Math.round(s.landRatio * 100)}%</b>陆地</span><span><b>${Math.round(s.mountainRatio * 100)}%</b>高地</span><span><b>${s.landmasses}</b>陆块</span>`;
    $('shapePreviewWrap').classList.remove('loading');
    $('shapePreviewWrap').classList.remove('pop'); void $('shapePreviewWrap').offsetWidth; $('shapePreviewWrap').classList.add('pop');
    $('shapePreviewBadge').textContent = r.stride > 1 ? `预览 1:${r.stride}` : '预览';
  } catch (e) {
    if (seq === shapePreviewSeq && !e.cancelled) { $('shapePreviewWrap').classList.remove('loading'); console.warn('形态预览失败', e); }
  }
}
/** 计算形态矩阵（带进度），返回 {data:Int32Array, stats} */
async function computeShape(p, seed, stage) {
  const m = shapeMeta(shapeState.id);
  busy(true, `正在生成「${m.label}」地形形态…`, stage, 0);
  const t0 = performance.now();
  const r = await ShapeWorker.call('build', shapeOpts(p, seed), (st, f) => {
    busy(true, st === 'terrain' ? `正在计算「${m.label}」地形噪声…` : `正在整理高地 / 坡道 / 通道…`, stage, Math.round(f * 100));
  });
  r.stats.ms = Math.round(performance.now() - t0);
  return r;
}
/** 形态 → 引擎：导入矩阵（作为「① 海岸线」结果） */
async function importShapeToEngine(p, r, m, opts = {}) {
  const payload = { data: r.data, height: p.height, width: p.width, mirroring: p.mirroring, tileset: p.tileset, heightLevels: p.heightLevels, oceanLevels: p.oceanLevels, numPlayers: p.numPlayers, numResources: p.numResources, wallMagnetism: m.magnet };
  return opts.raw ? Engine.call('set_coastline_from_image', payload, [r.data.buffer])
    : run('set_coastline_from_image', payload, `正在导入「${m.label}」形态…`, { transfer: [r.data.buffer], keepBusy: true, stage: opts.stage || '' });
}
function afterShapeGenerated(seed, stats) {
  shapeState.lastSeed = seed; shapeState.lastStats = stats;
  S.mapShape = { id: shapeState.id, label: shapeMeta(shapeState.id)?.label || shapeState.id, seed, land: shapeState.land, rough: shapeState.rough }; // 3.19.0：补记山地粗糙度（配方码需要）
  if (String($('shapeSeed').value).trim() === '') shapeState.previewSeed = randSeed();
  updateShapeSeedHint();
  queueShapePreview(600);
}
const shapeSummary = st => st ? [st.fords ? `浅滩 ${st.fords}` : '', st.ramps ? `坡道 ${st.ramps}` : '', st.channels ? `通道 ${st.channels}` : ''].filter(Boolean).join(' · ') : '';
/** 快速生成：形态流水线（与大地图分步流程相同的 5 步） */
async function generateShapePipeline(p) {
  const m = shapeMeta(shapeState.id), seed = shapeSeed();
  const r = await computeShape(p, seed, '1/5');
  await importShapeToEngine(p, r, m, { stage: '2/5' });
  await run('run_height_ocean', { heightLevels: p.heightLevels, oceanLevels: p.oceanLevels, wallMagnetism: m.magnet, seed: seed % 100000 }, '正在生成高度与海洋…', { keepBusy: true, stage: '3/5' });
  await run('place_resource_random', { mirroring: p.mirroring, numResources: p.numResources }, '正在布置资源点…', { keepBusy: true, stage: '4/5' });
  busy(true, '正在智能布置出生点…', '4/5');
  await nextFrame();
  try { await smartPlaceAll(p.numPlayers, { history: false, quiet: true, allowPartial: true }); }
  catch (e) { toast(e.message, 'warn', 5000); }
  await run('run_finalize', { blueprintXml: await blueprint() }, '正在完成地图并生成 TMX…', { stage: '5/5' });
  afterShapeGenerated(seed, r.stats);
  return { seed, stats: r.stats, label: m.label };
}
/** 择优生成用：不更新界面的原始流水线，返回 run_finalize 的结果（含 snapshot 与 tmx_bytes） */
async function shapeCandidateRaw(p, seed, bp) {
  const m = shapeMeta(shapeState.id);
  const r = await ShapeWorker.call('build', shapeOpts(p, seed));
  await importShapeToEngine(p, r, m, { raw: true });
  await Engine.call('run_height_ocean', { heightLevels: p.heightLevels, oceanLevels: p.oceanLevels, wallMagnetism: m.magnet, seed: seed % 100000 });
  await Engine.call('place_resource_random', { mirroring: p.mirroring, numResources: p.numResources });
  const out = await Engine.call('run_finalize', { blueprintXml: bp });
  out.shapeSeed = seed; out.shapeStats = r.stats;
  return out;
}
function bindShapeControls() {
  loadShapePrefs();
  renderShapeGrid();
  $('shapeLand').addEventListener('input', () => { shapeState.land = clamp(Number($('shapeLand').value) || 50, 10, 90); $('shapeLandText').textContent = shapeState.land + '%'; saveShapePrefs(); queueShapePreview(); });
  $('shapeRough').onchange = () => { shapeState.rough = $('shapeRough').value; saveShapePrefs(); queueShapePreview(); };
  $('shapeSeed').addEventListener('input', () => { saveShapePrefs(); updateShapeSeedHint(); queueShapePreview(); });
  $('shapeDice').onclick = () => {
    if (String($('shapeSeed').value).trim() !== '') $('shapeSeed').value = randSeed(); else shapeState.previewSeed = randSeed();
    $('shapeDice').classList.remove('spin'); void $('shapeDice').offsetWidth; $('shapeDice').classList.add('spin');
    saveShapePrefs(); updateShapeSeedHint(); queueShapePreview(0);
  };
  $('shapeAuto').onclick = () => { shapeState.auto = !shapeState.auto; syncShapeUI(); saveShapePrefs(); };
  $('shapeRecSize').onclick = () => {
    const m = shapeMeta(shapeState.id); if (!m) return;
    $('width').value = m.size[0]; $('height').value = m.size[1]; flashInput('width'); flashInput('height');
    updateMirrorHint(); queuePrefs(); queueShapePreview(0);
  };
  $('shapePreviewWrap').onclick = () => { if (shapeActive()) generate(); };
  for (const id of ['width', 'height', 'mirror']) $(id).addEventListener('change', () => queueShapePreview());
  syncShapeUI();
  if (shapeActive()) queueShapePreview(300);
}

/* ------------------------------------------------------------------ 图片导入海岸线 */
async function importImage(file) {
  if (!file) return;
  await locked(async () => {
    // 3.18.0：捕获点声明在 try 之外，保证导入早期失败（如 createImageBitmap 解码失败）时 catch 仍能安全还原
    let kept = null, prevW = '', prevH = '';
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
      /* 3.18.0 修复：与 generateNow() 同款保护。旧版在导入前就 resetEditorState() 并把宽高改成图片尺寸，
       * 若用户在引擎导入阶段点「取消」或引擎失败，队伍 / 撤销历史 / 多边形 / 近家资源标记被清空、宽高被改写，
       * 而地图并未替换。现在失败 / 取消时还原编辑器状态与宽高输入（restoreEditorState 仅在快照未被替换时生效）。 */
      kept = captureEditorState(); prevW = $('width').value; prevH = $('height').value;
      resetEditorState();
      $('width').value = iw; $('height').value = ih;
      const p = params();
      // 优化：以 TypedArray 零拷贝传给 Worker（旧实现 Array.from 400 万元素，主线程卡顿明显）
      await run('set_coastline_from_image', { data, height: ih, width: iw, mirroring: 'none', tileset: p.tileset, heightLevels: p.heightLevels, oceanLevels: p.oceanLevels, numPlayers: p.numPlayers, numResources: p.numResources }, '正在导入图片地形…', { transfer: [data.buffer] });
      S.view.fitted = false; fitView();
      $('imageName').textContent = `已导入：${file.name} · ${iw} × ${ih}`;
      toast('图片地形导入完成，下一步请绘制墙体或直接生成高度', 'success');
      setStep(1);
    } catch (e) {
      // 失败 / 取消：地图未被替换，还原被清空的编辑器状态与宽高输入
      if (kept) { restoreAfterAbort(kept); $('width').value = prevW; $('height').value = prevH; updateMirrorHint(); queuePrefs(); }
      if (!e.cancelled) { setStatus('图片导入失败：' + e.message); toast('图片导入失败：' + e.message, 'error'); }
    }
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
  const p = projectPayloadRaw();
  /* 3.20.0 修复：分步生成到一半时，TMX 是上一张完整地图，而出生点 / 队伍 / 近家资源 / 配方码属于画布上的未完成地图。
   * 旧版把两者存在一起，恢复项目 / 草稿 / 历史快照时，会把未完成地图的出生点（通常 0 个）套到上一张地图上。
   * 现在只保存 TMX（恢复后就是上一张完整地图，出生点取自 TMX 本身），并标记 unfinished。 */
  if (mapUnfinished() && p.tmx) { delete p.spawnPositions; delete p.teamOverrides; delete p.nearResKeys; p.recipe = null; p.unfinished = true; }
  return p;
}
function projectPayloadRaw() {
  return {
    version: PROJECT_FORMAT, app: APP_VERSION, savedAt: Date.now(),
    params: params(), mapName: $('mapName').value, preset: $('gamePreset').value,
    symmetryStrength: $('symmetryStrength').value, slotOrder: $('slotOrder').value,
    grid: getGrid(), polygons: clonePolys(), spawnPositions: currentSpawns(),
    teamOverrides: [...S.teamOverrides], tmx: S.lastTmx && S.lastTmx.length < 64e6 ? S.lastTmx : null,
    autoSaveEnabled: S.autoSave, mode: S.mode,
    nearResKeys: [...S.nearResKeys], // 3.14.0：恢复后仍能逐点删除近家资源点
    shape: { id: shapeState.id, land: shapeState.land, rough: shapeState.rough, seed: shapeState.lastSeed },
    recipe: mapRecipeCode() // 3.19.0：当前地图生成时的配方码（恢复后「复制配方码」仍对应这张地图）
  };
}
/** 3.19.0：当前地图「生成时」的配方码；分步编辑 / 导入的地图没有完整生成参数，返回 null */
function mapRecipeCode() { try { return S.snapshot && S.mapRecipe ? encodeRecipe(S.mapRecipe) : null; } catch { return null; } }
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
// 3.17.0 修复：关闭「自动保存」后，已排队的那次保存仍会在 1.5 秒后写入；现在关闭时取消计时器，触发时再确认一次开关
function queueAutoSave() { if (!S.autoSave) return; clearTimeout(autoSaveTimer); autoSaveTimer = setTimeout(() => { autoSaveTimer = null; if (!S.autoSave) return; if (!S.locked) saveProject(true); else queueAutoSave(); }, 1500); }
function applyProjectParams(p) {
  const set = (id, v) => { if (v != null && $(id)) $(id).value = v; };
  const pr = p.params || {};
  set('width', pr.width); set('height', pr.height); set('heightLevels', pr.heightLevels); set('oceanLevels', pr.oceanLevels);
  set('players', pr.numPlayers); set('resources', pr.numResources); set('tileset', pr.tileset); set('mirror', pr.mirroring);
  setPresetValue(p.preset); set('symmetryStrength', p.symmetryStrength || 'balanced'); set('slotOrder', p.slotOrder || 'alternate');
  set('mapName', p.mapName || '');
  onTeamModeChange({ quiet: true }); // 3.19.0
  renderGrid(p.grid);
  if (p.shape && (p.shape.id === 'classic' || shapeMeta(p.shape.id))) {
    shapeState.id = p.shape.id;
    if (Number.isFinite(+p.shape.land)) shapeState.land = clamp(+p.shape.land, 10, 90);
    if (['0', '0.3', '0.8'].includes(String(p.shape.rough))) shapeState.rough = String(p.shape.rough);
    shapeState.lastSeed = p.shape.seed ?? null;
    syncShapeUI(); saveShapePrefs();
  }
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
    if (Array.isArray(p.nearResKeys) && S.snapshot) {
      const have = new Set((S.snapshot.resource_positions || []).map(keyOf));
      S.nearResKeys = new Set(p.nearResKeys.filter(k => typeof k === 'string' && have.has(k)));
    }
    if (typeof p.recipe === 'string') { const d = decodeRecipe(p.recipe); if (d.data) S.mapRecipe = d.data; } // 3.19.0
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
async function exportProject(opts = {}) {
  await locked(async () => {
    try {
      busy(true, '正在导出项目文件…', '', null, { cancellable: false }); // 3.8.0：大地图项目 Base64 编码要一两秒，旧版没有任何反馈
      if (S.unitsDirty) await syncTmxUnits();
      const p = projectPayload();
      p.tmx = S.lastTmx ? bytesToBase64(S.lastTmx) : null;
      beginShareBatch();
      const r = await saveFile(new TextEncoder().encode(JSON.stringify(p)), `${opts.base || exportBaseName()}_project.json`, 'application/json', opts.target || ExportLoc.target());
      if (r.desktop) window.DesktopBridge.savedToast(r, `项目文件已导出：${r.name}`);
      else toast(r.pending ? '等待存储权限授予后自动保存' : `项目文件已导出${r.where ? `到${r.where}` : ''}：${r.name || ''}`, 'success', 3600, r.pending ? {} : shareAction());
    } catch (e) { toast('导出项目失败：' + e.message, 'error'); }
    finally { busy(false); }
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

/* ------------------------------------------------------------------ 版本历史快照（3.11.0 新增）
 * 需求：做图最常见的动作是「不满意 → 再生成一次」，而自动保存只有一个草稿槽、「上一张地图」也只能找回最近一张。
 * 现在把每次成功生成、择优采用、导入地图以及手动「保存快照」都记录成一个带缩略图与参数的版本（IndexedDB，最多 10 个），
 * 随时打开「历史版本」面板预览并一键恢复任意一张；单个版本可删除、也可整体清空。
 * 存储：IndexedDB 单键 HISTORY_KEY，值为结构化克隆数组；TMX 以 Uint8Array 原样保存（不经 Base64），
 * 缩略图为 160px 的 PNG dataURL，体积小、够辨认即可。 */
const HISTORY_KEY = 'tmx_history_v1';      // 3.11.0 旧格式：单键保存整个数组（含全部 TMX），仅用于迁移
const HISTORY_INDEX = 'tmx_history_idx_v2'; // 3.14.0：只保存元数据（缩略图 / 名称 / 收藏标记）的索引
const HISTORY_PAYLOAD = id => 'tmx_history_p_' + id; // 3.14.0：每个快照的完整载荷（含 TMX）单独一个键
const HISTORY_MAX = 10;        // 未收藏的快照最多保留的数量
const HISTORY_PIN_MAX = 30;    // 收藏（置顶）的快照上限
/* 3.14.0 重构（修复）：
 *  1. 旧实现每次新增 / 删除都「读出整个数组 → 改 → 整体写回」，而数组里带着 10 份完整 TMX：
 *     大地图每生成一次就要重写几十 MB；「自动生成」的异步写入与手动「保存快照」并发时还会互相覆盖、丢记录。
 *     现在索引与载荷分键存储，新增只写一份载荷 + 一份很小的索引；所有写操作经同一条串行队列执行。
 *  2. 列表 / 打开面板不再把所有载荷读进内存，只读索引。
 *  3. 写入超出浏览器配额时自动淘汰最旧的未收藏快照后重试，仍失败再明确提示（旧版只在控制台警告）。
 *  4. 新增「收藏」：收藏的快照不会被自动淘汰；新增「重命名」。
 *  5. 首次读取时把 3.11.0 的旧格式自动迁移到新格式。 */
const HistoryStore = {
  _q: Promise.resolve(),
  _enqueue(fn) { const job = this._q.then(fn, fn); this._q = job.catch(() => {}); return job; },
  async _readIndex() {
    let idx = null;
    try { idx = await ProjectStore.get(HISTORY_INDEX); } catch { idx = null; }
    if (Array.isArray(idx)) return idx;
    // 迁移旧格式
    let legacy = null;
    try { legacy = await ProjectStore.get(HISTORY_KEY); } catch { legacy = null; }
    if (!Array.isArray(legacy) || !legacy.length) return [];
    const metas = [];
    for (const e of legacy) {
      if (!e?.id || !e.payload) continue;
      try { await ProjectStore.put(HISTORY_PAYLOAD(e.id), e.payload); } catch { continue; }
      const { payload, ...meta } = e;
      metas.push({ ...meta, pinned: false, bytes: payload.tmx?.length || 0 });
    }
    try { await ProjectStore.put(HISTORY_INDEX, metas); await ProjectStore.del(HISTORY_KEY); } catch { /* 下次再迁移 */ }
    return metas;
  },
  async _writeIndex(idx) { await ProjectStore.put(HISTORY_INDEX, idx); },
  /** 只返回元数据（不含载荷） */
  list() { return this._enqueue(() => this._readIndex()).catch(() => []); },
  async get(id) { try { return await ProjectStore.get(HISTORY_PAYLOAD(id)); } catch { return null; } },
  add(entry) {
    return this._enqueue(async () => {
      const { payload, ...meta } = entry;
      meta.pinned = !!meta.pinned; meta.bytes = payload?.tmx?.length || 0;
      let idx = await this._readIndex();
      const evict = async () => { // 淘汰最旧的未收藏快照；返回是否淘汰了一个
        for (let i = idx.length - 1; i >= 0; i--) if (!idx[i].pinned) { const [gone] = idx.splice(i, 1); try { await ProjectStore.del(HISTORY_PAYLOAD(gone.id)); } catch { /* ignore */ } return true; }
        return false;
      };
      for (let attempt = 0; ; attempt++) {
        try { await ProjectStore.put(HISTORY_PAYLOAD(meta.id), payload); break; }
        catch (e) { if (attempt >= 6 || !(await evict())) throw e; }
      }
      idx.unshift(meta);
      while (idx.filter(x => !x.pinned).length > HISTORY_MAX) await evict();
      if (idx.length > HISTORY_PIN_MAX + HISTORY_MAX) { const gone = idx.pop(); try { await ProjectStore.del(HISTORY_PAYLOAD(gone.id)); } catch { /* ignore */ } }
      await this._writeIndex(idx);
      return idx;
    });
  },
  del(id) {
    return this._enqueue(async () => {
      const idx = (await this._readIndex()).filter(e => e.id !== id);
      await this._writeIndex(idx);
      try { await ProjectStore.del(HISTORY_PAYLOAD(id)); } catch { /* ignore */ }
    });
  },
  /** 修改元数据（收藏 / 重命名）。收藏数量超过上限时返回 false */
  update(id, patch) {
    return this._enqueue(async () => {
      const idx = await this._readIndex();
      const e = idx.find(x => x.id === id); if (!e) return false;
      if (patch.pinned && !e.pinned && idx.filter(x => x.pinned).length >= HISTORY_PIN_MAX) return false;
      Object.assign(e, patch);
      await this._writeIndex(idx);
      return true;
    });
  },
  clear(keepPinned = false) {
    return this._enqueue(async () => {
      const idx = await this._readIndex();
      const keep = keepPinned ? idx.filter(e => e.pinned) : [];
      for (const e of idx) if (!keep.includes(e)) { try { await ProjectStore.del(HISTORY_PAYLOAD(e.id)); } catch { /* ignore */ } }
      await this._writeIndex(keep);
      try { await ProjectStore.del(HISTORY_KEY); } catch { /* ignore */ }
    });
  }
};
/** 记录当前地图为一个历史快照（同步生成缩略图，异步写入 IndexedDB）。无地图时返回 null。 */
async function pushHistorySnapshot(label = '') {
  if (!S.snapshot && !S.lastTmx) return null;
  let thumb = '';
  try { const cv = drawExportPng(160, 'dots'); if (cv) thumb = cv.toDataURL('image/png'); } catch (e) { console.warn('历史缩略图生成失败', e); }
  const p = projectPayload();
  if (S.lastTmx) p.tmx = S.lastTmx; // 历史快照始终带 TMX（覆盖草稿 64MB 上限）
  const [w, h] = dims();
  const entry = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), at: Date.now(), name: exportBaseName(), w, h, players: currentSpawns().length, thumb, label: label + (S.mapShape?.label ? ` · ${S.mapShape.label}` : ''), payload: p };
  try { await HistoryStore.add(entry); } catch (e) { console.warn('历史快照写入失败', e); if (label === '手动保存') toast('快照保存失败：存储空间不足，请先删除一些历史版本', 'error', 4600); return null; }
  return entry;
}
function fmtWhen(t) { const d = new Date(t), p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`; }
const fmtBytes = n => !n ? '' : n >= 1048576 ? (n / 1048576).toFixed(1) + 'MB' : Math.max(1, Math.round(n / 1024)) + 'KB';
const STAR_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.2l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.6 6.8 19.4l1-5.9L3.5 9.4l5.9-.8z"/></svg>';
/** 通用文本输入对话框（WebView 里没有 prompt()）。取消返回 null */
async function uiPrompt(title, value = '', placeholder = '') {
  const k = await uiChoice(title, `<input id="promptInput" class="prompt-input" type="text" maxlength="60" autocomplete="off" spellcheck="false" placeholder="${escapeHtml(placeholder)}" value="${escapeHtml(value)}">`,
    [{ key: 'cancel', label: '取消' }, { key: 'ok', label: '确定', primary: true }]);
  return k === 'ok' ? String($('promptInput')?.value ?? '').trim() : null;
}
async function showHistory() {
  if (!guard()) return;
  const list = await HistoryStore.list();
  if (!list.length) { toast('还没有历史快照。生成地图后会自动记录，也可以点「保存快照」手动记录当前地图', 'info', 4400); return; }
  // 收藏在前，其余按时间倒序（索引本身已是时间倒序）
  const sorted = [...list.filter(e => e.pinned), ...list.filter(e => !e.pinned)];
  const rows = sorted.map((e, i) => `<li class="hist-row${e.pinned ? ' pinned' : ''}" style="--d:${Math.min(i, 12) * 36}ms" data-id="${e.id}">
      <span class="hist-thumb">${e.thumb ? `<img src="${e.thumb}" alt="">` : '<i>—</i>'}</span>
      <div class="hist-main"><b>${escapeHtml(e.name || '未命名地图')}</b><small>${e.w || '—'}×${e.h || '—'} · ${e.players ?? '—'} 个出生点 · ${fmtWhen(e.at)}${e.bytes ? ` · ${fmtBytes(e.bytes)}` : ''}${e.label ? ` · ${escapeHtml(e.label)}` : ''}</small></div>
      <div class="hist-actions"><button type="button" class="hist-pin${e.pinned ? ' on' : ''}" aria-pressed="${!!e.pinned}" title="收藏：收藏的版本不会被自动清理" aria-label="收藏">${STAR_SVG}</button><button type="button" class="hist-ren" title="重命名">改名</button><button type="button" class="hist-restore">恢复</button><button type="button" class="hist-del ghost-danger">删除</button></div>
    </li>`).join('');
  const pinned = list.filter(e => e.pinned).length;
  const p = uiChoice('版本历史', `<p class="help-p">自动记录最近 ${HISTORY_MAX} 张生成 / 保存的地图（含缩略图）；点 ☆ <b>收藏</b>的版本不会被自动清理（最多 ${HISTORY_PIN_MAX} 个，当前 <b id="pinCount">${pinned}</b> 个）。点击「恢复」回到对应版本，恢复不会删除历史本身；当前地图会先备份到「上一张地图」。</p><ul class="hist-list">${rows}</ul>`,
    [{ key: 'clear', label: '清空未收藏' }, { key: 'ok', label: '关闭', primary: true }], { wide: true });
  requestAnimationFrame(() => {
    const box = $('modalBody'); if (!box) return;
    box.querySelectorAll('.hist-row').forEach(li => {
      const id = li.dataset.id;
      li.querySelector('.hist-restore').onclick = () => { closeModal('ok'); restoreHistoryEntry(id); };
      li.querySelector('.hist-pin').onclick = async ev => {
        const btn = ev.currentTarget, want = !btn.classList.contains('on');
        const ok = await HistoryStore.update(id, { pinned: want });
        if (!ok) { toast(`收藏已达上限（${HISTORY_PIN_MAX} 个），请先取消一些`, 'warn'); return; }
        btn.classList.toggle('on', want); btn.setAttribute('aria-pressed', String(want)); li.classList.toggle('pinned', want);
        const pc = $('pinCount'); if (pc) pc.textContent = String(box.querySelectorAll('.hist-row.pinned').length);
        toast(want ? '已收藏，不会被自动清理' : '已取消收藏', 'info', 1800);
      };
      li.querySelector('.hist-ren').onclick = async () => {
        const cur = list.find(x => x.id === id);
        const name = await uiPrompt('重命名历史版本', cur?.name || '', '给这个版本起个名字');
        if (name) await HistoryStore.update(id, { name: sanitizeName(name) || name.slice(0, 60) });
        showHistory(); // 3.17.0 修复：旧版点「取消」后整个历史面板直接消失，需要重新打开
      };
      li.querySelector('.hist-del').onclick = async () => {
        if (!await uiConfirm('删除历史快照', '删除后无法恢复，确定删除这个历史版本吗？', '删除', true)) { showHistory(); return; } // 3.17.0 修复：取消后回到列表
        await HistoryStore.del(id);
        showHistory();
      };
    });
  });
  const k = await p;
  if (k === 'clear') {
    if (!await uiConfirm('清空未收藏的历史', '将删除全部<b>未收藏</b>的历史版本（收藏的、当前地图与自动保存草稿都不受影响），确定继续吗？', '清空', true)) { showHistory(); return; }
    await HistoryStore.clear(true);
    toast('已清空未收藏的历史版本', 'success');
  }
}
async function restoreHistoryEntry(id) {
  await locked(async () => {
    try {
      const payload = await HistoryStore.get(id);
      if (!payload) { toast('历史快照不存在或已损坏', 'warn'); return; }
      busy(true, '正在恢复历史版本…', '', null, { cancellable: false });
      let cur = null;
      if (S.lastTmx) { if (S.unitsDirty) await syncTmxUnits(); cur = projectPayload(); }
      await restoreProject(payload, '历史版本');
      if (cur) await ProjectStore.put('previous', cur);
      updatePrevButton();
      queueAutoSave();
      toast('已恢复历史版本（当前地图已备份到「上一张地图」）', 'success');
    } catch (err) { toast('恢复历史版本失败：' + err.message, 'error'); }
    finally { busy(false); }
  });
}

/* ------------------------------------------------------------------ 惊喜生成（3.11.0 新增）
 * 一键随机出一套「合理且好玩」的参数并立即生成：尺寸 / 地形模板 / 人数 / 对称方式 / 地形形态 / 资源数量等都在
 * 可玩的范围内随机，省去「不知道选什么」的纠结；每次结果都能在历史快照里找回。 */
function randomizeParams() {
  const sizePicks = [80, 120, 160, 160, 256, 400];
  const size = sizePicks[Math.floor(Math.random() * sizePicks.length)];
  $('width').value = size; $('height').value = size;
  const shapeIds = ['classic', ...window.TerrainShapes.SHAPES.map(x => x.id)];
  const shape = Math.random() < 0.45 ? 'classic' : shapeIds[1 + Math.floor(Math.random() * (shapeIds.length - 1))];
  selectShape(shape, false);
  if (shapeActive()) {
    // 形态与推荐主题 / 层级配套，成品观感一致
    const m = shapeMeta(shape);
    $('tileset').value = m.theme; $('heightLevels').value = m.levels; $('oceanLevels').value = m.ocean; $('mirror').value = m.mirror;
    shapeState.land = 10 + Math.floor(Math.random() * 81); // 10..90
    shapeState.rough = ['0.8', '0.3', '0'][Math.floor(Math.random() * 3)];
    $('shapeLand').value = shapeState.land; $('shapeLandText').textContent = shapeState.land + '%';
    $('shapeRough').value = shapeState.rough;
  } else {
    $('tileset').value = 1 + Math.floor(Math.random() * 5);
    $('heightLevels').value = 5 + Math.floor(Math.random() * 8); // 5..12
    $('oceanLevels').value = Math.floor(Math.random() * 5);       // 0..4
    $('mirror').value = ['none', 'horizontal', 'vertical', 'diagonal1', 'diagonal2', 'both'][Math.floor(Math.random() * 6)];
  }
  // 3.19.0：惊喜生成的地图最大 400×400，只抽 20 人以内的预设，另有 20% 概率抽到 4～8 人的自由混战
  const keys = Object.keys(PRESET_COUNTS).filter(k => PRESET_COUNTS[k] <= 20);
  const ffa = Math.random() < 0.2, preset = ffa ? 'ffa' : keys[Math.floor(Math.random() * keys.length)];
  const players = ffa ? 4 + Math.floor(Math.random() * 5) : PRESET_COUNTS[preset];
  $('players').value = players; $('gamePreset').value = preset; onTeamModeChange({ quiet: true });
  $('resources').value = clamp(Math.round(players * (0.8 + Math.random() * 1.6)), 0, MAX_RESOURCES);
  syncShapeUI(); saveShapePrefs(); updateMirrorHint(); syncPresetFromPlayers();
  for (const id of ['width', 'height', 'tileset', 'players', 'resources', 'mirror', 'heightLevels', 'oceanLevels']) flashInput(id);
  queuePrefs(); queueShapePreview(0);
}
function surpriseSummary() {
  const m = $('mirror').value;
  const theme = SHAPE_THEMES[intOf('tileset', 1, 5, 5)] || ('模板' + $('tileset').value);
  return `${$('width').value}×${$('height').value} · ${theme} · ${MIRROR_LABELS[m] || '不对称'} · ${intOf('players', 0, MAX_SPAWN_POINTS, 10)} 人${shapeActive() ? ` · 形态「${shapeMeta(shapeState.id).label}」` : ''}`;
}
async function surpriseGenerate() {
  if (!guard()) return;
  randomizeParams();
  toast(`惊喜配方：${surpriseSummary()}`, 'info', 3200);
  await generate();
}
async function newProject() {
  const ok = await uiConfirm('新建项目', '将清除当前地图、出生点与编辑历史（参数保留）。本机自动保存的草稿也会被清空。', '新建', true);
  if (!ok) return;
  await resetAll({ keepParams: true });
  try { await ProjectStore.del('current'); await ProjectStore.del('previous'); } catch { /* ignore */ }
  updatePrevButton(false);
  try { localStorage.removeItem(LEGACY_PROJECT_KEY); } catch { /* ignore */ }
  $('projectInfo').textContent = '已新建项目 · 草稿已清空';
  toast('已新建项目', 'success');
}
async function resetAll({ keepParams = false } = {}) {
  stopAnimation();
  setMeasure(false, { quiet: true }); // 3.17.0 修复：旧版地图已清空，测距按钮仍高亮、光标仍是十字、旧测量点还留着
  resetEditorState();
  Engine.call('reset_state').catch(() => {});
  S.lastTmx = null; S.snapshot = null; S.source = null; S.tmxDirty = false; S.unitsDirty = false; S.slotVerified = null;
  S.view = { zoom: 1, x: 0, y: 0, fitted: false };
  setExportEnabled(false); updateDirtyNote();
  if (!keepParams) {
    $('width').value = DEFAULTS.width; $('height').value = DEFAULTS.height; $('tileset').value = DEFAULTS.tileset;
    $('heightLevels').value = DEFAULTS.heightLevels; $('oceanLevels').value = DEFAULTS.oceanLevels;
    $('players').value = DEFAULTS.players; $('resources').value = DEFAULTS.resources; $('mirror').value = DEFAULTS.mirror;
    $('gamePreset').value = DEFAULTS.preset; $('symmetryStrength').value = DEFAULTS.symmetryStrength; $('slotOrder').value = DEFAULTS.slotOrder; onTeamModeChange({ quiet: true });
    $('mapName').value = ''; S.importedName = null; clearCompare(); $('seed').value = ''; $('wallMagnetism').value = 0; $('magnetText').textContent = '0';
    renderGrid();
    savePrefs();
  }
  $('stats').textContent = '';
  $('emptyState').classList.remove('hide');
  $('mapPanel').classList.add('no-map');
  $('imageName').textContent = '未导入图片 · 暗色=水域，亮色=陆地，绿色=缺口';
  S.step = 0; updateSteps(-1); updateSpawnUI(); updateMirrorHint(); scheduleRender();
  setStatus(keepParams ? '已清空当前地图' : '已恢复默认设置');
}

/* ------------------------------------------------------------------ 我的参数方案（3.6.0 新增）
 * 经常做同一类地图（如「1V1 小图」「5V5 大陆」）时，不必每次重新调 10 个参数：保存为命名方案，下拉一选即用。 */
const PRESETS_KEY = 'tmx_param_presets_v1';
function loadPresets() {
  try { const v = JSON.parse(localStorage.getItem(PRESETS_KEY) || '[]'); return Array.isArray(v) ? v.filter(x => x && typeof x.name === 'string' && x.p && typeof x.p === 'object') : []; }
  catch { return []; }
}
function savePresets(list) { try { localStorage.setItem(PRESETS_KEY, JSON.stringify(list.slice(0, 20))); return true; } catch { toast('无法保存方案：本机存储不可用', 'error'); return false; } }
function renderPresetOptions(selected = '') {
  const el = $('userPreset'); if (!el) return;
  const list = loadPresets();
  el.innerHTML = '';
  const o0 = document.createElement('option'); o0.value = ''; o0.textContent = list.length ? '选择方案…' : '暂无方案'; el.appendChild(o0);
  list.forEach(x => { const o = document.createElement('option'); o.value = x.name; o.textContent = x.name; el.appendChild(o); });
  el.value = list.some(x => x.name === selected) ? selected : '';
  $('presetDel').disabled = !el.value;
}
function presetSnapshot() {
  const p = params();
  return { w: p.width, h: p.height, ts: p.tileset, hl: p.heightLevels, ol: p.oceanLevels, pl: p.numPlayers, rs: p.numResources, mirror: p.mirroring, sym: $('symmetryStrength').value, slot: $('slotOrder').value, grid: p.grid,
    shape: shapeState.id, land: shapeState.land, rough: shapeState.rough, seed: $('shapeSeed').value };
}
function applyUserPreset(name) {
  const x = loadPresets().find(v => v.name === name); if (!x) return;
  const q = x.p, set = (id, v) => { const el = $(id); if (el && v != null && String(el.value) !== String(v)) { el.value = v; flashInput(id); } };
  set('width', q.w); set('height', q.h); set('tileset', q.ts); set('heightLevels', q.hl); set('oceanLevels', q.ol);
  set('players', q.pl); set('resources', q.rs); set('mirror', q.mirror); set('symmetryStrength', q.sym); set('slotOrder', q.slot);
  if (Array.isArray(q.grid) && q.grid.length === 5) renderGrid(q.grid);
  if (q.shape && (q.shape === 'classic' || shapeMeta(q.shape))) {
    shapeState.id = q.shape;
    if (Number.isFinite(+q.land)) shapeState.land = clamp(+q.land, 10, 90);
    if (['0', '0.3', '0.8'].includes(String(q.rough))) shapeState.rough = String(q.rough);
    if (q.seed != null) $('shapeSeed').value = q.seed;
    syncShapeUI(); saveShapePrefs(); queueShapePreview(0);
  }
  if (q.preset) { setPresetValue(q.preset); onTeamModeChange({ quiet: true }); } else syncPresetFromPlayers(); // 3.19.0：方案里的 FFA 等预设原样恢复
  updateMirrorHint(); queuePrefs();
  toast(`已应用方案「${name}」`, 'success');
}
async function saveUserPreset() {
  const list = loadPresets();
  const dft = $('userPreset').value || `方案 ${list.length + 1}`;
  const k = await uiChoice('保存为我的方案',
    `<p class="help-p">保存当前的尺寸、地形模板、高度 / 海洋层级、出生点与资源数量、对称方式、槽位规则、海岸线模板和地形形态（含陆地比例 / 山地 / 固定种子），之后一键套用。同名方案会被覆盖。</p>
     <label class="wide-label"><span>方案名称</span><input id="presetName" type="text" maxlength="24" value="${escapeHtml(dft)}" autocomplete="off" spellcheck="false"></label>`,
    [{ key: 'cancel', label: '取消' }, { key: 'ok', label: '保存', primary: true }]);
  const name = ($('presetName')?.value || '').trim().slice(0, 24);
  if (k !== 'ok') return;
  if (!name) { toast('方案名称不能为空', 'warn'); return; }
  const i = list.findIndex(v => v.name === name), item = { name, p: presetSnapshot(), at: Date.now() };
  if (i >= 0) list[i] = item;
  else { if (list.length >= 20) { toast('最多保存 20 个方案，请先删除不用的', 'warn'); return; } list.push(item); }
  if (savePresets(list)) { renderPresetOptions(name); toast(`已保存方案「${name}」`, 'success'); }
}
async function deleteUserPreset() {
  const v = $('userPreset').value; if (!v) return;
  if (!await uiConfirm('删除方案', `确定删除方案「${escapeHtml(v)}」吗？`, '删除', true)) return;
  if (savePresets(loadPresets().filter(x => x.name !== v))) { renderPresetOptions(); toast('已删除方案'); }
}

/* ------------------------------------------------------------------ 偏好持久化 */
function savePrefs() {
  try {
    const p = params();
    localStorage.setItem(PREF_KEY, JSON.stringify({
      w: p.width, h: p.height, hl: p.heightLevels, ol: p.oceanLevels, pl: p.numPlayers, rs: p.numResources, ts: p.tileset,
      mirror: $('mirror').value, grid: getGrid(), preset: $('gamePreset').value, sym: $('symmetryStrength').value, slot: $('slotOrder').value,
      name: $('mapName').value, smart: S.smartPlacement, autoSave: S.autoSave, animate: S.animate, png: mapPngStyle(), orient: S.orientMode !== 'auto', orientMode: S.orientMode,
      nearRes: { ...S.nearRes }
    }));
  } catch { /* 隐私模式等 */ }
}
let prefsTimer = null;
function queuePrefs() { clearTimeout(prefsTimer); prefsTimer = setTimeout(() => { prefsTimer = null; savePrefs(); }, 400); }
/* 3.10.0 修复：偏好写入有 400ms 防抖，旧版在这 400ms 内切到后台 / 被系统回收 / 关闭 PC 窗口，刚改的设置就丢了。
 * 现在切后台（__onAppPause / visibilitychange / pagehide）时立即落盘挂起的写入。 */
function flushPrefs() { if (prefsTimer) { clearTimeout(prefsTimer); prefsTimer = null; savePrefs(); } }
function loadPrefs() {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(PREF_KEY) || 'null'); } catch { s = null; }
  if (!s) { renderGrid(); return; }
  const set = (id, v) => { const el = $(id); if (el && v != null) el.value = v; };
  set('width', s.w); set('height', s.h); set('heightLevels', s.hl); set('oceanLevels', s.ol); set('players', s.pl); set('resources', s.rs);
  set('tileset', s.ts); set('mirror', s.mirror); setPresetValue(s.preset); set('symmetryStrength', s.sym); set('slotOrder', s.slot); set('mapName', s.name);
  if (typeof s.smart === 'boolean') S.smartPlacement = s.smart;
  if (typeof s.autoSave === 'boolean') S.autoSave = s.autoSave;
  if (typeof s.animate === 'boolean') S.animate = s.animate;
  if (ORIENT_MODES.includes(s.orientMode)) S.orientMode = s.orientMode;
  else if (s.orient === true) S.orientLegacy = true; // 3.9.0 及更早：只知道「锁了」，不知道锁的是哪个方向
  if (PNG_STYLES[s.png]) set('mapPngStyle', s.png);
  if (s.nearRes && typeof s.nearRes === 'object') {
    S.nearRes = { enabled: s.nearRes.enabled !== false, perSpawn: clamp(Number(s.nearRes.perSpawn) || 2, 2, 4), min: clamp(Number(s.nearRes.min) || 10, 4, 120), max: clamp(Number(s.nearRes.max) || 20, 4, 160) };
    if (S.nearRes.max < S.nearRes.min) S.nearRes.max = S.nearRes.min;
  }
  renderGrid(Array.isArray(s.grid) && s.grid.length === 5 ? s.grid : undefined);
}
function syncPresetFromPlayers() {
  if (isFFA()) return; // 3.19.0：FFA 不固定人数，改人数时保持 FFA
  const n = intOf('players', 0, MAX_SPAWN_POINTS, 10);
  const hit = Object.entries(PRESET_COUNTS).find(([, v]) => v === n);
  $('gamePreset').value = hit ? hit[0] : 'free';
}
function applyPreset() {
  const n = PRESET_COUNTS[$('gamePreset').value];
  if (n) { $('players').value = n; flashInput('players'); }
  else if (isFFA() && intOf('players', 0, MAX_SPAWN_POINTS, 10) < 3) { $('players').value = FFA_DEFAULT_PLAYERS; flashInput('players'); } // FFA 至少 3 人才有意义
  updateMirrorHint(); updateDensityHint(); queuePrefs();
  onTeamModeChange();
  // 3.19.0：大人数预设提示地图尺寸（30V30 以上在 160×160 上会挤成一团），提示条上可一键套用
  const w = intOf('width', 40, MAX_MAP_DIMENSION, 160), h = intOf('height', 40, MAX_MAP_DIMENSION, 160), d = densityInfo(w, h, intOf('players', 1, MAX_SPAWN_POINTS, 10));
  if ((n || 0) >= 60 && (d.level === 'bad' || d.level === 'warn')) {
    toast(`${n} 人在 ${w}×${h} 上${d.label}，推荐 ${d.rw}×${d.rh}`, 'info', 6000, { action: { label: '套用推荐尺寸', fn: () => { $('width').value = d.rw; $('height').value = d.rh; flashInput('width'); flashInput('height'); updateMirrorHint(); updateDensityHint(); queuePrefs(); queueShapePreview(0); } } });
  }
}
/** 3.19.0：读取保存的预设值时使用——旧版本保存的「25v25」等已移除的选项落到「自由配置」，不让下拉框变成空白 */
function setPresetValue(v) {
  const sel = $('gamePreset'); if (!sel || v == null) return;
  sel.value = [...sel.options].some(o => o.value === v) ? v : 'free';
}
/** 3.19.0：在「两队对抗」与「自由混战」之间切换时：重排槽位（FFA 顺时针 / 两队按规则）、刷新颜色与分析 */
let lastTeamMode = null;
function onTeamModeChange({ quiet = false } = {}) {
  const ffa = isFFA();
  document.body.classList.toggle('ffa', ffa);
  $('slotOrder')?.closest('label')?.classList.toggle('dim', ffa);
  if (quiet || lastTeamMode === null || lastTeamMode === ffa) { if (lastTeamMode !== ffa) { docCache = null; terrCache = null; } lastTeamMode = ffa; updateSpawnUI(); scheduleRender(); return; }
  lastTeamMode = ffa;
  docCache = null; terrCache = null;
  if (S.snapshot && currentSpawns().length >= 2 && !S.locked && $('slotOrder').value !== 'engine') {
    pushSpawnHistory();
    setSpawns($('slotOrder').value === 'engine' ? currentSpawns() : orderBySlot(currentSpawns(), undefined, { fresh: true }));
    afterSpawnChange();
    toast(ffa ? '已切换为自由混战：玩家槽位改为绕地图中心顺时针编号，每人一种颜色' : '已切换为两队对抗：玩家槽位按 A / B 规则重排', 'info', 4200, spawnUndoAction());
  } else { updateSpawnUI(); scheduleRender(); }
}
function flashInput(id) { const el = $(id); el.classList.remove('flash-input'); void el.offsetWidth; el.classList.add('flash-input'); }

/* ------------------------------------------------------------------ 主题 / 系统栏 */
/* 3.7.0 修复：旧版启动时就把主题写入本机存储，「首次启动跟随系统深浅色」只生效一次，之后系统切换深浅色不再跟随。
 * 现在只有用户点主题按钮才保存；未手动选择过时，系统切换深浅色会实时跟随。
 * 3.16.0：上面的「未手动选择」现在就是显式的「跟随系统」选项（选它 = 删除存储项，与旧版语义一致）；
 *         新增 5 套动态主题与「昼夜流转」，主题按钮改为打开选择面板。 */
const themeById = id => THEMES.find(t => t.id === id);
const themeChoiceById = id => THEME_CHOICES.find(t => t.id === id);
let themeCycleTimer = 0;
function systemPrefersLight() { try { return !!window.matchMedia?.('(prefers-color-scheme: light)').matches; } catch { return false; } }
function cycleSlot(hour) { let slot = THEME_CYCLE[0]; for (const it of THEME_CYCLE) if (hour >= it[0]) slot = it; return slot; }
function resolveTheme(choice, now = new Date()) {
  if (choice === 'system') return systemPrefersLight() ? 'light' : 'dark';
  if (choice === 'cycle') return cycleSlot(now.getHours())[1];
  return themeById(choice) ? choice : 'dark';
}
function readThemeChoice() {
  let saved = null;
  try { saved = localStorage.getItem(THEME_KEY); } catch { /* ignore */ }
  if (saved == null) return 'system';
  if (themeChoiceById(saved)) return saved;
  const n = Number(saved); // 3.15.0 及更早：保存的是下标（0 深空 / 1 青岚 / 2 亮白）
  return Number.isInteger(n) && LEGACY_THEME_ORDER[n] ? LEGACY_THEME_ORDER[n] : 'dark';
}
function fxEnabled() { try { return localStorage.getItem(THEME_FX_KEY) !== '0'; } catch { return true; } }
function setFxEnabled(on) {
  try { on ? localStorage.removeItem(THEME_FX_KEY) : localStorage.setItem(THEME_FX_KEY, '0'); } catch { /* ignore */ }
  document.body.classList.toggle('fx-off', !on);
  renderThemeMenu();
}
function themeLabel() {
  const c = themeChoiceById(S.themeChoice), t = themeById(S.themeId);
  if (S.themeChoice === 'cycle') return `${c.name}（${cycleSlot(new Date().getHours())[2]} · ${t.name}）`;
  return S.themeChoice === 'system' ? `${c.name}（${t.name}）` : t.name;
}
function applyTheme(choice, announce = false, persist = announce) {
  if (!themeChoiceById(choice)) choice = 'dark';
  S.themeChoice = choice;
  const id = resolveTheme(choice), t = themeById(id), b = document.body;
  S.themeId = id;
  b.dataset.theme = id;
  b.dataset.tone = t.tone;
  if (t.fx) b.dataset.fx = id; else delete b.dataset.fx;
  document.querySelector('meta[name=theme-color]').setAttribute('content', t.bar);
  canvasBg = cssVar('--canvas-bg') || '#050b14';
  canvasClear = !!t.fx;
  if (persist) try { choice === 'system' ? localStorage.removeItem(THEME_KEY) : localStorage.setItem(THEME_KEY, choice); } catch { /* ignore */ }
  try { window.AndroidBridge?.setSystemBars?.(t.bar, t.tone === 'light'); } catch { /* 旧版桥接 */ }
  const label = themeLabel();
  $('themeToggle').title = `主题：${label}（点击选择）`;
  $('themeToggle').setAttribute('aria-label', `选择主题，当前：${label}`);
  clearInterval(themeCycleTimer); themeCycleTimer = 0;
  if (choice === 'cycle') themeCycleTimer = setInterval(refreshAutoTheme, 60000);
  renderThemeMenu();
  if (announce) toast(`主题：${label}${t.fx && !fxEnabled() ? '（动态背景已暂停）' : ''}`);
  scheduleRender();
}
/** 自动主题（跟随系统 / 昼夜流转）的实际主题变了才重新应用；不写存储、不弹提示 */
function refreshAutoTheme() {
  if (S.themeChoice !== 'system' && S.themeChoice !== 'cycle') return;
  if (resolveTheme(S.themeChoice) !== S.themeId) applyTheme(S.themeChoice, false, false);
}
function themeWash(fromEl) {
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  const r = fromEl?.getBoundingClientRect?.(); if (!r) return;
  const w = document.createElement('div');
  w.className = 'theme-wash';
  w.style.left = (r.left + r.width / 2) + 'px'; w.style.top = (r.top + r.height / 2) + 'px';
  document.body.appendChild(w);
  setTimeout(() => w.remove(), 800);
}
function buildThemeMenu() {
  const m = $('themeMenu'); if (!m || m.dataset.built) return;
  m.dataset.built = '1';
  const groups = [['经典', '静态配色'], ['动态', '带动态背景'], ['自动', '随系统 / 时间变化']];
  let delay = 0;
  m.innerHTML = '<div class="om-head">界面主题</div>' + groups.map(([g, note]) => `<div class="tm-group">${g}${note ? `<em>${note}</em>` : ''}</div><div class="tm-grid">` +
    THEME_CHOICES.filter(t => t.group === g).map(t => `<button type="button" role="menuitemradio" aria-checked="false" data-theme-id="${t.id}" style="animation-delay:${(delay++ * 0.025).toFixed(3)}s" title="${t.desc}"><span class="tm-sw" data-sw="${t.id}"><i></i></span><b>${t.name}</b></button>`).join('') +
    '</div>').join('') +
    '<div class="tm-desc" id="themeDesc" aria-live="polite"></div>' +
    '<label class="switch-row tm-fx"><span>动态背景<small>关闭后停在静止画面，更省电</small></span><button id="themeFxToggle" class="switch" role="switch" aria-checked="true" type="button"><i></i></button></label>';
  m.addEventListener('click', e => {
    const it = e.target.closest('[data-theme-id]');
    if (it) { // 面板保持打开，方便连续试几套
      if (it.dataset.themeId !== S.themeChoice) applyThemeAnimated(it.dataset.themeId, it); // 3.26.0：圆形揭示过渡
      return;
    }
    if (e.target.closest('#themeFxToggle')) { const on = !fxEnabled(); setFxEnabled(on); toast(on ? '动态背景：开' : '动态背景：已暂停'); }
  });
  const showDesc = id => { const c = themeChoiceById(id); if (c) $('themeDesc').innerHTML = `<b>${c.name}</b> · ${c.desc}`; };
  m.addEventListener('pointerover', e => { const it = e.target.closest('[data-theme-id]'); if (it) showDesc(it.dataset.themeId); });
  m.addEventListener('focusin', e => { const it = e.target.closest('[data-theme-id]'); if (it) showDesc(it.dataset.themeId); });
  m.addEventListener('pointerleave', () => renderThemeMenu());
  m.addEventListener('keydown', e => { // 方向键在网格里移动焦点
    const items = [...m.querySelectorAll('[data-theme-id]')], i = items.indexOf(document.activeElement);
    if (i < 0) return;
    let to = -1;
    if (e.key === 'ArrowRight') to = Math.min(i + 1, items.length - 1);
    else if (e.key === 'ArrowLeft') to = Math.max(i - 1, 0);
    else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') to = themeGridMove(m, items, items[i], e.key === 'ArrowDown' ? 1 : -1);
    else if (e.key === 'Home') to = 0;
    else if (e.key === 'End') to = items.length - 1;
    if (to < 0) return;
    e.preventDefault(); items[to].focus();
  });
}
/* 3.17.0 修复：三组主题的数量分别是 3 / 5 / 2，旧版上下键固定按 ±3 跳，跨组时焦点落到错误的列（例如「深潮」下面是「昼夜流转」）。
 * 现在按每组的实际网格计算：组内上下移一行；越过组边界时进入相邻组、保持同一列（该组这一列不存在时取最后一个）。 */
function themeGridMove(menu, items, el, dir) {
  const grids = [...menu.querySelectorAll('.tm-grid')].map(g => [...g.querySelectorAll('[data-theme-id]')]);
  const gi = grids.findIndex(g => g.includes(el)); if (gi < 0) return -1;
  const cols = Math.max(1, (getComputedStyle(el.parentElement).gridTemplateColumns || '').split(' ').filter(Boolean).length || 3);
  const g = grids[gi], idx = g.indexOf(el), col = idx % cols, row = Math.floor(idx / cols), lastRow = Math.floor((g.length - 1) / cols);
  let target = el;
  if (dir > 0) {
    if (row < lastRow) target = g[Math.min(idx + cols, g.length - 1)];
    else if (grids[gi + 1]) target = grids[gi + 1][Math.min(col, grids[gi + 1].length - 1)];
  } else if (row > 0) target = g[idx - cols];
  else if (grids[gi - 1]) { const p = grids[gi - 1], pr = Math.floor((p.length - 1) / cols) * cols; target = p[Math.min(pr + col, p.length - 1)]; }
  return items.indexOf(target);
}
function renderThemeMenu() {
  const m = $('themeMenu'); if (!m || !m.dataset.built) return;
  m.querySelectorAll('[data-theme-id]').forEach(it => {
    const on = it.dataset.themeId === S.themeChoice;
    it.classList.toggle('current', on);
    it.setAttribute('aria-checked', String(on));
  });
  const c = themeChoiceById(S.themeChoice), t = themeById(S.themeId);
  const now = S.themeChoice === 'cycle' ? `现在是${cycleSlot(new Date().getHours())[2]}，使用「${t.name}」。` : S.themeChoice === 'system' ? `当前使用「${t.name}」。` : '';
  $('themeDesc').innerHTML = `<b>${c.name}</b> · ${c.desc}${now ? '<br>' + now : ''}`;
  const on = fxEnabled(), sw = $('themeFxToggle');
  sw.classList.toggle('on', on); sw.setAttribute('aria-checked', String(on));
  sw.disabled = !t.fx && S.themeChoice !== 'cycle';
  sw.title = sw.disabled ? '当前主题没有动态背景' : '';
}
const themeMenuOpen = () => !!$('themeMenu')?.classList.contains('show');
function openThemeMenu() {
  const m = $('themeMenu'); if (!m) return;
  closeOrientMenu();
  buildThemeMenu(); renderThemeMenu();
  clearTimeout(m._hideT);
  m.hidden = false;
  requestAnimationFrame(() => m.classList.add('show'));
  $('themeToggle').setAttribute('aria-expanded', 'true');
  (m.querySelector('.current') || m.querySelector('[data-theme-id]'))?.focus({ preventScroll: true });
}
function closeThemeMenu() {
  const m = $('themeMenu'); if (!m || !m.classList.contains('show')) return false;
  m.classList.remove('show');
  $('themeToggle').setAttribute('aria-expanded', 'false');
  m._hideT = setTimeout(() => { m.hidden = true; }, 220);
  return true;
}
function nextTheme(d = 1) { // 只在具体主题间轮换（命令面板「下一个主题」）
  const i = THEMES.findIndex(t => t.id === S.themeId);
  applyTheme(THEMES[(i + d + THEMES.length) % THEMES.length].id, true);
}

/* ------------------------------------------------------------------ 屏幕方向（3.10.0 重写）
 * 旧版：按钮只是一个开关，调用原生 setOrientationLock(true) = SCREEN_ORIENTATION_LOCKED（锁定为「此刻」的方向），
 *       网页 localStorage 里只记了 orient=true。冷启动时 App 先按手机姿态显示，网页加载完再锁一次——锁住的是
 *       启动时手机恰好的方向，而不是上次锁定的竖屏 / 横屏，于是「横屏锁定」重开后经常变成「竖屏锁定」。
 * 现在：方向模式（auto / portrait / landscape）由 Android 原生层用 SharedPreferences 持久化，Activity onCreate
 *       时就恢复（第一帧即正确方向），网页启动时只「读取」原生状态来显示，不再在启动时调用任何锁定接口；
 *       只有用户在菜单里选择时才写入。原生通过 window.__onOrientationMode(mode) 回传实际生效的模式。 */
const ORIENT_MODES = ['auto', 'portrait', 'landscape'];
const ORIENT_TEXT = { auto: '自动旋转', portrait: '已锁定竖屏', landscape: '已锁定横屏' };
let orientAnnounce = false;
const orientBridge = () => {
  const b = window.AndroidBridge;
  return b && typeof b.setOrientationMode === 'function' ? b : null;
};
function renderOrientation() {
  const b = $('orientToggle'); if (!b) return;
  const m = S.orientMode, locked = m !== 'auto';
  if (b.dataset.mode && b.dataset.mode !== m) { b.classList.remove('orient-swap'); void b.offsetWidth; b.classList.add('orient-swap'); }
  b.dataset.mode = m;
  b.classList.toggle('active', locked);
  b.setAttribute('aria-pressed', String(locked));
  b.title = `屏幕方向：${ORIENT_TEXT[m]}（点击更改）`;
  b.setAttribute('aria-label', `屏幕方向：${ORIENT_TEXT[m]}`);
  document.querySelectorAll('#orientMenu [data-orient]').forEach(it => {
    const on = it.dataset.orient === m;
    it.classList.toggle('current', on);
    it.setAttribute('aria-checked', String(on));
  });
}
/** 原生回调：实际生效的方向模式（用户选择「锁定当前方向」时由原生解析为 portrait / landscape） */
window.__onOrientationMode = mode => {
  S.orientMode = ORIENT_MODES.includes(mode) ? mode : 'auto';
  renderOrientation();
  savePrefs(); // 网页侧备份立即写入（不走防抖）
  if (orientAnnounce) {
    orientAnnounce = false;
    toast(S.orientMode === 'auto' ? '已恢复自动旋转' : `${ORIENT_TEXT[S.orientMode]}，下次打开会保持此方向`, 'success');
  }
};
function setOrientationMode(mode, announce = true) {
  const br = orientBridge(); if (!br) return;
  orientAnnounce = announce;
  // 明确的模式先乐观更新界面；「当前方向」等原生回调后再更新
  if (ORIENT_MODES.includes(mode)) { S.orientMode = mode; renderOrientation(); }
  try { br.setOrientationMode(mode); }
  catch (e) { orientAnnounce = false; toast('无法设置屏幕方向：' + (e?.message || e), 'error'); }
}
function initOrientation() {
  const btn = $('orientToggle'); if (!btn) return;
  const br = orientBridge();
  if (!br) { btn.closest('.orient-wrap')?.setAttribute('hidden', ''); return; } // PC / 浏览器：没有屏幕方向的概念
  let st = null;
  try { st = JSON.parse(br.getOrientationMode?.() || 'null'); } catch { st = null; }
  if (st && st.stored && ORIENT_MODES.includes(st.mode)) {
    S.orientMode = st.mode; // 原生已持久化：以原生为准
    renderOrientation();
    savePrefs();
  } else if (ORIENT_MODES.includes(S.orientMode) && S.orientMode !== 'auto') {
    setOrientationMode(S.orientMode, false); // 原生数据被清除但网页备份还在：以网页备份恢复
  } else if (S.orientLegacy) {
    setOrientationMode('current', false);    // 从 3.9.0 升级：只能按此刻方向迁移一次，之后由原生持久化
    S.orientLegacy = false;
  } else {
    S.orientMode = 'auto';
    renderOrientation();
  }
  btn.onclick = e => { e.stopPropagation(); toggleOrientMenu(); };
  $('orientMenu').addEventListener('click', e => {
    const it = e.target.closest('[data-orient]'); if (!it) return;
    closeOrientMenu();
    const m = it.dataset.orient;
    if (m === S.orientMode) return;
    setOrientationMode(m, true);
  });
  document.addEventListener('pointerdown', e => { if (!e.target.closest?.('.orient-wrap')) closeOrientMenu(); }, true);
}
const orientMenuOpen = () => !!$('orientMenu')?.classList.contains('show');
function toggleOrientMenu() { orientMenuOpen() ? closeOrientMenu() : openOrientMenu(); }
function openOrientMenu() {
  const m = $('orientMenu'); if (!m) return;
  closeThemeMenu(); // 3.16.0：两个顶栏菜单互斥
  clearTimeout(m._hideT);
  m.hidden = false;
  requestAnimationFrame(() => m.classList.add('show'));
  $('orientToggle').setAttribute('aria-expanded', 'true');
  (m.querySelector('.current') || m.querySelector('[data-orient]'))?.focus({ preventScroll: true });
}
function closeOrientMenu() {
  const m = $('orientMenu'); if (!m || !m.classList.contains('show')) return false;
  m.classList.remove('show');
  $('orientToggle').setAttribute('aria-expanded', 'false');
  m._hideT = setTimeout(() => { m.hidden = true; }, 220);
  return true;
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
  // 3.18.0：标签页补齐 aria-selected，与 role="tablist/tab" 语义保持一致
  $('quickTab').setAttribute('aria-selected', String(m === 'quick'));
  $('wizardTab').setAttribute('aria-selected', String(m === 'wizard'));
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
      <div><kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Enter</kbd></div><div>择优生成：一次生成多张，自动体检后挑一张</div>
      <div><kbd>Ctrl</kbd>+<kbd>K</kbd> / <kbd>/</kbd></div><div>命令面板：搜索并执行任意功能（支持拼音首字母，如 dc = 导出）</div>
      <div><kbd>Ctrl</kbd>+<kbd>Z</kbd> / <kbd>Y</kbd></div><div>全局撤销 / 重做（<kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Z</kbd> 也可重做）</div>
      <div><kbd>Ctrl</kbd>+<kbd>S</kbd></div><div>保存项目</div>
      <div><kbd>Ctrl</kbd>+<kbd>E</kbd></div><div>导出 TMX + 小地图</div>
      <div><kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>S</kbd></div><div>另存为：改文件名 / 选内容 / 选保存位置</div>
      <div><kbd>F</kbd> / <kbd>0</kbd></div><div>适应画布 / 1:1 像素</div>
      <div><kbd>+</kbd> / <kbd>-</kbd></div><div>放大 / 缩小</div>
      <div><kbd>V</kbd> <kbd>B</kbd> <kbd>P</kbd> <kbd>C</kbd> <kbd>R</kbd></div><div>分步模式：平移 / 画笔 / 多边形 / 出生点 / 资源</div>
      <div><kbd>Del</kbd></div><div>删除选中的出生点</div>
      <div><kbd>M</kbd></div><div>打开出生点槽位映射表</div>
      <div><kbd>I</kbd></div><div>预览导出的小地图 PNG</div>
      <div><kbd>D</kbd></div><div>地图体检：连通性 / 领地平衡 / 资源分配</div>
      <div><kbd>T</kbd></div><div>显示 / 隐藏领地图层</div>
      <div><kbd>L</kbd></div><div>显示 / 隐藏接敌路线（选中出生点时只看它自己的）</div>
      <div><kbd>U</kbd></div><div>测距：点两个点（或拖动画线）量直线 / 步行距离，出生点自动吸附；量完显示沿线地形剖面</div>
      <div><kbd>N</kbd></div><div>显示 / 隐藏近家资源范围</div>
      <div><kbd>Z</kbd></div><div>专注模式：收起侧栏和顶栏，画布铺满（<kbd>Z</kbd> / <kbd>Esc</kbd> 退出）</div>
      <div><kbd>Y</kbd></div><div>对称检查：标出与镜像位置成片不一致的地形（红 = 陆地 / 水域，橙 = 墙体 / 悬崖；引擎平滑留下的 1～2 格边缘误差会被忽略）以及没有镜像对应点的出生点 / 资源点</div>
      <div><kbd>O</kbd></div><div>公平度一键微调：在当前布局附近移动出生点提高公平度，对称地图仍保持对称，近家资源不受影响（可撤销）</div>
      <div><kbd>K</kbd></div><div>落点热力：暖色 = 宽敞、冷色 = 拥挤，准星为最佳落点，可一键放置</div>
      <div><kbd>X</kbd></div><div>新旧对比：拖动分界线对照上一张与当前地图，查看健康度 / 公平度等指标的变化，不满意可一键换回</div>
      <div><kbd>G</kbd></div><div>形态种子画廊：同一套参数一次预览 6 个种子的轮廓，挑中后固定种子或直接生成</div>
      <div><kbd>Shift</kbd>+<kbd>G</kbd></div><div>形态总览（3.27.0）：以当前参数一次预览全部 15 套地形形态，横向比较后选用；画廊里的 ☆ 可按形态收藏种子</div>
      <div><kbd>,</kbd> / <kbd>.</kbd></div><div>出生点巡视：飞到上一个 / 下一个出生点，并显示该玩家的领地、资源与接敌数据</div>
      <div><kbd>Ctrl</kbd>+<kbd>V</kbd></div><div>在画布区粘贴配方码（TMX1-…）：直接打开「使用配方码」</div>
      <div><kbd>[</kbd> / <kbd>]</kbd></div><div>画笔变小 / 变大</div>
      <div><kbd>H</kbd> / <kbd>?</kbd></div><div>打开本帮助</div>
      <div><kbd>Space</kbd>+拖动</div><div>任意工具下临时平移</div>
      <div><kbd>Esc</kbd></div><div>取消绘制 / 取消选择 / 关闭面板</div>
    </div>
    <p class="help-p">槽位规则：<b>出生点 N = 游戏玩家 N = 瓦片 team 属性 N-1</b>。导出前会按 team 属性写入 GID 并读回校验；修改队伍会自动重排槽位，「设为玩家 1」只交换槽位、不影响其他玩家。</p>
    <p class="help-p">地图体检：检查所有出生点之间是否有陆路相通、双方能控制多大的地盘（按行走距离划分，蓝 = A 队、红 = B 队、橙 = 无人可达的孤岛）、资源点分配是否均衡；点击问题项可直接定位到对应出生点。重新生成前会自动备份当前地图，可在「项目 / 恢复」中找回。</p>
    <p class="help-p">3.7.0：「择优」按钮一次生成多张候选地图并按体检分排序；体检新增接敌（Rush）距离——每位玩家走到最近敌人要多远，「路线」图层把这些最短路径画在地图上；导入的地图会读取 TMX 中的悬崖 / 水域瓦片，体检更精确；底部「海报」可导出带体检数据的分享图。</p>
    <p class="help-p">3.8.0：「地形形态」提供 15 套模板（岛屿 / 半岛 / 群岛 / 双河 / 山湖 / 大陆 / 沙漠 / 雪原 / 火山 / 迷宫 / 两岸狭路，3.27.0 新增环礁 / 三角洲 / 高原要塞 / 沼泽），生成时自动对称、加浅滩渡口、为高地开坡道并打通被围死的空地；预览即成图（同一种子），种子可固定复用。山地会生成为带悬崖的高地，坡道处可通行。「另存为…」可自定义文件名、导出内容和保存位置（Android 可选导出文件夹）；画布与小地图按所选地形模板的贴图着色。</p>
    <p class="help-p">触屏：单指拖动平移，双指缩放（抬起一指可继续平移）；长按删除出生点/资源点；拖动出生点可直接移动。手机上右下角的悬浮按钮可直接生成 / 导出 / 撤销。</p>
    ${window.DesktopBridge ? '<p class="help-p">PC 版：<kbd>F11</kbd> 全屏；<kbd>Ctrl</kbd>+<kbd>O</kbd> 导入；把 TMX / 项目文件 / 地形图片拖进窗口即可导入；导出文件保存在「项目 / 恢复」卡片中设置的导出目录（默认系统下载目录）；关闭窗口前自动保存草稿。</p>' : ''}
    <p class="help-p">版本 v${APP_VERSION}${window.DesktopBridge ? ' · PC 版' : ''} · 所有计算均在本机完成，不联网。</p>`, [{ key: 'ok', label: '知道了', primary: true }]);
}

/* ------------------------------------------------------------------ Android 返回键 / 生命周期 */
window.__onAndroidBack = () => {
  if (closeThemeMenu()) return true; // 3.16.0
  if (closeOrientMenu()) return true;
  if (closeModal('cancel')) return true;
  if (cmdkOpen()) { closeCmdk(); return true; } // 3.15.0：命令面板
  // 3.15.0：与 Esc 一致——有测量结果时第一次返回只清除测量，第二次才退出测距（旧版一次就退出，测量结果直接丢失）
  if (measure.on) { if (measure.a) { clearMeasurePoints(); scheduleRender(); setStatus('已清除测量，再按一次返回退出测距'); } else setMeasure(false); return true; }
  if (!$('busy').hidden && animTimer) { stopAnimation(); return true; }
  // 3.7.0 修复：旧版生成大地图途中按返回键会直接退出 App；现在与对话框一致——可取消时取消当前操作，否则提示稍候
  if (S.locked && !$('busy').hidden) {
    if (!$('busyCancel').hidden) $('busyCancel').click(); else toast('正在处理中，请稍候…', 'warn');
    return true;
  }
  if ($('sidebar').classList.contains('open')) { closeDrawer(); return true; }
  if (S.drawingPolygon) { S.drawingPolygon = null; updatePolygonInfo(); scheduleRender(); return true; }
  if (S.selectedSpawn >= 0) { selectSpawn(-1); return true; }
  if (closeSpawnCard()) return true; // 3.19.0
  if (focusOn()) { setFocusMode(false); return true; } // 3.17.0
  return false;
};
/* 3.2.0：原生侧异步保存结果回调（Android 9 及以下等待存储权限后才真正写入，旧版网页永远不知道结果） */
window.__onNativeSaveResult = (ok, msg) => {
  if (ok) toast(`已保存到下载目录：${msg}`, 'success', 3600);
  else toast(`保存失败：${msg}`, 'error', 4600);
};
// 3.5.0：返回 Promise，PC 版关闭窗口时可等待保存完成（Android 端忽略返回值，行为不变）
window.__onAppPause = () => { flushPrefs(); return (S.autoSave && (S.snapshot || S.lastTmx)) ? saveProject(true) : Promise.resolve(); };
// 3.10.0：浏览器 / WebView 被切到后台或页面卸载时同样立即落盘挂起的偏好写入
document.addEventListener('visibilitychange', () => { if (document.hidden) flushPrefs(); });
window.addEventListener('pagehide', flushPrefs);
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

/* ================================================================== 3.15.0 新功能 */

/* ------------------------------------------------------------------ ① 命令面板（Ctrl+K / 「/」 / 顶栏搜索按钮）
 * 功能越来越多：生成、择优、惊喜、测距、体检、领地、接敌路线、近家资源、槽位表、海报、历史版本……分散在侧栏七八张卡片里，
 * 手机上还要先打开抽屉再滚动找。命令面板把所有操作集中到一个可搜索的列表：输入「导出」「测距」「dc」都能找到，
 * 显示快捷键，最近用过的排在最前；需要地图的命令在没有地图时置灰并说明原因。
 * 搜索：标题子串 > 关键词（含拼音首字母 / 英文）子串 > 标题字符按序出现（子序列），同分按最近使用排序。 */
const CMDK_RECENT_KEY = 'tmx_cmdk_recent_v1';
const clickId = id => () => $(id)?.click();
const CMDS = [
  { id: 'generate', g: '地图', t: '生成地图', k: 'Ctrl+Enter', kw: 'scdt generate shengcheng', run: () => generate() },
  { id: 'bestof', g: '地图', t: '择优生成（多张候选自动评分）', k: 'Ctrl+Shift+Enter', kw: 'zy best of zeyou houxuan', run: () => generateBestOf() },
  { id: 'surprise', g: '地图', t: '惊喜生成（随机一套好玩的参数）', kw: 'jx surprise random suiji jingxi', run: clickId('surprise') },
  { id: 'lang', g: '系统', t: '切换界面语言（Language）', kw: 'yy qhyy language lang yuyan english 繁體 日本語 한국어', run: () => window.I18N?.openMenu() },
  { id: 'gallery', g: '地图', t: '形态种子画廊：一次预览 6 个种子，挑一个生成', k: 'G', kw: 'zzhl gallery seed zhongzi hualang xingtai', run: () => showSeedGallery() },
  { id: 'overview', g: '地图', t: '形态总览：一次预览全部地形形态，横向比较后选用', k: 'Shift+G', kw: 'xtzl overview shape xingtai zonglan quanbu bijiao', run: () => showShapeOverview() },
  { id: 'name', g: '地图', t: '随机起一个地图名', kw: 'qm name mingzi suiji qiming', run: () => rollMapName(true) },
  { id: 'import', g: '地图', t: '导入 TMX / 项目文件', kw: 'dr import daoru tmx json', run: clickId('tmxImport') },
  { id: 'export', g: '导出', t: '导出 TMX + 小地图', k: 'Ctrl+E', kw: 'dc export daochu png', map: 1, run: () => exportPair() },
  { id: 'zip', g: '导出', t: '导出 ZIP（TMX + 小地图 + 说明）', kw: 'zip dabao daochu', map: 1, run: () => exportZipFn() },
  { id: 'saveas', g: '导出', t: '另存为…（改名 / 选内容 / 选位置）', k: 'Ctrl+Shift+S', kw: 'lcw save as lingcunwei', map: 1, run: () => showSaveAs() },
  { id: 'shot', g: '导出', t: '保存当前视图截图（含已开启的图层）', kw: 'jt screenshot jietu shitu dangqian tuceng', map: 1, run: () => saveViewShot() },
  { id: 'recipecopy', g: '地图', t: '复制配方码（分享整套参数）', kw: 'pfm recipe peifang fuzhi fenxiang code canshu', run: () => copyRecipe() },
  { id: 'recipepaste', g: '地图', t: '使用配方码…', kw: 'pfm recipe peifang zhantie paste shiyong', run: () => pasteRecipe() },
  { id: 'png', g: '导出', t: '预览 / 复制小地图图片', k: 'I', kw: 'xdt minimap png yulan fuzhi copy', map: 1, run: () => showMapPngPreview() },
  { id: 'poster', g: '导出', t: '生成分享海报', kw: 'hb poster haibao fenxiang', map: 1, run: () => showPoster() },
  { id: 'projexp', g: '导出', t: '导出项目文件（.json）', kw: 'xm project json xiangmu', map: 1, run: () => exportProject() },
  { id: 'doctor', g: '分析', t: '地图体检', k: 'D', kw: 'tj doctor tijian jiancha', map: 1, run: () => showMapDoctor() },
  { id: 'measure', g: '分析', t: '测距 + 地形剖面', k: 'U', kw: 'cj measure ceju juli poumian', map: 1, run: () => setMeasure(!measure.on) },
  { id: 'territory', g: '分析', t: '显示 / 隐藏领地图层', k: 'T', kw: 'ld territory lingdi', map: 1, run: () => setTerritoryLayer(!S.layers.territory) },
  { id: 'routes', g: '分析', t: '显示 / 隐藏接敌路线', k: 'L', kw: 'jd rush route jiedi luxian', map: 1, run: () => setRoutesLayer(!S.layers.routes) },
  { id: 'nearlayer', g: '分析', t: '显示 / 隐藏近家资源范围', k: 'N', kw: 'jj near jinjia fanwei', map: 1, run: clickId('layerNearRes') },
  { id: 'symmetry', g: '分析', t: '对称检查（标出不对称的地形 / 出生点 / 资源）', k: 'Y', kw: 'dc symmetry duicheng jiancha jingxiang mirror', map: 1, run: () => setSymmetryLayer(!S.layers.symmetry) },
  { id: 'tune', g: '出生点', t: '公平度一键微调（保持对称与近家资源）', k: 'O', kw: 'gpd wt tune youhua weitiao fairness gongping', map: 1, run: () => tuneFairness() },
  { id: 'spots', g: '分析', t: '落点热力：哪里放下一个出生点最宽敞', k: 'K', kw: 'ld rl spots luodian reli heatmap tuijian', map: 1, run: () => setSpotLayer(!S.layers.spots) },
  { id: 'symrepair', g: '出生点', t: '对称修复：补齐缺失的镜像出生点', kw: 'dcxf symmetry repair buqi jingxiang xiufu', map: 1, run: () => repairSpawnSymmetry() },
  { id: 'tournext', g: '出生点', t: '出生点巡视：下一个', k: '.', kw: 'xs tour xunshi xiayige next player wanjia kapian', map: 1, run: () => tourSpawn(1) },
  { id: 'tourprev', g: '出生点', t: '出生点巡视：上一个', k: ',', kw: 'xs tour xunshi shangyige prev player wanjia kapian', map: 1, run: () => tourSpawn(-1) },
  { id: 'slots', g: '出生点', t: '出生点槽位映射表', k: 'M', kw: 'cw slot caowei yingshe', map: 1, run: () => showSlotTable() },
  { id: 'spawnauto', g: '出生点', t: '智能重新布置出生点', kw: 'zn auto spawn zhineng buzhi chushengdian', map: 1, run: clickId('spawnAuto') },
  { id: 'reorder', g: '出生点', t: '按队伍重排玩家槽位', kw: 'cp reorder chongpai duiwu', map: 1, run: clickId('spawnReorder') },
  { id: 'nearfill', g: '出生点', t: '补齐近家资源点', kw: 'bq near resource buqi ziyuan', map: 1, run: () => fillNearSpawnResourcesManual() },
  { id: 'fit', g: '视图', t: '适应画布', k: 'F', kw: 'sy fit shiying', map: 1, run: () => fitView(true) },
  { id: 'zoom1', g: '视图', t: '1:1 像素', k: '0', kw: 'zoom 1:1 xiangsu', map: 1, run: clickId('zoomReset') },
  { id: 'focus', g: '视图', t: '专注模式（收起侧栏，画布铺满）', k: 'Z', kw: 'zz focus zhuanzhu quanping pumang fullscreen', run: () => setFocusMode(!focusOn()) },
  { id: 'grid', g: '视图', t: '显示 / 隐藏网格', kw: 'wg grid wangge', map: 1, run: clickId('layerGrid') },
  { id: 'theme', g: '主题', t: '选择主题…', kw: 'zt xz theme zhuti xuanze yanse pifu', run: () => openThemeMenu() },
  { id: 'themenext', g: '主题', t: '下一个主题', kw: 'zt xyg next theme zhuti xiayige qiehuan', run: () => nextTheme(1) },
  ...THEME_CHOICES.map(t => ({ id: 'theme-' + t.id, g: '主题', t: `主题：${t.name}${t.fx ? '（动态）' : ''}`, kw: `zt theme zhuti ${t.id} ${t.fx ? 'dt dongtai' : ''}`, run: () => applyTheme(t.id, true) })),
  { id: 'themefx', g: '主题', t: '开 / 关动态背景', kw: 'dt bj fx dongtai beijing donghua shengdian', run: () => { const on = !fxEnabled(); setFxEnabled(on); toast(on ? '动态背景：开' : '动态背景：已暂停'); } },
  { id: 'mode', g: '视图', t: '切换「快速生成 / 分步编辑」', kw: 'fb wizard mode fenbu kuaisu', run: () => setMode(S.mode === 'quick' ? 'wizard' : 'quick') },
  { id: 'save', g: '项目', t: '保存项目到本机', k: 'Ctrl+S', kw: 'bc save baocun xiangmu', run: () => saveProject(false) },
  { id: 'load', g: '项目', t: '恢复项目草稿', kw: 'hf load huifu caogao', run: () => loadProject() },
  { id: 'snap', g: '项目', t: '保存当前地图为历史快照', kw: 'kz snapshot kuaizhao lishi', map: 1, run: clickId('histSave') },
  { id: 'history', g: '项目', t: '版本历史', kw: 'ls history lishi banben', run: () => showHistory() },
  { id: 'prev', g: '项目', t: '找回上一张地图', kw: 'zh previous zhaohui shangyizhang', run: () => restorePrevious() },
  { id: 'compare', g: '项目', t: '新旧对比：与上一张地图左右对照', k: 'X', kw: 'db xjdb compare duibi shangyizhang qianhou', map: 1, run: () => showCompare() },
  { id: 'new', g: '项目', t: '新建项目', kw: 'xj new xinjian', run: () => newProject() },
  { id: 'engine', g: '系统', t: '重新启动本地引擎', kw: 'yq engine restart yinqing chongqi', run: () => Engine.manualRestart() },
  { id: 'help', g: '系统', t: '快捷键与帮助', k: '?', kw: 'bz help bangzhu kuaijiejian', run: () => showHelp() }
];
const cmdk = { open: false, items: [], active: 0, lastFocus: null };
const cmdkOpen = () => cmdk.open;
function cmdkRecent() { try { const v = JSON.parse(localStorage.getItem(CMDK_RECENT_KEY) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; } }
function cmdkTouch(id) { try { localStorage.setItem(CMDK_RECENT_KEY, JSON.stringify([id, ...cmdkRecent().filter(x => x !== id)].slice(0, 6))); } catch { /* ignore */ } }
/** 返回 { score, at, len }：at / len 为标题中命中的子串位置（用于高亮），0 分表示不匹配 */
function cmdkScore(c, q) {
  if (!q) return { score: 1 };
  const t = c.t.toLowerCase(), kw = (c.kw || '').toLowerCase();
  const at = t.indexOf(q);
  if (at >= 0) return { score: 100 - at, at, len: q.length };
  if (kw.split(/\s+/).some(w => w.startsWith(q))) return { score: 60 };
  if (kw.includes(q)) return { score: 40 };
  let i = 0; for (const ch of t) if (ch === q[i]) i++;
  return { score: i === q.length ? 20 : 0 };
}
function renderCmdk() {
  const q = $('cmdkInput').value.trim().toLowerCase(), recent = cmdkRecent(), hasMap = !!S.snapshot;
  let list = CMDS.map(c => ({ c, m: cmdkScore(c, q) })).filter(x => x.m.score > 0);
  const rank = id => { const i = recent.indexOf(id); return i < 0 ? 99 : i; };
  if (q) list.sort((a, b) => b.m.score - a.m.score || rank(a.c.id) - rank(b.c.id));
  else { const rc = list.filter(x => rank(x.c.id) < 99).sort((a, b) => rank(a.c.id) - rank(b.c.id)).map(x => ({ ...x, recent: true })); list = [...rc, ...list]; }
  cmdk.items = list;
  cmdk.active = Math.min(cmdk.active, Math.max(0, list.length - 1));
  let lastG = '';
  const html = list.map((x, i) => {
    const { c, m } = x, off = c.map && !hasMap, g = x.recent ? '最近使用' : c.g;
    const head = !q && g !== lastG ? `<li class="cmdk-group" role="presentation">${g}</li>` : '';
    lastG = g;
    const title = m.at != null ? `${escapeHtml(c.t.slice(0, m.at))}<mark>${escapeHtml(c.t.slice(m.at, m.at + m.len))}</mark>${escapeHtml(c.t.slice(m.at + m.len))}` : escapeHtml(c.t);
    return `${head}<li class="cmdk-item${i === cmdk.active ? ' active' : ''}${off ? ' off' : ''}" role="option" id="cmdk-${i}" data-i="${i}" aria-selected="${i === cmdk.active}" style="--d:${Math.min(i, 14) * 14}ms"><span class="cmdk-g">${escapeHtml(c.g)}</span><span class="cmdk-t">${title}${off ? '<small>需要先生成或导入地图</small>' : ''}</span>${c.k ? `<kbd>${escapeHtml(c.k)}</kbd>` : ''}</li>`;
  }).join('');
  $('cmdkList').innerHTML = html || '<li class="cmdk-empty">没有匹配的功能，换个关键词试试（支持拼音首字母，如 dc = 导出）</li>';
  $('cmdkInput').setAttribute('aria-activedescendant', list.length ? `cmdk-${cmdk.active}` : '');
}
function moveCmdk(d) {
  if (!cmdk.items.length) return;
  cmdk.active = (cmdk.active + d + cmdk.items.length) % cmdk.items.length;
  $('cmdkList').querySelectorAll('.cmdk-item').forEach(li => { const on = Number(li.dataset.i) === cmdk.active; li.classList.toggle('active', on); li.setAttribute('aria-selected', String(on)); if (on) li.scrollIntoView({ block: 'nearest' }); });
  $('cmdkInput').setAttribute('aria-activedescendant', `cmdk-${cmdk.active}`);
}
function openCmdk() {
  if (cmdk.open) return;
  closeOrientMenu(); closeThemeMenu(); closeModal('cancel'); if (isNarrow()) closeDrawer();
  cmdk.open = true; cmdk.active = 0; cmdk.lastFocus = document.activeElement;
  const el = $('cmdk'); el.hidden = false; requestAnimationFrame(() => el.classList.add('show'));
  $('cmdkInput').value = ''; renderCmdk();
  setTimeout(() => $('cmdkInput').focus({ preventScroll: true }), 30);
}
function closeCmdk() {
  if (!cmdk.open) return false;
  cmdk.open = false;
  const el = $('cmdk'); el.classList.remove('show');
  setTimeout(() => { if (!cmdk.open) el.hidden = true; }, 180);
  try { cmdk.lastFocus?.focus?.({ preventScroll: true }); } catch { /* ignore */ }
  return true;
}
function runCmdk(i = cmdk.active) {
  const x = cmdk.items[i]; if (!x) return;
  if (x.c.map && !S.snapshot) { toast('请先生成或导入地图', 'warn'); return; }
  closeCmdk(); cmdkTouch(x.c.id);
  setTimeout(() => { try { const r = x.c.run(); r?.catch?.(() => {}); } catch (e) { console.error(e); toast('操作失败：' + e.message, 'error'); } }, 120); // 等面板淡出后再弹出可能的对话框
}
function bindCmdk() {
  $('cmdkBtn')?.addEventListener('click', openCmdk);
  $('cmdk').addEventListener('click', e => { if (e.target === $('cmdk')) closeCmdk(); });
  $('cmdkInput').addEventListener('input', () => { cmdk.active = 0; renderCmdk(); });
  $('cmdkInput').addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); moveCmdk(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); moveCmdk(-1); }
    else if (e.key === 'Enter') { e.preventDefault(); runCmdk(); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeCmdk(); }
    else if (e.key === 'Tab') { e.preventDefault(); moveCmdk(e.shiftKey ? -1 : 1); } // 焦点留在输入框，Tab 也用来切换选项
  });
  $('cmdkList').addEventListener('click', e => { const li = e.target.closest('.cmdk-item'); if (li) runCmdk(Number(li.dataset.i)); });
  $('cmdkList').addEventListener('pointermove', e => { const li = e.target.closest('.cmdk-item'); if (li && Number(li.dataset.i) !== cmdk.active) { cmdk.active = Number(li.dataset.i) - 1; moveCmdk(1); } });
}

/* ------------------------------------------------------------------ ② 测距升级：沿线地形剖面
 * 测距只给出「多远」，看不出「好不好走」：两点之间是平地、要翻几道悬崖、还是要过一片海。
 * 量完两点后，画布底部弹出一条剖面图：沿 A→B 直线等距采样高度矩阵，陆地按海拔着色、水域蓝色、墙体 / 悬崖处打红色刻度，
 * 并汇总「海拔范围 · 跨越水域 N 段 · 墙体 / 悬崖 N 处 · 累计爬升 N 级」。鼠标 / 手指在剖面上移动时，画布上同步标出对应位置。 */
const profileHover = { t: -1 };
function measureProfile() {
  const m = measure, s = S.snapshot, h = terrainMatrix(s);
  if (!m.a || !m.b || !h?.data || m.straight < 1) return null;
  const cols = h.shape[1], rows = h.shape[0];
  const wm = getMatrix('wall_matrix', s), cm = getMatrix('cliff_mask', s);
  const useWall = !!wm?.data && wm.shape?.[1] === cols && (s?.meta?.hill_drawing_mode || 'brush') !== 'polygon';
  const useCliff = !!cm?.data && cm.shape?.[1] === cols;
  const n = clamp(Math.ceil(m.straight) + 1, 2, 240);
  const pts = [];
  let waterRuns = 0, cliffs = 0, climb = 0, wasWater = false, wasCliff = false, prevH = null;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1), r = clamp(Math.round(m.a.r + (m.b.r - m.a.r) * t), 0, rows - 1), c = clamp(Math.round(m.a.c + (m.b.c - m.a.c) * t), 0, cols - 1);
    const k = r * cols + c, v = h.data[k], water = v <= 0;
    const cliff = !water && ((useWall && wm.data[k] === 1) || (useCliff && !!cm.data[k]));
    if (water && !wasWater) waterRuns++;
    if (cliff && !wasCliff) cliffs++;
    if (!water && prevH != null && v > prevH) climb += v - prevH;
    if (!water) prevH = v;
    wasWater = water; wasCliff = cliff;
    pts.push({ t, v, water, cliff });
  }
  const land = pts.filter(p => !p.water).map(p => p.v);
  return { pts, waterRuns, cliffs, climb, lo: land.length ? Math.min(...land) : 0, hi: land.length ? Math.max(...land) : 0, min: Math.min(...pts.map(p => p.v)), max: Math.max(...pts.map(p => p.v)) };
}
function renderProfile() {
  const box = $('measureProfile'); if (!box) return;
  const m = measure, pf = m.on && m.a && m.b && m.final ? measureProfile() : null;
  if (!pf) { box.classList.remove('show'); box.setAttribute('aria-hidden', 'true'); return; }
  const W = 320, H = 70, pad = 4, span = Math.max(1, pf.max - Math.min(0, pf.min));
  const y = v => H - pad - ((Math.max(v, Math.min(0, pf.min)) - Math.min(0, pf.min)) / span) * (H - pad * 2);
  const x = t => pad + t * (W - pad * 2);
  let area = `M${x(0)},${H} `, line = '';
  pf.pts.forEach((p, i) => { const px = x(p.t).toFixed(1), py = y(p.water ? Math.min(0, pf.min) : p.v).toFixed(1); area += `L${px},${py} `; line += `${i ? 'L' : 'M'}${px},${py} `; });
  area += `L${x(1)},${H} Z`;
  const step = (W - pad * 2) / (pf.pts.length - 1);
  const water = pf.pts.map(p => p.water ? `<rect x="${(x(p.t) - step / 2).toFixed(1)}" y="${(H * 0.55).toFixed(1)}" width="${(step + 0.6).toFixed(1)}" height="${(H * 0.45).toFixed(1)}"/>` : '').join('');
  const cliff = pf.pts.map(p => p.cliff ? `<line x1="${x(p.t).toFixed(1)}" x2="${x(p.t).toFixed(1)}" y1="${(y(p.v) - 7).toFixed(1)}" y2="${(y(p.v) + 3).toFixed(1)}"/>` : '').join('');
  const facts = [`海拔 ${pf.lo === pf.hi ? `L${pf.lo}` : `L${pf.lo}–L${pf.hi}`}`, pf.waterRuns ? `跨越水域 <b>${pf.waterRuns}</b> 段` : '全程陆地', pf.cliffs ? `墙体 / 悬崖 <b>${pf.cliffs}</b> 处` : '无墙体', pf.climb ? `累计爬升 <b>${pf.climb}</b> 级` : '无爬升'];
  box.innerHTML = `<div class="mp-head"><b>地形剖面</b><span>${escapeHtml(m.a.label || 'A')} → ${escapeHtml(m.b.label || 'B')} · 直线 ${m.straight.toFixed(1)} 格</span><button type="button" class="mp-close" aria-label="关闭剖面">✕</button></div>
    <svg class="mp-chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="沿线海拔剖面"><defs><linearGradient id="mpg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--gold)" stop-opacity=".85"/><stop offset="1" stop-color="var(--accent-2)" stop-opacity=".25"/></linearGradient></defs>
      <g class="mp-water">${water}</g><path class="mp-area" d="${area}" fill="url(#mpg)"/><path class="mp-line" d="${line}"/><g class="mp-cliff">${cliff}</g>
      <circle class="mp-a" cx="${x(0)}" cy="${y(pf.pts[0].water ? 0 : pf.pts[0].v)}" r="3.4"/><circle class="mp-b" cx="${x(1)}" cy="${y(pf.pts[pf.pts.length - 1].water ? 0 : pf.pts[pf.pts.length - 1].v)}" r="3.4"/><line class="mp-cursor" x1="-10" x2="-10" y1="0" y2="${H}"/></svg>
    <div class="mp-facts">${facts.map(f => `<span>${f}</span>`).join('')}</div>`;
  box.querySelector('.mp-close').onclick = () => { m.final = false; renderProfile(); };
  const svg = box.querySelector('.mp-chart'), cur = box.querySelector('.mp-cursor');
  const hover = e => { const r = svg.getBoundingClientRect(); const t = clamp((e.clientX - r.left) / Math.max(1, r.width), 0, 1); profileHover.t = t; const px = x(t); cur.setAttribute('x1', px); cur.setAttribute('x2', px); scheduleRender(); };
  svg.addEventListener('pointermove', hover); svg.addEventListener('pointerdown', hover);
  svg.addEventListener('pointerleave', () => { profileHover.t = -1; cur.setAttribute('x1', -10); cur.setAttribute('x2', -10); scheduleRender(); });
  box.classList.add('show'); box.setAttribute('aria-hidden', 'false');
}
/** 画布上标出剖面光标对应的位置（在 drawMeasure 之后调用） */
function drawProfileCursor(ctx) {
  const m = measure; if (profileHover.t < 0 || !m.a || !m.b || !m.final) return;
  const t = profileHover.t, [x, y] = toScreen(m.a.r + (m.b.r - m.a.r) * t, m.a.c + (m.b.c - m.a.c) * t);
  ctx.save(); ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#ff8a3d'; ctx.stroke(); ctx.restore();
}

/* ------------------------------------------------------------------ ③ 随机地图起名
 * 导出文件名默认是「[p10]铁锈地图_20261019_1313」，在群里发了十几张图之后谁也分不清哪张是哪张。
 * 点地图名称旁的骰子（或命令面板「随机起名」），按「地形主题 + 地形形态 + 人数」生成一个好记的中文名，如「赤焰峡湾·5v5」。 */
const NAME_PREFIX = { 1: ['翠影', '藤蔓', '雨林', '蛇牙', '密林', '绿谷'], 2: ['霜峰', '冰川', '白狼', '寒鸦', '雪线', '凛冬'], 3: ['熔岩', '赤焰', '焦土', '炎狱', '灰烬', '火脊'], 4: ['黄沙', '烈日', '蝎尾', '流沙', '旱海', '金丘'], 5: ['松涛', '暮林', '鹿角', '青苔', '晨雾', '橡木'] };
const NAME_NOUN = { atoll: ['环礁', '潟湖'], delta: ['三角洲', '河口'], highland: ['高原', '要塞'], wetland: ['沼泽', '泽国'], island: ['孤岛', '海屿'], peninsula: ['半岛', '海角'], archipelago: ['群岛', '列岛'], river: ['双河', '河口'], mountain_lake: ['山湖', '天池'], continent: ['大陆', '平原'], desert: ['沙海', '绿洲'], snowland: ['雪原', '冻土'], volcano: ['火山口', '熔炉'], labyrinth: ['迷城', '回廊'], two_sides: ['狭路', '对岸'] };
const NAME_CLASSIC = ['峡湾', '要塞', '走廊', '高地', '海峡', '防线', '盆地', '前哨', '港湾', '隘口', '战线', '河谷'];
const pick = a => a[Math.floor(Math.random() * a.length)];
function rollMapName(announce = false) {
  const theme = intOf('tileset', 1, 5, 5), n = intOf('players', 0, MAX_SPAWN_POINTS, 10);
  const noun = shapeActive() ? pick(NAME_NOUN[shapeState.id] || NAME_CLASSIC) : pick(NAME_CLASSIC);
  let pre = pick(NAME_PREFIX[theme] || NAME_PREFIX[5]);
  if (noun.startsWith(pre.slice(-1))) pre = pick(NAME_PREFIX[theme] || NAME_PREFIX[5]); // 避免「雪原雪原」式的重字
  const mode = n >= 2 && n % 2 === 0 ? `${n / 2}v${n / 2}` : n ? `${n}人` : '';
  const name = `${pre}${noun}${mode ? '·' + mode : ''}`;
  const el = $('mapName'); el.value = name; flashInput('mapName');
  el.dispatchEvent(new Event('input', { bubbles: true }));
  const d = $('nameDice'); if (d) { d.classList.remove('roll'); void d.offsetWidth; d.classList.add('roll'); }
  if (announce) toast(`地图名：${name}`, 'info', 2200);
  return name;
}

/* ------------------------------------------------------------------ ④ 复制小地图图片（剪贴板）
 * PC 上做图后经常要把预览图贴到群聊 / 论坛帖子里；小地图预览弹窗新增「复制图片」。仅在系统支持图片剪贴板时显示。 */
const canCopyImage = () => !!(navigator.clipboard?.write && window.ClipboardItem && window.isSecureContext);
async function copyPngToClipboard(bytes) {
  try {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': new Blob([bytes], { type: 'image/png' }) })]);
    toast('小地图图片已复制，可直接粘贴到聊天窗口', 'success');
  } catch (e) { toast('复制失败：当前环境不允许写入图片剪贴板（' + (e?.message || e) + '）', 'warn', 4200); }
}

/* ================================================================== 3.17.0 新功能 */

/* ------------------------------------------------------------------ ① 配方码
 * 群里交流地图时常说「我用的 256、群岛、XY 对称、6 人……」，对方要逐项照着填，形态种子还经常抄错。
 * 配方码把整套参数（尺寸 / 主题 / 层级 / 人数 / 资源 / 对称 / 海岸线模板 / 地形形态 + 陆地比例 + 山地 + 种子 /
 * 模式预设 / 对称强度 / 槽位顺序 / 近家资源设置）按固定字段压成 27 字节，再加 2 字节 CRC 校验，
 * Base64URL 编码后共 44 个字符（TMX1- + 39 位）。复制、截断、误改都能被校验发现；夹在聊天文字里整段粘贴也能识别。
 * 形态模式下种子一并写入，对方套用后地形轮廓完全一致；经典模式只保证参数一致（引擎的海岸线随机性不受种子控制）。
 * 字段表只能在末尾追加（RECIPE_* 列表的顺序就是编码值），保证旧码永远可解。 */
const RECIPE_SHAPES = ['classic', 'island', 'peninsula', 'archipelago', 'river', 'mountain_lake', 'continent', 'desert', 'snowland', 'volcano', 'labyrinth', 'two_sides', 'atoll', 'delta', 'highland', 'wetland']; // 3.27.0：末尾追加 4 套新形态
const RECIPE_MIRRORS = ['none', 'horizontal', 'vertical', 'diagonal1', 'diagonal2', 'both'];
const RECIPE_PRESETS = ['1v1', '2v2', '3v3', '4v4', '5v5', '10v10', '20v20', '25v25', 'free', '30v30', '40v40', '50v50', 'ffa']; // 只能在末尾追加；25v25 保留用于解码旧码（套用时落到「自由配置」）
const RECIPE_SYM = ['strict', 'balanced', 'soft'];
const RECIPE_SLOT = ['alternate', 'grouped', 'engine'];
const RECIPE_ROUGH = ['0', '0.3', '0.8'];
const RECIPE_LEN = 29; // 27 字节参数 + 2 字节 CRC
/* 3.24.0：首字节为配方格式版本。地形形态模板在 3.24.0 重写，旧版（版本 1）的形态配方码参数仍然可解，
 * 但同一种子生成的轮廓与当年不同；写入版本 2 以便解码时识别并提示。字段布局两版完全相同。 */
/* 3.25.0：山湖 / 火山 / 两岸狭路 / 群岛 / 沙漠 / 大陆六个模板按「陆地比例参照物」重做（其余五个模板逐格不变），
 * 写入版本 3；版本 2 的这六个模板的形态码在解码时提示轮廓已更新。字段布局三版完全相同。 */
/* 3.27.0：新增 4 套形态（环礁 / 三角洲 / 高原要塞 / 沼泽），编码值追加在 RECIPE_SHAPES 末尾。用到新形态的码写版本 4，
 * 其余仍写版本 3 —— 旧版 App 读到版本 4 会提示「请升级」，而不是笼统的「参数超出范围」；不用新形态的码在旧版里照常可用。 */
const RECIPE_VERSION = 4;
const RECIPE_SHAPES_V4 = ['atoll', 'delta', 'highland', 'wetland'];
const RECIPE_SHAPES_V3 = ['mountain_lake', 'volcano', 'two_sides', 'archipelago', 'desert', 'continent'];
const RECIPE_RE = /TMX1-([A-Za-z0-9_-]{39})/;
const toB64Url = bytes => bytesToBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
/** 3.19.0：由「一组生成参数 + 形态信息」组成配方数据。ms = 地图实际使用的形态（S.mapShape），为空时取界面上的形态设置 */
function recipeFrom(p, ms = null) {
  const shape = ms ? ms.id : (shapeActive() ? shapeState.id : 'classic');
  return {
    w: p.width, h: p.height, ts: p.tileset, mirror: p.mirroring, hl: p.heightLevels, ol: p.oceanLevels, pl: p.numPlayers, rs: p.numResources,
    grid: (p.grid || DEFAULT_GRID).map(r => [...r]),
    shape, land: ms ? ms.land : shapeState.land, rough: ms?.rough ?? shapeState.rough,
    seed: shape === 'classic' ? 0 : ((ms ? ms.seed : shapeSeed()) >>> 0),
    preset: $('gamePreset').value, sym: $('symmetryStrength').value, slot: $('slotOrder').value, near: { ...S.nearRes }
  };
}
/* 3.19.0 修复（第十七轮审查 · 缺陷 2）：旧版有地图时只把「形态 / 种子 / 陆地比例」取自地图，宽高、对称、粗糙度、人数等
 * 仍取自界面。生成后改了任意一项（如把 160 改成 200 但还没重新生成）再复制配方码，得到的是「旧种子 + 新尺寸」的组合——
 * 既不是当前地图，也不是界面参数；形态地图的轮廓随尺寸变化，对方套用后得到的是另一张图，与「地形完全一致」的承诺相违背。
 * 现在每次成功生成 / 择优采用时把整套参数记入 S.mapRecipe，有地图时配方码一律以它为准；
 * 分步编辑 / 导入的地图没有完整的生成参数，仍按旧规则（形态取地图、其余取界面）。 */
function recipeData() {
  if (S.snapshot && S.mapRecipe) return { ...S.mapRecipe, grid: S.mapRecipe.grid.map(r => [...r]), near: { ...S.mapRecipe.near } };
  return recipeFrom(params(), S.snapshot && S.mapShape ? S.mapShape : null);
}
function encodeRecipe(d = recipeData()) {
  const b = new Uint8Array(RECIPE_LEN), v = new DataView(b.buffer);
  let o = 0;
  const u8 = x => { v.setUint8(o, x & 255); o += 1; }, u16 = x => { v.setUint16(o, x & 65535); o += 2; }, u32 = x => { v.setUint32(o, x >>> 0); o += 4; };
  const idx = (list, x, dft) => { const i = list.indexOf(String(x)); return i < 0 ? dft : i; };
  u8(RECIPE_SHAPES_V4.includes(String(d.shape)) ? 4 : 3); u16(d.w); u16(d.h);
  u8((clamp(d.ts | 0, 1, 5) << 4) | idx(RECIPE_MIRRORS, d.mirror, 2));
  u8(d.hl); u8(d.ol); u8(d.pl); u16(d.rs);
  let g = 0; (Array.isArray(d.grid) ? d.grid : DEFAULT_GRID).flat().slice(0, 25).forEach((x, i) => { if (Number(x)) g |= 1 << i; }); u32(g);
  u8(idx(RECIPE_SHAPES, d.shape, 0)); u8(clamp(Math.round(Number(d.land) || 50), 10, 90)); u8(idx(RECIPE_ROUGH, d.rough, 1)); u32(d.seed || 0);
  u8(idx(RECIPE_PRESETS, d.preset, 255)); u8((idx(RECIPE_SYM, d.sym, 1) << 4) | idx(RECIPE_SLOT, d.slot, 0));
  const n = d.near || NEAR_RES_DEFAULTS;
  u8((n.enabled !== false ? 1 : 0) | (clamp(n.perSpawn | 0 || 2, 2, 4) << 1)); u8(clamp(n.min | 0 || 10, 4, 160)); u8(clamp(n.max | 0 || 20, 4, 160));
  u16(crc32(b.subarray(0, o)));
  if (o !== RECIPE_LEN) throw new Error('配方码字段长度不一致'); // 防止以后增删字段时忘记同步 RECIPE_LEN
  return 'TMX1-' + toB64Url(b);
}
/** 从任意文本中找出配方码并解码：{ data, code } 或 { error } */
function decodeRecipe(text) {
  const m = RECIPE_RE.exec(String(text || ''));
  if (!m) return { error: /TMX\d+-/.test(String(text || '')) ? '配方码不完整：请确认整段复制（TMX1- 后面应有 39 个字符）' : '没有找到配方码（格式：TMX1-…）' };
  let b; try { b = base64ToBytes(m[1]); } catch { return { error: '配方码已损坏' }; }
  if (b.length !== RECIPE_LEN) return { error: '配方码已损坏' };
  const v = new DataView(b.buffer, b.byteOffset, b.length);
  if ((crc32(b.subarray(0, RECIPE_LEN - 2)) & 65535) !== v.getUint16(RECIPE_LEN - 2)) return { error: '配方码校验失败：可能复制不完整或被改动过' };
  if (b[0] < 1 || b[0] > RECIPE_VERSION) return { error: '这是更新版本生成的配方码，请升级 App 后再使用' };
  let o = 1;
  const u8 = () => v.getUint8(o++), u16 = () => { const x = v.getUint16(o); o += 2; return x; }, u32 = () => { const x = v.getUint32(o); o += 4; return x; };
  const d = { w: u16(), h: u16() };
  const tm = u8(); d.ts = tm >> 4; d.mirror = RECIPE_MIRRORS[tm & 15];
  d.hl = u8(); d.ol = u8(); d.pl = u8(); d.rs = u16();
  const g = u32(); d.grid = Array.from({ length: 5 }, (_, r) => Array.from({ length: 5 }, (_, c) => (g >>> (r * 5 + c)) & 1));
  d.shape = RECIPE_SHAPES[u8()]; d.land = u8(); d.rough = RECIPE_ROUGH[u8()]; d.seed = u32();
  d.preset = RECIPE_PRESETS[u8()] || null;
  const ss = u8(); d.sym = RECIPE_SYM[ss >> 4]; d.slot = RECIPE_SLOT[ss & 15];
  const nf = u8(); d.near = { enabled: !!(nf & 1), perSpawn: nf >> 1, min: u8(), max: u8() };
  const ok = d.w >= 40 && d.h >= 40 && d.w <= MAX_MAP_DIMENSION && d.h <= MAX_MAP_DIMENSION && d.ts >= 1 && d.ts <= 5 && d.mirror && d.hl >= 1 && d.hl <= 32 && d.ol <= 32
    && d.pl <= MAX_SPAWN_POINTS && d.rs <= MAX_RESOURCES && d.shape && d.land >= 10 && d.land <= 90 && d.rough && d.sym && d.slot
    && d.near.perSpawn >= 2 && d.near.perSpawn <= 4 && d.near.min >= 4 && d.near.max >= d.near.min;
  if (!ok) return { error: '配方码中的参数超出范围（可能来自不兼容的版本）' };
  // 版本 1 = 3.24.0 之前生成（全部形态）；版本 2 = 3.24.x 生成（3.25.0 重做的六个模板）：参数照常套用，但地形轮廓算法已更新
  d.legacyShape = d.shape !== 'classic' && (b[0] < 2 || (b[0] < 3 && RECIPE_SHAPES_V3.includes(d.shape)));
  // 3.26.0：只有旧码才带 legacyFrom（旧版对所有码都写 '3.25.0'，当前码的解码结果因此多出一个误导性的版本字段）
  if (d.legacyShape) d.legacyFrom = b[0] < 2 ? '3.24.0' : '3.25.0';
  return { data: d, code: 'TMX1-' + m[1] };
}
function recipeSummary(d) {
  const shape = d.shape === 'classic' ? '经典地形' : `「${shapeMeta(d.shape)?.label || d.shape}」形态 · 种子 ${d.seed}`;
  const n = d.pl, mode = n >= 2 && n % 2 === 0 ? `${n / 2}v${n / 2}` : `${n} 人`;
  return `${d.w}×${d.h} · ${SHAPE_THEMES[d.ts] || '模板' + d.ts}主题 · ${shape} · ${MIRROR_LABELS[d.mirror] || d.mirror} · ${mode} · 资源 ${d.rs}`;
}
function applyRecipe(d) {
  const set = (id, val) => { const el = $(id); if (el && val != null && String(el.value) !== String(val)) { el.value = val; flashInput(id); } };
  set('width', d.w); set('height', d.h); set('tileset', d.ts); set('mirror', d.mirror); set('heightLevels', d.hl); set('oceanLevels', d.ol);
  set('players', d.pl); set('resources', d.rs);
  if (d.preset) { setPresetValue(d.preset); onTeamModeChange({ quiet: true }); }
  set('symmetryStrength', d.sym); set('slotOrder', d.slot);
  renderGrid(d.grid);
  S.nearRes = { enabled: d.near.enabled, perSpawn: d.near.perSpawn, min: d.near.min, max: Math.max(d.near.min, d.near.max) };
  $('nearResToggle').classList.toggle('on', S.nearRes.enabled); $('nearResToggle').setAttribute('aria-checked', String(S.nearRes.enabled));
  $('nearResFields').classList.toggle('dim', !S.nearRes.enabled);
  $('nearResCount').value = String(S.nearRes.perSpawn); $('nearResMin').value = String(S.nearRes.min); $('nearResMax').value = String(S.nearRes.max);
  const shape = d.shape === 'classic' || shapeMeta(d.shape) ? d.shape : 'classic';
  shapeState.land = d.land; shapeState.rough = d.rough;
  $('shapeSeed').value = shape !== 'classic' && d.seed ? String(d.seed) : '';
  selectShape(shape, false); // user=false：不再套用形态的推荐主题 / 对称（以配方码为准）
  updateMirrorHint(); updateDensityHint(); savePrefs();
  return shape === d.shape;
}
/** 复制文本到剪贴板（WebView 不支持异步剪贴板时退回 execCommand） */
async function copyText(text) {
  try {
    if (navigator.clipboard?.writeText && window.isSecureContext) { await navigator.clipboard.writeText(text); return true; }
  } catch { /* 退回旧方法 */ }
  try {
    const ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0'; document.body.appendChild(ta); ta.select();
    const ok = document.execCommand('copy'); ta.remove(); return !!ok;
  } catch { return false; }
}
async function copyRecipe() {
  const d = recipeData(), code = encodeRecipe(d);
  // 3.19.0：配方码按当前地图的生成参数编码；界面参数改过但还没重新生成时说明一下，避免用户以为复制的是界面参数
  let uiDiff = false; try { uiDiff = !!(S.snapshot && S.mapRecipe) && encodeRecipe(recipeFrom(params(), null)) !== code; } catch { /* ignore */ }
  const ok = await copyText(code);
  const btn = $('recipeCopy');
  if (btn) { btn.classList.remove('copied'); void btn.offsetWidth; btn.classList.add('copied'); clearTimeout(btn._t); btn._t = setTimeout(() => btn.classList.remove('copied'), 1600); }
  if (ok) { toast(`配方码已复制：${recipeSummary(d)}${uiDiff ? '（按当前地图的生成参数；界面上改过的参数尚未生成，未计入）' : ''}`, 'success', uiDiff ? 5600 : 4200); return code; }
  await uiChoice('配方码', `<p class="help-p">当前环境不允许写入剪贴板，请长按 / 全选下面的配方码手动复制：</p><input class="prompt-input recipe-code" type="text" readonly value="${escapeHtml(code)}" onfocus="this.select()"><p class="help-p">${escapeHtml(recipeSummary(d))}</p>`, [{ key: 'ok', label: '知道了', primary: true }]);
  return code;
}
async function pasteRecipe(prefill = '') {
  if (!guard()) return;
  if (!prefill) { try { if (navigator.clipboard?.readText && window.isSecureContext) { const t = await navigator.clipboard.readText(); if (RECIPE_RE.test(t)) prefill = t; } } catch { /* 无剪贴板读取权限：让用户手动粘贴 */ } }
  const p = uiChoice('使用配方码', `<p class="help-p">粘贴别人分享的配方码（以 <code>TMX1-</code> 开头）；可以连同聊天文字整段粘贴，会自动识别。</p>
    <textarea id="recipeInput" class="prompt-input recipe-input" rows="3" spellcheck="false" autocomplete="off" placeholder="TMX1-…">${escapeHtml(prefill)}</textarea>
    <div id="recipePreview" class="recipe-preview" aria-live="polite"></div>`,
  [{ key: 'cancel', label: '取消' }, { key: 'apply', label: '只套用参数' }, { key: 'gen', label: '套用并生成', primary: true }]);
  requestAnimationFrame(() => {
    const ta = $('recipeInput'), pv = $('recipePreview'); if (!ta || !pv) return;
    const show = () => {
      const r = decodeRecipe(ta.value);
      pv.dataset.state = !ta.value.trim() ? '' : r.error ? 'bad' : 'ok';
      pv.textContent = !ta.value.trim() ? '' : r.error ? r.error : `✓ ${recipeSummary(r.data)}${r.data.legacyShape ? `（旧版配方码：该地形形态的算法已在 ${r.data.legacyFrom} 更新，参数一致但轮廓会与原图不同）` : ''}`;
    };
    ta.addEventListener('input', show); show();
    if (!prefill) ta.focus({ preventScroll: true });
  });
  const k = await p;
  if (k !== 'apply' && k !== 'gen') return;
  const r = decodeRecipe($('recipeInput')?.value);
  if (r.error) { toast(r.error, 'warn', 4200); return; }
  const full = applyRecipe(r.data);
  if (!full) toast('配方码里的地形形态在当前版本中不存在，已改用经典地形', 'warn', 4200);
  else if (r.data.legacyShape) toast(`这是 ${r.data.legacyFrom} 之前的配方码：该地形形态的算法已更新，同一种子的地形轮廓会与原图不同`, 'warn', 5200);
  toast(`已套用配方：${recipeSummary(r.data)}`, 'success', 3600);
  if (k === 'gen') await generate();
}

/* ------------------------------------------------------------------ ② 实时体检徽章
 * 体检原本要手动点「地图体检」才知道分数，拖完出生点并不知道变好还是变坏。现在状态栏常驻一个健康分徽章：
 * 每次编辑后（出生点 / 队伍 / 资源 / 地形）防抖 0.9 秒，在浏览器空闲时重新评分；数字滚动到新值，并显示 ▲/▼ 涨跌，
 * 点击打开完整体检。评分复用 analyzeMap()（同一个 docCache，体检面板随后打开是瞬时的）；签名不变时不重复计算；
 * 处理中（S.locked）或页面在后台时延后。实测 1000×1000 地图单次约 0.47 秒，所以必须防抖、且只在空闲时跑。 */
const health = { timer: 0, score: null, sig: '' };
function resetHealthBadge() {
  clearTimeout(health.timer); health.score = null; health.sig = '';
  const b = $('healthBadge'); if (b) { b.hidden = true; const d = b.querySelector('.hb-delta'); if (d) { d.textContent = ''; d.dataset.dir = ''; } }
}
function queueHealthBadge(delay = 900) { clearTimeout(health.timer); health.timer = setTimeout(runHealthBadge, delay); }
function runHealthBadge() {
  const b = $('healthBadge'); if (!b) return;
  if (!S.snapshot || currentSpawns().length < 2) { b.hidden = true; return; }
  if (S.locked || document.hidden || drag) { queueHealthBadge(1200); return; }
  const idle = window.requestIdleCallback ? fn => window.requestIdleCallback(fn, { timeout: 1500 }) : fn => setTimeout(fn, 16);
  idle(() => {
    if (!S.snapshot || S.locked || currentSpawns().length < 2) { if (!S.snapshot) b.hidden = true; else queueHealthBadge(1200); return; }
    const sig = analysisSig();
    if (sig === health.sig && !b.hidden) return;
    let a = null;
    try { a = analyzeMap(); } catch (e) { console.warn('实时体检失败', e); }
    if (!a) return;
    health.sig = sig;
    const prev = health.score, diff = prev == null ? 0 : a.score - prev;
    health.score = a.score;
    const lv = a.score >= 85 ? 'ok' : a.score >= 65 ? 'warn' : 'bad';
    const wasHidden = b.hidden;
    b.hidden = false; b.dataset.level = lv;
    if (wasHidden) { b.classList.remove('enter'); void b.offsetWidth; b.classList.add('enter'); }
    animateNumber(b.querySelector('.hb-num'), a.score);
    const d = b.querySelector('.hb-delta');
    if (diff) { d.textContent = (diff > 0 ? '▲' : '▼') + Math.abs(diff); d.dataset.dir = diff > 0 ? 'up' : 'down'; d.classList.remove('pop'); void d.offsetWidth; d.classList.add('pop'); }
    b.title = `地图健康度 ${a.score}/100${diff ? `（较上次 ${diff > 0 ? '+' : ''}${diff}）` : ''} · 点击查看完整体检（D）`;
    b.setAttribute('aria-label', b.title);
  });
}

/* ------------------------------------------------------------------ ③ 触屏放大镜
 * 手指拖动出生点、拖线测距或画墙时，指尖正好挡住落点，只能凭感觉松手。现在在手指上方弹出一个放大 2 倍的圆镜：
 * 每帧画布渲染完后从主画布直接截取指尖周围的像素（drawImage，不重新绘制地图），叠加十字准星；
 * 靠近顶部时镜子自动翻到手指下方，左右不超出画布。只在 pointerType = touch 时出现，鼠标操作不受影响。 */
const loupe = { on: false, x: 0, y: 0 };
const LOUPE_SIZE = 124, LOUPE_ZOOM = 2;
function updateLoupe(g, e) {
  if (!g || !g.touch || g.cancelled || !g.moved || !['spawn', 'measure', 'paint'].includes(g.type) || pointers.size !== 1) { hideLoupe(); return; }
  const r = $('map').getBoundingClientRect();
  loupe.x = e.clientX - r.left; loupe.y = e.clientY - r.top;
  if (!loupe.on) {
    loupe.on = true;
    const el = $('loupe'); clearTimeout(el._t); el.hidden = false;
    requestAnimationFrame(() => el.classList.add('show'));
  }
  scheduleRender();
}
function hideLoupe() {
  if (!loupe.on) return;
  loupe.on = false;
  const el = $('loupe'); if (!el) return;
  el.classList.remove('show'); clearTimeout(el._t);
  el._t = setTimeout(() => { if (!loupe.on) el.hidden = true; }, 200);
}
function drawLoupe() {
  if (!loupe.on) return;
  const el = $('loupe'), src = $('map'); if (!el || !src) return;
  const cw = src.clientWidth || 1, ch = src.clientHeight || 1, dpr = src.width / cw;
  const px = Math.round(LOUPE_SIZE * dpr);
  if (el.width !== px) { el.width = px; el.height = px; }
  const ctx = el.getContext('2d'), half = LOUPE_SIZE / LOUPE_ZOOM / 2;
  ctx.save();
  ctx.fillStyle = canvasBg; ctx.fillRect(0, 0, px, px);
  ctx.imageSmoothingEnabled = false;
  const sx = (loupe.x - half) * dpr, sy = (loupe.y - half) * dpr, sw = half * 2 * dpr;
  try { ctx.drawImage(src, sx, sy, sw, sw, 0, 0, px, px); } catch { /* 画布尺寸为 0 */ }
  const c = px / 2, u = dpr;
  ctx.lineWidth = 3 * u; ctx.strokeStyle = 'rgba(0,0,0,.55)';
  ctx.beginPath(); ctx.moveTo(c - 14 * u, c); ctx.lineTo(c - 5 * u, c); ctx.moveTo(c + 5 * u, c); ctx.lineTo(c + 14 * u, c);
  ctx.moveTo(c, c - 14 * u); ctx.lineTo(c, c - 5 * u); ctx.moveTo(c, c + 5 * u); ctx.lineTo(c, c + 14 * u); ctx.stroke();
  ctx.lineWidth = 1.5 * u; ctx.strokeStyle = '#fff'; ctx.stroke();
  ctx.beginPath(); ctx.arc(c, c, 2 * u, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill();
  ctx.restore();
  const panel = $('mapPanel').getBoundingClientRect(), mr = src.getBoundingClientRect();
  const fx = loupe.x + mr.left - panel.left, fy = loupe.y + mr.top - panel.top;
  let top = fy - LOUPE_SIZE - 44;
  const below = top < 8;
  if (below) top = fy + 44;
  const left = clamp(fx - LOUPE_SIZE / 2, 6, Math.max(6, panel.width - LOUPE_SIZE - 6));
  el.style.left = left + 'px'; el.style.top = clamp(top, 6, Math.max(6, panel.height - LOUPE_SIZE - 6)) + 'px';
  el.classList.toggle('below', below);
}

/* ------------------------------------------------------------------ ④ 专注模式（Z）
 * 大地图细调时侧栏和顶栏占掉三分之一屏幕。专注模式收起侧栏和顶栏，画布铺满；画面中心对应的地图位置保持不变
 * （由已有的 ResizeObserver → onResize 逐帧跟随，不会跳）。手机上侧栏本来就是抽屉，只收起顶栏、关闭抽屉。
 * 退出：Z / Esc / Android 返回键 / 顶部胶囊按钮。状态不持久化（下次启动总是正常布局，避免用户找不到侧栏）。
 * 注意（3.17.0 自查修复）：首版在手机上也把网格列改成「0 1fr」，而手机布局只有一列、侧栏是 fixed 抽屉不占网格，
 * 画布被挤进宽度为 0 的第一列，整屏空白。现在列宽变化只在桌面布局（> 900px）生效。 */
const focusOn = () => document.body.classList.contains('focus-mode');
function setFocusMode(on, { quiet = false } = {}) {
  on = !!on;
  if (focusOn() === on) return;
  if (on) { closeDrawer(); closeThemeMenu(); closeOrientMenu(); }
  const body = document.body;
  body.classList.add('focus-anim'); clearTimeout(setFocusMode._t);
  setFocusMode._t = setTimeout(() => body.classList.remove('focus-anim'), 420);
  body.classList.toggle('focus-mode', on);
  const b = $('focusBtn'); if (b) { b.classList.toggle('active', on); b.setAttribute('aria-pressed', String(on)); }
  if (!quiet) setStatus(on ? '专注模式：按 Z 或 Esc 退出' : '已退出专注模式');
}

/* ------------------------------------------------------------------ ⑤ 当前视图截图
 * 「小地图 PNG」和「海报」都是整张地图的固定样式；讨论某个局部（「这条路线太近了」「这里卡住了」）时需要的是
 * 「我现在看到的画面」：当前缩放与位置，连同已开启的领地 / 接敌路线 / 测距 / 近家范围等图层。直接复制主画布像素，
 * 动态主题下透明的空白处补上底色，右下角加水印（地图名 · 尺寸 · 版本），保存方式与海报相同（Android 可「分享」）。 */
async function saveViewShot() {
  if (!S.snapshot) { toast('请先生成或导入地图', 'warn'); return; }
  if (!guard()) return;
  const src = $('map');
  hoverCell = null; renderMap(); // 同步画一帧最新画面（去掉鼠标悬停格）
  const cv = document.createElement('canvas'); cv.width = src.width; cv.height = src.height;
  const ctx = cv.getContext('2d'), dpr = src.width / Math.max(1, src.clientWidth);
  ctx.fillStyle = canvasBg; ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.drawImage(src, 0, 0);
  const [rows, cols] = dims();
  const mark = `${sanitizeName($('mapName').value) || '未命名地图'} · ${cols}×${rows} · 出生点 ${currentSpawns().length} · TMX MapForge v${APP_VERSION}`;
  // 3.19.0：窄屏（手机竖屏）上水印可能比画布还宽，左边被裁掉；按可用宽度缩小字号，仍放不下再截断
  let fs = 12 * dpr;
  ctx.font = `600 ${Math.round(fs)}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  const maxW = cv.width - 36 * dpr;
  if (ctx.measureText(mark).width > maxW) { fs = Math.max(8 * dpr, fs * maxW / ctx.measureText(mark).width); ctx.font = `600 ${Math.round(fs)}px system-ui, -apple-system, "Segoe UI", sans-serif`; }
  const markText = fitText(ctx, mark, maxW);
  const tw = ctx.measureText(markText).width, pad = 8 * dpr, h = 24 * dpr, x = cv.width - tw - pad * 2 - 10 * dpr, y = cv.height - h - 10 * dpr;
  ctx.fillStyle = 'rgba(0,0,0,.55)'; roundRectPath(ctx, x, y, tw + pad * 2, h, 8 * dpr); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.92)'; ctx.textBaseline = 'middle'; ctx.fillText(markText, x + pad, y + h / 2);
  const panel = $('mapPanel'); panel.classList.remove('shot-flash'); void panel.offsetWidth; panel.classList.add('shot-flash');
  setTimeout(() => panel.classList.remove('shot-flash'), 600);
  const blob = await canvasToPng(cv);
  if (!blob) { toast('截图失败：无法编码 PNG', 'error'); return; }
  const bytes = new Uint8Array(await blob.arrayBuffer()), name = `${exportBaseName()}_view_${stamp()}.png`;
  await locked(async () => {
    try {
      beginShareBatch();
      const r = await saveFile(bytes, name, 'image/png');
      if (r.desktop) window.DesktopBridge.savedToast(r, `视图截图已保存：${r.name}`);
      else toast(r.pending ? '等待存储权限授予后自动保存' : `视图截图已保存：${r.name || name}（${cv.width}×${cv.height}）`, 'success', 3600, r.pending ? {} : shareAction());
    } catch (e) { toast('保存截图失败：' + e.message, 'error'); }
  });
}

/* ================================================================== 3.19.0 新功能 */
const reduceMotion = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/* ------------------------------------------------------------------ ① 对称检查图层（Y）
 * 做图时最常见的「不公平」来源不是算法，而是手工改动：画笔补了一段墙、拖了一个出生点、补了几个资源点，只改了一边。
 * 对称地图上肉眼很难发现这种单边差异。本图层逐格把地形与它的镜像位置比较，把不一致处按严重程度着色：
 *   红 = 一边是陆地、一边是水域；橙 = 一边有墙体 / 悬崖、另一边没有。高度层级不参与比较（引擎的高度本来就是噪声生成、并不对称），并用形态学开运算滤掉 1～2 格宽的边缘误差。
 * 同时画出对称轴，并把「找不到镜像对应点」的出生点 / 资源点圈出来（容差 2 格）。镜像模式取地图自身的
 * meta.mirroring（引擎生成的地图来自参数，导入的地图来自 detectSymmetry 自动识别）；不对称的地图不做检查。
 * 结果按 analysisSig()（快照 + 悬崖 + 出生点 + 资源点）缓存：地形 / 出生点 / 资源每次变化都会重新计算。
 * 2000×2000 的地图单次约 0.1 秒，图层用 ≤1024 像素的降采样画布绘制（块内取最严重的等级）。 */
const SYM_TOL = 2;
const SYM_COLORS = { 3: [255, 77, 94, 210], 2: [255, 159, 67, 190] };
let symCache = null, symTimer = 0, symFade = 0;
function symmetryModeOf(s = S.snapshot) {
  const m = s?.meta?.mirroring, [rows, cols] = dimsOf(s);
  if (!SYMMETRY_MODES.has(m) || m === 'none') return null;
  if ((m === 'diagonal1' || m === 'diagonal2') && rows !== cols) return null;
  return m;
}
/** 该镜像模式下的全部变换（index → 镜像 index） */
function symTransforms(mode, rows, cols) {
  const H = k => { const r = (k / cols) | 0, c = k - r * cols; return (rows - 1 - r) * cols + c; };
  const V = k => { const r = (k / cols) | 0, c = k - r * cols; return r * cols + (cols - 1 - c); };
  const R = k => rows * cols - 1 - k;
  const D1 = k => { const r = (k / cols) | 0, c = k - r * cols; return c * cols + r; };
  const D2 = k => { const r = (k / cols) | 0, c = k - r * cols; return (cols - 1 - c) * cols + (rows - 1 - r); };
  return { horizontal: [H], vertical: [V], both: [H, V, R], diagonal1: [D1], diagonal2: [D2] }[mode] || [];
}
function analyzeSymmetry(s = S.snapshot) {
  const mode = symmetryModeOf(s);
  if (!s || !mode) return { mode: null };
  const sig = analysisSig(s) + '|' + mode;
  if (symCache && symCache.sig === sig) return symCache.result;
  const h = terrainMatrix(s); if (!h?.data) return { mode: null };
  const [rows, cols] = dimsOf(s), n = rows * cols, hd = h.data;
  const wm = getMatrix('wall_matrix', s), cm = getMatrix('cliff_mask', s);
  const wd = wm?.data && (s?.meta?.hill_drawing_mode || 'brush') !== 'polygon' && wm.shape?.[0] === rows && wm.shape?.[1] === cols ? wm.data : null;
  const cd = cm?.data && cm.shape?.[0] === rows && cm.shape?.[1] === cols ? cm.data : null;
  const blocked = k => (wd && wd[k] === 1) || (cd && cd[k]) ? 1 : 0;
  /* 实测：引擎的「对称」只作用于海岸线模板与出生点 / 资源，高度层级是噪声生成的（约 1/3 的格子与镜像不同），
   * 海岸线经过平滑后也有约 1～2% 的格子在边缘差一格。逐格比较会把每张地图都标满，所以：
   *   · 不比较高度层级，只比较「陆地 / 水域」和「墙体 / 悬崖」；
   *   · 对差异做形态学开运算（3×3 先腐蚀再膨胀）：1～2 格宽的细带（引擎平滑的边缘误差）被消掉，
   *     成片的单边差异（手工补墙、改地形、导入后修改）保留下来并恢复原来的形状。 */
  const raw = new Uint8Array(n), tf = symTransforms(mode, rows, cols);
  for (let k = 0; k < n; k++) {
    let v = 0;
    const land = hd[k] > 0, wall = blocked(k);
    for (const t of tf) {
      const j = t(k);
      if (j === k) continue;
      if ((hd[j] > 0) !== land) { v = 3; break; }
      if (blocked(j) !== wall) v = 2;
    }
    raw[k] = v;
  }
  const core = new Uint8Array(n);
  for (let r = 1; r < rows - 1; r++) for (let c = 1; c < cols - 1; c++) {
    const k = r * cols + c; if (!raw[k]) continue;
    let all = true;
    for (let dr = -1; dr <= 1 && all; dr++) for (let dc = -1; dc <= 1; dc++) if (!raw[k + dr * cols + dc]) { all = false; break; }
    if (all) core[k] = 1;
  }
  const sev = new Uint8Array(n), cnt = [0, 0, 0, 0];
  for (let r = 1; r < rows - 1; r++) for (let c = 1; c < cols - 1; c++) {
    if (!core[r * cols + c]) continue;
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) { const j = (r + dr) * cols + c + dc; if (!sev[j]) { sev[j] = raw[j]; cnt[raw[j]]++; } }
  }
  let first = sev.findIndex(v => v === 3);
  if (first < 0) first = sev.findIndex(v => v > 0);
  // 出生点 / 资源点：每个镜像位置附近（容差 SYM_TOL 格）都应有对应点
  const unmatched = (list, tol) => {
    const out = [];
    list.forEach((p, i) => {
      const imgs = mirrorPoint(p, mode, rows, cols);
      if (imgs.some(q => !list.some(o => Math.hypot(o[0] - q[0], o[1] - q[1]) <= tol))) out.push(i);
    });
    return out;
  };
  const spawns = currentSpawns(), res = s.resource_positions || [];
  const spawnsOff = unmatched(spawns, SYM_TOL), resOff = unmatched(res, SYM_TOL).map(i => res[i]);
  // 降采样画布（块内取最严重的等级）
  const scale = Math.max(1, Math.ceil(Math.max(rows, cols) / 1024)), W = Math.ceil(cols / scale), Hh = Math.ceil(rows / scale);
  let canvas = null;
  if (cnt[2] + cnt[3] > 0) {
    const blk = scale > 1 ? new Uint8Array(W * Hh) : sev;
    if (scale > 1) for (let k = 0; k < n; k++) if (sev[k]) { const r = (k / cols) | 0, c = k - r * cols, b = ((r / scale) | 0) * W + ((c / scale) | 0); if (sev[k] > blk[b]) blk[b] = sev[k]; }
    canvas = document.createElement('canvas'); canvas.width = W; canvas.height = Hh;
    const ctx = canvas.getContext('2d'), img = ctx.createImageData(W, Hh), d = img.data;
    for (let b = 0; b < blk.length; b++) { const col = SYM_COLORS[blk[b]]; if (!col) continue; d.set(col, b * 4); }
    ctx.putImageData(img, 0, 0);
  }
  const land = hd.reduce((a, v) => a + (v > 0 ? 1 : 0), 0) || 1;
  const result = {
    mode, rows, cols, scale, canvas, counts: { land: cnt[3], wall: cnt[2] },
    pct: { land: cnt[3] / n, wall: cnt[2] / land },
    spawnsOff, resOff, first: first >= 0 ? [(first / cols) | 0, first % cols] : null,
    clean: !cnt[3] && !cnt[2] && !spawnsOff.length && !resOff.length
  };
  if (s === S.snapshot) symCache = { sig, result };
  return result;
}
function symmetrySummary(r) {
  if (!r?.mode) return '当前地图不是对称地图，无需对称检查';
  if (r.clean) return `对称检查（${MIRROR_LABELS[r.mode]}）：地形、出生点与资源点完全对称 ✓`;
  const parts = [];
  if (r.counts.land) parts.push(`陆地 / 水域不一致 ${r.counts.land} 格`);
  if (r.counts.wall) parts.push(`墙体 / 悬崖不一致 ${r.counts.wall} 格`);
  if (r.spawnsOff.length) parts.push(`${r.spawnsOff.length} 个出生点无镜像`);
  if (r.resOff.length) parts.push(`${r.resOff.length} 个资源点无镜像`);
  return `对称检查（${MIRROR_LABELS[r.mode]}）：${parts.join(' · ')}`;
}
function setSymmetryLayer(on, { quiet = false } = {}) {
  S.layers.symmetry = !!on;
  $('layerSymmetry')?.classList.toggle('active', S.layers.symmetry);
  syncLayerAria('layerSymmetry');
  $('mapPanel')?.classList.toggle('sym-on', S.layers.symmetry);
  if (on) {
    symFade = performance.now();
    if (!S.snapshot) { if (!quiet) toast('生成地图后即可检查对称性', 'info'); }
    else if (!quiet) {
      let r = null; try { r = analyzeSymmetry(); } catch (e) { console.warn('对称检查失败', e); }
      const msg = symmetrySummary(r);
      setStatus(msg);
      const where = r?.spawnsOff?.length ? (() => { const q = currentSpawns()[r.spawnsOff[0]]; return q ? [q[0], q[1]] : null; })() : (r?.first || (r?.resOff?.[0] ? [...r.resOff[0]] : null));
      toast(msg, r?.mode ? (r.clean ? 'success' : 'warn') : 'info', 4600,
        r?.mode && r.spawnsOff?.length ? { action: { label: '补齐镜像', fn: () => repairSpawnSymmetry() } } // 3.20.0
          : r?.mode && !r.clean && where ? { action: { label: '定位', fn: () => flyToCell(where[0], where[1]) } } : {});
    }
  }
  scheduleRender();
}
function drawSymmetry(ctx, rows, cols, fadeK) {
  if (!S.layers.symmetry || !S.snapshot) return false;
  const sig = analysisSig() + '|' + symmetryModeOf();
  if (!symCache || symCache.snap !== snapId(S.snapshot)) { try { analyzeSymmetry(); } catch (e) { console.warn(e); } if (symCache) symCache.snap = snapId(S.snapshot); }
  else if (symCache.sig !== sig) { clearTimeout(symTimer); symTimer = setTimeout(() => { try { analyzeSymmetry(); if (symCache) symCache.snap = snapId(S.snapshot); } catch (e) { console.warn(e); } scheduleRender(); }, 120); }
  const r = symCache?.result; if (!r?.mode) return false;
  const k = clamp((performance.now() - symFade) / 420, 0, 1), z = S.view.zoom, x0 = S.view.x, y0 = S.view.y;
  ctx.save(); ctx.globalAlpha = (0.3 + 0.7 * k) * fadeK;
  if (r.canvas) {
    ctx.beginPath(); ctx.rect(x0, y0, cols * z, rows * z); ctx.clip();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(r.canvas, x0, y0, r.canvas.width * r.scale * z, r.canvas.height * r.scale * z);
  }
  // 对称轴（虚线 + 柔光）
  const W = cols * z, H = rows * z, axes = [];
  if (r.mode === 'horizontal' || r.mode === 'both') axes.push([x0, y0 + H / 2, x0 + W, y0 + H / 2]);
  if (r.mode === 'vertical' || r.mode === 'both') axes.push([x0 + W / 2, y0, x0 + W / 2, y0 + H]);
  if (r.mode === 'diagonal1') axes.push([x0, y0, x0 + W, y0 + H]);
  if (r.mode === 'diagonal2') axes.push([x0 + W, y0, x0, y0 + H]);
  ctx.setLineDash([10, 7]); ctx.lineDashOffset = -k * 34;
  for (const [ax, ay, bx, by] of axes) {
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ax + (bx - ax) * k, ay + (by - ay) * k);
    ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.stroke();
    ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(184,140,255,.95)'; ctx.stroke();
  }
  ctx.setLineDash([]);
  // 无镜像对应点的出生点 / 资源点：品红虚线圈
  const ring = (rr, cc, rad) => { const [sx, sy] = toScreen(rr, cc); ctx.beginPath(); ctx.arc(sx, sy, rad, 0, Math.PI * 2); ctx.stroke(); };
  ctx.lineWidth = 2.5; ctx.strokeStyle = '#ff5bd1'; ctx.setLineDash([5, 4]);
  const sp = currentSpawns();
  r.spawnsOff.forEach(i => { const q = sp[i]; if (q) ring(q[0], q[1], Math.max(12, spawnRadius() + 9)); });
  r.resOff.forEach(q => ring(q[0], q[1], Math.max(9, 2.6 * z)));
  ctx.restore();
  return k < 1;
}
/** 平滑飞到某一格（用于「定位」） */
function flyToCell(r, c, zoom) {
  const rect = $('map').getBoundingClientRect(), [rows, cols] = dims();
  if (!rows || !cols) return;
  const z = zoom || clamp(Math.min(rect.width, rect.height) / 48, S.view.zoom, 40);
  flyViewTo(rect.width / 2 - (c + 0.5) * z, rect.height / 2 - (r + 0.5) * z, z);
}
/** 3.19.0：「跃迁式」相机：距离较远时先略微拉远、再推近到目标（类似地图应用的飞行定位），近距离时退化为普通缓动 */
function flyViewTo(x, y, zoom, dur = 520) {
  if (reduceMotion()) { cancelAnimationFrame(viewAnim); S.view.zoom = zoom; S.view.x = x; S.view.y = y; S.view.fitted = false; scheduleRender(); return; }
  cancelAnimationFrame(viewAnim);
  const rect = $('map').getBoundingClientRect(), cx = rect.width / 2, cy = rect.height / 2;
  const from = { ...S.view }, t0 = performance.now();
  // 以「屏幕中心对应的地图坐标」插值，再按当前缩放换算回平移量，避免缩放与平移叠加时画面先甩出去再回来
  const u0 = (cx - from.x) / from.zoom, v0 = (cy - from.y) / from.zoom, u1 = (cx - x) / zoom, v1 = (cy - y) / zoom;
  const travel = Math.hypot(u1 - u0, v1 - v0) * Math.min(from.zoom, zoom) / Math.max(1, Math.min(rect.width, rect.height));
  const hop = clamp(travel * 0.35, 0, 0.45); // 远距离时中途最多拉远 45%
  S.view.fitted = false;
  const tick = now => {
    const t = Math.min(1, (now - t0) / dur), e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    const zl = Math.exp(Math.log(from.zoom) + (Math.log(zoom) - Math.log(from.zoom)) * e) * (1 - hop * Math.sin(Math.PI * t));
    const u = u0 + (u1 - u0) * e, v = v0 + (v1 - v0) * e;
    S.view.zoom = zl; S.view.x = cx - u * zl; S.view.y = cy - v * zl;
    renderMap();
    if (t < 1) viewAnim = requestAnimationFrame(tick);
  };
  viewAnim = requestAnimationFrame(tick);
}

/* ------------------------------------------------------------------ ② 出生点巡视（, / . 键 · 画布右侧按钮 · 命令面板）
 * 检查一张 10～50 人的地图时，要一个个点出生点、缩放、看周边，再去体检里对照数据。巡视模式下按「.」飞到下一个、
 * 「,」回到上一个：相机以跃迁动画飞过去并放大到合适的观察尺度，顶部弹出「玩家卡片」，显示该玩家的队伍、领地占比、
 * 领地内资源、最近资源距离与接敌距离（与体检同一份数据），明显偏离的项会标黄提醒。卡片上也有 ‹ › 按钮。 */
const tour = { on: false };
function tourSpawn(dir = 1) {
  const sp = currentSpawns();
  if (!S.snapshot || !sp.length) { toast(S.snapshot ? '当前地图没有出生点' : '请先生成或导入地图', 'warn'); return; }
  const cur = S.selectedSpawn;
  const i = cur < 0 || cur >= sp.length ? (dir > 0 ? 0 : sp.length - 1) : (cur + dir + sp.length) % sp.length;
  tour.on = true;
  $('tourBtn')?.classList.add('touring'); $('mapPanel')?.classList.add('touring');
  selectSpawn(i, 'tour');
}
function closeSpawnCard() {
  $('tourBtn')?.classList.remove('touring'); $('mapPanel')?.classList.remove('touring');
  const el = $('spawnCard'); if (!el || el.hidden) { tour.on = false; return false; }
  tour.on = false;
  el.classList.remove('show'); clearTimeout(el._t);
  el._t = setTimeout(() => { if (!tour.on) el.hidden = true; }, 220);
  return true;
}
/** 每位玩家的对比数据（体检卡片与巡视卡片共用） */
function playerRows(a) {
  if (!a || a.n < 1) return [];
  const owned = Math.max(1, a.terr.owned), n = a.n;
  const near = a.res.nearest.filter(Number.isFinite).sort((x, y) => x - y), nearMed = near[Math.floor(near.length / 2)] || 0;
  const minDim = Math.min(a.rows, a.cols);
  return Array.from({ length: n }, (_, i) => {
    const rush = a.rush?.list?.[i]?.d, terr = a.terr.counts[i] / owned, nr = a.res.nearest[i];
    return {
      i, team: a.teams[i], terr, res: a.res.perSpawn[i] || 0, near: nr, rush: Number.isFinite(rush) ? rush : null,
      flags: {
        terr: n >= 2 && a.terr.owned > 0 && terr < 0.75 / n, // 与体检结论同一口径：低于平均值的 75% 即提示
        near: n >= 3 && Number.isFinite(nr) && nr > Math.max(nearMed * 2, minDim * 0.22),
        rush: !!a.rush?.front?.includes(i),
        stuck: !!a.conn?.stuck?.includes(i)
      }
    };
  });
}
const fmtCells = v => v == null || !Number.isFinite(v) ? '—' : `${Math.round(v)} 格`;
function playerReportLines(a) {
  const rows = playerRows(a); if (rows.length < 2) return [];
  return ['', '玩家对比：', ...rows.map(r => `  玩家 ${String(r.i + 1).padStart(2)}（${teamLabel(r.team)}）领地 ${pct(r.terr)} · 领地内资源 ${r.res} · 最近资源 ${fmtCells(r.near)} · 接敌 ${fmtCells(r.rush)}${Object.values(r.flags).some(Boolean) ? '  ⚠' : ''}`)];
}
function playersHtml(a) {
  const rows = playerRows(a); if (rows.length < 2) return '';
  const maxT = Math.max(...rows.map(r => r.terr), 1e-6), maxR = Math.max(...rows.map(r => r.res), 1), maxN = Math.max(...rows.map(r => Number.isFinite(r.near) ? r.near : 0), 1), maxK = Math.max(...rows.map(r => r.rush || 0), 1);
  const bar = (v, max, flag, txt) => `<span class="pc${flag ? ' flag' : ''}"><i style="--w:${Math.max(4, Math.round((v || 0) / max * 100))}%"></i><em>${txt}</em></span>`;
  const body = rows.map((r, k) => `<button type="button" class="pr team-${r.team}" data-spawn="${r.i}" style="--d:${Math.min(k, 24) * 28}ms" title="点击飞到玩家 ${r.i + 1}">
      <span class="pn"${r.team[0] === 'P' ? ` style="--tc:${teamColor(r.team)}"` : ''}><b>${r.i + 1}</b><small>${r.team[0] === 'P' ? 'FFA' : r.team}</small></span>
      ${bar(r.terr, maxT, r.flags.terr || r.flags.stuck, pct(r.terr))}${bar(r.res, maxR, false, String(r.res))}${bar(Number.isFinite(r.near) ? r.near : 0, maxN, r.flags.near, fmtCells(r.near))}${bar(r.rush || 0, maxK, r.flags.rush, fmtCells(r.rush))}
    </button>`).join('');
  const flagged = rows.filter(r => Object.values(r.flags).some(Boolean)).length;
  return `<details class="doc-players"${rows.length <= 12 ? ' open' : ''}><summary><b>玩家对比</b><small>${rows.length} 位玩家${flagged ? ` · <em>${flagged} 位有偏差</em>` : ' · 无明显偏差'} · 点击一行飞到该玩家</small></summary>
    <div class="pt"><div class="ph"><span>玩家</span><span>领地</span><span>领地资源</span><span>最近资源</span><span>接敌</span></div>${body}</div></details>`;
}
function renderSpawnCard(i) {
  const el = $('spawnCard'); if (!el) return;
  const sp = currentSpawns(), q = sp[i];
  if (!tour.on || !q) { closeSpawnCard(); return; }
  let a = null; try { a = analyzeMap(); } catch (e) { console.warn('巡视卡片体检失败', e); }
  const r = a ? playerRows(a)[i] : null, team = r?.team || teamOf(q, i);
  const stat = (lab, v, flag, tip) => `<span class="sc-stat${flag ? ' flag' : ''}"${tip ? ` title="${tip}"` : ''}><b>${v}</b><small>${lab}</small></span>`;
  el.dataset.team = team[0] === 'P' ? 'P' : team;
  el.style.setProperty('--tc', teamColor(team));
  el.innerHTML = `<button type="button" class="sc-nav" data-dir="-1" aria-label="上一个出生点（,）"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg></button>
    <div class="sc-main"><div class="sc-head"><span class="sc-dot"></span><b>玩家 ${i + 1}</b><small>/ ${sp.length} · ${team[0] === 'P' ? '自由混战' : team + ' 队'} · (${q[0] + 1}, ${q[1] + 1})</small></div>
    <div class="sc-stats">${r ? stat('领地', pct(r.terr), r.flags.terr, '按行走距离划分的地盘占比') + stat('领地资源', r.res, false, '归属该玩家的资源点数量') + stat('最近资源', fmtCells(r.near), r.flags.near, '到最近资源点的直线距离') + stat('接敌', fmtCells(r.rush), r.flags.rush, '走到最近敌人的距离') : '<span class="sc-stat"><small>体检数据不可用</small></span>'}</div></div>
    <button type="button" class="sc-nav" data-dir="1" aria-label="下一个出生点（.）"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg></button>
    <button type="button" class="sc-close" aria-label="关闭玩家卡片">✕</button>`;
  el.querySelectorAll('.sc-nav').forEach(b => { b.onclick = () => tourSpawn(Number(b.dataset.dir)); });
  el.querySelector('.sc-close').onclick = () => { closeSpawnCard(); selectSpawn(-1); };
  if (el.hidden) { el.hidden = false; requestAnimationFrame(() => el.classList.add('show')); }
  else { el.classList.remove('swap'); void el.offsetWidth; el.classList.add('swap'); }
  clearTimeout(el._t);
}

/* ------------------------------------------------------------------ ③ 按钮涟漪反馈
 * 主按钮 / 悬浮按钮 / 图层开关 / 画布工具按下时，从手指位置扩散一圈涟漪，触屏上能明确感到「按到了」。
 * 涟漪画在按钮内一个独立的裁剪层里（不改变按钮自身的 overflow，避免裁掉按钮上的角标 / 光晕），系统减少动态效果时不显示。 */
const RIPPLE_SEL = 'button.primary,button.primary-soft,.tune-btn,.fab,.chip,.tool-palette button,.map-controls button,.mode-tabs button,.sc-nav';
function bindRipples() {
  document.addEventListener('pointerdown', e => {
    if (e.button > 0 || reduceMotion()) return;
    const b = e.target.closest?.(RIPPLE_SEL); if (!b || b.disabled) return;
    if (getComputedStyle(b).position === 'static') b.style.position = 'relative';
    let box = b.querySelector(':scope > .ripple-box');
    if (!box) { box = document.createElement('span'); box.className = 'ripple-box'; box.setAttribute('aria-hidden', 'true'); b.appendChild(box); }
    const r = b.getBoundingClientRect(), d = Math.hypot(r.width, r.height) * 2;
    const dot = document.createElement('i');
    dot.style.cssText = `width:${d}px;height:${d}px;left:${e.clientX - r.left - d / 2}px;top:${e.clientY - r.top - d / 2}px`;
    box.appendChild(dot);
    dot.addEventListener('animationend', () => dot.remove(), { once: true });
    setTimeout(() => dot.remove(), 900);
  }, { passive: true });
  // 图层开关切换时的「弹跳」反馈
  document.addEventListener('click', e => {
    const c = e.target.closest?.('.layer-row .chip'); if (!c || reduceMotion()) return;
    c.classList.remove('toggled'); void c.offsetWidth; c.classList.add('toggled');
  });
}

/* ================================================================== 3.20.0 新功能 */

/* ------------------------------------------------------------------ ① 公平度一键微调（O · 公平度卡片「一键微调」· 命令面板）
 * 「智能重新布置」是推倒重来；而手工摆好的布局往往只差一点：某两个点挨得近、某个点贴边。微调在当前布局附近做局部搜索：
 *   · 把出生点按「谁是谁的镜像」分组（复用近家资源的 groupSpawnOrbits）：每组只移动第一个点，其余成员按各自的翻转方式
 *     （水平 / 垂直 / 双轴 / 两条对角线）同步移动，所以对称地图微调后仍然严格对称；落单的点独立移动；
 *   · 爬山法：每轮对每组尝试若干个随机偏移（半径从地图短边的 8% 逐轮收缩到 2 格），只接受让公平度（未取整的 raw 值，
 *     两队 / FFA 各用自己的口径）变高的移动；
 *   · 硬约束：新位置必须通过 spawnCellValid（陆地、墙线 / 悬崖 / 物品距离），与其他出生点保持最小间距，
 *     且「近家资源」范围内的资源点数量不少于移动前（不破坏 3.9.0 的近家资源保证）；
 *   · 出生点编号不变（只改坐标），整个操作是一步，可撤销；移动过程用 520ms 补间动画展示。 */
let spawnTween = null;
function spawnTweenPositions(p) {
  const t = spawnTween; if (!t) return null;
  const k = (performance.now() - t.t0) / t.dur;
  if (k >= 1 || t.from.length !== p.length) { spawnTween = null; return null; }
  const e = 1 - Math.pow(1 - k, 3);
  return p.map((q, i) => [t.from[i][0] + (q[0] - t.from[i][0]) * e, t.from[i][1] + (q[1] - t.from[i][1]) * e]);
}
function startSpawnTween(from) { if (!reduceMotion()) { spawnTween = { from: from.map(p => [...p]), t0: performance.now(), dur: 520 }; scheduleRender(); } }
function nearResCount(p, res) {
  const { min, max } = S.nearRes || NEAR_RES_DEFAULTS;
  let n = 0; for (const q of res) { const d = dist2(p, q); if (d >= min - 0.5 && d <= max + 0.5) n++; }
  return n;
}
/** 按地图自身的对称模式把出生点分成镜像组（容差 2.5 格）。每组 [{ idx, flip }]，flip 为相对首个成员的翻转方式（RESOURCE_FLIPS 的键）。
 * 不用 groupSpawnOrbits 的原因：它要求坐标严格相等，手工拖动 / 取整造成的 1 格偏差会让镜像组散开，微调后对称被破坏。
 * 这里容差配对，而移动时按翻转公式精确计算成员位置——微调后的布局反而是「严格」对称的。 */
const MODE_FLIPS = { horizontal: ['h', 'v'], vertical: ['h', 'v'], both: ['h', 'v', 'b'], diagonal1: ['d1'], diagonal2: ['d2'] };
function mirrorGroups(list, rows, cols) {
  const mode = effectiveSpawnMode(S.snapshot?.meta?.mirroring || $('mirror').value);
  const keys = MODE_FLIPS[mode] || [], used = new Array(list.length).fill(false), groups = [];
  // 只保留该模式真正对应的翻转：用「把首点翻过去后是否等于 mirrorPoint 给出的镜像」来确认，避免 h / v 命名约定不一致
  const imgs0 = p => mirrorPoint(p, mode, rows, cols).map(keyOf);
  for (let i = 0; i < list.length; i++) {
    if (used[i]) continue;
    used[i] = true;
    const g = [{ idx: i, flip: null }], want = new Set(imgs0(list[i]));
    for (const k of keys) {
      const q = RESOURCE_FLIPS[k](list[i][0], list[i][1], rows, cols);
      if (!want.has(keyOf(q)) || (q[0] === list[i][0] && q[1] === list[i][1])) continue;
      let bj = -1, bd = 2.5;
      for (let j = 0; j < list.length; j++) if (!used[j]) { const d = dist2(list[j], q); if (d <= bd) { bd = d; bj = j; } }
      if (bj >= 0) { used[bj] = true; g.push({ idx: bj, flip: k }); }
    }
    groups.push(g);
  }
  return groups;
}
/* 搜索半径：起始为短边的 25%，某一轮有成功的移动就保持半径（还在「赶路」），没有才收缩 ×0.72。
 * 实测（6 张挤压过的 220×220 XY 对称 FFA 地图，各取 4 次中最好）：起始 15% 且每轮收缩时 81/84/68/74/88/76；
 * 现方案 81/95/97/95/94/76。15% 的方案在第 3 张图上一步都走不动——中心周围 15% 半径内全是水域，所有候选都不合法。 */
function optimizeSpawnLayout(start, { rounds = 10, tries = 14, seed = 1, r0 = 0.25, adaptive = true } = {}) {
  const s = S.snapshot, [rows, cols] = dimsOf(s), minDim = Math.min(rows, cols);
  const groups = mirrorGroups(start, rows, cols), rng = seededRng(seed);
  // 评估次数预算 2400：≤30 人时每轮每组 14 次不受影响；100 人时自动降到每组约 4～5 次，单次耗时约 1 秒（未设预算时约 3.4 秒，界面卡顿）
  tries = clamp(Math.floor(2400 / Math.max(1, groups.length * rounds)), 4, tries);
  const res = s.resource_positions || [], guardNear = !!(S.nearRes?.enabled && res.length);
  const sep = Math.max(4, minDim * 0.03), target = Math.max(4, Math.sqrt(rows * cols / start.length) * 0.62);
  // 目标函数 = 公平度（未取整）+ 「每个人到最近邻居的间距」的平滑项。只看公平度时，分数由最近的那一对决定，
  // 移动其他点不改变分数，爬山会卡在平台上；平滑项让「把所有人都拉开一点」也算进步。最终是否采用仍以公平度本身为准。
  const obj = list => {
    const f = spawnFairness(list, s).raw ?? 0;
    let soft = 0;
    for (let i = 0; i < list.length; i++) { let d = Infinity; for (let j = 0; j < list.length; j++) if (j !== i) d = Math.min(d, dist2(list[i], list[j])); soft += Math.min(1, d / target); }
    return f + 6 * soft / list.length;
  };
  let cur = start.map(p => [...p]), best = obj(cur), radius = Math.max(3, Math.round(minDim * r0));
  const movedIdx = new Set();
  let improved = false;
  for (let round = 0; round < rounds; round++) {
    for (const g of groups) {
      const rep = cur[g[0].idx];
      for (let k = 0; k < tries; k++) {
        const a = rng() * Math.PI * 2, d = radius * (0.25 + 0.75 * rng());
        const q = [Math.round(rep[0] + Math.sin(a) * d), Math.round(rep[1] + Math.cos(a) * d)];
        const pts = g.map(m => m.flip ? RESOURCE_FLIPS[m.flip](q[0], q[1], rows, cols) : q);
        if (!pts.every(p => spawnCellValid(s, p[0], p[1]))) continue;
        const cand = cur.slice();
        g.forEach((m, j) => { cand[m.idx] = pts[j]; });
        let ok = true;
        for (const m of g) { for (let i = 0; i < cand.length && ok; i++) if (i !== m.idx && dist2(cand[i], cand[m.idx]) < sep) ok = false; if (!ok) break; }
        if (!ok) continue;
        if (guardNear) for (const m of g) { const need = Math.min(S.nearRes.perSpawn, nearResCount(start[m.idx], res)); if (nearResCount(cand[m.idx], res) < need) { ok = false; break; } }
        if (!ok) continue;
        const v = obj(cand);
        if (v > best + 1e-6) { best = v; cur = cand; g.forEach(m => movedIdx.add(m.idx)); improved = true; }
      }
    }
    if (!adaptive || !improved) radius = Math.max(2, Math.round(radius * 0.72));
    improved = false;
  }
  return { list: cur, raw: spawnFairness(cur, s).raw, moves: movedIdx.size, groups: groups.length };
}
async function tuneFairness() {
  if (!S.snapshot) { toast('请先生成或导入地图', 'warn'); return; }
  const start = currentSpawns();
  if (start.length < 2) { toast('至少需要 2 个出生点', 'warn'); return; }
  if (!guard()) return;
  const f0 = spawnFairness(start);
  busy(true, '正在微调出生点位置…', '', null, { cancellable: false });
  await sleep(30); // 让忙碌提示先画出来
  // 多起点：爬山结果对随机种子很敏感（实测同一布局单次 75～93 不等），取多次中最好的一次。
  // 起点数按人数自适应：≤30 人 4 次（每次约 10～40ms），≤60 人 2 次，100 人 1 次（约 0.7 秒）。
  const starts = start.length <= 30 ? 4 : start.length <= 60 ? 2 : 1, seed0 = hashSeed(start.length, Date.now() & 0xffff, f0.score);
  let r = null;
  try {
    for (let k = 0; k < starts; k++) {
      const x = optimizeSpawnLayout(start, { seed: seed0 + k * 7919 });
      if (!r || x.raw > r.raw) r = x;
      await sleep(0); // 每次之间让出主线程，忙碌提示保持流畅
    }
  } finally { busy(false); }
  const f1 = spawnFairness(r.list);
  if (!r.moves || f1.raw <= f0.raw + 0.05) { toast(`当前布局已接近最优（公平度 ${f0.score}），没有找到更好的位置`, 'info', 3600); return; }
  pushSpawnHistory();
  startSpawnTween(start);
  setSpawns(r.list);
  afterSpawnChange();
  pulseGauge();
  toast(`公平度 ${f0.score} → ${f1.score}：微调了 ${r.moves} 个出生点（对称关系与近家资源保持不变）`, 'success', 5200, spawnUndoAction());
}
function pulseGauge() { const g = $('fairnessGauge') || $('gaugeArc')?.closest('svg'); if (!g || reduceMotion()) return; g.classList.remove('gauge-pop'); void g.getBoundingClientRect(); g.classList.add('gauge-pop'); }

/* ------------------------------------------------------------------ ② 落点热力图层（K）
 * 手动加出生点时，最难的是判断「哪里离所有人都远、又是合法地形」。本图层在 ≤160×160 的采样网格上，对每个合法格计算
 * 「它（连同对称模式下的镜像点）到最近已有出生点的距离」，按目标间距归一后上色（冷色 = 太挤，暖色 = 宽敞），
 * 非法地形不着色；得分最高处画一个呼吸的准星，并给出「在此放置」按钮（按当前对称设置自动补镜像）。 */
let spotCache = null;
function analyzeSpots(s = S.snapshot) {
  if (!s) return null;
  const sig = analysisSig(s) + '|' + $('mirror').value + '|' + $('symmetryStrength').value;
  if (spotCache?.sig === sig) return spotCache.r;
  const [rows, cols] = dimsOf(s), sp = currentSpawns(), mode = effectiveSpawnMode(s.meta?.mirroring || $('mirror').value);
  const scale = Math.max(1, Math.ceil(Math.max(rows, cols) / 160)), W = Math.ceil(cols / scale), H = Math.ceil(rows / scale);
  const n = Math.max(1, sp.length + 1), target = Math.max(4, Math.sqrt(rows * cols / n) * 0.7);
  const val = new Float32Array(W * H).fill(-1);
  let best = -1, bestCell = null;
  for (let by = 0; by < H; by++) for (let bx = 0; bx < W; bx++) {
    const r = Math.min(rows - 1, by * scale + (scale >> 1)), c = Math.min(cols - 1, bx * scale + (scale >> 1));
    if (!spawnCellValid(s, r, c)) continue;
    const pts = [[r, c], ...mirrorPoint([r, c], mode, rows, cols)];
    if (pts.length > 1 && !pts.every(p => spawnCellValid(s, p[0], p[1]))) continue;
    let d = Infinity;
    for (const p of pts) for (const q of sp) d = Math.min(d, dist2(p, q));
    for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) d = Math.min(d, dist2(pts[i], pts[j]));
    if (!Number.isFinite(d)) d = Math.min(r, c, rows - 1 - r, cols - 1 - c) * 2; // 一个出生点都没有时：偏好远离边缘
    const edge = Math.min(r, c, rows - 1 - r, cols - 1 - c) / Math.max(1, Math.min(rows, cols) * 0.14);
    const ef = 0.6 + 0.4 * clamp(edge, 0, 1);
    val[by * W + bx] = clamp(d / target, 0, 1.4) * ef; // 着色用（超过 1.4 倍目标间距都算「很宽敞」）
    const rank = (d / target) * ef;                   // 选最佳落点用未截断的值：截断会让大片格子并列，扫描顺序决定结果（偏向左上角）
    if (rank > best) { best = rank; bestCell = [r, c]; }
  }
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d'), img = ctx.createImageData(W, H), d = img.data;
  const ramp = t => t < 0.5 ? [40 + 60 * t, 110 + 240 * t, 255 - 120 * t] : [100 + 310 * (t - 0.5), 230 - 30 * (t - 0.5), 195 - 330 * (t - 0.5)];
  for (let k = 0; k < val.length; k++) {
    if (val[k] < 0) continue;
    const t = clamp(val[k] / 1.2, 0, 1), [r, g, b] = ramp(t);
    d[k * 4] = r; d[k * 4 + 1] = g; d[k * 4 + 2] = Math.max(0, b); d[k * 4 + 3] = 60 + 120 * t;
  }
  ctx.putImageData(img, 0, 0);
  const r = { canvas: cv, scale, best: bestCell, score: best, mode };
  spotCache = { sig, r };
  return r;
}
function setSpotLayer(on, { quiet = false } = {}) {
  S.layers.spots = !!on;
  $('layerSpots')?.classList.toggle('active', S.layers.spots);
  syncLayerAria('layerSpots');
  $('mapPanel')?.classList.toggle('spots-on', S.layers.spots);
  if (on && S.snapshot && !quiet) {
    let r = null; try { r = analyzeSpots(); } catch (e) { console.warn('落点分析失败', e); }
    if (!r?.best) toast('当前地形上已没有可放置出生点的合法位置', 'warn');
    else toast(`暖色 = 宽敞、冷色 = 拥挤；准星是当前最佳落点（${r.best[0] + 1}, ${r.best[1] + 1}）`, 'info', 5200,
      { action: { label: '在此放置', fn: () => { const b = analyzeSpots()?.best; if (b) placeSpawnAt({ row: b[0], col: b[1] }); } } });
  }
  scheduleRender();
}
function drawSpots(ctx, rows, cols, now, fadeK) {
  if (!S.layers.spots || !S.snapshot) return false;
  let r = null; try { r = analyzeSpots(); } catch { return false; }
  if (!r) return false;
  const z = S.view.zoom;
  ctx.save(); ctx.globalAlpha = 0.85 * fadeK; ctx.imageSmoothingEnabled = true;
  ctx.drawImage(r.canvas, S.view.x, S.view.y, r.canvas.width * r.scale * z, r.canvas.height * r.scale * z);
  ctx.restore();
  if (!r.best) return false;
  const [x, y] = toScreen(r.best[0], r.best[1]), still = reduceMotion();
  const ph = still ? 0.5 : (now % 1400) / 1400, R = Math.max(10, spawnRadius() + 6);
  ctx.save();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 6;
  ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); ctx.stroke();
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { ctx.beginPath(); ctx.moveTo(x + dx * (R - 4), y + dy * (R - 4)); ctx.lineTo(x + dx * (R + 6), y + dy * (R + 6)); ctx.stroke(); }
  ctx.globalAlpha = 1 - ph; ctx.lineWidth = 2.5; ctx.strokeStyle = '#ffd45c';
  ctx.beginPath(); ctx.arc(x, y, R + ph * 16, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
  return !still;
}

/* ------------------------------------------------------------------ ③ 对称修复：补齐出生点镜像
 * 对称检查标出「没有镜像对应点」的出生点后，可以一键在镜像位置补上缺失的出生点（位置必须合法、与已有出生点保持间距，
 * 不超过 100 个上限），再按当前规则整理槽位。地形差异需要重新生成，这里不改地形。 */
function repairSpawnSymmetry() {
  if (!S.snapshot || !guard()) return;
  const sy = analyzeSymmetry();
  if (!sy?.mode) { toast('当前地图不是对称地图', 'info'); return; }
  if (!sy.spawnsOff.length) { toast('出生点已全部对称，无需修复', 'success'); return; }
  const [rows, cols] = dims(), list = currentSpawns(), sep = Math.max(4, Math.min(rows, cols) * 0.03);
  let added = 0, skipped = 0;
  for (const i of sy.spawnsOff) {
    for (const q of mirrorPoint(list[i], sy.mode, rows, cols)) {
      if (list.some(o => Math.hypot(o[0] - q[0], o[1] - q[1]) <= SYM_TOL)) continue;
      if (list.length >= MAX_SPAWN_POINTS || !spawnCellValid(S.snapshot, q[0], q[1]) || list.some(o => dist2(o, q) < sep)) { skipped++; continue; }
      list.push([q[0], q[1]]); added++;
    }
  }
  if (!added) { toast(`镜像位置都无法放置（地形不合法或太挤），共 ${skipped} 处`, 'warn', 4200); return; }
  pushSpawnHistory();
  const next = normalizeSlots(list);
  next.forEach(p => { if (!currentSpawns().some(o => keyOf(o) === keyOf(p))) spawnPop.set(keyOf(p), performance.now()); });
  setSpawns(next); afterSpawnChange();
  $('players').value = next.length;
  toast(`已补齐 ${added} 个镜像出生点${skipped ? `，${skipped} 处位置不合法未补` : ''}（现共 ${next.length} 个）`, 'success', 4800, spawnUndoAction());
}

/* ------------------------------------------------------------------ 控件绑定 */
function bindControls() {
  $('versionBadge').textContent = 'v' + APP_VERSION + (window.DesktopBridge ? ' · PC' : '');
  bindShapeControls();
  bindCmdk(); // 3.15.0
  // 3.17.0：配方码 / 实时体检徽章 / 专注模式 / 视图截图
  $('recipeCopy').onclick = () => copyRecipe();
  $('recipePaste').onclick = () => pasteRecipe();
  $('healthBadge').onclick = () => showMapDoctor();
  $('focusBtn').onclick = () => setFocusMode(!focusOn());
  $('focusExit').onclick = () => setFocusMode(false);
  $('shotBtn').onclick = () => saveViewShot();
  // 在画布区（非输入框）直接 Ctrl+V 粘贴含配方码的文字 → 打开「使用配方码」并预填
  document.addEventListener('paste', e => {
    if (e.target.closest?.('input,textarea,select,[contenteditable="true"]') || modalOpen() || cmdk.open) return;
    const t = e.clipboardData?.getData('text') || '';
    if (RECIPE_RE.test(t)) { e.preventDefault(); pasteRecipe(t); }
  });
  $('nameDice')?.addEventListener('click', () => rollMapName());
  // 3.15.0：引擎停用 / 初始化失败时，点击顶栏红色状态胶囊即可手动重启
  $('runtimePill').addEventListener('click', () => { if ($('runtimePill').dataset.level === 'err') Engine.manualRestart(); });
  $('runtimePill').addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && $('runtimePill').dataset.level === 'err') { e.preventDefault(); Engine.manualRestart(); } });
  $('menuBtn').onclick = () => $('sidebar').classList.contains('open') ? closeDrawer() : openDrawer();
  $('drawerBackdrop').onclick = closeDrawer;
  $('drawerClose')?.addEventListener('click', closeDrawer);
  $('measureBtn')?.addEventListener('click', () => { if (!S.snapshot) { toast('请先生成或导入地图', 'warn'); return; } setMeasure(!measure.on); });
  $('densityHint')?.addEventListener('click', e => {
    const b = e.target.closest('.dh-apply'); if (!b) return;
    $('width').value = b.dataset.w; $('height').value = b.dataset.h;
    flashInput('width'); flashInput('height'); updateMirrorHint(); queuePrefs(); queueShapePreview();
    toast(`已套用推荐尺寸 ${b.dataset.w}×${b.dataset.h}`, 'success', 2200);
  });
  // 修复：旧实现抽屉内任何按钮（包括海岸线方格、图层开关）点击后都会收起抽屉
  $('sidebar').addEventListener('click', e => {
    if (!isNarrow()) return;
    if (e.target.closest('#generate,[data-act],#spawnAuto,#ccRandom,#resRandom,#fitMap,#imageImport,#tmxImport,#export,#exportZip,#pngPreview')) setTimeout(closeDrawer, 160);
  });
  // 3.6.0 修复：旧实现只在 pointerup 时移除 pointermove 监听，触屏手势被系统打断（pointercancel）或指针捕获丢失后，
  // 监听器永久残留，之后鼠标仅仅悬停在小地图上视图也会跟着乱跳；且 setPointerCapture 抛异常会让整个处理函数中断。
  $('minimap').addEventListener('pointerdown', e => {
    if (!S.snapshot) return;
    const mm = $('minimap'), pid = e.pointerId;
    try { mm.setPointerCapture(pid); } catch { /* 指针已结束 / 合成事件 */ }
    minimapNavigate(e);
    const mv = ev => { if (ev.pointerId === pid) minimapNavigate(ev); };
    const end = ev => {
      if (ev && ev.pointerId !== undefined && ev.pointerId !== pid) return;
      for (const t of ['pointermove', 'pointerup', 'pointercancel', 'lostpointercapture']) mm.removeEventListener(t, t === 'pointermove' ? mv : end);
    };
    mm.addEventListener('pointermove', mv);
    for (const t of ['pointerup', 'pointercancel', 'lostpointercapture']) mm.addEventListener(t, end);
  });
  ['width', 'height', 'heightLevels', 'oceanLevels', 'players', 'resources', 'tileset', 'mirror', 'symmetryStrength', 'slotOrder', 'mapName'].forEach(id => {
    const el = $(id);
    const fn = () => { queuePrefs(); if (['players', 'mirror', 'width', 'height', 'symmetryStrength'].includes(id)) updateMirrorHint(); if (id === 'players') syncPresetFromPlayers(); };
    el.addEventListener('change', fn); el.addEventListener('input', fn);
  });
  // 3.14.0：除失焦外，「回车 / 确认」（change）时也立刻约束，生成前再统一约束一次（见 normalizeParamInputs）
  PARAM_LIMITS.forEach(([id, mn, mx, dft]) => {
    const fix = () => { clampInput(id, mn, mx, dft); updateMirrorHint(); updateDensityHint(); };
    $(id).addEventListener('blur', fix); $(id).addEventListener('change', fix);
  });
  document.querySelectorAll('[data-size]').forEach(b => b.onclick = () => { $('width').value = b.dataset.size; $('height').value = b.dataset.size; flashInput('width'); flashInput('height'); updateMirrorHint(); queuePrefs(); queueShapePreview(); });
  $('gridRandom').onclick = randomGrid;
  $('gridInvert').onclick = () => { renderGrid(getGrid().map(r => r.map(v => v ? 0 : 1))); queuePrefs(); };
  $('gridDefault').onclick = () => { renderGrid(); queuePrefs(); };

  $('generate').onclick = () => generate();
  $('bestOf').onclick = () => generateBestOf();
  $('surprise').onclick = () => { $('surprise').classList.remove('spin'); void $('surprise').offsetWidth; $('surprise').classList.add('spin'); surpriseGenerate(); };
  $('exportZipQuick').onclick = () => exportZipFn();
  $('saveAsBtn').onclick = () => showSaveAs();
  $('exportLocChange').onclick = () => pickExportFolder();
  $('exportLocReset').onclick = () => { ExportLoc.setPref('downloads'); toast('导出位置已恢复为下载目录'); };
  ExportLoc.load();
  $('posterBtn').onclick = () => showPoster();
  $('layerRoutes').onclick = () => setRoutesLayer(!S.layers.routes);
  updateBestLabel();
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
    if (m === 'brush' && S.importedDepth && !(await confirmReplaceImportedDepth('切换到画笔模式'))) return;
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
  $('mapDoctor').onclick = () => showMapDoctor();
  $('projectPrev').onclick = () => restorePrevious();
  $('cmpBtn').onclick = () => showCompare();           // 3.26.0
  $('shapeGallery').onclick = () => showSeedGallery(); // 3.26.0
  $('shapeOverview').onclick = () => showShapeOverview(); // 3.27.0
  $('userPreset').onchange = () => { const v = $('userPreset').value; $('presetDel').disabled = !v; if (v) applyUserPreset(v); };
  $('presetSave').onclick = () => saveUserPreset();
  $('presetDel').onclick = () => deleteUserPreset();
  $('spawnAuto').onclick = async () => {
    if (!guard()) return;
    if (!S.snapshot) { toast('请先生成地图', 'warn'); return; }
    const n = intOf('players', 0, MAX_SPAWN_POINTS, 10);
    if (n < 1) { toast('「出生点数量」为 0，请先在参数中设置出生点数量', 'warn'); return; }
    try {
      const got = await smartPlaceAll(n, { quiet: true, allowPartial: true });
      toast(`已智能布置 ${got.length} 个出生点 · 公平度 ${spawnFairness().score}`, 'success', 4000, spawnUndoAction());
    } catch (e) { toast('智能重新布置失败：' + e.message, 'error', 4200); }
  };
  $('spawnReorder').onclick = () => {
    if (!guard()) return;
    const p = currentSpawns(); if (p.length < 2) { toast('出生点不足'); return; }
    const mode = $('slotOrder').value === 'engine' ? 'alternate' : $('slotOrder').value;
    const next = orderBySlot(p, mode, { fresh: true });
    if (next.every((q, i) => keyOf(q) === keyOf(p[i]))) { toast('槽位顺序已符合当前规则，无需重排'); return; }
    pushSpawnHistory(); setSpawns(next); S.selectedSpawn = -1; afterSpawnChange();
    toast(mode === 'grouped' ? '已按「A 队在前」重排玩家槽位' : '已按「A/B 交替 + 镜像对位」重排玩家槽位', 'success', 3600, spawnUndoAction());
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
  $('nearResFill').onclick = () => fillNearSpawnResourcesManual();
  $('nearResToggle').onclick = () => {
    S.nearRes.enabled = !S.nearRes.enabled;
    $('nearResToggle').classList.toggle('on', S.nearRes.enabled);
    $('nearResToggle').setAttribute('aria-checked', String(S.nearRes.enabled));
    $('nearResFields').classList.toggle('dim', !S.nearRes.enabled);
    toast(S.nearRes.enabled ? '已开启：生成地图时自动补齐近家资源点' : '已关闭：生成地图不再自动补齐近家资源点（可用「补齐近家资源」手动触发）');
    queuePrefs();
  };
  $('nearResCount').onchange = () => { S.nearRes.perSpawn = clamp(Number($('nearResCount').value) || 2, 2, 4); queuePrefs(); };
  const syncNearResRange = () => {
    let mn = clamp(Math.round(Number($('nearResMin').value)) || 10, 4, 120), mx = clamp(Math.round(Number($('nearResMax').value)) || 20, 4, 160);
    if (mx < mn) mx = mn;
    S.nearRes.min = mn; S.nearRes.max = mx; $('nearResMin').value = mn; $('nearResMax').value = mx; queuePrefs();
  };
  $('nearResMin').onchange = syncNearResRange; $('nearResMax').onchange = syncNearResRange;
  const layerBtn = (name, id) => $(id).onclick = () => { S.layers[name] = !S.layers[name]; $(id).classList.toggle('active', S.layers[name]); syncLayerAria(id); scheduleRender(); };
  layerBtn('terrain', 'layerTerrain'); layerBtn('spawns', 'layerSpawns'); layerBtn('resources', 'layerResources'); layerBtn('walls', 'layerWalls'); layerBtn('grid', 'layerGrid'); layerBtn('nearRes', 'layerNearRes');
  $('layerTerritory').onclick = () => setTerritoryLayer(!S.layers.territory);
  $('layerSymmetry').onclick = () => setSymmetryLayer(!S.layers.symmetry); // 3.19.0
  $('layerSpots').onclick = () => setSpotLayer(!S.layers.spots);             // 3.20.0
  $('spawnTune').onclick = () => tuneFairness();                              // 3.20.0
  $('tourBtn').onclick = e => tourSpawn(e.shiftKey ? -1 : 1);                // 3.19.0：Shift+点击 = 上一个
  bindRipples(); // 3.19.0
  $('projectNew').onclick = () => newProject();
  $('projectSave').onclick = () => saveProject(false);
  $('projectLoad').onclick = () => loadProject();
  $('projectExport').onclick = () => exportProject();
  $('histSave').onclick = async () => { if (!guard()) return; const e = await pushHistorySnapshot('手动保存'); if (e) toast('已把当前地图保存到历史快照', 'success'); else if (!S.snapshot && !S.lastTmx) toast('保存快照失败：当前还没有地图', 'warn'); };
  $('histOpen').onclick = () => showHistory();
  $('tmxImport').onclick = () => $('tmxFile').click();
  $('tmxFile').onchange = e => importFile(e.target.files?.[0]);
  $('undoGlobal').onclick = () => globalUndo();
  $('redoGlobal').onclick = () => globalRedo();
  $('autoSaveToggle').onclick = () => {
    S.autoSave = !S.autoSave;
    $('autoSaveToggle').textContent = `自动保存：${S.autoSave ? '开' : '关'}`;
    $('autoSaveToggle').classList.toggle('active', S.autoSave);
    if (S.autoSave) saveProject(true);
    else { clearTimeout(autoSaveTimer); autoSaveTimer = null; }
    queuePrefs();
  };
  $('animToggle').onclick = () => { S.animate = !S.animate; $('animToggle').classList.toggle('on', S.animate); $('animToggle').setAttribute('aria-checked', String(S.animate)); queuePrefs(); };
  $('themeToggle').onclick = e => { e.stopPropagation(); themeMenuOpen() ? closeThemeMenu() : openThemeMenu(); };
  document.addEventListener('pointerdown', e => { if (!e.target.closest?.('.theme-wrap')) closeThemeMenu(); }, true);
  $('helpBtn').onclick = showHelp;
  // 3.8.0：取消时只结束真正在工作的线程 —— 旧逻辑无条件重启引擎，形态计算阶段（引擎空闲）取消也会让当前地图的分步编辑失效
  $('busyCancel').onclick = () => { if (!S.locked) return; const shapeBusy = ShapeWorker.pending.size > 0; ShapeWorker.reset(); if (Engine.pending.size || !shapeBusy) Engine.restart('cancel'); };
  $('busySkip').onclick = () => stopAnimation();
  $('modal').addEventListener('click', e => { if (e.target === $('modal')) closeModal('cancel'); });

  // 同步开关类按钮的初始文案
  $('smartToggle').textContent = `自动优化：${S.smartPlacement ? '开' : '关'}`; $('smartToggle').classList.toggle('active', S.smartPlacement);
  $('autoSaveToggle').textContent = `自动保存：${S.autoSave ? '开' : '关'}`; $('autoSaveToggle').classList.toggle('active', S.autoSave);
  $('animToggle').classList.toggle('on', S.animate); $('animToggle').setAttribute('aria-checked', String(S.animate));
  initOrientation();
  $('nearResToggle').classList.toggle('on', S.nearRes.enabled); $('nearResToggle').setAttribute('aria-checked', String(S.nearRes.enabled));
  $('nearResFields').classList.toggle('dim', !S.nearRes.enabled);
  $('nearResCount').value = String(S.nearRes.perSpawn); $('nearResMin').value = String(S.nearRes.min); $('nearResMax').value = String(S.nearRes.max);

  let resizeRaf = 0, lastMapW = $('map').clientWidth, lastMapH = $('map').clientHeight;
  // 3.10.0 修复：旋转屏幕 / 改变窗口大小后，未「适应画布」的视图以左上角为锚点，原来屏幕中央的内容会跑偏甚至移出画面；
  // 现在保持画布中心对应的地图位置不变
  const onResize = () => { cancelAnimationFrame(resizeRaf); resizeRaf = requestAnimationFrame(() => {
    if (!isNarrow()) closeDrawer();
    closeOrientMenu(); closeThemeMenu();
    const w = $('map').clientWidth, h = $('map').clientHeight;
    if (S.view.fitted) fitView();
    else {
      if (w && h && lastMapW && lastMapH) { S.view.x += (w - lastMapW) / 2; S.view.y += (h - lastMapH) / 2; }
      scheduleRender();
    }
    if (w && h) { lastMapW = w; lastMapH = h; }
  }); };
  window.addEventListener('resize', onResize);
  // 3.10.0：屏幕旋转时给画布 / 顶栏一个短暂的淡入过渡，掩盖 WebView 重排瞬间的闪动
  try {
    let orientT = 0;
    window.matchMedia('(orientation: landscape)').addEventListener('change', () => {
      document.body.classList.remove('orient-changed'); void document.body.offsetWidth;
      document.body.classList.add('orient-changed');
      clearTimeout(orientT); orientT = setTimeout(() => document.body.classList.remove('orient-changed'), 480);
    });
  } catch { /* 旧 WebView 的 MediaQueryList 不支持 addEventListener */ }
  if (window.ResizeObserver) new ResizeObserver(onResize).observe($('mapPanel'));
}

/* ------------------------------------------------------------------ 键盘快捷键 */
function bindKeyboard() {
  document.addEventListener('keydown', e => {
    const typing = e.target.closest?.('input,select,textarea');
    const mod = e.ctrlKey || e.metaKey;
    // 3.15.0：命令面板 —— Ctrl+K 开关；打开时其余快捷键一律不响应（方向键 / 回车由面板输入框自己处理）
    if (mod && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); cmdk.open ? closeCmdk() : openCmdk(); return; }
    if (cmdk.open) { if (e.key === 'Escape') { e.preventDefault(); closeCmdk(); } return; }
    if (e.key === '/' && !typing && !mod && !modalOpen()) { e.preventDefault(); openCmdk(); return; }
    // 3.16.0：焦点在主题面板里时，字母快捷键不作用到画布；3.17.0 修复：屏幕方向菜单同样处理（旧版按 D / T / L 会作用到画布）
    if (e.key !== 'Escape' && e.target.closest?.('#themeMenu,#orientMenu,#langMenu')) return;
    if (e.key === 'Escape') {
      if (window.I18N?.closeMenu?.()) { $('langToggle')?.focus(); return; } // 3.26.0：语言菜单
      if (closeThemeMenu()) { $('themeToggle')?.focus(); return; } // 3.16.0
      if (closeOrientMenu()) { $('orientToggle')?.focus(); return; }
      if (closeModal('cancel')) return;
      if (measure.on) { if (measure.a) { clearMeasurePoints(); scheduleRender(); } else setMeasure(false); return; }
      if (S.drawingPolygon) { S.drawingPolygon = null; updatePolygonInfo(); scheduleRender(); return; }
      if (S.selectedSpawn >= 0) { selectSpawn(-1); return; }
      if (closeSpawnCard()) return; // 3.19.0
      if (focusOn()) { setFocusMode(false); return; } // 3.17.0
      closeDrawer(); return;
    }
    /* 3.27.0 修复：形态总览的网格自己处理 Enter（= 选用），这里跳过；否则本监听（捕获阶段，先于网格执行）会先点主按钮「选用并生成」 */
    if (modalOpen()) { if (e.key === 'Enter' && !e.target.closest?.('.modal-actions button,#ovGrid')) { e.preventDefault(); $('modal').querySelector('.primary-soft,.danger')?.click(); } return; }
    if (mod && e.key === 'Enter') { e.preventDefault(); if (e.shiftKey) generateBestOf(); else generate(); return; }
    // 3.6.0：保存 / 导出快捷键在输入框内同样有效（旧版焦点在「地图名称」等输入框时 Ctrl+S 没反应）
    if (mod && e.shiftKey && (e.key === 's' || e.key === 'S')) { e.preventDefault(); showSaveAs(); return; } // 3.8.0：另存为
    if (mod && (e.key === 's' || e.key === 'S')) { e.preventDefault(); saveProject(false); return; }
    if (mod && (e.key === 'e' || e.key === 'E')) { e.preventDefault(); if (S.lastTmx) exportPair(); return; }
    if (typing) return;
    if (mod && (e.key === 'z' || e.key === 'Z')) { e.preventDefault(); e.shiftKey ? globalRedo() : globalUndo(); return; }
    if (mod && (e.key === 'y' || e.key === 'Y')) { e.preventDefault(); globalRedo(); return; }
    if (mod || e.altKey) return;
    if (e.key === ' ') {
      // 3.6.0 修复：旧版无条件拦截空格，用 Tab 聚焦到按钮后按空格既不能「点击」按钮也不能平移。
      // 现在键盘聚焦（:focus-visible）的按钮 / 开关 / 标签页保留原生的空格激活，其余情况仍是空格 + 拖动平移。
      const kbControl = e.target.closest?.('button,a[href],[role="switch"],[role="tab"],summary') && e.target.matches?.(':focus-visible');
      if (kbControl) return;
    }
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
    else if (k === 'd') showMapDoctor();
    else if (k === 't') setTerritoryLayer(!S.layers.territory);
    else if (k === 'l') setRoutesLayer(!S.layers.routes);
    else if (k === 'n') $('layerNearRes')?.click();
    else if (k === 'u') setMeasure(!measure.on);
    else if (k === 'z') setFocusMode(!focusOn()); // 3.17.0：专注模式
    else if (k === 'y') setSymmetryLayer(!S.layers.symmetry); // 3.19.0：对称检查
    else if (k === 'o') tuneFairness();                        // 3.20.0：公平度一键微调
    else if (k === 'k') setSpotLayer(!S.layers.spots);        // 3.20.0：落点热力
    else if (k === 'x') showCompare();                         // 3.26.0：新旧对比
    else if (k === 'g' && e.shiftKey) showShapeOverview();     // 3.27.0：形态总览
    else if (k === 'g') showSeedGallery();                     // 3.26.0：形态种子画廊
    else if (k === '.' || k === '>') tourSpawn(1);            // 3.19.0：出生点巡视
    else if (k === ',' || k === '<') tourSpawn(-1);
    else if (S.mode === 'wizard' && { v: 1, b: 1, p: 1, c: 1, r: 1 }[k]) setTool({ v: 'pan', b: 'brush', p: 'polygon', c: 'cc', r: 'resource' }[k]);
  });
  document.addEventListener('keyup', e => { if (e.key === ' ') { spaceHeld = false; $('map').classList.remove('space-pan'); } });
  // 3.2.0 修复：按住空格时切换窗口（Alt+Tab），keyup 不会触发，空格平移状态会一直卡住
  window.addEventListener('blur', () => { spaceHeld = false; $('map').classList.remove('space-pan'); });
  /* 3.18.0：实时体检徽章在后台会每 1.2s 自我续期（runHealthBadge 的 document.hidden / S.locked 分支）。
   * 切到后台时清掉挂起的计时器，回到前台再补算一次，避免后台常驻空转。 */
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { scheduleRender(); queueHealthBadge(); } else clearTimeout(health.timer); });
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
  // 3.2.0：首次启动（未手动选择过主题）时跟随系统深浅色；3.16.0：读取主题 id（兼容旧版下标），并恢复「动态背景」开关
  document.body.classList.toggle('fx-off', !fxEnabled());
  applyTheme(readThemeChoice());
  try {
    window.matchMedia?.('(prefers-color-scheme: light)').addEventListener?.('change', refreshAutoTheme);
  } catch { /* 旧 WebView 不支持 */ }
  // 昼夜流转：从后台回来（定时器可能被挂起）立即按当前时间校正一次
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshAutoTheme(); });
  loadPrefs();
  onTeamModeChange({ quiet: true }); // 3.19.0：按保存的预设恢复「两队 / 自由混战」状态（不重排、不提示）
  bindAccordion();
  bindControls();
  window.__tmxToast = (m) => toast(m, 'info', 2400); // 3.26.0：供 i18n.js 提示「已切换语言」
  bindCanvas();
  bindKeyboard();
  syncPresetFromPlayers();
  updateMirrorHint();
  updateSteps(-1);
  updateSpawnUI();
  setTool('pan', false);
  updateUndoButtons();
  renderPresetOptions();
  updatePrevButton();
  scheduleRender();
  const splashOff = () => { const sp = $('splash'); if (!sp || sp.classList.contains('hide')) return; sp.classList.add('hide'); setTimeout(() => sp.remove(), 600); };
  setTimeout(splashOff, 2600);
  try {
    await Engine.start();
    setRuntime('本地运行 · 无网络依赖', 'ok');
    setStatus('本地地图生成引擎已就绪');
  } catch (e) {
    setStatus('本地引擎初始化失败：' + e.message);
    setRuntime('引擎初始化失败 · 点此重试', 'err');
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

/* ================================================================== 3.26.0 新功能 */

/* ------------------------------------------------------------------ ① 新旧对比（X / 命令面板 / 生成完成提示里的「对比上一张」）
 * 重新生成之后，「这张是不是比刚才那张好」以前只能靠记忆，或者先「找回上一张」看一眼、再换回来（两次整图载入）。
 * 现在每次地图被替换前（生成 / 择优采用 / 找回上一张 / 恢复历史版本），把即将被替换的那张地图画成一张小图并记下关键指标，
 * 替换成功后可以打开「新旧对比」：拖动分界线左右对照两张图，下面的表格列出尺寸 / 形态 / 出生点 / 资源 / 陆地占比 /
 * 健康度 / 公平度的变化（▲ 更好 / ▼ 更差），不满意直接「换回上一张」。
 * 实现要点：
 *  · 摘要在替换前同步生成（drawExportPng 与导出小地图同一套绘制，≤ 360 像素），先放进 pending，只有替换成功才提交；
 *    取消 / 失败回滚时 pending 被丢弃，不会出现「拿当前地图和它自己对比」。
 *  · 体检分数复用 analyzeMap 的缓存（与体检、实时徽章同一个数），对比时不会重新寻路。
 *  · 「换回上一张」直接走 restorePrevious（项目 / 恢复里的同一条路径），换回后对比方向自动对调，可以来回比较。 */
const cmp = { prev: null, pending: null };
function mapDigest() {
  if (!S.snapshot) return null;
  let url = '';
  try { const cv = drawExportPng(360, 'dots'); if (cv) url = cv.toDataURL('image/png'); } catch (e) { console.warn('对比缩略图生成失败', e); }
  if (!url) return null;
  const [w, h] = dims(), sp = currentSpawns();
  let land = null;
  try {
    const m = terrainMatrix();
    if (m?.data?.length) { let n = 0; for (const v of m.data) if (v > 0) n++; land = n / m.data.length; }
  } catch { /* ignore */ }
  let score = null, fair = null;
  try { score = analyzeMap()?.score ?? null; } catch { /* ignore */ }
  try { fair = sp.length >= 2 ? Math.round(spawnFairness().score) : null; } catch { /* ignore */ }
  return { url, w, h, spawns: sp.length, res: S.snapshot.resource_positions?.length || 0, land, score, fair,
    shape: S.mapShape?.label || '经典', name: sanitizeName($('mapName').value) || '', at: Date.now() };
}
function stageCompare() { try { cmp.pending = mapDigest(); } catch { cmp.pending = null; } }
function commitCompare() {
  if (cmp.pending) cmp.prev = cmp.pending;
  cmp.pending = null;
  updateCompareButton();
}
function clearCompare() { cmp.prev = cmp.pending = null; updateCompareButton(); }
function updateCompareButton() { const b = $('cmpBtn'); if (b) b.disabled = !(cmp.prev && S.snapshot); }
async function showCompare() {
  if (!cmp.prev || !S.snapshot) { toast('还没有可对比的上一张地图：重新生成一次地图后即可对比', 'info', 3800); return; }
  const a = cmp.prev, b = mapDigest();
  if (!b) { toast('当前地图无法生成对比图', 'warn'); return; }
  const pct = v => v == null ? '—' : Math.round(v * 100) + '%';
  const num = v => v == null ? '—' : String(v);
  const delta = (x, y, good = 0, fmt = v => v) => {
    if (x == null || y == null || x === y) return '<td class="cmp-d">—</td>';
    const up = y > x, cls = !good ? 'n' : (up === (good > 0) ? 'g' : 'b');
    return `<td class="cmp-d ${cls}">${up ? '▲' : '▼'} ${fmt(Math.abs(y - x))}</td>`;
  };
  const row = (k, x, y, d = '<td class="cmp-d">—</td>') => `<tr><th>${k}</th><td>${x}</td><td>${y}</td>${d}</tr>`;
  const rows = [
    row('尺寸', `${a.w}×${a.h}`, `${b.w}×${b.h}`, a.w === b.w && a.h === b.h ? '<td class="cmp-d">相同</td>' : '<td class="cmp-d n">变化</td>'),
    row('地形', escapeHtml(a.shape), escapeHtml(b.shape), a.shape === b.shape ? '<td class="cmp-d">相同</td>' : '<td class="cmp-d n">变化</td>'),
    row('出生点', num(a.spawns), num(b.spawns), delta(a.spawns, b.spawns)),
    row('资源点', num(a.res), num(b.res), delta(a.res, b.res)),
    row('陆地占比', pct(a.land), pct(b.land), delta(a.land == null ? null : Math.round(a.land * 100), b.land == null ? null : Math.round(b.land * 100), 0, v => v + '%')),
    row('健康度', num(a.score), num(b.score), delta(a.score, b.score, 1)),
    row('公平度', num(a.fair), num(b.fair), delta(a.fair, b.fair, 1))
  ].join('');
  const canSwap = !$('projectPrev')?.disabled;
  const verdict = a.score != null && b.score != null
    ? (b.score > a.score ? `当前地图健康度高 <b>${b.score - a.score}</b> 分` : b.score < a.score ? `上一张地图健康度高 <b>${a.score - b.score}</b> 分${canSwap ? '，可以一键换回' : ''}` : '两张地图健康度相同')
    : '';
  const p = uiChoice('新旧对比', `
    <div class="cmp-stage" id="cmpStage" style="--x:100%;aspect-ratio:${Math.max(b.w, 1)} / ${Math.max(b.h, 1)};width:min(100%, calc(min(56vh, 520px) * ${(Math.max(b.w, 1) / Math.max(b.h, 1)).toFixed(4)}))" role="img" aria-label="左：上一张地图；右：当前地图">
      <img class="cmp-img" src="${b.url}" alt="" draggable="false">
      <img class="cmp-img cmp-prev" src="${a.url}" alt="" draggable="false">
      <span class="cmp-tag l">上一张</span><span class="cmp-tag r">当前</span>
      <span class="cmp-handle" aria-hidden="true"><i></i></span>
    </div>
    <input id="cmpRange" class="cmp-range" type="range" min="0" max="100" value="50" aria-label="对比分界线位置（左 = 上一张，右 = 当前）">
    ${verdict ? `<p class="cmp-verdict">${verdict}</p>` : ''}
    <table class="cmp-table"><thead><tr><th></th><th>上一张</th><th>当前</th><th>变化</th></tr></thead><tbody>${rows}</tbody></table>
    <p class="help-p cmp-note">拖动画面上的分界线（或下方滑块）左右对照；▲▼ 绿色表示变好、红色表示变差。</p>`,
    [{ key: 'cancel', label: '关闭' }, { key: 'swap', label: '换回上一张', hidden: !canSwap }, { key: 'ok', label: '保留当前', primary: true }].filter(x => !x.hidden), { wide: true });
  const st = $('cmpStage'), rg = $('cmpRange');
  if (st && rg) {
    const set = v => { v = clamp(v, 0, 100); st.style.setProperty('--x', v + '%'); rg.value = String(Math.round(v)); };
    const fromEvent = e => { const r = st.getBoundingClientRect(); return (e.clientX - r.left) / Math.max(1, r.width) * 100; };
    let drag = false, touched = false;
    st.addEventListener('pointerdown', e => { drag = touched = true; st.classList.remove('intro'); st.classList.add('dragging'); st.setPointerCapture?.(e.pointerId); set(fromEvent(e)); e.preventDefault(); });
    st.addEventListener('pointermove', e => { if (drag) set(fromEvent(e)); });
    const end = () => { drag = false; st.classList.remove('dragging'); };
    st.addEventListener('pointerup', end); st.addEventListener('pointercancel', end);
    rg.addEventListener('input', () => { touched = true; st.classList.remove('intro'); set(Number(rg.value)); });
    // 打开时分界线从右向左扫到中间：先完整显示「上一张」，再揭开「当前」
    // 用户在开场动画开始前就拖动时，不再被开场动画拉回中间
    requestAnimationFrame(() => requestAnimationFrame(() => { if (touched) return; st.classList.add('intro'); set(50); setTimeout(() => st.classList.remove('intro'), 900); }));
  }
  const k = await p;
  if (k === 'swap') await restorePrevious();
}

/* ------------------------------------------------------------------ ② 形态种子画廊（G / 形态卡片「种子画廊」按钮）
 * 地形形态的轮廓由种子决定。以前想挑一个满意的轮廓，只能反复点骰子、每次看一张预览、记不住上一个更好的种子。
 * 画廊一次排出 6 个预览（第一个是当前种子，方便对照），每张标出陆地占比与陆块数；「换一批」再来 5 个新种子。
 * 点选后「固定此种子」只改种子（参数与比例不变），「用它生成」直接按这个种子生成整张地图；双击预览也可直接生成。
 * 预览走形态 Worker 的同一个 preview 接口（与卡片里的预览完全一致，所见即所得），逐张串行计算、算好一张显示一张；
 * 换一批 / 关闭后，尚未返回的结果按批次号丢弃，不会画到新一批的格子里。 */
const GALLERY_SIZE = 6;
let galleryBatch = 0;
/* ================================================================== 3.27.0 新功能 */
/* ------------------------------------------------------------------ ① 种子收藏
 * 种子画廊里挑到满意的轮廓后，以前只能「固定此种子」——换一个种子试别的就丢了。现在可以按形态收藏（每个形态最多 12 个，
 * 保存在本机），画廊底部列出收藏夹，点选即放回第一格对照。只存种子数字，不影响项目文件与配方码。 */
const SEED_FAV_KEY = 'tmx_seed_fav_v1', SEED_FAV_MAX = 12;
function loadSeedFavs() { try { const o = JSON.parse(localStorage.getItem(SEED_FAV_KEY) || '{}'); return o && typeof o === 'object' && !Array.isArray(o) ? o : {}; } catch { return {}; } }
function seedFavs(id) { const a = loadSeedFavs()[id]; return Array.isArray(a) ? a.filter(x => Number.isInteger(x) && x > 0).slice(0, SEED_FAV_MAX) : []; }
function toggleSeedFav(id, seed) {
  seed = Number(seed); if (!Number.isInteger(seed) || seed <= 0) return false;
  const all = loadSeedFavs(); let a = seedFavs(id);
  const on = !a.includes(seed);
  a = on ? [seed, ...a].slice(0, SEED_FAV_MAX) : a.filter(x => x !== seed);
  if (a.length) all[id] = a; else delete all[id];
  try { localStorage.setItem(SEED_FAV_KEY, JSON.stringify(all)); } catch { /* 存储不可用时仅本次有效 */ }
  return on;
}
/* ------------------------------------------------------------------ ② 形态总览（Shift+G）
 * 15 套形态各有特点，以前只能逐个点选、看卡片里那一张预览，比较起来要来回切。总览以当前尺寸 / 陆地比例 / 山地 / 种子
 * 一次排出全部形态的预览（同一形态 Worker 接口，逐张计算、算好一张显示一张）。「自动套用推荐」开启时每张按该形态的
 * 推荐对称方式预览 —— 与选用后实际生成的一致（所见即所得）；关闭时统一用当前的对称方式。 */
async function showShapeOverview() {
  if (!guard() || !window.TerrainShapes) return;
  const p0 = params(), seed = shapeSeed(), items = TerrainShapes.SHAPES;
  let picked = shapeActive() ? shapeState.id : items[0].id;
  const mirrorOf = sh => shapeState.auto ? sh.mirror : p0.mirroring;
  const pr = uiChoice(`形态总览 · ${items.length} 套`, `
    <p class="help-p">以当前参数（${p0.width}×${p0.height} · 陆地 ${shapeState.land}% · 种子 ${seed}${shapeState.auto ? ' · 各形态按推荐对称' : ' · ' + MIRROR_LABELS[p0.mirroring]}）预览全部形态，方便横向比较。点选一张后「选用」；双击直接生成。</p>
    <div class="gal-grid ov-grid" id="ovGrid" role="listbox" aria-label="地形形态"></div>`,
    [{ key: 'cancel', label: '取消' }, { key: 'use', label: '选用此形态' }, { key: 'gen', label: '选用并生成', primary: true }], { wide: true });
  const grid = $('ovGrid'), batch = ++galleryBatch;
  if (grid) {
    grid.innerHTML = items.map((sh, i) => `<button type="button" class="gal-tile loading${sh.id === picked ? ' on' : ''}${shapeActive() && sh.id === shapeState.id ? ' cur' : ''}" role="option" aria-selected="${sh.id === picked}" data-shape="${sh.id}" title="${escapeHtml(sh.desc)}" style="--d:${i * 32}ms">
      <span class="gal-cv"><canvas width="8" height="8"></canvas><i class="gal-spin" aria-hidden="true"></i></span>
      <span class="gal-meta"><b>${sh.label}${sh.from ? '<em>新</em>' : ''}</b><small>计算中…</small></span></button>`).join('');
    const select = t => { picked = t.dataset.shape; grid.querySelectorAll('.gal-tile').forEach(x => { const on = x === t; x.classList.toggle('on', on); x.setAttribute('aria-selected', String(on)); }); };
    grid.addEventListener('click', e => { const t = e.target.closest('.gal-tile'); if (t) select(t); });
    grid.addEventListener('dblclick', e => { const t = e.target.closest('.gal-tile'); if (t) { select(t); closeModal('gen'); } });
    grid.addEventListener('keydown', e => {
      const tiles = [...grid.querySelectorAll('.gal-tile')], i = tiles.indexOf(document.activeElement); if (i < 0) return;
      // Enter = 选用（不生成）；阻止冒泡，否则全局「弹窗内 Enter = 主按钮」会再触发一次「选用并生成」
      if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); select(tiles[i]); closeModal('use'); return; }
      const cols = Math.max(1, getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length);
      const to = { ArrowRight: i + 1, ArrowLeft: i - 1, ArrowDown: i + cols, ArrowUp: i - cols, Home: 0, End: tiles.length - 1 }[e.key];
      if (to == null) return; e.preventDefault(); const t = tiles[clamp(to, 0, tiles.length - 1)]; t.focus(); select(t);
    });
    // uiChoice 会在 60ms 后把焦点交给主按钮；总览以浏览网格为主，稍后把焦点放回当前形态，方向键可直接使用
    setTimeout(() => { if (grid.isConnected) (grid.querySelector('.gal-tile.on') || grid.querySelector('.gal-tile'))?.focus({ preventScroll: true }); }, 90);
    (async () => {
      for (const tile of grid.querySelectorAll('.gal-tile')) {
        const sh = TerrainShapes.SHAPE_MAP.get(tile.dataset.shape);
        try {
          const r = await ShapeWorker.call('preview', { shape: sh.id, width: p0.width, height: p0.height, seed, land: shapeState.land / 100, rough: Number(shapeState.rough), mirror: mirrorOf(sh), maxSide: 110 });
          if (batch !== galleryBatch || !tile.isConnected) return;
          const cv = tile.querySelector('canvas');
          cv.width = r.width; cv.height = r.height; cv.style.aspectRatio = `${p0.width} / ${p0.height}`;
          cv.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(r.rgba), r.width, r.height), 0, 0);
          tile.querySelector('small').textContent = `陆地 ${Math.round(r.stats.landRatio * 100)}% · 陆块 ${r.stats.landmasses} · 高地 ${Math.round(r.stats.mountainRatio * 100)}%`;
          tile.classList.remove('loading'); tile.classList.add('ready');
        } catch (e) {
          if (batch !== galleryBatch || !tile.isConnected) return;
          tile.classList.remove('loading'); tile.querySelector('small').textContent = e.cancelled ? '已取消' : '预览失败';
        }
      }
    })();
  }
  const k = await pr;
  galleryBatch++; // 关闭后丢弃尚未返回的预览
  if (k !== 'use' && k !== 'gen') return;
  selectShape(picked, true);
  if (k === 'gen') generate();
}

async function showSeedGallery() {
  if (!guard()) return;
  if (!shapeActive()) {
    toast('种子画廊用于「地形形态」：先在「地形形态」里选择一个形态（如岛屿、群岛）', 'info', 4200);
    document.querySelector('[data-card="shape"]')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    return;
  }
  const m = shapeMeta(shapeState.id), p0 = params();
  let picked = shapeSeed();
  const p = uiChoice(`种子画廊 · ${m.label}`, `
    <p class="help-p">同一套参数（${p0.width}×${p0.height} · 陆地 ${shapeState.land}% · ${MIRROR_LABELS[p0.mirroring]}）下不同种子的轮廓。点选一张，再选择「固定此种子」或「用它生成」；双击预览直接生成。</p>
    <div class="gal-grid" id="galGrid" role="listbox" aria-label="候选种子"></div>
    <div class="gal-bar"><div class="gal-actions"><button type="button" id="galReroll" class="gal-reroll"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/></svg>换一批</button>
      <button type="button" id="galStar" class="gal-star" aria-pressed="false" title="收藏 / 取消收藏所选种子（按形态分别保存在本机）"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8-4.3-4.1 5.9-.9z"/></svg><span>收藏</span></button></div>
      <span id="galPick" class="gal-pick" aria-live="polite"></span></div><div class="fav-row" id="galFavs" hidden></div>`,
    [{ key: 'cancel', label: '取消' }, { key: 'fix', label: '固定此种子' }, { key: 'gen', label: '用它生成', primary: true }], { wide: true });
  const grid = $('galGrid');
  /* 3.27.0：种子收藏 —— 选中种子的收藏状态、收藏夹（点选即把该种子放到第一格并重新排一批） */
  const renderFavs = () => {
    const box = $('galFavs'); if (!box) return;
    const favs = seedFavs(m.id);
    box.hidden = !favs.length;
    box.innerHTML = favs.length ? `<small>收藏的种子</small>` + favs.map((sd, i) => `<span class="chip fav-chip${sd === picked ? ' on' : ''}" style="--d:${i * 30}ms"><button type="button" class="fav-go" data-fav="${sd}" title="载入种子 ${sd}" style="all:unset;cursor:pointer">${sd}</button><button type="button" class="fav-x" data-unfav="${sd}" aria-label="移除收藏 ${sd}" title="移除收藏">✕</button></span>`).join('') : '';
  };
  const showPick = () => {
    const el = $('galPick'); if (el) el.innerHTML = `已选种子 <b>${picked}</b>`;
    const st = $('galStar'); if (st) { const on = seedFavs(m.id).includes(picked); st.classList.toggle('on', on); st.setAttribute('aria-pressed', String(on)); st.querySelector('span').textContent = on ? '已收藏' : '收藏'; }
    renderFavs();
  };
  const fill = async (seeds) => {
    const batch = ++galleryBatch;
    grid.innerHTML = seeds.map((sd, i) => `<button type="button" class="gal-tile loading${sd === picked ? ' on' : ''}" role="option" aria-selected="${sd === picked}" data-seed="${sd}" style="--d:${i * 50}ms">
      <span class="gal-cv"><canvas width="8" height="8"></canvas><i class="gal-spin" aria-hidden="true"></i></span>
      <span class="gal-meta"><b>${i === 0 && sd === shapeSeed() ? '当前 · ' : ''}${sd}</b><small>计算中…</small></span></button>`).join('');
    for (const tile of grid.querySelectorAll('.gal-tile')) {
      const sd = Number(tile.dataset.seed);
      try {
        const r = await ShapeWorker.call('preview', { ...shapeOpts(p0, sd), maxSide: 132 });
        if (batch !== galleryBatch || !tile.isConnected) return;
        const cv = tile.querySelector('canvas');
        cv.width = r.width; cv.height = r.height; cv.style.aspectRatio = `${p0.width} / ${p0.height}`;
        cv.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(r.rgba), r.width, r.height), 0, 0);
        tile.querySelector('small').textContent = `陆地 ${Math.round(r.stats.landRatio * 100)}% · 陆块 ${r.stats.landmasses} · 高地 ${Math.round(r.stats.mountainRatio * 100)}%`;
        tile.classList.remove('loading'); tile.classList.add('ready');
      } catch (e) {
        if (batch !== galleryBatch || !tile.isConnected) return;
        tile.classList.remove('loading'); tile.querySelector('small').textContent = e.cancelled ? '已取消' : '预览失败';
      }
    }
  };
  const fresh = (n) => { const out = new Set(); while (out.size < n) out.add(randSeed()); return [...out]; };
  if (grid) {
    grid.addEventListener('click', e => {
      const t = e.target.closest('.gal-tile'); if (!t) return;
      picked = Number(t.dataset.seed);
      grid.querySelectorAll('.gal-tile').forEach(x => { const on = x === t; x.classList.toggle('on', on); x.setAttribute('aria-selected', String(on)); });
      showPick();
    });
    grid.addEventListener('dblclick', e => { const t = e.target.closest('.gal-tile'); if (t) { picked = Number(t.dataset.seed); closeModal('gen'); } });
    grid.addEventListener('keydown', e => {
      const tiles = [...grid.querySelectorAll('.gal-tile')], i = tiles.indexOf(document.activeElement); if (i < 0) return;
      const cols = Math.max(1, getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length);
      const to = { ArrowRight: i + 1, ArrowLeft: i - 1, ArrowDown: i + cols, ArrowUp: i - cols }[e.key];
      if (to == null) return; e.preventDefault();
      // 3.27.0 修复：方向键移动焦点的同时选中该种子。旧版只移动焦点，而弹窗里的 Enter 会直接触发「用它生成」，
      // 生成的是之前用鼠标点过的那个种子，而不是键盘焦点所在的那张 —— 纯键盘无法挑选种子
      const t = tiles[clamp(to, 0, tiles.length - 1)]; t.focus(); t.click();
    });
    $('galStar')?.addEventListener('click', () => {
      const on = toggleSeedFav(m.id, picked), st = $('galStar');
      st.classList.remove('pop'); void st.offsetWidth; if (on) st.classList.add('pop');
      showPick(); toast(on ? `已收藏「${m.label}」种子 ${picked}` : `已取消收藏种子 ${picked}`, on ? 'success' : 'info', 2000);
    });
    $('galFavs')?.addEventListener('click', e => {
      const x = e.target.closest('[data-unfav]');
      if (x) { toggleSeedFav(m.id, Number(x.dataset.unfav)); showPick(); return; }
      const g = e.target.closest('[data-fav]'); if (!g) return;
      picked = Number(g.dataset.fav);
      const favs = seedFavs(m.id).filter(v => v !== picked);
      fill([picked, ...favs, ...fresh(GALLERY_SIZE)].filter((v, i, a) => a.indexOf(v) === i).slice(0, GALLERY_SIZE)); showPick();
    });
    $('galReroll')?.addEventListener('click', () => { const ic = $('galReroll').querySelector('svg'); ic?.classList.remove('spin'); void ic?.offsetWidth; ic?.classList.add('spin'); fill([picked, ...fresh(GALLERY_SIZE - 1).filter(x => x !== picked)].slice(0, GALLERY_SIZE)); });
    showPick();
    fill([picked, ...fresh(GALLERY_SIZE - 1).filter(x => x !== picked)].slice(0, GALLERY_SIZE));
  }
  const k = await p;
  galleryBatch++; // 关闭后丢弃尚未返回的预览
  if (k !== 'fix' && k !== 'gen') return;
  $('shapeSeed').value = String(picked); flashInput('shapeSeed');
  saveShapePrefs(); updateShapeSeedHint(); queueShapePreview(0);
  if (k === 'gen') generate(); else toast(`已固定形态种子 ${picked}`, 'success', 2400);
}

/* ------------------------------------------------------------------ ③ 主题切换：圆形揭示过渡
 * 支持 View Transitions 的 WebView / 浏览器（Chromium 111+）里，新主题从点击的色板处以圆形扩散揭开，整页（含画布）一次性
 * 平滑过渡；不支持时保留 3.16.0 的「色晕」效果。系统「减少动态效果」时直接切换。 */
function applyThemeAnimated(id, fromEl) {
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (reduce || typeof document.startViewTransition !== 'function' || !fromEl?.getBoundingClientRect) { themeWash(fromEl); applyTheme(id, true); return; }
  const r = fromEl.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
  const root = document.documentElement;
  root.style.setProperty('--vt-x', x + 'px'); root.style.setProperty('--vt-y', y + 'px');
  root.style.setProperty('--vt-r', Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y)) + 'px');
  root.classList.add('vt-theme');
  try {
    const vt = document.startViewTransition(() => { applyTheme(id, true); try { renderMap(); } catch { /* 下一帧照常重绘 */ } });
    const done = () => { clearTimeout(t); root.classList.remove('vt-theme'); };
    // 兜底：后台标签页 / 渲染被节流时 finished 可能迟迟不结算，最多 1.2 秒后清理过渡标记
    const t = setTimeout(done, 1200);
    vt.finished.then(done, done);
  } catch { root.classList.remove('vt-theme'); applyTheme(id, true); }
}

if (/[?&]debug\b/.test(location.search)) window.__tmx = { S, Engine, currentSpawns, dims, getMatrix, patchTmxUnits, parseTmx, uiChoice, uiConfirm, globalUndo, globalRedo, removeSpawnIndex, spawnFairness, buildCcMap, ccMapFor, verifySpawnMapping, orderBySlot, makePlayerOne, showSlotTable, buildMapPngInfo, drawExportPng, showMapPngPreview, normalizeSlots, analyzeMap, doctorVerdicts, buildGrid, labelGrid, territoryBfs, showMapDoctor, setTerritoryLayer, hasManualWork, backupCurrent, restorePrevious, generate, loadPresets, saveUserPreset, applyUserPreset, deleteUserPreset, renderPresetOptions, syncTmxUnits, exportPair, rushAnalysis, costField, tmxTerrainMasks, setRoutesLayer, generateBestOf, buildPoster, showPoster, saveProject, wallLayerFor, shapeState, selectShape, ShapeWorker, shapeSeed, generateShapePipeline, queueShapePreview, showSaveAs, ExportLoc, patchTmxItems, resourcePoolGids, planNearSpawnResources, pickResourcePoints, groupSpawnOrbits, autoApplyNearSpawnResources, HistoryStore, pushHistorySnapshot, showHistory, randomizeParams, surpriseGenerate, removeNearSpawnResourceAt, mutateTmx, measure, setMeasure, densityInfo, openCmdk, closeCmdk, cmdkScore, CMDS, measureProfile, applyTheme, resolveTheme, readThemeChoice, cycleSlot, THEMES, THEME_CHOICES, openThemeMenu, closeThemeMenu, setFxEnabled, rollMapName, spawnUndoAction, profileHover, encodeRecipe, decodeRecipe, applyRecipe, recipeData, copyRecipe, pasteRecipe, health, runHealthBadge, loupe, setFocusMode, focusOn, saveViewShot, captureEditorState, restoreEditorState, restoreAfterAbort, resetAll, analyzeSymmetry, setSymmetryLayer, tourSpawn, closeSpawnCard, tour, playerRows, isFFA, tuneFairness, optimizeSpawnLayout, analyzeSpots, setSpotLayer, repairSpawnSymmetry, mapUnfinished, finishRemainingSteps, ccExtendableCap, onTeamModeChange, extendCcTileset, rushAnalysisFFA, recipeFrom, mapRecipeCode, flyViewTo, setPresetValue, ENGINE_MAX_CC, MAX_SPAWN_POINTS, projectPayload, restoreProject, loadTmxBytes, themeGridMove, showCompare, mapDigest, cmp, stageCompare, commitCompare, showSeedGallery, applyThemeAnimated, releaseImportedName, showShapeOverview, seedFavs, toggleSeedFav, get routeCache() { return routeCache; } };
boot();
