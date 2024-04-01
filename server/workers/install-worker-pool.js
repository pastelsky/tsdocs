require("esbuild-register/dist/node").register();
const workerpool = require("workerpool");
const { default: InstallationUtils } = require("../package/installation.utils");

async function installPackage({
  packageName,
  packageVersion,
  additionalTypePackages,
  installPath,
}) {
  await InstallationUtils.installPackage(
    [`${packageName}@${packageVersion}`, additionalTypePackages].filter(
      Boolean,
    ),
    installPath,
    {
      client: process.env.INSTALL_CLIENT || "npm",
    },
  );
}

workerpool.worker({
  installPackage,
});
