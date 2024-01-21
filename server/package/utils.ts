import fs from "fs";
import { LRUCache } from "lru-cache";
import path from "path";
import sanitize from "sanitize-filename";
import pacote from "pacote";
import { CachedPackageInfo, ProcessedRepoInfo } from "./types";
import { HttpStatusCode } from "axios";

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

const packageRepoDataCache = new LRUCache<string, ProcessedRepoInfo>({
  max: 100,
  ttl: 1000 * 60 * 60,
});

export async function getPackageRepoInfo(packageName: string, packageVersion: string) {
  if (packageRepoDataCache.has(`${packageName}@${packageVersion}`)) {
    return packageRepoDataCache.get(`${packageName}@${packageVersion}`);
  }
  const { repository, versions }: CachedPackageInfo = await pacote.packument(packageName, {
    fullMetadata: true,
  });
  const [protocol, domain, userName, repo] = (versions[packageVersion]?.repository ?? repository).url
    .replace(/\/\//, "/")
    .split("/");
  const repoName = repo.replace(/(\.git)$/, "");
  packageRepoDataCache.set(`${packageName}@${packageVersion}`, { ...repository, protocol, domain, userName, repoName });
  return { ...repository, protocol, domain, userName, repoName };
}

export async function getTagsData(userName = "", repoName = "") {
  const tagsData = await fetch(
    `https://api.github.com/repos/${userName}/${repoName}/git/matching-refs/tags`,
  );
  const allTags: {
    ref: string;
    node_id: string;
    url: string;
    object: { sha: string; type: string; url: string };
  }[] = await tagsData.json();
  if (tagsData.status === HttpStatusCode.Ok) return allTags;
  return [];
}
