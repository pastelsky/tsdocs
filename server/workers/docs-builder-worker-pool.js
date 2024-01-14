require("esbuild-register/dist/node").register();

const {
  generateDocsForPackage,
} = require("../package/extractor/doc-generator");
const workerpool = require("workerpool");

async function generateDocs(job) {
  return await generateDocsForPackage(job.packageJSON, {
    force: job.force,
  });
}

workerpool.worker({
  generateDocs,
});
