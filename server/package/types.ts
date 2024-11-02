export type InstallPackageOptions = {
  client?: "npm" | "yarn" | "pnpm" | "bun";
  limitConcurrency?: boolean;
  networkConcurrency?: number;
  installTimeout?: number;
};

export type RepoInfo = {
  type: string; url: string; directory: string
}

export type VersionData = {
  bin: Record<string, string>,
  dependencies: Record<string, string>,
  devDependencies: Record<string, string>,
  dist: {
    integrity: string,
    shasum: string,
    tarball: string,
    signatures: { keyid: string, sig: string }[],
  }, engines: {
    node: string
  },
  name: string,
  version: string,
  repository?: RepoInfo
}

export type CachedPackageInfo = {
  versions: Record<string, VersionData>,
  repository: RepoInfo
}

export type ProcessedRepoInfo = RepoInfo & { protocol: string, domain: string, userName: string, repoName: string };