import sharp from "sharp";
import path from "node:path";
import fs from "node:fs/promises";
import { spawn } from "node:child_process";
import { logger } from "./logger.js";

/** Default megapixels reported when no per-model target is passed. */
export const TARGET_MEGAPIXELS = 12;

export interface ResizeResult {
  outputPath: string;
  width: number;
  height: number;
  bytes: number;
  /** Always "portrait" — the bot forces 9:16 portrait output. */
  orientation: "portrait" | "landscape";
}

/**
 * Pick 9:16 portrait dimensions that actually yield the requested megapixel
 * count when measured from pixel dims (since EXIF readers compute Megapixels
 * from width x height, not from any tag we write).
 *
 * Both axes are forced even so HEVC 4:2:0 (x265) accepts the frame.
 *
 *   12 MP → 2598 x 4618  (~12.0 MP at 9:16)
 *   18 MP → 3182 x 5656  (~18.0 MP at 9:16)
 *   24 MP → 3674 x 6532  (~24.0 MP at 9:16)
 */
function pickDims(targetMegapixels: number): { width: number; height: number } {
  if (targetMegapixels >= 24) return { width: 3674, height: 6532 };
  if (targetMegapixels >= 18) return { width: 3182, height: 5656 };
  return { width: 2598, height: 4618 };
}

/**
 * Resize the input image to a 9:16 portrait canvas matching the iPhone model's
 * megapixel rating. Landscape inputs get center-cropped to portrait so the
 * orientation is always 9:16.
 */
export async function resizeToAppleSensor(
  inputPath: string,
  targetMegapixels: number = TARGET_MEGAPIXELS,
): Promise<ResizeResult> {
  const dir = path.dirname(inputPath);
  const base = path.basename(inputPath, path.extname(inputPath));
  const { width: targetW, height: targetH } = pickDims(targetMegapixels);
  const outputPath = path.join(dir, `${base}_${targetMegapixels}mp.jpg`);

  logger.info(
    { inputPath, targetW, targetH, targetMegapixels },
    "image:resize:start",
  );
  const t0 = Date.now();

  await sharp(inputPath, { failOn: "none" })
    .rotate()
    .resize({
      width: targetW,
      height: targetH,
      fit: "cover",
      position: "centre",
      withoutEnlargement: false,
    })
    .jpeg({ quality: 92, mozjpeg: true, chromaSubsampling: "4:2:0" })
    .toFile(outputPath);

  const stat = await fs.stat(outputPath);
  logger.info(
    { outputPath, bytes: stat.size, ms: Date.now() - t0 },
    "image:resize:done",
  );
  return {
    outputPath,
    width: targetW,
    height: targetH,
    bytes: stat.size,
    orientation: "portrait",
  };
}

export interface HeicResult {
  outputPath: string;
  bytes: number;
}

export interface ExposureSettings {
  iso: number;
  exposureTimeStr: string;
}

export async function analyzeBrightness(
  input: string | Buffer,
): Promise<number> {
  const stats = await sharp(input, { failOn: "none" }).stats();
  const channels = stats.channels.slice(0, 3);
  if (channels.length === 0) return 128;
  return channels.reduce((s, c) => s + c.mean, 0) / channels.length;
}

export function pickSuggestedModel(meanLuma: number): string {
  if (meanLuma >= 140) return "ip17";
  if (meanLuma >= 60) return "ip17p";
  return "ip17pm";
}

