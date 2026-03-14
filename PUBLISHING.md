# Publishing and deployment overview

INTERLIS IDE has two maintainer workflows that are easy to confuse:

- product releases such as `0.0.8 -> 0.0.9`
- Eclipse Theia base upgrades such as `v1.69.0 -> v1.70.0`

The detailed human steps live in separate runbooks:

- [RELEASE.md](RELEASE.md) for product releases
- [THEIA_UPGRADE.md](THEIA_UPGRADE.md) for vendor-upstream merges from `eclipse-theia/theia-ide`

## What is automated

### GitHub Releases

The workflow in [build.yml](.github/workflows/build.yml):

- runs verification builds for pull requests and pushes to `master`
- builds Electron artifacts for the supported platforms
- creates a GitHub Release when a tag matching `v*` is pushed
- marks the generated release as `latest`, which also feeds the stable in-app updater

In practice, the only manual release trigger is:

```sh
git tag -a v0.0.X -m "INTERLIS IDE 0.0.X"
git push origin v0.0.X
```

Everything else about version preparation belongs in [RELEASE.md](RELEASE.md).

### Documentation site

The workflow in [deploy-docs.yml](.github/workflows/deploy-docs.yml):

- runs on pushes to `master` that touch `docs/**`
- builds the Docusaurus site from `docs/`
- deploys the generated static site to GitHub Pages

Root markdown files such as `README.md`, `RELEASE.md`, and `THEIA_UPGRADE.md` are repository-maintainer documents. Updating them does not trigger the Docusaurus deployment workflow.

## What is not automated

These steps are intentionally maintained as human runbooks:

- deciding the next product version
- deciding whether a bundled plugin update belongs in the release
- choosing and merging the correct sequence of upstream Theia IDE tags
- restoring local branding, updater, and packaging decisions after upstream merges

Use the dedicated runbooks instead of reconstructing those flows from old branches:

- [RELEASE.md](RELEASE.md)
- [THEIA_UPGRADE.md](THEIA_UPGRADE.md)
