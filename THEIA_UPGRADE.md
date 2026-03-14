# Eclipse Theia upgrade runbook

Use this runbook when you want to raise the INTERLIS IDE base from one upstream Eclipse Theia IDE release to another.

Current baseline at the time of writing:

- Theia IDE `v1.69.0`
- Theia `v1.69.0`

This repository is not a detached snapshot. It keeps product-specific changes on top of the `eclipse-theia/theia-ide` history and should continue to treat that repository as a vendor upstream.

## Principles

- Keep `origin` as the INTERLIS IDE product repository.
- Keep `upstream` as `https://github.com/eclipse-theia/theia-ide.git`.
- Merge official upstream tags in order.
- Do not use `yarn update:theia` as the main upgrade mechanism.
- Keep local branding and updater behaviour, but prefer upstream for shared application skeleton and workflow changes.

## 1. Prepare the branch

Verify remotes:

```sh
git remote -v
```

If `upstream` is missing:

```sh
git remote add upstream https://github.com/eclipse-theia/theia-ide.git
```

Create a clean upgrade branch from `origin/master`:

```sh
git fetch origin
git fetch upstream --tags
git switch master
git pull --ff-only origin master
git switch -c codex/theia-upgrade-<target-version>
```

Use a descriptive branch name such as `codex/theia-upgrade-1.70`.

## 2. Determine the merge path

Find the current shared Theia version in the workspace and decide the target upstream version.

Use both of these as source-of-truth checks:

- the shared `@theia/*` version in the application package manifests
- the base version line shown in `theia-extensions/product/src/browser/theia-ide-about-dialog.tsx`

Then list the upstream tags:

```sh
git tag --list 'v1.*' | sort -V | tail -50
```

Write down the full ordered sequence of `theia-ide` tags between the current base and the target base. Do not skip across minor lines. Example:

- `v1.66.200`
- `v1.67.100`
- `v1.68.201`
- `v1.69.0`

## 3. Merge upstream tags one by one

For each tag in the sequence:

```sh
git merge --no-ff <tag>
```

If the merge stops for conflicts:

1. resolve the conflicts
2. `git add` the resolved files
3. finish the merge commit with a message such as `Merge upstream v1.70.0`

After each tag, run:

```sh
yarn
yarn build:dev
yarn download:plugins
yarn electron package:preview
```

Do not continue to the next tag until the current merged state builds again.

## 4. Resolve conflicts with a consistent policy

Prefer upstream for shared infrastructure:

- root package manifests and lerna configuration
- application package manifests
- GitHub workflow skeleton and packaging defaults
- newly added upstream applications or support files

Prefer local INTERLIS IDE behaviour for product-specific files:

- branding, icons, splash screen, product naming, and about dialog content
- documentation and issue links
- updater targets and GitHub release settings
- bundled plugin references
- custom Theia extensions such as the webview drag guard

Review these areas carefully after each merge step:

- `applications/electron/`
- `theia-extensions/product/`
- `theia-extensions/updater/`

## 5. Audit for upstream API changes

Read the upstream migration guide and changelog for every version you cross. Pay extra attention to:

- event API changes such as `Listener.await` to `Listener.awaitAll`
- moved or removed core exports
- Monaco-related build changes
- direct deep imports from `@theia/*`

In this repository, inspect product and updater code first because that is where local Theia integration is concentrated.

Use `yarn update:theia` only as a cleanup tool if some package versions remain inconsistent after the upstream merges. It is not a substitute for the tag-by-tag merge.

## 6. Final verification and follow-up

Once the last target tag is merged and local product behaviour is restored, run the full verification pass:

```sh
yarn
yarn lint
yarn build:dev
yarn download:plugins
yarn electron package:preview
yarn electron test
yarn electron package:prod
```

Before opening the PR, confirm:

- the about dialog shows the new Theia IDE / Theia base version
- INTERLIS branding, links, and updater configuration are still correct
- bundled plugins still download and load
- the release workflow and produced artifacts still match the product expectations

Commit the upgrade work, open a PR against `master`, and merge it. After the Theia upgrade lands, follow [RELEASE.md](RELEASE.md) to prepare and publish the next `0.0.x` product release.
