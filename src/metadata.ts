import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { IPhoneModel } from "./models.js";

const exec = promisify(execFile);

export async function applyIPhoneMetadata(filePath: string, model: IPhoneModel, capturedAt = new Date(), width?: number, height?: number): Promise<void> {
  const date = capturedAt.toISOString().slice(0, 19).replace("T", " ");
  const args = [
    "-overwrite_original", "-P", "-m",
    "-Make=" + model.make,
    "-Model=" + model.model,
    "-Software=" + model.software,
    "-LensMake=" + model.lensMake,
    "-LensModel=" + model.lensModel,
    "-FocalLength=" + model.focalLength,
    "-FocalLengthIn35mmFormat=" + model.focalLength35mm,
    "-FNumber=" + model.fNumber,
    "-ApertureValue=" + Math.log2(model.fNumber * model.fNumber),
    "-MaxApertureValue=" + Math.log2(model.fNumber * model.fNumber),
    "-ExposureTime=1/120",
    "-ShutterSpeedValue=" + Math.log2(120),
    "-ISO=50",
    "-ExposureProgram=Program AE",
    "-ExposureCompensation=0",
    "-BrightnessValue=7",
    "-MeteringMode=Multi-segment",
    "-WhiteBalance=Auto",
    "-Flash=No Flash",
    "-DigitalZoomRatio=1",
    "-SceneCaptureType=Standard",
    "-CustomRendered=Normal Process",
    "-Contrast=Normal",
    "-Saturation=Normal",
    "-Sharpness=Normal",
    "-DateTimeOriginal=" + date,
    "-CreateDate=" + date,
    "-ModifyDate=" + date,
    "-ExifVersion=0232",
    "-ColorSpace=sRGB",
    "-FileSource=Digital Still Camera",
    "-UserComment=iPhone profile: " + model.label + " - " + model.megapixels + " MP",
    ...(width && height ? ["-PixelXDimension=" + width, "-PixelYDimension=" + height] : []),
    "-XMP:Make=" + model.make,
    "-XMP:Model=" + model.model,
    "-XMP:CreatorTool=Apple " + model.label,
    "-XMP:Description=" + model.megapixels + " MP iPhone metadata profile",
    filePath
  ];

  const result = await exec("exiftool", args, { timeout: 30_000, maxBuffer: 1024 * 1024 });
  if (result.stderr.trim() && !result.stderr.includes("image files updated")) {
    throw new Error(result.stderr.trim());
  }

  const verify = await exec("exiftool", [
    "-j",
    "-Make", "-Model", "-Software", "-LensMake", "-LensModel",
    "-FocalLength", "-FocalLengthIn35mmFormat", "-FNumber",
    "-ExposureTime", "-ISO", "-ExposureProgram", "-ExposureCompensation",
    "-MeteringMode", "-WhiteBalance", "-Flash",
    "-DateTimeOriginal", "-UserComment", "-PixelXDimension", "-PixelYDimension",
    filePath
  ], { timeout: 10_000, maxBuffer: 1024 * 1024 });

  let data: Record<string, unknown>;
  try {
    const parsed = JSON.parse(verify.stdout);
    data = parsed[0] ?? {};
  } catch {
    throw new Error("EXIF verification failed: ExifTool returned invalid metadata");
  }

  const required: Array<[string, string]> = [
    ["Make", model.make],
    ["Model", model.model],
    ["Software", model.software],
    ["LensMake", model.lensMake],
    ["LensModel", model.lensModel],
    ["FocalLength", String(model.focalLength)],
    ["FocalLengthIn35mmFormat", String(model.focalLength35mm)],
    ["FNumber", String(model.fNumber)],
    ["ExposureTime", "1/120"],
    ["ISO", "50"],
    ["WhiteBalance", "Auto"],
    ["Flash", "No Flash"]
  ];

  for (const [tag, expected] of required) {
    if (!String(data[tag] ?? "").includes(expected)) {
      throw new Error("EXIF verification failed: " + tag + " was not written correctly");
    }
  }

  if (width && height && (Number(data.PixelXDimension) !== width || Number(data.PixelYDimension) !== height)) {
    throw new Error("EXIF verification failed: pixel dimensions are incorrect");
  }
}

export async function closeMetadata(): Promise<void> {}