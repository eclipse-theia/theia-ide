# Publishing

This guide outlines the steps for publishing a new version of the Theia IDE, including the preview, testing, and release processes. The preview, testing, and release process is described in [this section](#preview-testing-and-release-process-for-the-theia-ide).

Every commit to master will be published as a preview version. Updates will only work when there is a version change.

## Update Package Versions and Theia

This guide refers to two versions that may be the same depending on the context. Please read carefully to avoid confusion:

- **THEIA_VERSION**: The version of Theia to use in this version of the Theia IDE.
- **THEIA_IDE_VERSION**: The version of the Theia IDE itself that is being published, which might differ from Theia's version.
  - If there was *no* Theia release, increment the patch version by 1 (e.g. 1.47.100 -> 1.47.101).
  - If there was a new Theia *minor* release (e.g. 1.48.0), use the same version as Theia.
  - If there was a new Theia *patch* release (e.g. 1.48.1), use Theia's patch version multiplied by 100 (e.g. 1.48.100).

```sh
# Install dependencies for building
yarn

# Update mono repo version to THEIA_IDE_VERSION
yarn version --no-git-tag-version

# If there was a Theia release, update Theia dependencies to THEIA_VERSION
yarn update:theia 1.48.0 && yarn update:theia:children 1.48.0

# Update version of all packages to THEIA_IDE_VERSION
yarn lerna version --exact --no-push --no-git-tag-version

# Update yarn.lock
yarn
```

If there was a Theia Release:

- Check for breaking changes, new built-ins, and updates to sample applications (e.g., new packages or additional configurations).
- Adapt the code/built-ins as necessary.

Finally, open a PR with your changes. Merging the PR will automatically trigger the release to the preview channel.

## Upgrade Dependencies

Regularly run `yarn upgrade` to keep dependencies up-to-date. You may want to keep this in a separate PR, as it might require IP Reviews from the Eclipse Foundation and may take some time. After an upgrade, check the used `electron` version in the `yarn.lock`. If there was an update, adjust `electronVersion` in `applications/electron/electron-builder.yml` accordingly.

## Promote IDE from Preview to Stable Channel

Promote the IDE using this [Build Job](https://ci.eclipse.org/theia/job/Theia%20-%20Promote%20IDE/).

In `VERSION`, specify which version to copy from <https://download.eclipse.org/theia/ide-preview/> (the THEIA_IDE_VERSION) (e.g., 1.48.0).

## Publish Docker Image

Run this [workflow](https://github.com/eclipse-theia/theia-ide/actions/workflows/publish-theia-ide-img.yml) from the master branch.

## Preview, Testing, and Release Process for the Theia IDE

When a new Theia Platform release is available, the Theia IDE is updated accordingly, resulting in a new preview build. After successful testing, it is published as an official version. The detailed steps are as follows:

1. Create a new preview version of the Theia IDE as described above (do not publish as stable yet).
2. Create a new discussion [here](https://github.com/eclipse-theia/theia/discussions) based on the following template:

>Theia IDE 1.xz preview testing
>
>The new version 1.XZ.0 of the Theia IDE is available on the preview channel now. Please join the preview testing! You can download it here: {link to the download}. Update your existing installation by setting the preference *updates.channel* to *preview*.
Please respond here when you can test the preview without finding blockers, by commenting with a :heavy_check_mark:. If you find any issues, please mention them in this thread and report them as an issue once confirmed by other testers.

3. Announce the availability of the preview release on <theia-dev@eclipse.org> based on the following template:

>Theia IDE 1.xz preview
>
>Hi,
>The new version 1.XZ.0 of the Theia IDE is available on the preview channel now. Please join the preview test and help us stabilize the release. Visit this discussion for more information and coordination: {link to the Github discussion created above}
>Best regards,

4. Fix reported blockers and create patch releases (this is a community effort and typically takes 1-2 weeks).
5. Once no blockers are left, declare the release final (see publishing above).
6. Post the official release announcement.

**If too many issues arise, fixes take too long, or there are insufficient resources, the Theia IDE release may be skipped, delaying the update to the next version.**
