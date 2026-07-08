/** 秒数を "H:MM:SS.mmm" / "M:SS.mmm" 形式にする */
export function formatTime(sec: number, withMs = true): string {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const ms = Math.floor((sec % 1) * 1000);
  const msPart = withMs ? `.${String(ms).padStart(3, "0")}` : "";
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}${msPart}`;
  }
  return `${m}:${String(s).padStart(2, "0")}${msPart}`;
}

/** "1:23.456" / "01:02:03" / "12.5" のような文字列を秒数にパースする */
export function parseTime(text: string): number | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const parts = trimmed.split(":");
  if (parts.length > 3) return null;
  let sec = 0;
  for (const part of parts) {
    const v = Number(part);
    if (!Number.isFinite(v) || v < 0) return null;
    sec = sec * 60 + v;
  }
  return sec;
}
