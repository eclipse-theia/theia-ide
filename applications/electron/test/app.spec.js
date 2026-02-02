const os = require('os');
const path = require('path');
const { execSync } = require('child_process');
const { remote } = require('webdriverio');
const { expect } = require('chai');

const THEIA_LOAD_TIMEOUT = 15000; // 15 seconds

// Set environment variable to disable splash screen (works with asar packaging)
process.env.THEIA_NO_SPLASH = '1';

function isMacArm() {
  if (os.platform() !== 'darwin') {
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
    await appShell.waitForExist({
      timeout: THEIA_LOAD_TIMEOUT,
      timeoutMsg: 'Theia took too long to load.',
    });

    // If workspace trust dialog appears, trust the workspace
    const dialog = await this.browser.$('.dialogOverlay.workspace-trust-dialog');
    const dialogAppeared = await dialog.waitForExist({ timeout: 5000 }).catch(() => false);

    if (dialogAppeared) {
      // Click the main action button to trust the workspace
      const trustButton = await this.browser.$('.dialogOverlay.workspace-trust-dialog .dialogControl button.theia-button.main');
      const buttonClickable = await trustButton.waitForClickable({ timeout: 2000 }).catch(() => false);
      if (buttonClickable) {
        await trustButton.click();
        // Wait for dialog to close
        await dialog.waitForExist({ timeout: 2000, reverse: true }).catch(() => { });
      }
    }
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

    // Wait for expansion to finish (plugins may take time to scan, especially with asar packaging)
    const builtin = await this.browser.$(
      '#vsx-extensions\\:builtin .theia-TreeContainer'
    );
    await builtin.waitForExist({ timeout: 10000 });

    // Get names of all builtin extensions
    const extensions = await builtin.$$('.theia-vsx-extension .name');
    const extensionNames = await Promise.all(
      extensions.map(e => e.getText())
    );

    // Exemplary check a few extensions
    expect(extensionNames).to.include('Debugger for Java');
    expect(extensionNames).to.include('TypeScript and JavaScript Language Features (built-in)');
  });

  it('Search in workspace', async function () {
    // Wait a bit to make sure key handlers are registered
    await new Promise(r => setTimeout(r, 5000));

    // Open search view (Ctrl+Shift+F)
    await this.browser.keys(macSafeKeyCombo(['Control', 'Shift', 'f']));

    // Wait for search input to appear
    const searchInput = await this.browser.$('#search-input-field');
    await searchInput.waitForExist({ timeout: 5000 });
    await searchInput.waitForDisplayed();

    // Search for text that exists in the test workspace README.md
    await searchInput.setValue('Test Workspace');

    // Wait for search results to appear
    const searchResults = await this.browser.$('.t-siw-search-container .resultLine');
    await searchResults.waitForExist({ timeout: 10000, timeoutMsg: 'Search results did not appear. Ripgrep may not be working correctly with asar packaging.' });

    // Verify we got results
    const resultsText = await searchResults.getText();
    expect(resultsText).to.include('Test Workspace');
  });

  it('Quick file open', async function () {
    // Wait a bit to make sure key handlers are registered
    await new Promise(r => setTimeout(r, 5000));

    // Open quick file picker (Ctrl+P)
    await this.browser.keys(macSafeKeyCombo(['Control', 'p']));

    // Wait for quick input to appear
    const quickInput = await this.browser.$('.quick-input-widget');
    await quickInput.waitForExist({ timeout: 5000 });
    await quickInput.waitForDisplayed();

    // Type filename to search for
    const inputBox = await this.browser.$('.quick-input-box input');
    await inputBox.waitForExist({ timeout: 5000 });
    await inputBox.setValue('README');

    // Wait for file to appear in results
    const fileResult = await this.browser.$('.quick-input-list-row');
    await fileResult.waitForExist({ timeout: 10000, timeoutMsg: 'Quick file open results did not appear. Ripgrep may not be working correctly with asar packaging.' });

    // Verify README.md appears in results
    const resultLabel = await this.browser.$('.quick-input-list-label');
    const labelText = await resultLabel.getText();
    expect(labelText.toLowerCase()).to.include('readme');
  });

  it('Integrated terminal', async function () {
    // Wait a bit to make sure key handlers are registered
    await new Promise(r => setTimeout(r, 5000));

    // Open terminal (Ctrl+` on all platforms, including Mac)
    await this.browser.keys(['Control', '`']);

    // Wait for terminal widget to appear
    const terminal = await this.browser.$('.xterm');
    await terminal.waitForExist({ timeout: 10000, timeoutMsg: 'Terminal did not open. PTY may not be working correctly with asar packaging.' });
    await terminal.waitForDisplayed();

    // Verify terminal is visible
    const isDisplayed = await terminal.isDisplayed();
    expect(isDisplayed).to.equal(true);
  });
});
