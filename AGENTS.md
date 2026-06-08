---
id: agent-doc-rules
type: guide
tags: [agent, docs, doc-pipeline]
order: 5
---

# Agent Documentation Rules

Follow the local Doc Pipeline rules when creating or updating project documentation.

## Minimum Rules

- Write documentation in Markdown.
- Use exactly one level-one heading to state the document topic.
- Keep each document focused on one primary object, workflow, decision, or product slice.
- Add stable frontmatter `id` for important documents.
- Do not move documents only to satisfy navigation preferences.

## Recommended Frontmatter

Use frontmatter when the document identity matters:

```yaml
---
id: stable-kebab-case-id
type: overview | guide | api | design | decision | schema | changelog | task | note
tags: [docs]
order: 10
---
```

`type`, `tags`, and `order` are optional enhancements. Add `module` only when the project has meaningful module-level documentation and API coverage. Prefer clear Markdown content first; let Doc Pipeline infer fields when metadata is not important.

## Agent Workflow

After documentation edits:

1. Run `npm run docs:check`.
2. Read `.doc-pipeline/agent-report.json` when warnings or errors appear.
3. Fix agent-actionable issues in the Markdown or frontmatter.
4. Run `npm run docs:build` before handing the docs back for review.

Use `npm run docs:dev` when the user wants a browser preview.
