/**
 * This file can be edited to customize webpack configuration.
 * To reset delete this file and rerun theia build again.
 */
// @ts-check
const configs = require('./gen-webpack.config.js');
const nodeConfig = require('./gen-webpack.node.config.js');
const TerserPlugin = require('terser-webpack-plugin');
const fs = require('fs');
const path = require('path');

/**
 * Webpack plugin to patch the bundled ripgrep path for asar compatibility.
 * When packaged with asar, __dirname resolves inside app.asar but the native binaries
 * are extracted to app.asar.unpacked via asarUnpack.
 *
 * The native-webpack-plugin bundles ripgrep path resolution directly into main.js,
 * so we need to patch the bundle after emit to add asar path rewriting.
 */
class PatchRipgrepPlugin {
    apply(compiler) {
        compiler.hooks.afterEmit.tapAsync('PatchRipgrepPlugin', (compilation, callback) => {
            const mainJsPath = path.join(compiler.outputPath, 'main.js');
            if (fs.existsSync(mainJsPath)) {
                let content = fs.readFileSync(mainJsPath, 'utf8');

                // Match the ripgrep path.join(__dirname, ...) call regardless of how
                // the path module is referenced or how the result is exported.
                // Webpack output varies across modes:
                //   Production (minified):  i.join(__dirname,"./native/rg"+("win32"===...))
                //   Dev (harmony):          (__webpack_require__(/*! path */ "path").join)(__dirname, `./native/rg${...}`)
                //   Dev (CommonJS):         path.join(__dirname, `./native/rg${...}`)
                // The .join call may be direct (EXPR.join(...)) or parenthesized ((EXPR.join)(...)).
                // Both string concat (prod) and template literal (dev) arg forms are matched.
                const rgSuffix = `("win32"===process.platform?".exe":"")`;
                const prodArgs = /["']\.\/native\/rg["']\s*\+\s*\(["']win32["']\s*===\s*process\.platform\s*\?\s*["']\.exe["']\s*:\s*["']["']\s*\)/;
                const devArgs = /`\.\/native\/rg\$\{process\.platform\s*===\s*['"]win32['"]\s*\?\s*['"]\.exe['"]\s*:\s*['"]['"]}\s*`/;
                // Match both EXPR.join(__dirname, ARGS) and (EXPR.join)(__dirname, ARGS)
                // Use [^=,;\n] (not \s) to allow spaces in webpack comments like /*! path */
                const joinCall = (argsPattern) => new RegExp(`\\(?[^=,;\\n]+?\\.join\\)?\\(\\s*__dirname\\s*,\\s*${argsPattern.source}\\s*\\)`, 'g');
                const prodPattern = joinCall(prodArgs);
                const devPattern = joinCall(devArgs);

                let patched = false;
                const patchFn = (match) => {
                    patched = true;
                    return `(()=>{const _p=require("path"),_r=_p.join(__dirname,"./native/rg"+${rgSuffix});return _r.includes(".asar"+_p.sep)?_r.replace(".asar"+_p.sep,".asar.unpacked"+_p.sep):_r})()`;
                };

                let newContent = content.replace(prodPattern, patchFn);
                if (!patched) {
                    newContent = content.replace(devPattern, patchFn);
                }

                if (patched) {
                    fs.writeFileSync(mainJsPath, newContent);
                    console.log('Patched main.js ripgrep path for asar compatibility');
                } else {
                    const idx = content.indexOf('rgPath');
                    if (idx !== -1) {
                        console.error('Could not patch ripgrep path. Context around rgPath:');
                        console.error(content.substring(Math.max(0, idx - 200), idx + 300));
                    }
                    throw new Error('Could not find ripgrep pattern to patch in main.js. The pattern may have changed in @theia/native-webpack-plugin.');
                }
            }
            callback();
        });
    }
}

/**
 * Expose bundled modules on window.theia.moduleName namespace, e.g.
 * window['theia']['@theia/core/lib/common/uri'].
 * Such syntax can be used by external code, for instance, for testing.
configs[0].module.rules.push({
    test: /\.js$/,
    loader: require.resolve('@theia/application-manager/lib/expose-loader')
}); */

/**
 * Do no run TerserPlugin with parallel: true
 * Each spawned node may take the full memory configured via NODE_OPTIONS / --max_old_space_size
 * In total this may lead to OOM issues
 */
if (nodeConfig.config.optimization) {
    nodeConfig.config.optimization.minimizer = [
        new TerserPlugin({
            parallel: false,
            exclude: /^(lib|builtins)\//,
            terserOptions: {
                keep_classnames: /AbortSignal/
            }
        })
    ];
}
for (const config of configs) {
    config.optimization = {
        minimizer: [
            new TerserPlugin({
                parallel: false
            })
        ]
    };
}

// Add the ripgrep patch plugin to the node config
nodeConfig.config.plugins = nodeConfig.config.plugins || [];
nodeConfig.config.plugins.push(new PatchRipgrepPlugin());

module.exports = [
    ...configs,
    nodeConfig.config
];