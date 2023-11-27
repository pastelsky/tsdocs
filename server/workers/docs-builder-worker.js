require("esbuild-register/dist/node").register();

const {
  generateDocsForPackage,
} = require("../package/extractor/doc-generator");

module.exports = async (job) => {
  return await generateDocsForPackage(job.data.packageJSON, {
    force: job.data.force,
  });
};
