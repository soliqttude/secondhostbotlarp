import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { IPhoneModel } from "./models.js";

const exec = promisify(execFile);

export async function applyIPhoneMetadata(filePath: string, model: IPhoneModel, capturedAt = new Date()): Promise<void> {
  const date = capturedAt.toISOString().slice(0, 19).replace("T", " ");
  const args = [
    "-overwrite_original", "-P",
    "-Make=" + model.make, "-Model=" + model.model, "-Software=" + model.software,
    "-LensMake=" + model.lensMake, "-LensModel=" + model.lensModel,
    "-FocalLength=" + model.focalLength, "-FocalLengthIn35mmFormat=" + model.focalLength35mm,
    "-FNumber=" + model.fNumber, "-ExposureProgram=Program AE",
    "-DateTimeOriginal=" + date, "-CreateDate=" + date, "-ModifyDate=" + date,
    "-ExifVersion=0232", "-ColorSpace=sRGB", "-Flash=No Flash",
    "-WhiteBalance=Auto", "-MeteringMode=Multi-segment",
    "-UserComment=iPhone profile: " + model.label + " - " + model.megapixels + " MP",
    "-CreatorTool=Apple " + model.label,
    filePath
  ];

  await exec("exiftool", args, { timeout: 30000, maxBuffer: 1024 * 1024 });

  const make = (await exec("exiftool", ["-s3", "-Make", filePath], { timeout: 10000 })).stdout.trim();
  const deviceModel = (await exec("exiftool", ["-s3", "-Model", filePath], { timeout: 10000 })).stdout.trim();

  if (make !== model.make || deviceModel !== model.model) {
    throw new Error("EXIF verification failed: Make=" + make + " Model=" + deviceModel);
  }
}

export async function closeMetadata(): Promise<void> {
  // System ExifTool is invoked per operation; there is no persistent process to close.
}
