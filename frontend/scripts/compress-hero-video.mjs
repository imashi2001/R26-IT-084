/**
 * Compress local hero-bg.mov → hero-bg.mp4 for Railway deploy (~5–15 MB).
 * Skips quietly if source missing or output already newer.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ffmpegStatic from "ffmpeg-static";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const input = path.join(root, "public", "videos", "hero-bg.mov");
const output = path.join(root, "public", "videos", "hero-bg.mp4");

if (!fs.existsSync(input)) {
  console.log("[hero-video] hero-bg.mov not found — skipping compression");
  process.exit(0);
}

if (
  fs.existsSync(output) &&
  fs.statSync(output).mtimeMs >= fs.statSync(input).mtimeMs
) {
  const mb = (fs.statSync(output).size / 1024 / 1024).toFixed(1);
  console.log(`[hero-video] hero-bg.mp4 up to date (${mb} MB)`);
  process.exit(0);
}

if (!ffmpegStatic) {
  console.warn("[hero-video] ffmpeg binary missing — cannot compress");
  process.exit(0);
}

console.log("[hero-video] Compressing hero-bg.mov → hero-bg.mp4 …");

const result = spawnSync(
  ffmpegStatic,
  [
    "-y",
    "-i",
    input,
    "-vf",
    "scale=1280:-2",
    "-c:v",
    "libx264",
    "-crf",
    "28",
    "-preset",
    "fast",
    "-an",
    "-movflags",
    "+faststart",
    output,
  ],
  { stdio: "inherit" }
);

if (result.status !== 0) {
  console.error("[hero-video] compression failed");
  process.exit(result.status || 1);
}

const mb = (fs.statSync(output).size / 1024 / 1024).toFixed(1);
console.log(`[hero-video] Done — hero-bg.mp4 (${mb} MB)`);
