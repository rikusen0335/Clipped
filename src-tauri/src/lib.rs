use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};

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

/// 動画プレビュー配信用のローカルHTTPサーバー(127.0.0.1のみ)。
/// TauriのカスタムURIスキーム(asset://)経由だとLinux/WebKitGTKで
/// <video>要素の読み込みが不安定になることがあるため、HTTP Range
/// リクエストに正しく対応する自前のサーバーで配信する。
struct PreviewServer {
    current: Arc<Mutex<Option<PathBuf>>>,
    port: Mutex<Option<u16>>,
}

fn guess_content_type(path: &Path) -> &'static str {
    match path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_ascii_lowercase()
        .as_str()
    {
        "mp4" | "m4v" => "video/mp4",
        "webm" => "video/webm",
        "mkv" => "video/x-matroska",
        "mov" => "video/quicktime",
        "avi" => "video/x-msvideo",
        "ts" => "video/mp2t",
        _ => "application/octet-stream",
    }
}

/// "bytes=start-end" 形式のRangeヘッダをパースする(両端含む、閉区間)
fn parse_range(header: &str, file_len: u64) -> Option<(u64, u64)> {
    let spec = header.strip_prefix("bytes=")?;
    let (start_s, end_s) = spec.split_once('-')?;
    let start: u64 = if start_s.is_empty() {
        0
    } else {
        start_s.parse().ok()?
    };
    let end: u64 = if end_s.is_empty() {
        file_len.saturating_sub(1)
    } else {
        end_s.parse().ok()?
    };
    if file_len == 0 || start > end || start >= file_len {
        return None;
    }
    Some((start, end.min(file_len - 1)))
}

fn serve_preview_request(
    request: tiny_http::Request,
    current: &Arc<Mutex<Option<PathBuf>>>,
) -> std::io::Result<()> {
    use std::io::{Read, Seek, SeekFrom};

    let Some(path) = current.lock().unwrap().clone() else {
        return request.respond(tiny_http::Response::empty(404));
    };
    let Ok(mut file) = std::fs::File::open(&path) else {
        return request.respond(tiny_http::Response::empty(404));
    };
    let file_len = file.metadata()?.len();
    let content_type = guess_content_type(&path);

    let range = request
        .headers()
        .iter()
        .find(|h| h.field.equiv("Range"))
        .and_then(|h| parse_range(h.value.as_str(), file_len));

    if let Some((start, end)) = range {
        let len = end - start + 1;
        file.seek(SeekFrom::Start(start))?;
        let headers = vec![
            tiny_http::Header::from_bytes(&b"Content-Type"[..], content_type.as_bytes()).unwrap(),
            tiny_http::Header::from_bytes(
                &b"Content-Range"[..],
                format!("bytes {start}-{end}/{file_len}").as_bytes(),
            )
            .unwrap(),
            tiny_http::Header::from_bytes(&b"Accept-Ranges"[..], &b"bytes"[..]).unwrap(),
        ];
        let response = tiny_http::Response::new(
            tiny_http::StatusCode(206),
            headers,
            file.take(len),
            Some(len as usize),
            None,
        );
        request.respond(response)
    } else {
        let headers = vec![
            tiny_http::Header::from_bytes(&b"Content-Type"[..], content_type.as_bytes()).unwrap(),
            tiny_http::Header::from_bytes(&b"Accept-Ranges"[..], &b"bytes"[..]).unwrap(),
        ];
        let response = tiny_http::Response::new(
            tiny_http::StatusCode(200),
            headers,
            file,
            Some(file_len as usize),
            None,
        );
        request.respond(response)
    }
}

fn spawn_preview_server(current: Arc<Mutex<Option<PathBuf>>>) -> u16 {
    let server = tiny_http::Server::http("127.0.0.1:0").expect("failed to bind preview server");
    let port = server.server_addr().to_ip().expect("expected IPv4/6 addr").port();
    std::thread::spawn(move || {
        for request in server.incoming_requests() {
            if let Err(e) = serve_preview_request(request, &current) {
                eprintln!("preview server error: {e}");
            }
        }
    });
    port
}

