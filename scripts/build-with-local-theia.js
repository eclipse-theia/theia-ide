#!/usr/bin/env node

/**
 * Script to build Theia IDE with a local Theia framework development version.
 *
 * This allows testing Theia IDE changes against local Theia framework modifications
 * without publishing to npm first. It expects a locally cloned version of the
 * Theia repository (https://github.com/eclipse-theia/theia) that will be linked
 * into the Theia IDE build.
 *
 * Usage:
 *   node scripts/build-with-local-theia.js [options]
 *
 * Options:
 *   --theia-path <path>   Path to local Theia repository [default: ../theia]
 *   --skip-theia-build    Skip building Theia packages (use if already built) [default: false]
 *   --skip-ide-build      Skip building Theia IDE (use for linking only) [default: false]
 *   --skip-plugins        Skip downloading plugins [default: false]
 *   --package             Package the electron-next application after building [default: false]
 *   --unlink              Remove links and restore npm dependencies [default: false]
 *   --dry-run             Print commands without executing them [default: false]
 *   --help                Show this help message
 *
 * See docs/developing-with-local-theia.md for detailed documentation.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const DEFAULT_THEIA_PATH = path.resolve(ROOT_DIR, '..', 'theia');

// Parse command line arguments
const args = process.argv.slice(2);

function getArgValue(flag, defaultValue) {
    const index = args.indexOf(flag);
    if (index !== -1 && args[index + 1]) {
        return args[index + 1];
    }
    return defaultValue;
}

const options = {
    theiaPath: path.resolve(getArgValue('--theia-path', DEFAULT_THEIA_PATH)),
    skipTheiaBuild: args.includes('--skip-theia-build'),
    skipIdeBuild: args.includes('--skip-ide-build'),
    skipPlugins: args.includes('--skip-plugins'),
    package: args.includes('--package'),
    unlink: args.includes('--unlink'),
    dryRun: args.includes('--dry-run'),
    help: args.includes('--help')
};

if (options.help) {
    console.log(`
Usage: node scripts/build-with-local-theia.js [options]

This script builds the Theia IDE against a local Theia framework checkout,
allowing you to test framework changes without publishing to npm first.

The script uses yarn link to connect the local Theia packages to the IDE build.

Note: This script does not update the IDE version or Theia package versions.
It uses the current state of both repositories. If needed, you can run
versioning commands (e.g., yarn update:theia) separately before building.

Prerequisites:
  A local clone of the Theia repository (https://github.com/eclipse-theia/theia).
  By default, the script expects it at ../theia (next to the theia-ide directory).

Options:
  --theia-path <path>   Path to local Theia repository [default: ../theia]
  --skip-theia-build    Skip building Theia packages (use if already built) [default: false]
  --skip-ide-build      Skip building Theia IDE (use for linking only) [default: false]
  --skip-plugins        Skip downloading plugins [default: false]
  --package             Package the electron-next application after building [default: false]
  --unlink              Remove links and restore npm dependencies [default: false]
  --dry-run             Print commands without executing them [default: false]
  --help                Show this help message

See docs/developing-with-local-theia.md for detailed documentation and examples.
`);
    process.exit(0);
}

/**
 * Execute a shell command
 */
function run(cmd, cwd = ROOT_DIR, description = '') {
    if (description) {
        console.log(`\n${'='.repeat(60)}`);
        console.log(`> ${description}`);
        console.log(`${'='.repeat(60)}`);
    }
    console.log(`$ ${cmd}`);
    console.log(`  (in ${cwd})\n`);

    if (options.dryRun) {
        console.log('[DRY RUN] Command not executed');
        return '';
    }

    try {
        execSync(cmd, {
            cwd,
            stdio: 'inherit',
            env: {
                ...process.env,
                NODE_OPTIONS: '--max_old_space_size=4096'
            }
        });
    } catch (error) {
        console.error(`\nCommand failed: ${cmd}`);
        throw error;
    }
}

/**
 * Read JSON file
 */
