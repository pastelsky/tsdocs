import Extractor from "./index";
import path from "path";
import get from "lodash/get";
import { promises as fsp } from "fs";
import chalk from "chalk";
import getExtractorConfig from "./base-config";
import fs from "fs";
import Button from "@atlaskit/button/standard-button";
import resolveFrom from "resolve-from";
import resolvePkg from "resolve-pkg";
import { resolveTypePathInbuilt } from "../resolvers";
import packageDirectory from "pkg-dir";
import augmentExtract, { transformCommonJSExport } from "./augment-extract";
import resolve from "enhanced-resolve";

import readPkgUp from "read-pkg-up";
import logger from "../../../common/logger";
import { convertExportAssignment, removeDeclareModule } from "./fixers";

const extractorTSConfig = {
  compilerOptions: {
    target: "es5",
    lib: ["dom", "dom.iterable", "esnext"],
    allowJs: true,
    skipLibCheck: true,
    strict: false,
    forceConsistentCasingInFileNames: true,
    noEmit: true,
    incremental: true,
    esModuleInterop: true,
    module: "esnext",
    moduleResolution: "node",
    resolveJsonModule: true,
    isolatedModules: true,
    jsx: "preserve",
  },
  include: ["./**/*.ts"],
  exclude: [],
};

async function parseError(errorMessage: string, packageDir: string) {
  const MODULE_DETERMINATION_ERROR =
    /.*Internal Error: Unable to determine module for:\s+(\S+).*/m;
  const moduleDeterminationMatch = errorMessage.match(
    MODULE_DETERMINATION_ERROR,
  );

  const EXPORT_DEFAULT_ERROR =
    /.*Internal Error: Unable to analyze the export "default" in\s+(\S+)/m;
  const exportDefaultMatch = errorMessage.match(EXPORT_DEFAULT_ERROR);

  if (moduleDeterminationMatch && moduleDeterminationMatch.length > 1) {
    const {
      packageJson: { name },
    } = await readPkgUp({
      cwd: moduleDeterminationMatch[1],
    });
    return {
      type: "MODULE_DETERMINATION_ERROR",
      definitionPath: moduleDeterminationMatch[1],
      packageName: name,
    };
  }

  if (exportDefaultMatch && exportDefaultMatch.length > 1) {
    const {
      packageJson: { name },
    } = await readPkgUp({
      cwd: exportDefaultMatch[1],
    });
    return {
      type: "EXPORT_DEFAULT_ERROR",
      definitionPath: exportDefaultMatch[1],
      packageName: name,
    };
  }
}

async function getDepsWithTypes(packageDir: string, bundledDeps: string[]) {
  const promises = bundledDeps.map(async (dep) => {
    const resolved = resolvePkg(dep, { cwd: packageDir });
    if (!resolved) {
      return null;
    }
    const packageJSONContents = await fs.promises.readFile(
      path.join(resolved, "package.json"),
      "utf8",
    );
    const packageJSON = JSON.parse(packageJSONContents);
    return resolveTypePathInbuilt(packageDir, packageJSON);
  });

  const resolveResults = await Promise.all(promises);
  return resolveResults
    .filter((result) => result?.typePath)
    .map((result) => result.packageName);
}

export const runExtractOnPackage = async (
  packageDetails: { dir: string; name: string },
  typesEntry: string,
  bundledDeps: string[],
  failedPackages: string[] = [],
): Promise<{
  dtsRollup: string;
  dtsRollupPath: string;
  tsConfigPath: string;
}> => {
  logger.info("Running extract on ", {
    packageDetails,
    typesEntry,
    bundledDeps: bundledDeps.slice(5),
    failedPackages,
  });
  const packageDir = packageDetails.dir;
  const packageName = packageDetails.name;
  const depsToBundle = await getDepsWithTypes(packageDir, bundledDeps);
  const tsConfigPath = path.join(packageDetails.dir, "tsconfig.json");

  let typesEntryContent = await fs.promises.readFile(typesEntry, "utf-8");
  typesEntryContent = transformCommonJSExport(typesEntryContent);
  await fs.promises.writeFile(typesEntry, typesEntryContent);

  const extractorConfig = {
    ...getExtractorConfig(
      "report-api.d.ts",
      "report-api.docmodel.api.json",
      depsToBundle,
    ),
    projectFolder: packageDir,
    mainEntryPointFilePath: typesEntry,
  };

  await fs.promises.writeFile(
    path.join(packageDetails.dir, "extractor-config.json"),
    JSON.stringify(extractorConfig, null, 2),
  );

  await fs.promises.writeFile(
    tsConfigPath,
    JSON.stringify(extractorTSConfig, null, 2),
  );
  const extractor = new Extractor(extractorConfig);

  try {
    const extractResult = await extractor.extract({
      localBuild: true,
    });

    const rollupTempFile = path.join(packageDir, "report-api.d.ts");

    await augmentExtract(rollupTempFile);
    logger.info("Wrote extracted API report to " + rollupTempFile);

    return {
      tsConfigPath,
      dtsRollup: await fsp.readFile(rollupTempFile, "utf8"),
      dtsRollupPath: rollupTempFile,
    };
  } catch (error) {
    logger.error("Failed to generate API report for" + packageName, { error });
    const parsedError = await parseError(error.message, packageDir);

    if (failedPackages.includes(parsedError.packageName)) {
      throw error;
    }

    let rebuild = false;
    if (parsedError?.type === "MODULE_DETERMINATION_ERROR") {
      await removeDeclareModule(parsedError.definitionPath);
      rebuild = true;
    } else if (parsedError?.type === "EXPORT_DEFAULT_ERROR") {
      await convertExportAssignment(parsedError.definitionPath);
      rebuild = true;
    }

    if (rebuild) {
      return runExtractOnPackage(
        packageDetails,
        typesEntry,
        bundledDeps.filter((dep) => dep !== parsedError.packageName),
        [...failedPackages, parsedError.packageName],
      );
    }

    throw error;
  }
};

export type RunExtractOnPackage = typeof runExtractOnPackage;
