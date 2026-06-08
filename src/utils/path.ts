import os from "node:os";
import path from "node:path";

export function expandTilde(input: string): string {
  if (input === "~") {
    return os.homedir();
  }
  if (input.startsWith("~/")) {
    return path.join(os.homedir(), input.slice(2));
  }
  return input;
}

export function resolveUserPath(input: string): string {
  return path.resolve(expandTilde(input));
}

export function toPosixPath(input: string): string {
  return input.split(path.sep).join("/");
}

