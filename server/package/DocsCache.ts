import { docsCachePath, getDocsCachePath } from "./utils";
import fs from "fs";
import path from "path";
import axios from "axios";
import logger from "../../common/logger";

const baseDocsCachePathDisk = path.join(__dirname, "..", "..");

export class DocsCache {
  static async getFromDisk(packageName: string, packageVersion: string) {
    try {
      const docsCachePath = getDocsCachePath({
        packageName,
        packageVersion,
        basePath: baseDocsCachePathDisk,
      });
      await fs.promises.mkdir(path.dirname(docsCachePath), { recursive: true });
      const data = await fs.promises.readFile(docsCachePath, "utf-8");

      return JSON.parse(data);
    } catch (err) {
      return null;
    }
  }

  static async getFromDB(packageName: string, packageVersion: string) {
    try {
      const docsCachePath = getDocsCachePath({
        packageName,
        packageVersion,
        basePath: "",
      });

      const response = await axios.get(
        `https://cf-tsdocs-worker.binalgo.workers.dev/${docsCachePath}`,
      );

      return JSON.parse(response.data);
    } catch (err) {
      return null;
    }
  }

  static async get(packageName: string, packageVersion: string) {
    const docsFromDisk = await DocsCache.getFromDisk(
      packageName,
      packageVersion,
    );

    if (docsFromDisk) {
      logger.info(
        "Docs cache hit for %s %s from disk",
        packageName,
        packageVersion,
      );
      return docsFromDisk;
    }

    const docsFromDB = await DocsCache.getFromDB(packageName, packageVersion);

    if (docsFromDB) {
      logger.info(
        "Docs cache hit for %s %s from DB",
        packageName,
        packageVersion,
      );
      return docsFromDB;
    }

    logger.warn("Docs cache miss for %s %s", packageName, packageVersion);
    return null;
  }

  static async setToDisk(packageName: string, packageVersion: string, data) {
    const docsPath = getDocsCachePath({
      packageName,
      packageVersion,
      basePath: baseDocsCachePathDisk,
    });
    await fs.promises.mkdir(path.dirname(docsPath), { recursive: true });
    await fs.promises.writeFile(docsPath, data, "utf-8");
  }

  static async setToDB(packageName: string, packageVersion: string, data) {
    const docsPath = getDocsCachePath({
      packageName,
      packageVersion,
      basePath: "",
    });

    await axios.put(
      `https://cf-tsdocs-worker.binalgo.workers.dev/${docsPath}`,
      data,
      {},
    );
  }

  static async set(packageName: string, packageVersion: string, typedoc) {
    const data = JSON.stringify(typedoc);

    Promise.all([
      DocsCache.setToDisk(packageName, packageVersion, data)
        .then(() => {
          logger.info(
            "Disk: Docs cache set for %s %s",
            packageName,
            packageVersion,
          );
        })
        .catch((err) => {
          logger.error("Error writing docs cache to disk", err);
        }),
      DocsCache.setToDB(packageName, packageVersion, data)
        .then(() => {
          logger.info(
            "DB: Docs cache set for %s %s",
            packageName,
            packageVersion,
          );
        })
        .catch((err) => {
          logger.error("Error writing docs cache to db", err);
        }),
    ]);
  }
}
