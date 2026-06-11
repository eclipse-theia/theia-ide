const fs = require('fs');

/**
 * Checks whether any of the given flags is present in process.argv,
 * stopping at the `--` separator (everything after `--` is treated as data).
 * @param flags - The flags to look for (e.g. ['--version', '-v'])
 * @returns true if any of the flags is present before a `--` separator
 */
function hasFlag(flags) {
    for (let i = 1; i < process.argv.length; i++) {
        const arg = process.argv[i];
        if (arg === '--') {
            return false;
        }
        if (flags.includes(arg)) {
            return true;
        }
    }
    return false;
}

/**
 * Handles --version/-v and --help early, before loading the full electron stack,
 * and exits the process if either flag is present.
 *
 * The upstream ElectronMainApplication uses yargs without setting .version()
 * and with .help(false), so these flags don't work in bundled/AppImage contexts.
 *
 * @param packageJsonPath - Path to the application's package.json
 */
function handleVersionAndHelp(packageJsonPath) {
    if (hasFlag(['--version', '-v'])) {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        console.log(packageJson.version);
        process.exit(0);
    }
    if (hasFlag(['--help'])) {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        console.log(`${packageJson.productName} ${packageJson.version}

Usage: ${packageJson.productName} [options] [file-or-folder]

Options:
  -v, --version                       Print version
  --help                              Print usage

  --electronUserData <dir>            Set the Electron user data directory
                                      (default: platform user-data dir, e.g.
                                      ~/.config/${packageJson.productName} on Linux)
  --no-cluster                        Run backend in the same process

  --log-level <level>                 Set log level: info, debug, warn, error,
                                      trace, fatal (default: info)
  --log-config <path>                 Path to a JSON log configuration file
                                      (mutually exclusive with --log-level)
  --log-file <path>                   Path to the log file`);
        process.exit(0);
    }
}

module.exports = {
    hasFlag,
    handleVersionAndHelp,
};
