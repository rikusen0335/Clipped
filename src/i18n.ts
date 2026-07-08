import i18n from "i18next";
import { initReactI18next } from "react-i18next";

const resources = {
  en: {
    translation: {
      openVideo: "Open Video",
      dropHint: 'Drag & drop a video file, or click "Open Video"',
      videoFiles: "Video files",
      unsupportedFormat: "Unsupported file format",
      playPause: "Play / Pause",
      setInPoint: "Set in point",
      setOutPoint: "Set out point",
      frameStep: "Frame step",
      jumpToIn: "Jump to in point (Home)",
      jumpToOut: "Jump to out point (End)",
      playPauseSpace: "Play / Pause (Space)",
      modeCopy: "Lossless (fast)",
      modeEncode: "Re-encode (accurate)",
      export: "Export",
      exportDone: "Done",
      exportDoneMessage: "Clip exported 🎉",
      exportFailed: "Export failed",
      ffmpegMissing: "ffmpeg not found",
      ffmpegMissingHint: "Install it with: winget install Gyan.FFmpeg",
      inLabel: "IN: {{time}}",
      outLabel: "OUT: {{time}}",
      about: "About",
      aboutLicense:
        "Clipped is released under the MIT License.",
      aboutFfmpeg:
        "This software uses FFmpeg (GPL v3) as a bundled external program for video export. FFmpeg is invoked as a separate process; Clipped itself is not a derivative work of FFmpeg.",
      aboutFont:
        "The bundled Noto Sans JP font is licensed under the SIL Open Font License 1.1.",
      videoErrorTitle: "Video error",
      videoError: "Failed to load video (code {{code}}: {{reason}})",
      videoErrorDecode: "decode error — codec may be unsupported",
      videoErrorSrc: "format not supported by the webview",
      videoErrorNetwork: "read error — file may be inaccessible or too slow",
      videoErrorAborted: "loading aborted",
      ffmpegSite: "FFmpeg website",
      ffmpegBuilds: "Bundled build (BtbN/FFmpeg-Builds)",
      gplText: "GPL v3 license text",
    },
  },
  ja: {
    translation: {
      openVideo: "動画を開く",
      dropHint: "動画ファイルをドラッグ&ドロップ、または「動画を開く」",
      videoFiles: "動画ファイル",
      unsupportedFormat: "対応していないファイル形式です",
      playPause: "再生/停止",
      setInPoint: "開始点を設定",
      setOutPoint: "終了点を設定",
      frameStep: "コマ送り",
      jumpToIn: "開始点へ (Home)",
      jumpToOut: "終了点へ (End)",
      playPauseSpace: "再生/停止 (Space)",
      modeCopy: "無劣化(高速)",
      modeEncode: "再エンコード(正確)",
      export: "書き出し",
      exportDone: "完了",
      exportDoneMessage: "クリップを書き出しました 🎉",
      exportFailed: "書き出しに失敗しました",
      ffmpegMissing: "ffmpeg未検出",
      ffmpegMissingHint: "winget install Gyan.FFmpeg などでインストールしてください",
      inLabel: "IN: {{time}}",
      outLabel: "OUT: {{time}}",
      about: "このアプリについて",
      aboutLicense: "ClippedはMITライセンスで公開されています。",
      aboutFfmpeg:
        "本ソフトウェアは動画の書き出しにFFmpeg(GPL v3)を外部プログラムとして同梱・使用しています。FFmpegは独立したプロセスとして実行され、Clipped自体はFFmpegの派生物ではありません。",
      aboutFont:
        "同梱フォント Noto Sans JP は SIL Open Font License 1.1 でライセンスされています。",
      videoErrorTitle: "動画エラー",
      videoError: "動画の読み込みに失敗しました(コード{{code}}: {{reason}})",
      videoErrorDecode: "デコードエラー — コーデック未対応の可能性",
      videoErrorSrc: "このWebViewで未対応の形式です",
      videoErrorNetwork: "読み込みエラー — ファイルにアクセスできないか遅すぎます",
      videoErrorAborted: "読み込みが中断されました",
      ffmpegSite: "FFmpeg公式サイト",
      ffmpegBuilds: "同梱ビルド (BtbN/FFmpeg-Builds)",
      gplText: "GPL v3 ライセンス全文",
    },
  },
};

const STORAGE_KEY = "clipped-language";

void i18n.use(initReactI18next).init({
  resources,
  lng: localStorage.getItem(STORAGE_KEY) ?? "en",
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

i18n.on("languageChanged", (lng) => {
  localStorage.setItem(STORAGE_KEY, lng);
});

export default i18n;
