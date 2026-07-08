import { useCallback, useRef } from "react";
import { formatTime } from "./format";

type DragTarget = "playhead" | "in" | "out";

interface TimelineProps {
  duration: number;
  current: number;
  inPoint: number;
  outPoint: number;
  onSeek: (t: number) => void;
  onChangeIn: (t: number) => void;
  onChangeOut: (t: number) => void;
}

const TRACK_HEIGHT = 72;
const HANDLE_W = 12;

/** 切り抜き範囲を編集するタイムライン(自作コンポーネント) */
export default function Timeline({
  duration,
  current,
  inPoint,
  outPoint,
  onSeek,
  onChangeIn,
  onChangeOut,
}: TimelineProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef<DragTarget | null>(null);

  const posToTime = useCallback(
    (clientX: number) => {
      const el = trackRef.current;
      if (!el || duration <= 0) return 0;
      const rect = el.getBoundingClientRect();
      const ratio = (clientX - rect.left) / rect.width;
      return Math.min(Math.max(ratio, 0), 1) * duration;
    },
    [duration],
  );

  const applyDrag = useCallback(
    (target: DragTarget, clientX: number) => {
      const t = posToTime(clientX);
      if (target === "in") {
        onChangeIn(Math.min(t, outPoint - 0.01));
      } else if (target === "out") {
        onChangeOut(Math.max(t, inPoint + 0.01));
      } else {
        onSeek(t);
      }
    },
    [posToTime, onChangeIn, onChangeOut, onSeek, inPoint, outPoint],
  );

  const startDrag = (target: DragTarget) => (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    dragging.current = target;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    applyDrag(target, e.clientX);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (dragging.current) applyDrag(dragging.current, e.clientX);
  };

  const onPointerUp = () => {
    dragging.current = null;
  };

  const pct = (t: number) => (duration > 0 ? (t / duration) * 100 : 0);

  // 目盛り: おおよそ10分割
  const ticks: number[] = [];
  if (duration > 0) {
    const rawStep = duration / 10;
    const steps = [0.1, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 1800, 3600];
    const step = steps.find((s) => s >= rawStep) ?? 3600;
    for (let t = 0; t <= duration; t += step) ticks.push(t);
  }

  return (
    <div style={{ padding: "4px 8px" }}>
      {/* 目盛り */}
      <div style={{ position: "relative", height: 18, marginBottom: 2 }}>
        {ticks.map((t) => (
          <span
            key={t}
            style={{
              position: "absolute",
              left: `${pct(t)}%`,
              transform: "translateX(-50%)",
              fontSize: 10,
              color: "var(--mantine-color-dark-2)",
              fontVariantNumeric: "tabular-nums",
              whiteSpace: "nowrap",
            }}
          >
            {formatTime(t, false)}
          </span>
        ))}
      </div>

      {/* トラック */}
      <div
        ref={trackRef}
        onPointerDown={startDrag("playhead")}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        style={{
          position: "relative",
          height: TRACK_HEIGHT,
          borderRadius: 8,
          background: "var(--mantine-color-dark-6)",
          cursor: "pointer",
          touchAction: "none",
        }}
      >
        {/* 選択範囲 */}
        <div
          style={{
            position: "absolute",
            left: `${pct(inPoint)}%`,
            width: `${Math.max(pct(outPoint) - pct(inPoint), 0)}%`,
            top: 0,
            bottom: 0,
            background: "rgba(151, 117, 250, 0.25)",
            borderTop: "2px solid var(--mantine-color-violet-5)",
            borderBottom: "2px solid var(--mantine-color-violet-5)",
            pointerEvents: "none",
          }}
        />

        {/* INハンドル */}
        <div
          onPointerDown={startDrag("in")}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          title={`IN: ${formatTime(inPoint)}`}
          style={{
            position: "absolute",
            left: `calc(${pct(inPoint)}% - ${HANDLE_W / 2}px)`,
            top: 0,
            bottom: 0,
            width: HANDLE_W,
            background: "var(--mantine-color-violet-5)",
            borderRadius: "6px 0 0 6px",
            cursor: "ew-resize",
            zIndex: 3,
            touchAction: "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div style={{ width: 2, height: 24, background: "rgba(0,0,0,0.4)", borderRadius: 1 }} />
        </div>

        {/* OUTハンドル */}
        <div
          onPointerDown={startDrag("out")}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          title={`OUT: ${formatTime(outPoint)}`}
          style={{
            position: "absolute",
            left: `calc(${pct(outPoint)}% - ${HANDLE_W / 2}px)`,
            top: 0,
            bottom: 0,
            width: HANDLE_W,
            background: "var(--mantine-color-violet-5)",
            borderRadius: "0 6px 6px 0",
            cursor: "ew-resize",
            zIndex: 3,
            touchAction: "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div style={{ width: 2, height: 24, background: "rgba(0,0,0,0.4)", borderRadius: 1 }} />
        </div>

        {/* 再生ヘッド */}
        <div
          style={{
            position: "absolute",
            left: `${pct(current)}%`,
            top: -4,
            bottom: -4,
            width: 2,
            background: "var(--mantine-color-red-5)",
            zIndex: 4,
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: -5,
              left: -4,
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: "var(--mantine-color-red-5)",
            }}
          />
        </div>
      </div>
    </div>
  );
}
