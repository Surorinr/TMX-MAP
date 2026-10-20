/*
 * 铁锈战争地图生成器 · 地形形态模板（3.8.0 新增）
 *
 * 11 套形态模板移植自「锈匠地图生成器」（岛屿 / 半岛 / 群岛 / 双河 / 山湖 / 大陆 / 沙漠 / 雪原 / 火山 / 迷宫 / 两岸狭路）。
 * 第一部分（APK 同款算法）逐行对照原实现重写为可读代码，同一种子、同一尺寸下输出与原版逐格一致
 * （tools/verify 中的对照脚本已验证 11 套 × 多种子 × 多尺寸）。
 * 第二部分是本项目新增的「可对战化」后处理：对称镜像、碎块清理、浅滩、高地坡道、凿通被山围死的空地，
 * 最终转换成引擎 set_coastline_from_image 认识的矩阵（0 水 / 1 平地 / 2 高地 / -2 高地坡道）。
 *
 * 噪声：PermNoise 为原版使用的经典 Perlin；NaturalNoise 基于 FastNoiseLite（© Jordan Peck，MIT License）
 * 的 OpenSimplex2S / Cellular 二维实现，仅保留本模块用到的部分，梯度表与原库一致。
 *
 * 本文件既可在网页主线程 / Web Worker 中以 <script> 或 import 加载（挂到 globalThis.TerrainShapes），
 * 也可在 Node 中 require（用于离线对照测试）。纯计算，无 DOM 依赖。
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

  /* ================================================================ 经典 Perlin（原版 _E） */
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

  /* ================================================================ FastNoiseLite 子集（OpenSimplex2S / Cellular，2D） */
  const GRAD2 = new Float64Array([
    .130526192220052, .99144486137381, .38268343236509, .923879532511287, .608761429008721, .793353340291235, .793353340291235, .608761429008721,
    .923879532511287, .38268343236509, .99144486137381, .130526192220051, .99144486137381, -.130526192220051, .923879532511287, -.38268343236509,
    .793353340291235, -.60876142900872, .608761429008721, -.793353340291235, .38268343236509, -.923879532511287, .130526192220052, -.99144486137381,
    -.130526192220052, -.99144486137381, -.38268343236509, -.923879532511287, -.608761429008721, -.793353340291235, -.793353340291235, -.608761429008721,
    -.923879532511287, -.38268343236509, -.99144486137381, -.130526192220052, -.99144486137381, .130526192220051, -.923879532511287, .38268343236509,
    -.793353340291235, .608761429008721, -.608761429008721, .793353340291235, -.38268343236509, .923879532511287, -.130526192220052, .99144486137381,
    .130526192220052, .99144486137381, .38268343236509, .923879532511287, .608761429008721, .793353340291235, .793353340291235, .608761429008721,
    .923879532511287, .38268343236509, .99144486137381, .130526192220051, .99144486137381, -.130526192220051, .923879532511287, -.38268343236509,
    .793353340291235, -.60876142900872, .608761429008721, -.793353340291235, .38268343236509, -.923879532511287, .130526192220052, -.99144486137381,
    -.130526192220052, -.99144486137381, -.38268343236509, -.923879532511287, -.608761429008721, -.793353340291235, -.793353340291235, -.608761429008721,
    -.923879532511287, -.38268343236509, -.99144486137381, -.130526192220052, -.99144486137381, .130526192220051, -.923879532511287, .38268343236509,
    -.793353340291235, .608761429008721, -.608761429008721, .793353340291235, -.38268343236509, .923879532511287, -.130526192220052, .99144486137381,
    .130526192220052, .99144486137381, .38268343236509, .923879532511287, .608761429008721, .793353340291235, .793353340291235, .608761429008721,
    .923879532511287, .38268343236509, .99144486137381, .130526192220051, .99144486137381, -.130526192220051, .923879532511287, -.38268343236509,
    .793353340291235, -.60876142900872, .608761429008721, -.793353340291235, .38268343236509, -.923879532511287, .130526192220052, -.99144486137381,
    -.130526192220052, -.99144486137381, -.38268343236509, -.923879532511287, -.608761429008721, -.793353340291235, -.793353340291235, -.608761429008721,
    -.923879532511287, -.38268343236509, -.99144486137381, -.130526192220052, -.99144486137381, .130526192220051, -.923879532511287, .38268343236509,
    -.793353340291235, .608761429008721, -.608761429008721, .793353340291235, -.38268343236509, .923879532511287, -.130526192220052, .99144486137381,
    .130526192220052, .99144486137381, .38268343236509, .923879532511287, .608761429008721, .793353340291235, .793353340291235, .608761429008721,
    .923879532511287, .38268343236509, .99144486137381, .130526192220051, .99144486137381, -.130526192220051, .923879532511287, -.38268343236509,
    .793353340291235, -.60876142900872, .608761429008721, -.793353340291235, .38268343236509, -.923879532511287, .130526192220052, -.99144486137381,
    -.130526192220052, -.99144486137381, -.38268343236509, -.923879532511287, -.608761429008721, -.793353340291235, -.793353340291235, -.608761429008721,
    -.923879532511287, -.38268343236509, -.99144486137381, -.130526192220052, -.99144486137381, .130526192220051, -.923879532511287, .38268343236509,
    -.793353340291235, .608761429008721, -.608761429008721, .793353340291235, -.38268343236509, .923879532511287, -.130526192220052, .99144486137381,
    .130526192220052, .99144486137381, .38268343236509, .923879532511287, .608761429008721, .793353340291235, .793353340291235, .608761429008721,
    .923879532511287, .38268343236509, .99144486137381, .130526192220051, .99144486137381, -.130526192220051, .923879532511287, -.38268343236509,
    .793353340291235, -.60876142900872, .608761429008721, -.793353340291235, .38268343236509, -.923879532511287, .130526192220052, -.99144486137381,
    -.130526192220052, -.99144486137381, -.38268343236509, -.923879532511287, -.608761429008721, -.793353340291235, -.793353340291235, -.608761429008721,
    -.923879532511287, -.38268343236509, -.99144486137381, -.130526192220052, -.99144486137381, .130526192220051, -.923879532511287, .38268343236509,
    -.793353340291235, .608761429008721, -.608761429008721, .793353340291235, -.38268343236509, .923879532511287, -.130526192220052, .99144486137381,
    .38268343236509, .923879532511287, .923879532511287, .38268343236509, .923879532511287, -.38268343236509, .38268343236509, -.923879532511287,
    -.38268343236509, -.923879532511287, -.923879532511287, -.38268343236509, -.923879532511287, .38268343236509, -.38268343236509, .923879532511287
  ]);
  const RAND2 = new Float64Array([
    -.2700222198, -.9628540911, .3863092627, -.9223693152, .04444859006, -.999011673, -.5992523158, -.8005602176,
    -.7819280288, .6233687174, .9464672271, .3227999196, -.6514146797, -.7587218957, .9378472289, .347048376,
    -.8497875957, -.5271252623, -.879042592, .4767432447, -.892300288, -.4514423508, -.379844434, -.9250503802,
    -.9951650832, .0982163789, .7724397808, -.6350880136, .7573283322, -.6530343002, -.9928004525, -.119780055,
    -.0532665713, .9985803285, .9754253726, -.2203300762, -.7665018163, .6422421394, .991636706, .1290606184,
    -.994696838, .1028503788, -.5379205513, -.84299554, .5022815471, -.8647041387, .4559821461, -.8899889226,
    -.8659131224, -.5001944266, .0879458407, -.9961252577, -.5051684983, .8630207346, .7753185226, -.6315704146,
    -.6921944612, .7217110418, -.5191659449, -.8546734591, .8978622882, -.4402764035, -.1706774107, .9853269617,
    -.9353430106, -.3537420705, -.9992404798, .03896746794, -.2882064021, -.9575683108, -.9663811329, .2571137995,
    -.8759714238, -.4823630009, -.8303123018, -.5572983775, .05110133755, -.9986934731, -.8558373281, -.5172450752,
    .09887025282, .9951003332, .9189016087, .3944867976, -.2439375892, -.9697909324, -.8121409387, -.5834613061,
    -.9910431363, .1335421355, .8492423985, -.5280031709, -.9717838994, -.2358729591, .9949457207, .1004142068,
    .6241065508, -.7813392434, .662910307, .7486988212, -.7197418176, .6942418282, -.8143370775, -.5803922158,
    .104521054, -.9945226741, -.1065926113, -.9943027784, .445799684, -.8951327509, .105547406, .9944142724,
    -.992790267, .1198644477, -.8334366408, .552615025, .9115561563, -.4111755999, .8285544909, -.5599084351,
    .7217097654, -.6921957921, .4940492677, -.8694339084, -.3652321272, -.9309164803, -.9696606758, .2444548501,
    .08925509731, -.996008799, .5354071276, -.8445941083, -.1053576186, .9944343981, -.9890284586, .1477251101,
    .004856104961, .9999882091, .9885598478, .1508291331, .9286129562, -.3710498316, -.5832393863, -.8123003252,
    .3015207509, .9534596146, -.9575110528, .2883965738, .9715802154, -.2367105511, .229981792, .9731949318,
    .955763816, -.2941352207, .740956116, .6715534485, -.9971513787, -.07542630764, .6905710663, -.7232645452,
    -.290713703, -.9568100872, .5912777791, -.8064679708, -.9454592212, -.325740481, .6664455681, .74555369,
    .6236134912, .7817328275, .9126993851, -.4086316587, -.8191762011, .5735419353, -.8812745759, -.4726046147,
    .9953313627, .09651672651, .9855650846, -.1692969699, -.8495980887, .5274306472, .6174853946, -.7865823463,
    .8508156371, .52546432, .9985032451, -.05469249926, .1971371563, -.9803759185, .6607855748, -.7505747292,
    -.03097494063, .9995201614, -.6731660801, .739491331, -.7195018362, -.6944905383, .9727511689, .2318515979,
    .9997059088, -.0242506907, .4421787429, -.8969269532, .9981350961, -.061043673, -.9173660799, -.3980445648,
    -.8150056635, -.5794529907, -.8789331304, .4769450202, .0158605829, .999874213, -.8095464474, .5870558317,
    -.9165898907, -.3998286786, -.8023542565, .5968480938, -.5176737917, .8555780767, -.8154407307, -.5788405779,
    .4022010347, -.9155513791, -.9052556868, -.4248672045, .7317445619, .6815789728, -.5647632201, -.8252529947,
    -.8403276335, -.5420788397, -.9314281527, .363925262, .5238198472, .8518290719, .7432803869, -.6689800195,
    -.985371561, -.1704197369, .4601468731, .88784281, .825855404, .5638819483, .6182366099, .7859920446,
    .8331502863, -.553046653, .1500307506, .9886813308, -.662330369, -.7492119075, -.668598664, .743623444,
    .7025606278, .7116238924, -.5419389763, -.8404178401, -.3388616456, .9408362159, .8331530315, .5530425174,
    -.2989720662, -.9542618632, .2638522993, .9645630949, .124108739, -.9922686234, -.7282649308, -.6852956957,
    .6962500149, .7177993569, -.9183535368, .3957610156, -.6326102274, -.7744703352, -.9331891859, -.359385508,
    -.1153779357, -.9933216659, .9514974788, -.3076565421, -.08987977445, -.9959526224, .6678496916, .7442961705,
    .7952400393, -.6062947138, -.6462007402, -.7631674805, -.2733598753, .9619118351, .9669590226, -.254931851,
    -.9792894595, .2024651934, -.5369502995, -.8436138784, -.270036471, -.9628500944, -.6400277131, .7683518247,
    -.7854537493, -.6189203566, .06005905383, -.9981948257, -.02455770378, .9996984141, -.65983623, .751409442,
    -.6253894466, -.7803127835, -.6210408851, -.7837781695, .8348888491, .5504185768, -.1592275245, .9872419133,
    .8367622488, .5475663786, -.8675753916, -.4973056806, -.2022662628, -.9793305667, .9399189937, .3413975472,
    .9877404807, -.1561049093, -.9034455656, .4287028224, .1269804218, -.9919052235, -.3819600854, .924178821,
    .9754625894, .2201652486, -.3204015856, -.9472818081, -.9874760884, .1577687387, .02535348474, -.9996785487,
    .4835130794, -.8753371362, -.2850799925, -.9585037287, -.06805516006, -.99768156, -.7885244045, -.6150034663,
    .3185392127, -.9479096845, .8880043089, .4598351306, .6476921488, -.7619021462, .9820241299, .1887554194,
    .9357275128, -.3527237187, -.8894895414, .4569555293, .7922791302, .6101588153, .7483818261, .6632681526,
    -.7288929755, -.6846276581, .8729032783, -.4878932944, .8288345784, .5594937369, .08074567077, .9967347374,
    .9799148216, -.1994165048, -.580730673, -.8140957471, -.4700049791, -.8826637636, .2409492979, .9705377045,
    .9437816757, -.3305694308, -.8927998638, -.4504535528, -.8069622304, .5906030467, .06258973166, .9980393407,
    -.9312597469, .3643559849, .5777449785, .8162173362, -.3360095855, -.941858566, .697932075, -.7161639607,
    -.002008157227, -.9999979837, -.1827294312, -.9831632392, -.6523911722, .7578824173, -.4302626911, -.9027037258,
    -.9985126289, -.05452091251, -.01028102172, -.9999471489, -.4946071129, .8691166802, -.2999350194, .9539596344,
    .8165471961, .5772786819, .2697460475, .962931498, -.7306287391, -.6827749597, -.7590952064, -.6509796216,
    -.907053853, .4210146171, -.5104861064, -.8598860013, .8613350597, .5080373165, .5007881595, -.8655698812,
    -.654158152, .7563577938, -.8382755311, -.545246856, .6940070834, .7199681717, .06950936031, .9975812994,
    .1702942185, -.9853932612, .2695973274, .9629731466, .5519612192, -.8338697815, .225657487, -.9742067022,
    .4215262855, -.9068161835, .4881873305, -.8727388672, -.3683854996, -.9296731273, -.9825390578, .1860564427,
    .81256471, .5828709909, .3196460933, -.9475370046, .9570913859, .2897862643, -.6876655497, -.7260276109,
    -.9988770922, -.047376731, -.1250179027, .992154486, -.8280133617, .560708367, .9324863769, -.3612051451,
    .6394653183, .7688199442, -.01623847064, -.9998681473, -.9955014666, -.09474613458, -.81453315, .580117012,
    .4037327978, -.9148769469, .9944263371, .1054336766, -.1624711654, .9867132919, -.9949487814, -.100383875,
    -.6995302564, .7146029809, .5263414922, -.85027327, -.5395221479, .841971408, .6579370318, .7530729462,
    .01426758847, -.9998982128, -.6734383991, .7392433447, .639412098, -.7688642071, .9211571421, .3891908523,
    -.146637214, -.9891903394, -.782318098, .6228791163, -.5039610839, -.8637263605, -.7743120191, -.6328039957
  ]);
  const PRIME_X = 501125321, PRIME_Y = 1136930381;
  const hashR2 = (seed, xp, yp) => Math.imul(seed ^ xp ^ yp, 668265261);
  function gradCoord(seed, xp, yp, xd, yd) {
    let h = hashR2(seed, xp, yp);
    h ^= h >> 15; h &= 254;
    return xd * GRAD2[h] + yd * GRAD2[h | 1];
  }
  function openSimplex2S(seed, x, y) {
    const G = 1.2679491924311228 / 6;
    let i = Math.floor(x), j = Math.floor(y);
    const xi = x - i, yi = y - j;
    i = Math.imul(i, PRIME_X); j = Math.imul(j, PRIME_Y);
    const i1 = i + PRIME_X, j1 = j + PRIME_Y;
    const t = (xi + yi) * G, x0 = xi - t, y0 = yi - t;
    const a0 = 2 / 3 - x0 * x0 - y0 * y0;
    let value = a0 * a0 * (a0 * a0) * gradCoord(seed, i, j, x0, y0);
    const a1 = 2 * (1 - 2 * G) * (1 / G - 2) * t + (-2 * (1 - 2 * G) * (1 - 2 * G) + a0);
    const x1 = x0 - (1 - 2 * G), y1 = y0 - (1 - 2 * G);
    value += a1 * a1 * (a1 * a1) * gradCoord(seed, i1, j1, x1, y1);
    const d = xi - yi;
    const add = (xp, yp, dx, dy) => { const a = 2 / 3 - dx * dx - dy * dy; if (a > 0) value += a * a * (a * a) * gradCoord(seed, xp, yp, dx, dy); };
    if (t > G) {
      if (xi + d > 1) add(i + (PRIME_X << 1), j + PRIME_Y, x0 + (3 * G - 2), y0 + (3 * G - 1));
      else add(i, j + PRIME_Y, x0 + G, y0 + (G - 1));
      if (yi - d > 1) add(i + PRIME_X, j + (PRIME_Y << 1), x0 + (3 * G - 1), y0 + (3 * G - 2));
      else add(i + PRIME_X, j, x0 + (G - 1), y0 + G);
    } else {
      if (xi + d < 0) add(i - PRIME_X, j, x0 + (1 - G), y0 - G);
      else add(i + PRIME_X, j, x0 + (G - 1), y0 + G);
      if (yi < d) add(i, j - PRIME_Y, x0 - G, y0 - (G - 1));
      else add(i, j + PRIME_Y, x0 + G, y0 + (G - 1));
    }
    return value * 18.24196194486065;
  }
  /* Cellular：欧氏距离平方，返回 Distance2Sub */
  function cellular(seed, x, y, jitter) {
    const rx = Math.round(x), ry = Math.round(y);
    let d0 = Number.MAX_VALUE, d1 = Number.MAX_VALUE;
    const cj = 0.43701595 * jitter;
    let xp = (rx - 1) * PRIME_X;
    const yBase = (ry - 1) * PRIME_Y;
    for (let xi = rx - 1; xi <= rx + 1; xi++) {
      let yp = yBase;
      for (let yi = ry - 1; yi <= ry + 1; yi++) {
        const h = hashR2(seed, xp, yp), k = h & 510;
        const vx = xi - x + RAND2[k] * cj, vy = yi - y + RAND2[k | 1] * cj;
        const dd = vx * vx + vy * vy;
        d1 = Math.max(Math.min(d1, dd), d0);
        if (dd < d0) d0 = dd;
        yp += PRIME_Y;
      }
      xp += PRIME_X;
    }
    return d1 - d0 - 1;
  }
  class FastNoise {
    /** fractal: 'none' | 'fbm' | 'ridged'；type: 'os2s' | 'cellular'；频率固定为 1（原版用法） */
    constructor(seed, type, fractal, octaves = 5, jitter = 1) {
      this.seed = seed; this.type = type; this.fractal = fractal; this.oct = octaves; this.jitter = jitter;
      let amp = 0.5, f = 1;
      for (let i = 1; i < octaves; i++) { f += amp; amp *= 0.5; }
      this.bound = 1 / f;
    }
    single(seed, x, y) { return this.type === 'cellular' ? cellular(seed, x, y, this.jitter) : openSimplex2S(seed, x, y); }
    get(x, y) {
      if (this.type === 'os2s') { const t = (x + y) * (0.5 * 0.7320508075688772); x += t; y += t; }
      if (this.fractal === 'none') return this.single(this.seed, x, y);
      let seed = this.seed, sum = 0, amp = this.bound;
      for (let i = 0; i < this.oct; i++) {
        const n = this.single(seed++, x, y);
        sum += this.fractal === 'ridged' ? (Math.abs(n) * -2 + 1) * amp : n * amp;
        x *= 2; y *= 2; amp *= 0.5;
      }
      return sum;
    }
  }
  const to01 = v => Math.max(0, Math.min(1, v * 0.5 + 0.5));
  /** 原版 gE：带域扭曲的自然噪声 */
  class NaturalNoise {
    constructor(seed, opts = {}) {
      const oct = opts.octaves ?? 5;
      this.sampleN = new FastNoise(seed, 'os2s', 'fbm', oct);
      this.ridgeN = new FastNoise(seed + 1013, 'os2s', 'ridged', oct);
      this.cellN = new FastNoise(seed + 2027, 'cellular', 'none', 3, 0.9);
      this.warpX = new FastNoise(seed + 3041, 'os2s', 'fbm', 3);
      this.warpY = new FastNoise(seed + 4051, 'os2s', 'fbm', 3);
      this.amp = opts.warpAmplitude ?? 0.85;
    }
    sample(x, y) { return to01(this.sampleN.get(x, y)); }
    ridged(x, y) { return to01(this.ridgeN.get(x, y)); }
    cellular(x, y) { return to01(this.cellN.get(x, y)); }
    sampleWarped(x, y) {
      const dx = this.warpX.get(x + 31.7, y - 18.3) * this.amp, dy = this.warpY.get(x - 47.1, y + 63.9) * this.amp;
      return this.sample(x + dx, y + dy);
    }
  }

  /* ================================================================ 原版辅助函数 */
  const clamp01 = v => Math.max(0, Math.min(1, v));
  /* 注意：原版在 e1 < e0 时分母取 1e-4，相当于在 e0 处的阶跃 —— 为保证一致性原样保留 */
  function smooth(e0, e1, x) { const r = clamp01((x - e0) / Math.max(1e-4, e1 - e0)); return r * r * (3 - 2 * r); }
  const angDist = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
  /** 两岸狭路：第 row 行中央河道的中心列 */
  function channelCenter(n, row, w, h) {
    const t = row / Math.max(1, h - 1);
    return w * 0.5 + (n.warpedFbm(t * 2.4 + 41, 19.7, 4, 0.9) - 0.5) * w * 0.12 + Math.sin(t * Math.PI * 2.2 + 0.7) * w * 0.018;
  }
  function channelHalfWidth(n, row, w, h) {
    const t = row / Math.max(1, h - 1);
    return Math.max(2, w * (0.022 + n.fbm(t * 3.1 + 8, 27, 3) * 0.012));
  }
  function crossingRows(n, h) { return [0.24, 0.5, 0.76].map((v, k) => Math.round(h * (v + (n.random2D(k + 71, 33) - 0.5) * 0.055))); }
  function isCrossingRow(n, row, h) { const r = Math.max(1, Math.round(h * 0.014)); return crossingRows(n, h).some(c => Math.abs(row - c) <= r); }

  /* ================================================================ 形态模板定义
   * size：原版推荐尺寸；theme：推荐贴图主题（1 丛林 2 雪山 3 火山 4 沙漠 5 森林）；mirror：推荐对称方式；
   * levels/ocean/magnet：推荐高度层级 / 海洋层级 / 墙体吸附；bridge：是否自动用浅滩连通被水隔开的大块陆地。 */
  const SHAPES = [
    { id: 'island', label: '岛屿', desc: '四面环海，中央一块陆地', size: [120, 120], theme: 5, mirror: 'both', levels: 6, ocean: 3, magnet: 25, bridge: false },
    { id: 'peninsula', label: '半岛', desc: '大陆边缘突出半岛，三面环海', size: [160, 120], theme: 1, mirror: 'horizontal', levels: 6, ocean: 3, magnet: 25, bridge: true },
    { id: 'archipelago', label: '群岛', desc: '多个小岛散布在海中，适合海战', size: [180, 180], theme: 1, mirror: 'both', levels: 4, ocean: 3, magnet: 20, bridge: false },
    { id: 'river', label: '双河', desc: '两条河流将陆地分为三块（自动加浅滩渡口）', size: [160, 120], theme: 5, mirror: 'vertical', levels: 6, ocean: 2, magnet: 25, bridge: true },
    { id: 'mountain_lake', label: '山湖', desc: '中央山脉环绕湖泊', size: [120, 120], theme: 5, mirror: 'vertical', levels: 7, ocean: 2, magnet: 35, bridge: true },
    { id: 'continent', label: '大陆', desc: '一整块大陆，边缘少量水域', size: [160, 160], theme: 1, mirror: 'vertical', levels: 7, ocean: 2, magnet: 25, bridge: true },
    { id: 'desert', label: '沙漠', desc: '大片沙漠，少量绿洲', size: [140, 140], theme: 4, mirror: 'vertical', levels: 5, ocean: 2, magnet: 20, bridge: true },
    { id: 'snowland', label: '雪原', desc: '冰雪覆盖的大地', size: [140, 140], theme: 2, mirror: 'vertical', levels: 7, ocean: 2, magnet: 25, bridge: true },
    { id: 'volcano', label: '火山', desc: '中央火山口，岩浆流淌', size: [120, 120], theme: 3, mirror: 'vertical', levels: 7, ocean: 2, magnet: 30, bridge: true },
    { id: 'labyrinth', label: '迷宫', desc: '山脊形成迷宫通道', size: [160, 160], theme: 5, mirror: 'both', levels: 6, ocean: 1, magnet: 30, bridge: true },
    { id: 'two_sides', label: '两岸狭路', desc: '左右两岸对峙，中间狭路相逢', size: [240, 110], theme: 1, mirror: 'vertical', levels: 6, ocean: 2, magnet: 20, bridge: true }
  ];
  const SHAPE_MAP = new Map(SHAPES.map(s => [s.id, s]));

  /** 种子规范化：与原版一致地保留正整数种子（42 仍是 42），其余折叠到 [1, 2^31-2] */
  function normSeed(seed) {
    let s = Math.abs(Math.trunc(Number(seed) || 0)) % 2147483647;
    return s === 0 ? 7 : s;
  }

  /* ================================================================ 第一部分：APK 同款分类（输出 Uint8Array，取值见 T） */
  function heightMap(ctx, w, h, shape, land, st = 1, gw = w, gh = h, need = null, prog = null) {
    const { noise, nat } = ctx;
    const H = new Float64Array(gw * gh);
    const f = (land - 0.5) * 0.42;
    for (let gy = 0; gy < gh; gy++) {
      const i = gy * st;
      if (prog && (gy & 31) === 0) prog(gy / gh);
      // 两岸狭路的河道中心 / 半宽只与行有关，按行缓存（原版逐格重复计算，结果相同）
      const cc = shape === 'two_sides' ? channelCenter(noise, i, w, h) : 0;
      const cw = shape === 'two_sides' ? channelHalfWidth(noise, i, w, h) : 0;
      for (let gx = 0; gx < gw; gx++) {
        if (need && !need(gx, gy)) continue;
        const o = gx * st;
        const sx = o / w, sy = i / h, l = sx * 2 - 1, u = sy * 2 - 1, d = Math.sqrt(l * l + u * u);
        const p = noise.warpedFbm(o * 0.012 + 11, i * 0.012 - 17, 5, 0.9);
        const m = noise.fbm(o * 0.045 + 101, i * 0.045 + 73, 4);
        const rg = noise.ridgedFbm(o * 0.022 - 40, i * 0.022 + 29, 4);
        const g = (noise.warpedFbm(o * 0.018 + 500, i * 0.018 + 500, 4, 0.8) - 0.5) * 0.24;
        let v = p * 0.58 + m * 0.27 + rg * 0.15 + f;
        switch (shape) {
          case 'island': {
            const e = 0.48 + land * 0.48, t = 1 - smooth(e - 0.28, e + 0.12, d + g);
            v = v * 0.5 + t * 0.5; break;
          }
          case 'peninsula': {
            const e = (noise.warpedFbm(o * 0.02 + 300, i * 0.02 - 90, 4, 0.7) - 0.5) * 0.32;
            const t = smooth(-0.65 - f, 0.28 - f, l + e), n = 1 - smooth(0.72, 1.2, d + g * 0.5);
            v = v * 0.38 + t * n * 0.62; break;
          }
          case 'archipelago': {
            const e = noise.warpedFbm(o * 0.028 + 100, i * 0.028 + 100, 5, 1.15);
            const t = noise.fbm(o * 0.072 + 200, i * 0.072 + 200, 3);
            const n = 1 - smooth(0.66, 1.25, d + g), r = smooth(0.52, 0.82, rg) * 0.22;
            v = e * 0.46 + t * 0.16 + rg * 0.1 + r + n * 0.16 - 0.23 + f; break;
          }
          case 'river': {
            const e = (noise.warpedFbm(o * 0.012 + 700, i * 0.012 + 700, 4, 1.1) - 0.5) * 0.2;
            const t = Math.max(0, 1 - Math.abs(u + 0.3 + e) * 9), n = Math.max(0, 1 - Math.abs(u - 0.3 + e) * 9);
            v = v * 0.58 + 0.28 + f - Math.max(t, n) * 0.72; break;
          }
          case 'mountain_lake': {
            const ex = l + 0.11, ey = u - 0.06;
            const n = Math.sqrt((ex * 1.18) ** 2 + (ey * 0.86) ** 2) + g * 0.5, a = Math.atan2(ey, ex);
            const k = 0.5 + 0.32 * nat.sampleWarped(Math.cos(a) * 1.7 + 910, Math.sin(a) * 1.7 - 640) + 0.18 * nat.cellular(Math.cos(a) * 1.2 + 120, Math.sin(a) * 1.2 - 240);
            const gap = Math.max(1 - smooth(0.05, 0.34, angDist(a, -0.45)), 1 - smooth(0.04, 0.3, angDist(a, 2.55)));
            const ring = Math.max(0, 1 - Math.abs(n - 0.42) * 4.2) * k * (1 - gap * 0.72);
            const bowl = smooth(0.3, 0.08, n) * -0.48;
            const inlet = Math.max(0, 1 - Math.abs(ey - ex * 0.26 - 0.05) * 18) * smooth(-0.15, 0.8, ex) * -0.3;
            v = v * 0.28 + ring * 0.56 + 0.2 + bowl + inlet; break;
          }
          case 'continent': {
            const e = Math.min(sx, sy, 1 - sx, 1 - sy), t = smooth(0.025, 0.16 - f * 0.12, e + g * 0.16);
            v = v * 0.52 + t * 0.48 + f; break;
          }
          case 'desert': {
            const e = noise.ridgedFbm(o * 0.035 + 50, i * 0.018 + 50, 4);
            const t = noise.warpedFbm(o * 0.014 - 220, i * 0.014 + 330, 4, 0.85);
            const n = smooth(0.76, 0.9, noise.warpedFbm(o * 0.026 + 1500, i * 0.026 - 1300, 4, 0.9));
            v = v * 0.3 + 0.39 + e * 0.18 + t * 0.16 + f - n * 0.34; break;
          }
          case 'snowland': {
            const e = noise.warpedFbm(o * 0.018 + 870, i * 0.018 - 510, 5, 0.95);
            const t = smooth(0.6, 0.9, rg) * noise.fbm(o * 0.04 + 1700, i * 0.04 + 2100, 3);
            v = v * 0.32 + e * 0.28 + 0.28 + rg * 0.16 + t * 0.12 + f; break;
          }
          case 'volcano': {
            const a = Math.atan2(u, l);
            const t = d + (nat.sampleWarped(Math.cos(a) * 1.9 + 310, Math.sin(a) * 1.9 - 470) - 0.5) * 0.24 + g * 0.22;
            const n = Math.max(0, 1 - Math.abs(t - 0.31) * 5.6) * (0.68 + nat.ridged(o * 0.022 - 40, i * 0.022 + 29) * 0.32);
            const crater = smooth(0.27, 0.07, t) * -0.7;
            const f1 = Math.max(0, 1 - Math.abs(l + u * 0.28 - 0.02) * 15) * smooth(-0.08, 0.9, u);
            const f2 = Math.max(0, 1 - Math.abs(l - u * 0.46 + 0.08) * 18) * smooth(-0.55, 0.58, -u);
            v = v * 0.18 + n * 0.72 + 0.31 + crater - Math.max(f1, f2) * 0.34 + rg * 0.08; break;
          }
          case 'labyrinth': {
            const e = noise.ridgedFbm(o * 0.026 + 90, i * 0.026 - 140, 5);
            const t = Math.abs(noise.warpedFbm(o * 0.017 - 720, i * 0.017 + 460, 5, 1.25) - 0.5);
            const n = noise.warpedFbm(o * 0.01 + 210, i * 0.01 + 710, 4, 0.8);
            v = 0.32 + e * 0.48 + n * 0.16 - smooth(0, 0.16, t) * 0.28 + f; break;
          }
          case 'two_sides': {
            const s = smooth(cw * 0.72, cw * 2.8, Math.abs(o - cc));
            const c = noise.warpedFbm(o * 0.025 + 560, i * 0.025 - 220, 4, 0.7);
            v = v * 0.28 + s * 0.52 + c * 0.18 + 0.08 + f; break;
          }
          default: v = v * 0.5 + 0.3;
        }
        H[gy * gw + gx] = clamp01(v);
      }
    }
    return H;
  }

  function classify(ctx, H, w, h, shape, rough, st = 1, gw = w, gh = h, need = null, prog = null) {
    const { noise, nat } = ctx;
    const out = new Uint8Array(gw * gh);
    const thr = 0.72 + rough * 0.15 + (shape === 'continent' ? 0.03 : 0);
    for (let gy = 0; gy < gh; gy++) {
      const i = gy * st;
      if (prog && (gy & 31) === 0) prog(gy / gh);
      const cc = shape === 'two_sides' ? channelCenter(noise, i, w, h) : 0;
      const cw = shape === 'two_sides' ? channelHalfWidth(noise, i, w, h) : 0;
      const crossing = shape === 'two_sides' ? isCrossingRow(noise, i, h) : false;
      for (let gx = 0; gx < gw; gx++) {
        if (need && !need(gx, gy)) continue;
        const s = gx * st, k = gy * gw + gx, c = H[k];
        const d = (s / w) * 2 - 1, f = (i / h) * 2 - 1, p = Math.sqrt(d * d + f * f);
        const m = noise.warpedFbm(s * 0.024 + 1200, i * 0.024 - 800, 4, 0.8);
        const hh = noise.fbm(s * 0.08 - 400, i * 0.08 + 900, 3);
        const g = noise.ridgedFbm(s * 0.022 - 40, i * 0.022 + 29, 4);
        const up = gy > 0 ? H[k - gw] : c, dn = gy < gh - 1 ? H[k + gw] : c, lf = gx > 0 ? H[k - 1] : c, rt = gx < gw - 1 ? H[k + 1] : c;
        const slope = Math.max(Math.abs(c - up), Math.abs(c - dn), Math.abs(c - lf), Math.abs(c - rt));
        if (shape === 'volcano') {
          const a = Math.atan2(f, d);
          const t = p + (nat.sampleWarped(Math.cos(a) * 1.9 + 310, Math.sin(a) * 1.9 - 470) - 0.5) * 0.24;
          const n = nat.ridged(s * 0.022 - 40, i * 0.022 + 29);
          const flowA = Math.abs(d + f * 0.28 - 0.02) < 0.055 && f > -0.08, flowB = Math.abs(d - f * 0.46 + 0.08) < 0.045 && f < 0.55;
          if (t < 0.18 || ((flowA || flowB) && p < 0.82)) out[k] = T.LAVA;
          else if (t < 0.29) out[k] = T.STONE;
          else if (t < 0.48 && (c > 0.47 || n > 0.62)) out[k] = T.MOUNTAIN;
          else if (t < 0.62 && (slope > 0.1 || n > 0.58)) out[k] = T.STONE;
          else out[k] = m > 0.55 && hh > 0.4 ? T.SHORT_GRASS : T.LONG_GRASS;
          continue;
        }
        if (shape === 'river') {
          const e = (i / h) * 2 - 1;
          const t = Math.max(0, 1 - Math.abs(e + 0.3) * 8), n = Math.max(0, 1 - Math.abs(e - 0.3) * 8);
          if (Math.max(t, n) > 0.3 && c < 0.4) { out[k] = T.WATER; continue; }
        }
        if (shape === 'mountain_lake') {
          const ex = d + 0.11, ey = f - 0.06;
          const n = Math.sqrt((ex * 1.18) ** 2 + (ey * 0.86) ** 2) + (nat.sampleWarped(s * 0.018 + 500, i * 0.018 + 500) - 0.5) * 0.12;
          if (n < 0.24 && c < 0.42) { out[k] = T.WATER; continue; }
          const a = Math.atan2(ey, ex);
          const gap = Math.max(1 - smooth(0.05, 0.34, angDist(a, -0.45)), 1 - smooth(0.04, 0.3, angDist(a, 2.55)));
          const ring = Math.max(0, 1 - Math.abs(n - 0.42) * 4.2) * (0.82 + nat.cellular(s * 0.014 + 80, i * 0.014 - 60) * 0.18) * (1 - gap * 0.8);
          if (ring > 0.58) out[k] = T.MOUNTAIN;
          else if (ring > 0.3 && g > 0.46) out[k] = T.STONE;
          else if (n < 0.31 && c < 0.5) out[k] = T.SHALLOW;
          else if (n < 0.58 && (slope > 0.11 || g > 0.63)) out[k] = T.STONE;
          else out[k] = m > 0.54 ? T.SHORT_GRASS : T.LONG_GRASS;
          continue;
        }
        if (shape === 'two_sides' && Math.abs(s - cc) <= cw) { out[k] = crossing ? T.SAND : T.WATER; continue; }
        if (shape === 'continent') {
          if (c < 0.3) out[k] = T.WATER;
          else if (c < 0.37) out[k] = T.SAND;
          else if (c > thr || (g > 0.78 && slope > 0.1)) out[k] = T.MOUNTAIN;
          else if (slope > 0.16 && g > 0.58) out[k] = T.STONE;
          else if (m < 0.3 && hh < 0.3 && slope < 0.08) out[k] = T.DIRT;
          else out[k] = m > 0.52 ? T.SHORT_GRASS : T.LONG_GRASS;
          continue;
        }
        if (shape === 'desert') {
          const e = noise.warpedFbm(s * 0.026 + 1500, i * 0.026 - 1300, 4, 0.9);
          const t = noise.ridgedFbm(s * 0.035 + 50, i * 0.018 + 50, 4);
          if (c < 0.29) out[k] = T.WATER;
          else if (c < 0.36) out[k] = T.SAND;
          else if (e > 0.77 && c < 0.52) out[k] = e > 0.84 ? T.LONG_GRASS : T.SAND;
          else if (c > thr || (t > 0.78 && slope > 0.1)) out[k] = T.MOUNTAIN;
          else if (slope > 0.16 || hh < 0.25) out[k] = T.STONE;
          else out[k] = T.SAND;
          continue;
        }
        if (shape === 'snowland') {
          const e = noise.warpedFbm(s * 0.018 + 870, i * 0.018 - 510, 5, 0.95);
          if (c < 0.27) out[k] = T.WATER;
          else if (c < 0.4 || (e > 0.68 && g < 0.72)) out[k] = T.ICE;
          else if (c > thr) out[k] = T.MOUNTAIN;
          else if (slope > 0.18 || (g > 0.74 && hh < 0.58)) out[k] = T.STONE;
          else out[k] = T.SNOW;
          continue;
        }
        out[k] = c < 0.3 ? T.WATER : c < 0.38 ? T.SAND
          : c < 0.58 ? (m < 0.42 || slope > 0.22 ? T.DIRT : (m > 0.52 && hh > 0.25 ? T.SHORT_GRASS : T.LONG_GRASS))
          : c < thr ? (m < 0.4 || slope > 0.25 ? T.DIRT : (m > 0.54 ? T.SHORT_GRASS : T.LONG_GRASS))
          : T.MOUNTAIN;
      }
    }
    return out;
  }

  /** 原版 cleanupTerrainArtifacts：同水/陆属性的 8 邻域多数（≥6）覆盖孤立格 */
  function cleanupArtifacts(src, w, h) {
    const out = src.slice(), cnt = new Uint8Array(16);
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const k = y * w + x, t = src[k], tw = isWaterT(t);
      cnt.fill(0);
      let best = 0, bestN = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const c = src[k + dy * w + dx];
        if (isWaterT(c) === tw) { const n = ++cnt[c]; if (n > bestN) { bestN = n; best = c; } }
      }
      if (bestN >= 6 && best !== t) out[k] = best;
    }
    return out;
  }
  /** 原版 uE 中的浅水：与特定陆地 4 邻接的水 → 浅水 */
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
  /** 原版 TE：两岸狭路的 3 处渡口（河道上铺沙） */
  function twoSidesCrossings(noise, cats, w, h, st = 1, gw = w, gh = h) {
    for (let gy = 0; gy < gh; gy++) {
      const y = gy * st;
      if (!isCrossingRow(noise, y, h)) continue;
      const c = channelCenter(noise, y, w, h), r = channelHalfWidth(noise, y, w, h);
      for (let x = Math.floor((c - r - 1) / st); x <= Math.ceil((c + r + 1) / st); x++) if (x >= 0 && x < gw) cats[gy * gw + x] = T.SAND;
    }
  }

  /**
   * 生成 APK 同款逻辑地形。
   * @param {{shape:string,width:number,height:number,seed?:number,land?:number,rough?:number,stride?:number}} o
   *   stride>1 时按步长在完整地图坐标上采样（用于大地图的快速预览），输出尺寸为 ceil(width/stride)×ceil(height/stride)
   * @returns {Uint8Array} 取值见 T
   */
  function generateCategories(o) {
    const w = o.width | 0, h = o.height | 0, shape = SHAPE_MAP.has(o.shape) ? o.shape : 'island';
    const seed = normSeed(o.seed ?? 42);
    const land = clamp01(o.land ?? 0.5), rough = clamp01(o.rough ?? 0.3);
    const ctx = { noise: new PermNoise(seed), nat: new NaturalNoise(seed + 7919, { warpAmplitude: 0.9 }) };
    const st = Math.max(1, Math.floor(o.stride || 1)), gw = Math.ceil(w / st), gh = Math.ceil(h / st);
    const need = o._need || null, prog = o._progress || null;
    const H = heightMap(ctx, w, h, shape, land, st, gw, gh, need, prog && (f => prog('terrain', f * 0.5)));
    let cats = classify(ctx, H, w, h, shape, rough, st, gw, gh, need, prog && (f => prog('terrain', 0.5 + f * 0.5)));
    cats = shallowShore(cleanupArtifacts(cats, gw, gh), gw, gh);
    if (shape === 'two_sides') twoSidesCrossings(new PermNoise(seed), cats, w, h, st, gw, gh);
    return cats;
  }

  /* ================================================================ 第二部分：可对战化后处理（本项目新增）
   * 原版模板是给「锈匠」的逻辑地形用的，直接交给本项目的引擎会有几个问题：
   *   ① 不对称 —— 竞技地图一般要求镜像对称，出生点 / 资源的镜像也依赖地形对称；
   *   ② 碎岛、单格水坑、1～2 格宽的山体会被引擎渲染成破碎的悬崖；
   *   ③ 山地在本引擎里是「带悬崖的高地」，原版没有坡道，高地上的出生点 / 资源会被困死；
   *   ④ 双河等模板的河流把陆地完全隔开，地面部队无法交战；山脉还可能把一片空地围死。
   * 这里逐项处理。所有修改都写入「对称源半区」再整体镜像，保证结果严格对称。 */
  const VIEW = Object.assign({ FORD: 13, RAMP: 14 }, T);

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
    let id = 0;
    for (let s = 0; s < n; s++) {
      if (lab[s] || !pred(s)) continue;
      id++; let top = 0, size = 0, onB = false;
      stack[top++] = s; lab[s] = id;
      while (top) {
        const k = stack[--top]; size++;
        const r = (k / w) | 0, c = k - r * w;
        if (r === 0 || c === 0 || r === h - 1 || c === w - 1) onB = true;
        for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
          if ((!dr && !dc) || (!conn8 && dr && dc)) continue;
          const rr = r + dr, cc = c + dc;
          if (rr < 0 || cc < 0 || rr >= h || cc >= w) continue;
          const q = rr * w + cc;
          if (!lab[q] && pred(q)) { lab[q] = id; stack[top++] = q; }
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
   * 完整流程：原版分类 → 对称 → 清理 → 浅滩 → 高地整形 → 坡道 / 凿通道 → 引擎矩阵。
   * @returns {{width,height,data:Int32Array,view:Uint8Array,stats:object}}
   *   data：交给引擎 set_coastline_from_image（0 水 / 1 平地 / 2 高地 / -2 高地坡道）
   *   view：预览用类别（T 的取值 + FORD 浅滩 + RAMP 坡道）
   */
  function build(o) {
    const st = Math.max(1, Math.floor(o.stride || 1));
    const w = Math.ceil((o.width | 0) / st), h = Math.ceil((o.height | 0) / st), n = w * h;
    const meta = SHAPE_MAP.get(o.shape) || SHAPES[0];
    const seed = normSeed(o.seed ?? 42);
    const rng = mulberry32(seed ^ 0x5bd1e995);
    const src = mirrorSource(o.mirror || 'none', w, h);
    const prog = typeof o.onProgress === 'function' ? o.onProgress : null;
    // 对称时只需计算「对称源半区 + 3 格边距」（分类 / 清理 / 浅水都只依赖 3 格内的邻居，结果与整图计算逐格相同），
    // 其余格之后由镜像填充 —— Y 轴 / X 轴对称省一半时间，XY 双轴省 3/4。
    const M = 3, mode = src ? o.mirror : 'none';
    const need = mode === 'vertical' ? (x, y) => x <= (w - 1) / 2 + M
      : mode === 'horizontal' ? (x, y) => y <= (h - 1) / 2 + M
      : mode === 'both' ? (x, y) => x <= (w - 1) / 2 + M && y <= (h - 1) / 2 + M
      : mode === 'diagonal1' ? (x, y) => x >= y - M
      : mode === 'diagonal2' ? (x, y) => x + y <= w - 1 + M : null;
    const cats = generateCategories({ ...o, shape: meta.id, seed, stride: st, _need: need, _progress: prog });
    prog && prog('shape', 0);
    const sym = !!src;
    const canon = k => !src || src(k) === k;
    const mirror = arr => { if (src) for (let k = 0; k < n; k++) { const s = src(k); if (s !== k) arr[k] = arr[s]; } };
    const put = (arr, k, v) => { arr[src ? src(k) : k] = v; };
    const area = n;
    const stats = { shape: meta.id, seed, mirror: sym ? o.mirror : 'none', islandsRemoved: 0, lakesFilled: 0, fords: 0, plateaus: 0, ramps: 0, channels: 0, connected: true };

    mirror(cats);
    const buf = makeBfsBuf(n);
    const land = new Uint8Array(n), mount = new Uint8Array(n), gap = new Uint8Array(n), ford = new Uint8Array(n);
    for (let k = 0; k < n; k++) {
      const t = cats[k];
      land[k] = isWaterT(t) || t === T.LAVA ? 0 : 1;
      mount[k] = t === T.MOUNTAIN ? 1 : 0;
    }

    /* ① 碎岛 / 小水坑 */
    const minIsland = Math.max(16, Math.round(area * 0.0012)), minLake = Math.max(12, Math.round(area * 0.0008));
    {
      const L = label(k => land[k] === 1, w, h, false);
      for (let k = 0; k < n; k++) if (L.label[k] && L.sizes[L.label[k]] < minIsland) { land[k] = 0; mount[k] = 0; }
      stats.islandsRemoved = L.sizes.filter((s, i) => i && s < minIsland).length;
      const W = label(k => land[k] === 0, w, h, false);
      for (let k = 0; k < n; k++) { const id = W.label[k]; if (id && !W.border[id] && W.sizes[id] < minLake) land[k] = 1; }
      stats.lakesFilled = W.sizes.filter((s, i) => i && !W.border[i] && s < minLake).length;
    }

    /* ② 浅滩：把被水隔开的大块陆地连起来（群岛 / 岛屿保留海战特色，不连） */
    if (meta.bridge) {
      const maxGap = Math.max(10, Math.round(Math.min(w, h) * 0.14));
      const links = meta.id === 'river' ? 2 : 1;
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
    const data = new Int32Array(n), view = new Uint8Array(n);
    let landN = 0, mountN = 0;
    for (let k = 0; k < n; k++) {
      const t = cats[k];
      if (!land[k]) { data[k] = 0; view[k] = t === T.LAVA ? T.LAVA : t === T.SHALLOW ? T.SHALLOW : isWaterT(t) ? T.WATER : T.SHALLOW; continue; }
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
    stats.mountainRatio = +(mountN / n).toFixed(3);
    stats.landmasses = Lf.sizes.filter((s, i) => i && s >= minIsland).length;
    return { width: w, height: h, data, view, stats };
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

  const API = { VERSION: '1.0', T, VIEW, SHAPES, SHAPE_MAP, normSeed, generateCategories, build, preview, paint, COLORS, mirrorSource };
  root.TerrainShapes = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
