require("esbuild-register/dist/node").register();

const {
  generateDocsForPackage,
} = require("../package/extractor/doc-generator");

module.exports = async (job) => {
  try {
    return await generateDocsForPackage(job.data.packageJSON, {
      force: job.data.force,
    });
  } catch (err) {
    job.updateData({
      ...job.data,
      originalError: {
        code: err.message,
        stacktrace: err?.originalError?.stack,
        message: err?.originalError?.message,
      },
    });
    throw err;
  }
};
