import resolve, { CachedInputFileSystem } from "enhanced-resolve";
import fs from "fs";
import path from "path";
import logger from "../../common/logger";
import { checkFileExists } from "./utils";
import semver from "semver";
import InstallationUtils from "./installation.utils";
import pacote from "pacote";
import { LRUCache } from "lru-cache";
import {
  BuildError,
  PackageNotFoundError,
  PackageVersionMismatchError,
} from "./CustomError";

const getTypeResolver = () =>
  resolve.create({
    conditionNames: [
      "types",
      "import",
      // APF: https://angular.io/guide/angular-package-format
      "esm2020",
      "es2020",
      "es2015",
      "require",
      "node",
      "node-addons",
      "browser",
      "default",
    ],
    extensions: [".js"],
    mainFields: [
      "types",
      "typings",
      // APF: https://angular.io/guide/angular-package-format
      "fesm2020",
      "fesm2015",
      "esm2020",
      "es2020",
      "module",
      "jsnext:main",
      "main",
    ],
    fileSystem: new CachedInputFileSystem(fs, 5 * 1000),
    symlinks: false,
  });

export type TypeResolveResult = {
  packagePath: string;
  packageName: string;
  typePath: string;
};

function definitionPath(filePath: string) {
  const filename = path.parse(filePath).name;
  const fileDir = path.dirname(filePath);
  return path.join(fileDir, `${filename}.d.ts`);
}

export async function resolveTypePathInbuilt(
  packageContainingPath,
  packageName,
): Promise<TypeResolveResult> {
  const packagePath = path.join(
    packageContainingPath,
    "node_modules",
    packageName,
  );

  const packageJSON = await getPackageJSON(packagePath);

  if (packageJSON.types) {
    return {
      packagePath: packagePath,
      packageName: packageName,
      typePath: path.resolve(packagePath, packageJSON.types),
    };
  }

  return new Promise((resolve, reject) => {
    getTypeResolver()(
      packageContainingPath,
      packageJSON.name,
      (err, resolvedPath) => {
        if (err || resolvedPath === false) {
          logger.warn(
            "Failed to resolve inbuilt types for %s",
            packageJSON.name,
          );
          return resolve(null);
        } else {
          if (resolvedPath.endsWith(".d.ts")) {
            return resolve({
              packagePath: packagePath,
              packageName: packageJSON.name,
              typePath: resolvedPath,
            });
          } else {
            checkFileExists(definitionPath(resolvedPath)).then((exists) => {
              if (exists) {
                return resolve({
                  packagePath: packagePath,
                  packageName: packageJSON.name,
                  typePath: definitionPath(resolvedPath),
                });
              } else {
                logger.warn(
                  "Failed to resolve inbuilt types for %s",
                  packageJSON.name,
                );
                return resolve(null);
              }
            });
          }
        }
      },
    );
  });
}

type PackageJSON = {
  name: string;
  version: string;
  types?: string;
};

async function getPackageJSON(packagePath: string) {
  console.log("getPackageJSON", packagePath);
  const packageJSONPath = path.join(packagePath, "package.json");
  const packageJSONContents = await fs.promises.readFile(
    packageJSONPath,
    "utf-8",
  );
  return JSON.parse(packageJSONContents);
}

export async function resolveTypePathDefinitelyTyped(
  packageJSON: PackageJSON,
  packumentCache,
) {
  let typeVersions = [];
  if (!packageJSON.name) {
    throw new Error("No name!");
  }
  const typesPackageName = `@types/${packageJSON.name}`;
  const parsedPackageVersion = semver.parse(packageJSON.version);
  try {
    const { versions } = await pacote.packument(typesPackageName, {
      fullMetadata: false,
      packumentCache,
    });
    typeVersions = Object.keys(versions);
  } catch (err) {
    logger.warn(
      "Failed to resolve definitely typed definitions for ",
      { name: packageJSON.name, version: packageJSON.version },
      err,
    );
    return null;
  }

  const matchingMajors = typeVersions.filter(
    (version) => semver.parse(version).major === parsedPackageVersion.major,
  );

  const matchingMinors = typeVersions.filter(
    (version) =>
      semver.parse(version).major === parsedPackageVersion.major &&
      semver.parse(version).minor === parsedPackageVersion.minor,
  );

  let matchingTypeVersion = null;

  if (matchingMinors.length > 0) {
    matchingTypeVersion = matchingMinors
      .sort((versionA, versionB) => semver.compare(versionA, versionB))
      .pop();
  } else if (matchingMajors.length > 0) {
    matchingTypeVersion = matchingMajors
      .sort((versionA, versionB) => semver.compare(versionA, versionB))
      .pop();
  }

  logger.info("Trying definitely typed versions for " + packageJSON.name, {
    matchingTypeVersion,
  });

  if (!matchingTypeVersion) {
    logger.warn(
      "No matching minor version found for a definitely typed definition for",
      { name: packageJSON.name, version: packageJSON.version },
    );

    return null;
  }

  const installPath = await InstallationUtils.preparePath(
    packageJSON.name,
    packageJSON.version,
  );
  await InstallationUtils.installPackage(
    [`${typesPackageName}@${matchingTypeVersion}`],
    installPath,
    { client: "npm" },
  );

  const typeResolveResult = await resolveTypePathInbuilt(
    installPath,
    typesPackageName,
  );

  if (!typeResolveResult) {
    logger.error(
      'Could not resolve type path for "%s" at version %s',
      typesPackageName,
      matchingTypeVersion,
    );
    return null;
  }

  logger.info("Found matching minor version in definitely typed", {
    name: packageJSON.name,
    matchingTypeVersion,
  });
  return typeResolveResult;
}

function handleFailedResolve(err: any, packageName: string) {
  if (err.statusCode === 404) {
    logger.error("Package not found for %s, error %o", packageName, err);
    throw new PackageNotFoundError(err);
  } else if (err.code === "ETARGET" && err.type === "version") {
    logger.error("Package version not found %s, error %o", packageName, err);
    throw new PackageVersionMismatchError(err, err.versions);
  } else {
    logger.error("Failed to resolve version %s, error %o", packageName, err);
    throw new BuildError(err);
  }
}

const npmResolveCache = new LRUCache({
  max: 1000,
  // how long to live in ms
  ttl: 1000 * 60,
});

export async function resolvePackageJSON({
  packageName,
  packageVersion,
}: {
  packageName: string;
  packageVersion: string;
}) {
  const cacheKey = `${packageName}@${packageVersion}`;
  const cachedEntry = npmResolveCache.get(cacheKey);

  if (cachedEntry) {
    return cachedEntry;
  }

  try {
    const manifest = pacote.manifest(`${packageName}@${packageVersion}`);
    npmResolveCache.set(cacheKey, manifest);
    return manifest;
  } catch (err) {
    handleFailedResolve(err, packageName);
  }
}
