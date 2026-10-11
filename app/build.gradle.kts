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
        versionCode = 14
        versionName = "3.4.0-offline"
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
