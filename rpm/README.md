# Building Theia IDE RPM Packages

This document explains how to build Theia IDE RPM packages for Fedora, both locally and using [Fedora COPR](https://copr.fedorainfracloud.org/).

## Overview

Theia IDE is packaged as an Electron application following the [Fedora Node.js Packaging Guidelines](https://docs.fedoraproject.org/en-US/packaging-guidelines/Node.js/):

- **Bundled dependencies**: As an Electron application, Theia IDE bundles its Node.js dependencies. This is documented via `Provides: bundled(npm(...))` entries in the spec file.

- **Offline builds**: The build uses vendored dependencies to ensure reproducible, offline builds without network access during `%build`.

- **License**: The package includes `MIT AND EPL-2.0` to cover Theia components, plus various licenses from bundled dependencies.

## Source Tarballs

The RPM build requires these source tarballs:

| Source | File | Description |
| ------ | ---- | ----------- |
| Source0 | `theia-ide-{version}.tar.gz` | Main source from GitHub |
| Source1 | `theia-ide-plugins-{version}.tar.xz` | VSIX extensions |
| Source2 | `theia-ide-deps-{version}.tar.xz` | Vendored node dependencies and Electron binaries |
| Source3 | `theia-ide-deps-{version}.json` | Generated sources metadata (for reference) |
| Patch0 | `electron-builder.patch` | Patch for electron-builder configuration |

### Generating Source Tarballs

Use the `vendor-theia-ide-deps.py` script to generate all required tarballs. The script:

- Clones the main Theia IDE repository with submodules → `theia-ide-{version}.tar.gz`
- Downloads all VSIX plugins from upstream → `theia-ide-plugins-{version}.tar.xz`
- Uses flatpak-node-generator to analyze `yarn.lock`
- Downloads all npm packages and Electron binaries → `theia-ide-deps-{version}.tar.xz`
- Creates a JSON metadata file for reference → `theia-ide-deps-{version}.json`

**Note on flatpak-node-generator:** The script automatically installs `flatpak-node-generator` from a fork that includes a fix for aarch64 ripgrep binary downloads. The upstream flatpak-builder-tools incorrectly generated sources for the `-gnu` variant, but the `@vscode/ripgrep` package expects `aarch64-unknown-linux-musl`. This fork includes the fix from [upstream PR #495](https://github.com/flatpak/flatpak-builder-tools/pull/495). Once the PR is merged, the script can be updated to use the official upstream repository.

By default, all sources (main, plugins, and dependencies) are generated. If no version is specified, it uses the version from the local package.json.

The script will automatically update the version variables in the spec file:

- `Version:` - Local package.json version or specified version
- `%global theia_version` - Extracted from @theia/* packages in package.json
- `%global electron_version` - Extracted from applications/electron/package.json

To disable automatic spec file updates, use the `--no-update-spec` flag.

### Script Options

```bash
./vendor-theia-ide-deps.py [options] [version]

Options:
  -v, --version VER      Specify version (default: local package.json)
  -o, --output DIR       Output directory (default: current directory)
  --github-latest        Fetch latest version from GitHub instead of using local
  --skip-main-source     Skip main source tarball generation
  --skip-plugins         Skip plugins tarball generation
  --skip-deps            Skip dependency tarball generation
  --only-main-source     Only download main source tarball
  --only-plugins         Only generate plugins tarball
  --only-deps            Only generate deps tarball
  --no-update-spec       Do not update spec file variables
  --copr                 COPR mode: output to $COPR_RESULTDIR and copy spec/patches
```

**Note:** The script always downloads dependencies for **all supported architectures** (x86_64 and aarch64) to create a universal dependency tarball. This ensures the same tarball can be used for building on any supported architecture.

By default, the script uses the version from your local package.json, making it easy to work with local development. Use `--github-latest` to fetch the latest tag from GitHub instead.

**Examples:**

```bash
# Generate all sources using local package.json version (default)
./vendor-theia-ide-deps.py

# Generate all sources for latest GitHub tag
./vendor-theia-ide-deps.py --github-latest

# Generate all sources for specific version
./vendor-theia-ide-deps.py 1.67.100

# Output to a specific directory
./vendor-theia-ide-deps.py -o ./dist 1.67.100

# Only download main source tarball
./vendor-theia-ide-deps.py --only-main-source 1.67.100

# Only generate plugins tarball
./vendor-theia-ide-deps.py --only-plugins 1.67.100

# Only generate deps tarball
./vendor-theia-ide-deps.py --only-deps 1.67.100

# Generate plugins and deps, skip main source (using default local version)
./vendor-theia-ide-deps.py --skip-main-source
```

**Requirements:**

- `python3`, `pipx`, `git`, `curl`
- `flatpak-node-generator` (auto-installed via `pipx` if not present)

## Local Building

### Quick Start

```bash
# 1. Generate all source tarballs (main, plugins, and deps)
./vendor-theia-ide-deps.py 1.67.100

# 2. Build SRPM
rpmbuild -bs theia-ide.spec \
    --define "_sourcedir $(pwd)" \
    --define "_srcrpmdir $(pwd)"

# 3. Build RPM with mock
mock -r fedora-rawhide-x86_64 theia-ide-*.src.rpm --resultdir .
```

### Testing Changes

When making changes to the package:

1. Regenerate source tarballs if dependencies changed:

   ```bash
   ./vendor-theia-ide-deps.py 1.67.100
   ```

2. Test build locally with mock:

   ```bash
   rpmbuild -bs theia-ide.spec --define "_sourcedir $(pwd)" --define "_srcrpmdir $(pwd)"
   mock -r fedora-rawhide-x86_64 theia-ide-*.src.rpm --resultdir .
   ```

3. Install and test the built RPM:

   ```bash
   sudo dnf install ./theia-ide-*.x86_64.rpm
   theia-ide
   ```

## COPR Builds

[Fedora COPR](https://copr.fedorainfracloud.org/) is a build service for creating RPM packages.

### Custom Source Method

COPR's custom source method runs a script to generate sources before the build.

**Setup:**

1. **Create a new COPR project** on [Fedora COPR](https://copr.fedorainfracloud.org/)

2. **Go to Packages → Add Package**

3. **Select "Custom" as the source type**

4. **Configure the custom source:**

   - **Script**:

      ```sh
      #! /bin/sh -x
      git clone -b rpm --single-branch https://github.com/LorbusChris/theia-blueprint theia-ide
      cd theia-ide/rpm
      ./vendor-theia-ide-deps.py --copr
      ```

   - **Build dependencies**: `curl python3 pipx yarnpkg nodejs git`

   - **Result directory**: `rpm`

5. **Build settings:**
   - **Chroots**: Select target distributions (e.g., `fedora-rawhide-x86_64`)

**How it works:**

When COPR runs the build:

1. Runs the custom script in a mock chroot
2. The script clones theia-ide from GitHub with submodules → `theia-ide-{version}.tar.gz`
3. Downloads all VSIX plugins → `theia-ide-plugins-{version}.tar.xz`
4. Generates dependency sources with flatpak-node-generator → `theia-ide-deps-{version}.tar.xz`
5. Copies all sources, patches, and spec file to `/workdir/rpm` (COPR's result directory)
6. COPR runs `rpmbuild` with the generated sources

### SCM Method (Use externally hosted sources)

If externally hosted generated sources are available (e.g., on GitHub Releases), the SCM Method can be used on COPR. This method could also be used for (official Fedora) Koji builds.

**Setup:**

1. **Generate sources locally:**

   ```bash
   ./vendor-theia-ide-deps.py
   ```

2. **Upload tarballs** to a hosting service (GitHub Releases, etc.)

3. **Update spec file** with URLs:

   ```spec
   Source0: https://github.com/eclipse-theia/theia-ide/archive/v%{version}/%{name}-%{version}.tar.gz
   Source1: https://your-host.com/%{name}-plugins-%{version}.tar.xz
   Source2: https://your-host.com/%{name}-deps-%{version}.tar.xz
   ```

4. **Create COPR package** using "SCM" source type pointing to your git repository

## License Considerations

Theia IDE includes components under multiple licenses:

- **MIT** (main Theia framework)
- **EPL-2.0** (Eclipse components)
- **Various licenses** in bundled dependencies

The spec file declares `License: MIT AND EPL-2.0` for the main components. Bundled Node.js modules have their own licenses documented in their respective package.json files.
