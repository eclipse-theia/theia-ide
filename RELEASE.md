Current base:

- INTERLIS IDE product version stays independent from Theia.
- For the first release on the upgraded base use:
  - `INTERLIS IDE 0.0.8`
  - `Theia IDE v1.69.0`
  - `Theia v1.69.0`

```
yarn
yarn version --no-git-tag-version
yarn lerna version --exact --no-push --no-git-tag-version
git commit -a -m 'update to interlis-editor 0.0.XX'
git push
git tag v0.0.Y
git push origin v0.0.Y
```
