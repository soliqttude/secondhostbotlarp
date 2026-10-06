import sharp from "sharp";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const dir = "/tmp/heic-smoke";
fs.mkdirSync(dir, { recursive: true });
const jpg = path.join(dir, "smoke.jpg");
const heic = path.join(dir, "smoke.heic");

await sharp({
  create: {
    width: 64,
    height: 96,
    channels: 3,
    background: { r: 40, g: 120, b: 200 },
  },
}).jpeg({ quality: 90 }).toFile(jpg);

// Same flags the bot passes in src/image.ts (buildHeifArgs). The tuning flags
// are optional at runtime (the bot retries without them), so a rejection here
// is a warning; only a failure of the plain encode fails the build.
const run = (extra) =>
  execFileSync(
    "heif-enc",
    ["--quality", "60", ...extra, "--output", heic, jpg],
    { encoding: "utf8", timeout: 60_000, maxBuffer: 2 * 1024 * 1024 },
  );
const tuning = ["-p", "x265:pools=none", "-p", "x265:frame-threads=1", "-p", "x265:log-level=2"];

try {
  let out;
  try {
    out = run(tuning);
  } catch (tunedErr) {
    console.warn("WARNING: heif-enc rejected the x265 tuning flags; runtime will fall back to plain encode");
    console.warn(String(tunedErr?.stderr || tunedErr?.message || tunedErr));
    out = run([]);
  }
  const st = fs.statSync(heic);
  if (!st.size) throw new Error("smoke HEIC is empty");
  console.log("HEIC smoke OK:", st.size, "bytes");
  if (out?.trim()) console.log(out.trim());
} catch (e) {
  console.error("HEIC smoke FAILED");
  const stderr = e?.stderr;
  const stdout = e?.stdout;
  if (stderr) console.error("stderr:", typeof stderr === "string" ? stderr : stderr.toString());
  if (stdout) console.error("stdout:", typeof stdout === "string" ? stdout : stdout.toString());
  console.error("message:", e?.message || e);
  if (e?.signal) console.error("signal:", e.signal);
  if (e?.status != null) console.error("status:", e.status);
  process.exit(1);
}