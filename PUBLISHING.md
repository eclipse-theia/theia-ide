# Publishing Guide for the Eclipse Theia IDE

This document provides a unified, structured guide for publishing a new version of the Theia IDE. It covers everything from updating package versions, preview testing, releasing, promoting to stable, and other post-release activities.

## Table of Contents

1. [Overview](#1-overview)
2. [Update Package Versions and Theia](#2-update-package-versions-and-theia)
   - [2.1 Install build dependencies](#21-install-build-dependencies)
   - [2.2 Update versions](#22-update-versions)
   - [2.3 Check for mandatory code changes](#23-check-for-mandatory-code-changes)
   - [2.4 Prepare Release PR](#24-prepare-release-pr)
   - [2.5 Mac Artifacts](#25-mac-artifacts)
   - [2.6 Merge Release PR & Trigger Jenkins Build](#26-merge-release-pr--trigger-jenkins-build)
3. [Preview, Testing, and Release Process](#3-preview-testing-and-release-process)
   - [3.1 Confirm the new preview version is published](#31-confirm-the-new-preview-version-is-published-do-not-promote-as-stable-yet)
   - [3.2 Announce Preview Test Phase](#32-announce-preview-test-phase)
   - [3.3 Patch Releases](#33-patch-releases)
4. [Promote IDE from Preview to Stable Channel](#4-promote-ide-from-preview-to-stable-channel)
5. [Tag the Release Commit](#5-tag-the-release-commit)
6. [Publish Docker Image](#6-publish-docker-image)
7. [Snap Update](#7-snap-update)
8. [Upgrade Dependencies](#8-upgrade-dependencies)

## 1. Overview
<!-- release: both -->

Every commit to the master branch is automatically published as a preview version. Official updates require a version change.

This guide differentiates between two version numbers:

- **THEIA_VERSION**: (used variable: {{version}}) The version of Theia used in this release.
- **THEIA_IDE_VERSION**: (used variable: {{ideVersion}}) The Theia IDE release version. Depending on the context:
  - If there was **no** Theia release, increment the patch version by 1 (e.g., 1.47.100 -> 1.47.101).
  - For a new Theia *minor* release (e.g., 1.48.0), use the same version as Theia.
  - For a new Theia *patch* release (e.g., 1.48.1), use Theia's patch version multiplied by 100 (e.g., 1.48.100).

## 2. Update Package Versions and Theia
<!-- release: both -->

Follow these steps to update dependencies and package versions:

### 2.1. Install build dependencies
<!-- release: both -->

```sh
yarn
```

### 2.2. Update versions
<!-- release: both -->

1. Update the monorepo version to **THEIA_IDE_VERSION** (without creating a Git tag):

   ```sh
   yarn version --no-git-tag-version --new-version {{ideVersion}}
   ```

2. If there is a Theia release, update Theia dependencies to **THEIA_VERSION** :

   ```sh
   yarn update:theia {{version}} && yarn update:theia:children {{version}}
   ```

3. Update all package versions to **THEIA_IDE_VERSION** (select in input prompt):

   ```sh
   yarn lerna version --exact --no-push --no-git-tag-version
   ```

4. Update the yarn lock file:

   ```sh
   yarn
   ```

### 2.3. Check for mandatory code changes
<!-- release: both -->

Update the code to include everything that should be part of the release:

- Implement all tickets that are located in: <https://github.com/eclipse-theia/theia-ide/labels/toDoWithRelease>
- If there was a Theia release:
  - Review breaking changes
  - Check for new built-ins
  - Check sample applications changes
  - Update code as necessary
  - Check for new theia packages to be consumed in the example applications (in case there are no tickets)

### 2.4. Prepare Release PR
<!-- release: both -->

After completing step 2.3, open a PR with your changes <https://github.com/eclipse-theia/theia-ide/compare>

   PR Title:

   ```md
   Update to Theia v{{ideVersion}}
   ```

### 2.5. Mac Artifacts
<!-- release: both -->

- The PR will trigger a verification build that generates two zip files with mac artifacts.
- Download these zips and replace them in this pre-release: <https://github.com/eclipse-theia/theia-ide/releases/tag/pre-release>.
- These unsigned dmgs will be used as input for the Jenkins build.

### 2.6. Merge Release PR & Trigger Jenkins Build
<!-- release: both -->

1. Merge PR

2. ==> Steps 2.4 and 2.5 need to be complete to proceed!

3. Once PR checks are complete, trigger the Jenkins Release Preview <https://ci.eclipse.org/theia/job/theia-ide-release/> job without parameters.

4. Once 3. is successful the notarize job <https://ci.eclipse.org/theia/job/theia-ide-sign-notarize/> is started automatically.

5. Once 4. is successful it starts the upload job <https://ci.eclipse.org/theia/job/theia-ide-upload/>

  *Note*: Please report if upload fails more than 5 times, we need to investigate!

## 3. Preview, Testing, and Release Process
<!-- release: both -->

Once the PR is merged and the preview build is created, follow these steps for testing and eventual release:

### 3.1 Confirm the new preview version is published (do not promote as stable yet)
<!-- release: both -->

- Check if uploaded versions are complete in in download folder <https://download.eclipse.org/theia/ide-preview/{{ideVersion}}/>
  - e.g. check if the latest files are correct and the artifacts are there (in doubt, compare to previous versions)

### 3.2 Announce Preview Test Phase
<!-- release: minor -->

### 3.2.1 GH Discussions
<!-- release: minor -->

- Use GitHub Discussions for the announcement in the [Category Release Announcements](https://github.com/eclipse-theia/theia/discussions/new?category=release-announcements).

   Title:

   ```md
   Theia IDE {{majorMinor}}.x Preview Testing
   ```

   Body:

   ```md
   The new version {{ideVersion}} of the Theia IDE is available on the preview channel now. Please join the preview testing!

   You can download it here:

   - [Linux](https://download.eclipse.org/theia/ide-preview/{{ideVersion}}/linux/TheiaIDE.AppImage)
   - [Mac x86](https://download.eclipse.org/theia/ide-preview/{{ideVersion}}/macos/TheiaIDE.dmg)
   - [Mac ARM](https://download.eclipse.org/theia/ide-preview/{{ideVersion}}/macos-arm/TheiaIDE.dmg)
   - [Windows](https://download.eclipse.org/theia/ide-preview/{{ideVersion}}/windows/TheiaIDESetup.exe)

   Update your existing installation by setting the preference `updates.channel` to `preview`.

   Please respond here when you can test the preview without finding blockers, by commenting with a ✔️.
   If you find any issues, please mention them in this thread and report them as an issue once confirmed by other testers.

   | Phase | Target | Status |
   |:---|:---|:---|
   | {{ideVersion}} preview available | {{releaseDate}} | :white_check_mark: |
   | {{ideVersion}} community preview window | {{previewStart}} → {{previewEnd}} | :hourglass_flowing_sand: |
   | Theia IDE {{majorMinor}}.x Promoted to Stable | {{previewEnd}} + 1 business day |  |
   | Docker image Publish | {{previewEnd}} + 1 business day |  |
   | Snap updated | {{previewEnd}} + 1 business day |  |
   ```

- Pin discussion to the Release Announcement Category

### 3.2.2 theia-dev mailing list
<!-- release: minor -->

- Announce the preview release via email to [the `theia-dev` mailing List](mailto:theia-dev@eclipse.org) with the following template:

   Subject:

   ```md
   Theia IDE {{majorMinor}}.x preview phase
   ```

   Body:

   ```md
   Hi everyone,

   The new version {{ideVersion}} of the Theia IDE is available on the preview channel now. Please join the preview test and help us stabilize the release.
   Visit the preview discussion for more information and coordination: https://github.com/eclipse-theia/theia/discussions/{{discussionNumber}}
   ```

### 3.2.3 Eclipse Theia Release discussion
<!-- release: minor -->

- Announce the start of the Theia IDE Preview Test phase in the Theia Release announcement (`Eclipse Theia v{{version}}`) discussion (see <https://github.com/eclipse-theia/theia/discussions/categories/release-announcements>):

   ```md
   The preview test phase for the Theia IDE {{ideVersion}} has started. You can find the details here: 
   
   - https://github.com/eclipse-theia/theia/discussions/{{discussionNumber}}
   ```

### 3.2.4 Optional: Announcement to Theia IDE Preview Testers
<!-- release: both -->

- Optional: Announce the start of the Theia IDE Preview Test phase to your testers (e.g., via Slack, Teams, E-Mail):

   ```md
   :theia: The Theia IDE preview {{ideVersion}} for Theia version {{version}} is now available!
   Please take a moment to test it and provide feedback - whether you've run into issues or everything works as expected. {{linkToNewPreviewComment}}

   To help us get a quick overview, please react with the emoji for your OS (:ubuntu:, :windows:, :mac_arm:, :mac_x64:) once you updated to the new version.
   Thanks!
   ```

### 3.3 Patch Releases
<!-- release: patch -->

- Address reported blockers and issue patch releases (this process may take 1–2 weeks).

   **Note:** If issues are persistent, or resources are insufficient, the release may be postponed to the next version.

- If a blocker was found add this status to the respective preview window:

   ```md
    :no_entry:  blocker was found 
   ```

### 3.3.1 Update Preview Discussion with new preview
<!-- release: patch -->

- For Patch Releases, use the [Preview discussion](#32-announce-preview-test-phase) and post a comment to announce the patch release of the Theia IDE: <https://github.com/eclipse-theia/theia/discussions/{{discussionNumber}}>

   ```md
   The new version {{ideVersion}} of the Theia IDE is available on the preview channel now. Please join the preview testing!

   You can download it here:

   - [Linux](https://download.eclipse.org/theia/ide-preview/{{ideVersion}}/linux/TheiaIDE.AppImage)
   - [Mac x86](https://download.eclipse.org/theia/ide-preview/{{ideVersion}}/macos/TheiaIDE.dmg)
   - [Mac ARM](https://download.eclipse.org/theia/ide-preview/{{ideVersion}}/macos-arm/TheiaIDE.dmg)
   - [Windows](https://download.eclipse.org/theia/ide-preview/{{ideVersion}}/windows/TheiaIDESetup.exe)

   Update your existing installation by setting the preference `updates.channel` to `preview`.

   Please respond here when you can test the preview without finding blockers, by commenting with a ✔️.
   If you find any issues, please mention them in this thread and report them as an issue once confirmed by other testers.
   ```

### 3.3.2 Update Preview Discussion Table
<!-- release: patch -->

- Adapt the target dates to the planned new preview window and final release dates
- Add comments in the status if necessary
- See example announcements here: <https://github.com/eclipse-theia/theia/discussions/16109>

- Update the discussion's status table with two rows for the current patch release:

   ```md
   | [{{ideVersion}} preview available]({{linkToNewPreviewComment}}) | {{previewStart}} | :white_check_mark: |
   | {{ideVersion}} community preview window | {{previewStart}} → {{previewEnd}} | :hourglass_flowing_sand: |
   ```

- Also adapt the target dates of the remaining entries in table (if not yet promoted)

### 3.3.3 Optional: Internal Slack announcement
<!-- release: patch -->

- Optional: Announce the start of the Theia IDE Preview Test phase in your internal Slack channel:

   ```md
   :theia: The Theia IDE preview {{ideVersion}} for Theia version {{version}} is now available!
   Please take a moment to test it and provide feedback - whether you've run into issues or everything works as expected. {{linkToNewPreviewComment}}

   To help us get a quick overview, please react with the emoji for your OS (:ubuntu:, :windows:, :mac_arm:, :mac_x64:) once you updated to the new version.
   Thanks!
   ```

## 3.4 Optional: Internal Slack - feedback reminder
<!-- release: both -->

- Optional: Schedule a slack reminder close to the preview end:

```md
Quick reminder: We're planning to promote the new IDE version (e.g., tomorrow/on Monday), please share your feedback for the preview {{ideVersion}}!
:point_right: https://github.com/eclipse-theia/theia/discussions/{{discussionNumber}}
Thanks! :thx:
```

## 4. Promote IDE from Preview to Stable Channel

Promote the IDE using the [Build Job](https://ci.eclipse.org/theia/job/Theia%20-%20Promote%20IDE/).

- Specify the release version in the `VERSION` parameter (e.g., 1.48.0), corresponding to the **THEIA_IDE_VERSION** copied from <https://download.eclipse.org/theia/ide-preview/>.

- Post a comment to announce the official release of the Theia IDE:

   ```md
   {{ideVersion}} has been promoted to stable
   ```

  - Update the [Base Preview discussion](#32-announce-preview-test-phase) status table with a checkmark and the version that has been published.

  - Mark the message as the answer.

  - Unpin discussion from the Release Announcement Category.

## 5. Tag the Release Commit

After promoting the release, tag the release commit as follows:

1. Create the tag:

   ```bash
   git tag v{{ideVersion}} ${SHA of release commit}
   ```

2. Push the tag to the repository:

   ```bash
   git push origin v{{ideVersion}}
   ```

## 6. Publish Docker Image

Publish the Docker image by running the [workflow](https://github.com/eclipse-theia/theia-ide/actions/workflows/publish-theia-ide-img.yml) from the `master` branch. Use **${THEIA_IDE_VERSION}** as the version.
(We do NOT use the v prefix here in this case currently).

- Update the [Preview discussion](#32-announce-preview-test-phase) status table

## 7. Snap Update

Can be parallel to step 6.
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
8. check if snap is available <https://snapcraft.io/theia-ide>
9. Update the [Preview discussion](#32-announce-preview-test-phase) status table

## 8. Upgrade Dependencies

After each release, run the following command to upgrade dependencies:

Keep this upgrade process in a separate PR, as it might require IP Reviews from the Eclipse Foundation and additional time. Also, verify the `electron` version in `yarn.lock` and adjust `electronVersion` in `applications/electron/electron-builder.yml` if it has changed.

To perform the upgrade:

- Run `yarn upgrade` at the root of the repository.
- Fix any compilation errors, typing errors, and failing tests.
- Open a PR with the changes ([example](https://github.com/eclipse-theia/theia-ide/pull/568)).
- The license check review is done via the CI.
- Wait for the "IP Check" to complete ([example](https://gitlab.eclipse.org/eclipsefdn/emo-team/iplab/-/issues/22828)).

Performing this after the release helps us to find issues with the new dependencies and gives time to perform a license check on the dependencies.
