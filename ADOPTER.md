# Adopter Guide

This repository serves as a template for building desktop products on the [Eclipse Theia platform](https://theia-ide.org). This guide documents packaging considerations when building your own Theia based applications.

## Electron Packaging and Asar

Electron applications may use [asar archives](https://github.com/electron/asar) to package application source files into a single read only archive. This improves startup performance and avoids path length issues on Windows.

In this repository, asar packaging is enabled via `asar: true` in `applications/electron/electron-builder.yml`. When the application is packaged with `electron-builder`, the contents of the app directory are bundled into an `app.asar` file inside the packaged application's `resources/` folder.

Code that uses `__dirname` to access files, or executes scripts from the filesystem, will fail because asar archives are not real directories. At runtime, `__dirname` resolves to a path inside `app.asar`, but Node's `fs` module and the OS cannot access files inside the archive as regular filesystem entries.

Two categories of files are typically affected:

1. **Native binaries**, `.node` files or prebuilt binaries
2. **Scripts and resources** that must be accessible on the real filesystem

### Mitigation Strategies

#### 1. asarUnpack (electron-builder.yml)

Files matching `asarUnpack` glob patterns are automatically extracted alongside the asar archive during packaging. At runtime, these files live under `app.asar.unpacked/` instead of `app.asar/`.

For example:

```yaml
asarUnpack:
  - "**/lib/backend/native/**"
  - "**/lib/backend/shell-integrations/**"
  - "**/lib/build/Release/**"
  - "**/lib/prebuilds/**"
```

`asarUnpack` only extracts the files to the real filesystem. Code that resolves paths using `__dirname` will still get a path containing `app.asar`, so it must also handle the `.asar.unpacked` path segment for the files to be found.

#### 2. patch-package

When upstream code in `node_modules` needs modification, for example to adjust paths, [patch-package](https://github.com/ds300/patch-package) can apply source level patches after `yarn install`.

* Patches live in the `patches` directory at the repository root
* Patches are applied automatically via the `postinstall` script in `package.json`

#### 3. Bundler Post Processing

Another option is to adjust the bundled code in the bundler.

As an example, the `asarRipgrepPlugin` in `applications/electron/esbuild.mjs` overrides the upstream esbuild native plugin's ripgrep replacement to rewrite ripgrep's path resolution from `.asar` to `.asar.unpacked` at bundle time:

```js
const asarRipgrepPlugin = {
    name: 'asar-ripgrep',
    setup(build) {
        build.onLoad({ filter: /@vscode[/\\]ripgrep[/\\]lib[/\\]index\.js$/ }, async () => ({
            contents: `
                const path = require("path");
                let rgPath = path.join(__dirname, \`./native/rg\${process.platform === "win32" ? ".exe" : ""}\`);
                if (rgPath.includes(".asar" + path.sep)) {
                    rgPath = rgPath.replace(".asar" + path.sep, ".asar.unpacked" + path.sep);
                }
                export { rgPath };
            `,
            loader: 'js'
        }));
    }
};
```
