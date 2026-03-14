# Product release runbook

Use this runbook when you want to publish a new INTERLIS IDE release without changing the Eclipse Theia base, for example `0.0.8 -> 0.0.9`.

If you need to upgrade the vendor-upstream base first, follow [THEIA_UPGRADE.md](THEIA_UPGRADE.md) before starting a product release.

## Preconditions

- You are starting from `origin/master`.
- The working tree is clean.
- The target tag does not already exist.
- Node.js `>=20` and Yarn Classic are available.

Example target:

```sh
export RELEASE_VERSION=0.0.9
export RELEASE_TAG=v0.0.9
export RELEASE_BRANCH=codex/release-${RELEASE_VERSION}
```

## 1. Create the release branch

```sh
git fetch origin --tags
git switch master
git pull --ff-only origin master
git tag --list "${RELEASE_TAG}"
git switch -c "${RELEASE_BRANCH}"
```

`git tag --list "${RELEASE_TAG}"` must print nothing before you continue.

## 2. Update the product version

Update the root package version:

```sh
yarn version --no-git-tag-version --new-version "${RELEASE_VERSION}"
```

Update all workspace package versions to the same product version:

```sh
yarn lerna version "${RELEASE_VERSION}" --exact --no-push --no-git-tag-version --yes
```

At this point the product version is aligned across the repo. Do not use `yarn update:theia` for a normal product release.

## 3. Apply release-specific product changes

Typical examples:

- update the bundled INTERLIS plugin version in the root `package.json`
- adjust branding text, links, or release notes
- include small product fixes that should ship with the release

If you touch bundled plugins, refresh them before testing:

```sh
yarn download:plugins
```

## 4. Verify the release branch

Run the checks in this order:

```sh
yarn
yarn lint
yarn build:dev
yarn download:plugins
yarn electron package:preview
yarn electron test
yarn electron package:prod
```

This proves that:

- the workspace installs cleanly
- TypeScript and packaging changes still build
- the bundled plugins can be downloaded
- the packaged Electron app still passes the smoke tests
- a production release bundle can be assembled locally

## 5. Commit and open the PR

```sh
git status
git commit -am "Prepare INTERLIS IDE ${RELEASE_VERSION}"
git push -u origin "${RELEASE_BRANCH}"
```

Open a PR against `master`. In the PR description, list:

- the new product version
- any bundled plugin changes
- the exact verification commands you ran

## 6. Merge and create the release tag

After the PR is merged:

```sh
git switch master
git pull --ff-only origin master
git tag -a "${RELEASE_TAG}" -m "INTERLIS IDE ${RELEASE_VERSION}"
git push origin "${RELEASE_TAG}"
```

## 7. Verify the GitHub release

Pushing `v0.0.X` triggers [.github/workflows/build.yml](.github/workflows/build.yml), which creates the GitHub Release automatically.

Check the workflow and the resulting release for:

- successful build jobs on all configured platforms
- generated release notes
- expected artifacts such as `.zip`, `.dmg`, `.exe`, `.deb`, `.AppImage`, and `latest-mac.yml`
- correct `latest` marker on GitHub so the stable updater continues to work

If the release also changed the public docs under `docs/**`, the docs deployment workflow will run separately after the merge to `master`.
