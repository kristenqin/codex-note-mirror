import path from "node:path";
import fs from "fs-extra";
import { describe, expect, it } from "vitest";
import { scanSourceFiles } from "../src/scanner/scanner.js";
import { createTempDir } from "./helpers/tmp.js";

describe("scanSourceFiles", () => {
  it("recursively scans non-empty JSONL files and ignores hidden, empty, and non-JSONL files", async () => {
    const sourcePath = await createTempDir();
    await fs.ensureDir(path.join(sourcePath, "nested"));
    await fs.ensureDir(path.join(sourcePath, ".hidden"));
    await fs.writeFile(path.join(sourcePath, "root.jsonl"), "{}\n", "utf8");
    await fs.writeFile(path.join(sourcePath, "nested", "child.jsonl"), "{}\n", "utf8");
    await fs.writeFile(path.join(sourcePath, "empty.jsonl"), "", "utf8");
    await fs.writeFile(path.join(sourcePath, ".hidden.jsonl"), "{}\n", "utf8");
    await fs.writeFile(path.join(sourcePath, ".hidden", "child.jsonl"), "{}\n", "utf8");
    await fs.writeFile(path.join(sourcePath, "note.txt"), "{}\n", "utf8");

    const files = await scanSourceFiles(sourcePath);

    expect(files.map((file) => file.fileName).sort()).toEqual(["child.jsonl", "root.jsonl"]);
    expect(files.every((file) => file.contentHash.length === 64)).toBe(true);
  });
});
