# Contributing to INTERLIS IDE

INTERLIS IDE combines product packaging, Eclipse Theia composition, and INTERLIS-specific tooling into a desktop application. Contributions are welcome, but the first step is to change the right repository and verify the right level of behaviour.

## Where changes belong

Use `interlis-ide` for:

- Electron and browser product packaging
- branding, icons, splash screen, menus, and about dialog content
- updater behaviour and release workflow integration
- bundled plugin versions and runtime defaults
- documentation, maintainer runbooks, and GitHub Actions workflows
- Eclipse Theia upstream merges and related conflict resolution

Use `interlis-lsp` for:

- Java language server behaviour
- diagnostics, compiler integration, and document processing
- LSP commands and responses
- editor features implemented inside the bundled VS Code extension
- Java runtime delivery for the extension itself

If a change affects both repositories, document the dependency in both PRs and link them to each other.

## Contribution flow

1. Start from `origin/master`.
2. Create a short-lived branch with a descriptive name.
3. Make the smallest coherent change that solves the problem.
4. Run the relevant checks locally.
5. Open a PR against `master` with a concise summary of behaviour changes and verification steps.

For user-facing UI or packaging changes, include screenshots or a short note about what changed visually.

## Local verification expectations

Use the smallest set of checks that proves the change:

- Docs-only changes:
  - verify links and examples manually
  - run `npm --prefix docs run build` if Docusaurus pages changed
- Product, packaging, or workflow changes:
  - `yarn lint`
  - `yarn build:dev`
  - `yarn download:plugins`
  - `yarn electron package:preview`
  - `yarn electron test`
- Release or installer changes:
  - `yarn electron package:prod`

If a command is intentionally skipped, explain why in the PR.

## Issues and support channels

- Use <https://github.com/edigonzales/interlis-ide/issues> for IDE packaging, updater, branding, distribution, and documentation problems.
- Use <https://github.com/edigonzales/interlis-lsp/issues> for language server, validation, compiler, and editor feature issues.

## Keep the docs in sync

If you change the release process, updater behaviour, Theia upgrade flow, or contributor workflow, update the matching root runbook in the same PR:

- [RELEASE.md](RELEASE.md)
- [THEIA_UPGRADE.md](THEIA_UPGRADE.md)
- [PUBLISHING.md](PUBLISHING.md)

This repository depends on those files being accurate enough for future maintainers to repeat the workflow without reconstructing it from old PRs or chat logs.
