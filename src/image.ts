import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { DATA_DIR } from "./config.js";
import { applyIPhoneMetadata } from "./metadata.js";
import type { IPhoneModel } from "./models.js";

const MAX = 25 * 1024 * 1024;

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

    const width = model.targetWidth;
    const height = model.targetHeight;

    // libvips/sharp is substantially more memory-efficient than ImageMagick
    // for large 48 MP outputs on small Render instances.
    await sharp(input, { limitInputPixels: 100_000_000 })
      .rotate()
      .resize(width, height, {
        fit: "cover",
        position: "centre",
        withoutEnlargement: false
      })
      .jpeg({
        quality: 88,
        chromaSubsampling: "4:4:4",
        progressive: true,
        mozjpeg: false
      })
      .toFile(outputFile);

    await applyIPhoneMetadata(outputFile, model, new Date(), width, height);

    const info = await sharp(outputFile, { limitInputPixels: 100_000_000 }).metadata();
    if (info.width !== width || info.height !== height) {
      throw new Error("output dimension verification failed");
    }

    const actualMegapixels = (width * height) / 1_000_000;
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