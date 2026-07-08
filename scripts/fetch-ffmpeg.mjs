// アプリに同梱するffmpegバイナリを src-tauri/binaries/ にダウンロードする
// 使い方: node scripts/fetch-ffmpeg.mjs [windows|linux|all]
// Tauriのsidecar命名規則: ffmpeg-<target-triple>[.exe]
import { execSync } from "node:child_process";
import {
  copyFileSync,
  chmodSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const binDir = join(root, "src-tauri", "binaries");
const tmpDir = join(root, "src-tauri", "binaries", ".tmp");
mkdirSync(binDir, { recursive: true });

const arg = process.argv[2] ?? "all";
const wantWindows = arg === "all" || arg === "windows";
const wantLinux = arg === "all" || arg === "linux";

function sh(cmd) {
  execSync(cmd, { stdio: "inherit" });
}

/** ディレクトリを再帰的に探して最初に見つかったファイルを返す */
function findFile(dir, name) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) {
      const found = findFile(p, name);
      if (found) return found;
    } else if (entry.name === name) {
      return p;
    }
  }
  return null;
}

if (wantWindows) {
  const dest = join(binDir, "ffmpeg-x86_64-pc-windows-msvc.exe");
  if (existsSync(dest)) {
    console.log("[windows] already exists, skipping:", dest);
  } else {
    console.log("[windows] downloading ffmpeg (BtbN win64 GPL build)...");
    rmSync(tmpDir, { recursive: true, force: true });
    mkdirSync(tmpDir, { recursive: true });
    const zip = join(tmpDir, "ffmpeg-win64.zip");
    sh(
      `curl -fL -o "${zip}" https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip`,
    );
    // Windowsのtar(bsdtar)はzip対応、Linux/macOSはunzipを使う
    if (process.platform === "win32") {
      sh(`tar -xf "${zip}" -C "${tmpDir}"`);
    } else {
      sh(`unzip -q "${zip}" -d "${tmpDir}"`);
    }
    const exe = findFile(tmpDir, "ffmpeg.exe");
    if (!exe) throw new Error("ffmpeg.exe not found in archive");
    copyFileSync(exe, dest);
    rmSync(tmpDir, { recursive: true, force: true });
    console.log("[windows] done:", dest);
  }
}

if (wantLinux) {
  const dest = join(binDir, "ffmpeg-x86_64-unknown-linux-gnu");
  if (existsSync(dest)) {
    console.log("[linux] already exists, skipping:", dest);
  } else {
    console.log("[linux] downloading ffmpeg (BtbN linux64 GPL build)...");
    rmSync(tmpDir, { recursive: true, force: true });
    mkdirSync(tmpDir, { recursive: true });
    const tarball = join(tmpDir, "ffmpeg-linux64.tar.xz");
    sh(
      `curl -fL -o "${tarball}" https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-linux64-gpl.tar.xz`,
    );
    sh(`tar -xf "${tarball}" -C "${tmpDir}"`);
    const bin = findFile(tmpDir, "ffmpeg");
    if (!bin) throw new Error("ffmpeg not found in archive");
    copyFileSync(bin, dest);
    chmodSync(dest, 0o755);
    rmSync(tmpDir, { recursive: true, force: true });
    console.log("[linux] done:", dest);
  }
}

console.log("fetch-ffmpeg finished");
