import { defineDocPipelineConfig } from "doc-pipeline";

export default defineDocPipelineConfig({
  project: {
    name: "mvp-doc-workspace",
    version: "0.1.0",
  },
  include: [
    "AGENTS.md",
    "README.md",
    "docs/**/*.md",
  ],
  exclude: [
    "node_modules/**",
    ".git/**",
    ".env",
    ".env.*",
    "dist/**",
    "build/**",
    "coverage/**",
    "dist-docs/**",
    "docs/draft/**",
  ],
  output: "dist-docs",
  nav: {
    mode: "config",
    file: "docs/nav.json",
  },
});
