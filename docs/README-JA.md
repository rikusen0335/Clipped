# Clipped

動画の切り抜き(トリミング)だけに特化したシンプルなクリップエディタ。

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

## ライセンス

Clipped本体は [MIT License](../LICENSE) です。
同梱するFFmpegはGPL v3で、詳細は [THIRD-PARTY-LICENSES.md](../THIRD-PARTY-LICENSES.md) を参照してください。
これらの表記ファイルはインストーラにも同梱されます。
