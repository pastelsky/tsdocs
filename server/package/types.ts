export type InstallPackageOptions = {
  client?: "npm" | "yarn" | "pnpm";
  limitConcurrency?: boolean;
  networkConcurrency?: number;
  installTimeout?: number;
};
