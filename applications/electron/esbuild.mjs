/**
 * This file can be edited to adjust the ESBuild build process.
 * To reset, delete this file and rerun theia build again.
 */
import { browserOptions, watch } from './gen-esbuild.browser.mjs';
import { nodeOptions } from './gen-esbuild.node.mjs';
import { electronOptions } from './gen-esbuild.electron.mjs';
import esbuild from 'esbuild';

/**
 * Plugin to patch ripgrep path for asar compatibility.
 * When packaged with asar, __dirname resolves inside app.asar but native binaries
 * are extracted to app.asar.unpacked via electron-builder's asarUnpack config.
 * The upstream esbuild native plugin doesn't handle this, so we override its
 * ripgrep replacement with one that includes asar path rewriting.
 */
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

// Add asar ripgrep plugin before the native dependencies plugin so it takes precedence
nodeOptions.plugins.unshift(asarRipgrepPlugin);

const browserContext = await esbuild.context(browserOptions);
const nodeContext = await esbuild.context(nodeOptions);
const electronContext = await esbuild.context(electronOptions);

if (watch) {
    await Promise.all([
        browserContext.watch(),
        nodeContext.watch(),
        electronContext.watch(),
    ]);
} else {
    try {
        await browserContext.rebuild();
        await browserContext.dispose();
        await nodeContext.rebuild();
        await nodeContext.dispose();
        await electronContext.rebuild();
        await electronContext.dispose();
    } catch {
        process.exit(1);
    }
}
