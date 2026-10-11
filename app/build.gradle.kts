plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.tmxmapforge.offline"
    compileSdk = 35
    defaultConfig {
        applicationId = "com.tmxmapforge.offline"
        minSdk = 23
        targetSdk = 35
        // 3.3.0-offline (13) → 3.4.0-offline (14)：小地图 PNG 显示出生点/资源点 + 第四轮全局审查
        versionCode = 14
        versionName = "3.4.0-offline"
    }
    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
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
