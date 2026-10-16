const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');

const script = fs.readFileSync(path.resolve(__dirname, '../../../scripts/build-with-local-theia.js'), 'utf8');

function fixture() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'local-theia-'));
    const ide = path.join(root, 'theia-ide');
    const theia = path.join(root, 'theia');
    const writePackage = (dir, pkg) => {
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify(pkg));
    };
    writePackage(ide, { dependencies: { '@theia/plugin-ext': '1.0.0' } });
    writePackage(path.join(theia, 'packages/plugin-ext'), {
        name: '@theia/plugin-ext', dependencies: { '@theia/telemetry': '1.0.0', '@theia/missing': '1.0.0' }
    });
    writePackage(path.join(theia, 'packages/telemetry'), {
        name: '@theia/telemetry', dependencies: { '@theia/plugin-ext': '1.0.0' },
        optionalDependencies: { '@theia/optional': '1.0.0' }, peerDependencies: { '@theia/peer': '1.0.0' },
        devDependencies: { '@theia/unused': '1.0.0' }
    });
    for (const name of ['optional', 'peer', 'unused']) {
        writePackage(path.join(theia, 'dev-packages', name), { name: `@theia/${name}` });
    }
    const installed = name => path.join(ide, 'node_modules/@theia', name);
    writePackage(installed('telemetry'), { name: '@theia/telemetry' });
    writePackage(installed('missing'), { name: '@theia/missing' });
    const logs = [];
    const run = async (args, execute = () => { }) => {
        await vm.runInNewContext(script, {
            __dirname: path.join(ide, 'scripts'),
            require: name => name === 'child_process' ? { execSync: execute } : require(name),
            process: { argv: ['node', 'build-with-local-theia.js', ...args], env: process.env, exit: code => assert.fail(`Exit ${code}`) },
            console: { log: (...values) => logs.push(values.join(' ')), error: (...values) => logs.push(values.join(' ')) }
        });
    };
    const cleanup = () => fs.rmSync(root, { recursive: true, force: true });
    return { ide, theia, installed, run, logs, cleanup };
}

const linkOnly = ['--skip-theia-build', '--skip-ide-build'];

describe('Local Theia build', function () {
    let f;

    beforeEach(function () {
        f = fixture();
    });

    afterEach(function () {
        f.cleanup();
    });

    it('links transitive packages, including optional/peer deps and dev-packages, once despite cycles', async function () {
        await f.run(linkOnly);
        for (const [name, group] of [['plugin-ext', 'packages'], ['telemetry', 'packages'], ['optional', 'dev-packages'], ['peer', 'dev-packages']]) {
            assert.equal(fs.realpathSync(f.installed(name)), fs.realpathSync(path.join(f.theia, group, name)));
            assert.equal(f.logs.filter(line => line.startsWith(`Linked @theia/${name} ->`)).length, 1);
        }
        assert.equal(fs.existsSync(f.installed('unused')), false);
        assert.equal(fs.lstatSync(f.installed('missing')).isSymbolicLink(), false);
        assert.ok(f.logs.some(line => line.includes('  - @theia/missing')));
    });

    it('dry-run leaves installed copies untouched', async function () {
        await f.run([...linkOnly, '--dry-run']);
        assert.equal(fs.lstatSync(f.installed('telemetry')).isSymbolicLink(), false);
        assert.ok(f.logs.some(line => line.includes('Would link @theia/telemetry ->')));
    });

    it('repeated builds remove transitive and stale links before install and relink before bundling', async function () {
        await f.run(linkOnly);
        fs.symlinkSync(path.join(f.theia, 'dev-packages/unused'), f.installed('stale'), 'junction');
        const commands = [];
        await f.run(['--skip-theia-build', '--skip-plugins'], cmd => {
            commands.push(cmd);
            if (cmd === 'yarn') {
                for (const name of ['plugin-ext', 'telemetry', 'optional', 'peer', 'stale']) {
                    assert.equal(fs.existsSync(f.installed(name)), false, `${name} must be removed before install`);
                }
                const pkg = JSON.parse(fs.readFileSync(path.join(f.ide, 'package.json'), 'utf8'));
                assert.equal(pkg.resolutions['@theia/telemetry'], `file:${path.join(f.theia, 'packages/telemetry')}`);
                assert.equal(pkg.resolutions['@theia/unused'], undefined);
                fs.mkdirSync(f.installed('telemetry'));
            } else if (cmd.startsWith('yarn build:')) {
                assert.equal(fs.realpathSync(f.installed('telemetry')), fs.realpathSync(path.join(f.theia, 'packages/telemetry')));
            }
        });
        assert.deepEqual(commands, ['yarn', 'yarn build:extensions', 'yarn build:applications:next:dev']);
        assert.equal(JSON.parse(fs.readFileSync(path.join(f.ide, 'package.json'), 'utf8')).resolutions, undefined);
    });

    it('unlink removes transitive and stale links without removing targets or installed directories', async function () {
        await f.run(linkOnly);
        fs.symlinkSync(path.join(f.theia, 'dev-packages/unused'), f.installed('stale'), 'junction');
        await f.run(['--unlink'], cmd => assert.equal(cmd, 'yarn --force'));
        for (const name of ['plugin-ext', 'telemetry', 'optional', 'peer', 'stale']) {
            assert.equal(fs.existsSync(f.installed(name)), false);
        }
        assert.equal(fs.existsSync(path.join(f.theia, 'packages/telemetry/package.json')), true);
        assert.equal(fs.existsSync(path.join(f.installed('missing'), 'package.json')), true);
    });
});
