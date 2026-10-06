import { ExifTool } from "exiftool-vendored";
import type { IPhoneModel } from "./models.js";
const exiftool = new ExifTool({ taskTimeoutMillis: 120000, spawnTimeoutMillis: 30000 });
export async function applyIPhoneMetadata(filePath: string, model: IPhoneModel, capturedAt = new Date()): Promise<void> {
  const localDate = capturedAt.toISOString().slice(0, 19).replace("T", " ");
  await exiftool.write(filePath, { Make:model.make, Model:model.model, Software:model.software, LensMake:model.lensMake, LensModel:model.lensModel, FocalLength:model.focalLength, FocalLengthIn35mmFormat:model.focalLength35mm, FNumber:model.fNumber, ExposureProgram:"Program AE", DateTimeOriginal:localDate, CreateDate:localDate, ModifyDate:localDate, ExifVersion:"0232", ColorSpace:"sRGB", Flash:"No Flash", WhiteBalance:"Auto", MeteringMode:"Multi-segment", UserComment:"iPhone profile: "+model.label+" - "+model.megapixels+" MP", "XMP:CreatorTool":"Apple "+model.label }, ["-overwrite_original","-q","-P"]);
}
export async function closeMetadata():Promise<void>{await exiftool.end();}
