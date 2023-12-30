import rimraf from "rimraf";
import path from "path";
import { promises as fs } from "fs";
import sanitize from "sanitize-filename";

import { InstallError, PackageNotFoundError } from "./CustomError";
import { exec } from "./common.utils";
import { InstallPackageOptions } from "./types";
import { performance } from "perf_hooks";
import { fileExists } from "next/dist/lib/file-exists";
import logger from "../../common/logger";

// When operating on a local directory, force npm to copy directory structure
// and all dependencies instead of just symlinking files
const wrapPackCommand = (packagePath: string) =>
  `$(npm pack --ignore-scripts ${packagePath} | tail -1)`;

const tmpFolder = path.join("/tmp", "tmp-build");

const InstallationUtils = {
  getInstallPath({
    packageName,
    packageVersion,
    basePath,
  }: {
    packageName: string;
    packageVersion: string;
    basePath: string;
  }) {
    return path.join(
      basePath,
      "packages",
      sanitize(`build-${packageName}-${packageVersion}`),
    );
  },

  async preparePath(packageName: string, packageVersion: string) {
    const installPath = InstallationUtils.getInstallPath({
      packageName,
      packageVersion,
      basePath: tmpFolder,
    });

    await fs.mkdir(tmpFolder, { recursive: true });
    await fs.mkdir(installPath, { recursive: true });

    const packageJSON = path.join(installPath, "package.json");

    const packageJSONExists = await fileExists(packageJSON);

    if (!packageJSONExists)
      await fs.writeFile(
        path.join(installPath, "package.json"),
        JSON.stringify({
          name: "build-package",
          dependencies: {},
          browserslist: [
            "last 5 Chrome versions",
            "last 5 Firefox versions",
            "Safari >= 9",
            "edge >= 12",
          ],
        }),
      );

    return installPath;
  },

  async installPackage(
    packageStrings: string[],
    installPath: string,
    installOptions: InstallPackageOptions,
  ) {
    let flags, command;
    let installStartTime = performance.now();

    const {
      client = "npm",
      limitConcurrency,
      networkConcurrency,
      installTimeout = 600000,
    } = installOptions;

    if (client === "yarn") {
      flags = [
        "ignore-flags",
        "ignore-engines",
        "skip-integrity-check",
        "exact",
        "json",
        "no-progress",
        "silent",
        "no-lockfile",
        "no-bin-links",
        "no-audit",
        "no-fund",
        "ignore-optional",
      ];
      if (limitConcurrency) {
        flags.push("mutex network");
      }

      if (networkConcurrency) {
        flags.push(`network-concurrency ${networkConcurrency}`);
      }
      command = `yarn add ${packageStrings.join(" ")} --${flags.join(" --")}`;
    } else if (client === "npm") {
      flags = [
        // Setting cache is required for concurrent `npm install`s to work
        `cache=${path.join(tmpFolder, "cache")}`,
        "no-package-lock",
        "no-shrinkwrap",
        "no-optional",
        "no-bin-links",
        "progress false",
        "loglevel error",
        "ignore-scripts",
        "save-exact",
        "production",
        "json",
      ];

      command = `npm install ${packageStrings.join(" ")} --${flags.join(
        " --",
      )}`;
    } else if (client === "pnpm") {
      flags = [
        "no-optional",
        "loglevel error",
        "ignore-scripts",
        "save-exact",
        `store-dir ${path.join(tmpFolder, "cache")}`,
      ];

      command = `pnpm add ${packageStrings.join(" ")} --${flags.join(" --")}`;
    } else if (client === "bun") {
      flags = [
        "no-save",
        "exact",
        "no-progress",
        `cache-dir ${path.join(tmpFolder, "cache")}`,
      ];

      command = `bun install ${packageStrings.join(" ")} --${flags.join(
        " --",
      )}`;
    } else {
      console.error("No valid client specified");
      process.exit(1);
    }

    logger.info("install start %s", packageStrings.join(" "));

    try {
      await exec(
        command,
        {
          cwd: installPath,
          maxBuffer: 1024 * 500,
        },
        installTimeout,
      );

      logger.info("install finish %s", packageStrings.join(" "));
    } catch (err) {
      logger.error(err);
      if (typeof err === "string" && err.includes("404")) {
        throw new PackageNotFoundError(err);
      } else {
        throw new InstallError(err);
      }
    }
  },

  async cleanupPath(installPath: string) {
    const noop = () => {};
    try {
      await rimraf(installPath, noop);
    } catch (err) {
      console.error("cleaning up path ", installPath, " failed due to ", err);
    }
  },
};

export default InstallationUtils;
