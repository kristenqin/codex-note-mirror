#!/usr/bin/env node
import { Command } from "commander";
import { runDoctorCommand } from "./commands/doctorCommand.js";
import { runInitCommand } from "./commands/initCommand.js";
import { runStatusCommand } from "./commands/statusCommand.js";
import { runSyncCommand } from "./commands/syncCommand.js";
import { AppError, getErrorMessage } from "./utils/errors.js";

function handleCliError(error: unknown): never {
  if (error instanceof AppError) {
    console.error(`${error.code}: ${error.message}`);
    process.exit(1);
  }
  console.error(getErrorMessage(error));
  process.exit(1);
}

const program = new Command();

program
  .name("codex-note-mirror")
  .description("Mirror visible Codex JSONL chat sessions into Markdown notes.")
  .version("0.1.0");

program
  .command("init")
  .description("Initialize sourcePath and targetPath config.")
  .option("--source <path>", "Codex JSONL source directory")
  .option("--target <path>", "Markdown target directory")
  .action(async (options: { source?: string; target?: string }) => {
    await runInitCommand({ sourcePath: options.source, targetPath: options.target }).catch(handleCliError);
  });

program
  .command("sync")
  .description("Sync Codex JSONL sessions into Markdown notes.")
  .option("--source <path>", "Override source directory")
  .option("--target <path>", "Override target directory")
  .option("--verbose", "Print parse warnings")
  .action(async (options: { source?: string; target?: string; verbose?: boolean }) => {
    await runSyncCommand({
      sourcePath: options.source,
      targetPath: options.target,
      verbose: options.verbose,
    }).catch(handleCliError);
  });

program
  .command("status")
  .description("Show sync state without modifying files.")
  .option("--source <path>", "Override source directory")
  .option("--target <path>", "Override target directory")
  .action(async (options: { source?: string; target?: string }) => {
    await runStatusCommand({ sourcePath: options.source, targetPath: options.target }).catch(handleCliError);
  });

program
  .command("doctor")
  .description("Diagnose config, source, target, state, and sync block issues.")
  .action(async () => {
    await runDoctorCommand().catch(handleCliError);
  });

await program.parseAsync();

