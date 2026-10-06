import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { DATA_DIR } from "./config.js";
import { applyIPhoneMetadata } from "./metadata.js";
import type { IPhoneModel } from "./models.js";

const MAX = 25 * 1024 * 1024;
const allowed = [".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif", ".tif", ".tiff"];

function extension(name: string): string {
  const e = path.extname(name).toLowerCase();
  return allowed.includes(e) ? e : ".jpg";
}

export async function processImage(url: string, originalName: string, model: IPhoneModel, userId: string) {
  const dir = path.join(DATA_DIR, "jobs", userId + "-" + Date.now());
  await mkdir(dir, { recursive: true });
  const ext = extension(originalName);
  const file = path.join(dir, "input" + ext);

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(60_000) });
    if (!response.ok) throw new Error("download failed: HTTP " + response.status);

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.byteLength > MAX) throw new Error("image is larger than 25 MB");

    await writeFile(file, buffer);
    await applyIPhoneMetadata(file, model);

    const output = await readFile(file);
    return {
      buffer: output,
      filename: "IMG_" + model.key + "_metadata" + ext,
      bytes: output.byteLength,
      cleanup: () => rm(dir, { recursive: true, force: true })
    };
  } catch (error) {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
    throw error;
  }
}
