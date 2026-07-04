/**
 * Generates PWA icons and iPhone splash screens from an inline SVG mark.
 * Mark: a map pin whose head is a macro ring (white donut + amber arc)
 * on the brand gradient — "map" + "macros" in one glyph.
 * Run: node scripts/generate-icons.mjs
 */
import { mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const BRAND_A = "#12B37E";
const BRAND_B = "#075C41";
const ACCENT = "#F5A524";
const BG = "#F7FAF9";

/** The pin-ring glyph, centered in a box of `size`. */
function glyph(size, cx = size / 2, cy = size * 0.44) {
  const ringR = size * 0.185; // ring centerline radius
  const strokeW = size * 0.105;
  const circumference = 2 * Math.PI * ringR;
  const arc = circumference * 0.28; // amber "progress" segment
  const tipY = cy + size * 0.34;
  const baseY = cy + ringR * 0.6;
  const baseX = ringR * 0.95;
  const holeR = ringR - strokeW / 2;
  const maskId = `hole-${Math.round(cx)}-${Math.round(cy)}`;
  return `
  <mask id="${maskId}">
    <rect x="0" y="0" width="${size}" height="${size}" fill="#ffffff"/>
    <circle cx="${cx}" cy="${cy}" r="${holeR}" fill="#000000"/>
  </mask>
  <!-- pin tail (masked so the donut hole stays a clean circle) -->
  <path d="M ${cx - baseX} ${baseY}
           Q ${cx} ${cy + ringR * 1.15} ${cx} ${tipY}
           Q ${cx} ${cy + ringR * 1.15} ${cx + baseX} ${baseY} Z"
        fill="#ffffff" mask="url(#${maskId})"/>
  <!-- macro ring -->
  <circle cx="${cx}" cy="${cy}" r="${ringR}" fill="none"
          stroke="#ffffff" stroke-width="${strokeW}"/>
  <circle cx="${cx}" cy="${cy}" r="${ringR}" fill="none"
          stroke="${ACCENT}" stroke-width="${strokeW}" stroke-linecap="round"
          stroke-dasharray="${arc} ${circumference - arc}"
          transform="rotate(-90 ${cx} ${cy})"/>`;
}

function markSvg(size, { padding = 0, rounded = true } = {}) {
  const inner = size - padding * 2;
  const radius = rounded && padding === 0 ? size * 0.22 : 0;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${BRAND_A}"/>
      <stop offset="1" stop-color="${BRAND_B}"/>
    </linearGradient>
    <radialGradient id="sheen" cx="0.25" cy="0.15" r="0.9">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.18"/>
      <stop offset="0.6" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${radius}" fill="url(#bg)"/>
  <rect width="${size}" height="${size}" rx="${radius}" fill="url(#sheen)"/>
  <g transform="translate(${padding},${padding})">
    ${glyph(inner)}
  </g>
</svg>`);
}

function splashSvg(width, height) {
  const tile = Math.round(Math.min(width, height) * 0.3);
  const x = Math.round((width - tile) / 2);
  const y = Math.round((height - tile) / 2);
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${BRAND_A}"/>
      <stop offset="1" stop-color="${BRAND_B}"/>
    </linearGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="${BG}"/>
  <g transform="translate(${x},${y})">
    <rect width="${tile}" height="${tile}" rx="${tile * 0.22}" fill="url(#bg)"/>
    ${glyph(tile)}
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
  { file: "icon-512-maskable.png", size: 512, padding: 51, rounded: false }, // 10% safe zone
  { file: "apple-touch-icon.png", size: 180, padding: 0 },
];
for (const icon of icons) {
  await sharp(markSvg(icon.size, { padding: icon.padding, rounded: icon.rounded ?? true }))
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
