import fs from "fs";
import path from "path";
import sanitize from "sanitize-filename";

export const docsVersion = "1.0";
export const docsRootPath = path.join(
  __dirname,
  "..",
  "..",
  "docs",
  docsVersion,
);

export const docsCachePath = (basePath: string) =>
  path.join(basePath, "docs-cache", docsVersion);

export const getDocsPath = ({ packageName, packageVersion }) => {
  return path.join(
    docsRootPath,
    sanitize(packageName.replace("/", "___")).replace("___", "/"),
    sanitize(packageVersion),
  );
};

export const getDocsCachePath = ({ packageName, packageVersion, basePath }) => {
  return path.join(
    docsCachePath(basePath),
    sanitize(packageName) + "@" + sanitize(packageVersion) + ".json",
  );
};