export function pickRealisticExposure(meanLuma: number): ExposureSettings {
  type Pair = { iso: number; shutter: string };
  let bucket: Pair[];

  if (meanLuma >= 180) {
    bucket = [
      { iso: 32, shutter: "1/2000" },
      { iso: 50, shutter: "1/1600" },
      { iso: 64, shutter: "1/1250" },
      { iso: 80, shutter: "1/1000" },
    ];
  } else if (meanLuma >= 140) {
    bucket = [
      { iso: 64, shutter: "1/500" },
      { iso: 80, shutter: "1/400" },
      { iso: 100, shutter: "1/320" },
      { iso: 125, shutter: "1/250" },
    ];
  } else if (meanLuma >= 100) {
    bucket = [
      { iso: 160, shutter: "1/200" },
      { iso: 200, shutter: "1/120" },
      { iso: 250, shutter: "1/100" },
      { iso: 320, shutter: "1/80" },
    ];
  } else if (meanLuma >= 60) {
    bucket = [
      { iso: 400, shutter: "1/60" },
      { iso: 500, shutter: "1/50" },
      { iso: 640, shutter: "1/40" },
      { iso: 800, shutter: "1/30" },
    ];
  } else if (meanLuma >= 30) {
    bucket = [
      { iso: 1000, shutter: "1/30" },
      { iso: 1250, shutter: "1/30" },
      { iso: 1600, shutter: "1/25" },
      { iso: 2000, shutter: "1/20" },
    ];
  } else {
    bucket = [
      { iso: 2500, shutter: "1/15" },
      { iso: 3200, shutter: "1/12" },
      { iso: 4000, shutter: "1/10" },
      { iso: 5000, shutter: "1/8" },
    ];
  }

  const pick = bucket[Math.floor(Math.random() * bucket.length)];
  return { iso: pick.iso, exposureTimeStr: pick.shutter };
}

const HEIC_CHILD_TIMEOUT_MS = 180_000;

function runHeifEnc(
  args: string[],
  signal?: AbortSignal,
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(Object.assign(new Error("HEIC encoding aborted"), { code: "ABORT" }));
      return;
    }

    const child = spawn("heif-enc", args, {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let settled = false;

    const settle = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      fn();
    };

    const killChild = (sig: NodeJS.Signals = "SIGKILL") => {
      try {
        if (!child.killed) child.kill(sig);
      } catch {
        /* ignore */
      }
    };

    const onAbort = () => {
      killChild("SIGKILL");
      settle(() =>
        reject(
          Object.assign(new Error("HEIC encoding aborted"), {
            code: "ABORT",
            signal: "SIGKILL",
            stdout,
            stderr,
          }),
        ),
      );
    };

    signal?.addEventListener("abort", onAbort, { once: true });

    const timer = setTimeout(() => {
      killChild("SIGKILL");
      settle(() =>
        reject(
          Object.assign(
            new Error(
              `HEIC encoding timed out after ${HEIC_CHILD_TIMEOUT_MS}ms`,
            ),
            {
              code: "ETIMEDOUT",
              killed: true,
              signal: "SIGKILL",
              stdout,
              stderr,
            },
          ),
        ),
      );
    }, HEIC_CHILD_TIMEOUT_MS);

    child.stdout?.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });

    child.on("error", (err: NodeJS.ErrnoException) => {
      settle(() =>
        reject(
          Object.assign(err, {
            stdout,
            stderr,
          }),
        ),
      );
    });

    child.on("close", (code, sig) => {
      settle(() => {
        if (code === 0) {
          resolve({ stdout, stderr });
          return;
        }
        reject(
          Object.assign(
            new Error(
              `heif-enc exited code=${code ?? "null"} signal=${sig ?? "null"}`,
            ),
            {
              status: code,
              signal: sig,
              stdout,
              stderr,
              code: code === null ? "SIGNAL" : code,
            },
          ),
        );
      });
    });
  });
}

/** heif-enc argv. Tuning flags keep x265 to one thread to bound memory/CPU. */
export function buildHeifArgs(
  quality: number,
  outputPath: string,
  inputPath: string,
  tuned: boolean,
): string[] {
  const args = ["--quality", String(quality)];
  if (tuned) {
    args.push(
      "-p",
      "x265:pools=none",
      "-p",
      "x265:frame-threads=1",
      "-p",
      "x265:log-level=2",
    );
  }
  args.push("--output", outputPath, inputPath);
  return args;
}

