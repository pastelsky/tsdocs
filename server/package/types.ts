export type InstallPackageOptions = {
  client?: "npm" | "yarn" | "pnpm" | "bun";
  limitConcurrency?: boolean;
  networkConcurrency?: number;
  installTimeout?: number;
};
