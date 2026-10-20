import java.io.FileInputStream
import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// Release 签名配置只从本机 signing/keystore.properties 读取（该目录已被 .gitignore 排除）。
// 文件不存在时（如其他开发者克隆仓库后）不配置 release 签名，assembleRelease 产出未签名包，
// debug 构建不受影响。
val keystorePropertiesFile = rootProject.file("signing/keystore.properties")
val keystoreProperties = Properties().apply {
    if (keystorePropertiesFile.exists()) {
        FileInputStream(keystorePropertiesFile).use { load(it) }
    }
}

android {
    namespace = "com.tmxmapforge.offline"
    compileSdk = 35
    defaultConfig {
        applicationId = "com.tmxmapforge.offline"
        minSdk = 23
        targetSdk = 35
        // 3.2.0-offline (12) → 3.3.0-offline (13)：修复出生点序号 ↔ 游戏玩家(team)映射错误 + 第三轮全局审查
        // 3.3.0-offline (13) → 3.4.0-offline (14)：小地图 PNG 显示出生点/资源点 + 第四轮全局审查
        // 3.4.0-offline (14) / 3.5.0-offline (15) → 3.6.0-offline (16)：合并两条分支 + 第五轮审查 + 地图体检 / 领地图层 / 生成保护
        // 3.6.0-offline (16) → 3.7.0-offline (17)：第六轮审查（TMX 写回竞态 / 小地图成对命名等）+ 择优生成 / 接敌距离 / 体检精确化 / 分享海报
        // 3.7.0-offline (17) → 3.8.0-offline (18)：11 套地形形态模板 + 另存为 / 导出文件夹（SAF）+ 第七轮全局审查 + UI 动效
        // 3.8.0-offline (18) → 3.9.0-offline (19)：近家资源点 + 第八轮全局审查
        // 3.9.0-offline (19) → 3.10.0-offline (20)：屏幕方向锁定持久化（竖屏 / 横屏重启后保持）+ 第九轮全局审查 + UI 动效升级
        // 3.12.0-offline (22) → 3.13.0-offline (23)：离线启动回归测试修复 + 动效可访问性 + 第十二轮全局审查
        // 3.13.0-offline (23) → 3.14.0-offline (24)：第十三轮全局审查（近家资源点状态泄漏 / TMX 写回竞态 / 历史存储重构）+ 测距 / 历史收藏 / 导出候选 ZIP / 密度提示 / Android 一键分享
        // 3.14.0-offline (24) → 3.15.0-offline (25)：新图标 + 第十四轮全局审查（Toast 撤销错位 / TMX 补丁跨地图 / 近家资源撤销复活 / 处理中改出生点 / 引擎停用无法恢复）+ 命令面板 / 地形剖面 / 随机起名 / 复制小地图
        // 3.15.0-offline (25) → 3.16.0-offline (26)：5 套动态主题（极光 / 熔岩 / 星云 / 深潮 / 樱雾）+ 跟随系统 / 昼夜流转 + 主题选择面板
        // 3.16.0-offline (26) → 3.17.0-offline (27)：第十五轮全局审查（取消生成丢编辑状态 / Toast 撤销被去重吞掉 / 测距右键误删等 9 项）+ 配方码 / 实时体检徽章 / 触屏放大镜 / 专注模式 / 视图截图
        // 3.17.0-offline (27) → 3.18.0-offline (28)：第十六轮全局审查（海岸线 / 图片导入失败丢编辑状态、畸形 TMX 队伍号致主线程卡死、Android 文件选择器回调与持久授权泄漏、图层与标签页 aria 状态缺失，共 6 项）
        versionCode = 28
        versionName = "3.18.0-offline"
    }
    signingConfigs {
        create("release") {
            if (keystorePropertiesFile.exists()) {
                keyAlias = keystoreProperties["keyAlias"] as String
                keyPassword = keystoreProperties["keyPassword"] as String
                storeFile = rootProject.file(keystoreProperties["storeFile"] as String)
                storePassword = keystoreProperties["storePassword"] as String
            }
        }
    }
    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            if (keystorePropertiesFile.exists()) {
                signingConfig = signingConfigs.getByName("release")
            }
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
    // 资源目录中的 .wasm / .tmx 不压缩打包，WebViewAssetLoader 读取更快
    androidResources { noCompress.addAll(listOf("wasm", "tmx")) }
}

dependencies {
    implementation("androidx.activity:activity-ktx:1.9.3")
    implementation("androidx.webkit:webkit:1.12.1")
}
