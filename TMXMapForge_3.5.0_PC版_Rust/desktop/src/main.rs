//! 铁锈战争地图生成器 · TMX MapForge —— PC 版（Rust + Tauri 2）
//!
//! 移植原则：前端（HTML / CSS / JS）、生成引擎（Rust → WASM）与布局样式完全复用 Android 版
//! `app/src/main/assets/`，不做分叉。本程序只替换 Android 宿主 `MainActivity.kt` 的职责：
//!
//! | Android（Kotlin）                         | PC（本文件，Rust）                                  |
//! | ----------------------------------------- | --------------------------------------------------- |
//! | WebView + WebViewAssetLoader 加载 assets   | Tauri 内嵌资源（tauri.conf.json → frontendDist）     |
//! | AndroidBridge.beginSave/appendChunk/finish | `save_file`：二进制 IPC 一次写入「导出目录」          |
//! | MediaStore / Download 目录                 | 默认系统「下载」目录，可在界面中更改并持久化           |
//! | setSystemBars（状态栏颜色随主题）           | `set_window_theme`：标题栏深 / 浅色随主题             |
//! | onPause → __onAppPause 自动保存            | 关闭窗口 → __desktopBeforeClose 保存后 `confirm_close` |
//! | 返回键 / 屏幕常亮                           | 不需要（Esc 已由网页处理；PC 不息屏）                 |
//!
//! 与 Android 版相比的 PC 专属增强：导出目录设置、「在文件夹中显示」、窗口大小 / 位置记忆、
//! F11 全屏、TMX / 项目 / 图片拖放导入（见 assets/desktop-bridge.js）。
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Mutex, MutexGuard};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use tauri::ipc::{InvokeBody, Request};
use tauri::{Manager, PhysicalPosition, PhysicalSize, Position, Size, State, Theme, WebviewWindow, WindowEvent};

const MAIN_WINDOW: &str = "main";
const MIN_WIDTH: u32 = 960;
const MIN_HEIGHT: u32 = 620;
/// 关闭窗口时等待网页自动保存的最长时间，超时直接关闭，避免页面异常时窗口关不掉
const CLOSE_TIMEOUT: Duration = Duration::from_secs(4);
/// TMX 因重名被改名后，在这段时间内导出的同名 `_map.png` 使用相同的新名字（保持成对）
const PAIR_WINDOW: Duration = Duration::from_secs(60);

/* ------------------------------------------------------------------ 配置（导出目录、窗口几何） */

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(default)]
struct Config {
    export_dir: Option<PathBuf>,
    window: Option<WindowGeom>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
struct WindowGeom {
    x: i32,
    y: i32,
    width: u32,
    height: u32,
    maximized: bool,
}

/// 最近一次 TMX 的重名改名记录：from = 原始文件名主干，to = 实际写入的主干
struct Pairing {
    from: String,
    to: String,
    at: Instant,
}

struct AppState {
    config: Mutex<Config>,
    config_path: PathBuf,
    default_export_dir: PathBuf,
    pairing: Mutex<Option<Pairing>>,
    closing: AtomicBool,
}

fn lock<T>(m: &Mutex<T>) -> MutexGuard<'_, T> {
    // 某次命令 panic 导致锁中毒时仍可继续使用（配置数据本身不会因此损坏）
    m.lock().unwrap_or_else(|e| e.into_inner())
}

impl AppState {
    fn export_dir(&self) -> PathBuf {
        lock(&self.config)
            .export_dir
            .clone()
            .filter(|p| p.is_dir())
            .unwrap_or_else(|| self.default_export_dir.clone())
    }

    fn save_config(&self) {
        let cfg = lock(&self.config).clone();
        if let Some(dir) = self.config_path.parent() {
            let _ = fs::create_dir_all(dir);
        }
        if let Ok(text) = serde_json::to_string_pretty(&cfg) {
            let _ = fs::write(&self.config_path, text);
        }
    }

