# MainActivity.kt 离线类型检查

容器里没有 Android SDK / Gradle（也无法访问 Google Maven），不能直接 `assembleDebug`。
3.10.0 改用下面的方法对 `MainActivity.kt` 做**真实的 Kotlin 编译与类型检查**：

- 编译器：官方 `kotlin-compiler-2.0.21.zip`（与项目 `org.jetbrains.kotlin.android` 2.0.21 同版本，GitHub Releases 下载）
- 平台 API：真实的 Android 35 `android.jar`（与 `compileSdk = 35` 一致）
- androidx：`stubs/` 下按 MainActivity 实际用到的签名手写的最小存根（ComponentActivity、ActivityResultContracts、
  ViewCompat / WindowInsetsCompat、WebViewAssetLoader 等），只用于类型检查，**不参与打包**

```bash
kotlinc -cp android.jar -jvm-target 17 -d out stubs/*.kt stubs/r/*.kt \
  ../../app/src/main/java/com/tmxmapforge/offline/MainActivity.kt
```

局限：存根只保证「签名对得上」，androidx 内部行为、资源合并、R8 等仍需在装有 Android SDK 的机器上用
`./gradlew assembleDebug` 正式构建验证。
