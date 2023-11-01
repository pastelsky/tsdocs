import path from "path";
import fs from "fs";

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
  include: ["./**/*.ts", "./**/*.d.ts", "./*.ts", "./*.d.ts"],
  exclude: [],
};

export async function generateTSConfig(packageDir: string) {
  const tsConfigPath = path.join(packageDir, "tsconfig.json");

  await fs.promises.writeFile(
    tsConfigPath,
    JSON.stringify(extractorTSConfig, null, 2),
  );
  return tsConfigPath;
}
