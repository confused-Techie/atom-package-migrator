This CLI application is made to convert Atom.io Archived Repository package data.

Intended that this data was originally archived via [AtomPackagesArchive](https://github.com/confused-Techie/AtomPackagesArchive) and will then be deployed to the new [atom-community-server-backend-JS](https://github.com/confused-Techie/atom-community-server-backend-JS).

It is **REQUIRED** that you have the packages saved file by file, within the `./data` directory, at the root of this project.

If you have done that, run `node .` in the root of this project, and after some time you will see a `./dest/package_pointer.json` and `./dest/packages/*.json` files created.

The package_pointer contains the package_pointer that should be used on the new package, while the packages folder will contain the properly created and formatted packages for every single package.


Once the script finishes running you will likely see several `Failed to Write:.....` this is indicated a package that was unable to be written. This could be because of an error, or more likely the package is no longer allowed to be used within the new API server backend.

It will list a reason for this happening along with the error message.
