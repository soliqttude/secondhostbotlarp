import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { IPhoneModel } from "./models.js";

const exec = promisify(execFile);

export async function applyIPhoneMetadata(filePath: string, model: IPhoneModel, capturedAt = new Date()): Promise<void> {
  const date = capturedAt.toISOString().slice(0, 19).replace("T", " ");
  const args = [
    "-overwrite_original", "-P", "-m",
    "-EXIF:Make=" + model.make, "-EXIF:Model=" + model.model, "-EXIF:Software=" + model.software,
    "-EXIF:LensMake=" + model.lensMake, "-EXIF:LensModel=" + model.lensModel,
    "-EXIF:FocalLength=" + model.focalLength, "-EXIF:FocalLengthIn35mmFormat=" + model.focalLength35mm,
    "-EXIF:FNumber=" + model.fNumber, "-EXIF:ExposureProgram=Program AE",
    "-EXIF:DateTimeOriginal=" + date, "-EXIF:CreateDate=" + date, "-EXIF:ModifyDate=" + date,
    "-EXIF:ExifVersion=0232", "-EXIF:ColorSpace=sRGB", "-EXIF:Flash=No Flash",
    "-EXIF:WhiteBalance=Auto", "-EXIF:MeteringMode=Multi-segment",
    "-EXIF:UserComment=iPhone profile: " + model.label + " - " + model.megapixels + " MP",
    "-XMP:Make=" + model.make, "-XMP:Model=" + model.model,
    "-XMP:CreatorTool=Apple " + model.label,
    "-XMP:Description=" + model.megapixels + " MP iPhone metadata profile",
    filePath
  ];

  const result = await exec("exiftool", args, { timeout: 30000, maxBuffer: 1024 * 1024 });
  if (result.stderr.trim() && !result.stderr.includes("image files updated")) {
    throw new Error(result.stderr.trim());
  }

  const verify = await exec("exiftool", [
    "-j", "-EXIF:Make", "-EXIF:Model", "-EXIF:Software",
    "-EXIF:LensModel", "-EXIF:FocalLength", "-EXIF:FNumber",
    "-EXIF:DateTimeOriginal", "-EXIF:UserComment", filePath
  ], { timeout: 10000, maxBuffer: 1024 * 1024 });

  let data: Record<string, unknown>;
  try {
    const parsed = JSON.parse(verify.stdout);
    data = parsed[0] ?? {};
  } catch {
    throw new Error("EXIF verification failed: ExifTool returned invalid metadata");
  }

  if (String(data.Make ?? "") !== model.make || String(data.Model ?? "") !== model.model) {
    throw new Error("EXIF verification failed: metadata was not written to the output image");
  }
  if (!String(data.UserComment ?? "").includes(model.megapixels + " MP")) {
    throw new Error("EXIF verification failed: megapixel profile was not written");
  }
}

export async function closeMetadata(): Promise<void> {}
