# Theia IDE Images

This directory provides an extensible base image for creating language-specific Theia IDE variants. The architecture enables efficient multi-variant deployments by building Theia once and extending it with specific tooling. All images in this folder target the **web (browser) distribution** of Theia; Electron-specific code is stripped during the build.

## Architecture Overview

The image structure uses a two-stage pattern optimized for creating multiple language-specific IDE variants:

### Stage 1: Base IDE Image (`base-ide/`)
The **base-ide** multi-stage build (install → build → runtime) produces the reusable foundation layer that downstream images consume. It:
- Installs build prerequisites and caches workspace dependencies for faster rebuilds
- Compiles the browser-only Theia application from source and downloads core plugins (Git, Markdown, JSON, etc.)
- Removes Electron launchers and packaging code along with other development artefacts
- Emits a slim runtime layer based on `node:20-bullseye-slim`, ready to be copied into language-specific images

### Stage 2: Language-Specific Images
Language-specific images extend the base by copying the built Theia application and adding tooling:
- Copy the complete Theia application from the `base-ide` runtime layer
- Install language compilers, runtimes, and tools (e.g., Java JDK, Python, gcc)
- Add language-specific VS Code extensions
- Configure the environment for the target language

Only the `base-ide` image is published to the GitHub Container Registry at `ghcr.io/eclipse-theia/theia-ide/base-ide`. The language folders in this directory demonstrate how to extend the base image for browser deployments and are not published artefacts.

## Example Images

This repository includes example implementations demonstrating the extension pattern:

| Language   | Image Directory | Demonstrates |
|------------|-----------------|--------------|
| Java 17    | `java-17/`      | JDK installation, Maven, Java language server |
| JavaScript | `javascript/`   | Node.js runtime, npm, TypeScript support |
| C          | `c/`            | GCC toolchain, C/C++ extensions |

These examples serve as templates for creating additional language-specific variants of the web-based Theia IDE.

## Benefits of This Architecture

- **Efficiency**: Base image built once, language variants build on top
- **Consistency**: All variants share the same Theia core and version
- **Maintainability**: Theia updates only require chaning the base image
- **Extensibility**: Community can create custom variants

## Creating Custom Language-Specific Images

To create your own language-specific IDE image, follow this pattern:

### 1. Create a Dockerfile

```dockerfile
ARG BASE_IMAGE=ghcr.io/eclipse-theia/theia-ide/base-ide:latest

# Copy the prebuilt browser application and configuration
FROM ${BASE_IMAGE} AS base-ide

# Start from a minimal Node.js image for your runtime tools
FROM node:20-bullseye-slim

# Create theia user
RUN adduser --system --group theia && \
    mkdir -p /home/project && \
    chown -R theia:theia /home/project

# Install your language tools (example: Python)
RUN apt-get update && apt-get install -y \
    python3 python3-pip \
    git bash libsecret-1-0 && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# Copy the built Theia application
WORKDIR /home/theia
COPY --from=base-ide --chown=theia:theia /home/theia /home/theia

# Configure environment
ENV SHELL=/bin/bash \
    THEIA_DEFAULT_PLUGINS=local-dir:/home/theia/plugins \
    USE_LOCAL_GIT=true

USER theia
WORKDIR /home/theia/applications/browser
EXPOSE 3000
ENTRYPOINT ["node", "lib/backend/main.js"]
CMD ["/home/project", "--hostname=0.0.0.0"]
```

### 2. Customize Plugins and Configuration

To add language-specific plugins or override Theia configuration, use a **patch-based approach** that merges your changes with the root `package.json`. This ensures you automatically inherit updates to the base configuration while only specifying your customizations.

#### Creating a Package Patch File

1. Create a directory structure matching your target (e.g., `my-python-ide/`)
2. Add a `package.json.patch` file containing **only the fields you want to modify or add**. Typically, you'll only need to specify language-specific plugins and exclusions:

```json
{
  "theiaPlugins": {
    "ms-python.python": "https://open-vsx.org/api/ms-python/python/2023.20.0/file/ms-python.python-2023.20.0.vsix"
  },
  "theiaPluginsExcludeIds": [
    "vscode.java",
    "vscode.ruby",
    "vscode.go"
  ]
}
```

Note: You don't need to patch `scripts`, `devDependencies`, or other fields that work fine from the root `package.json`—only specify what needs to change for your language variant.

#### Merging with jq in Your Dockerfile

Use `jq` to merge the root `package.json` with your patch file:

```dockerfile
# Install jq for JSON merging
RUN apt-get update && apt-get install -y --no-install-recommends jq && rm -rf /var/lib/apt/lists/*

# Copy base and patch files
COPY package.json ./package.json.base
COPY my-python-ide/package.json.patch ./package.json.patch

# Merge the base package.json with your patch using jq
RUN jq -s '.[0] + .[1]' package.json.base package.json.patch > package.json
```

The `jq -s '.[0] + .[1]'` command performs a merge where:
- `.[0]` is the root `package.json`
- `.[1]` is your patch file
- Fields in the patch override those in the base
- Arrays in the patch replace (not append to) arrays in the base

#### Benefits of the Patch Approach

- **Version independence**: No need to update version numbers across multiple files
- **Automatic updates**: Changes to the root `package.json` (dependencies, scripts, etc.) automatically propagate
- **Minimal maintenance**: Only update patches when plugins or exclusions change
- **Clear intent**: Patches clearly show what differs from the base configuration

See the existing image directories (`base-ide/`, `java-17/`, `c/`, `javascript/`) for complete examples of this pattern in practice.

## Choosing Plugins

Plugins extend the base IDE with language-specific features like syntax highlighting, linting, and code completion.

### Finding Plugins

Browse available VS Code extensions at [Open VSX Registry](https://open-vsx.org/). 

### Configuring VS Code Built-in Extensions

The base-ide includes a curated set of VS Code built-in extensions from Theia's [builtin-extension-pack](https://open-vsx.org/extension/eclipse-theia/builtin-extension-pack).

To exclude unnecessary built-ins (reducing image size), add their IDs to `theiaPluginsExcludeIds` in your `package.json`:

```json
{
  "theiaPluginsExcludeIds": [
    "vscode.php",
    "vscode.ruby",
    "vscode.java"
  ]
}
```

See `images/base-ide/package.json` for the default exclusion list.

## Building and Testing Images Locally

### Using the Published Base Image

Language-specific Dockerfiles default to `BASE_IMAGE=ghcr.io/eclipse-theia/theia-ide/base-ide:latest`, so in the common case you only need to build the variant:

```bash
docker build -t theia-ide-java -f images/java-17/Dockerfile .
```

The command automatically copies the prebuilt browser bundle from the published base image and then installs the Java tooling.

### Building the Base Image Yourself (Optional)

If you need to test base changes locally, rebuild the base image first:

```bash
docker build \
  -t theia-ide-base:latest \
  -f images/base-ide/Dockerfile \
  .
```

After this build finishes, point the language images at your local tag:

```bash
docker build \
  -t theia-ide-java \
  -f images/java-17/Dockerfile \
  --build-arg BASE_IMAGE=theia-ide-base:latest \
  .
```

### Run and Test

Start the container on port 3000:

```bash
docker run --rm --name theia -p 3000:3000 theia-ide-java
```

Open your browser to `http://localhost:3000` to access the IDE.

### Mounting a Workspace

To work with local files, mount a directory as the workspace:

```bash
docker run --rm -p 3000:3000 \
  -v "$(pwd)/my-project:/home/project:cached" \
  theia-ide-java
```
