<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

## Code generation constraints

- Generated code must follow the existing project conventions and use only
  libraries and APIs already confirmed in the current codebase.
- Add comments in an appropriate amount to make the code easier to understand.
  Prefer comments that explain intent, non-obvious decisions, data flow, edge
  cases, or important constraints. Do not add comments that merely restate
  the code, and do not comment every obvious line.
- Keep comments accurate when code changes. Remove or update comments that are
  no longer true.
- Before adding a new abstraction or dependency, search for an existing
  project pattern and reuse it when practical.

## Formatting requirements

- All generated and modified code must conform to the root
  `.prettierrc` configuration.
- Run Prettier on modified files when possible, rather than relying on manual
  formatting. Do not introduce formatting overrides that conflict with the
  repository configuration.
- In particular, preserve the repository's current formatting rules: LF line
  endings, no semicolons, double quotes, two-space indentation, ES5 trailing
  commas, an 80-character print width, and the configured Tailwind CSS plugin.
- Keep Tailwind class names formatted by `prettier-plugin-tailwindcss`; do not
  manually reorder them against the plugin's output.
