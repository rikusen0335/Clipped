import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActionIcon,
  Anchor,
  Badge,
  Box,
  Button,
  Center,
  Group,
  Kbd,
  Modal,
  Progress,
  SegmentedControl,
  Select,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import {
  IconFolderOpen,
  IconInfoCircle,
  IconMinus,
  IconPlayerPause,
  IconPlayerPlay,
  IconPlayerSkipBack,
  IconPlayerSkipForward,
  IconScissors,
  IconSquare,
  IconX,
} from "@tabler/icons-react";
import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { open as openDialog, save as saveDialog } from "@tauri-apps/plugin-dialog";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useTranslation } from "react-i18next";
import Timeline from "./Timeline";
import { formatTime, parseTime } from "./format";

const VIDEO_EXTS = ["mp4", "mkv", "mov", "webm", "avi", "ts", "m4v"];
const APP_VERSION = "0.1.0";
const appWindow = getCurrentWindow();

interface ExportProgress {
  ratio: number;
  out_time: number;
}

export default function App() {
  const { t, i18n } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [filePath, setFilePath] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [inPoint, setInPoint] = useState(0);
  const [outPoint, setOutPoint] = useState(0);
  const [inText, setInText] = useState("");
  const [outText, setOutText] = useState("");
  const [mode, setMode] = useState<"copy" | "encode">("copy");
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [ffmpegOk, setFfmpegOk] = useState<boolean | null>(null);
  const [aboutOpen, { open: openAbout, close: closeAbout }] = useDisclosure(false);

  // ffmpegの存在チェック
  useEffect(() => {
    invoke<string>("check_ffmpeg")
      .then(() => setFfmpegOk(true))
      .catch(() => setFfmpegOk(false));
  }, []);


  // 書き出し進捗イベント
  useEffect(() => {
    const unlisten = listen<ExportProgress>("export://progress", (e) => {
      setProgress(e.payload.ratio);
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  const loadFile = useCallback((path: string) => {
    setFilePath(path);
    setVideoUrl(convertFileSrc(path));
    setCurrent(0);
    setInPoint(0);
    setOutPoint(0);
    setDuration(0);
    setPlaying(false);
  }, []);

  // ドラッグ&ドロップで開く
  useEffect(() => {
    const unlisten = getCurrentWebview().onDragDropEvent((e) => {
      if (e.payload.type === "drop" && e.payload.paths.length > 0) {
        const p = e.payload.paths[0];
        const ext = p.split(".").pop()?.toLowerCase() ?? "";
        if (VIDEO_EXTS.includes(ext)) {
          loadFile(p);
        } else {
          notifications.show({ color: "yellow", message: t("unsupportedFormat") });
        }
      }
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [loadFile, t]);

  // コンテキストメニュー(コマンドライン引数)から起動された場合はそのファイルを開く
  useEffect(() => {
    invoke<string | null>("get_cli_file").then((p) => {
      if (p) loadFile(p);
    });
  }, [loadFile]);

  const openFile = useCallback(async () => {
    const selected = await openDialog({
      multiple: false,
      filters: [{ name: t("videoFiles"), extensions: VIDEO_EXTS }],
    });
    if (typeof selected === "string") loadFile(selected);
  }, [loadFile, t]);

  // in/out変更時にテキスト欄を同期
  useEffect(() => setInText(formatTime(inPoint)), [inPoint]);
  useEffect(() => setOutText(formatTime(outPoint)), [outPoint]);

  const onLoadedMetadata = () => {
    const v = videoRef.current;
    if (!v) return;
    setDuration(v.duration);
    setInPoint(0);
    setOutPoint(v.duration);
  };

  const seek = useCallback((t: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.min(Math.max(t, 0), v.duration || 0);
    setCurrent(v.currentTime);
  }, []);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      // OUT位置以降なら選択範囲の頭から再生
      if (v.currentTime >= outPoint - 0.01) v.currentTime = inPoint;
      void v.play();
    } else {
      v.pause();
    }
  }, [inPoint, outPoint]);

  // 再生中、OUT位置で自動停止(プレビューが切り抜き結果と一致するように)
  const onTimeUpdate = () => {
    const v = videoRef.current;
    if (!v) return;
    setCurrent(v.currentTime);
    if (!v.paused && outPoint > 0 && v.currentTime >= outPoint) {
      v.pause();
      v.currentTime = outPoint;
    }
  };

  const setInHere = useCallback(() => {
    const t = videoRef.current?.currentTime ?? current;
    setInPoint(Math.min(t, outPoint - 0.01));
  }, [current, outPoint]);

  const setOutHere = useCallback(() => {
    const t = videoRef.current?.currentTime ?? current;
    setOutPoint(Math.max(t, inPoint + 0.01));
  }, [current, inPoint]);

  // キーボードショートカット
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      switch (e.code) {
        case "Space":
          e.preventDefault();
          togglePlay();
          break;
        case "KeyI":
          setInHere();
          break;
        case "KeyO":
          setOutHere();
          break;
        case "ArrowLeft":
          e.preventDefault();
          seek((videoRef.current?.currentTime ?? 0) - (e.shiftKey ? 1 : 1 / 30));
          break;
        case "ArrowRight":
          e.preventDefault();
          seek((videoRef.current?.currentTime ?? 0) + (e.shiftKey ? 1 : 1 / 30));
          break;
        case "Home":
          seek(inPoint);
          break;
        case "End":
          seek(outPoint);
          break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [togglePlay, setInHere, setOutHere, seek, inPoint, outPoint]);

  const commitInText = () => {
    const t = parseTime(inText);
    if (t !== null && t < outPoint) setInPoint(t);
    else setInText(formatTime(inPoint));
  };

  const commitOutText = () => {
    const t = parseTime(outText);
    if (t !== null && t > inPoint && t <= duration) setOutPoint(t);
    else setOutText(formatTime(outPoint));
  };

  const doExport = async () => {
    if (!filePath) return;
    const dot = filePath.lastIndexOf(".");
    const ext = mode === "copy" && dot >= 0 ? filePath.slice(dot + 1) : "mp4";
    const base = dot >= 0 ? filePath.slice(0, dot) : filePath;
    const output = await saveDialog({
      defaultPath: `${base}_clip.${ext}`,
      filters: [{ name: t("videoFiles"), extensions: [ext] }],
    });
    if (!output) return;

    setExporting(true);
    setProgress(0);
    try {
      await invoke("export_clip", {
        input: filePath,
        output,
        start: inPoint,
        end: outPoint,
        mode,
      });
      notifications.show({ color: "green", title: t("exportDone"), message: t("exportDoneMessage") });
    } catch (err) {
      notifications.show({
        color: "red",
        title: t("exportFailed"),
        message: String(err),
        autoClose: 10000,
      });
    } finally {
      setExporting(false);
    }
  };

  const cancelExport = () => {
    void invoke("cancel_export");
  };

  const clipLength = Math.max(outPoint - inPoint, 0);

  return (
    <Stack h="100vh" gap={0} bg="dark.8">
      {/* カスタムタイトルバー */}
      <Group
        data-tauri-drag-region
        px="sm"
        py={4}
        justify="space-between"
        bg="dark.7"
        wrap="nowrap"
        style={{ minHeight: 40 }}
      >
        <Group gap="xs" wrap="nowrap" style={{ minWidth: 0 }}>
          <IconScissors
            size={18}
            color="var(--mantine-color-violet-4)"
            style={{ pointerEvents: "none" }}
          />
          <Text data-tauri-drag-region fw={700} size="sm">
            Clipped
          </Text>
          {filePath && (
            <Text data-tauri-drag-region size="xs" c="dimmed" style={{ maxWidth: 420 }} truncate>
              {filePath}
            </Text>
          )}
        </Group>
        <Group gap="xs" wrap="nowrap">
          {ffmpegOk === false && (
            <Tooltip label={t("ffmpegMissingHint")}>
              <Badge color="red" variant="light">
                {t("ffmpegMissing")}
              </Badge>
            </Tooltip>
          )}
          <Select
            size="xs"
            w={110}
            value={i18n.language}
            onChange={(v) => v && i18n.changeLanguage(v)}
            data={[
              { value: "en", label: "English" },
              { value: "ja", label: "日本語" },
            ]}
            allowDeselect={false}
            comboboxProps={{ withinPortal: true }}
          />
          <Button
            size="xs"
            variant="light"
            leftSection={<IconFolderOpen size={16} />}
            onClick={openFile}
          >
            {t("openVideo")}
          </Button>
          <Tooltip label={t("about")}>
            <ActionIcon variant="subtle" color="gray" onClick={openAbout}>
              <IconInfoCircle size={16} />
            </ActionIcon>
          </Tooltip>

          {/* ウィンドウ操作ボタン */}
          <Group gap={2} wrap="nowrap" ml={4}>
            <ActionIcon
              variant="subtle"
              color="gray"
              onClick={() => appWindow.minimize()}
              aria-label="Minimize"
            >
              <IconMinus size={14} />
            </ActionIcon>
            <ActionIcon
              variant="subtle"
              color="gray"
              onClick={() => appWindow.toggleMaximize()}
              aria-label="Maximize"
            >
              <IconSquare size={12} />
            </ActionIcon>
            <ActionIcon
              variant="subtle"
              color="red"
              onClick={() => appWindow.close()}
              aria-label="Close"
            >
              <IconX size={15} />
            </ActionIcon>
          </Group>
        </Group>
      </Group>

      {/* プレビュー */}
      <Box flex={1} style={{ minHeight: 0, background: "#000" }}>
        {videoUrl ? (
          <video
            ref={videoRef}
            src={videoUrl}
            onLoadedMetadata={onLoadedMetadata}
            onTimeUpdate={onTimeUpdate}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onClick={togglePlay}
            style={{ width: "100%", height: "100%", objectFit: "contain" }}
          />
        ) : (
          <Center h="100%">
            <Stack align="center" gap="xs">
              <IconScissors size={48} color="var(--mantine-color-dark-3)" />
              <Text c="dimmed">{t("dropHint")}</Text>
              <Group gap={6} mt="sm">
                <Kbd>Space</Kbd>
                <Text size="xs" c="dimmed">{t("playPause")}</Text>
                <Kbd>I</Kbd>
                <Text size="xs" c="dimmed">{t("setInPoint")}</Text>
                <Kbd>O</Kbd>
                <Text size="xs" c="dimmed">{t("setOutPoint")}</Text>
                <Kbd>←/→</Kbd>
                <Text size="xs" c="dimmed">{t("frameStep")}</Text>
              </Group>
            </Stack>
          </Center>
        )}
      </Box>

      {/* タイムライン */}
      <Box px="sm" pt={6} bg="dark.7">
        <Timeline
          duration={duration}
          current={current}
          inPoint={inPoint}
          outPoint={outPoint}
          onSeek={seek}
          onChangeIn={setInPoint}
          onChangeOut={setOutPoint}
        />
      </Box>

      {/* コントロール */}
      <Group px="md" py="sm" justify="space-between" bg="dark.7" wrap="nowrap">
        <Group gap="xs" wrap="nowrap">
          <Tooltip label={t("jumpToIn")}>
            <ActionIcon variant="default" onClick={() => seek(inPoint)} disabled={!videoUrl}>
              <IconPlayerSkipBack size={16} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label={t("playPauseSpace")}>
            <ActionIcon
              variant="filled"
              size="lg"
              onClick={togglePlay}
              disabled={!videoUrl}
            >
              {playing ? <IconPlayerPause size={18} /> : <IconPlayerPlay size={18} />}
            </ActionIcon>
          </Tooltip>
          <Tooltip label={t("jumpToOut")}>
            <ActionIcon variant="default" onClick={() => seek(outPoint)} disabled={!videoUrl}>
              <IconPlayerSkipForward size={16} />
            </ActionIcon>
          </Tooltip>
          <Text size="sm" ff="monospace" c="dimmed" ml="xs" style={{ whiteSpace: "nowrap" }}>
            {formatTime(current)} / {formatTime(duration)}
          </Text>
        </Group>

        <Group gap="xs" wrap="nowrap">
          <Button size="xs" variant="default" onClick={setInHere} disabled={!videoUrl}>
            IN <Kbd ml={6} size="xs">I</Kbd>
          </Button>
          <TextInput
            size="xs"
            w={100}
            value={inText}
            onChange={(e) => setInText(e.currentTarget.value)}
            onBlur={commitInText}
            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
            disabled={!videoUrl}
          />
          <Text c="dimmed">→</Text>
          <TextInput
            size="xs"
            w={100}
            value={outText}
            onChange={(e) => setOutText(e.currentTarget.value)}
            onBlur={commitOutText}
            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
            disabled={!videoUrl}
          />
          <Button size="xs" variant="default" onClick={setOutHere} disabled={!videoUrl}>
            OUT <Kbd ml={6} size="xs">O</Kbd>
          </Button>
          <Badge variant="light" color="violet" size="lg" ff="monospace">
            {formatTime(clipLength)}
          </Badge>
        </Group>

        <Group gap="xs" wrap="nowrap">
          <SegmentedControl
            size="xs"
            value={mode}
            onChange={(v) => setMode(v as "copy" | "encode")}
            data={[
              { label: t("modeCopy"), value: "copy" },
              { label: t("modeEncode"), value: "encode" },
            ]}
            disabled={exporting}
          />
          {exporting ? (
            <Group gap={6} wrap="nowrap">
              <Progress value={progress * 100} w={120} animated />
              <Text size="xs" c="dimmed" ff="monospace">
                {Math.round(progress * 100)}%
              </Text>
              <ActionIcon color="red" variant="light" onClick={cancelExport}>
                <IconX size={16} />
              </ActionIcon>
            </Group>
          ) : (
            <Button
              leftSection={<IconScissors size={16} />}
              onClick={doExport}
              disabled={!videoUrl || clipLength <= 0 || ffmpegOk === false}
            >
              {t("export")}
            </Button>
          )}
        </Group>
      </Group>

      {/* アバウト(ライセンス表記) */}
      <Modal opened={aboutOpen} onClose={closeAbout} title={t("about")} centered>
        <Stack gap="sm">
          <Group gap="xs">
            <IconScissors size={20} color="var(--mantine-color-violet-4)" />
            <Text fw={700}>Clipped v{APP_VERSION}</Text>
          </Group>
          <Text size="sm">{t("aboutLicense")}</Text>
          <Text size="sm" c="dimmed">
            {t("aboutFfmpeg")}
          </Text>
          <Text size="sm" c="dimmed">
            {t("aboutFont")}
          </Text>
          <Stack gap={4}>
            <Anchor size="sm" onClick={() => openUrl("https://ffmpeg.org")}>
              {t("ffmpegSite")}
            </Anchor>
            <Anchor size="sm" onClick={() => openUrl("https://github.com/BtbN/FFmpeg-Builds")}>
              {t("ffmpegBuilds")}
            </Anchor>
            <Anchor size="sm" onClick={() => openUrl("https://www.gnu.org/licenses/gpl-3.0.html")}>
              {t("gplText")}
            </Anchor>
          </Stack>
        </Stack>
      </Modal>
    </Stack>
  );
}
