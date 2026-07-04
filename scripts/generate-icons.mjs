/**
 * Generates PWA icons and iPhone splash screens from an inline SVG mark.
 * Run: node scripts/generate-icons.mjs
 */
import { mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const BRAND = "#0F9D6E";
const BG = "#F7FAF9";

// Teal rounded square, white leaf-dot mark + "M" — legible at 32px.
function markSvg(size, { padding = 0, background = BRAND } = {}) {
  const inner = size - padding * 2;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
  <rect width="${size}" height="${size}" rx="${padding > 0 ? 0 : size * 0.22}" fill="${background}"/>
  <g transform="translate(${padding},${padding})">
    <rect width="${inner}" height="${inner}" rx="${inner * 0.22}" fill="${BRAND}"/>
    <circle cx="${inner * 0.72}" cy="${inner * 0.28}" r="${inner * 0.09}" fill="#ffffff" opacity="0.9"/>
    <text x="50%" y="52%" dx="${-padding}" dy="0"
      text-anchor="middle" dominant-baseline="central"
      font-family="Arial, Helvetica, sans-serif" font-weight="bold"
      font-size="${inner * 0.52}" fill="#ffffff"
      transform="translate(${inner / 2 + padding - inner / 2},0)">M</text>
  </g>
</svg>`);
}

function splashSvg(width, height) {
  const mark = Math.round(Math.min(width, height) * 0.28);
  const x = Math.round((width - mark) / 2);
  const y = Math.round((height - mark) / 2);
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <rect width="${width}" height="${height}" fill="${BG}"/>
  <g transform="translate(${x},${y})">
    <rect width="${mark}" height="${mark}" rx="${mark * 0.22}" fill="${BRAND}"/>
    <circle cx="${mark * 0.72}" cy="${mark * 0.28}" r="${mark * 0.09}" fill="#ffffff" opacity="0.9"/>
    <text x="${mark / 2}" y="${mark * 0.54}" text-anchor="middle" dominant-baseline="central"
      font-family="Arial, Helvetica, sans-serif" font-weight="bold"
      font-size="${mark * 0.52}" fill="#ffffff">M</text>
  </g>
</svg>`);
}

const iconsDir = path.resolve("public/icons");
const splashDir = path.resolve("public/splash");
await mkdir(iconsDir, { recursive: true });
await mkdir(splashDir, { recursive: true });

const icons = [
  { file: "icon-192.png", size: 192, padding: 0 },
  { file: "icon-512.png", size: 512, padding: 0 },
  { file: "icon-512-maskable.png", size: 512, padding: 51 }, // 10% safe zone
  { file: "apple-touch-icon.png", size: 180, padding: 0 },
];
for (const icon of icons) {
  await sharp(markSvg(icon.size, { padding: icon.padding, background: BRAND }))
    .png()
    .toFile(path.join(iconsDir, icon.file));
}

const splashes = [
  [1290, 2796],
  [1179, 2556],
  [1284, 2778],
  [750, 1334],
];
for (const [width, height] of splashes) {
  await sharp(splashSvg(width, height))
    .png()
    .toFile(path.join(splashDir, `splash-${width}x${height}.png`));
}

console.log("Generated", icons.length, "icons and", splashes.length, "splash screens");
