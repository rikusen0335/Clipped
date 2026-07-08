use std::io::{BufRead, BufReader};
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, State};

/// 実行中のffmpegプロセスを保持(キャンセル用)
struct ExportState(Mutex<Option<Child>>);

#[derive(Clone, Serialize)]
struct ExportProgress {
    /// 0.0 - 1.0
    ratio: f64,
    /// 出力済み秒数
    out_time: f64,
}

/// 同梱(sidecar)のffmpegを優先し、無ければPATHのffmpegにフォールバックする
fn ffmpeg_binary() -> PathBuf {
    let name = if cfg!(windows) { "ffmpeg.exe" } else { "ffmpeg" };
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            let bundled = dir.join(name);
            if bundled.exists() {
                return bundled;
            }
        }
    }
    PathBuf::from("ffmpeg")
}

/// Windowsでコンソールウィンドウを出さない
fn ffmpeg_command() -> Command {
    let cmd = Command::new(ffmpeg_binary());
    #[cfg(windows)]
    let cmd = {
        use std::os::windows::process::CommandExt;
        let mut c = cmd;
        c.creation_flags(0x0800_0000); // CREATE_NO_WINDOW
        c
    };
    cmd
}

/// ffmpegが使えるかチェックし、バージョン文字列を返す
#[tauri::command]
fn check_ffmpeg() -> Result<String, String> {
    let output = ffmpeg_command()
        .arg("-version")
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .output()
        .map_err(|e| format!("ffmpeg not found: {e}"))?;
    let text = String::from_utf8_lossy(&output.stdout);
    Ok(text.lines().next().unwrap_or("ffmpeg").to_string())
}

/// クリップを書き出す。modeは "copy"(無劣化・高速)か "encode"(再エンコード・フレーム精度)
#[tauri::command]
async fn export_clip(
    app: AppHandle,
    state: State<'_, ExportState>,
    input: String,
    output: String,
    start: f64,
    end: f64,
    mode: String,
) -> Result<(), String> {
    if end <= start {
        return Err("End position must be after start position".into());
    }
    let duration = end - start;

    let mut cmd = ffmpeg_command();
    cmd.arg("-y")
        .args(["-ss", &format!("{start:.4}")])
        .args(["-i", &input])
        .args(["-t", &format!("{duration:.4}")]);

    match mode.as_str() {
        "copy" => {
            cmd.args(["-c", "copy", "-avoid_negative_ts", "make_zero"]);
        }
        "encode" => {
            cmd.args([
                "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-c:a", "aac", "-b:a",
                "192k",
            ]);
        }
        other => return Err(format!("Unknown mode: {other}")),
    }

    cmd.args(["-progress", "pipe:1", "-nostats", "-loglevel", "error"])
        .arg(&output)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    let mut child = cmd
        .spawn()
        .map_err(|e| format!("Failed to start ffmpeg: {e}"))?;

    let stdout = child.stdout.take().ok_or("Failed to capture stdout")?;
    let stderr = child.stderr.take().ok_or("Failed to capture stderr")?;

    // stderr(エラーメッセージ)は別スレッドで回収
    let stderr_handle = std::thread::spawn(move || {
        let mut buf = String::new();
        for line in BufReader::new(stderr).lines().map_while(Result::ok) {
            buf.push_str(&line);
            buf.push('\n');
        }
        buf
    });

    *state.0.lock().unwrap() = Some(child);

    // stdoutの -progress 出力をパースして進捗イベントを送る
    for line in BufReader::new(stdout).lines().map_while(Result::ok) {
        if let Some(us) = line.strip_prefix("out_time_us=") {
            if let Ok(us) = us.trim().parse::<i64>() {
                let out_time = us as f64 / 1_000_000.0;
                let ratio = (out_time / duration).clamp(0.0, 1.0);
                let _ = app.emit("export://progress", ExportProgress { ratio, out_time });
            }
        }
    }

    let status = {
        let mut guard = state.0.lock().unwrap();
        match guard.take() {
            Some(mut child) => child.wait().map_err(|e| e.to_string())?,
            // takeされている = キャンセル済み
            None => return Err("Export cancelled".into()),
        }
    };

    let err_text = stderr_handle.join().unwrap_or_default();
    if status.success() {
        let _ = app.emit("export://progress", ExportProgress { ratio: 1.0, out_time: duration });
        Ok(())
    } else {
        Err(if err_text.trim().is_empty() {
            "ffmpeg exited with an error".into()
        } else {
            err_text.trim().to_string()
        })
    }
}

/// コンテキストメニュー等からコマンドライン引数で渡されたファイルを返す
#[tauri::command]
fn get_cli_file() -> Option<String> {
    std::env::args()
        .nth(1)
        .filter(|p| std::path::Path::new(p).is_file())
}

/// 書き出しをキャンセルする
#[tauri::command]
fn cancel_export(state: State<'_, ExportState>) -> Result<(), String> {
    if let Some(mut child) = state.0.lock().unwrap().take() {
        child.kill().map_err(|e| e.to_string())?;
        let _ = child.wait(); // ゾンビプロセス回収
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // WSLではWSLgのXサーバがDRI3を提供せず、WebKitのDMA-BUF/GPUレンダリングが
    // 黒画面を引き起こすため無効化する
    #[cfg(target_os = "linux")]
    {
        let is_wsl = std::fs::read_to_string("/proc/version")
            .map(|v| v.to_lowercase().contains("microsoft"))
            .unwrap_or(false);
        if is_wsl {
            if std::env::var_os("WEBKIT_DISABLE_DMABUF_RENDERER").is_none() {
                std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
            }
            if std::env::var_os("LIBGL_ALWAYS_SOFTWARE").is_none() {
                std::env::set_var("LIBGL_ALWAYS_SOFTWARE", "1");
            }
        }
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            app.manage(ExportState(Mutex::new(None)));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            check_ffmpeg,
            export_clip,
            cancel_export,
            get_cli_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
