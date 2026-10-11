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
        // 3.4.0-offline (14) → 3.5.0-offline (15)：新增 PC 版（desktop/，Rust + Tauri 2），前端与 PC 共用
        versionCode = 15
        versionName = "3.5.0-offline"
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
