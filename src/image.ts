import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { DATA_DIR } from "./config.js";
import { applyIPhoneMetadata } from "./metadata.js";
import type { IPhoneModel } from "./models.js";

const MAX = 25 * 1024 * 1024;
const exec = promisify(execFile);

export async function processImage(url: string, originalName: string, model: IPhoneModel, userId: string) {
  const dir = path.join(DATA_DIR, "jobs", userId + "-" + Date.now());
  await mkdir(dir, { recursive: true });
  const input = path.join(dir, "input");
  const outputFile = path.join(dir, "output.jpg");

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(60_000) });
    if (!response.ok) throw new Error("download failed: HTTP " + response.status);

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.byteLength > MAX) throw new Error("image is larger than 25 MB");
    await writeFile(input, buffer);

    const size = await exec("identify", ["-format", "%w %h", input], { timeout: 15_000, maxBuffer: 1024 * 1024 });
    const parts = size.stdout.trim().split(/\s+/).map(Number);
    const sourceWidth = parts[0];
    const sourceHeight = parts[1];
    if (!sourceWidth || !sourceHeight) throw new Error("could not read image dimensions");

    const portrait = sourceHeight > sourceWidth;
    const width = portrait ? model.targetHeight : model.targetWidth;
    const height = portrait ? model.targetWidth : model.targetHeight;

    await exec("convert", [
      input,
      "-auto-orient",
      "-resize", width + "x" + height + "^",
      "-gravity", "center",
      "-extent", width + "x" + height,
      "-strip",
      "-interlace", "Plane",
      "-sampling-factor", "4:4:4",
      "-quality", "88",
      "JPEG:" + outputFile
    ], { timeout: 120_000, maxBuffer: 1024 * 1024 });

    await applyIPhoneMetadata(outputFile, model, new Date(), width, height);

    const finalSize = await exec("identify", ["-format", "%w %h %m %b", outputFile], { timeout: 15_000, maxBuffer: 1024 * 1024 });
    const finalParts = finalSize.stdout.trim().split(/\s+/);
    const finalWidth = Number(finalParts[0]);
    const finalHeight = Number(finalParts[1]);
    if (finalWidth !== width || finalHeight !== height) {
      throw new Error("output dimension verification failed");
    }

    const actualMegapixels = (finalWidth * finalHeight) / 1_000_000;
    if (actualMegapixels < model.megapixels * 0.95) {
      throw new Error("output megapixel verification failed");
    }

    const finalBuffer = await readFile(outputFile);
    return {
      buffer: finalBuffer,
      filename: "IMG_" + model.key + "_metadata.jpg",
      bytes: finalBuffer.byteLength,
      cleanup: () => rm(dir, { recursive: true, force: true })
    };
  } catch (error) {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
    throw error;
  }
}