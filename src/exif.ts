import { ExifTool } from "exiftool-vendored";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { TMP_DIR } from "./config.js";
import type { IPhoneModelMeta } from "./models.js";

const exiftool = new ExifTool({\n  taskTimeoutMillis: 120_000,\n  spawnTimeoutMillis: 60_000,\n});\n\nif (!(await fileExists(TMP_DIR))) {
  await fs.mkdir(TMP_DIR, { recursive: true });
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function exifTimestamp(date: Date): { date: string; offset: string } {
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const hh = pad(date.getHours());
  const mm = pad(date.getMinutes());
  const ss = pad(date.getSeconds());
  const tz = -date.getTimezoneOffset();
  const sign = tz >= 0 ? "+" : "-";
  const off = `${sign}${pad(Math.floor(Math.abs(tz) / 60))}:${pad(
    Math.abs(tz) % 60,
  )}`;
  return {
    date: `${y}:${m}:${d} ${hh}:${mm}:${ss}`,
    offset: off,
  };
}

export interface InjectResult {
  outputPath: string;
  cleanup: () => Promise<void>;
}

/**
 * Run exiftool to inject realistic iPhone metadata into an image file.
 * Returns the path of the resulting file (overwrites input in place, no _original).
 */
export interface InjectDimensions {
  width: number;
  height: number;
}

export interface InjectExposure {
  iso: number;
  exposureTimeStr: string;
}

export async function injectIPhoneExif(
  inputPath: string,
  meta: IPhoneModelMeta,
  dims: InjectDimensions,
  capturedAt: Date = new Date(),
  exposure?: InjectExposure,
): Promise<InjectResult> {
  const iso = exposure?.iso ?? meta.iso;
  const shutter = exposure?.exposureTimeStr ?? meta.exposureTimeStr;
  const ts = exifTimestamp(capturedAt);
  const workDir = path.join(
    TMP_DIR,
    `job_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`,
  );
  await fs.mkdir(workDir, { recursive: true });
  try {
    const ext = path.extname(inputPath) || ".jpg";
    const targetPath = path.join(workDir, `IMG_${capturedAt.getTime()}${ext}`);
    await fs.copyFile(inputPath, targetPath);

    const tags: Record<string, string | number> = {
    Make: "Apple",
    Model: meta.model,
    Software: meta.software,
    LensMake: "Apple",
    LensModel: meta.lensModel,
    FNumber: meta.fNumber,
    ApertureValue: meta.fNumber,
    ISO: iso,
    ExposureTime: shutter,
    ShutterSpeedValue: shutter,
    FocalLength: meta.focalLength,
    FocalLengthIn35mmFormat: meta.focalLengthIn35mm,
    "IFD0:ImageWidth": dims.width,
    "IFD0:ImageHeight": dims.height,
    "ExifIFD:ExifImageWidth": dims.width,
    "ExifIFD:ExifImageHeight": dims.height,
    "XMP-tiff:ImageWidth": dims.width,
    "XMP-tiff:ImageHeight": dims.height,
    DateTimeOriginal: ts.date,
    CreateDate: ts.date,
    ModifyDate: ts.date,
    OffsetTime: ts.offset,
    OffsetTimeOriginal: ts.offset,
    OffsetTimeDigitized: ts.offset,
    ExifVersion: "0232",
    ColorSpace: 1,
    Flash: "Off, Did not fire",
    WhiteBalance: "Auto",
    MeteringMode: "Multi-segment",
    ExposureProgram: "Program AE",
    Orientation: "Vertical (normal)",
  };

    await exiftool.write(targetPath, tags as any, ["-overwrite_original", "-q", "-m"]);
    return {
      outputPath: targetPath,
      cleanup: async () => {
        try { await fs.rm(workDir, { recursive: true, force: true }); } catch {}
      },
    };
  } catch (error) {
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
    throw error;
  }
}

