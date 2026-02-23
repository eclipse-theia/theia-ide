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

This script does not update the IDE version or Theia package versions in `package.json` files. It uses the current state of both repositories and relies on yarn linking to override the dependencies. If needed, you can run versioning commands (e.g., `yarn update:theia <version>`) separately before building.

## Quick Start

```sh
# Clone Theia as a sibling (if not already done)
git clone https://github.com/eclipse-theia/theia.git ../theia

# Build everything
node scripts/build-with-local-theia.js
```

## What the Script Does

1. Build the local Theia framework (`npm ci` + `npm run compile`)
2. Create yarn links for all `@theia/*` packages
3. Link those packages into the Theia IDE
4. Build the Theia IDE extensions and electron-next application
5. Download required plugins

## Usage

### Full Build

```sh
node scripts/build-with-local-theia.js
```

### Using a Different Theia Location

```sh
node scripts/build-with-local-theia.js --theia-path /path/to/theia
```

### Incremental Development

After the initial build, you can iterate faster:

```sh
# Rebuild only Theia IDE (Theia unchanged)
node scripts/build-with-local-theia.js --skip-theia-build

# Rebuild only Theia packages, then rebuild Theia IDE
cd ../theia && npm run compile
cd ../theia-ide && yarn build:applications:next:dev
```

### Build and Package

To create a distributable application:

```sh
node scripts/build-with-local-theia.js --package
```

The packaged application will be in `applications/electron-next/dist/`.

### Set Up Links Only

If you want to manage builds manually:

```sh
node scripts/build-with-local-theia.js --skip-theia-build --skip-ide-build
```

### Skip Plugin Download

If you already have plugins or want to skip downloading them:

```sh
node scripts/build-with-local-theia.js --skip-plugins
```

### Restore Normal Dependencies

When you're done testing with the local Theia:

```sh
node scripts/build-with-local-theia.js --unlink
```

This removes all yarn links and reinstalls packages from npm.

### Dry Run

Preview what commands will be executed:

```sh
node scripts/build-with-local-theia.js --dry-run
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
    node scripts/build-with-local-theia.js
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
    node scripts/build-with-local-theia.js --unlink
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

## Troubleshooting

### "Theia directory not found"

Make sure you have cloned the Theia repository:

```sh
git clone https://github.com/eclipse-theia/theia.git ../theia
```

Or specify the correct path:

```sh
node scripts/build-with-local-theia.js --theia-path /correct/path/to/theia
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
node scripts/build-with-local-theia.js

# Or if only Theia packages changed
cd ../theia && git clean -xfd && npm ci && npm run compile
cd ../theia-ide && yarn build:applications:next:dev
```

### Restoring Clean State

If things get into a bad state:

```sh
# Unlink and restore npm packages
node scripts/build-with-local-theia.js --unlink

# Full clean rebuild
git clean -xfd
yarn && yarn build:dev && yarn download:plugins
```
