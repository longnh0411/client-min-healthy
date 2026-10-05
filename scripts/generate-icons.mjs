// Sinh icon PNG cho PWA (192/512, any + maskable) không cần thư viện ngoài:
// vẽ pixel tay (nền tròn vuông xanh teal + giọt máu trắng) rồi encode PNG
// (zlib deflate + CRC32) — chạy: node scripts/generate-icons.mjs
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const BG = [14, 122, 95, 255]; // #0E7A5F teal
const FG = [255, 255, 255, 255]; // trắng

// CRC32 cho PNG chunk
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/** Encode RGBA buffer thành PNG (không filter — filter byte 0 từng dòng). */
function encodePng(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filter none
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

/**
 * Vẽ icon: nền bo góc (any) hoặc full-bleed (maskable) + hình giọt.
 * Giọt = hợp của hình tròn (đáy) và tam giác đỉnh nhọn phía trên.
 */
function drawIcon(size, { maskable }) {
  const rgba = Buffer.alloc(size * size * 4);
  const radius = maskable ? 0 : Math.round(size * 0.22);
  const cx = size / 2;
  const dropR = size * (maskable ? 0.21 : 0.27); // maskable giữ logo trong vùng an toàn ~80%
  const cy = size * 0.60;
  const apexY = cy - dropR * 2.1;
  const baseHalf = dropR * 0.78;

  const inCircle = (x, y, r) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
  const inRounded = (x, y) => {
    if (radius === 0) return true;
    const dx = Math.max(radius - x, x - (size - 1 - radius), 0);
    const dy = Math.max(radius - y, y - (size - 1 - radius), 0);
    return dx * dx + dy * dy <= radius * radius;
  };
  const inTriangle = (x, y) => {
    if (y < apexY || y > cy) return false;
    const t = (y - apexY) / (cy - apexY); // 0 ở đỉnh → 1 ở đáy
    return Math.abs(x - cx) <= baseHalf * t;
  };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      if (!inRounded(x, y)) continue; // ngoài nền → trong suốt (any); maskable full-bleed
      const antiEdge = inCircle(x, y, dropR + 1) || inTriangle(x, y + 1) || inTriangle(x + 1, y);
      const isDrop = inCircle(x, y, dropR) || inTriangle(x, y);
      rgba[i] = isDrop || antiEdge ? (isDrop ? FG[0] : BG[0]) : BG[0];
      rgba[i + 1] = isDrop ? FG[1] : BG[1];
      rgba[i + 2] = isDrop ? FG[2] : BG[2];
      rgba[i + 3] = isDrop || antiEdge ? 255 : 255;
    }
  }
  return encodePng(size, size, rgba);
}

mkdirSync(join(ROOT, "public"), { recursive: true });
for (const size of [192, 512]) {
  writeFileSync(join(ROOT, "public", `icon-${size}.png`), drawIcon(size, { maskable: false }));
  writeFileSync(join(ROOT, "public", `icon-maskable-${size}.png`), drawIcon(size, { maskable: true }));
}
console.log("Đã sinh icon-192/512 + icon-maskable-192/512 trong public/");
