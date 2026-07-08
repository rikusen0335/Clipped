// アプリアイコンのソースPNG(512x512)を依存ライブラリなしで生成する
import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";

const SIZE = 512;
const px = new Uint8Array(SIZE * SIZE * 4);

// 角丸判定
const R = 96;
function inRoundedRect(x, y) {
  const cx = x < R ? R : x > SIZE - R ? SIZE - R : x;
  const cy = y < R ? R : y > SIZE - R ? SIZE - R : y;
  return (x - cx) ** 2 + (y - cy) ** 2 <= R * R;
}

for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    const i = (y * SIZE + x) * 4;
    if (!inRoundedRect(x, y)) continue; // 透明のまま

    // 紫のグラデーション背景
    const t = (x + y) / (2 * SIZE);
    let r = Math.round(0x6b + t * 0x30);
    let g = Math.round(0x3f + t * 0x20);
    let b = Math.round(0xd4 + t * 0x20);

    // 「切り抜き範囲」を表す明るい縦帯 + ハンドル
    const inX = 176, outX = 336, handleW = 22;
    const inBand = x >= inX && x <= outX && y >= 128 && y <= 384;
    const isHandle =
      (Math.abs(x - inX) <= handleW / 2 || Math.abs(x - outX) <= handleW / 2) &&
      y >= 112 && y <= 400;
    if (inBand) {
      r = Math.min(255, r + 60);
      g = Math.min(255, g + 60);
      b = 255;
    }
    if (isHandle) {
      r = g = b = 245;
    }

    px[i] = r;
    px[i + 1] = g;
    px[i + 2] = b;
    px[i + 3] = 255;
  }
}

// PNGエンコード
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crcTable = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crcTable[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (const byte of body) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
  return Buffer.concat([len, body, crcBuf]);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 6; // RGBA

const raw = Buffer.alloc(SIZE * (SIZE * 4 + 1));
for (let y = 0; y < SIZE; y++) {
  raw[y * (SIZE * 4 + 1)] = 0; // filter: none
  Buffer.from(px.buffer, y * SIZE * 4, SIZE * 4).copy(raw, y * (SIZE * 4 + 1) + 1);
}

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk("IHDR", ihdr),
  chunk("IDAT", deflateSync(raw, { level: 9 })),
  chunk("IEND", Buffer.alloc(0)),
]);

writeFileSync(new URL("../app-icon.png", import.meta.url), png);
console.log("app-icon.png generated");