function readJson(filePath) {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

/**
 * Get all @theia/* packages from a package.json
 */
function getTheiaDependencies(packageJsonPath) {
    const pkg = readJson(packageJsonPath);
    const theiaDeps = new Set();

    for (const deps of [pkg.dependencies, pkg.devDependencies]) {
        if (deps) {
            for (const dep of Object.keys(deps)) {
                if (dep.startsWith('@theia/')) {
                    theiaDeps.add(dep);
                }
            }
        }
    }

    return theiaDeps;
}

/**
 * Find all Theia packages in the local Theia repository
 */
function findTheiaPackages(theiaPath) {
    const packagesDir = path.join(theiaPath, 'packages');
    const devPackagesDir = path.join(theiaPath, 'dev-packages');
    const packages = new Map();

    for (const dir of [packagesDir, devPackagesDir]) {
        if (!fs.existsSync(dir)) {
            continue;
        }

        for (const entry of fs.readdirSync(dir)) {
            const pkgJsonPath = path.join(dir, entry, 'package.json');
            if (fs.existsSync(pkgJsonPath)) {
                const pkg = readJson(pkgJsonPath);
                if (pkg.name && pkg.name.startsWith('@theia/')) {
                    packages.set(pkg.name, path.join(dir, entry));
                }
            }
        }
    }

    return packages;
}

/**
 * Collect all @theia/* dependencies from IDE packages
 */
function collectAllTheiaDependencies() {
    const allDeps = new Set();

    // Root package.json
    const rootDeps = getTheiaDependencies(path.join(ROOT_DIR, 'package.json'));
    rootDeps.forEach(d => allDeps.add(d));

    // Applications
    for (const app of ['electron', 'browser', 'electron-next']) {
        const appPkgPath = path.join(ROOT_DIR, 'applications', app, 'package.json');
        if (fs.existsSync(appPkgPath)) {
            getTheiaDependencies(appPkgPath).forEach(d => allDeps.add(d));
        }
    }

    // Extensions
    for (const ext of ['launcher', 'product', 'updater']) {
        const extPkgPath = path.join(ROOT_DIR, 'theia-extensions', ext, 'package.json');
        if (fs.existsSync(extPkgPath)) {
            getTheiaDependencies(extPkgPath).forEach(d => allDeps.add(d));
        }
    }

    return allDeps;
}

/**
 * Build Theia
 */
function buildTheia() {
    run('npm ci', options.theiaPath, 'Install Theia dependencies');
    // Compile all Theia packages, no need to build the applications in this case
    run('npm run compile', options.theiaPath, 'Compile Theia packages');
}

/**
 * Create yarn link for Theia packages
 */
function linkTheiaPackages() {
    console.log(`\n${'='.repeat(60)}`);
    console.log('> Creating yarn links for Theia packages');
    console.log(`${'='.repeat(60)}\n`);

    const theiaPackages = findTheiaPackages(options.theiaPath);
    const requiredDeps = collectAllTheiaDependencies();

    console.log(`Found ${theiaPackages.size} Theia packages`);
    console.log(`Theia IDE requires ${requiredDeps.size} @theia/* packages\n`);

    const linked = [];
    const missing = [];

    // Create links in Theia packages
    for (const dep of requiredDeps) {
        const pkgPath = theiaPackages.get(dep);
        if (pkgPath) {
            if (!options.dryRun) {
                console.log(`Linking ${dep}...`);
                try {
                    execSync('yarn link', { cwd: pkgPath, stdio: 'pipe' });
                } catch (e) {
                    // Link might already exist, that's fine
                }
            }
            linked.push(dep);
        } else {
            missing.push(dep);
        }
    }

    if (options.dryRun) {
        console.log(`Would create yarn links for ${linked.length} packages`);
    }

    if (missing.length > 0) {
        console.log('\nWarning: The following packages were not found in local Theia:');
        missing.forEach(m => console.log(`  - ${m}`));
    }

    // Link packages in IDE
    console.log(`\nLinking ${linked.length} packages in IDE...`);
    if (linked.length > 0) {
        const linkCmd = `yarn link ${linked.join(' ')}`;
        console.log(`$ ${linkCmd}`);
        if (!options.dryRun) {
            execSync(linkCmd, { cwd: ROOT_DIR, stdio: 'inherit' });
        } else {
            console.log('[DRY RUN] Command not executed');
        }
    }

    console.log(`\n${options.dryRun ? 'Would link' : 'Linked'} ${linked.length} packages`);
    return linked;
}

/**
 * Unlink Theia packages and restore npm dependencies
 */
function unlinkTheiaPackages() {
    console.log(`\n${'='.repeat(60)}`);
    console.log('> Removing yarn links and restoring npm dependencies');
    console.log(`${'='.repeat(60)}\n`);

    const requiredDeps = collectAllTheiaDependencies();

    // Unlink packages
    if (options.dryRun) {
        console.log(`Would unlink ${requiredDeps.size} packages`);
    } else {
        for (const dep of requiredDeps) {
            console.log(`Unlinking ${dep}...`);
            try {
                execSync(`yarn unlink ${dep}`, { cwd: ROOT_DIR, stdio: 'pipe' });
            } catch (e) {
                // Ignore errors if not linked
            }
        }
    }

    // Reinstall to restore npm versions
    run('yarn --force', ROOT_DIR, 'Reinstall npm dependencies');

    console.log('\nLinks removed and npm dependencies restored');
}

/**
 * Build IDE
 */
function buildIde() {
    run('yarn', ROOT_DIR, 'Install IDE dependencies');
    // sync must run after yarn install so missing transitives are present
    // in theia-ide/node_modules to copy from
    syncMissingFrameworkDeps();
    run('yarn build:extensions', ROOT_DIR, 'Build IDE extensions');
    run('yarn build:applications:next:dev', ROOT_DIR, 'Build electron-next application');
    if (!options.skipPlugins) {
        run('yarn download:plugins', ROOT_DIR, 'Download plugins');
    } else {
        console.log('\nSkipping plugin download (--skip-plugins)');
    }
}

/**
 * Check whether `depName` resolves by walking node_modules upwards from
 * `startDir`, the same way Node and esbuild do. Stops at the filesystem root.
 */
function isResolvableFrom(depName, startDir) {
    let dir = startDir;
    while (true) {
        if (fs.existsSync(path.join(dir, 'node_modules', depName, 'package.json'))) {
            return true;
        }
        const parent = path.dirname(dir);
        if (parent === dir) {
            return false;
        }
        dir = parent;
    }
}

/**
 * List the package directories inside a node_modules folder, expanding
 * @scope folders into their individual packages.
 */
function listPackageDirs(nodeModulesDir) {
    const result = [];
    if (!fs.existsSync(nodeModulesDir)) {
        return result;
    }
    for (const entry of fs.readdirSync(nodeModulesDir)) {
        if (entry === '.bin') {
            continue;
        }
        const entryPath = path.join(nodeModulesDir, entry);
        if (entry.startsWith('@')) {
            for (const sub of fs.readdirSync(entryPath)) {
                result.push(path.join(entryPath, sub));
            }
        } else {
            result.push(entryPath);
        }
    }
    return result;
}

/**
 * Detect transitive deps required by the linked Theia packages that cannot be
 * resolved from within the framework checkout. npm install in the framework
 * sometimes nests a dependency (e.g. tar-stream@3 in filesystem/node_modules)
 * whose own deps (e.g. b4a) are not hoisted anywhere reachable from there.
 * Scans the real package files rather than `npm list`, which does not descend
 * into yarn-linked packages.
 */
function detectMissingTransitives() {
    const theiaPackages = findTheiaPackages(options.theiaPath);
    const requiredDeps = collectAllTheiaDependencies();
    const missing = new Set();
    const visited = new Set();

    const scan = pkgDir => {
        if (visited.has(pkgDir)) {
            return;
        }
        visited.add(pkgDir);
        for (const dir of listPackageDirs(path.join(pkgDir, 'node_modules'))) {
            const pkgJsonPath = path.join(dir, 'package.json');
            if (!fs.existsSync(pkgJsonPath)) {
                continue;
            }
            let pkg;
            try {
                pkg = readJson(pkgJsonPath);
            } catch {
                continue;
            }
            const deps = { ...pkg.dependencies, ...pkg.optionalDependencies };
            for (const depName of Object.keys(deps)) {
                if (!isResolvableFrom(depName, dir)) {
                    missing.add(depName);
                }
            }
            scan(dir);
        }
    };

    for (const dep of requiredDeps) {
        const pkgPath = theiaPackages.get(dep);
        if (pkgPath) {
            scan(pkgPath);
        }
    }
    return missing;
}

/**
 * Both esbuild bundling and electron-builder's dep-tree validator walk the
 * node_modules tree starting from the linked framework checkout. Deps that
 * are hoisted only in theia-ide/node_modules are unreachable from there.
 * Copy any such missing transitives from theia-ide's node_modules into the
 * framework's root node_modules so both walks succeed.
 */
function syncMissingFrameworkDeps() {
    const missing = detectMissingTransitives();
    if (missing.size === 0) {
        return;
    }
    console.log(`\n${'='.repeat(60)}`);
    console.log('> Sync transitive deps into framework node_modules');
    console.log(`${'='.repeat(60)}`);
    console.log(`  Deps not reachable from linked Theia packages: ${[...missing].join(', ')}`);
    const targetDir = path.join(options.theiaPath, 'node_modules');
    if (!fs.existsSync(targetDir)) {
        if (options.dryRun) {
            console.log(`  [DRY RUN] Would create ${targetDir}`);
        } else {
            fs.mkdirSync(targetDir, { recursive: true });
        }
    }
    for (const dep of missing) {
        const src = path.join(ROOT_DIR, 'node_modules', dep);
        const dst = path.join(targetDir, dep);
        if (!fs.existsSync(src)) {
            console.log(`  Skipping ${dep}: not found in theia-ide/node_modules`);
            continue;
        }
        if (fs.existsSync(dst)) {
            continue;
        }
        if (options.dryRun) {
            console.log(`  [DRY RUN] Would copy ${dep} -> ${dst}`);
        } else {
            fs.cpSync(src, dst, { recursive: true });
            console.log(`  Copied ${dep}`);
        }
    }
}

/**
 * Package the electron-next application
 */
function packageApp() {
    // sync covers the --skip-ide-build --package path where buildIde did not run
    syncMissingFrameworkDeps();
    run('yarn package:applications:next', ROOT_DIR, 'Package electron-next application');
}

/**
 * Main function
 */
async function main() {
    console.log('\nBuild Theia IDE with local Theia framework\n');
    console.log(`Theia path: ${options.theiaPath}`);

    const startTime = Date.now();

    if (options.unlink) {
        unlinkTheiaPackages();
    } else {
        // Verify Theia exists
        if (!fs.existsSync(options.theiaPath)) {
            console.error(`\nError: Theia directory not found at ${options.theiaPath}`);
            console.error('\nPlease clone the Theia repository first:');
            console.error('  git clone https://github.com/eclipse-theia/theia.git ../theia');
            console.error('\nOr specify a different location with --theia-path');
            process.exit(1);
        }

        // Build Theia
        if (!options.skipTheiaBuild) {
            buildTheia();
        } else {
            console.log('\nSkipping Theia build (--skip-theia-build)');
        }

        // Link packages
        linkTheiaPackages();

        // Build IDE
        if (!options.skipIdeBuild) {
            buildIde();
        } else {
            console.log('\nSkipping IDE build (--skip-ide-build)');
        }

        // Package if requested
        if (options.package) {
            packageApp();
        }
    }

    const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(2);

    console.log(`\n${'='.repeat(60)}`);
    console.log('Done!');
    console.log(`${'='.repeat(60)}`);
    console.log(`Total time: ${elapsed} minutes`);

    if (!options.unlink && !options.package) {
        console.log(`
Next steps:
  - Run the IDE: yarn --cwd applications/electron-next start
  - Make changes in Theia, rebuild: (cd ${options.theiaPath} && npm run compile)
  - Rebuild IDE: yarn build:applications:next:dev
  - Package the app: node scripts/build-with-local-theia.js --skip-theia-build --skip-ide-build --package
  - When done, restore npm deps: node scripts/build-with-local-theia.js --unlink
`);
    }

    if (options.package) {
        console.log('\nPackaged application is in: applications/electron-next/dist/');
    }

    if (options.dryRun) {
        console.log('\nThis was a dry run. No commands were actually executed.');
    }
}

main().catch(error => {
    console.error('\nBuild failed:', error.message);
    process.exit(1);
});
