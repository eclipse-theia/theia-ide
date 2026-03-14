---
title: Troubleshooting guide
description: Resolve common issues when running the INTERLIS IDE stack.
---

## Missing compilation output 

If you don't see the output of a compilation, e.g. after saving the model file, go to `View` 
-> `Output`. Then choose `INTERLIS LSP` in the dropdown.

## macOS builds are reported as "damaged"

When you download an unsigned Electron build on macOS, Gatekeeper can show the error
`<AppName> is damaged and can’t be opened. You should move it to the Trash.` if the
`com.apple.quarantine` extended attribute is present on the `.app` bundle. This typically
happens when the archive is created on one machine, unpacked on another, and then
re-packed multiple times during a CI workflow.

To reduce the chance of the message appearing:

1. Build and package the `.app`, `.dmg`, and `.zip` entirely on the macOS runner. Avoid
   downloading, unzipping, and re-zipping the app on Linux or Windows runners because
   these tools strip the metadata that Gatekeeper expects.
2. Before creating the final DMG or ZIP, clear the quarantine attribute in your workflow
   (for example, `xattr -cr InterlisIDE.app`). When the attribute is absent at packaging
   time, Gatekeeper shows the standard “unidentified developer” dialog instead of the
   “damaged” message. Re-run `xattr` after every step that unpacks the bundle in CI.
3. Use `ditto -c -k --sequesterRsrc --keepParent` to generate ZIP archives. `ditto` preserves
   the bundle structure and extended attributes better than the default `zip` utility.
4. Document the manual workaround for users who still encounter the dialog, e.g.
   `xattr -dr com.apple.quarantine /Applications/InterlisIDE.app`.

Ultimately, the only way to prevent the warning completely is to sign and notarize your
macOS artifacts. Until that is possible, the steps above make the build behave more like an
unsigned download from an “unknown developer” and avoid the more alarming “damaged”
message.

## Need more help?

Open an issue on the [INTERLIS IDE GitHub tracker](https://github.com/edigonzales/interlis-ide/issues) or join the community spaces linked in the footer of this site.