/// 指定したファイルをローカルプレビューサーバーで配信対象にし、再生用URLを返す
#[tauri::command]
fn set_preview_file(state: State<'_, PreviewServer>, path: String) -> Result<String, String> {
    if !Path::new(&path).is_file() {
        return Err("File not found".into());
    }
    *state.current.lock().unwrap() = Some(PathBuf::from(&path));

    let mut port_guard = state.port.lock().unwrap();
    let port = match *port_guard {
        Some(p) => p,
        None => {
            let p = spawn_preview_server(state.current.clone());
            *port_guard = Some(p);
            p
        }
    };
    Ok(format!("http://127.0.0.1:{port}/video"))
}

/// WebView(HTML5 <video>)が再生できない形式(HEVC等)の動画を、
/// 同梱ffmpegでH.264プレビュー用コピーに変換する。書き出しは常に元ファイルに
/// 対して行われるため、これはプレビュー専用でエクスポート品質には影響しない。
/// 同じファイル(パス+更新日時)には一度生成したキャッシュを再利用する。
#[tauri::command]
async fn make_preview_proxy(app: AppHandle, input: String) -> Result<String, String> {
    let metadata = std::fs::metadata(&input).map_err(|e| format!("Cannot read file: {e}"))?;
    let mtime = metadata
        .modified()
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_secs())
        .unwrap_or(0);

    let mut hasher = DefaultHasher::new();
    input.hash(&mut hasher);
    mtime.hash(&mut hasher);
    let key = hasher.finish();

    let cache_dir = app
        .path()
        .app_cache_dir()
        .map_err(|e| e.to_string())?
        .join("preview");
    std::fs::create_dir_all(&cache_dir).map_err(|e| e.to_string())?;
    let output = cache_dir.join(format!("{key:016x}.mp4"));

    if output.exists() {
        return Ok(output.to_string_lossy().to_string());
    }

    let mut cmd = ffmpeg_command();
    cmd.arg("-y")
        .args(["-i", &input])
        .args(["-map", "0:v:0", "-map", "0:a:0?"])
        .args(["-c:v", "libx264", "-preset", "veryfast", "-crf", "23"])
        .args(["-vf", "scale='min(1280,iw)':-2"])
        .args(["-c:a", "aac", "-b:a", "128k"])
        .args(["-movflags", "+faststart"])
        .args(["-loglevel", "error"])
        .arg(&output)
        .stdout(Stdio::null())
        .stderr(Stdio::piped());

    let child = cmd
        .spawn()
        .map_err(|e| format!("Failed to start ffmpeg: {e}"))?;
    let result = child.wait_with_output().map_err(|e| e.to_string())?;

    if result.status.success() {
        Ok(output.to_string_lossy().to_string())
    } else {
        let _ = std::fs::remove_file(&output);
        let err_text = String::from_utf8_lossy(&result.stderr);
        Err(if err_text.trim().is_empty() {
            "Failed to generate preview".into()
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
            // GLコンポジット経由の描画で映像だけ黒くなる問題の回避
            if std::env::var_os("WEBKIT_DISABLE_COMPOSITING_MODE").is_none() {
                std::env::set_var("WEBKIT_DISABLE_COMPOSITING_MODE", "1");
            }
            // 注意: GDK_GL=disable はGTKのウィンドウサーフェス生成自体を
            // 妨げ、WSLgでウィンドウが一切表示されなくなる場合があるため使わない
        }
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            app.manage(ExportState(Mutex::new(None)));
            app.manage(PreviewServer {
                current: Arc::new(Mutex::new(None)),
                port: Mutex::new(None),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            check_ffmpeg,
            export_clip,
            cancel_export,
            get_cli_file,
            make_preview_proxy,
            set_preview_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
