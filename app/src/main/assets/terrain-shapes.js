/*
 * 铁锈战争地图生成器 · 地形形态模板（3.8.0 新增，3.24.0 重写模板层，3.25.0 按「参照物」重做山湖 / 火山 / 两岸等模板）
 *
 * 11 套形态模板：岛屿 / 半岛 / 群岛 / 双河 / 山湖 / 大陆 / 沙漠 / 雪原 / 火山 / 迷宫 / 两岸狭路。
 * 第一部分（3.24.0 重写）：每个模板定义一组与陆地比例无关的「模板场」（陆地优先级 / 结构水域 / 岩浆 / 山地 / 纹理），
 * 陆地比例只决定在同一族嵌套等值线中取哪一条，按格数精确命中目标比例 —— 调比例只改变陆地多少，不改变模板形态。
 * 3.25.0：每个模板的陆地比例都有明确的「参照物」（SHAPES[].ref）：陆地少则参照物大，陆地多则参照物小。
 *   山湖 = 陆地 ↔ 中央湖、火山 = 周围陆地 ↔ 火山（岩浆）、两岸狭路 = 两岸 ↔ 中央水道、双河 = 陆地 ↔ 河道……
 *   环形山 / 火山锥这类「沿岸骨架」改为跟随水体岸线定位，随中央湖 / 火口一起缩放。
 * 第二部分是「可对战化」后处理：对称镜像、碎块清理、浅滩、高地坡道、凿通被山围死的空地，
 * 最终转换成引擎 set_coastline_from_image 认识的矩阵（0 水 / 1 平地 / 2 高地 / -2 高地坡道）。
 *
 * 噪声：PermNoise 为经典 Perlin（fbm / 域扭曲 fbm / 脊状 fbm）。
 *
 * 本文件既可在网页主线程 / Web Worker 中以 <script> 或 import 加载（挂到 globalThis.TerrainShapes），
 * 也可在 Node 中 require（用于离线回归测试）。纯计算，无 DOM 依赖。
 */
