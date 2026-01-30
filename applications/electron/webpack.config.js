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
                const isProduction = compiler.options.mode === 'production';

                // Production (minified): t.rgPath=i.join(__dirname,"./native/rg"+("win32"===process.platform?".exe":""))
                // Development: exports.rgPath = path.join(__dirname, `./native/rg${process.platform === 'win32' ? '.exe' : ''}`);
                const pattern = isProduction
                    ? /(\w+)\.rgPath\s*=\s*(\w+)\.join\(\s*__dirname\s*,\s*["']\.\/native\/rg["']\s*\+\s*\(["']win32["']\s*===\s*process\.platform\s*\?\s*["']\.exe["']\s*:\s*["']["']\s*\)\s*\)/g
                    : /(\w+)\.rgPath\s*=\s*(\w+)\.join\(\s*__dirname\s*,\s*`\.\/native\/rg\$\{process\.platform\s*===\s*['"]win32['"]\s*\?\s*['"]\.exe['"]\s*:\s*['"]['"]}\s*`\s*\)/g;

                let patched = false;
                const newContent = content.replace(pattern, (match, exportsVar, pathVar) => {
                    patched = true;
                    return `(()=>{const p=${pathVar}.join(__dirname,"./native/rg"+("win32"===process.platform?".exe":""));return ${exportsVar}.rgPath=p.includes(".asar"+${pathVar}.sep)?p.replace(".asar"+${pathVar}.sep,".asar.unpacked"+${pathVar}.sep):p})()`;
                });

                if (patched) {
                    fs.writeFileSync(mainJsPath, newContent);
                    console.log('Patched main.js ripgrep path for asar compatibility');
                } else {
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