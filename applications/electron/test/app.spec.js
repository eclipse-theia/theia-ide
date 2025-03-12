const os = require('os');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const { remote } = require('webdriverio');
const { expect } = require('chai');

const THEIA_LOAD_TIMEOUT = 15000; // 15 seconds

function isMacArm() {
    if (os.platform() !== 'darwin'){
      return false;
    }
    try {
        // Check the architecture using uname -m
        const arch = execSync('uname -m').toString().trim();
        return arch === 'arm64';
    } catch (error) {
        // Fall back to node's arch property if uname fails
        return os.arch() === 'arm64';
    }
}

function getElectronMainJS() {
    const distFolder = path.join(__dirname, '..', 'dist');
    switch (os.platform()) {
    case 'linux':
        return path.join(
        distFolder,
        'linux-unpacked',
        'resources',
        'app',
        'lib',
        'backend',
        'electron-main.js'
        );
    case 'win32':
        return path.join(
        distFolder,
        'win-unpacked',
        'resources',
        'app',
        'lib',
        'backend',
        'electron-main.js'
        );
    case 'darwin':
        const macFolder = isMacArm() ? 'mac-arm64' : 'mac';
        return path.join(
        distFolder,
        macFolder,
        'TheiaIDE.app',
        'Contents',
        'Resources',
        'app',
        'lib',
        'backend',
        'electron-main.js'
        );
    default:
        return undefined;
    }
}

function disableSplashScreen() {
    const filePath = getElectronMainJS();
    if (fs.existsSync(filePath)) {
        fs.readFile(filePath, 'utf8', (err, data) => {
            if (err) {
                console.error(err);
                return;
            }
            let regex = /,splashScreenOptions:\{[^}]*\}/;
            if (regex.test(data)) {
                const updatedData = data.replace(regex, '');
                fs.writeFile(filePath, updatedData, 'utf8', e => {
                    if (e) {
                        console.error(e);
                    }
                });
            } else {
                // check non minified as well
                regex = /,(\s+)"splashScreenOptions":\s*\{[^}]*\}/s;
                if (regex.test(data)) {
                    const updatedData = data.replace(regex, '');
                    fs.writeFile(filePath, updatedData, 'utf8', e => {
                        if (e) {
                            console.error(e);
                        }
                    });
                }
            }
        });
    }
}

function getBinaryPath() {
  const distFolder = path.join(__dirname, '..', 'dist');
  switch (os.platform()) {
    case 'linux':
      return path.join(
        distFolder,
        'linux-unpacked',
        'theia-ide-electron-app'
      );
    case 'win32':
      return path.join(
        distFolder,
        'win-unpacked',
        'TheiaIDE.exe'
      );
    case 'darwin':
      const macFolder = isMacArm() ? 'mac-arm64' : 'mac';
      const binaryPath = path.join(
        distFolder,
        macFolder,
        'TheiaIDE.app',
        'Contents',
        'MacOS',
        'TheiaIDE'
      );
      console.log(`Using binary path for Mac ${isMacArm() ? 'ARM64' : 'Intel'}: ${binaryPath}`);
      return binaryPath;
    default:
      return undefined;
  }
};

// Utility for keyboard shortcuts that execute commands where
// the key combination is the same on all platforms *except that*
// the Command key is used instead of Control on MacOS. Note that
// sometimes MacOS also uses Control. This is not handled, here
function macSafeKeyCombo(keys) {
  if (os.platform() === 'darwin' && keys.includes('Control')) {
    // Puppeteer calls the Command key "Meta"
    return keys.map(k => k === 'Control' ? 'Meta' : k);
  }
  return keys;
};

describe('Theia App', function () {
  // In mocha, 'this' is a common context between sibling beforeEach, afterEach, it, etc methods within the same describe.
  // Each describe has its own context.
  before(async function () {
    // XXX
    // our current webdriverio version does not seem to be able to handle the window switches
    // since we should probably switch to playwright tests, we disable the splashscreen for now in the AUT
    disableSplashScreen();
  });
  beforeEach(async function () {

    const binary = getBinaryPath();
    if (!binary) {
      throw new Error('Tests are not supported for this platform.');
    }

    // Start app and store connection in context (this)
    this.browser = await remote({
      // Change to info to get detailed events of webdriverio
      logLevel: 'info',
      capabilities: {
        browserName: 'chrome',
        'goog:chromeOptions': {
          // Path to built and packaged theia
          binary: binary,
          // Hand in workspace to load as runtime parameter
          args: [path.join(__dirname, 'workspace')],
        },
      },
    });

    const appShell = await this.browser.$('#theia-app-shell');

    // mocha waits for returned promise to resolve
    // Theia is loaded once the app shell is present
    return appShell.waitForExist({
      timeout: THEIA_LOAD_TIMEOUT,
      timeoutMsg: 'Theia took too long to load.',
    });
  });

  afterEach(async function () {
    try {
      await this.browser.closeWindow();
    } catch (err) {
      // Workaround: Puppeteer cannot properly connect to electron and throws an error.
      // However, the window is closed and that's all we want here.
      if (`${err}`.includes('Protocol error (Target.createTarget)')) {
        return;
      }
      // Rethrow for unexpected errors to fail test.
      throw err;
    }
  });

  it('Correct window title', async function () {
    // Wait a bit to make sure workspace is set and title got updated
    await new Promise(r => setTimeout(r, 2000));
    const windowTitle = await this.browser.getTitle();
    expect(windowTitle).to.include('workspace');
  });

  it('Builtin extensions', async function () {
    // Wait a bit to make sure key handlers are registered.
    await new Promise(r => setTimeout(r, 5000));

    // Open extensions view
    await this.browser.keys(macSafeKeyCombo(['Control', 'Shift', 'x']));
    const builtinContainer = await this.browser.$(
      '#vsx-extensions-view-container--vsx-extensions\\:builtin'
    );

    // Expand builtin extensions
    const builtinHeader = await builtinContainer.$('.theia-header.header');
    await builtinHeader.moveTo({ xOffset: 1, yOffset: 1 });
    await builtinHeader.waitForDisplayed();
    await builtinHeader.waitForClickable();
    await builtinHeader.click();

    // Wait for expansion to finish
    const builtin = await this.browser.$(
      '#vsx-extensions\\:builtin .theia-TreeContainer'
    );
    await builtin.waitForExist();

    // Get names of all builtin extensions
    const extensions = await builtin.$$('.theia-vsx-extension .name');
    const extensionNames = await Promise.all(
      extensions.map(e => e.getText())
    );

    // Exemplary check a few extensions
    expect(extensionNames).to.include('Debugger for Java');
    expect(extensionNames).to.include('TypeScript Language Basics (built-in)');
  });
});
