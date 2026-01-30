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

                // Find the ripgrep module pattern: t.rgPath=i.join(__dirname,"./native/rg"...)
                // The variable name (i) varies, so we capture it
                const pattern = /t\.rgPath=(\w+)\.join\(__dirname,"\.\/native\/rg"\+\("win32"===process\.platform\?"\.exe":""\)\)/g;

                const newContent = content.replace(pattern, (match, varName) => {
                    // Replace with code that handles asar paths
                    return `(()=>{const p=${varName}.join(__dirname,"./native/rg"+("win32"===process.platform?".exe":""));return t.rgPath=p.includes(".asar"+${varName}.sep)?p.replace(".asar"+${varName}.sep,".asar.unpacked"+${varName}.sep):p})()`;
                });

                if (newContent !== content) {
                    fs.writeFileSync(mainJsPath, newContent);
                    console.log('Patched main.js ripgrep path for asar compatibility');
                } else {
                    console.warn('Warning: Could not find ripgrep pattern to patch in main.js');
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