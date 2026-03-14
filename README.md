# INTERLIS IDE

INTERLIS IDE is a desktop development environment for the INTERLIS data language, built on Eclipse Theia and bundled with the INTERLIS language tooling. It combines model-aware editing, validation, compilation, UML and documentation workflows, and a curated desktop packaging setup into a ready-to-use application.

## Project links

- Releases: <https://github.com/edigonzales/interlis-ide/releases>
- Documentation: <https://interlis-ide.ch/docs/intro>
- IDE issue tracker: <https://github.com/edigonzales/interlis-ide/issues>
- Language tooling (`interlis-lsp`): <https://github.com/edigonzales/interlis-lsp>
- Eclipse Theia upstream: <https://github.com/eclipse-theia/theia-ide>

## What this repository owns

This repository contains the desktop product layer around the INTERLIS tooling:

- Electron and browser application packaging
- product branding, splash screen, menus, about dialog, and updater integration
- bundled plugins and runtime defaults
- GitHub Actions workflows for verification, release creation, and documentation deployment
- maintainer runbooks for product releases and Eclipse Theia upstream upgrades

The language intelligence itself lives in the [`interlis-lsp`](https://github.com/edigonzales/interlis-lsp) repository. Changes to diagnostics, compiler integration, language server requests, or Java-side runtime delivery usually belong there rather than here.

## Key capabilities

- INTERLIS-aware editing with the bundled INTERLIS Editor VS Code extension
- validation and compilation workflows backed by the Java language server
- generated UML and documentation previews
- curated Java tooling bundle for projects that need the Java extension pack
- GitHub Releases based desktop updates for the stable channel
- Theia-based product composition that can be upgraded from upstream in a traceable way

## Repository structure

- `applications/` contains the browser and Electron application packages
- `theia-extensions/` contains product-specific Theia extensions such as branding, updater, launcher, and webview drag handling
- `docs/` contains the Docusaurus documentation site published to GitHub Pages
- `scripts/` contains small maintenance helpers such as Theia version updates and plugin permissions fixes

## Development quickstart

Requirements:

- Node.js `>=20`
- Yarn Classic (`1.x`)
- Git

Bootstrap and verify a local development build:

```sh
yarn
yarn build:dev
yarn download:plugins
yarn electron package:preview
yarn electron test
```

Additional useful commands:

```sh
# Start the browser application
yarn browser start

# Create a production package without publishing
yarn electron package:prod

# Run lint checks
yarn lint
```

## Maintainer documentation

- [RELEASE.md](RELEASE.md): create a new INTERLIS IDE product release such as `0.0.8 -> 0.0.9`
- [THEIA_UPGRADE.md](THEIA_UPGRADE.md): upgrade the Eclipse Theia base while preserving local product changes
- [PUBLISHING.md](PUBLISHING.md): understand which GitHub Actions workflows publish releases and docs
- [CONTRIBUTING.md](CONTRIBUTING.md): contributor workflow and repository ownership boundaries

## License

- [MIT](LICENSE)
