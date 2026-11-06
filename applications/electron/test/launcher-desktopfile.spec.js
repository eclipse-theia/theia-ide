require('reflect-metadata');
const assert = require('node:assert/strict');
const { TheiaDesktopFileServiceEndpoint } = require('theia-ide-launcher-ext/lib/node/desktopfile-endpoint');

const execLine = contents => contents.split('\n').find(line => line.startsWith('Exec='));

describe('Launcher desktop file', function () {

    const endpoint = new TheiaDesktopFileServiceEndpoint();
    const imagePath = '/home/user/.local/share/applications/theia-ide-electron-app.png';

    it('keeps a plain AppImage path unquoted', function () {
        const appImage = '/home/user/Applications/TheiaIDE.AppImage';
        assert.equal(execLine(endpoint.getDesktopFileContents('Theia IDE', appImage, imagePath)),
            'Exec=/home/user/Applications/TheiaIDE.AppImage %U');
        assert.equal(execLine(endpoint.getDesktopURLFileContents('Theia IDE', appImage, imagePath, 'theia')),
            'Exec=/home/user/Applications/TheiaIDE.AppImage --open-url %U');
    });

    it('quotes an AppImage path that contains spaces or parentheses', function () {
        const appImage = '/home/user/My Apps/TheiaIDE (1).AppImage';
        assert.equal(execLine(endpoint.getDesktopFileContents('Theia IDE', appImage, imagePath)),
            'Exec="/home/user/My Apps/TheiaIDE (1).AppImage" %U');
        assert.equal(execLine(endpoint.getDesktopURLFileContents('Theia IDE', appImage, imagePath, 'theia')),
            'Exec="/home/user/My Apps/TheiaIDE (1).AppImage" --open-url %U');
    });

    it('escapes quotes, dollar signs, backslashes and percent signs in the AppImage path', function () {
        const appImage = '/opt/a "b" $c\\d 100%.AppImage';
        assert.equal(execLine(endpoint.getDesktopFileContents('Theia IDE', appImage, imagePath)),
            'Exec="/opt/a \\\\"b\\\\" \\\\$c\\\\\\\\d 100%%.AppImage" %U');
    });
});