(function (root) {
  'use strict';

  /* ================================================================ 地形类别 */
  const T = {
    WATER: 1, DEEP: 2, SHALLOW: 3, SAND: 4, LONG_GRASS: 5, SHORT_GRASS: 6, DIRT: 7,
    STONE: 8, MOUNTAIN: 9, SNOW: 10, ICE: 11, LAVA: 12
  };
  const T_NAMES = ['', 'water', 'deepWater', 'shallowWater', 'sand', 'longGrass', 'shortGrass', 'dirt', 'stone', 'mountain', 'snow', 'ice', 'lava'];
  const isWaterT = v => v === T.WATER || v === T.DEEP || v === T.SHALLOW;

  /* ================================================================ 经典 Perlin */
  class PermNoise {
    constructor(seed = 42) {
      this.perm = new Uint8Array(512);
      const p = new Uint8Array(256);
      for (let i = 0; i < 256; i++) p[i] = i;
      let n = seed;
      for (let i = 255; i > 0; i--) {
        n = n * 16807 % 2147483647;
        const r = n % (i + 1);
        const t = p[i]; p[i] = p[r]; p[r] = t;
      }
      for (let i = 0; i < 512; i++) this.perm[i] = p[i & 255];
    }
    noise2D(x, y) {
      const P = this.perm;
      const fx = Math.floor(x), fy = Math.floor(y);
      const X = fx & 255, Y = fy & 255;
      const xf = x - fx, yf = y - fy;
      const u = xf * xf * xf * (xf * (xf * 6 - 15) + 10);
      const v = yf * yf * yf * (yf * (yf * 6 - 15) + 10);
      const aa = P[P[X] + Y], ab = P[P[X] + Y + 1], ba = P[P[X + 1] + Y], bb = P[P[X + 1] + Y + 1];
      const g = (h, a, b) => { const k = h & 3, i = k < 2 ? a : b, j = k < 2 ? b : a; return ((k & 1) ? -i : i) + ((k & 2) ? -j : j); };
      const x1 = g(aa, xf, yf), x2 = g(ba, xf - 1, yf);
      const y1 = x1 + u * (x2 - x1);
      const x3 = g(ab, xf, yf - 1), x4 = g(bb, xf - 1, yf - 1);
      const y2 = x3 + u * (x4 - x3);
      return y1 + v * (y2 - y1);
    }
    fbm(x, y, oct = 4, lac = 2, gain = 0.5) {
      let sum = 0, amp = 1, freq = 1, norm = 0;
      for (let i = 0; i < oct; i++) { sum += amp * this.noise2D(x * freq, y * freq); norm += amp; amp *= gain; freq *= lac; }
      return (sum / norm + 1) / 2;
    }
    random2D(x, y) {
      const X = Math.floor(x) & 255, Y = Math.floor(y) & 255;
      return this.perm[(this.perm[X] + Y) & 255] / 255;
    }
    warpedFbm(x, y, oct = 5, amt = 0.75) {
      const wx = this.fbm(x + 31.7, y - 18.3, 3) * 2 - 1;
      const wy = this.fbm(x - 47.1, y + 63.9, 3) * 2 - 1;
      return this.fbm(x + wx * amt, y + wy * amt, oct);
    }
    ridgedFbm(x, y, oct = 4, lac = 2, gain = 0.5) {
      let sum = 0, amp = 1, freq = 1, norm = 0;
      for (let i = 0; i < oct; i++) {
        const n = 1 - Math.abs(this.noise2D(x * freq, y * freq));
        sum += n * n * amp; norm += amp; amp *= gain; freq *= lac;
      }
      return norm > 0 ? sum / norm : 0;
    }
  }

  /* ================================================================ 辅助函数 */
  const clamp01 = v => Math.max(0, Math.min(1, v));
  /** 平滑阶跃：e0 < e1 时从 0 升到 1，e0 > e1 时从 1 降到 0 */
  function smooth(e0, e1, x) {
    const span = e1 - e0, r = clamp01((x - e0) / Math.max(1e-4, Math.abs(span)));
    const s = r * r * (3 - 2 * r);
    return span < 0 ? 1 - s : s;
  }
  const angDist = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));

  /* ================================================================ 形态模板定义
   * size：推荐尺寸；theme：推荐贴图主题（1 丛林 2 雪山 3 火山 4 沙漠 5 森林）；mirror：推荐对称方式；
   * levels/ocean/magnet：推荐高度层级 / 海洋层级 / 墙体吸附；bridge：是否自动用浅滩连通被水隔开的大块陆地；
   * ref（3.25.0）：「陆地比例」的参照物 —— 比例只在「陆地 ↔ ref」之间调节（陆地少则 ref 大，陆地多则 ref 小）。 */
  const SHAPES = [
    { id: 'island', label: '岛屿', desc: '四面环海，中央一座完整的大岛，岛心为山地', ref: '外海', size: [120, 120], theme: 5, mirror: 'both', levels: 6, ocean: 3, magnet: 25, bridge: false },
    { id: 'peninsula', label: '半岛', desc: '大陆一侧伸出一条狭长半岛，半岛三面环海', ref: '外海', size: [160, 120], theme: 1, mirror: 'horizontal', levels: 6, ocean: 3, magnet: 25, bridge: true },
    { id: 'archipelago', label: '群岛', desc: '大小岛屿散布海中，岛与岛之间隔着贯通的海峡，适合海战', ref: '海峡与外海', size: [180, 180], theme: 1, mirror: 'both', levels: 4, ocean: 3, magnet: 20, bridge: false },
    { id: 'river', label: '双河', desc: '两条贯通全图的河流将陆地分为三块（不可陆路跨越），陆地越少河面越宽', ref: '两条河', size: [160, 120], theme: 5, mirror: 'vertical', levels: 6, ocean: 2, magnet: 25, bridge: false },
    { id: 'mountain_lake', label: '山湖', desc: '中央湖泊被环形山脉沿岸环抱，四处山口；陆地越少湖面越大，四周始终是一圈陆地', ref: '中央湖', size: [120, 120], theme: 5, mirror: 'vertical', levels: 7, ocean: 2, magnet: 35, bridge: true },
    { id: 'continent', label: '大陆', desc: '一整块大陆，海岸曲折多湾，内陆有山脉与湖泊，边缘少量水域', ref: '外海与内陆湖', size: [160, 160], theme: 1, mirror: 'vertical', levels: 7, ocean: 2, magnet: 25, bridge: true },
    { id: 'desert', label: '沙漠', desc: '大片沙丘与岩石台地，散布带草环的绿洲湖；陆地越少绿洲湖越大', ref: '外海与绿洲湖', size: [140, 140], theme: 4, mirror: 'vertical', levels: 5, ocean: 2, magnet: 20, bridge: true },
    { id: 'snowland', label: '雪原', desc: '冰雪覆盖的大地，峡湾海岸、冰湖与雪山', ref: '外海与峡湾', size: [140, 140], theme: 2, mirror: 'vertical', levels: 7, ocean: 2, magnet: 25, bridge: true },
    { id: 'volcano', label: '火山', desc: '中央火山：岩浆火口 + 熔岩流，火山锥沿火口环抱；陆地越少火山越大，外围始终是一圈陆地', ref: '火山（岩浆）', size: [120, 120], theme: 3, mirror: 'vertical', levels: 7, ocean: 2, magnet: 30, bridge: true },
    { id: 'labyrinth', label: '迷宫', desc: '高地山脊构成迷宫走廊，陆地越少外围走廊被水淹没得越多', ref: '外围水域', size: [160, 160], theme: 5, mirror: 'both', levels: 6, ocean: 1, magnet: 30, bridge: true },
    { id: 'two_sides', label: '两岸狭路', desc: '中央水道把地图分为对峙两岸，两岸延伸到图边；陆地越少水道越宽，中间渡口始终相通', ref: '中央水道', size: [240, 110], theme: 1, mirror: 'vertical', levels: 6, ocean: 2, magnet: 20, bridge: false }
  ];
  const SHAPE_MAP = new Map(SHAPES.map(s => [s.id, s]));

  /** 种子规范化：保留正整数种子（42 仍是 42），其余折叠到 [1, 2^31-2] */
  function normSeed(seed) {
    let s = Math.abs(Math.trunc(Number(seed) || 0)) % 2147483647;
    return s === 0 ? 7 : s;
  }

  /* ================================================================ 第一部分（3.24.0 重写）：模板场
   * 旧版先以 50% 生成一张基准图，再按到海岸的距离向外扩张 / 向内腐蚀来凑比例。
   * 基准图本身的噪声形态并不贴合模板名字，边界等距偏移又会把噪点放大：岛屿变成八边形、
   * 双河陆地只从一侧收缩、山湖的环形山退化成细线、火山变成 X 形熔岩……
   *
   * 新做法：每个模板在「整图归一化坐标」上定义一组与陆地比例无关的场 ——
   *   P    陆地优先级：陆地 = 可选格中 P 最高的 N 格（N = 目标比例 × 总格数，按镜像轨道加权精确计数）
   *   fw   结构性水域（河道 / 中央水道 / 湖心 / 绿洲 / 外缘海带）：任何比例都保持为水
   *   lava 岩浆（火口 / 熔岩流）：不计入陆地，也不参与选格
   *   M    山地强度：> 阈值且离岸足够远的陆地成为高地；M ≥ 2 为模板骨架山地（环形山 / 火山锥 / 迷宫墙）
   *   B    地表纹理噪声（只影响预览材质）；tag：材质提示（绿洲草环 / 火山灰 / 渡口）
   * 所有比例共用同一个 P，比例变化只是在同一族嵌套等值线中取另一条：陆地随比例单调扩张 / 收缩，
   * 山脉位置与纹理都不随比例改变 —— 「陆地占比只调节陆地占比」。
   * 3.25.0：P 的设计保证比例只在「陆地 ↔ 参照物」之间调节（例如山湖的 P 是到图心的距离，陆地少时让出的是中央湖，
   * 而不是四周的海）；山湖环形山与火山锥按 G − τ（到岸线的距离）放置，见 RING 与 categoriesFromFields。
   * 噪声频率与整图尺寸绑定（而非像素），所以同一模板在 80×80 和 2000×2000 上形态一致，预览与成品一致。 */
  const sn = v => (v - 0.5) * 3.5; // fbm(均值 0.5、σ≈0.085) → 均值 0、σ≈0.3
  const pnorm = (x, y, p) => Math.pow(Math.pow(Math.abs(x), p) + Math.pow(Math.abs(y), p), 1 / p);
  const TAG = { NONE: 0, OASIS: 1, ASH: 2, CROSSING: 3 };
  /** 圆 → 方的混合半径（3.25.0）：图心附近是圆（ρ = hypot），靠近图边逐渐过渡为方形（p=8 范数）。
   *  「中心水体 + 四周陆地」型模板（山湖 / 火山）用它作陆地优先级：陆地很少时剩下的是贴着四条边、
   *  宽度均匀的一圈完整陆地，而不是被水体从边中点切成四个角块。沿任意射线单调递增。 */
  /** p=8 范数（展开成乘法与三次开方，避免逐格 Math.pow，大地图上快约一倍） */
  function norm8(l, u) {
    const a = l * l, b = u * u, a2 = a * a, b2 = b * b;
    return Math.sqrt(Math.sqrt(Math.sqrt(a2 * a2 + b2 * b2)));
  }
  function radBlend(l, u, r8 = norm8(l, u)) {
    const r2 = Math.sqrt(l * l + u * u), w = smooth(0.6, 1.0, r8);
    return r2 + (r8 - r2) * w;
  }
  /** 火山熔岩流（3.25.0）：火口半径为 rc 时，熔岩流尖端到达 R(rc) = rc + min(α·rc, β·(1 − rc))。
   *  火口小（陆地多）时熔岩流随火口同比伸长；火口大（陆地少）时熔岩流只占火口外剩余陆地的固定比例，
   *  尖端永远到不了图边，外围陆地始终连成完整的一圈。R 关于 rc 单调递增，下面是它的反函数。 */
  const FLOW_A = 1.7, FLOW_B = 0.72, FLOW_J = FLOW_B / (FLOW_A + FLOW_B), FLOW_RJ = FLOW_J * (1 + FLOW_A);
  const flowInv = R => R <= FLOW_RJ ? R / (1 + FLOW_A) : (R - FLOW_B) / (1 - FLOW_B);
  /** 「沿岸骨架」配置（3.25.0）：山湖的环形山与火山的火山锥跟随水体岸线（τ 等值线）定位，而不是固定半径 ——
   *  中央湖 / 火口随陆地比例缩放时，山脉始终环抱在岸边。g0 / w：岸边留白与山环宽度（占「岸线到图边」带宽的比例），
   *  g0c / wc / pc：以格计的最小值；p：山口半宽（归一化弧长）；ash：火山灰带（带宽比例）。 */
  const RING = {
    mountain_lake: { g0: 0.08, g0c: 1.3, w: 0.2, wc: 3.0, p: 0.075, pc: 2.6, hill: 0.06 },
    volcano: { g0: 0.035, g0c: 1.4, w: 0.17, wc: 3.4, p: 0.06, pc: 2.4, hill: 0.05, ash: 0.16 }
  };

  /** 镜像坐标系：返回 (l,u) → (a,b) 的线性变换。约定单轴镜像时镜像操作为 b → −b（a 轴即对称轴），
   *  both 时 a → −a 且 b → −b。需要「方向」的模板（半岛 / 双河 / 两岸 / 火山熔岩流）在这个坐标系里定义，
   *  于是换用任意对称方式，半岛都沿对称轴伸出、河流与水道都与对称轴保持正确的相对关系。 */
  function frameOf(mode) {
    const R = Math.SQRT1_2;
    switch (mode) {
      case 'vertical': return { aL: 0, aU: 1, bL: 1, bU: 0, E: 1, axis: true };
      case 'horizontal': return { aL: 1, aU: 0, bL: 0, bU: 1, E: 1, axis: true };
      case 'diagonal1': return { aL: R, aU: R, bL: -R, bU: R, E: Math.SQRT2, axis: true };
      case 'diagonal2': return { aL: R, aU: -R, bL: R, bU: R, E: Math.SQRT2, axis: true };
      default: return { aL: 1, aU: 0, bL: 0, bU: 1, E: 1, axis: false }; // none / both
    }
  }

  /** 模板的预计算数据（站点、迷宫、熔岩流方向等），只依赖种子、整图尺寸与对称方式 */
  function setupTemplate(shape, W, H, seed, mode) {
    const rng = mulberry32(seed ^ 0x3c6ef372), S = (W + H) / 2, asp = W / Math.max(1, H);
    const fr = frameOf(mode), t = { fr, S };
    const longAxisA = W >= H; // 无单轴对称时，方向性模板沿地图长边展开
    if (shape === 'archipelago') {
      const nx = Math.max(3, Math.min(7, Math.round(4.3 * Math.sqrt(asp)))), ny = Math.max(3, Math.min(7, Math.round(4.3 / Math.sqrt(asp))));
      const cw = W / S / nx, ch = H / S / ny, sites = [];
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
        sites.push({ x: (i + 0.5 + (rng() - 0.5) * 0.78) * cw, y: (j + 0.5 + (rng() - 0.5) * 0.78) * ch, w: 0.62 + rng() * 0.72 });
      }
      Object.assign(t, { nx, ny, cw, ch, sites, cell: Math.sqrt(cw * ch) });
    } else if (shape === 'labyrinth') {
      const base = Math.max(6, Math.min(15, Math.round(Math.sqrt(W * H) / 17)));
      const nx = Math.max(4, Math.round(base * Math.sqrt(asp))), ny = Math.max(4, Math.round(base / Math.sqrt(asp)));
      // V[j*nx+i]：格 (i,j) 与 (i+1,j) 之间的竖墙；Hz[j*nx+i]：格 (i,j) 与 (i,j+1) 之间的横墙
      const V = new Uint8Array(nx * ny).fill(1), Hz = new Uint8Array(nx * ny).fill(1), seen = new Uint8Array(nx * ny);
      const stack = [((ny >> 1) * nx) + (nx >> 1)]; seen[stack[0]] = 1;
      while (stack.length) {
        const c = stack[stack.length - 1], i = c % nx, j = (c / nx) | 0, opts = [];
        if (i > 0 && !seen[c - 1]) opts.push(0); if (i < nx - 1 && !seen[c + 1]) opts.push(1);
        if (j > 0 && !seen[c - nx]) opts.push(2); if (j < ny - 1 && !seen[c + nx]) opts.push(3);
        if (!opts.length) { stack.pop(); continue; }
        const d = opts[(rng() * opts.length) | 0];
        const q = d === 0 ? c - 1 : d === 1 ? c + 1 : d === 2 ? c - nx : c + nx;
        if (d === 0) V[c - 1] = 0; else if (d === 1) V[c] = 0; else if (d === 2) Hz[c - nx] = 0; else Hz[c] = 0;
        seen[q] = 1; stack.push(q);
      }
      // 打通约 14% 的内墙形成环路：减少死胡同，迷宫依旧可辨但不至于只有一条路线
      for (let c = 0; c < nx * ny; c++) {
        if (c % nx < nx - 1 && V[c] && rng() < 0.14) V[c] = 0;
        if (((c / nx) | 0) < ny - 1 && Hz[c] && rng() < 0.14) Hz[c] = 0;
      }
      for (let j = 0; j < ny; j++) V[j * nx + nx - 1] = 0;   // 外框不设墙
      for (let i = 0; i < nx; i++) Hz[(ny - 1) * nx + i] = 0;
      Object.assign(t, { nx, ny, V, Hz, cwPx: W / nx, chPx: H / ny });
    } else if (shape === 'volcano') {
      // 熔岩流方向：在镜像坐标系中取对称的方向组，镜像后每条熔岩流都完整，不会被对称折叠成「V」字岔口
      const j1 = (rng() - 0.5) * 0.5, j2 = (rng() - 0.5) * 0.5;
      let flows;
      if (mode === 'both') flows = [0.62 + j1, -0.62 - j1, Math.PI - 0.62 - j1, -Math.PI + 0.62 + j1].map((a, i) => ({ a, m: i % 2 ? -1 : 1 }));
      else if (fr.axis) flows = [{ a: 0, m: 0 }, { a: 2.2 + j1, m: 1 }, { a: -2.2 - j1, m: -1 }];
      else { const a0 = rng() * Math.PI * 2; flows = [a0, a0 + 2.0 + j1, a0 - 2.1 + j2].map(a => ({ a, m: 1 })); }
      for (const f of flows) f.ph = rng() * 6.283;
      // 镜像成对的熔岩流共用相位，保证两条严格镜像
      if (flows.length >= 3 && fr.axis) flows[2].ph = flows[1].ph;
      if (mode === 'both') for (const f of flows) f.ph = flows[0].ph;
      // 火山锥山口：取相邻两条熔岩流的角平分线（对任意对称方式都自成镜像），让火口岸边的平地与外围相通
      const ang = flows.map(f => Math.atan2(Math.sin(f.a), Math.cos(f.a))).sort((x, y) => x - y);
      t.passes = ang.map((x, i) => { const y = i + 1 < ang.length ? ang[i + 1] : ang[0] + Math.PI * 2; return (x + y) / 2; });
      t.flows = flows;
    } else if (shape === 'desert' || shape === 'continent') {
      // 绿洲 / 内陆湖：在内陆随机撒点（彼此保持距离），镜像后成对出现
      const want = shape === 'desert' ? 5 : 3, pts = [];
      for (let tries = 0; tries < 200 && pts.length < want; tries++) {
        const x = (rng() * 2 - 1) * 0.62, y = (rng() * 2 - 1) * 0.62;
        if (pts.some(p => Math.hypot(p.x - x, p.y - y) < 0.38)) continue;
        pts.push({ x, y, r: shape === 'desert' ? 0.036 + rng() * 0.025 : 0.05 + rng() * 0.034 });
      }
      t.pools = pts;
    } else if (shape === 'peninsula') {
      const along = fr.axis ? null : (longAxisA ? 'l' : 'u');
      t.pen = { along, tip: mode === 'both' ? -0.16 : 0.5 + (rng() - 0.5) * 0.08, bend: fr.axis || mode === 'both' ? 0 : (rng() - 0.5) * 0.24, ph: rng() * 6.283 };
    } else if (shape === 'river') {
      t.riv = { ph1: rng() * 6.283, ph2: rng() * 6.283, f1: 1.1 + rng() * 0.5, f2: 1.1 + rng() * 0.5 };
    } else if (shape === 'two_sides') {
      const j = (rng() - 0.5) * 0.12;
      t.cross = mode === 'both' ? [-0.56 - j, 0, 0.56 + j] : [-0.56 + (rng() - 0.5) * 0.1, (rng() - 0.5) * 0.08, 0.56 + (rng() - 0.5) * 0.1];
      t.ph = rng() * 6.283;
    }
    t.longAxisA = longAxisA;
    return t;
  }

  /** 迷宫墙距离（像素）：到最近一段墙（含墙段端点处的立柱）的距离 */
  function mazeWallDist(t, px, py) {
    const { nx, ny, V, Hz, cwPx, chPx } = t;
    const fx = px / cwPx, fy = py / chPx;
    const i = Math.max(0, Math.min(nx - 1, Math.floor(fx))), j = Math.max(0, Math.min(ny - 1, Math.floor(fy)));
    const dx = (fx - i) * cwPx, dy = (fy - j) * chPx, rx = cwPx - dx, ry = chPx - dy;
    let d = 1e9;
    if (i > 0 && V[j * nx + i - 1]) d = Math.min(d, dx);
    if (V[j * nx + i]) d = Math.min(d, rx);
    if (j > 0 && Hz[(j - 1) * nx + i]) d = Math.min(d, dy);
    if (Hz[j * nx + i]) d = Math.min(d, ry);
    // 四个角点：任一相邻墙段触及该角点即视为立柱，墙体转角饱满、不留缝
    const vt = (ii, jj) => ii >= 0 && jj >= 0 && ii < nx && jj < ny && V[jj * nx + ii];
    const ht = (ii, jj) => ii >= 0 && jj >= 0 && ii < nx && jj < ny && Hz[jj * nx + ii];
    for (let cy = 0; cy <= 1; cy++) for (let cx = 0; cx <= 1; cx++) {
      const vi = i + cx, vj = j + cy; // 角点 (vi,vj)
      if (vt(vi - 1, vj - 1) || vt(vi - 1, vj) || ht(vi - 1, vj - 1) || ht(vi, vj - 1)) {
        d = Math.min(d, Math.hypot(cx ? rx : dx, cy ? ry : dy));
      }
    }
    return d;
  }

  /**
   * 计算模板场。只计算 need 为真的格（对称源半区），其余由镜像填充。
   * @returns {{P:Float32Array,M:Float32Array,B:Float32Array,fw:Uint8Array,lava:Uint8Array,tag:Uint8Array}}
   */
  function templateFields(shape, W, H, st, gw, gh, seed, mode, need, prog) {
    const n = gw * gh;
    const P = new Float32Array(n), M = new Float32Array(n), B = new Float32Array(n);
    // G：沿岸骨架的定位场（山湖 = P，火山 = 火口项，两岸 = 渡口处的自然优先级，沙漠 / 大陆 = 湖泊项）；A：到山口的弧长
    const G = new Float32Array(n), A = new Float32Array(n);
    const fw = new Uint8Array(n), lava = new Uint8Array(n), tag = new Uint8Array(n);
    const noise = new PermNoise(seed), tex = new PermNoise(seed ^ 0x2545f491);
    const t = setupTemplate(shape, W, H, seed, mode), fr = t.fr, S = t.S;
    const cellU = 2 * st / Math.max(1, H - 1), cellL = 2 * st / Math.max(1, W - 1), cellMin = Math.max(cellU, cellL);
    // 镜像坐标系中 (a/E, b/E) 每格的步长：正交时即 cellMin，对角时 (l±u)/2 每格只走 cellMin/2
    const cellQ = cellMin / (fr.E * fr.E);
    const minSide = Math.min(W, H);
    for (let gy = 0; gy < gh; gy++) {
      if (prog && (gy & 15) === 0) prog(gy / gh);
      const py = gy * st, u = py / Math.max(1, H - 1) * 2 - 1, Y = py / S;
      for (let gx = 0; gx < gw; gx++) {
        if (need && !need(gx, gy)) continue;
        const k = gy * gw + gx, px = gx * st, l = px / Math.max(1, W - 1) * 2 - 1, X = px / S;
        const a = fr.aL * l + fr.aU * u, b = fr.bL * l + fr.bU * u;
        const nl = sn(noise.warpedFbm(X * 2.1 + 11.3, Y * 2.1 - 7.7, 4, 0.7));   // 大尺度：海湾 / 半岛
        const nm = sn(noise.fbm(X * 6.3 + 3.1, Y * 6.3 + 9.4, 3));              // 中尺度：海岸细节
        const rg = noise.ridgedFbm(X * 2.7 + 41.7, Y * 2.7 - 23.9, 4);            // 山脉链（均值≈0.66）
        B[k] = tex.fbm(X * 7.5 + 13.7, Y * 7.5 - 9.3, 3);
        let p = 0, m = 0;
        switch (shape) {
          case 'island': {
            const q = pnorm(l, u, 2.3);
            p = -(q + 0.21 * nl + 0.07 * nm);
            m = 1.1 * (rg - 0.66) + 0.15 * nm; // 再叠加「离岸相对深度」，山地总在岛心（见 MOUNT_REL）
            // 外缘海带：任何比例下四面都留有海，岛屿不会贴边变成「大陆」
            const edge = Math.min(px, py, W - 1 - px, H - 1 - py);
            // 宽度约为短边的 1.5%（至少 1 格）：120×120 时 2 格，40×40 时 1 格，仍能达到 90% 陆地
            if (edge < Math.max(st, minSide * 0.015)) fw[k] = 1;
            break;
          }
          case 'peninsula': {
            const pen = t.pen;
            let an, bn;
            if (pen.along === 'l') { an = l; bn = u; } else if (pen.along === 'u') { an = u; bn = l; } else { an = a / fr.E; bn = b / fr.E; }
            const base = -0.62, tip = pen.tip, mEdge = -0.6;
            const bc = pen.bend * Math.sin((an - base) * 2.4 + pen.ph) + 0.035 * nl * (pen.bend ? 1 : 0);
            const tt = clamp01((an - base) / Math.max(0.05, tip - base));
            const hw = 0.27 - 0.12 * tt;
            // 大陆与半岛各自按「相对宽度」排序：pM 从地图边缘的 1 降到大陆海岸的 0，pA 从半岛中脊的 1 降到半岛海岸的 0。
            // 于是任何比例下大陆条带与半岛都按同一比例变宽 / 变窄，低比例时半岛也不会先于大陆消失。
            const pM = (mEdge - an) / (mEdge + 1);
            const pA = an <= tip ? 1 - Math.abs(bn - bc) / hw : 1 - Math.hypot(an - tip, bn - bc) / (0.27 - 0.12);
            // 半岛优先（×1.45 + 0.2）：最低比例时半岛仍有可通行的宽度
            p = Math.max(pM + 0.22 * nl, pA * 1.45 + 0.2 + 0.3 * nl * (0.4 + 0.6 * tt)) + 0.06 * nm;
            // 山地以大陆内部丘陵为主，半岛上只零星分布（再叠加离岸相对深度，见 MOUNT_REL）
            m = (rg - 0.66) * 1.6 + 0.25 * smooth(-0.2, -0.75, an);
            // 半岛尖端外侧始终是海（three sides sea）；双轴对称时两条半岛之间留一道海峡
            if (mode === 'both') { if (Math.abs(an) < Math.max(0.035, 1.6 * cellMin)) fw[k] = 1; }
            else if (an > 0.93) fw[k] = 1;
            break;
          }
          case 'archipelago': {
            const wx = X + 0.05 * nl, wy = Y + 0.05 * sn(noise.fbm(X * 2.1 - 61.3, Y * 2.1 + 17.9, 3));
            const ci = Math.floor(wx / t.cw), cj = Math.floor(wy / t.ch);
            let f1 = 1e9, f2 = 1e9;
            for (let jj = cj - 2; jj <= cj + 2; jj++) for (let ii = ci - 2; ii <= ci + 2; ii++) {
              if (ii < 0 || jj < 0 || ii >= t.nx || jj >= t.ny) continue;
              const s = t.sites[jj * t.nx + ii], d = Math.hypot(wx - s.x, wy - s.y) / s.w;
              if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d;
            }
            const vor = (f2 - f1) / t.cell; // 岛心大、海峡（Voronoi 边）为 0
            // 3.25.0：岛屿优先级 = min(到海峡中线的 Voronoi 距离, 到图边的距离)。海峡与外缘海按同一族等值线
            // 一起收放：陆地少时岛屿缩回各自的岛心、四周留海（贴边的岛不再被图边切掉半个）；陆地多时海峡与外缘海
            // 一同变窄，岛与岛之间仍隔着贯通的海峡，而不是先把外缘填满、再把海峡挤没。
            // 海岸噪声在海峡中线附近减弱：窄海峡是一条连贯的水道，不会被噪声切成一串小湖、让相邻的岛从缺口处粘连。
            const edgeD = 1 - Math.max(Math.abs(l), Math.abs(u));
            const pv = vor + (0.14 * nm + 0.05 * nl) * smooth(0, 0.3, vor), pe = 2.2 * edgeD + (0.5 * nl + 0.2 * nm) * smooth(0, 0.3, edgeD);
            const hk = Math.max(0, 0.16 - Math.abs(pv - pe)) / 0.16; // 平滑取小：两族等值线交汇处圆滑过渡，不留直角
            p = Math.min(pv, pe) - hk * hk * 0.04;
            m = vor * 1.1 + 0.6 * (rg - 0.66);
            break;
          }
          case 'river': {
            const rv = t.riv;
            let q, s;
            if (fr.axis) { q = a / fr.E; s = b / fr.E; } else if (t.longAxisA) { q = u; s = l; } else { q = l; s = u; }
            const w1 = 0.06 * sn(noise.fbm(s * 1.9 + 7.3, 3.3, 3)), w2 = 0.06 * sn(noise.fbm(s * 1.9 - 5.1, 8.8, 3));
            const c1 = -0.34 + 0.085 * Math.sin(s * Math.PI * rv.f1 + rv.ph1) + w1;
            // 双轴对称时两条河互为镜像（q → −q），必须严格取 c2 = −c1，中间那块陆地才不会被折叠成梭形
            const c2 = mode === 'both' ? -c1 : 0.34 + 0.085 * Math.sin(s * Math.PI * rv.f2 + rv.ph2) + w2;
            const hwFix = Math.max(1.25 * (fr.axis ? cellQ : (t.longAxisA ? cellU : cellL)), 0.02);
            if (Math.abs(q - c1) < hwFix || Math.abs(q - c2) < hwFix) fw[k] = 1;
            // 三块陆地各自按「到河岸的相对距离」排序：任何比例下三块都按同一比例收缩，不会有哪一块先消失
            let band;
            if (q < c1) band = (c1 - q) / Math.max(0.1, c1 + 1);
            else if (q > c2) band = (q - c2) / Math.max(0.1, 1 - c2);
            else band = Math.min(q - c1, c2 - q) / Math.max(0.05, (c2 - c1) / 2);
            p = band + 0.08 * nl + 0.03 * nm;
            m = band * 0.35 + 1.4 * (rg - 0.66) + 0.1 * nm;
            break;
          }
          case 'mountain_lake': {
            // 3.25.0：陆地比例在「陆地 ↔ 中央湖」之间调节 —— 陆地少则湖大，陆地多则湖小，四周不再化为外海。
            // 优先级就是到图心的（圆→方混合）半径：湖岸是一族同心等值线，陆地最少时剩下贴图边的一圈完整陆地。
            const th = Math.atan2(u, l), rr = Math.hypot(l, u), r8 = norm8(l, u);
            const ew = smooth(0.7, 0.97, r8); // 近图边：岸线起伏与噪声逐渐消失，外圈陆地不被切断
            const ct = rr > 1e-9 ? l / rr : 1, stt = rr > 1e-9 ? u / rr : 0;
            const wob = 0.06 * sn(noise.fbm(ct * 1.4 + 70.1, stt * 1.4 - 33.3, 3));
            p = radBlend(l, u, r8) * (1 + wob * (1 - ew)) + (0.025 * nl + 0.012 * nm) * (1 - 0.85 * ew);
            if (rr < 0.085) fw[k] = 1; // 湖心：任何比例都保留
            G[k] = p;
            // 四个山口位于 45° 对角方向（对任意对称方式都自成镜像）；A 为到最近山口中线的弧长
            A[k] = Math.min(angDist(th, Math.PI / 4), angDist(th, 3 * Math.PI / 4), angDist(th, -Math.PI / 4), angDist(th, -3 * Math.PI / 4)) * rr;
            // 环形山由 categoriesFromFields 沿湖岸放置；这里只是外围平原的丘陵（受「山地」档位控制）
            m = 1.3 * (rg - 0.66) + 0.1 * nm;
            break;
          }
          case 'continent': {
            const q = pnorm(l, u, 3.2);
            const pc = -(q + 0.24 * nl + 0.06 * nm);
            // 3.25.0：内陆湖与外海一起随比例变化（陆地少时湖面变大），湖心始终保留
            let po = Infinity;
            for (const pl of t.pools) {
              const d = Math.hypot(l - pl.x, u - pl.y) * (1 + 0.25 * nm);
              if (d < pl.r * 0.8) fw[k] = 1;
              po = Math.min(po, -1.02 + 0.42 * (d / pl.r - 1));
            }
            p = Math.min(pc, po); G[k] = po;
            m = 1.7 * (rg - 0.66) + 0.25 * (0.6 - q);
            break;
          }
          case 'desert': {
            const q = pnorm(l, u, 3.0);
            const pc = -(q + 0.1 * nl + 0.03 * nm);
            // 3.25.0：绿洲湖随比例变化 —— 陆地多时只剩湖心，陆地少时湖面扩大（绿洲草环跟随湖岸，见 categoriesFromFields）
            let po = Infinity;
            for (const pl of t.pools) {
              const d = Math.hypot(l - pl.x, u - pl.y) * (1 + 0.2 * nm);
              if (d < pl.r * 0.8) fw[k] = 1;
              po = Math.min(po, -1.0 + 0.45 * (d / pl.r - 1));
            }
            p = Math.min(pc, po); G[k] = po;
            // 岩石台地：稀疏的平顶高地
            const mesa = noise.fbm(X * 4.2 + 300.5, Y * 4.2 - 120.7, 3);
            m = (mesa - 0.5) * 6 - 0.15 + 0.3 * (rg - 0.66);
            break;
          }
          case 'snowland': {
            const q = pnorm(l, u, 2.8);
            // 峡湾：噪声零值线附近的细长洼地，深深切入海岸；内陆部分成为狭长冰湖
            const fj = 1 - Math.abs(sn(noise.warpedFbm(X * 3.2 + 90.2, Y * 3.2 - 51.6, 4, 0.6)));
            const fjord = Math.pow(Math.max(0, fj - 0.9) / 0.1, 0.7);
            p = -(q + 0.14 * nl + 0.04 * nm + 0.6 * fjord * (0.3 + 0.7 * smooth(0.2, 0.8, q)));
            m = 1.6 * (rg - 0.66) + 0.3 * (0.55 - q);
            break;
          }
          case 'volcano': {
            // 3.25.0：陆地比例在「火山 ↔ 周围陆地」之间调节 —— 非陆地部分全部是火山（岩浆火口 + 熔岩流），
            // 陆地少则火口与熔岩流大，陆地多则火山小；外围是一圈完整陆地，不再临海。
            const rr = Math.hypot(l, u), th = Math.atan2(b, a), r8 = norm8(l, u);
            const ew = smooth(0.7, 0.97, r8);
            const rab = Math.hypot(a, b), ct = rab > 1e-9 ? a / rab : 1, stt = rab > 1e-9 ? b / rab : 0;
            const wob = 0.07 * sn(noise.fbm(ct * 1.5 + 21.7, stt * 1.5 - 4.9, 3));
            // 火口朝熔岩流方向鼓出成三 / 四瓣（花瓣状），整体像岩浆从火口向外漫溢，而不是一个规整的圆 / 方
            let lobe = 0; for (const f of t.flows) lobe = Math.max(lobe, smooth(0.6, 0, angDist(th, f.a)));
            const rc = radBlend(l, u, r8) * (1 + (wob - 0.12 * lobe) * (1 - ew)) + 0.012 * nm * (1 - ew); // 火口项：火口半径 = τ
            let pf = Infinity;
            const w0 = 1.1 * cellMin; // 熔岩流最窄处也至少约 2 格宽
            for (const f of t.flows) {
              const mea = f.m * 0.07 * Math.sin(rr * 9 + f.ph) * smooth(0.08, 0.3, rr);
              const d = angDist(th, f.a + mea);
              if (d >= Math.PI / 2) continue;
              // 抛物线形熔岩舌：火口岸边最宽、尖端圆钝；长度与宽度都随火口一起变化（见 flowInv）
              const pp = Math.max(0, rr * Math.sin(d) - w0);
              const R = rr * Math.cos(d) + pp * pp / 0.014;
              pf = Math.min(pf, flowInv(R));
            }
            p = Math.min(rc, pf) + 0.012 * nl * (1 - ew);
            G[k] = rc;
            let ap = 9; for (const ps of t.passes) ap = Math.min(ap, angDist(th, ps));
            A[k] = ap * rr;
            // 火山锥由 categoriesFromFields 沿火口岸线放置；这里只是外围陆地的丘陵
            m = 1.4 * (rg - 0.66) + 0.1 * nm;
            break;
          }
          case 'labyrinth': {
            const wx = px + 0.11 * t.cwPx * sn(noise.fbm(X * 3.6 + 5.5, Y * 3.6 - 8.1, 3));
            const wy = py + 0.11 * t.chPx * sn(noise.fbm(X * 3.6 - 12.3, Y * 3.6 + 2.6, 3));
            const d = mazeWallDist(t, wx, wy), cellPx = Math.min(t.cwPx, t.chPx);
            const wallHalf = Math.max(1.7 * st, 0.13 * cellPx);
            const wl = 1 - Math.min(1, d / (0.5 * cellPx));
            // 外围走廊先被水淹，迷宫核心总是完整的一块；墙体比走廊略晚淹没，低比例时迷宫轮廓依然清楚
            p = 0.2 * wl + 0.8 * (1 - pnorm(l, u, 2.6)) + 0.05 * nm + 0.04 * nl;
            // 墙芯是固定骨架；墙芯外侧一圈按「山地」档位决定是否加厚（多 → 墙更厚、走廊更窄；少 → 墙更薄）
            m = d < wallHalf ? 2 : d < wallHalf * 1.7 ? 1 - (d - wallHalf) / (wallHalf * 0.7) * 0.5 : -1;
            break;
          }
          case 'two_sides': {
            // 3.25.0：陆地比例在「两岸陆地 ↔ 中央水道」之间调节 —— 陆地少则水道宽，陆地多则水道窄；两岸一直延伸到图边。
            let q, s;
            if (fr.axis) { q = b / fr.E; s = a / fr.E; } else if (t.longAxisA) { q = l; s = u; } else { q = u; s = l; }
            const cc = (fr.axis || mode === 'both') ? 0 : 0.022 * Math.sin(s * Math.PI * 1.3 + t.ph) + 0.018 * sn(noise.fbm(s * 2.3 + 17.1, 4.4, 3));
            const across = fr.axis ? cellQ : (t.longAxisA ? cellL : cellU), along = fr.axis ? cellQ : (t.longAxisA ? cellU : cellL);
            const hwc = Math.max(1.7 * across, 0.026 + 0.005 * sn(noise.fbm(s * 3.1 - 2.2, 9.9, 3)));
            const dq = Math.abs(q - cc), side = q >= cc ? 1 : -1;
            const qe = smooth(0.8, 0.98, dq); // 靠近图边：岸线起伏逐渐消失，陆地很少时两岸仍是完整的一条
            // 两岸岸线各自起伏（按到水道中线的相对距离缩放），水道宽窄变化时岸线形状同比例保持
            const wob = 0.28 * sn(noise.fbm(s * 2.2 + 31.3 * side, 5.5 + side, 3));
            const nat = dq * (1 + wob * (1 - qe)) + (0.05 * nl + 0.015 * nm) * (1 - qe);
            const hwb = Math.max(1.5 * along, 0.032);
            let ci = -1;
            for (let i = 0; i < t.cross.length; i++) if (Math.abs(s - t.cross[i]) < hwb) { ci = i; break; }
            if (ci >= 0) {
              // 渡口：中间一条任何比例都保留（两岸始终相通）；两侧的渡口在水道很宽（陆地 ≲ 40%）时被淹没，
              // 从中段先断开、留下两岸的栈桥 —— 否则陆地很少时三条长堤会吃掉大部分陆地配额
              tag[k] = TAG.CROSSING; G[k] = nat;
              p = ci === 1 ? 3 : Math.max(nat, 0.6 + 0.004 * dq);
            } else {
              p = nat;
              if (dq < hwc) fw[k] = 1;
            }
            m = 1.5 * (rg - 0.66) + 0.12 * (1 - qe);
            break;
          }
          default: p = -Math.hypot(l, u) + 0.1 * nl;
        }
        P[k] = p; M[k] = m;
      }
    }
    return { P, M, B, G, A, fw, lava, tag, cell: cellMin };
  }

  /** 精确选格：在可选格（非结构水域、非岩浆）中按 P 从高到低取 targetN 格（镜像时按轨道大小加权）。
   *  用 65536 桶直方图定位分界，桶内再排序，O(N)，2000×2000 也很快。返回 {chosen, tau}。 */
  function selectLand(P, elig, n, targetN, src) {
    const chosen = new Uint8Array(n);
    const wgt = new Uint8Array(n);
    for (let k = 0; k < n; k++) wgt[src ? src(k) : k]++;
    let lo = Infinity, hi = -Infinity, total = 0;
    for (let k = 0; k < n; k++) if (wgt[k] && elig[k]) { const v = P[k]; if (v < lo) lo = v; if (v > hi) hi = v; total += wgt[k]; }
    if (!total) return { chosen, tau: Infinity };
    if (targetN >= total) { for (let k = 0; k < n; k++) if (elig[k]) chosen[k] = 1; return { chosen, tau: -Infinity }; }
    if (targetN <= 0) return { chosen, tau: Infinity };
    const BINS = 65536, span = Math.max(1e-9, hi - lo), hist = new Float64Array(BINS);
    const binOf = v => Math.min(BINS - 1, ((v - lo) / span * BINS) | 0);
    for (let k = 0; k < n; k++) if (wgt[k] && elig[k]) hist[binOf(P[k])] += wgt[k];
    let acc = 0, bin = BINS - 1;
    for (; bin >= 0; bin--) { if (acc + hist[bin] >= targetN) break; acc += hist[bin]; }
    const edge = [];
    for (let k = 0; k < n; k++) {
      if (!wgt[k] || !elig[k]) continue;
      const bb = binOf(P[k]);
      if (bb > bin) chosen[k] = 1; else if (bb === bin) edge.push(k);
    }
    edge.sort((x, y) => P[y] - P[x] || x - y);
    let tau = lo + (bin + 0.5) / BINS * span;
    for (const k of edge) {
      if (acc >= targetN) break;
      // 镜像轨道最多 4 格：取「加入后误差更小」的一侧
      if (acc + wgt[k] - targetN > targetN - acc) break;
      chosen[k] = 1; acc += wgt[k]; tau = P[k];
    }
    if (src) for (let k = 0; k < n; k++) { const c = src(k); if (c !== k) chosen[k] = chosen[c]; }
    return { chosen, tau };
  }

  /** 各模板的海岸材质 */
  function beachType(shape) {
    if (shape === 'snowland') return T.ICE;
    if (shape === 'volcano') return T.STONE;
    return T.SAND;
  }
  /** 低地纹理调色板：v 为相干噪声值（0～1，均值≈0.5、σ≈0.09），阈值按分位点取，避免整片同色 */
  function lowlandType(shape, v, tg) {
    if (shape === 'desert') return tg === TAG.OASIS ? (v < 0.5 ? T.SHORT_GRASS : T.LONG_GRASS) : v < 0.585 ? T.SAND : v < 0.635 ? T.DIRT : T.STONE;
    if (shape === 'snowland') return v < 0.53 ? T.SNOW : v < 0.6 ? T.ICE : T.STONE;
    if (shape === 'volcano') return tg === TAG.ASH ? (v < 0.47 ? T.STONE : T.DIRT) : v < 0.47 ? T.LONG_GRASS : v < 0.55 ? T.SHORT_GRASS : v < 0.61 ? T.DIRT : T.STONE;
    return v < 0.45 ? T.SHORT_GRASS : v < 0.55 ? T.LONG_GRASS : v < 0.615 ? T.DIRT : T.STONE;
  }
  /** 「多」/「标准」/「少」山地 → 山地强度阈值 */
  /** 山地的「离岸相对深度」权重：岛屿的山地应始终位于岛心，与岛的大小无关 */
  const MOUNT_REL = { island: 1.3, peninsula: 0.35, continent: 0.35, snowland: 0.3 };
  const MOUNT_THR = { island: 0.32, peninsula: 0.62, archipelago: 0.9, river: 0.72, mountain_lake: 0.2, continent: 0.32, desert: 0.62, snowland: 0.16, volcano: 0.45, labyrinth: 0.72, two_sides: 0.42 };

  /**
   * 由模板场得到最终地形类别（已镜像）。
   * @param F 模板场；targetLand 目标陆地比例；src 对称源函数
   */
  function categoriesFromFields(F, shape, gw, gh, st, rough, targetLand, src) {
    const n = gw * gh, { P, M, B, G, A, fw, lava, tag } = F;
    const elig = new Uint8Array(n);
    for (let k = 0; k < n; k++) elig[k] = fw[k] || lava[k] ? 0 : 1;
    const targetN = Math.round(clamp01(targetLand) * n);
    const { chosen, tau } = selectLand(P, elig, n, targetN, src);
    // 抹掉完全孤立的单格陆地 / 单格水坑（4 邻域），海岸线更干净
    {
      const fix = [];
      for (let y = 1; y < gh - 1; y++) for (let x = 1; x < gw - 1; x++) {
        const k = y * gw + x;
        if (!elig[k]) continue;
        const c = chosen[k - 1] + chosen[k + 1] + chosen[k - gw] + chosen[k + gw];
        if (chosen[k] ? c === 0 : c === 4) fix.push(k);
      }
      for (const k of fix) chosen[k] ^= 1;
      if (src) for (let k = 0; k < n; k++) { const c = src(k); if (c !== k) chosen[k] = chosen[c]; }
    }
    // 3.25.0：火山模板的非陆地部分就是火山本身（岩浆火口 + 熔岩流），不再有外海
    const cats = new Uint8Array(n), hole = shape === 'volcano' ? T.LAVA : T.WATER;
    for (let k = 0; k < n; k++) cats[k] = lava[k] ? T.LAVA : chosen[k] ? T.SAND : hole;
    // 离岸距离（格）：到最近的水 / 岩浆
    const landMask = new Uint8Array(n);
    for (let k = 0; k < n; k++) landMask[k] = cats[k] === T.SAND ? 1 : 0;
    const toWater = chamferDistance(landMask, gw, gh, 0);
    let maxD = 1;
    for (let k = 0; k < n; k++) if (landMask[k] && toWater[k] > maxD && toWater[k] < 30000) maxD = toWater[k];
    const rel = MOUNT_REL[shape] || 0;
    const thr = (MOUNT_THR[shape] ?? 0.6) + (clamp01(rough) - 0.3) * 0.3;
    const mountDepth = Math.max(2, 3 / st);  // 普通山地至少离岸 2 格（按预览步长折算，至少 2 格）
    const wob = new PermNoise((F.seed ^ 0x7f4a7c15) >>> 0);
    const beachCells = shape === 'snowland' ? 2.4 : shape === 'labyrinth' ? 1.2 : shape === 'archipelago' ? 1.5 : 1.9;
    // 沿岸骨架（3.25.0）：山湖的环形山 / 火山的火山锥按「到水体岸线的距离」G − τ 放置，随中央湖 / 火口一起缩放。
    // band 为岸线到图边的带宽（归一化），山环宽度与岸边留白按带宽同比变化，并有以格计的下限；带宽不够时不放山环。
    const rc = RING[shape], cell = F.cell || 0.02;
    let g0 = 0, g1 = 0, gHill = 0, gAsh = 0, passHalf = 0, ringOK = false;
    if (rc) {
      const band = Math.max(cell, 1 - tau);
      g0 = Math.max(rc.g0c * cell, rc.g0 * band); g1 = g0 + Math.max(rc.wc * cell, rc.w * band);
      ringOK = g1 + 1.5 * cell <= band;
      gHill = g1 + Math.max(2 * cell, rc.hill * band);
      gAsh = g1 + (rc.ash || 0) * band;
      passHalf = Math.max(rc.pc * cell, rc.p);
    }
    const oasisBand = shape === 'desert' ? 0.4 : 0;
    for (let k = 0; k < n; k++) {
      if (cats[k] !== T.SAND) continue;
      const c = src ? src(k) : k, cx = c % gw, cy = (c / gw) | 0;
      const d = toWater[k] / 3;
      let tg = tag[k], mk = M[k];
      if (rc) {
        const rl = G[k] - tau;
        if (ringOK && rl >= g0 && rl < g1) mk = A[k] < passHalf ? -1 : 2;
        else if (rl < gHill) mk = -1; // 岸边与山环内外侧不长零散丘陵，山环轮廓清楚
        if (rc.ash && rl < gAsh) tg = TAG.ASH;
      }
      if (tg === TAG.CROSSING && G[k] >= tau) tg = TAG.NONE; // 渡口落在岸上的部分按普通陆地处理
      if (oasisBand && G[k] - tau < oasisBand) tg = TAG.OASIS; // 绿洲草环跟随湖岸
      const m = mk >= 2 ? mk : mk + rel * (Math.min(toWater[k], maxD) / maxD - 0.5);
      if (m >= 2 || (m > thr && d >= mountDepth)) { cats[k] = T.MOUNTAIN; continue; }
      if (tg === TAG.CROSSING) { cats[k] = T.SAND; continue; }
      const jitter = (wob.fbm(cx * st * 0.08 + 1.3, cy * st * 0.08 - 2.1, 2) - 0.5) * 0.9;
      if (d <= beachCells + jitter) { cats[k] = tg === TAG.OASIS ? T.LONG_GRASS : beachType(shape); continue; }
      cats[k] = lowlandType(shape, B[k], tg);
    }
    if (src) for (let k = 0; k < n; k++) { const c = src(k); if (c !== k) cats[k] = cats[c]; }
    return { cats: shallowShore(cats, gw, gh), tau };
  }

  /** 与特定陆地 4 邻接的水 → 浅水（仅影响预览配色） */
  const SHORE_LAND = new Set([T.SAND, T.LONG_GRASS, T.SHORT_GRASS, T.DIRT, T.SNOW, T.ICE, T.STONE]);
  function shallowShore(src, w, h) {
    const out = src.slice();
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const k = y * w + x;
      if (src[k] !== T.WATER && src[k] !== T.DEEP) continue;
      if (SHORE_LAND.has(src[k - 1]) || SHORE_LAND.has(src[k + 1]) || SHORE_LAND.has(src[k - w]) || SHORE_LAND.has(src[k + w])) out[k] = T.SHALLOW;
    }
    return out;
  }

  /** 计算整图模板场（对称时只算源半区，再镜像） */
  function computeFields(o, src, mode, need, prog) {
    const W = o.width | 0, H = o.height | 0, st = Math.max(1, Math.floor(o.stride || 1));
    const gw = Math.ceil(W / st), gh = Math.ceil(H / st), n = gw * gh;
    const shape = SHAPE_MAP.has(o.shape) ? o.shape : 'island';
    const seed = normSeed(o.seed ?? 42);
    const F = templateFields(shape, W, H, st, gw, gh, seed, mode, need, prog);
    if (src) for (const arr of [F.P, F.M, F.B, F.G, F.A, F.fw, F.lava, F.tag]) mirrorArray(arr, src);
    F.seed = seed; F.shape = shape; F.gw = gw; F.gh = gh; F.st = st; F.n = n;
    return F;
  }

  /**
   * 生成逻辑地形类别（不含可对战化后处理，不镜像）。
   * @param {{shape:string,width:number,height:number,seed?:number,land?:number,rough?:number,stride?:number}} o
   *   stride>1 时按步长在完整地图坐标上采样，输出尺寸为 ceil(width/stride)×ceil(height/stride)
   * @returns {Uint8Array} 取值见 T
   */
  function generateCategories(o) {
    o = { ...o, land: unit(o.land, 0.5), rough: unit(o.rough, 0.3) };
    const F = computeFields(o, null, 'none', null, null);
    return categoriesFromFields(F, F.shape, F.gw, F.gh, F.st, o.rough ?? 0.3, o.land ?? 0.5, null).cats;
  }

  /* ================================================================ 第二部分：可对战化后处理
   * 模板逻辑地形直接交给本项目的引擎会有几个问题：
   *   ① 不对称 —— 竞技地图一般要求镜像对称，出生点 / 资源的镜像也依赖地形对称；
   *   ② 碎岛、单格水坑、1～2 格宽的山体会被引擎渲染成破碎的悬崖；
   *   ③ 山地在本引擎里是「带悬崖的高地」，没有坡道时高地上的出生点 / 资源会被困死；
   *   ④ 被水隔开的大块陆地地面部队无法交战；山脉还可能把一片空地围死。
   * 这里逐项处理。所有修改都写入「对称源半区」再整体镜像，保证结果严格对称。 */
  const VIEW = Object.assign({ FORD: 13, RAMP: 14 }, T);


  /* ================================ 距离场与镜像工具 */
  function chamferDistance(mask, w, h, target) {
    const n = w * h, INF = 30000, d = new Int16Array(n);
    for (let k = 0; k < n; k++) d[k] = mask[k] === target ? 0 : INF;
    // 3/4 chamfer 距离：比逐格搜索快很多，2000×2000 大地图仍为 O(N)。
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const k = y * w + x; let v = d[k];
      if (x > 0) v = Math.min(v, d[k - 1] + 3);
      if (y > 0) {
        v = Math.min(v, d[k - w] + 3);
        if (x > 0) v = Math.min(v, d[k - w - 1] + 4);
        if (x + 1 < w) v = Math.min(v, d[k - w + 1] + 4);
      }
      d[k] = v;
    }
    for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) {
      const k = y * w + x; let v = d[k];
      if (x + 1 < w) v = Math.min(v, d[k + 1] + 3);
      if (y + 1 < h) {
        v = Math.min(v, d[k + w] + 3);
        if (x > 0) v = Math.min(v, d[k + w - 1] + 4);
        if (x + 1 < w) v = Math.min(v, d[k + w + 1] + 4);
      }
      d[k] = v;
    }
    return d;
  }

  function hashCell(k, seed) {
    let x = (k ^ Math.imul(seed | 0, 0x9e3779b1)) | 0;
    x ^= x >>> 16; x = Math.imul(x, 0x7feb352d);
    x ^= x >>> 15; x = Math.imul(x, 0x846ca68b); x ^= x >>> 16;
    return x >>> 0;
  }

  function mirrorArray(arr, source) {
    if (!source) return arr;
    for (let k = 0; k < arr.length; k++) { const s = source(k); if (s !== k) arr[k] = arr[s]; }
    return arr;
  }


  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  /** 对称模式 → 「每格的对称源格」函数；不对称或不适用（对角线需宽高相等）时返回 null */
  function mirrorSource(mode, w, h) {
    switch (mode) {
      case 'horizontal': return k => { const r = (k / w) | 0, c = k - r * w; return r > h - 1 - r ? (h - 1 - r) * w + c : k; };
      case 'vertical': return k => { const r = (k / w) | 0, c = k - r * w; return c > w - 1 - c ? r * w + (w - 1 - c) : k; };
      case 'both': return k => { const r = (k / w) | 0, c = k - r * w; return Math.min(r, h - 1 - r) * w + Math.min(c, w - 1 - c); };
      case 'diagonal1': if (w !== h) return null; return k => { const r = (k / w) | 0, c = k - r * w; return c < r ? c * w + r : k; };
      case 'diagonal2': if (w !== h) return null; return k => { const r = (k / w) | 0, c = k - r * w; return r + c > w - 1 ? (w - 1 - c) * w + (w - 1 - r) : k; };
      default: return null;
    }
  }
  /** 连通块标记。pred(k) 为真的格参与；conn8 为真用 8 邻接。返回 {label, sizes, border}（label 从 1 开始，0 = 不参与） */
  function label(pred, w, h, conn8) {
    const n = w * h, lab = new Int32Array(n), sizes = [0], border = [false], stack = new Int32Array(n);
    // 先把谓词求值成掩码：泛洪时每格最多被 8 个邻居访问，直接调用闭包会重复求值 8 次
    const m = new Uint8Array(n);
    for (let k = 0; k < n; k++) m[k] = pred(k) ? 1 : 0;
    let id = 0;
    for (let s = 0; s < n; s++) {
      if (lab[s] || !m[s]) continue;
      id++; let top = 0, size = 0, onB = false;
      stack[top++] = s; lab[s] = id;
      while (top) {
        const k = stack[--top]; size++;
        const r = (k / w) | 0, c = k - r * w;
        const up = r > 0, dn = r < h - 1, lf = c > 0, rt = c < w - 1;
        if (!up || !dn || !lf || !rt) onB = true;
        if (up) { const q = k - w; if (!lab[q] && m[q]) { lab[q] = id; stack[top++] = q; } }
        if (dn) { const q = k + w; if (!lab[q] && m[q]) { lab[q] = id; stack[top++] = q; } }
        if (lf) { const q = k - 1; if (!lab[q] && m[q]) { lab[q] = id; stack[top++] = q; } }
        if (rt) { const q = k + 1; if (!lab[q] && m[q]) { lab[q] = id; stack[top++] = q; } }
        if (conn8) {
          if (up && lf) { const q = k - w - 1; if (!lab[q] && m[q]) { lab[q] = id; stack[top++] = q; } }
          if (up && rt) { const q = k - w + 1; if (!lab[q] && m[q]) { lab[q] = id; stack[top++] = q; } }
          if (dn && lf) { const q = k + w - 1; if (!lab[q] && m[q]) { lab[q] = id; stack[top++] = q; } }
          if (dn && rt) { const q = k + w + 1; if (!lab[q] && m[q]) { lab[q] = id; stack[top++] = q; } }
        }
      }
      sizes.push(size); border.push(onB);
    }
    return { label: lab, sizes, border };
  }
  /** 多源 BFS（4 邻接）：从 starts 出发，只走 pass(k) 为真的格，遇到 goal(k) 停止；返回路径（含首尾）或 null。
   *  buf 为可复用缓冲（大地图上会执行上百次，避免每次分配 3 个整图数组） */
  function makeBfsBuf(n) { return { prev: new Int32Array(n), dist: new Int32Array(n), stamp: new Int32Array(n), q: new Int32Array(n), cur: 0 }; }
  function bfsPath(buf, starts, pass, goal, w, h, maxLen) {
    const { prev, dist, stamp, q } = buf;
    const cur = ++buf.cur;
    let head = 0, tail = 0;
    for (const s of starts) { if (stamp[s] === cur) continue; stamp[s] = cur; prev[s] = -1; dist[s] = 0; q[tail++] = s; }
    while (head < tail) {
      const k = q[head++];
      if (dist[k] >= maxLen) continue;
      const r = (k / w) | 0, c = k - r * w;
      for (let d = 0; d < 4; d++) {
        const p = d === 0 ? (r > 0 ? k - w : -1) : d === 1 ? (r < h - 1 ? k + w : -1) : d === 2 ? (c > 0 ? k - 1 : -1) : (c < w - 1 ? k + 1 : -1);
        if (p < 0 || stamp[p] === cur) continue;
        stamp[p] = cur;
        if (goal(p)) {
          const path = [p]; let x = k;
          while (x !== -1) { path.push(x); x = prev[x]; }
          return path;
        }
        if (!pass(p)) continue;
        prev[p] = k; dist[p] = dist[k] + 1; q[tail++] = p;
      }
    }
    return null;
  }
  /** 按连通块编号分组（计数排序），返回 id → 格子列表 */
  function groupCells(lab, count) {
    const n = lab.length, start = new Int32Array(count + 2);
    for (let k = 0; k < n; k++) if (lab[k]) start[lab[k] + 1]++;
    for (let i = 1; i < start.length; i++) start[i] += start[i - 1];
    const pos = start.slice(), cells = new Int32Array(start[count + 1]);
    for (let k = 0; k < n; k++) if (lab[k]) cells[pos[lab[k]]++] = k;
    return id => cells.subarray(start[id], start[id + 1]);
  }

  /**
   * 完整流程：模板场 → 精确比例选格 → 对称 → 清理 → 浅滩 → 高地整形 → 坡道 / 凿通道 → 引擎矩阵。
   * prepareShape() 计算与比例无关的模板场（最耗时，只算一次）；finishShape() 按目标比例选格并做后处理，
   * build() 可在同一组模板场上多次 finishShape() 以抵消后处理对比例的影响。
   * @returns {{width,height,data:Int32Array,view:Uint8Array,stats:object}}
   *   data：交给引擎 set_coastline_from_image（0 水 / 1 平地 / 2 高地 / -2 高地坡道）
   *   view：预览用类别（T 的取值 + FORD 浅滩 + RAMP 坡道）
   */
  const FIELD_CACHE_MAX = 160000, fieldCache = { key: '', F: null };
  function prepareShape(o) {
    const st = Math.max(1, Math.floor(o.stride || 1));
    const w = Math.ceil((o.width | 0) / st), h = Math.ceil((o.height | 0) / st), n = w * h;
    const meta = SHAPE_MAP.get(o.shape) || SHAPES[0];
    const seed = normSeed(o.seed ?? 42);
    const src = mirrorSource(o.mirror || 'none', w, h);
    const prog = typeof o.onProgress === 'function' ? o.onProgress : null;
    // 对称时模板场只需计算「对称源半区」（场是逐格独立的），其余格由镜像填充 —— 单轴省一半，双轴省 3/4。
    const mode = src ? o.mirror : 'none', Mg = 1;
    const need = mode === 'vertical' ? (x, y) => x <= (w - 1) / 2 + Mg
      : mode === 'horizontal' ? (x, y) => y <= (h - 1) / 2 + Mg
      : mode === 'both' ? (x, y) => x <= (w - 1) / 2 + Mg && y <= (h - 1) / 2 + Mg
      : mode === 'diagonal1' ? (x, y) => x >= y - Mg
      : mode === 'diagonal2' ? (x, y) => x + y <= w - 1 + Mg : null;
    // 模板场与陆地比例 / 山地多少无关：预览尺寸（≤ 16 万格）缓存最近一组，拖动「陆地比例」滑块时只需重新选格，几乎即时。
    // 大地图不缓存（2000×2000 的场约 60 MB，常驻 Worker 不划算）。
    const key = `${meta.id}|${o.width | 0}|${o.height | 0}|${st}|${seed}|${mode}`;
    let F = n <= FIELD_CACHE_MAX && fieldCache.key === key ? fieldCache.F : null;
    if (!F) {
      F = computeFields({ ...o, shape: meta.id, seed, stride: st }, src, mode, need, prog && (f => prog('terrain', f)));
      if (n <= FIELD_CACHE_MAX) { fieldCache.key = key; fieldCache.F = F; }
    }
    return { st, w, h, n, meta, seed, src, mode, F, rough: clamp01(o.rough ?? 0.3), prog };
  }

  function finishShape(pr, targetLand) {
    const { st, w, h, n, meta, seed, src, F, rough, prog } = pr;
    const rng = mulberry32(seed ^ 0x5bd1e995);
    prog && prog('shape', 0);
    const cf = categoriesFromFields(F, meta.id, w, h, st, rough, targetLand, src), cats = cf.cats;
    const sym = !!src;
    const canon = k => !src || src(k) === k;
    const mirror = arr => { if (src) for (let k = 0; k < n; k++) { const s = src(k); if (s !== k) arr[k] = arr[s]; } };
    const put = (arr, k, v) => { arr[src ? src(k) : k] = v; };
    const area = n;
    const stats = { shape: meta.id, seed, mirror: sym ? pr.mode : 'none', islandsRemoved: 0, lakesFilled: 0, fords: 0, plateaus: 0, ramps: 0, channels: 0, connected: true };

    const buf = makeBfsBuf(n);
    const land = new Uint8Array(n), mount = new Uint8Array(n), gap = new Uint8Array(n), ford = new Uint8Array(n);
    for (let k = 0; k < n; k++) {
      const t = cats[k];
      land[k] = isWaterT(t) || t === T.LAVA ? 0 : 1;
      mount[k] = t === T.MOUNTAIN ? 1 : 0;
    }

    /* ① 碎岛 / 小水坑 */
    const minIsland = meta.id === 'archipelago' ? Math.max(9, Math.round(area * 0.0003)) : Math.max(16, Math.round(area * 0.0012)), minLake = Math.max(12, Math.round(area * 0.0008));
    {
      const L = label(k => land[k] === 1, w, h, false);
      for (let k = 0; k < n; k++) if (L.label[k] && L.sizes[L.label[k]] < minIsland) { land[k] = 0; mount[k] = 0; }
      stats.islandsRemoved = L.sizes.filter((s, i) => i && s < minIsland).length;
      const W = label(k => land[k] === 0, w, h, false);
      for (let k = 0; k < n; k++) { const id = W.label[k]; if (id && !W.border[id] && W.sizes[id] < minLake) land[k] = 1; }
      stats.lakesFilled = W.sizes.filter((s, i) => i && !W.border[i] && s < minLake).length;
    }

    /* ② 浅滩：把被水隔开的大块陆地连起来（群岛 / 岛屿保留海战特色；双河靠河流分隔三块陆地，都不连） */
    if (meta.bridge) {
      const maxGap = Math.max(10, Math.round(Math.min(w, h) * 0.14));
      const links = 1;
      for (let iter = 0; iter < 10; iter++) {
        const L = label(k => land[k] === 1, w, h, false);
        let landTotal = 0; for (let i = 1; i < L.sizes.length; i++) landTotal += L.sizes[i];
        const bigMin = Math.max(60, landTotal * 0.04);
        let main = 0; for (let i = 1; i < L.sizes.length; i++) if (!main || L.sizes[i] > L.sizes[main]) main = i;
        const others = new Set(); for (let i = 1; i < L.sizes.length; i++) if (i !== main && L.sizes[i] >= bigMin) others.add(i);
        if (!others.size) break;
        // 起点：主陆地中与水相邻的格
        const starts = [];
        for (let k = 0; k < n; k++) {
          if (L.label[k] !== main) continue;
          const r = (k / w) | 0, c = k - r * w;
          if ((r > 0 && !land[k - w]) || (r < h - 1 && !land[k + w]) || (c > 0 && !land[k - 1]) || (c < w - 1 && !land[k + 1])) starts.push(k);
        }
        let carved = false, firstAt = -1;
        for (let li = 0; li < links; li++) {
          const st = firstAt < 0 ? starts : starts.filter(k => Math.abs((k % w) - (firstAt % w)) > w * 0.3);
          if (!st.length) break;
          const path = bfsPath(buf, st, k => !land[k], k => others.has(L.label[k]), w, h, maxGap);
          if (!path) break;
          for (const k of path) {
            const r = (k / w) | 0, c = k - r * w;
            for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
              const rr = r + dr, cc = c + dc; if (rr < 0 || cc < 0 || rr >= h || cc >= w) continue;
              const q = rr * w + cc;
              if (!land[q]) { put(land, q, 1); put(ford, q, 1); }
            }
          }
          mirror(land); mirror(ford);
          stats.fords++; carved = true;
          if (firstAt < 0) firstAt = path[path.length - 1];
          if (iter > 0 && li === 0) { /* 后续轮次只为新连通的块各开一处 */ break; }
        }
        if (!carved) { stats.connected = false; break; }
      }
    }

    /* ③ 高地整形：开运算去掉 <3 格宽的山体，再去掉过小的高地 */
    for (let k = 0; k < n; k++) if (!land[k]) mount[k] = 0;
    {
      const ero = new Uint8Array(n);
      for (let r = 1; r < h - 1; r++) for (let c = 1; c < w - 1; c++) {
        const k = r * w + c; if (!mount[k]) continue;
        let all = 1;
        for (let dr = -1; dr <= 1 && all; dr++) for (let dc = -1; dc <= 1; dc++) if (!mount[k + dr * w + dc]) { all = 0; break; }
        ero[k] = all;
      }
      for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
        const k = r * w + c; if (!land[k]) { mount[k] = 0; continue; }
        let any = 0;
        for (let dr = -1; dr <= 1 && !any; dr++) for (let dc = -1; dc <= 1; dc++) {
          const rr = r + dr, cc = c + dc;
          if (rr >= 0 && cc >= 0 && rr < h && cc < w && ero[rr * w + cc]) { any = 1; break; }
        }
        mount[k] = any;
      }
      const minPlateau = Math.max(20, Math.round(area * 0.0006));
      const P = label(k => mount[k] === 1, w, h, true);
      for (let k = 0; k < n; k++) if (P.label[k] && P.sizes[P.label[k]] < minPlateau) mount[k] = 0;
      mirror(mount);
    }

    /* ④ 坡道 + 凿通道，迭代直到稳定 */
    const isWall = k => {
      if (!mount[k] || gap[k]) return false;
      const r = (k / w) | 0, c = k - r * w;
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        const rr = r + dr, cc = c + dc;
        if (rr < 0 || cc < 0 || rr >= h || cc >= w) continue; // 与引擎一致：地图边缘不算墙
        if (!mount[rr * w + cc]) return true;
      }
      return false;
    };
    const cx = (w - 1) / 2, cy = (h - 1) / 2;
    for (let pass = 0; pass < 12; pass++) {
      prog && prog('shape', 0.3 + pass * 0.05);
      let changed = false;
      // 坡道
      const P = label(k => mount[k] === 1, w, h, true);
      const comps = new Map();
      for (let k = 0; k < n; k++) {
        const id = P.label[k]; if (!id) continue;
        let e = comps.get(id); if (!e) comps.set(id, e = { size: 0, interior: 0, hasGap: false, hasCanon: false, cand: [] });
        e.size++; if (gap[k]) e.hasGap = true; if (canon(k)) e.hasCanon = true;
        const r = (k / w) | 0, c = k - r * w;
        let inner = true, edgeFlat = false;
        for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
          if (!dr && !dc) continue;
          const rr = r + dr, cc = c + dc;
          if (rr < 0 || cc < 0 || rr >= h || cc >= w) continue;
          const q = rr * w + cc;
          if (!mount[q]) { inner = false; if ((!dr || !dc) && land[q]) edgeFlat = true; }
        }
        if (inner) e.interior++;
        if (edgeFlat && r > 2 && c > 2 && r < h - 3 && c < w - 3) e.cand.push(k);
      }
      for (const e of comps.values()) {
        if (e.hasGap || !e.hasCanon || e.interior < 6 || !e.cand.length) continue;
        const want = 1 + (e.size > 900 ? 1 : 0) + (e.size > 2600 ? 1 : 0);
        const pool = e.cand.some(canon) ? e.cand.filter(canon) : e.cand;
        const scored = pool.map(k => {
          const r = (k / w) | 0, c = k - r * w;
          return { k, r, c, s: Math.hypot((r - cy) / h, (c - cx) / w) + rng() * 0.35 };
        }).sort((a, b) => a.s - b.s);
        const minSep = Math.min(Math.max(8, Math.sqrt(e.size) * 0.6), Math.max(w, h) * 0.22), picks = [];
        for (const p of scored) {
          if (picks.length >= want) break;
          if (picks.some(q => Math.hypot(q.r - p.r, q.c - p.c) < minSep)) continue;
          picks.push(p);
        }
        for (const p of picks) {
          for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) {
            const rr = p.r + dr, cc = p.c + dc;
            if (rr < 0 || cc < 0 || rr >= h || cc >= w) continue;
            const q = rr * w + cc; if (mount[q]) put(gap, q, 1);
          }
          stats.ramps++;
        }
        if (picks.length) changed = true;
      }
      mirror(gap);
      // 凿通道：同一块陆地内，被高地悬崖围死的区域与主区域打通。通道做成「坡道格」（不画悬崖、可通行），
      // 而不是把山削平 —— 削平会改变高地形状、产生新的墙线和新的封闭区，导致迭代难以收敛
      const Lnd = label(k => land[k] === 1, w, h, false);
      const Wk = label(k => land[k] === 1 && !isWall(k), w, h, false);
      const best = new Map(); // 陆地块 → 最大可行走块
      for (let k = 0; k < n; k++) {
        const a = Wk.label[k]; if (!a) continue;
        const L = Lnd.label[k], b = best.get(L);
        if (b === undefined || Wk.sizes[a] > Wk.sizes[b]) best.set(L, a);
      }
      const mains = new Set(best.values()), cellsOf = groupCells(Wk.label, Wk.sizes.length - 1);
      for (let a = 1; a < Wk.sizes.length; a++) {
        if (mains.has(a) || Wk.sizes[a] < 9) continue; // 主区域 / 极小缝隙不处理
        const cells = cellsOf(a);
        let anyCanon = false; for (let i = 0; i < cells.length && !anyCanon; i++) anyCanon = canon(cells[i]);
        if (!anyCanon) continue;
        // 只需打通到「任意其他可行走区域」：逐轮合并，最终全部连到主区域；提前结束让每次搜索都很短
        const path = bfsPath(buf, cells, q => land[q] === 1, q => Wk.label[q] !== 0 && Wk.label[q] !== a, w, h, Math.max(w, h));
        if (!path) continue;
        for (const q of path) {
          const r = (q / w) | 0, c = q - r * w;
          for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
            const rr = r + dr, cc = c + dc; if (rr < 0 || cc < 0 || rr >= h || cc >= w) continue;
            const z = rr * w + cc; if (mount[z]) put(gap, z, 1);
          }
        }
        stats.channels++; changed = true;
      }
      mirror(mount); mirror(gap);
      for (let k = 0; k < n; k++) if (!mount[k]) gap[k] = 0;
      if (!changed) break;
    }
    // 凿通道后可能残留过小的高地碎片
    {
      const P = label(k => mount[k] === 1, w, h, true);
      for (let k = 0; k < n; k++) if (P.label[k] && P.sizes[P.label[k]] < 12) { mount[k] = 0; gap[k] = 0; }
      stats.plateaus = P.sizes.filter((s, i) => i && s >= 12).length;
    }

    /* ⑤ 输出 */
    const data = new Int32Array(n), view = new Uint8Array(n), lavaWorld = meta.id === 'volcano';
    let landN = 0, mountN = 0;
    for (let k = 0; k < n; k++) {
      const t = cats[k];
      if (!land[k]) { data[k] = 0; view[k] = t === T.LAVA || lavaWorld ? T.LAVA : t === T.SHALLOW ? T.SHALLOW : isWaterT(t) ? T.WATER : T.SHALLOW; continue; }
      landN++;
      if (mount[k]) { mountN++; data[k] = gap[k] ? -2 : 2; view[k] = gap[k] ? VIEW.RAMP : T.MOUNTAIN; continue; }
      data[k] = 1;
      view[k] = ford[k] ? VIEW.FORD : (isWaterT(t) || t === T.LAVA) ? T.SAND : t === T.MOUNTAIN ? T.STONE : t;
    }
    // 最终连通性（陆地内部）
    const Lf = label(k => land[k] === 1, w, h, false);
    const Wf = label(k => land[k] === 1 && !isWall(k), w, h, false);
    const perLand = new Map();
    for (let k = 0; k < n; k++) { const a = Wf.label[k]; if (a && Wf.sizes[a] >= 9) { const L = Lf.label[k]; (perLand.get(L) || perLand.set(L, new Set()).get(L)).add(a); } }
    stats.sealedPockets = [...perLand.values()].reduce((s, v) => s + v.size - 1, 0);
    stats.landRatio = +(landN / n).toFixed(3);
    stats.level = Number.isFinite(cf.tau) ? +cf.tau.toFixed(4) : null; // 选格分界（陆地优先级等值线），供回归测试检查水体随比例单调变化
    stats.mountainRatio = +(mountN / n).toFixed(3);
    stats.landmasses = Lf.sizes.filter((s, i) => i && s >= minIsland).length;
    return { width: w, height: h, data, view, stats };
  }

  /**
   * 对外生成入口：模板场只算一次；后处理（碎岛清理 / 填小湖 / 连通浅滩）会让陆地占比略有偏差，
   * 偏差超过 0.6% 时把偏差反馈给选格目标再做一次后处理（最多 3 次，取最接近的一次；确定性流程，同种子结果稳定）。
   */
  /** 数值参数归一：缺省 / NaN / 非数字时取默认值，再钳到 0～1 */
  const unit = (v, def) => { const x = Number(v); return Number.isFinite(x) ? clamp01(x) : def; };

  function build(o) {
    o = { ...o, land: unit(o.land, 0.5), rough: unit(o.rough, 0.3) };
    const targetLand = o.land;
    const pr = prepareShape(o);
    let goal = targetLand, best = null;
    for (let it = 0; it < 3; it++) {
      const r = finishShape(pr, goal);
      const dev = targetLand - r.stats.landRatio;
      if (!best || Math.abs(dev) < Math.abs(targetLand - best.stats.landRatio)) best = r;
      if (Math.abs(dev) <= 0.006) break;
      goal = clamp01(goal + dev);
      if (it === 0) pr.prog = null;
    }
    best.stats.targetLand = +targetLand.toFixed(3);
    return best;
  }

  /** 预览：大地图按步长在原坐标上采样（噪声频率与地图坐标绑定，直接缩小尺寸生成会得到完全不同的形状） */
  function preview(o, maxSide = 160) {
    const stride = Math.max(1, Math.ceil(Math.max(o.width | 0, o.height | 0) / maxSide));
    const r = build({ ...o, stride });
    r.stride = stride;
    return r;
  }

  /** 预览配色（与 APK 预览色相近） */
  const COLORS = {
    [T.WATER]: [46, 134, 193], [T.DEEP]: [27, 79, 114], [T.SHALLOW]: [93, 173, 226], [T.SAND]: [236, 204, 104],
    [T.LONG_GRASS]: [108, 186, 108], [T.SHORT_GRASS]: [140, 214, 128], [T.DIRT]: [176, 146, 104], [T.STONE]: [140, 140, 146],
    [T.MOUNTAIN]: [112, 88, 64], [T.SNOW]: [236, 244, 252], [T.ICE]: [198, 226, 246], [T.LAVA]: [222, 78, 52],
    [VIEW.FORD]: [150, 206, 222], [VIEW.RAMP]: [214, 170, 92]
  };
  /** 把 view 写入 RGBA 缓冲（ImageData.data），山地加简易明暗 */
  function paint(view, w, h, rgba) {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const k = y * w + x, v = view[k], col = COLORS[v] || [0, 0, 0];
      let s = 1;
      if (v === T.MOUNTAIN) { const up = y > 0 ? view[k - w] : v; s = up !== T.MOUNTAIN && up !== VIEW.RAMP ? 1.25 : 0.95; }
      const j = k * 4;
      rgba[j] = Math.min(255, col[0] * s); rgba[j + 1] = Math.min(255, col[1] * s); rgba[j + 2] = Math.min(255, col[2] * s); rgba[j + 3] = 255;
    }
    return rgba;
  }

  const API = { VERSION: '1.3', T, VIEW, SHAPES, SHAPE_MAP, normSeed, generateCategories, build, preview, paint, COLORS, mirrorSource };
  root.TerrainShapes = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
