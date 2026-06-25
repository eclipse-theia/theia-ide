# Developing with a Local Theia Framework

This guide explains how to build and test the Theia IDE against a local development version of the [Theia framework](https://github.com/eclipse-theia/theia). This is useful when you need to:

- Test Theia IDE changes against unreleased Theia features
- Debug issues that span both the framework and the Theia IDE
- Develop new Theia features and immediately test them in the Theia IDE

## Prerequisites

- Node.js and npm installed (see [Theia prerequisites](https://github.com/eclipse-theia/theia/blob/master/doc/Developing.md#prerequisites))
- A local clone of the [Theia repository](https://github.com/eclipse-theia/theia)

The recommended setup is to have both repositories cloned as siblings:

```text
parent-directory/
  theia/          # Theia framework
  theia-ide/      # This repository
```

This matches the script's default `--theia-path` of `../theia`. You can clone Theia anywhere and specify the path with `--theia-path`.

## Important Note

This script does not update the IDE version or Theia package versions in `package.json` files. It uses the current state of both repositories and symlinks the local `@theia/*` packages into the IDE's `node_modules` to override the dependencies. If needed, you can run versioning commands (e.g., `yarn update:theia <version>`) separately before building.

## Quick Start

```sh
# Clone Theia as a sibling (if not already done)
git clone https://github.com/eclipse-theia/theia.git ../theia

# Build everything (default location ../theia)
yarn build:local-theia
```

`yarn build:local-theia` is a convenience wrapper for the default setup. It is
equivalent to running `node scripts/build-with-local-theia.js` directly.

Any options are forwarded to the script, so the two forms below are equivalent:

```sh
yarn build:local-theia --theia-path /path/to/theia --package
node scripts/build-with-local-theia.js --theia-path /path/to/theia --package
```

## What the Script Does

1. Build the local Theia framework (`npm ci` + `npm run compile`)
2. Install the IDE dependencies (`yarn`)
3. Symlink all `@theia/*` packages from the local Theia into the IDE's `node_modules`, pointing at the given `--theia-path`
4. Copy any transitive dependencies that the linked packages need but cannot resolve from the Theia checkout (see [Why some dependencies are copied](#why-some-dependencies-are-copied))
5. Build the Theia IDE extensions and electron-next application
6. Download required plugins

The symlinks point explicitly at the requested `--theia-path`, so the build always uses that exact checkout. This works with Theia cloned in any location, including git worktrees.

## Usage

### Full Build

```sh
yarn build:local-theia
```

### Using a Different Theia Location

Theia can live anywhere; pass its path with `--theia-path`. This also works with
git worktrees, since the packages are symlinked at the exact path you provide:

```sh
yarn build:local-theia --theia-path /path/to/theia
```

### Incremental Development

After the initial build, you can iterate faster:

```sh
# Rebuild only Theia IDE (Theia unchanged)
yarn build:local-theia --skip-theia-build

# Rebuild only Theia packages, then rebuild Theia IDE
cd ../theia && npm run compile
cd ../theia-ide && yarn build:applications:next:dev
```

### Build and Package

To create a distributable application:

```sh
yarn build:local-theia --package
```

The packaged application will be in `applications/electron-next/dist/`.

### Set Up Links Only

If you want to manage builds manually:

```sh
yarn build:local-theia --skip-theia-build --skip-ide-build
```

### Skip Plugin Download

If you already have plugins or want to skip downloading them:

```sh
yarn build:local-theia --skip-plugins
```

### Restore Normal Dependencies

When you're done testing with the local Theia:

```sh
yarn build:local-theia --unlink
```

This removes the `@theia/*` symlinks and reinstalls packages from npm.

### Dry Run

Preview what commands will be executed:

```sh
yarn build:local-theia --dry-run
```

## Running the Theia IDE (Next)

After building:

```sh
yarn --cwd applications/electron-next start
```

If you packaged the application with `--package`, you can also run the packaged version directly from `applications/electron-next/dist/`.

## Development Workflow

A typical development workflow looks like:

1. **Initial setup**: Clone Theia and run the full build

    ```sh
    git clone https://github.com/eclipse-theia/theia.git ../theia
    yarn build:local-theia
    ```

2. **Make changes in Theia**: Edit files in `../theia`

3. **Rebuild Theia**:

    ```sh
    cd ../theia && npm run compile
    ```

4. **Rebuild and run Theia IDE**:

    ```sh
    cd ../theia-ide
    yarn build:applications:next:dev
    yarn --cwd applications/electron-next start
    ```

5. **When done**: Restore npm dependencies

    ```sh
    yarn build:local-theia --unlink
    ```

## Command Reference

| Option                | Description                                          |
|-----------------------|------------------------------------------------------|
| `--theia-path <path>` | Path to local Theia repository (default: `../theia`) |
| `--skip-theia-build`  | Skip building Theia packages (use if already built)  |
| `--skip-ide-build`    | Skip building Theia IDE (use for linking only)       |
| `--skip-plugins`      | Skip downloading plugins                             |
| `--package`           | Package the electron-next application after building |
| `--unlink`            | Remove links and restore npm dependencies            |
| `--dry-run`           | Print commands without executing them                |
| `--help`              | Show help message                                    |

## Why some dependencies are copied

When the local Theia is installed with `npm`, some transitive dependencies end
up nested inside a package's own `node_modules` (for example
`packages/filesystem/node_modules/tar-stream`). Such a nested package may rely
on a dependency (e.g. `b4a`) that is not installed anywhere reachable from the
Theia checkout. Because the build bundler and the packager resolve modules
starting from the symlinked location, they would fail with errors like:

```text
✘ [ERROR] Could not resolve "b4a"
    ../../../theia/packages/filesystem/node_modules/tar-stream/pack.js
```

To avoid this, the script scans the linked packages for dependencies that
cannot be resolved from the Theia checkout and copies them from the IDE's own
`node_modules` into the Theia checkout's `node_modules`. This is generic over
the dependency name and runs during both the build and the packaging step.

## Troubleshooting

### "Theia directory not found"

Make sure you have cloned the Theia repository:

```sh
git clone https://github.com/eclipse-theia/theia.git ../theia
```

Or specify the correct path:

```sh
yarn build:local-theia --theia-path /correct/path/to/theia
```

### "Package not found in local Theia"

Some `@theia/*` packages used by the Theia IDE may not exist in your Theia checkout. This can happen if:

- You're on an older Theia branch that doesn't have newer packages
- The package is from a different source

The script will warn about missing packages but continue with available ones.

### Build Errors After Switching Branches

If you switch branches in either repository, clean and rebuild:

```sh
# In theia-ide
git clean -xfd
yarn build:local-theia

# Or if only Theia packages changed
cd ../theia && git clean -xfd && npm ci && npm run compile
cd ../theia-ide && yarn build:applications:next:dev
```

### Restoring Clean State

If things get into a bad state:

```sh
# Unlink and restore npm packages
yarn build:local-theia --unlink

# Full clean rebuild
git clean -xfd
yarn && yarn build:dev && yarn download:plugins
```