    /// 计算导出目标路径：重名时加 `_1`、`_2` 后缀；并保证 `xxx.tmx` 与 `xxx_map.png` 同名成对
    fn target_for(&self, dir: &Path, filename: &str) -> PathBuf {
        let (stem, ext) = split_ext(filename);
        let mut pairing = lock(&self.pairing);
        if let Some(p) = pairing.as_ref() {
            if p.at.elapsed() < PAIR_WINDOW && p.from != p.to {
                if let Some(rest) = stem.strip_prefix(p.from.as_str()) {
                    if rest == "_map" {
                        let candidate = dir.join(format!("{}{}{}", p.to, rest, ext));
                        if !candidate.exists() {
                            return candidate;
                        }
                    }
                }
            }
        }
        let target = unique_path(dir, filename);
        if ext.eq_ignore_ascii_case(".tmx") {
            let written = target
                .file_name()
                .map(|n| split_ext(&n.to_string_lossy()).0.to_string())
                .unwrap_or_else(|| stem.to_string());
            *pairing = Some(Pairing { from: stem.to_string(), to: written, at: Instant::now() });
        }
        target
    }
}

/* ------------------------------------------------------------------ 文件名工具（与 MainActivity.safeName 一致） */

fn now_millis() -> u128 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_millis()).unwrap_or(0)
}

/// 去掉非法字符、`..`、首尾空格和点号，限制 120 字符；额外处理 Windows 保留设备名（CON、NUL、COM1…）
fn safe_name(name: &str) -> String {
    let replaced: String = name
        .chars()
        .map(|c| match c {
            '\\' | '/' | ':' | '*' | '?' | '"' | '<' | '>' | '|' => '_',
            c if (c as u32) < 0x20 => '_',
            c => c,
        })
        .collect();
    let replaced = replaced.replace("..", "_");
    let trimmed = replaced.trim().trim_matches(|c: char| c == '.' || c == ' ');
    let mut out: String = trimmed.chars().take(120).collect();
    if out.is_empty() {
        out = format!("export_{}", now_millis());
    }
    let stem_upper = split_ext(&out).0.to_ascii_uppercase();
    const RESERVED: [&str; 22] = [
        "CON", "PRN", "AUX", "NUL", "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9",
        "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9",
    ];
    if RESERVED.contains(&stem_upper.as_str()) {
        out.insert(0, '_');
    }
    out
}

/// 拆分 "a.b.tmx" → ("a.b", ".tmx")；没有扩展名时 ext 为空
fn split_ext(name: &str) -> (&str, &str) {
    match name.rfind('.') {
        Some(i) if i > 0 => (&name[..i], &name[i..]),
        _ => (name, ""),
    }
}

fn unique_path(dir: &Path, filename: &str) -> PathBuf {
    let first = dir.join(filename);
    if !first.exists() {
        return first;
    }
    let (stem, ext) = split_ext(filename);
    for n in 1..10_000 {
        let p = dir.join(format!("{stem}_{n}{ext}"));
        if !p.exists() {
            return p;
        }
    }
    dir.join(format!("{stem}_{}{ext}", now_millis()))
}

