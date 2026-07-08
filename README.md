# Clipped

A minimal clip editor dedicated to one thing: trimming videos.

<img width="1268" height="908" alt="image" src="https://github.com/user-attachments/assets/3777255c-b132-475a-a1b6-2097f8449927" />


Built with Tauri 2 + React + TypeScript + Mantine. Export is powered by a bundled ffmpeg.

**日本語版はこちら → [docs/README-JA.md](docs/README-JA.md)**

## Features

- Open videos via dialog or drag & drop
- Drag the IN / OUT handles on the timeline to select the clip range
- Direct time input (`1:23.456` format)
- Preview playback stops automatically at the OUT point, matching the exported result
- Export modes
  - **Lossless (fast)**: `-c copy`. Finishes instantly with no re-encoding, but cuts on keyframes
  - **Re-encode (accurate)**: libx264 / CRF 18. Frame-accurate cuts
- Export progress bar and cancellation
- English / Japanese UI (switchable in the title bar)
- Windows Explorer context menu: right-click a video file and choose "Edit with Clipped"

## Keyboard shortcuts

| Key | Action |
| --- | --- |
| `Space` | Play / Pause |
| `I` / `O` | Set in / out point at current position |
| `←` / `→` | Frame step (~1/30 s) |
| `Shift + ←/→` | Step 1 second |
| `Home` / `End` | Jump to in / out point |

## Requirements (Windows)

- [Node.js](https://nodejs.org/) 20+ and [pnpm](https://pnpm.io/)
- [Rust](https://rustup.rs/) (MSVC toolchain)
- WebView2 (preinstalled on Windows 11)

ffmpeg is **bundled with the app**, so end users don't need to install it.
If the bundled binary is missing, Clipped falls back to `ffmpeg` on PATH.

## Development

```sh
pnpm install
pnpm fetch-ffmpeg   # download the ffmpeg binary to bundle (first time only)
pnpm tauri dev
```

## Build (Windows installer)

```sh
pnpm tauri build
```

The NSIS installer is generated in `src-tauri/target/release/bundle/nsis/`.
The installer also registers the Explorer context menu entry
("Edit with Clipped" — or 「Clippedで編集」 when installed in Japanese).

## License

Clipped itself is released under the [MIT License](LICENSE).
The bundled FFmpeg is licensed under GPL v3 — see
[THIRD-PARTY-LICENSES.md](THIRD-PARTY-LICENSES.md) for details.
These notice files are also included in the installer.
