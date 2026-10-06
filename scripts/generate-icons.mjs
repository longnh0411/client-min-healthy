// Sinh icon PNG cho PWA từ ảnh nguồn scripts/icon-source.png (1024×1024, bo góc,
// góc ngoài trong suốt) — chạy: node scripts/generate-icons.mjs
//
// Đầu ra trong public/:
//   icon-{192,512}.png          — purpose "any" (giữ nguyên nền bo góc + góc trong suốt)
//   icon-maskable-{192,512}.png — purpose "maskable": phủ nền đặc full-bleed
//                                 (Android cắt hình tròn/squircle — cần màu tới mép)
//   icon-apple-180.png          — apple-touch-icon (iOS: nền đặc, không trong suốt)
// Màu nền lấy từ chính ảnh nguồn (pixel gần mép trong của nền bo góc).
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = join(ROOT, "scripts", "icon-source.png");

async function sourceBackground() {
  // Lấy màu nền từ pixel (512, 30) — giữa cạnh trên, bên trong nền bo góc
  const { data } = await sharp(SOURCE)
    .extract({ left: 512, top: 30, width: 1, height: 1 })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const [r, g, b, a] = data;
  if (a < 250) throw new Error("Ảnh nguồn không có nền đặc tại (512,30) — kiểm tra lại icon-source.png");
  return { r, g, b };
}

/** Phủ nền đặc full-bleed rồi đặt ảnh nguồn lên giữa (cho maskable/apple). */
async function flattened(size, bg) {
  const art = await sharp(SOURCE).resize(size, size).png().toBuffer();
  return sharp({
    create: { width: size, height: size, channels: 4, background: { ...bg, alpha: 1 } },
  })
    .composite([{ input: art, blend: "over" }])
    .png()
    .toBuffer();
}

/** Ảnh nguồn giữ nguyên (nền bo góc, góc trong suốt), resize về size. */
function anyIcon(size) {
  return sharp(SOURCE).resize(size, size).png().toBuffer();
}

const bg = await sourceBackground();
mkdirSync(join(ROOT, "public"), { recursive: true });
for (const size of [192, 512]) {
  writeFileSync(join(ROOT, "public", `icon-${size}.png`), await anyIcon(size));
  writeFileSync(join(ROOT, "public", `icon-maskable-${size}.png`), await flattened(size, bg));
}
writeFileSync(join(ROOT, "public", "icon-apple-180.png"), await flattened(180, bg));
console.log("Đã sinh icon-192/512 + icon-maskable-192/512 + icon-apple-180 từ scripts/icon-source.png");
