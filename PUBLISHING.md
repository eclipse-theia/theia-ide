# Publishing

This document provides a unified, structured guide for publishing a new version of the Theia IDE. It covers everything from updating package versions, preview testing, releasing, promoting to stable, and other post-release activities.

## 1. Overview

Every commit to the master branch is automatically published as a preview version. Official updates require a version change.

This guide differentiates between two version numbers:

- **THEIA_VERSION**: The version of Theia used in this release.
- **THEIA_IDE_VERSION**: The Theia IDE release version. Depending on the context:
  - If there was **no** Theia release, increment the patch version by 1 (e.g., 1.47.100 -> 1.47.101).
  - For a new Theia *minor* release (e.g., 1.48.0), use the same version as Theia.
  - For a new Theia *patch* release (e.g., 1.48.1), use Theia's patch version multiplied by 100 (e.g., 1.48.100).

## 2. Update Package Versions and Theia

Follow these steps to update dependencies and package versions:

1. Install build dependencies:

   ```sh
   yarn
   ```

2. Update the monorepo version to **THEIA_IDE_VERSION** (without creating a Git tag):

   ```sh
   yarn version --no-git-tag-version
   ```

3. If there is a Theia release, update Theia dependencies to **THEIA_VERSION**:

   ```sh
   yarn update:theia ${THEIA_VERSION} && yarn update:theia:children ${THEIA_VERSION}
   ```

4. Update all package versions to **THEIA_IDE_VERSION**:

   ```sh
   yarn lerna version --exact --no-push --no-git-tag-version
   ```

5. Update the yarn lock file:

   ```sh
   yarn
   ```

6. Update the code to include everything that should be part of the release:
   - Implement all tickets that are located in: <https://github.com/eclipse-theia/theia-ide/labels/toDoWithRelease>
   - If there was a Theia release:
      - Review breaking changes
      - Check for new built-ins
      - Check sample applications changes
      - Update code as necessary

7. After completing these steps, open a PR with your changes.

8. The PR will trigger a verification build that generates two zip files with mac artifacts.
Download these zips and replace them in this pre-release: <https://github.com/eclipse-theia/theia-ide/releases/tag/pre-release>.
These unsigned dmgs will be used as input for the Jenkins build.

9. Merging the PR automatically triggers a preview release, so make sure step 8 is fully completed before merging.

## 3. Preview, Testing, and Release Process

Once the PR is merged and the preview build is created, follow these steps for testing and eventual release:

1. Confirm the new preview version is published (do not promote as stable yet).

2. Initiate a discussion on GitHub using the following template:

   > Theia IDE 1.xz preview testing
   >
   > The new version 1.XZ.0 of the Theia IDE is available on the preview channel now. Please join the preview testing! You can download it here: {link to the download}. Update your existing installation by setting the preference *updates.channel* to *preview*. Please respond here when you can test the preview without finding blockers, by commenting with a :heavy_check_mark:. If you find any issues, please mention them in this thread and report them as an issue once confirmed by other testers.

3. Announce the preview release via email to <theia-dev@eclipse.org> with the following template:

   > Theia IDE 1.xz preview
   >
   > Hi,
   > The new version 1.XZ.0 of the Theia IDE is available on the preview channel now. Please join the preview test and help us stabilize the release. Visit this discussion for more information and coordination: {link to the Github discussion created above}
   >
   > Best regards,

4. Address reported blockers and issue patch releases (this process may take 1–2 weeks).

5. Once all issues are resolved, finalize the release and proceed to promote the IDE from preview to stable.

6. Announce the official release once published.

**Note:** If issues are persistent, or resources are insufficient, the release may be postponed to the next version.

## 4. Promote IDE from Preview to Stable Channel

Promote the IDE using the [Build Job](https://ci.eclipse.org/theia/job/Theia%20-%20Promote%20IDE/).

- Specify the release version in the `VERSION` parameter (e.g., 1.48.0), corresponding to the **THEIA_IDE_VERSION** copied from <https://download.eclipse.org/theia/ide-preview/>.

## 5. Tag the Release Commit

After promoting the release, tag the release commit as follows:

1. Create the tag:

   ```bash
   git tag v${THEIA_IDE_VERSION} ${SHA of release commit}
   ```

2. Push the tag to the repository:

   ```bash
   git push origin v${THEIA_IDE_VERSION}
   ```

## 6. Publish Docker Image

Publish the Docker image by running the [workflow](https://github.com/eclipse-theia/theia-ide/actions/workflows/publish-theia-ide-img.yml) from the `master` branch. Use **${THEIA_IDE_VERSION}** as the version.

## 7. Snap Update

After the IDE is promoted to stable, perform these steps for the snap update:

1. Run [this workflow](https://github.com/eclipse-theia/theia-ide-snap/actions/workflows/update.yml) from the `master` branch.
2. After the build succeeded, visit <https://github.com/eclipse-theia/theia-ide-snap/pulls> to find the PR that updates to **${THEIA_IDE_VERSION}**.
3. Check out the corresponding branch.
4. Amend the latest commit with your author details:

   ```bash
   git commit --amend --author="Your Name <name@example.com>"
   ```

5. Force push the branch.
6. Verify that all checks pass, and then `rebase and merge`.
7. Confirm the master branch build is successful.

## 8. Upgrade Dependencies

After each release, run the following command to upgrade dependencies:

```bash
yarn upgrade
```

Keep this upgrade process in a separate PR, as it might require IP Reviews from the Eclipse Foundation and additional time. Also, verify the `electron` version in `yarn.lock` and adjust `electronVersion` in `applications/electron/electron-builder.yml` if it has changed.
