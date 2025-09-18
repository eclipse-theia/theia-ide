/**
 * This file can be edited to customize webpack configuration.
 * To reset delete this file and rerun theia build again.
 */
// @ts-check
const configs = require('./gen-webpack.config.js');
const nodeConfig = require('./gen-webpack.node.config.js');
const TerserPlugin = require('terser-webpack-plugin');

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

    // Enable maximum verbosity for webpack build output
    config.stats = { preset: 'verbose', logging: 'verbose' };
    config.infrastructureLogging = Object.assign({}, config.infrastructureLogging, {
        level: 'verbose',
        debug: true
    });
}

// Ensure node (main process) config is also verbose
nodeConfig.config.stats = { preset: 'verbose', logging: 'verbose' };
nodeConfig.config.infrastructureLogging = Object.assign({}, nodeConfig.config.infrastructureLogging || {}, {
    level: 'verbose',
    debug: true
});

module.exports = [
    ...configs,
    nodeConfig.config
];
