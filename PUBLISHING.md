# Publishing

This guide contains the steps to publish a new version of the Theia IDE. The preview, testing and release process is described in [this section](#preview-testing-and-release-process-for-the-theia-ide)

Every commit to master will be published as a preview version.
Updates will only work when there was a version change.

## Update Package Versions and Theia

If there was *no* Theia release we usually want to increment the patch version by 1, e.g. 1.47.100 -> 1.47.101.

If there was a new Theia *minor* release, e.g. 1.48.0, we want to use the same version as Theia.

If there was a new Theia *patch* release, e.g. 1.48.1, we use Theia's patch version multiplied by 100, e.g. 1.48.100.

```sh
# Update mono repo version
yarn version --no-git-tag-version

# Update version of all packages
yarn lerna version --exact --no-push --no-git-tag-version

# If there was a Theia release, update Theia dependencies
yarn update:theia 1.48.0 && yarn update:theia:children 1.48.0

# Update yarn.lock
yarn
```

If there was a Theia Release

* check if there are any breaking changes
* check if new built-ins are available
* check if any changes were made to the sample applications (e.g. new packages or additional configuration)

and adapt the code/built-ins accordingly.

Finally, open a PR with your changes.

## Upgrade Dependencies

We want to run `yarn upgrade` regularily to get the latest versions of our dependencies.
You may want to keep this in a separate PR as this might require IP Reviews from the Eclipse Foundation and may take some time.
After an upgrade you should check the used `electron` version in the `yarn.lock`.
If there was an update, update `electronVersion` in `applications/electron/electron-builder.yml` accordingly.

## Promote IDE from Preview to Stable Channel

You can promote the IDE via this [Build Job](https://ci.eclipse.org/theia/job/Theia%20-%20Promote%20IDE/).

In `VERSION` specfiy which version to copy from <https://download.eclipse.org/theia/ide-preview/>, e.g. 1.48.0.

In `TOUPDATE` specify the older versions for which you want to enable direct (incremental) updates on windows.\
See <https://download.eclipse.org/theia/ide/> for the old releases.
E.g. `1.45.0,1.46.100,1.47.100`.\
*We plan to automate this, but at the moment it's a required parameter.*

## Publish Docker Image

Run this [workflow](https://github.com/eclipse-theia/theia-ide/actions/workflows/publish-theia-ide-img.yml) from the master branch.

## Preview, Testing and Release Process for the Theia IDE

Once a new Theia Platform release is available, the Theia IDE is updated to the new version. This automatically makes a new preview build available (see above). Once the preview build is successfully tested by the preview testers, it is published as a new official version, also available for automatic update. The detailed steps for this process are described in the following:

1. Create a new preview version of the Theia IDE as decribed above (do not publish as stable yet)
2. Create a new discussion [here](https://github.com/eclipse-theia/theia/discussions) based on the following template:
>Theia IDE 1.xz preview testing</br></br>
>The new version 1.XZ.0 of the Theia IDE is available on the preview channel now, please join the preview testing! You can download it here: {link to the download}. You can update your existing installation by setting the preference *updates.channel* to *preview*. 
Please respond here when you were able to test the preview without finding blockers, by commenting with a :heavy_check_mark:. If you find any issues, please mention them in this thread and report them as an issue once confirmed by other testers.

3. Announce availability of the preview release on theia-dev@eclipse.org based on the following template:
>Theia IDE 1.xz preview</br></br>
>Hi,</br></br>The new version 1.XZ.0 of the Theia IDE is available on the preview channel now. Please join the preview test and help us stabilizing the release. Please visit this discussion for more information and for coordination: {link to the Github discussion created above}</br></br>best regards,

4. Fix reported blockers and create patch releases (This is a community effort and typically takes 1-2 weeks)
5. Once no blockers are left, declare the release final (see publishing above).
6. Post official release announcement

**If too many issues are found, fixes take too long or no corresponding ressources are available to fix things, a Theia IDE release might be skipped. This means, it will not update to a new Theia version, but wait for the next version.**
