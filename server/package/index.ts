import path from "path";

import logger from "../../common/logger";
import fs from "fs";
import { checkFileExists, docsRootPath, getDocsPath } from "./utils";
import { resolvePackageJSON } from "./resolvers";
import { generateDocsForPackage } from "./extractor/doc-generator";
import semver from "semver";

// export async function handlerAPI(req, res) {
//   const { package: pkg, version = "latest" } = req.query;
//
//   if (!pkg) {
//     res.send(404);
//     return;
//   }
//
//   if (pkg === "undefined") {
//     console.log("undefined package");
//     res.send(404);
//     return;
//   }
//
//   const packageJSON = await resolvePackageJSON({
//     packageName: pkg,
//     packageVersion: version,
//   });
//
//   const { jsonPath } = await generateDocsForPackage(packageJSON);
//
//   const docsJSON = await fs.promises.readFile(jsonPath, "utf8");
//   res.header("Content-Type", "application/json");
//   res.send(docsJSON);
// }

// Fragment paths in docs folder
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

function packageFromPath(pathFragments: string) {
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

export async function handlerDocsHTML(req, res) {
  const paramsPath = req.params["*"];
  const routePackageDetails = packageFromPath(paramsPath);

  if (!routePackageDetails) {
    res.send(404);
    return;
  }

  const replyWithDocs = async (
    packageName: string,
    packageVersion: string,
    docsFragment: string,
    docsPathDisk: string,
  ) => {
    const resolvedPath = path.join(packageName, packageVersion, docsFragment);

    if (paramsPath !== resolvedPath) {
      res.redirect(`/docs/${resolvedPath}`);
    }

    const relativeDocsPath = path.relative(
      docsRootPath,
      path.join(docsPathDisk, docsFragment),
    );

    await res.sendFile(relativeDocsPath);
  };

  const { packageName, packageVersion, docsFragment } = routePackageDetails;

  if (semver.valid(packageVersion)) {
    const docsPathDisk = getDocsPath({
      packageName: packageName,
      packageVersion: packageVersion,
    });

    if (await checkFileExists(docsPathDisk)) {
      await replyWithDocs(
        packageName,
        packageVersion,
        docsFragment,
        docsPathDisk,
      );
      return;
    }
  }

  const packageJSON = await resolvePackageJSON({
    packageName,
    packageVersion,
  });

  const docsPathDisk = getDocsPath({
    packageName: packageJSON.name,
    packageVersion: packageJSON.version,
  });

  if (!(await checkFileExists(docsPathDisk))) {
    await generateDocsForPackage(packageJSON);
  }

  await replyWithDocs(
    packageJSON.name,
    packageJSON.version,
    docsFragment,
    docsPathDisk,
  );
}