/// 解码 encodeURIComponent 编码的文件名（HTTP 头只能携带 ASCII）
fn percent_decode(s: &str) -> String {
    fn hex(b: u8) -> Option<u8> {
        match b {
            b'0'..=b'9' => Some(b - b'0'),
            b'a'..=b'f' => Some(b - b'a' + 10),
            b'A'..=b'F' => Some(b - b'A' + 10),
            _ => None,
        }
    }
    let b = s.as_bytes();
    let mut out = Vec::with_capacity(b.len());
    let mut i = 0;
    while i < b.len() {
        if b[i] == b'%' && i + 2 < b.len() {
            if let (Some(h), Some(l)) = (hex(b[i + 1]), hex(b[i + 2])) {
                out.push(h * 16 + l);
                i += 3;
                continue;
            }
        }
        out.push(b[i]);
        i += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

fn header(request: &Request<'_>, name: &str) -> Option<String> {
    request.headers().get(name).and_then(|v| v.to_str().ok()).map(percent_decode)
}

/* ------------------------------------------------------------------ 打开文件夹 / 在文件夹中显示 */

fn reveal(path: &Path) -> std::io::Result<()> {
    #[cfg(target_os = "windows")]
    {
        if path.is_file() {
            Command::new("explorer").arg("/select,").arg(path).spawn()?;
        } else {
            Command::new("explorer").arg(path).spawn()?;
        }
    }
    #[cfg(target_os = "macos")]
    {
        let mut cmd = Command::new("open");
        if path.is_file() {
            cmd.arg("-R");
        }
        cmd.arg(path).spawn()?;
    }
    #[cfg(all(unix, not(target_os = "macos")))]
    {
        let dir = if path.is_file() { path.parent().unwrap_or(path) } else { path };
        Command::new("xdg-open").arg(dir).spawn()?;
    }
    Ok(())
}

/* ------------------------------------------------------------------ Rust 命令（供 assets/desktop-bridge.js 调用） */

#[derive(Serialize)]
struct SaveResult {
    name: String,
    path: String,
    dir: String,
}

/// 保存导出文件（TMX / _map.png / ZIP / 项目 JSON）。
/// 前端以原始二进制作为请求体（Tauri 2 raw IPC，几十 MB 的 TMX 也无需 Base64），
/// 文件名经 encodeURIComponent 放在 `x-file-name` 头中。
/// 先写入 `.part` 临时文件再改名，避免中途失败留下半个文件。
#[tauri::command]
fn save_file(request: Request<'_>, state: State<'_, AppState>) -> Result<SaveResult, String> {
    let name = header(&request, "x-file-name").ok_or("缺少文件名")?;
    let owned;
    let bytes: &[u8] = match request.body() {
        InvokeBody::Raw(b) => b.as_slice(),
        // 兜底：极旧的 WebView 不支持二进制 IPC 时，数据以 JSON 数字数组传入
        InvokeBody::Json(v) => {
            owned = v
                .as_array()
                .ok_or("导出数据格式错误")?
                .iter()
                .map(|x| x.as_u64().map(|n| n as u8).ok_or("导出数据格式错误"))
                .collect::<Result<Vec<u8>, _>>()?;
            owned.as_slice()
        }
    };
    let dir = state.export_dir();
    fs::create_dir_all(&dir).map_err(|e| format!("无法创建导出目录 {}：{e}", dir.display()))?;
    let target = state.target_for(&dir, &safe_name(&name));
    let tmp = PathBuf::from(format!("{}.part", target.display()));
    fs::write(&tmp, bytes).map_err(|e| {
        let _ = fs::remove_file(&tmp);
        format!("写入失败：{e}")
    })?;
    fs::rename(&tmp, &target).map_err(|e| {
        let _ = fs::remove_file(&tmp);
        format!("保存失败：{e}")
    })?;
    Ok(SaveResult {
        name: target.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or(name),
        path: target.display().to_string(),
        dir: dir.display().to_string(),
    })
}

#[derive(Serialize)]
struct DirInfo {
    path: String,
    is_default: bool,
}

fn dir_info(state: &AppState) -> DirInfo {
    let path = state.export_dir();
    DirInfo { is_default: path == state.default_export_dir, path: path.display().to_string() }
}

#[tauri::command]
fn get_export_dir(state: State<'_, AppState>) -> DirInfo {
    dir_info(&state)
}

/// 选择导出目录。同步命令在主线程执行，正好满足 macOS / GTK 原生对话框必须在主线程弹出的要求。
#[tauri::command]
fn choose_export_dir(state: State<'_, AppState>) -> Option<DirInfo> {
    let picked = rfd::FileDialog::new()
        .set_title("选择地图导出目录")
        .set_directory(state.export_dir())
        .pick_folder()?;
    lock(&state.config).export_dir = Some(picked);
    state.save_config();
    Some(dir_info(&state))
}

#[tauri::command]
fn reset_export_dir(state: State<'_, AppState>) -> DirInfo {
    lock(&state.config).export_dir = None;
    state.save_config();
    dir_info(&state)
}

/// 在文件管理器中显示文件（path 为空时打开导出目录）
#[tauri::command]
fn open_path(path: Option<String>, state: State<'_, AppState>) -> Result<(), String> {
    let p = path.map(PathBuf::from).filter(|p| p.exists()).unwrap_or_else(|| state.export_dir());
    reveal(&p).map_err(|e| format!("无法打开文件夹：{e}"))
}

/// 标题栏深 / 浅色跟随网页主题（对应 Android 的 setSystemBars）
#[tauri::command]
fn set_window_theme(window: WebviewWindow, light: bool) {
    let _ = window.set_theme(Some(if light { Theme::Light } else { Theme::Dark }));
}

#[tauri::command]
fn toggle_fullscreen(window: WebviewWindow) -> bool {
    let next = !window.is_fullscreen().unwrap_or(false);
    let _ = window.set_fullscreen(next);
    next
}

/// 网页完成关闭前的自动保存后调用，真正关闭窗口
#[tauri::command]
fn confirm_close(window: WebviewWindow) {
    let _ = window.destroy();
}

#[derive(Serialize)]
struct AppInfo {
    version: &'static str,
    platform: &'static str,
    debug: bool,
    export_dir: String,
    config_path: String,
}

#[tauri::command]
fn app_info(state: State<'_, AppState>) -> AppInfo {
    AppInfo {
        version: env!("CARGO_PKG_VERSION"),
        platform: std::env::consts::OS,
        debug: cfg!(debug_assertions),
        export_dir: state.export_dir().display().to_string(),
        config_path: state.config_path.display().to_string(),
    }
}

/* ------------------------------------------------------------------ 窗口几何记忆 */

fn remember_geometry(window: &WebviewWindow, state: &AppState) {
    let maximized = window.is_maximized().unwrap_or(false);
    let fullscreen = window.is_fullscreen().unwrap_or(false);
    let mut cfg = lock(&state.config);
    if maximized || fullscreen {
        // 最大化时只记录状态，保留上一次的普通窗口尺寸，取消最大化后恢复原大小
        match cfg.window.as_mut() {
            Some(g) => g.maximized = maximized,
            None => {
                cfg.window = Some(WindowGeom { x: 0, y: 0, width: 1366, height: 860, maximized });
            }
        }
    } else if let (Ok(p), Ok(s)) = (window.outer_position(), window.inner_size()) {
        cfg.window = Some(WindowGeom { x: p.x, y: p.y, width: s.width, height: s.height, maximized: false });
    }
}

fn restore_geometry(window: &WebviewWindow, state: &AppState) {
    let Some(g) = lock(&state.config).window else { return };
    if g.width >= MIN_WIDTH && g.height >= MIN_HEIGHT && g.width <= 16_384 && g.height <= 16_384 {
        let _ = window.set_size(Size::Physical(PhysicalSize { width: g.width, height: g.height }));
    }
    // 只有左上角落在某个显示器内才恢复位置（防止拔掉外接显示器后窗口跑到屏幕外）
    let on_screen = window
        .available_monitors()
        .map(|ms| {
            ms.iter().any(|m| {
                let (mp, sz) = (m.position(), m.size());
                g.x + 40 >= mp.x
                    && g.y >= mp.y
                    && g.x + 40 < mp.x + sz.width as i32
                    && g.y + 40 < mp.y + sz.height as i32
            })
        })
        .unwrap_or(false);
    if on_screen {
        let _ = window.set_position(Position::Physical(PhysicalPosition { x: g.x, y: g.y }));
    }
    if g.maximized {
        let _ = window.maximize();
    }
}

/* ------------------------------------------------------------------ 入口 */

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let paths = app.path();
            let config_path = paths
                .app_config_dir()
                .unwrap_or_else(|_| std::env::temp_dir().join("tmx-mapforge"))
                .join("desktop-config.json");
            let default_export_dir = paths
                .download_dir()
                .or_else(|_| paths.document_dir())
                .or_else(|_| paths.home_dir())
                .unwrap_or_else(|_| std::env::temp_dir());
            let config: Config = fs::read_to_string(&config_path)
                .ok()
                .and_then(|t| serde_json::from_str(&t).ok())
                .unwrap_or_default();
            app.manage(AppState {
                config: Mutex::new(config),
                config_path,
                default_export_dir,
                pairing: Mutex::new(None),
                closing: AtomicBool::new(false),
            });
            if let Some(window) = app.get_webview_window(MAIN_WINDOW) {
                restore_geometry(&window, &app.state::<AppState>());
                // 窗口以隐藏状态创建，恢复尺寸后再显示，避免启动时窗口跳动
                let _ = window.show();
                let _ = window.set_focus();
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                let state = window.state::<AppState>();
                if state.closing.swap(true, Ordering::SeqCst) {
                    return; // 第二次点击关闭：不再拦截
                }
                api.prevent_close();
                if let Some(webview) = window.get_webview_window(window.label()) {
                    remember_geometry(&webview, &state);
                    state.save_config();
                    // 交给网页：先自动保存项目草稿（IndexedDB），完成后调用 confirm_close
                    let _ = webview.eval(
                        "(window.__desktopBeforeClose ? window.__desktopBeforeClose() \
                         : window.__TAURI__.core.invoke('confirm_close'))",
                    );
                }
                let w = window.clone();
                std::thread::spawn(move || {
                    std::thread::sleep(CLOSE_TIMEOUT);
                    let _ = w.destroy();
                });
            }
        })
        .invoke_handler(tauri::generate_handler![
            save_file,
            get_export_dir,
            choose_export_dir,
            reset_export_dir,
            open_path,
            set_window_theme,
            toggle_fullscreen,
            confirm_close,
            app_info
        ])
        .run(tauri::generate_context!())
        .expect("铁锈战争地图生成器 PC 版启动失败");
}

