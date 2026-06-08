import fs from "fs-extra";
import { AppError } from "../utils/errors.js";

export async function ensureTargetPathWritable(targetPath: string): Promise<void> {
  try {
    await fs.ensureDir(targetPath);
    await fs.access(targetPath, fs.constants.W_OK);
  } catch (error) {
    throw new AppError("TARGET_PATH_NOT_WRITABLE", `Target path is not writable: ${targetPath}`, { cause: error });
  }
}