function formatHeicError(error: any): string {
  const stderr =
    typeof error?.stderr === "string"
      ? error.stderr.trim()
      : Buffer.isBuffer(error?.stderr)
        ? error.stderr.toString("utf8").trim()
        : "";
  const stdout =
    typeof error?.stdout === "string"
      ? error.stdout.trim()
      : Buffer.isBuffer(error?.stdout)
        ? error.stdout.toString("utf8").trim()
        : "";
  const signal = error?.signal ? ` signal=${error.signal}` : "";
  const status =
    error?.status != null ? ` status=${error.status}` : "";
  const code =
    error?.code != null && error.code !== "ENOENT"
      ? ` code=${error.code}`
      : "";
  const detail =
    stderr || stdout || error?.message || "unknown heif-enc error";
  return `${detail}${signal}${code}${status}`.trim();
}

/** Re-encode a JPEG into a real HEIC (HEVC) file using libheif/heif-enc. */
export async function encodeAsHeic(
  inputPath: string,
  quality = 75,
  signal?: AbortSignal,
): Promise<HeicResult> {
  const dir = path.dirname(inputPath);
  const base = path.basename(inputPath, path.extname(inputPath));
  const outputPath = path.join(dir, `${base}.heic`);
  const qualities = Array.from(new Set([quality, 65, 55, 45, 35, 25])).map(
    (v) => Math.max(1, Math.min(100, Math.round(v))),
  );
  const maxDiscordBytes = 9.5 * 1024 * 1024;

  logger.info({ inputPath, quality }, "image:heic:start");
  const t0 = Date.now();

  for (const q of qualities) {
    if (signal?.aborted) {
      throw new Error("HEIC encoding aborted");
    }
    try {
      await fs.rm(outputPath, { force: true }).catch(() => {});
      logger.info({ quality: q, outputPath }, "image:heic:encode-attempt");
      try {
        await runHeifEnc(buildHeifArgs(q, outputPath, inputPath, true), signal);
      } catch (tuned: any) {
        // The x265 tuning flags are optional. If this heif-enc/libheif build
        // rejects one of them (unknown parameter), retry once without them
        // instead of failing every encode. Crashes, timeouts and aborts are
        // real failures and are not retried.
        const msg = `${tuned?.stderr ?? ""}${tuned?.stdout ?? ""}`;
        const rejectedFlag =
          typeof tuned?.status === "number" &&
          tuned.status !== 0 &&
          !tuned?.signal &&
          /unknown|invalid|unsupported|not supported|parameter|option/i.test(msg);
        if (!rejectedFlag) throw tuned;
        logger.warn(
          { quality: q, detail: formatHeicError(tuned) },
          "image:heic:tuning-flags-rejected-retrying-plain",
        );
        await fs.rm(outputPath, { force: true }).catch(() => {});
        await runHeifEnc(buildHeifArgs(q, outputPath, inputPath, false), signal);
      }
    } catch (error: any) {
      if (error?.code === "ENOENT") {
        throw new Error(
          "HEIC encoder unavailable: libheif/heif-enc is not installed in the Render runtime",
        );
      }
      logger.error(
        {
          err: error,
          quality: q,
          detail: formatHeicError(error),
          signal: error?.signal,
          status: error?.status,
          code: error?.code,
        },
        "image:heic:failed",
      );
      throw new Error(`HEIC encoding failed: ${formatHeicError(error)}`);
    }

    const stat = await fs.stat(outputPath).catch(() => null);
    if (!stat || stat.size === 0) {
      logger.warn({ quality: q }, "image:heic:empty-output");
      continue;
    }
    if (stat.size <= maxDiscordBytes) {
      logger.info(
        { outputPath, bytes: stat.size, quality: q, ms: Date.now() - t0 },
        "image:heic:done",
      );
      return { outputPath, bytes: stat.size };
    }
    logger.info(
      { bytes: stat.size, quality: q, maxDiscordBytes },
      "image:heic:too-large-retry",
    );
  }

  await fs.rm(outputPath, { force: true }).catch(() => {});
  throw new Error("HEIC encoding failed: output is too large for Discord");
}