/* ------------------------------------------------------------------ 单元测试（cargo test） */

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn safe_name_matches_android_rules() {
        assert_eq!(safe_name("[p2](2)泥沼by_MP97.tmx"), "[p2](2)泥沼by_MP97.tmx");
        assert_eq!(safe_name("a/b:c*d?.tmx"), "a_b_c_d_.tmx");
        assert_eq!(safe_name("  ..地图.  "), "_地图");
        assert_eq!(safe_name("CON.tmx"), "_CON.tmx");
        assert!(safe_name("").starts_with("export_"));
        assert_eq!(safe_name(&"长".repeat(200)).chars().count(), 120);
    }

    #[test]
    fn split_ext_works() {
        assert_eq!(split_ext("a.b.tmx"), ("a.b", ".tmx"));
        assert_eq!(split_ext(".hidden"), (".hidden", ""));
        assert_eq!(split_ext("noext"), ("noext", ""));
    }

    #[test]
    fn percent_decode_utf8() {
        assert_eq!(percent_decode("%E5%9C%B0%E5%9B%BE_map.png"), "地图_map.png");
        assert_eq!(percent_decode("100%"), "100%");
        assert_eq!(percent_decode("%4"), "%4");
        assert_eq!(percent_decode("%zz"), "%zz");
    }

    #[test]
    fn tmx_and_png_stay_paired_after_rename() {
        let dir = std::env::temp_dir().join(format!("tmxmf_test_{}", now_millis()));
        fs::create_dir_all(&dir).unwrap();
        fs::write(dir.join("m.tmx"), b"old").unwrap();
        let state = AppState {
            config: Mutex::new(Config::default()),
            config_path: dir.join("cfg.json"),
            default_export_dir: dir.clone(),
            pairing: Mutex::new(None),
            closing: AtomicBool::new(false),
        };
        let tmx = state.target_for(&dir, "m.tmx");
        assert_eq!(tmx.file_name().unwrap().to_str().unwrap(), "m_1.tmx");
        fs::write(&tmx, b"new").unwrap();
        let png = state.target_for(&dir, "m_map.png");
        assert_eq!(png.file_name().unwrap().to_str().unwrap(), "m_1_map.png");
        let _ = fs::remove_dir_all(&dir);
    }
}
