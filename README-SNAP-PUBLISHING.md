Publishing to Snap Store
-----------------------

1. Bump the versions before releasing
    * There is a version in the package.json and one in the snapcraft.yml
    * npm install after bumping the version to make sure it's copied to the package.yml
2. Build by simply running: `snapcraft`
3. Log into snap developer account: `snap login`
4. Publish:
5. Commit version bump and add a release flag