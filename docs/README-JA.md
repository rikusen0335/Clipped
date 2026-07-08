# Clipped

動画の切り抜き(トリミング)だけに特化したシンプルなクリップエディタ。

<img width="1268" height="908" alt="image" src="https://github.com/user-attachments/assets/9b2c7b73-2707-422f-b98a-1e43c1fb96c1" />

Tauri 2 + React + TypeScript + Mantine 製。書き出しには同梱のffmpegを使用します。

**English version → [../README.md](../README.md)**

## 機能

- 動画を開く(ダイアログ / ドラッグ&ドロップ)
- タイムライン上で IN / OUT ハンドルをドラッグして切り抜き範囲を指定
- 時間の直接入力(`1:23.456` 形式)
- プレビュー再生は OUT 位置で自動停止(切り抜き結果と同じ範囲を確認できる)
- 書き出しモード
  - **無劣化(高速)**: `-c copy`。再エンコードなしで一瞬で終わるが、カット位置はキーフレーム単位
  - **再エンコード(正確)**: libx264 / CRF 18。フレーム単位で正確にカット
- 書き出し進捗表示・キャンセル
- 英語/日本語UI(タイトルバーで切替)
- Windowsエクスプローラーの右クリックメニュー「Clippedで編集」から直接開ける
- アプリ内自動アップデート: 起動時に [GitHub Releases](https://github.com/rikusen0335/Clipped/releases) を確認し、新しいバージョンがあれば「アップデートあり」ボタンが表示され、クリックするとダウンロード・インストールまで自動で行われる

## キーボードショートカット

| キー | 動作 |
| --- | --- |
| `Space` | 再生 / 停止 |
| `I` / `O` | 現在位置を開始点 / 終了点に設定 |
| `←` / `→` | コマ送り(約1/30秒) |
| `Shift + ←/→` | 1秒移動 |
| `Home` / `End` | 開始点 / 終了点へジャンプ |

## 必要なもの(Windows)

- [Node.js](https://nodejs.org/) 20以上 + [pnpm](https://pnpm.io/)
- [Rust](https://rustup.rs/)(MSVCツールチェーン)
- WebView2(Windows 11なら標準搭載)

ffmpegは**アプリに同梱**されるため、エンドユーザーのインストールは不要です。
同梱バイナリが無い場合はPATH上のffmpegにフォールバックします。

## 開発

```sh
pnpm install
pnpm fetch-ffmpeg   # 同梱用ffmpegをダウンロード(初回のみ)
pnpm tauri dev
```

## ビルド(Windowsインストーラ作成)

```sh
pnpm tauri build
```

`src-tauri/target/release/bundle/nsis/` にNSISインストーラが生成されます。
インストーラはエクスプローラーの右クリックメニューも登録します
(日本語でインストールすると「Clippedで編集」、それ以外では "Edit with Clipped")。

## リリース手順(自動アップデート)

Clippedは[Tauri公式のUpdaterプラグイン](https://v2.tauri.app/plugin/updater/)を使っており、
起動時に `https://github.com/rikusen0335/Clipped/releases/latest/download/latest.json` を確認します。
新バージョンの公開には署名付きインストーラが必要で、
[.github/workflows/build-and-release.yml](../.github/workflows/build-and-release.yml) が自動生成します。

1. 初回のみ: `pnpm tauri signer generate -w updater.key` でUpdater用の署名鍵ペアを生成済みです。
   **秘密鍵ファイルの中身**をGitHubリポジトリのSecrets(Settings → Secrets and variables → Actions)に
   `TAURI_SIGNING_PRIVATE_KEY` という名前で登録してください。公開鍵はすでに
   `src-tauri/tauri.conf.json` の `plugins.updater.pubkey` に埋め込み済みです。
   `updater.key` は絶対にコミットしないでください。
2. `src-tauri/tauri.conf.json` / `package.json` / `src-tauri/Cargo.toml` のバージョンを
   同じ値に揃えて更新します。
3. タグを打ってpush: `git tag v0.2.0 && git push origin v0.2.0`
4. ワークフローが署名付きのWindows(NSIS)・Linux(AppImage)ビルドを作成し、
   `latest.json` と共に**下書き(draft)状態のGitHub Release**として公開します。
   内容を確認してから手動で公開(Publish)してください — アップデーターは公開済みの
   リリースのみを参照します。

## ライセンス

Clipped本体は [MIT License](../LICENSE) です。
同梱するFFmpegはGPL v3で、詳細は [THIRD-PARTY-LICENSES.md](../THIRD-PARTY-LICENSES.md) を参照してください。
これらの表記ファイルはインストーラにも同梱されます。
