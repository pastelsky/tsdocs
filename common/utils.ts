const validTypeDocFragmentPaths: string[] = [
  "index",
  "index.html",
  "assets",
  "classes",
  "functions",
  "interfaces",
  "modules",
  "types",
  "variables",
];

/**
 * Extracts package name and version from a doc path string
 */
export function packageFromPath(pathFragments: string) {
  const [pathFragment1, pathFragment2, pathFragment3, ...otherPathFragments] =
    pathFragments.split("/");
  const isScopedPackage = pathFragment1.startsWith("@");
  const defaultPackageVersion = "latest";

  if (!pathFragment1) {
    return null;
  }

  let packageName, packageVersion, docsFragment;

  if (isScopedPackage && !pathFragment2) {
    return null;
  }

  if (isScopedPackage) {
    packageName = [pathFragment1, pathFragment2].join("/");
    if (pathFragment3) {
      // /docs/@foo/bar/modules/index.html
      if (validTypeDocFragmentPaths.includes(pathFragment3)) {
        packageVersion = defaultPackageVersion;
        docsFragment = [pathFragment3, ...otherPathFragments]
          .filter(Boolean)
          .join("/");
      } else {
        // /docs/@foo/bar/1.0/modules/index.html
        packageVersion = pathFragment3;
        docsFragment = otherPathFragments.join("/");
      }
    } else {
      // /docs/@foo/bar
      packageVersion = defaultPackageVersion;
      docsFragment = "";
    }
  } else {
    packageName = pathFragment1;
    if (pathFragment2) {
      // /docs/foo/module/index.html
      if (validTypeDocFragmentPaths.includes(pathFragment2)) {
        packageVersion = defaultPackageVersion;
        docsFragment = [pathFragment2, pathFragment3, ...otherPathFragments]
          .filter(Boolean)
          .join("/");
      } else {
        // /docs/foo/1.0/module/index.html
        packageVersion = pathFragment2;
        docsFragment = [pathFragment3, ...otherPathFragments]
          .filter(Boolean)
          .join("/");
      }
    } else {
      // /docs/foo
      packageVersion = defaultPackageVersion;
      docsFragment = "";
    }
  }

  return {
    packageName,
    packageVersion,
    docsFragment,
  };
}
