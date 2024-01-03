require("esbuild-register/dist/node").register();
require("../init-sentry");

const {
  generateDocsForPackage,
} = require("../package/extractor/doc-generator");
const logger = require("../../common/logger").default;

let workerActiveTime = Date.now();

setInterval(() => {
  if (Date.now() - workerActiveTime > 1000 * 60 * 5) {
    console.log(
      "Worker remained idle for too long without doing much...",
      process.pid,
      " alive for ",
      process.uptime(),
      "s. Without work for ",
      Date.now() - workerActiveTime,
      "s",
    );
  }

  process.exit(0);
}, 5000);

function promiseTimeout(promise, ms = 10000) {
  let timeout = new Promise((resolve, reject) => {
    let id = setTimeout(() => {
      clearTimeout(id);
      reject("Promise timed out in " + ms + "ms.");
    }, ms);
  });

  return Promise.race([promise, timeout]).then(
    (result) => result,
    (error) => Promise.reject(error),
  );
}

module.exports = async (job) => {
  try {
    logger.info(
      "Docs Worker: Starting to build in worker %s %s",
      job.data.packageJSON.name,
      job.data.packageJSON.version,
    );
    workerActiveTime = Date.now();
    const results = await promiseTimeout(
      generateDocsForPackage(job.data.packageJSON, {
        force: job.data.force,
      }),
      120 * 1000,
    );
    return results;
  } catch (err) {
    const isWorkerTimeout = err?.message?.includes("PROMISE_TIMEOUT");

    const errorCode = isWorkerTimeout ? "DOCS_BUILD_TIMEOUT" : err.message;

    logger.error("Docs Worker: Error building docs %o", {
      errorCode,
      stack: err.stack,
      message: err.message,
    });

    job.updateData({
      ...job.data,
      originalError: {
        code: errorCode,
        stacktrace: err?.originalError?.stack,
        message: err?.originalError?.message,
      },
    });
    throw err;
  }
};
